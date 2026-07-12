-- Persist full sentence-building attempts (the student's sentence + the
-- AI's feedback), not just the score, so students can review past attempts.
-- Previously sentence_results/ai_sentence_results were score-only, mirroring
-- interview_results/ai_reading_results — that was never a deliberate
-- privacy decision for this feature, just the original design.
--
-- word_list is only needed on ai_sentence_results: the AI generates a fresh
-- word list per attempt, so it must be captured to show history meaningfully.
-- The curated /sentence feature's word lists are already static content in
-- src/lib/sentence-exercises.ts, addressable via the set_id/exercise_idx
-- already stored today — no need to duplicate them.
--
-- Additive only (nullable columns) — does not affect any existing row,
-- query, or RLS policy. Run this ONCE in the Supabase Dashboard → SQL Editor.

alter table sentence_results add column if not exists sentence_text text;
alter table sentence_results add column if not exists feedback jsonb;

alter table ai_sentence_results add column if not exists sentence_text text;
alter table ai_sentence_results add column if not exists feedback jsonb;
alter table ai_sentence_results add column if not exists word_list jsonb;

-- Sanity check
select column_name, data_type from information_schema.columns
where table_name = 'sentence_results' and column_name in ('sentence_text', 'feedback');
select column_name, data_type from information_schema.columns
where table_name = 'ai_sentence_results' and column_name in ('sentence_text', 'feedback', 'word_list');
