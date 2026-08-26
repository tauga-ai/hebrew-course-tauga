export type SessionKind = 'practice' | 'placement'

/**
 * Which sitting the next session will be, derived from the caller's own topic
 * stats rather than fetched.
 *
 * /api/naale/session/start chooses `placement` when the student has no
 * naale_topic_levels rows, and /api/naale/my-stats reports every topic with
 * `level: null` in exactly that case — so this needs no endpoint of its own.
 *
 * Shared by the student home and the staff self-practice button so the two
 * cannot disagree about which wording the pre-session sheet shows. Returns
 * 'practice' for null/empty topics: stats not loaded yet is not evidence of a
 * never-placed student, and the two differ only in one line of copy.
 */
export function nextSessionKind(topics: { level: number | null }[] | null | undefined): SessionKind {
  if (!topics || topics.length === 0) return 'practice'
  return topics.every(topic => topic.level === null) ? 'placement' : 'practice'
}
