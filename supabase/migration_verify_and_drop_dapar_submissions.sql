-- Step 1 (read-only): check current RLS status on dapar_submissions before
-- touching anything. This table belongs to the old, fully-decommissioned
-- "/dapar" feature (distinct from makbatzim's "dapar-simulation" set) — the
-- RLS-enable migration for all 22 app tables did NOT include this one, and
-- a later migration dropped its permissive anon policy without RLS ever
-- being turned on, which achieves nothing on its own.
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'dapar_submissions';

select policyname, roles, cmd, qual
from pg_policies
where tablename = 'dapar_submissions';

-- Step 2: the table is confirmed empty (0 rows) and has zero remaining code
-- references anywhere in the app — the cleanest fix is to drop it outright
-- rather than just enabling RLS on a fully dead table.
drop table if exists dapar_submissions;

-- Step 3 (sanity check): should return 0 rows — table no longer exists.
select relname from pg_class where relname = 'dapar_submissions';
