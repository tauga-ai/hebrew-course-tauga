-- Lesson-group scoping for teachers — a teacher on a class with
-- has_lesson_groups=true (e.g. "כיתה ערבית") can now be scoped to see only
-- one of the 3 student sub-groups instead of the whole class.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

ALTER TABLE class_teachers ADD COLUMN lesson_group SMALLINT CHECK (lesson_group IN (1, 2, 3));

-- NULL (the default for every existing row) means "sees the whole class" —
-- today's exact behavior, unchanged for every teacher unless a value is
-- explicitly set below.

-- To scope a teacher to one group, run e.g.:
--   update class_teachers set lesson_group = 2 where teacher_email = 'name@gmail.com' and class_id = 1;

-- Sanity check
SELECT teacher_email, class_id, lesson_group FROM class_teachers ORDER BY class_id, teacher_email;
