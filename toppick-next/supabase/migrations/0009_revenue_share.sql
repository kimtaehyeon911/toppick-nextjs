-- ============================================================
-- 0009: revenue share redesign (30% -> 10%, per-match for singles)
--   Legal framing: 10% of each content sale is shared EQUALLY among
--   the contributing analysts (co-authored royalty, not a prize).
--   Run after 0008. pass_t enum values: 'single' | 'weekly'.
-- ============================================================
create table if not exists payout_lines (
  id            bigint generated always as identity primary key,
  period_start  date not null,
  period_end    date not null,
  sport         sport_t not null,
  star_id       uuid not null references auth.users(id),
  source_kind   pass_t not null,             -- 'single' | 'weekly'
  match_id      bigint references matches(id),
  gross_cents   bigint not null,
  share_cents   bigint not null,
  created_at    timestamptz not null default now()
);

create index if not exists payout_lines_star_idx on payout_lines(star_id, period_start);

alter table payout_lines enable row level security;

create policy payout_lines_own on payout_lines
  for select using (auth.uid() = star_id);

grant select on payout_lines to authenticated;
grant all on payout_lines to service_role;
create or replace function public.snapshot_payout(p_start date, p_end date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sport       sport_t;
  v_rev         bigint;
  v_stars       int;
  v_pool        bigint;
  v_per         bigint;
  r_match        record;
  v_match_stars  int;
  v_match_pool   bigint;
  v_match_per    bigint;
begin
  delete from payout_lines  where period_start = p_start and period_end = p_end;
  delete from payout_ledger where period_start = p_start and period_end = p_end;

  foreach v_sport in array enum_range(null::sport_t) loop

    -- WEEKLY passes: pooled at the sport level
    select coalesce(sum(price_cents), 0) into v_rev
      from passes
     where sport = v_sport and kind = 'weekly'
       and created_at >= p_start and created_at < p_end + 1;

    select count(distinct sp.user_id) into v_stars
      from star_picks sp
      join matches m on m.id = sp.match_id
     where m.sport = v_sport
       and sp.created_at >= p_start and sp.created_at < p_end + 1;

    v_pool := (v_rev * 0.10)::bigint;

    if v_stars > 0 and v_pool > 0 then
      v_per := (v_pool / v_stars)::bigint;

      insert into payout_lines (period_start, period_end, sport, star_id,
        source_kind, match_id, gross_cents, share_cents)
      select p_start, p_end, v_sport, sp.user_id,
             'weekly', null, v_pool, v_per
      from (
        select distinct sp.user_id
        from star_picks sp
        join matches m on m.id = sp.match_id
        where m.sport = v_sport
          and sp.created_at >= p_start and sp.created_at < p_end + 1
      ) sp;
    end if;

    insert into payout_ledger (period_start, period_end, sport,
      revenue_cents, pool_cents, star_count, per_star_cents)
    values (p_start, p_end, v_sport, v_rev, v_pool, v_stars,
            case when v_stars > 0 then (v_pool / v_stars)::bigint else 0 end);

  end loop;

  -- SINGLE passes: pooled per match
  for r_match in
    select p.match_id, m.sport, sum(p.price_cents) as rev
    from passes p
    join matches m on m.id = p.match_id
    where p.kind = 'single' and p.match_id is not null
      and p.created_at >= p_start and p.created_at < p_end + 1
    group by p.match_id, m.sport
  loop
    select count(distinct user_id) into v_match_stars
      from star_picks where match_id = r_match.match_id;

    v_match_pool := (r_match.rev * 0.10)::bigint;

    if v_match_stars > 0 and v_match_pool > 0 then
      v_match_per := (v_match_pool / v_match_stars)::bigint;

      insert into payout_lines (period_start, period_end, sport, star_id,
        source_kind, match_id, gross_cents, share_cents)
      select p_start, p_end, r_match.sport, sp.user_id,
             'single', r_match.match_id, v_match_pool, v_match_per
      from (select distinct user_id from star_picks where match_id = r_match.match_id) sp;
    end if;
  end loop;
end $function$;