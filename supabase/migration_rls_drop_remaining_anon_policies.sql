-- Second (larger) batch of leftover fully-permissive anon policies, found
-- via a complete pg_policies sweep after the first 5-table fix — the
-- earlier row-count-based verification (curl with anon key, check if rows
-- come back) was unreliable for currently-empty tables: an empty table
-- returns 0 rows via anon regardless of whether it's actually protected,
-- so several tables with real anon_all_* policies were wrongly marked
-- "safe" simply because they had no data yet. This drops all 11 found.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

drop policy if exists "anon_all_dapar_submissions" on dapar_submissions;
drop policy if exists "anon_all_interview_results" on interview_results;
drop policy if exists "anon_all_psychotechnic_submissions" on psychotechnic_submissions;
drop policy if exists "anon_all_sentence_results" on sentence_results;
drop policy if exists "anon_all_simulation_interview_results" on simulation_interview_results;
drop policy if exists "anon_all_simulation_reading_answers" on simulation_reading_answers;
drop policy if exists "anon_all_simulation_sentence_results" on simulation_sentence_results;
drop policy if exists "anon_all_simulation_sessions" on simulation_sessions;
drop policy if exists "anon_all_student_answers" on student_answers;
drop policy if exists "anon_all_students" on students;
drop policy if exists "anon_all_submissions" on submissions;

-- Sanity check: should return 0 rows now (only admin_reads_own_row and
-- teacher_reads_own_row should remain anywhere in public schema).
select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename;
