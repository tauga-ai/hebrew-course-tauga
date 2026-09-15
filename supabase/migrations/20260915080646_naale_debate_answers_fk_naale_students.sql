-- Fixes a real bug in 20260915072146_naale_debate_module.sql: that migration's
-- naale_debate_answers.student_id FK was written against `students(id)`,
-- copying the pre-split shape naale_open_answers used to have. It should have
-- targeted `naale_students(id)` instead, same as every other Naale-track
-- answers table was already repointed to by naale_students_full_split
-- (20260913072908_naale_students_table.sql) two days earlier — getNaaleSession()
-- resolves student.id from naale_students, not students, so every real insert
-- into naale_debate_answers violates the old constraint.
--
-- Safe with zero data rewriting: naale_debate_answers has 0 rows in production
-- (confirmed before writing this — the module hasn't been live-tested yet), so
-- this only retargets the constraint, nothing to reconcile.

alter table naale_debate_answers drop constraint naale_debate_answers_student_id_fkey,
  add constraint naale_debate_answers_student_id_fkey
    foreign key (student_id) references naale_students(id) on delete cascade;
