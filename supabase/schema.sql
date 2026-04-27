-- Classes
CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  teacher_email VARCHAR(255) NOT NULL
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
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Disable RLS (server uses service role key)
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sets DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers DISABLE ROW LEVEL SECURITY;
