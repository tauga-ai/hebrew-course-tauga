-- Debate & Opinion Expression module (naale-debate-module). Additive only:
-- two new tables, one new nullable column on naale_sessions.
--
-- naale_debate_questions.question_id is the table's own PK, not a
-- generated uuid + separate unique key like naale_questions/naale_open_questions
-- use — the delivered content already ships a stable "debate_N" string per
-- row (its own "question_id" column, not the usual bare "#"), so there is no
-- separate raw number to derive a synthetic key from, and no reason to
-- duplicate an ID that's already stable and unique.
--
-- naale_debate_answers mirrors naale_open_answers's shape (session_id,
-- student_id, question_id, topic, difficulty, level_at_answer, score,
-- feedback, is_review, answered_at, unique(session_id, question_id)) plus
-- two turn-text columns instead of one user_text — a debate exchange has up
-- to two user turns (turn_2_text null when max_turns = 1) — and
-- ai_counter_argument, the AI's mid-exchange reply, kept for transcript/audit
-- even though it isn't re-graded.
--
-- pending_exchange holds in-progress conversation state between the two
-- request/response round trips a two-turn question needs before scoring —
-- nothing in this app persisted a Gemini conversation across requests before
-- this. Deliberately generic (not "pending_debate_exchange"): the sibling
-- role-play module (naale-roleplay-module) needs the exact same shape and
-- will reuse this column, not add its own. Not an FK for the same reason
-- pending_question_id isn't one
-- (supabase/migrations/20260826130853_naale_topic_sessions.sql) — it can
-- point at a debate or role-play question depending on which table the
-- in-progress exchange belongs to.

create table naale_debate_questions (
  question_id text primary key,
  topic text not null default 'דיבייט הבעת דעה',
  difficulty smallint not null check (difficulty between 1 and 5),
  subject text not null,
  initial_ai_argument text not null,
  required_connectors text not null,
  expected_answer_rubric text not null,
  max_turns smallint not null check (max_turns in (1, 2)),
  source_row integer,
  created_at timestamptz not null default now()
);

create table naale_debate_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references naale_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id text not null references naale_debate_questions(question_id),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  level_at_answer smallint not null check (level_at_answer between 1 and 5),
  turn_1_text text not null,
  turn_2_text text,
  ai_counter_argument text,
  score smallint not null check (score between 1 and 5),
  feedback text not null,
  is_review boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create index naale_debate_questions_difficulty_idx on naale_debate_questions (difficulty);
create index naale_debate_answers_student_question_idx on naale_debate_answers (student_id, question_id);
create index naale_debate_answers_student_answered_idx on naale_debate_answers (student_id, answered_at);

alter table naale_sessions add column pending_exchange jsonb;

alter table naale_debate_questions enable row level security;
alter table naale_debate_answers enable row level security;
