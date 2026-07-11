-- Part 1 of 3 in the RLS lockdown chain — run this, then
-- migration_rls_diagnose_and_force.sql, then
-- migration_rls_drop_remaining_anon_policies.sql. Each later file plugs a
-- gap the previous one missed (leftover fully-permissive anon_all_* policies
-- on some tables); running only this one leaves 16 tables still fully open.
--
-- CRITICAL security fix: every app table currently has RLS fully
-- disabled, which means the public anon key (embedded in the client
-- bundle, not a secret) can read/write/delete every row via Supabase's
-- auto-generated REST API — completely bypassing every auth check our
-- Next.js API routes do. Confirmed empirically before writing this: a
-- plain curl with the anon key against every one of these 22 tables
-- returned HTTP 200 with real rows, including `admins` and `students`.
--
-- The fix is simply enabling RLS with NO policies on almost every table.
-- This is safe because ALL app code reads/writes exclusively through
-- createServiceClient() (the service-role key), and the service_role
-- Postgres role always bypasses RLS regardless of whether it's enabled —
-- confirmed this is the ONLY client used for data queries anywhere in
-- src/ (the anon-key browser client is used solely for Supabase Auth
-- login/session flows, never a single `.from(table)` call).
--
-- ONE exception: `class_teachers` and `admins` get a narrow self-read
-- SELECT policy too. The Realtime Broadcast Authorization policy on
-- realtime.messages (see migration_realtime_teacher_monitor_rls.sql)
-- subqueries these two tables, evaluated under the teacher's own
-- `authenticated` JWT session — NOT service_role. Enabling RLS on them
-- with zero policies would silently break the teacher-monitoring feature
-- (the subquery would always see zero rows). The self-read policy lets an
-- authenticated user see only their OWN row (matched by email) — enough
-- for that check to keep working, while still fully blocking the anon
-- role and blocking any teacher from reading another teacher's row.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

alter table classes enable row level security;
alter table practice_sets enable row level security;
alter table questions enable row level security;
alter table students enable row level security;
alter table submissions enable row level security;
alter table student_answers enable row level security;
alter table interview_practice_answers enable row level security;
alter table ai_reading_results enable row level security;
alter table ai_sentence_results enable row level security;
alter table makbatzim_results enable row level security;
alter table tzav_rishon_results enable row level security;
alter table psychotechnic_submissions enable row level security;
alter table sentence_results enable row level security;
alter table interview_results enable row level security;
alter table simulation_sessions enable row level security;
alter table simulation_reading_answers enable row level security;
alter table simulation_sentence_results enable row level security;
alter table simulation_interview_results enable row level security;
alter table simulation_questions enable row level security;
alter table simulation_sentence_exercises enable row level security;

alter table class_teachers enable row level security;
create policy "teacher_reads_own_row" on class_teachers
for select to authenticated
using (teacher_email = (select auth.jwt() ->> 'email'));

alter table admins enable row level security;
create policy "admin_reads_own_row" on admins
for select to authenticated
using (email = (select auth.jwt() ->> 'email'));

-- Sanity check: every table below should show rowsecurity = true.
select relname, relrowsecurity
from pg_class
where relname in (
  'classes', 'class_teachers', 'admins', 'practice_sets', 'questions',
  'students', 'submissions', 'student_answers', 'interview_practice_answers',
  'ai_reading_results', 'ai_sentence_results', 'makbatzim_results',
  'tzav_rishon_results', 'psychotechnic_submissions', 'sentence_results',
  'interview_results', 'simulation_sessions', 'simulation_reading_answers',
  'simulation_sentence_results', 'simulation_interview_results',
  'simulation_questions', 'simulation_sentence_exercises'
)
order by relname;
