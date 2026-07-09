export interface PsychotechnicSet {
  id: number
  name: string
  answers: number[]  // index 0 = question 1's correct answer
}

/**
 * Pure — takes the set as a parameter, no dependency on where the data
 * comes from, so it's testable without going through the server-only
 * guard on psychotechnic.ts (mirrors tzav-rishon-grading.ts's split).
 */
export function gradeAnswers(set: PsychotechnicSet, studentAnswers: number[]): {
  results: { q: number; correct: number; student: number; isCorrect: boolean }[]
  score: number
  total: number
} {
  const results = set.answers.map((correct, i) => ({
    q: i + 1,
    correct,
    student: studentAnswers[i] || 0,
    isCorrect: studentAnswers[i] === correct,
  }))
  return {
    results,
    score: results.filter(r => r.isCorrect).length,
    total: set.answers.length,
  }
}
