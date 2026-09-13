-- naale-students-full-split Phase 4: naale_users is fully folded into naale_students now —
-- safe to drop. students.naale_role/translation_lang have had zero readers or writers since
-- Phase 2 of this ticket (and since the parked naale-students-own-table ticket before it).
drop table if exists naale_users;
alter table students drop constraint if exists students_naale_role_check;
alter table students drop column if exists naale_role;
alter table students drop column if exists translation_lang;
