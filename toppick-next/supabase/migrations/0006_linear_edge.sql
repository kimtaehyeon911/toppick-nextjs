-- ============================================================
-- 0006: Skill Score v2 — LINEAR EDGE (approved)
--   raw score per pick = outcome − crowd probability of the picked side
--     · 92:8 favorite hit  → +0.08 | miss → −0.92
--     · 55:45 underdog hit → +0.55 | miss → −0.45
--   Properties (simulation-verified):
--     · uninformed EV is exactly 0 on either side → no herding incentive
--     · a true +10%p edge pays +0.10 EV regardless of pick style
--   Replaces the Brier-diff form from 0002, which with forced 0/1 picks
--   carried a negative, style-dependent bias (Spearman with true edge
--   0.27 vs 0.81; correlation with underdog style −0.93 → herding).
--
--   crowd_prob column now stores: leave-one-out closing consensus
--   probability of the side the USER picked (was: prob of the winner).
-- ============================================================

-- ---------- resolve: score every pick with linear edge ----------
create or replace function resolve_match(p_match_id bigint, p_winner side_t)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a bigint; v_b bigint; v_total bigint; v_sport sport_t;
begin
  select coalesce(votes_a,0), coalesce(votes_b,0) into v_a, v_b
    from match_consensus where match_id = p_match_id;
  select sport into v_sport from matches where id = p_match_id;
  v_total := v_a + v_b;

  update matches set result = p_winner, status = 'final', resolved_at = now()
    where id = p_match_id and result is null;

  -- minimum pool: below 30 votes the "crowd" is not a benchmark — void scoring
  if v_total < 30 then return; end if;

  insert into pick_scores (pick_id, user_id, sport, crowd_prob, correct, skill)
  select p.id, p.user_id, v_sport,
         loo.p_pick,
         (p.side = p_winner),
         -- linear edge: outcome − p_crowd(picked side)
         (case when p.side = p_winner then 1 else 0 end) - loo.p_pick
  from picks p
  cross join lateral (
    select greatest(0.02, least(0.98,
      -- leave-one-out: remove my own vote from the consensus I'm scored against
      (case when p.side = 'a' then v_a else v_b end - 1)::numeric
        / nullif(v_total - 1, 0)
    )) as p_pick
  ) loo
  where p.match_id = p_match_id
  on conflict (pick_id) do nothing;
end $$;

-- ---------- skill view: shrunk mean edge + LCB with null-variance floor ----------
-- σ_floor = sqrt(avg p(1−p)) — the variance a pick stream has under zero edge.
-- Prevents a short streak (sample sd → 0) from faking certainty:
--   10 straight 50/50 wins → LCB ≈ −0.005 ; 500-pick +8%p veteran → LCB ≈ +0.032.
-- Display scale: 50 + 250 × value  (edge +0.10 ≈ score 75; 50 = crowd-level).
create or replace view user_skill as
select
  s.user_id,
  s.sport,
  count(*)                                   as n,
  sum(s.skill)                               as sum_skill,
  avg(s.skill)                               as mean_skill,
  coalesce(stddev_samp(s.skill), 0)          as sd,
  sum(s.skill) / (count(*) + 30)             as shrunk,                 -- K = 30
  (sum(s.skill) / (count(*) + 30))
    - 1.64 * (greatest(coalesce(stddev_samp(s.skill),0),
                       sqrt(avg(s.crowd_prob * (1 - s.crowd_prob))))
              / sqrt(count(*) + 30))
                                             as lower_bound,
  50 + (sum(s.skill) / (count(*) + 30)) * 250                as display_score,
  50 + ((sum(s.skill) / (count(*) + 30))
    - 1.64 * (greatest(coalesce(stddev_samp(s.skill),0),
                       sqrt(avg(s.crowd_prob * (1 - s.crowd_prob))))
              / sqrt(count(*) + 30))) * 250
                                             as display_lo,
  50 + ((sum(s.skill) / (count(*) + 30))
    + 1.64 * (greatest(coalesce(stddev_samp(s.skill),0),
                       sqrt(avg(s.crowd_prob * (1 - s.crowd_prob))))
              / sqrt(count(*) + 30))) * 250
                                             as display_hi,
  count(*) filter (where s.correct)          as wins,
  count(*) filter (where not s.correct)      as losses
from pick_scores s
where s.scored_at > now() - interval '90 days'
group by s.user_id, s.sport;
grant select on user_skill to anon, authenticated;

-- leaderboard / recompute_star_tier read user_skill by column name and are
-- unchanged: ranking stays on lower_bound, gate stays n ≥ 50 / 90d,
-- star hysteresis stays enter top 1.0% / demote past 1.5%.
