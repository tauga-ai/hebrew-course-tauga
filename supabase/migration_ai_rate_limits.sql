-- Rate limiting for AI-backed student endpoints (Gemini + Google TTS).
-- None of the 5 AI routes (sentence/feedback, interview/feedback,
-- ai-practice/reading, ai-practice/sentence-words, tts) had any throttling
-- after auth — two of them don't even require prior input, so a student
-- script/loop could fire dozens of AI calls per minute against the single
-- shared GEMINI_API_KEY, risking quota exhaustion for the whole school.
--
-- One row per AI call attempt, counted globally per student across all 5
-- endpoints (not per-endpoint) so a student can't just switch endpoints to
-- dodge the limit. RLS disabled — accessed only via the service-role client,
-- same as every other results/log table in this app.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.

create table ai_rate_limits (
  id bigserial primary key,
  student_id uuid not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index ai_rate_limits_student_created_idx on ai_rate_limits (student_id, created_at);

alter table ai_rate_limits disable row level security;
