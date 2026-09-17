-- Fixes a real, live bug in naale_question_reports (20260820160000): its
-- question_row_id column was typed `uuid`, written back when the only two
-- question banks (naale_questions, naale_open_questions) both used a real
-- uuid primary key. naale_debate_questions and naale_roleplay_questions,
-- added later, have no uuid id at all — their primary key is the text
-- question_id itself ("debate_1", "roleplay_18") — so report-question/route.ts
-- setting question_row_id to that string on insert has been failing outright
-- ("invalid input syntax for type uuid") for every debate report since debate
-- shipped, and for every role-play report since role-play shipped. Found via
-- live QA, 2026-09-17.
--
-- text is the correct type going forward: this column was already
-- unenforced (no FK, by the original migration's own deliberate design — see
-- its comment on why), so nothing downstream depends on real uuid semantics,
-- only on it being a stable string that identifies the row. The cast is
-- lossless for the 8 existing rows (all real uuids from mcq/open reports,
-- which stringify and read back identically).

alter table naale_question_reports
  alter column question_row_id type text using question_row_id::text;
