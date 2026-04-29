export interface PsychotechnicSet {
  id: number
  name: string
  answers: number[]  // index 0 = question 1's correct answer
}

// Correct answers from the answer key PDF
// answers[i] = correct answer for question (i+1)
export const PSYCHOTECHNIC_SETS: PsychotechnicSet[] = [
  {
    id: 1,
    name: 'מקבץ 1',
    answers: [2, 3, 4, 4, 4, 3, 4, 4, 1],           // 9 questions
  },
  {
    id: 2,
    name: 'מקבץ 2',
    answers: [1, 4, 4, 3, 4, 1, 2, 2, 3, 2],         // 10 questions
  },
  {
    id: 3,
    name: 'מקבץ 3',
    answers: [2, 3, 2, 4, 3, 3, 1, 3, 1, 2],         // 10 questions
  },
  {
    id: 4,
    name: 'מקבץ 4',
    answers: [4, 4, 1, 2, 4, 3, 2, 2, 4, 3],         // 10 questions
  },
  {
    id: 5,
    name: 'מקבץ 5',
    answers: [1, 2, 3, 2, 3, 3, 4, 1, 3, 4],         // 10 questions
  },
  {
    id: 6,
    name: 'מקבץ 6',
    answers: [2, 1, 3, 2, 4, 1, 3, 1, 4, 4],         // 10 questions
  },
  {
    id: 7,
    name: 'מקבץ 7',
    answers: [1, 4, 2, 3, 2, 2, 1, 1, 4, 3],         // 10 questions
  },
  {
    id: 8,
    name: 'אנלוגיות מילוליות — מקבץ 1',
    answers: [4, 3, 4, 4, 3, 3, 4, 3, 1, 3],         // 10 questions
  },
  {
    id: 9,
    name: 'אנלוגיות מילוליות — מקבץ 2',
    answers: [1, 3, 2, 2, 2, 4, 2, 3, 3, 3],         // 10 questions
  },
  {
    id: 10,
    name: 'אנלוגיות צורניות — מקבץ 1',
    answers: [1, 2, 4, 4, 1, 3, 2, 3, 1, 4],         // 10 questions
  },
]

export function getSetById(id: number): PsychotechnicSet | undefined {
  return PSYCHOTECHNIC_SETS.find(s => s.id === id)
}

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
