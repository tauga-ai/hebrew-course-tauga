-- Staff-roster aggregate (naale-aggregate-query-performance). Replaces four
-- whole-table reads in /api/naale/staff/students (naale_topic_levels,
-- naale_answers, naale_open_answers, naale_sessions, all `.in('student_id', ...)`
-- across the whole class) with one query that returns already-aggregated
-- totals, one row per requested student.
--
-- Restates buildStudentProgress()'s totals math (src/lib/naale/stats.ts) and
-- the XP/coin constants from src/lib/naale/rewards.ts in SQL rather than
-- sharing code across the TS/SQL boundary. Verified once against the real
-- class in .scratch/verify-staff-totals.ts before the old TS path was
-- removed — if rewards.ts's constants ever change, this function must change
-- with them, same as any other place those constants are duplicated.
--
-- SECURITY INVOKER (default): this project's access control is "service-role
-- bypasses RLS", not per-function privilege escalation, so there's no reason
-- for this function to run as anything but the calling role.
--
-- Read-only, additive, no schema change to any existing table.

create or replace function naale_staff_student_totals(p_student_ids uuid[])
returns table (
  student_id uuid,
  answered integer,
  correct integer,
  sessions integer,
  completed_sessions integer,
  xp integer,
  coins integer
)
language sql
stable
as $$
  with ids as (
    select unnest(p_student_ids) as student_id
  ),
  -- One row per live-or-ended session for the requested students — read once,
  -- reused by both the "all sessions" and "reward/tracked-session" totals
  -- below instead of re-querying naale_sessions per aggregate.
  student_sessions as (
    select id as session_id, student_id, kind, completed
    from naale_sessions
    where student_id = any(p_student_ids)
  ),
  -- kind in ('practice', 'topic') — see rewardEligibleSessionIds in
  -- buildStudentProgress(). Answers/open-answers from any other session kind
  -- (placement) earn no XP or coins, matching "placement is calibration, not
  -- practice."
  reward_eligible_sessions as (
    select session_id from student_sessions where kind in ('practice', 'topic')
  ),
  -- kind != 'topic' — see countsAsTrackedSession() in rewards.ts. Drives both
  -- the completed_sessions total AND the +50 XP completion bonus, exactly as
  -- today: a completed placement session counts toward both, same as a
  -- completed practice session does.
  tracked_sessions as (
    select student_id, completed from student_sessions where kind != 'topic'
  ),
  mcq as (
    select
      a.student_id,
      count(*) filter (where not a.is_review) as answered,
      count(*) filter (where not a.is_review and a.is_correct) as correct,
      -- XP_PER_CORRECT / COINS_PER_CORRECT only apply to non-review answers
      -- from a reward-eligible session.
      count(*) filter (
        where not a.is_review and a.is_correct
        and a.session_id in (select session_id from reward_eligible_sessions)
      ) as xp_eligible_correct
    from naale_answers a
    where a.student_id = any(p_student_ids)
    group by a.student_id
  ),
  open as (
    select
      o.student_id,
      count(*) filter (where not o.is_review) as answered,
      -- GRADED_CORRECT_SCORE / COIN_SCORE_THRESHOLD = 4.
      count(*) filter (where not o.is_review and o.score >= 4) as correct,
      -- XP_BY_SCORE = {1: 0, 2: 1, 3: 4, 4: 7, 5: 10} — restated as a CASE,
      -- see this function's own doc comment on keeping the two in sync.
      coalesce(sum(
        case when not o.is_review and o.session_id in (select session_id from reward_eligible_sessions)
          then case o.score when 1 then 0 when 2 then 1 when 3 then 4 when 4 then 7 when 5 then 10 else 0 end
          else 0
        end
      ), 0) as graded_xp,
      count(*) filter (
        where not o.is_review and o.score >= 4
        and o.session_id in (select session_id from reward_eligible_sessions)
      ) as graded_coins
    from naale_open_answers o
    where o.student_id = any(p_student_ids)
    group by o.student_id
  ),
  tracked as (
    select
      student_id,
      count(*) filter (where completed) as completed_sessions
    from tracked_sessions
    group by student_id
  ),
  all_sessions as (
    select student_id, count(*) as sessions
    from student_sessions
    group by student_id
  )
  select
    i.student_id,
    (coalesce(m.answered, 0) + coalesce(o.answered, 0))::integer as answered,
    (coalesce(m.correct, 0) + coalesce(o.correct, 0))::integer as correct,
    coalesce(s.sessions, 0)::integer as sessions,
    coalesce(t.completed_sessions, 0)::integer as completed_sessions,
    (coalesce(m.xp_eligible_correct, 0) * 10 + coalesce(t.completed_sessions, 0) * 50 + coalesce(o.graded_xp, 0))::integer as xp,
    (coalesce(m.xp_eligible_correct, 0) * 1 + coalesce(o.graded_coins, 0))::integer as coins
  from ids i
  left join mcq m on m.student_id = i.student_id
  left join open o on o.student_id = i.student_id
  left join tracked t on t.student_id = i.student_id
  left join all_sessions s on s.student_id = i.student_id
$$;

comment on function naale_staff_student_totals(uuid[]) is
  'One aggregated totals row per requested student_id (answered/correct/sessions/completed_sessions/xp/coins), replacing four whole-table reads previously done in TypeScript for the staff roster. See naale-aggregate-query-performance ticket. Must stay in sync with buildStudentProgress() (src/lib/naale/stats.ts) and the XP/coin constants in src/lib/naale/rewards.ts.';
