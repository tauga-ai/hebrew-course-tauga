-- Prevents two concurrent /session/answer requests for the same question
-- from both inserting successfully. The existing check-then-insert guard in
-- session/answer/route.ts (SELECT then INSERT) isn't atomic — two requests
-- close enough together can both pass the SELECT before either INSERT
-- commits. Confirmed live on 2026-08-13: two near-simultaneous submissions
-- for the same question both returned 200 and both inserted, inflating
-- naale_topic_levels.answered_count for one real answer.
--
-- This constraint is the actual backstop; the route's SELECT check remains
-- the fast common-case path for a real (non-concurrent) repeat answer.
alter table naale_answers
  add constraint naale_answers_session_question_unique
  unique (session_id, question_id);
