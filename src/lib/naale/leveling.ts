export const MIN_LEVEL = 1
export const MAX_LEVEL = 5
/** 2 correct in a row (no wrong in between) levels up. */
export const CORRECT_TO_LEVEL_UP = 2
/** 3 wrong in a row levels down. */
export const WRONG_TO_LEVEL_DOWN = 3
/** Placement: correct starts the topic at medium, incorrect at easy. */
export const PLACEMENT_PASS_LEVEL = 3
export const PLACEMENT_FAIL_LEVEL = 1

export interface TopicState {
  level: number
  correct_streak: number
  wrong_streak: number
}

/**
 * Applies one answer to one topic's state.
 *
 * The rule, from the spec: a wrong answer keeps the level but BREAKS any
 * correct streak in progress (so after a mistake the student needs 2 fresh
 * correct answers to level up); 3 wrong in a row levels down; a single correct
 * answer keeps the level; 2 correct in a row levels up.
 *
 * Callers must pass the state for the SAME topic as the answered question —
 * answers on other topics in between are invisible to this function, which is
 * exactly what makes the streak per-topic.
 */
export function applyAnswer(state: TopicState, isCorrect: boolean): TopicState {
  if (isCorrect) {
    const correct_streak = state.correct_streak + 1
    if (correct_streak >= CORRECT_TO_LEVEL_UP) {
      // Counters reset on a level change, so the next level-up needs a fresh 2.
      return { level: Math.min(state.level + 1, MAX_LEVEL), correct_streak: 0, wrong_streak: 0 }
    }
    return { level: state.level, correct_streak, wrong_streak: 0 }
  }

  const wrong_streak = state.wrong_streak + 1
  if (wrong_streak >= WRONG_TO_LEVEL_DOWN) {
    return { level: Math.max(state.level - 1, MIN_LEVEL), correct_streak: 0, wrong_streak: 0 }
  }
  // Level unchanged, but the correct streak is broken.
  return { level: state.level, correct_streak: 0, wrong_streak }
}

export function placementLevel(isCorrect: boolean): number {
  return isCorrect ? PLACEMENT_PASS_LEVEL : PLACEMENT_FAIL_LEVEL
}

/**
 * Random topic, never the same as the previous question's topic. Falls back to
 * the full list when there is only one topic (or none) to choose from, so a
 * thin question bank can't deadlock a session.
 */
export function pickNextTopic(topics: string[], prevTopic: string | null): string | null {
  if (topics.length === 0) return null
  const pool = topics.filter(topic => topic !== prevTopic)
  const from = pool.length > 0 ? pool : topics
  return from[Math.floor(Math.random() * from.length)]
}

/**
 * Difficulties to try, in order, when looking for an unseen question in a
 * topic: the student's current level first, then one level HARDER, then
 * progressively easier, then anything remaining above. Matches the spec's
 * fallback ("try the next level up first, then progressively easier levels")
 * while still exhausting the whole topic before declaring it finished.
 */
export function difficultyLadder(level: number): number[] {
  const ladder: number[] = [level]
  if (level + 1 <= MAX_LEVEL) ladder.push(level + 1)
  for (let d = level - 1; d >= MIN_LEVEL; d--) ladder.push(d)
  for (let d = level + 2; d <= MAX_LEVEL; d++) ladder.push(d)
  return ladder
}
