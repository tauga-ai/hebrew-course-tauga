export const DAPAR_SECTIONS = [
  { label: 'יחידה 1 כמותי', from: 1, to: 10 },
  { label: 'יחידה 2 כמותי', from: 11, to: 20 },
  { label: 'יחידה 1 אנלוגיות', from: 21, to: 30 },
  { label: 'יחידה 2 אנלוגיות', from: 31, to: 40 },
  { label: 'יחידה 1 צורנית', from: 41, to: 50 },
]

// Correct answers for questions 1–50
export const DAPAR_CORRECT_ANSWERS: number[] = [
  1, 2, 3, 2, 3, 3, 4, 1, 3, 4,  // יחידה 1 כמותי
  2, 1, 3, 2, 4, 1, 3, 1, 4, 4,  // יחידה 2 כמותי
  4, 3, 4, 4, 3, 3, 4, 3, 1, 3,  // יחידה 1 אנלוגיות
  1, 3, 2, 2, 2, 4, 2, 3, 3, 3,  // יחידה 2 אנלוגיות
  1, 2, 4, 4, 1, 3, 2, 3, 1, 4,  // יחידה 1 צורנית
]

export const DAPAR_TOTAL = 50

export interface DaparQuestionResult {
  q: number
  correct: number
  selected: number
  isCorrect: boolean
}

export interface DaparSectionResult {
  label: string
  correct: number
  pct: number
}

export interface DaparGradeResult {
  totalCorrect: number
  pct: number
  perQuestion: DaparQuestionResult[]
  perSection: DaparSectionResult[]
}

/**
 * Grades one DAPAR submission (answers 1-4, or 0 for unanswered) against the fixed
 * answer key, with a per-question and a per-section breakdown. Pure function — safe
 * to call from both client components and API routes.
 */
export function gradeDaparAnswers(answers: number[]): DaparGradeResult {
  const perQuestion = DAPAR_CORRECT_ANSWERS.map((correct, i) => ({
    q: i + 1,
    correct,
    selected: answers[i] ?? 0,
    isCorrect: answers[i] === correct,
  }))
  const totalCorrect = perQuestion.filter(q => q.isCorrect).length

  const perSection = DAPAR_SECTIONS.map(section => {
    const correct = perQuestion.slice(section.from - 1, section.to).filter(q => q.isCorrect).length
    return { label: section.label, correct, pct: Math.round((correct / 10) * 100) }
  })

  return {
    totalCorrect,
    pct: Math.round((totalCorrect / DAPAR_TOTAL) * 100),
    perQuestion,
    perSection,
  }
}
