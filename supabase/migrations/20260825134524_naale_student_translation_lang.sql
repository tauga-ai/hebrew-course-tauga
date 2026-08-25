-- Per-student translation language preference for the hold-to-translate feature.
-- 'ru' (Russian) is the default — existing students keep current behaviour.
-- 'ar' (Arabic) is the alternative for Arabic-speaking students.
ALTER TABLE students
  ADD COLUMN translation_lang text NOT NULL DEFAULT 'ru'
    CHECK (translation_lang IN ('ru', 'ar'));
