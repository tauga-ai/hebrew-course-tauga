-- Part 2 of 3 in the RLS lockdown chain (after
-- migration_enable_rls_all_tables.sql, before
-- migration_rls_drop_remaining_anon_policies.sql — that file plugs 11 more
-- tables this one didn't cover).
--
-- Root cause found: 5 tables had a pre-existing fully-permissive policy
-- (roles={anon}, cmd=ALL, qual=true) granting the anon key unconditional
-- read/write/delete access, unrelated to migration_enable_rls_all_tables.sql
-- (that migration correctly enabled RLS on them — these policies simply
-- override it by allowing everything anyway). Confirmed via pg_policies
-- that these are the only policies on these 5 tables, named
-- anon_all_classes / anon_all_practice_sets / anon_all_questions /
-- anon_all_simulation_questions / anon_all_simulation_sentence_exercises.
--
-- Safe to drop entirely: verified (by reading every .from() call site in
-- src/) that the app never queries these tables with the anon key — only
-- the service-role client, which always bypasses RLS regardless.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

drop policy if exists "anon_all_classes" on classes;
drop policy if exists "anon_all_practice_sets" on practice_sets;
drop policy if exists "anon_all_questions" on questions;
drop policy if exists "anon_all_simulation_questions" on simulation_questions;
drop policy if exists "anon_all_simulation_sentence_exercises" on simulation_sentence_exercises;

-- Sanity check: should return 0 rows.
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where tablename in ('classes', 'practice_sets', 'questions', 'simulation_questions', 'simulation_sentence_exercises');
