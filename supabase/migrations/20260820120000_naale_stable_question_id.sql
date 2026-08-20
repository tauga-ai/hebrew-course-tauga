-- Stable question identity (audit finding H3; spec §2/§6).
--
-- Until now a question's identity WAS its text: both banks were keyed
-- `unique (topic, prompt)`. Editing a prompt therefore did not update the row —
-- the importer's upsert found no match and INSERTED a new one, leaving the old
-- row stranded in the bank with answers still referencing it. That already
-- happened once: naale_questions held 1001 rows against the workbook's 1000,
-- the extra one sitting in `השלמת משפטים` (sentence completion).
--
-- question_id is the workbook's own identifier, "<TopicNumber>_<QuestionNumber>"
-- (e.g. `9_13` = sheet 9, row #13). It is stable across text edits, and it is
-- the id a student's error report can carry back to the content owner.

alter table naale_questions      add column question_id text;
alter table naale_open_questions add column question_id text;

-- Both banks are cleared and re-imported from the workbook as part of this
-- change, so question_id can be asserted NOT NULL immediately instead of being
-- backfilled by matching on the very text this migration stops trusting.
--
-- Deletes are scoped strictly to naale_* tables. Verified read-only on
-- 2026-08-20 before writing this: every student_id in naale_answers /
-- naale_open_answers / naale_topic_levels / naale_sessions belongs to class 4
-- (track 'naale'), all of them test accounts; the two draft_prep classes
-- (`כיתה ערבית`, `כיתה רוסית`) have no rows in any naale_* table. No answer
-- row referenced a question missing from its bank, so nothing is orphaned by
-- the order below.
delete from naale_answers;
delete from naale_open_answers;
delete from naale_topic_levels;
delete from naale_sessions;
delete from naale_questions;
delete from naale_open_questions;

alter table naale_questions      alter column question_id set not null;
alter table naale_open_questions alter column question_id set not null;

-- Drop the old text-based key by shape rather than by name, so this doesn't
-- depend on Postgres' auto-generated constraint name matching what we assume.
do $$
declare c record;
begin
  for c in
    select con.conname, con.conrelid::regclass as tbl
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname in ('naale_questions', 'naale_open_questions')
      and con.contype = 'u'
      and (
        -- ::text because attname is Postgres' `name` type, which has no
        -- equality operator against text[].
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['prompt', 'topic']
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table naale_questions
  add constraint naale_questions_topic_question_id_key unique (topic, question_id);
alter table naale_open_questions
  add constraint naale_open_questions_topic_question_id_key unique (topic, question_id);
