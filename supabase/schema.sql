-- Classes
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  join_code TEXT UNIQUE NOT NULL, -- added by migration_student_auth_v2.sql
  -- teacher_email removed by migration_multiple_teachers_per_class.sql, see class_teachers below
  has_lesson_groups BOOLEAN NOT NULL DEFAULT FALSE, -- added by migration_lesson_group.sql
  track TEXT NOT NULL DEFAULT 'draft_prep' -- added by migrations/20260811082352_naale_track.sql
);

-- Class Teachers — a class can have multiple teachers
-- (added by migration_multiple_teachers_per_class.sql)
CREATE TABLE class_teachers (
  teacher_email VARCHAR(255) PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) NOT NULL
);

-- Admins — super admins who can view every class's teacher dashboards via a
-- class selector (added by migration_super_admin.sql)
CREATE TABLE admins (
  email VARCHAR(255) PRIMARY KEY
);

-- Practice Sets
CREATE TABLE practice_sets (
  id SERIAL PRIMARY KEY,
  set_number INTEGER NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty_level INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  practice_set_id INTEGER REFERENCES practice_sets(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_option_1 TEXT NOT NULL,
  answer_option_2 TEXT NOT NULL,
  answer_option_3 TEXT NOT NULL,
  answer_option_4 TEXT NOT NULL,
  correct_answer_number INTEGER NOT NULL CHECK (correct_answer_number IN (1,2,3,4)),
  question_order INTEGER NOT NULL
);

-- Students
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  class_id INTEGER REFERENCES classes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id), -- added by migration_student_auth_v2.sql; nullable (legacy rows), see plan for why
  lesson_group SMALLINT CHECK (lesson_group IN (1, 2, 3)) -- added by migration_lesson_group.sql
);

-- Submissions (unique per student + practice set)
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  practice_set_id INTEGER REFERENCES practice_sets(id),
  score_percentage DECIMAL(5,2),
  correct_count INTEGER,
  total_questions INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, practice_set_id)
);

-- Student Answers
CREATE TABLE student_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id),
  selected_answer_number INTEGER,
  is_correct BOOLEAN
);

-- Naale roster, question bank, per-topic levels, sessions, and answer log
-- (added by migrations/20260811082352_naale_track.sql)
CREATE TABLE naale_roster (
  email VARCHAR(255) PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE naale_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  prompt TEXT NOT NULL,
  answer_kind TEXT NOT NULL CHECK (answer_kind IN ('mcq', 'text')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  source_row INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic, prompt)
);

CREATE TABLE naale_topic_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  correct_streak SMALLINT NOT NULL DEFAULT 0,
  wrong_streak SMALLINT NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, topic)
);

CREATE TABLE naale_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('placement', 'practice')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  answered_count INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE naale_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES naale_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES naale_questions(id),
  topic TEXT NOT NULL,
  difficulty SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  level_at_answer SMALLINT NOT NULL CHECK (level_at_answer BETWEEN 1 AND 5),
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS (server uses service role key)
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers DISABLE ROW LEVEL SECURITY;
