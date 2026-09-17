-- Role-play in Everyday Situations module (naale-roleplay-module). Additive
-- only: two new tables. Mirrors naale_debate_questions/naale_debate_answers'
-- shape (supabase/migrations/20260915072146_naale_debate_module.sql) — same
-- reasoning: question_id is this table's own PK (the delivered sheet already
-- ships stable "roleplay_N" strings, no separate raw number to derive a
-- synthetic key from), and the answers table has two turn-text columns
-- instead of one because an exchange has up to two student turns.
--
-- ai_in_character_reply (the in-character line shown between the student's
-- two turns) is kept for transcript/audit, same as debate's
-- ai_counter_argument — not re-graded, just recorded.
--
-- pending_exchange already exists (added by the debate migration, deliberately
-- generic so this sibling module could reuse it without its own column) — not
-- re-added here.
--
-- student_id targets naale_students(id), not students(id) — the debate
-- migration got this wrong the first time (fixed in
-- 20260915080646_naale_debate_answers_fk_naale_students.sql) because
-- getNaaleSession() resolves student.id from naale_students, not students.
-- Written correctly from the start here.

create table naale_roleplay_questions (
  question_id text primary key,
  topic text not null default 'משחק תפקידים',
  difficulty smallint not null check (difficulty between 1 and 5),
  scenario_description text not null,
  ai_persona text not null,
  initial_ai_line text not null,
  expected_goal_and_register text not null,
  max_turns smallint not null check (max_turns in (1, 2)),
  source_row integer,
  created_at timestamptz not null default now()
);

create table naale_roleplay_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references naale_sessions(id) on delete cascade,
  student_id uuid not null references naale_students(id) on delete cascade,
  question_id text not null references naale_roleplay_questions(question_id),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  level_at_answer smallint not null check (level_at_answer between 1 and 5),
  turn_1_text text not null,
  turn_2_text text,
  ai_in_character_reply text,
  score smallint not null check (score between 1 and 5),
  feedback text not null,
  is_review boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create index naale_roleplay_questions_difficulty_idx on naale_roleplay_questions (difficulty);
create index naale_roleplay_answers_student_question_idx on naale_roleplay_answers (student_id, question_id);
create index naale_roleplay_answers_student_answered_idx on naale_roleplay_answers (student_id, answered_at);

alter table naale_roleplay_questions enable row level security;
alter table naale_roleplay_answers enable row level security;
