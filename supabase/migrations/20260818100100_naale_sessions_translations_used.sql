-- Per-session counter for the click-to-translate safety net (30/session).
-- Additive, defaulted, safe on a live table — same shape as
-- naale_answers_is_review.sql's is_review column.
alter table naale_sessions add column if not exists translations_used integer not null default 0;
