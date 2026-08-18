-- Tracks which words have already been translated in this session, so
-- re-holding the same word again doesn't cost a second slot against the
-- 30/session cap — only genuinely new words should count. Additive,
-- defaulted, safe on a live table, same shape as this table's other
-- additions.
alter table naale_sessions add column if not exists translated_words text[] not null default '{}';
