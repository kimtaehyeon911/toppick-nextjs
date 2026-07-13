-- ============================================================
-- Top Pick — Phase 1 schema (Supabase / Postgres)
-- 0001: tables, row-level security, public views
-- ============================================================

create type sport_t  as enum ('soccer','baseball','basketball','ufc');
create type side_t   as enum ('a','b');
create type mstat_t  as enum ('scheduled','live','final');
create type pass_t   as enum ('single','weekly');

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique,
  display_name  text not null default 'Analyst',
  initials      text not null default 'AN',
  -- identity hash (CI/DI) set only at payout/star verification. One person = one verified profile.
  verified_ci   text unique,
  created_at    timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles are public"  on profiles for select using (true);
create policy "own profile insert"   on profiles for insert with check (auth.uid() = id);
create policy "own profile update"   on profiles for update using (auth.uid() = id);

-- auto-create profile on signup (incl. anonymous sessions)
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, initials)
  values (new.id, 'Analyst', upper(substr(md5(new.id::text), 1, 2)));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- matches ----------
create table matches (
  id         bigint generated always as identity primary key,
  sport      sport_t not null,
  league     text not null,
  starts_at  timestamptz not null,
  status     mstat_t not null default 'scheduled',
  clock      text,                     -- "67'", "6th", "in 2h" (denormalized display)
  team_a     jsonb not null,           -- {name, abbr, color}
  team_b     jsonb not null,
  result     side_t,                   -- set on resolve
  resolved_at timestamptz
);
alter table matches enable row level security;
create policy "matches are public" on matches for select using (true);
-- writes: service role only (ingestion job / admin)

-- ---------- picks (free predictions; one per user per match) ----------
create table picks (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  match_id   bigint not null references matches(id) on delete cascade,
  side       side_t not null,
  created_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index picks_match_idx on picks(match_id);
create index picks_user_idx  on picks(user_id);
alter table picks enable row level security;
create policy "read own picks"   on picks for select using (auth.uid() = user_id);
create policy "cast pick"        on picks for insert with check (
  auth.uid() = user_id
  and exists (select 1 from matches m where m.id = match_id and m.result is null)
);
create policy "change pick before lock" on picks for update using (
  auth.uid() = user_id
  and exists (select 1 from matches m where m.id = match_id and m.result is null)
);

-- public consensus without exposing individual ballots
create view match_consensus with (security_invoker = off) as
  select m.id as match_id,
         count(*) filter (where p.side = 'a') as votes_a,
         count(*) filter (where p.side = 'b') as votes_b
  from matches m left join picks p on p.match_id = m.id
  group by m.id;
grant select on match_consensus to anon, authenticated;

-- ---------- pick scoring (crowd-relative Brier skill) ----------
-- skill = (1 - p_crowd)^2 - (1 - f)^2 ; f = 1 if pick correct else 0
create table pick_scores (
  pick_id    bigint primary key references picks(id) on delete cascade,
  user_id    uuid   not null,
  sport      sport_t not null,
  crowd_prob numeric(6,5) not null,   -- crowd prob assigned to the ACTUAL result
  correct    boolean not null,
  skill      numeric(8,6) not null,
  scored_at  timestamptz not null default now()
);
create index pick_scores_user_sport_idx on pick_scores(user_id, sport, scored_at);
alter table pick_scores enable row level security;
create policy "read own scores" on pick_scores for select using (auth.uid() = user_id);

-- ---------- star tier (per sport, hysteresis handled in recompute fn) ----------
create table star_tiers (
  user_id  uuid    not null references profiles(id) on delete cascade,
  sport    sport_t not null,
  active   boolean not null default true,
  since    timestamptz not null default now(),
  primary key (user_id, sport)
);
alter table star_tiers enable row level security;
create policy "star tier is public" on star_tiers for select using (true);

-- ---------- star picks (only active stars may post; gated reads) ----------
create table star_picks (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  match_id    bigint not null references matches(id) on delete cascade,
  side        side_t not null,
  confidence  int not null check (confidence between 50 and 99),
  created_at  timestamptz not null default now(),
  unique (user_id, match_id)
);
alter table star_picks enable row level security;
create policy "stars post picks" on star_picks for insert with check (
  auth.uid() = user_id and exists (
    select 1 from star_tiers st
    join matches m on m.id = match_id and m.sport = st.sport
    where st.user_id = auth.uid() and st.active
  )
);
-- read requires: (a) a valid pass for that sport covering now/that match, or (b) being an active star OF THAT SPORT
create policy "pass-gated read" on star_picks for select using (
  exists (
    select 1 from passes ps
    join matches m on m.id = star_picks.match_id
    where ps.user_id = auth.uid()
      and ps.sport = m.sport
      and (ps.kind = 'weekly' and ps.expires_at > now()
           or ps.kind = 'single' and ps.match_id = star_picks.match_id)
  )
  or exists (
    select 1 from star_tiers st
    join matches m on m.id = star_picks.match_id and m.sport = st.sport
    where st.user_id = auth.uid() and st.active
  )
);

-- ---------- passes (viewing rights; per sport, per your policy stars also buy other sports) ----------
create table passes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  sport      sport_t not null,
  kind       pass_t not null,
  match_id   bigint references matches(id),      -- for 'single'
  price_cents int not null,
  expires_at timestamptz,                        -- for 'weekly'
  created_at timestamptz not null default now()
);
alter table passes enable row level security;
create policy "read own passes" on passes for select using (auth.uid() = user_id);
-- NOTE: pass INSERT is done by the payments edge function (service role) after
-- Stripe/StoreKit confirms. No client-side insert policy on purpose.

-- ---------- community posts (gated: must have a pick on that match) ----------
create table posts (
  id         bigint generated always as identity primary key,
  match_id   bigint not null references matches(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  upvotes    int not null default 0,
  created_at timestamptz not null default now()
);
create index posts_match_idx on posts(match_id, created_at desc);
alter table posts enable row level security;
create policy "posts are public" on posts for select using (true);
create policy "post after picking" on posts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from picks p where p.user_id = auth.uid() and p.match_id = posts.match_id)
);

-- ---------- payout ledger (30% pool, equal split, service-role writes) ----------
create table payout_ledger (
  id             bigint generated always as identity primary key,
  period_start   date not null,
  period_end     date not null,
  sport          sport_t not null,
  revenue_cents  bigint not null,
  pool_cents     bigint not null,      -- revenue * 0.30
  star_count     int not null,
  per_star_cents bigint not null,
  created_at     timestamptz not null default now()
);
alter table payout_ledger enable row level security;
create policy "ledger is public" on payout_ledger for select using (true);
