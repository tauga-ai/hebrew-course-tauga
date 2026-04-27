export interface Class {
  id: number
  name: string
  teacher_email: string
}

export interface Student {
  id: string
  full_name: string
  class_id: number
  created_at: string
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
}
