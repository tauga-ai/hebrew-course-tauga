import type { NaaleTopicLevel } from '@/lib/types'

export interface NaaleTopicStat {
  topic: string
  /** null when the student has no level row yet — i.e. not placed / not started. */
  level: number | null
  answered: number
  correct: number
  /** null when nothing has been attempted, so the UI can render "—" rather
   *  than a 0% that reads as failure. Mirrors computeStats() in quiz-progress.ts. */
  accuracy_pct: number | null
  started: boolean
}

/**
 * Shapes a student's raw rows into the per-topic view the stats screens show —
 * the spec's "ID card", assembled at read time rather than stored as a blob
 * (see migration_naale_track.sql for why).
 *
 * `allTopics` comes from the question bank, not from the student's rows, so a
 * topic the student has never touched still appears (marked not-started)
 * instead of silently vanishing from their progress view.
 *
 * Pure, so the staff view can reuse it per-student and so it's testable.
 */
export function buildTopicStats(
  allTopics: string[],
  levels: Pick<NaaleTopicLevel, 'topic' | 'level'>[],
  answers: { topic: string; is_correct: boolean }[]
): NaaleTopicStat[] {
  const levelByTopic = new Map(levels.map(l => [l.topic, l.level]))

  const counts = new Map<string, { answered: number; correct: number }>()
  for (const a of answers) {
    const c = counts.get(a.topic) ?? { answered: 0, correct: 0 }
    c.answered += 1
    if (a.is_correct) c.correct += 1
    counts.set(a.topic, c)
  }

  return allTopics.map(topic => {
    const c = counts.get(topic) ?? { answered: 0, correct: 0 }
    return {
      topic,
      level: levelByTopic.get(topic) ?? null,
      answered: c.answered,
      correct: c.correct,
      accuracy_pct: c.answered > 0 ? (c.correct / c.answered) * 100 : null,
      started: levelByTopic.has(topic) || c.answered > 0,
    }
  })
}
