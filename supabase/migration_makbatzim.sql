-- Results for the new practice section (placeholder label "שאלות שעדי שלחה"),
-- 6 sets converted from the source Excel workbook. One row per question
-- attempt, not one row per full-set submission -- mirrors tzav_rishon_results'
-- shape (immediate per-question feedback), not psychotechnic_submissions'
-- per-set JSONB shape. Same row shape regardless of source Content Type
-- (mcq/image/geometry) -- grading never depends on content type.
-- Run this ONCE in the Supabase Dashboard -> SQL Editor.

create table makbatzim_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id integer references classes(id),
  set_id text not null,
  question_id integer not null,
  selected_option integer not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (student_id, set_id, question_id)
);

alter table makbatzim_results disable row level security;
