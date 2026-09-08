-- Captures the school's roster name/phone (previously discarded on import —
-- naale-roster-name-phone). Nullable/additive: existing rows stay null until
-- re-imported from a file that includes them.
alter table naale_roster
  add column first_name text,
  add column last_name text,
  add column phone text;
