-- Grade-level filtering on the Naale staff roster (naale-grade-filtering).
-- Additive only. Students get a scalar grade column, synced from
-- naale_roster at login the same way `role` already is (see auth.ts) — one
-- grade per student, never more. Staff need 0-to-many (a staff member can
-- cover several grades, or none at all if they oversee everything, per
-- Noam/Jonatan's spec), which a scalar column can't express, hence the
-- separate join table for staff only.

alter table naale_roster
  add column grade text check (grade is null or grade in ('ז', 'ח', 'ט'));

alter table naale_students
  add column grade text check (grade is null or grade in ('ז', 'ח', 'ט'));

create table naale_staff_grades (
  staff_id uuid not null references naale_students(id) on delete cascade,
  grade text not null check (grade in ('ז', 'ח', 'ט')),
  primary key (staff_id, grade)
);

alter table naale_staff_grades enable row level security;
