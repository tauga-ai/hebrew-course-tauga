-- Removes the standalone "/psychotechnic" feature — orphaned since
-- 2026-07-10 (its student-facing link was removed from menu/sidebar, and
-- its API routes have zero callers since). Distinct from "מקבצים פסיכוטכני"
-- (= /makbatzim), an unrelated feature that keeps its own name. Confirmed
-- empty (0 rows, via Content-Range: */0) before writing this migration, so
-- no backup was taken — matches how the old /dapar feature was retired.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

drop table if exists psychotechnic_submissions;

-- Sanity check: should return 0 rows.
select relname from pg_class where relname = 'psychotechnic_submissions';
