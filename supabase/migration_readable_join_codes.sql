-- Readable class join codes — replace opaque random codes with the
-- student-facing language name, since the two classes are language cohorts.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

update classes set name = 'כיתה ערבית', join_code = 'ערבית' where teacher_email = 'teacher1@gmail.com';
update classes set name = 'כיתה רוסית', join_code = 'רוסית' where teacher_email = 'teacher2@gmail.com';

-- Sanity check
select id, name, teacher_email, join_code from classes order by id;
