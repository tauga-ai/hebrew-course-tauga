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

/** A Naale student/staff account — lives in its own naale_students table, entirely
 *  independent of the shared, cross-track `students` table (naale-students-full-split).
 *  No `class_id`/`lesson_group`: a row existing in naale_students at all already means
 *  "this is a Naale account," so the cross-track scoping those two fields exist for on
 *  `Student` has no equivalent need here. */
export interface NaaleStudentProfile {
  id: string
  full_name: string
  role: NaaleRole
  translation_lang: 'ru' | 'ar'
  created_at: string
  updated_at: string
}

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
  kind: 'placement' | 'practice' | 'topic'
  /** Set only when kind === 'topic' — the single topic this session is scoped to. */
  topic: string | null
  /** The question_id session/next most recently served, used to authorize one
   *  late answer past the deadline and to authorize a recycled re-answer
   *  (naale-topic-based-sessions). Unused for 'placement'/'practice'. */
  pending_question_id: string | null
  started_at: string
  /** When this session ends. CAUTION: on a PAUSED session this is stale and
   *  sits in the past by construction — pausing banks the remainder and resume
   *  sets deadline_at = now + remainder (naale-topic-session-resume). Check
   *  paused_remaining_ms before trusting this, or use remainingMs(), which
   *  handles both. */
  deadline_at: string
  /** Milliseconds left when a 5-minute topic session was paused; null while
   *  running. 0 is legitimate (paused with no time left), so test for null
   *  explicitly rather than truthiness — isPaused() does. */
  paused_remaining_ms: number | null
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
