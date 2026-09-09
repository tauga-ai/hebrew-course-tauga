-- Tracks whether a password was issued/reset for this account through our own
-- admin flow (issuePassword()), since Supabase Auth doesn't add 'email' to
-- app_metadata.providers when a password is set via updateUserById() on an
-- OAuth-created user — a confirmed upstream bug (github.com/supabase/auth#2085)
-- that makes hasPasswordIdentity() alone under-detect these accounts
-- (naale-password-profile-detection).
alter table naale_roster
  add column password_issued_by_admin boolean not null default false;
 