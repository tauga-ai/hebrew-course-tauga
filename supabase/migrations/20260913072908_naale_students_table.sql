-- One row per Naale student/staff account, with its OWN primary key — independent of
-- students.id (naale-students-full-split). Backfilled id-for-id from the current students
-- row so every naale_*.student_id FK below needs zero data rewriting, only a retargeted
-- constraint. Folds in naale_users (role, translation_lang) directly rather than keeping it
-- as a separate satellite table alongside this one.
create table naale_students (
  id uuid primary key,
  auth_user_id uuid unique references auth.users(id),
  full_name text not null,
  role text not null check (role in ('student', 'staff')),
  translation_lang text not null default 'ru' check (translation_lang in ('ru', 'ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table naale_students enable row level security;

-- naale_users is the authoritative source for role/translation_lang — it's already live in
-- production and more up to date than students.naale_role/translation_lang, which stopped
-- being written the moment naale_users started being written to instead (confirmed live: one
-- test account already has a naale_users row but a null students.naale_role).
insert into naale_students (id, auth_user_id, full_name, role, translation_lang, created_at)
select s.id, s.auth_user_id, s.full_name, u.role, u.translation_lang, s.created_at
from naale_users u
join students s on s.id = u.user_id;

-- Sanity check: should match `select count(*) from naale_users`.
select count(*) from naale_students;

-- Repoint every Naale table's student_id (and one resolved_by) FK from students(id) to
-- naale_students(id). Column names are unchanged — only the constraint's target table moves.
-- Values already satisfy the new constraint (see the id-reuse backfill above), so this
-- validates instantly with no rows to reconcile. Constraint names confirmed against the live
-- schema (supabase db dump) before writing this, not assumed.
alter table naale_topic_levels drop constraint naale_topic_levels_student_id_fkey,
  add constraint naale_topic_levels_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;

alter table naale_sessions drop constraint naale_sessions_student_id_fkey,
  add constraint naale_sessions_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;

alter table naale_answers drop constraint naale_answers_student_id_fkey,
  add constraint naale_answers_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;

alter table naale_open_answers drop constraint naale_open_answers_student_id_fkey,
  add constraint naale_open_answers_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;

alter table naale_question_reports drop constraint naale_question_reports_student_id_fkey,
  add constraint naale_question_reports_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;

alter table naale_question_reports drop constraint naale_question_reports_resolved_by_fkey,
  add constraint naale_question_reports_resolved_by_fkey
    foreign key (resolved_by) references naale_students(id) on delete set null;

alter table naale_session_feedback drop constraint naale_session_feedback_student_id_fkey,
  add constraint naale_session_feedback_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;
