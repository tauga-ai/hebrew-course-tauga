-- Per-topic availability toggle for the Naale admin panel (naale-topic-toggle).
-- A topic absent from this table is enabled by default — this only ever needs
-- a row for a topic an admin has actually touched, so shipping this needs no
-- backfill. Keyed by the same free-text topic name naale_questions/
-- naale_open_questions already use — there is no central topics table to
-- reference with a foreign key.
create table naale_topic_flags (
  topic text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table naale_topic_flags disable row level security;
