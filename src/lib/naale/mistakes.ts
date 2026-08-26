import { GRADED_CORRECT_SCORE } from './stats'

/** Most recent mistakes returned at once. Truncation is reported, never silent. */
export const MAX_MISTAKES = 200

export interface MistakeAttempt {
  question_id: string
  session_id: string
  topic: string
  answered_at: string
  kind: 'mcq' | 'open'
  was_correct: boolean
  /** MCQ: the option they picked. Open: their written answer. Empty on a
   *  pre-migration MCQ row, which can clear a mistake but can't be shown as one. */
  answer_text: string
  /** Open only — the grader's response, which stands in for a correct answer. */
  feedback?: string
  is_review: boolean
}

export interface Mistake extends MistakeAttempt {
  /** How many times this question has been answered wrong. */
  attempt_count: number
}

/**
 * One entry per question the student is still getting wrong.
 *
 * The latest attempt decides. Wrong → it stays, carrying how many wrong
 * attempts there have been. Right → the student has fixed it and it does not
 * appear at all.
 *
 * This is why nothing needs a `resolved` column: correctness is already
 * recorded per attempt, so "still wrong" is derivable rather than stored. That
 * matters three ways — no migration, no extra write on the answer route (the
 * hottest path in the app), and it applies to rows written long before this
 * feature existed. Deleting or mutating the original wrong row was never an
 * option: buildStudentProgress() derives every accuracy figure and topic level
 * from those rows, and getSessionReviewQueue() reads them to decide what to
 * re-serve, so removing one would quietly raise a student's accuracy and
 * change their level.
 *
 * Grouping by question also collapses review re-attempts, which otherwise list
 * the same question once per time it was served.
 */
export function collapseToMistakes(attempts: MistakeAttempt[]): Mistake[] {
  const byQuestion = new Map<string, MistakeAttempt[]>()
  for (const a of attempts) {
    const group = byQuestion.get(a.question_id) ?? []
    group.push(a)
    byQuestion.set(a.question_id, group)
  }

  const out: Mistake[] = []
  for (const group of byQuestion.values()) {
    const ordered = [...group].sort((a, b) => (a.answered_at < b.answered_at ? -1 : 1))
    const latest = ordered[ordered.length - 1]
    if (latest.was_correct) continue
    out.push({ ...latest, attempt_count: ordered.filter(a => !a.was_correct).length })
  }

  // Newest first, so the most recent thing a student got wrong is the first
  // thing they see.
  return out.sort((a, b) => (a.answered_at < b.answered_at ? 1 : -1))
}

/** A graded answer counts as wrong below the same threshold buildStudentProgress()
 *  uses, so a score the app called a pass can never appear as a mistake. */
export function isOpenAnswerWrong(score: number): boolean {
  return score < GRADED_CORRECT_SCORE
}

/**
 * The one line to show for a question in a collapsed row.
 *
 * Prompts are multi-line by convention: sentence-correction opens with
 * "תקן את המשפט הבא:" and puts the sentence on the next line, and reading
 * comprehension puts a paragraph first and the actual question last. In both
 * shapes the LAST non-empty line is the part a student needs to recognise the
 * question, so a naive first-line truncation shows them the instruction and
 * hides the content.
 */
export function promptSummary(prompt: string): string {
  const lines = prompt.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length ? lines[lines.length - 1] : prompt.trim()
}

export interface AnswerDiff {
  was: string
  is: string
  /** True when common wording was trimmed away from both ends. */
  narrowed: boolean
}

/**
 * The part of a wrong answer that actually differs from the right one.
 *
 * Sentence-correction answers are near-identical strings — "השיר הזה יותר יפה
 * כמו השיר..." against "...מהשיר..." differs by a single word. Rendering both
 * in full asks the student to spot the difference themselves, which is the one
 * job the screen exists to do for them. So common words are trimmed off both
 * ends and only the differing span is shown.
 *
 * Falls back to the full strings when there is no shared wording (a
 * multiple-choice option and the correct option are often unrelated phrases) —
 * a "diff" of two unrelated answers is just both answers.
 */
export function diffAnswers(mine: string, correct: string): AnswerDiff {
  const a = mine.trim().split(/\s+/)
  const b = correct.trim().split(/\s+/)

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++

  let end = 0
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) end++

  const wasMid = a.slice(start, a.length - end)
  const isMid = b.slice(start, b.length - end)

  // Nothing shared, or one side reduced to nothing (a pure insertion/deletion
  // reads as a missing word rather than a change): show both in full.
  if ((start === 0 && end === 0) || !wasMid.length || !isMid.length) {
    return { was: mine.trim(), is: correct.trim(), narrowed: false }
  }

  return { was: wasMid.join(' '), is: isMid.join(' '), narrowed: true }
}
