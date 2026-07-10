-- Persistence for the 2 AI-practice features (ai-practice/reading,
-- ai-practice/sentence), which previously saved nothing — the AI generated
-- a question, graded it, and the result vanished once the student left the
-- page. One row per question/exercise attempt, score-only (no AI-generated
-- question/passage/sentence/feedback text persisted) — mirrors the existing
-- sentence_results/interview_results convention exactly.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create table ai_reading_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id integer references classes(id),
  level smallint not null check (level between 1 and 5),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table ai_sentence_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id integer references classes(id),
  level smallint not null check (level between 1 and 5),
  score smallint not null check (score between 0 and 10),
  created_at timestamptz not null default now()
);

alter table ai_reading_results disable row level security;
alter table ai_sentence_results disable row level security;

-- Sanity check
select count(*) from ai_reading_results;
select count(*) from ai_sentence_results;
