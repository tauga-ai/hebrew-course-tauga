-- Global cache: each Hebrew word's Russian translation, looked up once and
-- reused by every student/session afterward, instead of asking Google
-- Translate for the same common word repeatedly. Modeled on
-- naale_questions' surrogate-PK + unique-natural-key shape
-- (supabase/migrations/20260811082352_naale_track.sql:61-74).
create table naale_word_translations (
  id uuid primary key default gen_random_uuid(),
  source_word text not null,
  target_lang text not null default 'ru',
  translation text not null,
  created_at timestamptz not null default now(),
  unique (source_word, target_lang)
);

-- Defense-in-depth, same as every other Naale table: RLS on with no
-- policies, service-role-only access, enabled from this table's very first
-- migration. See migration_fix_ai_rate_limits_rls.sql for why a table ever
-- shipping without this was a real, previously-exploited mistake here.
alter table naale_word_translations enable row level security;
