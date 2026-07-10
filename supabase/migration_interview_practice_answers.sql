-- Persistence for the free interview-practice tool (/interview/practice) —
-- previously purely in-memory: answers typed/dictated by the student
-- vanished on refresh or navigation, with no scoring involved at all (it's
-- not AI-graded, just a place to draft answers to a fixed question list).
-- One row per (student, question), upserted in place on re-answer — student-
-- visible only for now, no teacher report planned.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create table interview_practice_answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id integer references classes(id),
  question_id integer not null,
  answer_text text not null,
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);

alter table interview_practice_answers disable row level security;

-- Sanity check
select count(*) from interview_practice_answers;
