-- CRITICAL SECURITY FIX — ai_rate_limits was created with RLS disabled
-- (migration_ai_rate_limits.sql, comment "same as every other results/log
-- table in this app") BEFORE migration_enable_rls_all_tables.sql enabled
-- RLS across the app's other 21 tables — this one table was never included
-- in that later migration and was missed. Confirmed live and exploitable:
-- an anonymous request with only the public anon key can currently read
-- (and, since RLS is off, also insert/update/delete) every row —
-- student_id + endpoint + timestamp for every AI call any student has
-- ever made — with zero authentication. Flagged by Supabase's own security
-- advisor as "Table publicly accessible" / rls_disabled_in_public.
--
-- Beyond the data leak, a disabled-RLS table is also directly exploitable
-- against the rate limiter's own purpose: anyone could DELETE their own
-- rows to bypass the per-student AI call limit, defeating the protection
-- this table exists for (guarding the shared GEMINI_API_KEY from quota
-- exhaustion).
--
-- All application access already goes through createServiceClient()
-- (service-role, bypasses RLS) — enabling RLS with zero policies below
-- has no effect on the app itself, it only blocks direct anon/authenticated
-- access. Matches the exact pattern already used for every other table.
--
-- Run this ONCE, immediately, in the Supabase Dashboard → SQL Editor.

alter table ai_rate_limits enable row level security;

-- Sanity check — should show rowsecurity = true
select relrowsecurity from pg_class where oid = 'ai_rate_limits'::regclass;
