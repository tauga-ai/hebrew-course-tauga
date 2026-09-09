-- Records which audio file an MCQ (levels 1-2) Listening Comprehension
-- question uses (naale-listening-comprehension-content). Levels 3-5
-- questions' audio filename lives in naale_open_questions.fields instead,
-- same flexible storage every other open-text topic already uses for its
-- own topic-specific fields — no schema change needed there.
alter table naale_questions
  add column audio_file_name text;
