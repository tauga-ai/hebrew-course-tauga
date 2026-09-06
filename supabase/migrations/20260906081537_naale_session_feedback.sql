-- Feedback popup shown after a student's 2nd completed practice session
-- (naale-session-feedback-popup). One row per session, enforced by the unique
-- constraint on session_id — a student is only ever asked once, gated by
-- session count server-side, not by anything the client can replay.
--
-- Additive only. RLS enabled with no policies from creation — every read/
-- write goes through createServiceClient() (service-role, bypasses RLS
-- regardless), gated by getNaaleSession(). Same convention as
-- naale_question_reports; the opposite (RLS-disabled-then-fixed) is exactly
-- what happened to naale_topic_flags and is not repeated here.
create table naale_session_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  session_id uuid not null references naale_sessions(id) on delete cascade unique,
  question_quality smallint not null check (question_quality between 1 and 5),
  interface_rating smallint not null check (interface_rating between 1 and 5),
  suggestions text check (suggestions is null or length(suggestions) <= 2000),
  created_at timestamptz not null default now()
);

create index naale_session_feedback_student_idx on naale_session_feedback (student_id);

alter table naale_session_feedback enable row level security;
