-- Widen Naale grade set from 7th-9th to 7th-12th (naale-grade-10-12).
-- Superset-only: every existing row stays valid, no backfill.
begin;

alter table naale_roster       drop constraint if exists naale_roster_grade_check;
alter table naale_students     drop constraint if exists naale_students_grade_check;
alter table naale_staff_grades drop constraint if exists naale_staff_grades_grade_check;

alter table naale_roster
  add constraint naale_roster_grade_check
  check (grade is null or grade in ('ז','ח','ט','י','יא','יב'));

alter table naale_students
  add constraint naale_students_grade_check
  check (grade is null or grade in ('ז','ח','ט','י','יא','יב'));

alter table naale_staff_grades
  add constraint naale_staff_grades_grade_check
  check (grade in ('ז','ח','ט','י','יא','יב'));

commit;
