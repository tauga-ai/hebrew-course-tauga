-- Noam's AI end-of-session personalized summary
-- (.claude/resources/Developer_Instructions_Session_Summary_Clean.md).
--
-- Stored per session rather than regenerated on demand. The prompt runs at
-- temperature 0.4, so a re-run produces different wording for the same
-- session — a page reload would visibly rewrite what the student was already
-- told. Storing it also lets the session-history browser
-- (naale-session-breakdown Phase 2) show the note a past session actually got.
--
-- Nullable with no backfill and no default: sessions that ended before this
-- shipped correctly show no note rather than a fabricated one. A generation
-- that fails is deliberately NOT written here, so a later attempt can still
-- produce a real summary instead of freezing the fallback into the row.
alter table naale_sessions
  add column summary_text text,
  add column summary_icon text;

comment on column naale_sessions.summary_text is
  'AI-generated 2-3 sentence Hebrew performance note shown on the end-of-session recap. Null until generated; never holds the hardcoded fallback.';
comment on column naale_sessions.summary_icon is
  'Single emoji chosen by the same AI call to match the session mood.';
