-- Removes the "dapar simulation" feature (/dapar) — decommissioned, no
-- longer relevant. Confirmed empty (0 rows) before writing this migration,
-- so no backup was taken.
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

drop table if exists dapar_submissions;
