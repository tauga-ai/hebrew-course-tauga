-- New track: Naale (Hebrew-only practice for 7th-8th grade students who
-- immigrated from Russia, living at a Naale boarding school). This is a third
-- student population inside the same app, alongside the existing Druze/Arabic
-- and adult-Russian draft-prep tracks — same database, but no shared data,
-- content, or cross-visibility.
--
-- classes.track is the isolation boundary. It defaults to 'draft_prep', so
-- every existing class row keeps working unchanged and nothing in src/ that
-- reads classes today is affected (nothing selects `track` yet). The single
-- new class row below is the only 'naale' row. Existing teachers already
-- cannot see Naale students, because visibility is derived from class_teachers
-- rows and none will exist for this class — `track` makes the reverse
-- direction (Naale staff must not see other populations) explicit and
-- checkable instead of incidental.
--
-- The student "ID card" from the spec is deliberately NOT a jsonb blob:
-- naale_topic_levels holds one mutable row per (student, topic) and
-- naale_answers is an append-only attempt log, mirroring the shape
-- migration_makbatzim.sql / migration_tzav_rishon.sql chose over the
-- per-set JSONB of the since-dropped psychotechnic_submissions. The JSON the
-- spec describes is assembled at read time by /api/naale/my-stats.
--
-- naale_questions.answer_kind + nullable options exist because the source
-- Excel's correct-answer format (multiple-choice vs. free text, possibly
-- differing per sheet) is still undecided — this absorbs either without a
-- second migration.
--
-- Gamification columns (XP/coins/streak) are deliberately omitted: whether
-- they're in the first build is still an open product question, so they'll
-- land as a separate additive migration rather than be guessed at here.
--
-- Additive only: one new defaulted column on an existing table, five new
-- tables. Rollback is `drop table` on the five plus
-- `alter table classes drop column track`.

alter table classes add column if not exists track text not null default 'draft_prep';
alter table classes add constraint classes_track_check check (track in ('draft_prep', 'naale'));

-- The single Naale class. Students are auto-attached to it on first login
-- (see getNaaleSession in src/lib/naale/auth.ts) — there is no join_code flow
-- and no manual class picker on this track, so the code is a stable internal
-- handle, not something a student ever types.
insert into classes (name, join_code, track)
values ('נעלה', 'naale', 'naale')
on conflict (join_code) do nothing;

-- Who is allowed in, and as what. Provisioned from the school's CSV — there is
-- no open self-registration on this track. Counselors and teachers share one
-- 'staff' role with identical permissions (per the spec's resolved decision).
create table naale_roster (
  email varchar(255) primary key,
  role text not null check (role in ('student', 'staff')),
  created_at timestamptz not null default now()
);

-- The question bank, imported from the 7-sheet Excel by
-- scripts/import-naale-questions.ts. Unlike makbatzim/tzav-rishon (static JSON
-- bundled at build time), this must be a table: the session engine queries it
-- per answer by (topic, difficulty, not-yet-seen-by-this-student), which a
-- build-time static import cannot serve.
create table naale_questions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  prompt text not null,
  answer_kind text not null check (answer_kind in ('mcq', 'text')),
  options jsonb,
  correct_answer text not null,
  source_row integer,
  created_at timestamptz not null default now(),
  -- Lets the importer upsert a corrected Excel without duplicating rows or
  -- orphaning naale_answers rows that already reference a question.
  unique (topic, prompt)
);

-- One mutable row per (student, topic): the student's current level plus the
-- streak counters the leveling rule needs. Streaks are per-topic by design —
-- answers on other topics in between must not affect this topic's streak.
create table naale_topic_levels (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  topic text not null,
  level smallint not null check (level between 1 and 5),
  correct_streak smallint not null default 0,
  wrong_streak smallint not null default 0,
  answered_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (student_id, topic)
);

-- One row per 30-minute sitting. deadline_at is computed server-side at start
-- so a page reload cannot extend the session, and `completed` encodes the
-- spec's rule: reached the timer AND answered at least 3 questions.
create table naale_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind text not null check (kind in ('placement', 'practice')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  ended_at timestamptz,
  answered_count integer not null default 0,
  completed boolean not null default false
);

-- Append-only attempt log. level_at_answer is captured per row so a student's
-- history stays interpretable after their level moves.
create table naale_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references naale_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  question_id uuid not null references naale_questions(id),
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  level_at_answer smallint not null check (level_at_answer between 1 and 5),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

-- "Unseen question in this topic at this difficulty" is the hot path of the
-- session engine, run once per answer.
create index naale_questions_topic_difficulty_idx on naale_questions (topic, difficulty);
create index naale_answers_student_question_idx on naale_answers (student_id, question_id);
create index naale_answers_student_answered_idx on naale_answers (student_id, answered_at);

-- Defense-in-depth: RLS on with NO policies. All app access is through the
-- service-role client, which bypasses RLS; this denies anon/authenticated.
-- (Older migrations say `disable` — that is the pre-lockdown era, see
-- migration_fix_ai_rate_limits_rls.sql for why that was a mistake.)
alter table naale_roster enable row level security;
alter table naale_questions enable row level security;
alter table naale_topic_levels enable row level security;
alter table naale_sessions enable row level security;
alter table naale_answers enable row level security;
