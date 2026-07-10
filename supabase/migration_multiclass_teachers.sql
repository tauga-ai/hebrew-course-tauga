-- Multi-class teachers — a teacher used to own exactly one class
-- (teacher_email was the sole PRIMARY KEY); now a teacher can own several
-- classes, switching between them via the same class selector admins use.
-- Run this ONCE in the Supabase Dashboard → SQL Editor, AFTER
-- migration_teacher_lesson_group.sql.
--
-- Confirmed before writing this: the current PK is the default-named
-- class_teachers_pkey (inline `teacher_email VARCHAR(255) PRIMARY KEY` in
-- schema.sql), and no other table has a foreign key pointing at
-- class_teachers — safe, isolated change.

ALTER TABLE class_teachers DROP CONSTRAINT class_teachers_pkey;
ALTER TABLE class_teachers ADD PRIMARY KEY (teacher_email, class_id);

-- To add a second class to an existing teacher, run e.g.:
--   insert into class_teachers (teacher_email, class_id) values ('name@gmail.com', 2);

-- Sanity check — confirms the constraint now allows multiple rows per email
SELECT teacher_email, array_agg(class_id ORDER BY class_id) AS class_ids
FROM class_teachers
GROUP BY teacher_email
ORDER BY teacher_email;
