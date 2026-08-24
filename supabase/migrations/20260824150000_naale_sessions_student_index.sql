-- Supports the session-history browser on /naale/stats
-- (.claude/ai-docs/tickets/done2/naale-session-breakdown, Phase 2), which
-- lists one student's sessions newest-first. Without this, that query is a
-- sequential scan over every session in the table — fine at today's row
-- count, not fine once a cohort has a school year of daily sessions behind
-- them.
--
-- Composite rather than an index on student_id alone: the list is always
-- "this student's sessions, ordered by start time", so carrying started_at
-- lets the ordering come from the index instead of a sort.
--
-- Pure additive index. No data change, no downtime, nothing to backfill.
create index if not exists naale_sessions_student_started_idx
  on naale_sessions (student_id, started_at desc);
