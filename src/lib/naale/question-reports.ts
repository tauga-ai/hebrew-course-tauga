/**
 * Shared limits for "report a mistake in this question" (N4). Deliberately
 * NOT server-only: the modal shows its counter against the same
 * REPORT_NOTE_MAX_LENGTH the route enforces, and two copies of that number
 * would drift. The actual notification lives in question-reports-notify.ts,
 * which IS server-only.
 */

/**
 * How many reports one student may file per window. Generous — a student
 * working through a bad batch of questions has a legitimate reason to file
 * several in a row — but bounded, because this is an open text field pointed
 * at three people's inboxes.
 */
export const REPORT_RATE_LIMIT = 10
export const REPORT_RATE_WINDOW_MINUTES = 60

/** Longer than anyone needs to say "the third option is misspelled", short
 *  enough that a paste-bomb can't be stored. The modal caps input at this and
 *  the route re-checks it — the modal's cap is a courtesy, not the boundary. */
export const REPORT_NOTE_MAX_LENGTH = 1000

/** Env var naming who should be told about a new report. Comma-separated. */
export const REPORT_NOTIFY_ENV = 'NAALE_REPORT_NOTIFY_EMAILS'
