-- "Found a mistake in this question? Report it to us" — Noam's N4 request.
--
-- The report is a SNAPSHOT, not a pointer. Every field describing the question
-- is copied in at report time rather than joined at read time, and there is
-- deliberately NO foreign key to either question bank:
--
--   * Since the stable-question_id migration, re-importing an edited workbook
--     UPDATES a question row in place. A report saying "this sentence is wrong"
--     that resolves its text through a live join would silently start showing
--     the corrected text — destroying the only evidence of what was reported.
--   * A question can also be deleted outright between the report and someone
--     reading it. A FK would either cascade the report away or block the
--     delete; neither is right for what is essentially an incident record.
--
-- question_row_id keeps the uuid anyway, so staff can still find the live row
-- when it does still exist; it just isn't enforced.
--
-- The question may come from either bank (naale_questions, multiple-choice, or
-- naale_open_questions, AI-graded free text), which is why question_kind exists
-- and why the uuid alone isn't enough to know where to look.
--
-- Additive only: one new table, RLS enabled with no policies from creation.
-- Access is entirely server-side through the service-role client, gated by
-- getNaaleSession() (submitting) and requireNaaleStaff() (reading/resolving).

create table naale_question_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  -- Nullable and set null: a report outlives the session it was filed from.
  session_id uuid references naale_sessions(id) on delete set null,

  question_kind text not null check (question_kind in ('mcq', 'open')),
  question_row_id uuid not null,
  -- The human-readable id from the workbook's `#` column, e.g. '9_13'. This is
  -- what a content editor actually searches for, and the reason N4 was blocked
  -- on the stable-question_id work.
  question_id text not null,
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  -- What the question said AT REPORT TIME. See the snapshot note above.
  prompt_snapshot text not null,
  -- What the reporter themselves did, if they had already answered when they
  -- filed — usually the fastest way to see what confused them. Both nullable:
  -- they can report a question before answering it.
  --
  -- student_answer holds free text and is therefore ALWAYS null for a
  -- multiple-choice report: naale_answers records only whether the answer was
  -- correct, never which option was picked, so there is no chosen answer in
  -- this system to snapshot. student_was_correct is the one signal that means
  -- the same thing for both banks (a graded answer counts as correct at
  -- GRADED_CORRECT_SCORE and above, exactly as it does everywhere else).
  student_answer text,
  student_was_correct boolean,

  note text not null check (length(btrim(note)) > 0),

  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references students(id) on delete set null
);

-- The staff triage list: open reports first, newest first.
create index naale_question_reports_status_created_idx
  on naale_question_reports (status, created_at desc);
-- Submission rate limiting counts a student's recent reports.
create index naale_question_reports_student_created_idx
  on naale_question_reports (student_id, created_at desc);
-- "Has this question been reported before?" while reading one.
create index naale_question_reports_question_idx
  on naale_question_reports (question_id);

alter table naale_question_reports enable row level security;
