-- Pausable timer for 5-minute topic sessions (naale-topic-session-resume).
--
-- Noam (2026-08-27), asked what should happen when a student quits a 5-minute
-- session halfway: "I do want them to be able to resume if they get
-- interrupted (e.g., by a phone call), so the timer should pause."
--
-- Additive and nullable: every existing row is unaffected and reads as "not
-- paused", which is the correct interpretation for sessions that predate this.
-- No backfill, no constraint change, no index — safe to apply ahead of the
-- code that reads it, and inert until something does.
--
-- WHY A REMAINDER RATHER THAN A paused_at TIMESTAMP
--
-- deadline_at stays the single source of truth for "when does this session
-- end", so isExpired(), secondsRemaining() and hasReachedTimer() are all
-- untouched — including isExpired(), which is the server-side guard that
-- refuses answers submitted past a student's time limit. Pausing MOVES the
-- deadline (resume sets deadline_at = now + remainder) instead of replacing
-- the model with accumulated-elapsed-time, which would have meant rewriting
-- that guard days before the programme starts.
--
-- Storing the remainder rather than the moment of pausing also makes the
-- resume arithmetic independent of how long the student was actually away,
-- which is the entire point of the feature.
--
-- NULL = running. Non-null = paused, with this many milliseconds left.
--
-- CAUTION FOR ANYONE READING deadline_at: a paused session's deadline_at is
-- frozen in the PAST by construction. Every consumer must check this column
-- first — in particular session/start/route.ts's stale-session sweep, which
-- ends any un-ended session whose deadline has passed and would otherwise
-- close exactly the sessions this feature exists to preserve.
--
-- 0 is a legitimate value (paused with no time left), so reads must test for
-- NULL explicitly rather than relying on truthiness.

alter table naale_sessions add column paused_remaining_ms integer;

comment on column naale_sessions.paused_remaining_ms is
  'Milliseconds left when a 5-minute topic session was paused; NULL while running. A paused row''s deadline_at is stale — check this first.';
