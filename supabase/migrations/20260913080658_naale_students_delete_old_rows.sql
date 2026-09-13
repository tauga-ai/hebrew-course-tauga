-- naale-students-full-split Phase 5: the actual separation completing. Every row being
-- deleted here already has a matching naale_students row (verified before writing this
-- migration: 16/16, zero orphans), and no other table's FK to students(id) has ever been
-- populated for a Naale account (interview_practice_answers/ai_reading_results/
-- ai_sentence_results/sentence_results/simulation_sessions/submissions/makbatzim &
-- tzav-rishon results are all draft-prep-only — confirmed via a schema dump before Phase 1) —
-- so this cascades into deleting nothing else.
delete from students
where class_id = (select id from classes where track = 'naale');
