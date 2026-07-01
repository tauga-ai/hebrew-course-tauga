-- Student Auth Overhaul — schema prep (Task 1)
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
-- Safe on existing data: no rows are deleted or migrated; legacy students
-- rows simply keep auth_user_id = NULL forever (by design, see plan).

-- 1. classes.join_code — students join a class by code instead of picking
--    freely from a list. Backfill existing classes with a random 6-char code.
alter table classes add column if not exists join_code text;

update classes
set join_code = upper(substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 6))
where join_code is null;

alter table classes add constraint classes_join_code_unique unique (join_code);
alter table classes alter column join_code set not null;

-- 2. students.auth_user_id — links a students row to a real Supabase Auth
--    user. NULLABLE at the DB level (legacy rows stay NULL forever; Postgres
--    UNIQUE allows unlimited NULLs so this doesn't weaken the constraint for
--    real values). The app enforces "must be set" — /api/student/profile is
--    the only writer and always sets it from the authenticated session.
alter table students add column if not exists auth_user_id uuid;
alter table students add constraint students_auth_user_id_unique unique (auth_user_id);
alter table students add constraint students_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id);

-- 3. Sanity check — copy the class codes below, you'll need them for QR
--    codes / to give students.
select id, name, teacher_email, join_code from classes order by id;
