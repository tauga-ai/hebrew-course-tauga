-- Adds the 5-minute topic-scoped session kind (naale-topic-based-sessions ticket).
-- Additive: widens an existing CHECK constraint's allowed values and adds two
-- nullable columns. No backfill — every existing row is unaffected; `topic` and
-- `pending_question_id` are simply null for sessions that predate this.
--
-- `pending_question_id` does double duty: it's how session/next records "the
-- last question I actually served" so session/answer and session/open-answer
-- can (a) allow one late answer through after the 5-minute timer expires, for
-- the exact question that was already on screen, and (b) allow a recycled
-- (already-answered-elsewhere) question to be re-answered in a topic session
-- without loosening the duplicate-answer check for anything else. Not an FK:
-- it can point into either naale_questions or naale_open_questions depending
-- on which bank the topic lives in, so a single-table reference doesn't fit.
--
-- Constraint name confirmed live (not guessed) via
-- `supabase db query "select conname ... from pg_constraint where conrelid =
-- 'naale_sessions'::regclass and contype = 'c'"` — naale_sessions_kind_check.

alter table naale_sessions drop constraint naale_sessions_kind_check;
alter table naale_sessions add constraint naale_sessions_kind_check
  check (kind in ('placement', 'practice', 'topic'));

alter table naale_sessions add column topic text;
alter table naale_sessions add column pending_question_id uuid;
