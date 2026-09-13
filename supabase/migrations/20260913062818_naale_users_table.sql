-- One row per Naale student/staff account — role and translation-language preference,
-- brought in line with every other naale_-prefixed table (naale_roster, naale_topic_levels,
-- etc.) instead of living as denormalized columns on the shared, cross-track `students` table
-- (naale-students-own-table). A single unified table with a `role` column covering both students
-- and staff, mirroring naale_roster's own shape, rather than split into two tables.
--
-- user_id is the PRIMARY KEY, not a separate id + unique constraint: this is a genuine 1:1 with
-- students, unlike naale_topic_levels/naale_open_answers (1:many per student), which use a
-- student_id FK column instead.
create table naale_users (
  user_id uuid primary key references students(id) on delete cascade,
  role text not null check (role in ('student', 'staff')),
  translation_lang text not null default 'ru' check (translation_lang in ('ru', 'ar')),
  updated_at timestamptz not null default now()
);

-- RLS as defense-in-depth, zero policies — every read/write to this table goes through
-- createServiceClient() (service-role, always bypasses RLS), same convention as most other
-- tables in this project (see CLAUDE.md's "Server-authoritative DB access").
alter table naale_users enable row level security;

-- Backfill from the current students columns — every row that has ever been provisioned
-- through getNaaleSession() has naale_role set (see 20260812090105_naale_student_role.sql), so
-- this is the same "is it a Naale account" test that migration already used.
insert into naale_users (user_id, role, translation_lang)
select id, naale_role, translation_lang
from students
where naale_role is not null
on conflict (user_id) do nothing;
