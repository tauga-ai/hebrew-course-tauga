-- naale_admins was created with RLS disabled (20260817095845_naale_admins.sql),
-- on the mistaken assumption that this matched `admins`' convention. It
-- doesn't: `admins` has had RLS enabled with a self-read policy since
-- migration_enable_rls_all_tables.sql, applied 2026-08-11 (before this table
-- existed) — so naale_admins slipped through that lockdown and has been
-- readable/writable by the anon key via Supabase's auto REST API ever since.
--
-- No policy is needed here, unlike `admins`/`class_teachers`. Those two get a
-- narrow self-read policy because the Realtime Broadcast Authorization check
-- for teacher-monitoring subqueries them under the teacher's own
-- `authenticated` JWT, not service_role. naale_admins has no such path — every
-- read/write goes through requireNaaleAdmin() and
-- src/app/api/naale/admin/admins/route.ts, both exclusively via
-- createServiceClient(), which bypasses RLS regardless of whether it's
-- enabled. Enabling RLS with zero policies is enough to block anon/authenticated
-- direct access while leaving the app itself unaffected — same pattern as most
-- of the other 20 tables in migration_enable_rls_all_tables.sql.

alter table naale_admins enable row level security;

-- Sanity check: should show rowsecurity = true.
select relname, relrowsecurity from pg_class where relname = 'naale_admins';
