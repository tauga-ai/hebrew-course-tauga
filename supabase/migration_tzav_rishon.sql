-- Results for the "דפ״ר לצו ראשון" bilingual (Hebrew/Arabic) practice
-- section (300 quantitative-reasoning MCQ questions across 4 topics).
-- One row per question attempt, not one row per full-topic submission —
-- matches sentence_results' per-attempt shape, not psychotechnic_submissions'
-- per-set JSONB shape, because this section's UX is immediate per-question
-- feedback (see correct/incorrect + explanation right after answering), not
-- a blind batch-then-submit. The unique constraint + upsert-on-conflict
-- means redoing a question updates the row in place instead of
-- accumulating duplicates that would skew the per-question teacher stats.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create table tzav_rishon_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id integer references classes(id),
  topic text not null,
  question_id integer not null,
  selected_option integer not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (student_id, topic, question_id)
);

alter table tzav_rishon_results disable row level security;

-- Sanity check
select count(*) from tzav_rishon_results;
