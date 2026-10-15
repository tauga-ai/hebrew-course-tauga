-- Naale / Tzabarim group for 10th-11th grade students (naale-cohort-grade-buttons).
-- Additive only: nullable, no backfill here (run the one-off backfill script for
-- the 2026-10-15 import). Synced from naale_roster to naale_students at login,
-- same as `grade`.
alter table naale_roster   add column cohort text check (cohort is null or cohort in ('naale', 'tzabarim'));
alter table naale_students add column cohort text check (cohort is null or cohort in ('naale', 'tzabarim'));
