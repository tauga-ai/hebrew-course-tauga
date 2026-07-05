-- Lesson groups — some classes (currently only the Arabic-speaking one)
-- split into physical sub-groups (1/2/3) that a student picks live, at the
-- start of a lesson, per the teacher's instruction in the room. Sticky:
-- stays set until the student changes it themselves.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

alter table classes add column if not exists has_lesson_groups boolean not null default false;
update classes set has_lesson_groups = true where join_code = 'ערבית';

alter table students add column if not exists lesson_group smallint check (lesson_group in (1, 2, 3));

-- Sanity check
select id, name, join_code, has_lesson_groups from classes order by id;
