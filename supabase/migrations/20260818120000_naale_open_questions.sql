-- Free-text, AI-graded exercises (Story Continuation, WhatsApp, Text Summary,
-- and later the picture-description exercise) — none of these fit
-- naale_questions/naale_answers, which are multiple-choice only. Mirrors
-- that pair's shape as closely as makes sense:
--
-- - `prompt` is each topic's own natural "main text" column (an opening
--   line, a paragraph, a task) — used as the upsert key, same role as
--   naale_questions.prompt.
-- - `fields` holds everything else a topic's grading prompt needs (a
--   required word, a recipient, a model answer, anchors, etc.) — shape
--   varies per topic, so this stays a flexible jsonb rather than a wide
--   table of per-topic nullable columns. Which keys are safe to show a
--   student before they answer (vs. grading-only reference answers) is an
--   application-level allowlist (see open-grading.ts's publicFields()), not
--   enforced by the schema.
--
-- Additive only: two new tables, RLS enabled with no policies from creation.

create table naale_open_questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  prompt text not null,
  fields jsonb not null default '{}',
  source_row integer,
  created_at timestamptz not null default now(),
  unique (topic, prompt)
);

create table naale_open_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references naale_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid not null references naale_open_questions(id),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  level_at_answer smallint not null check (level_at_answer between 1 and 5),
  user_text text not null,
  score smallint not null check (score between 1 and 5),
  feedback text not null,
  is_review boolean not null default false,
  answered_at timestamptz not null default now(),
  -- Same race-condition backstop as naale_answers_session_question_unique
  -- (supabase/migrations/20260813132415_naale_answers_unique_session_question.sql).
  unique (session_id, question_id)
);

create index naale_open_questions_topic_difficulty_idx on naale_open_questions (topic, difficulty);
create index naale_open_answers_student_question_idx on naale_open_answers (student_id, question_id);
create index naale_open_answers_student_answered_idx on naale_open_answers (student_id, answered_at);

alter table naale_open_questions enable row level security;
alter table naale_open_answers enable row level security;
