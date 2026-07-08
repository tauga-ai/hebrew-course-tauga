import type { MakbatzimQuestion } from '@/data/makbatzim/types'

/**
 * Pure — takes no dependency on the data module itself (deliberately, so it
 * can be unit-tested without transitively importing the server-only-guarded
 * question data). Server always calls this itself on submit; never trusts a
 * client-supplied correctness flag.
 */
export function gradeAnswer(question: MakbatzimQuestion, selectedOption: number): boolean {
  return selectedOption === question.correctOption
}
