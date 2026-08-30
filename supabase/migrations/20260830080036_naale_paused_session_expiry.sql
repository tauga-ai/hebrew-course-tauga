-- Expires banked pause time after 3 hours (naale-paused-session-expiry). Noam,
-- asked what should happen to a student who closes the browser and returns
-- much later rather than being genuinely interrupted: keep it tight, given
-- this is already a 5-minute session — 3 hours.
--
-- Additive and nullable, same shape as paused_remaining_ms itself
-- (20260827105737_naale_topic_session_pause.sql): no backfill, no default, no
-- constraint, no index. NULL means "not paused" or "paused before this
-- column existed" — the latter simply never expires under the new rule until
-- paused again, which is fine: there is no long-lived paused session sitting
-- around today for this to silently mishandle.

alter table naale_sessions add column paused_at timestamptz;

comment on column naale_sessions.paused_at is
  'When this session was paused (naale_sessions.paused_remaining_ms was last set); NULL while running. Paired with paused_remaining_ms, not a replacement for it — see that column''s comment for why the remainder is stored separately from this timestamp.';
