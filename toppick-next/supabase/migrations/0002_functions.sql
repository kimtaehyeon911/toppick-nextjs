-- ============================================================
-- 0002: scoring engine, skill views, star tier recompute
-- Parameters (tune post-launch): K=30 shrinkage, z=1.64,
-- gate = 50 resolved picks / 90 days, enter top 1.0%, drop past 1.5%.
-- ============================================================

-- ---------- resolve a match & score every pick ----------
-- Called by the results-ingestion job (service role):
--   select resolve_match(42, 'a');
create function resolve_match(p_match_id bigint, p_winner side_t)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a bigint; v_b bigint; v_total bigint; v_sport sport_t;
  v_p_crowd numeric;   -- crowd probability assigned to the actual winner
begin
  select coalesce(votes_a,0), coalesce(votes_b,0) into v_a, v_b
    from match_consensus where match_id = p_match_id;
  select sport into v_sport from matches where id = p_match_id;

  v_total := v_a + v_b;
  if v_total = 0 then v_p_crowd := 0.5;
  elsif p_winner = 'a' then v_p_crowd := v_a::numeric / v_total;
  else v_p_crowd := v_b::numeric / v_total;
  end if;
  -- clamp so a unanimous crowd never zeroes the signal entirely
  v_p_crowd := greatest(0.02, least(0.98, v_p_crowd));

  update matches set result = p_winner, status = 'final', resolved_at = now()
    where id = p_match_id and result is null;

  insert into pick_scores (pick_id, user_id, sport, crowd_prob, correct, skill)
  select p.id, p.user_id, v_sport, v_p_crowd,
         (p.side = p_winner),
         -- skill = crowd error − my error = (1−p_c)² − (1−f)²  (f=1 correct, f=0 wrong)
         power(1 - v_p_crowd, 2) - case when p.side = p_winner then 0 else 1 end
  from picks p
  where p.match_id = p_match_id
  on conflict (pick_id) do nothing;
end $$;

-- ---------- per-user / per-sport skill (rolling 90 days) ----------
-- display_score maps shrunk mean skill onto a 0–100-ish scale (50 = crowd-level)
create view user_skill as
select
  s.user_id,
  s.sport,
  count(*)                                   as n,
  sum(s.skill)                               as sum_skill,
  avg(s.skill)                               as mean_skill,
  coalesce(stddev_samp(s.skill), 0)          as sd,
  sum(s.skill) / (count(*) + 30)             as shrunk,                 -- K = 30
  -- 95% lower confidence bound on the mean, shrunk-adjusted
  (sum(s.skill) / (count(*) + 30))
    - 1.64 * (coalesce(stddev_samp(s.skill),0) / sqrt(greatest(count(*),1)))
                                             as lower_bound,
  50 + (sum(s.skill) / (count(*) + 30)) * 400                as display_score,
  50 + ((sum(s.skill) / (count(*) + 30))
    - 1.64 * (coalesce(stddev_samp(s.skill),0) / sqrt(greatest(count(*),1)))) * 400
                                             as display_lo,
  50 + ((sum(s.skill) / (count(*) + 30))
    + 1.64 * (coalesce(stddev_samp(s.skill),0) / sqrt(greatest(count(*),1)))) * 400
                                             as display_hi,
  count(*) filter (where s.correct)          as wins,
  count(*) filter (where not s.correct)      as losses
from pick_scores s
where s.scored_at > now() - interval '90 days'
group by s.user_id, s.sport;
grant select on user_skill to anon, authenticated;

-- public leaderboard (joins profile metadata; ranked by LOWER BOUND, not mean)
create view leaderboard as
select
  row_number() over (partition by us.sport order by us.lower_bound desc) as rank,
  us.sport, us.user_id, pr.display_name, pr.handle, pr.initials,
  us.n, us.wins, us.losses,
  round(us.display_score, 1) as skill,
  round(us.display_lo, 1)    as lo,
  round(us.display_hi, 1)    as hi,
  exists (select 1 from star_tiers st
          where st.user_id = us.user_id and st.sport = us.sport and st.active) as is_star
from user_skill us
join profiles pr on pr.id = us.user_id
where us.n >= 50;                              -- gate: 50 resolved picks / 90d
grant select on leaderboard to anon, authenticated;

-- star-tier aggregated consensus per match (visible without a pass — the teaser number is hidden client-side;
-- individual star picks stay pass-gated by RLS)
create view star_consensus with (security_invoker = off) as
select sp.match_id,
       count(*) as star_n,
       round(100.0 * count(*) filter (where sp.side='a') / count(*)) as pct_a
from star_picks sp
join star_tiers st on st.user_id = sp.user_id and st.active
join matches m on m.id = sp.match_id and m.sport = st.sport
group by sp.match_id;
grant select on star_consensus to anon, authenticated;

-- ---------- weekly star tier recompute (enter 1.0%, drop past 1.5%) ----------
-- Schedule with pg_cron (weekly):
--   select cron.schedule('star-recompute', '0 3 * * 1', $$select recompute_star_tier()$$);
create function recompute_star_tier() returns void
language plpgsql security definer set search_path = public as $$
declare v_sport sport_t;
begin
  foreach v_sport in array enum_range(null::sport_t) loop
    with ranked as (
      select user_id,
             percent_rank() over (order by lower_bound desc) as pr
      from user_skill where sport = v_sport and n >= 50
    )
    -- promote: inside top 1.0%
    insert into star_tiers (user_id, sport, active)
    select user_id, v_sport, true from ranked where pr <= 0.010
    on conflict (user_id, sport) do update set active = true;

    -- demote: only when pushed outside top 1.5% (hysteresis)
    update star_tiers st set active = false
    where st.sport = v_sport and st.active
      and st.user_id not in (
        select user_id from (
          select user_id, percent_rank() over (order by lower_bound desc) as pr
          from user_skill where sport = v_sport and n >= 50
        ) r where r.pr <= 0.015
      );
  end loop;
end $$;

-- ---------- monthly payout snapshot (service role / cron) ----------
create function snapshot_payout(p_start date, p_end date) returns void
language plpgsql security definer set search_path = public as $$
declare v_sport sport_t; v_rev bigint; v_stars int;
begin
  foreach v_sport in array enum_range(null::sport_t) loop
    select coalesce(sum(price_cents),0) into v_rev
      from passes where sport = v_sport
       and created_at >= p_start and created_at < p_end + 1;
    select count(*) into v_stars from star_tiers where sport = v_sport and active;
    if v_stars > 0 then
      insert into payout_ledger (period_start, period_end, sport,
        revenue_cents, pool_cents, star_count, per_star_cents)
      values (p_start, p_end, v_sport, v_rev,
              (v_rev * 0.30)::bigint, v_stars, ((v_rev * 0.30) / v_stars)::bigint);
    end if;
  end loop;
end $$;
