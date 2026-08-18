export interface Class {
  id: number
  name: string
}

export interface Student {
  id: string
  full_name: string
  class_id: number
  created_at: string
  lesson_group: number | null
  /** Naale track only — denormalized from naale_roster at provisioning time
   *  (see requireNaaleStaff()/getNaaleSession()). Null on the other two tracks. */
  naale_role?: 'student' | 'staff' | null
}

export interface PracticeSet {
  id: number
  set_number: number
  topic: string
  difficulty_level: number
  created_at: string
}

export interface Question {
  id: number
  practice_set_id: number
  question_text: string
  answer_option_1: string
  answer_option_2: string
  answer_option_3: string
  answer_option_4: string
  correct_answer_number: number
  question_order: number
}

export interface Submission {
  id: string
  student_id: string
  practice_set_id: number
  score_percentage: number
  correct_count: number
  total_questions: number
  submitted_at: string
}

export interface StudentAnswer {
  id: string
  submission_id: string
  question_id: number
  selected_answer_number: number
  is_correct: boolean
}

export interface StudentSession {
  id: string
  full_name: string
  class_id: number
  class_name: string
  has_lesson_groups: boolean
  lesson_group: number | null
}

export type NaaleRole = 'student' | 'staff'

export interface NaaleRosterEntry {
  email: string
  role: NaaleRole
  created_at: string
}

export interface NaaleQuestion {
  id: string
  topic: string
  difficulty: number
  prompt: string
  answer_kind: 'mcq' | 'text'
  options: string[] | null
  correct_answer: string
  source_row: number | null
  created_at: string
}

export interface NaaleTopicLevel {
  id: string
  student_id: string
  topic: string
  level: number
  correct_streak: number
  wrong_streak: number
  answered_count: number
  updated_at: string
}

export interface NaaleSession {
  id: string
  student_id: string
  kind: 'placement' | 'practice'
  started_at: string
  deadline_at: string
  ended_at: string | null
  answered_count: number
  completed: boolean
  translations_used: number
  translated_words: string[]
}

export interface NaaleAnswer {
  id: string
  session_id: string
  student_id: string
  question_id: string
  topic: string
  difficulty: number
  level_at_answer: number
  is_correct: boolean
  answered_at: string
}
