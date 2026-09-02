/**
 * Per-topic "how to show this question" registry for the AI-graded
 * (kind: 'open') exercises — deliberately separate from open-grading.ts
 * (which is 'server-only' and can't be imported into a client component).
 */
export interface OpenExerciseDisplay {
  wordLimit: number
  /** Ordered content blocks shown above the answer box. */
  blocks: (prompt: string, fields: Record<string, string>) => { label: string; text: string }[]
  /** A single field shown as a highlighted "must use this" chip, if this topic has one. */
  highlightField?: (fields: Record<string, string>) => { label: string; text: string } | null
  /** Shown client-side, without a network call, when the student submits nothing. */
  emptyErrorMessage: string
  /**
   * Dev-only QA aid — lets someone testing the app without reading Hebrew
   * fill in a plausible answer instead of composing one. Gated the same way
   * as the existing MCQ answer hint (debugMode && showHint, see
   * dev-hint.ts) — never shown to a real student, and no separate security
   * concern the way the MCQ hint has: these templates only ever use fields
   * already public to every student (the same ones shown as blocks/
   * highlightField above), nothing grading-only.
   */
  devSampleAnswers?: {
    /** Should reliably score 4-5: uses the required field correctly, reads
     *  as a plausible (if generic) continuation, grammatically sound. */
    good: (fields: Record<string, string>) => string
    /** Should reliably score 1-2: unrelated to the prompt, ignores the
     *  required field entirely — lets QA confirm a low score actually
     *  levels the topic down. */
    weak: (fields: Record<string, string>) => string
  }
}

/**
 * Story Continuation's 40 distinct `mandatory_word` connectors split into the
 * grammatical families a single fixed clause can't all serve — a plain past
 * declarative reads fine after a simple adverb but is a tense mismatch after
 * a future-time word and doesn't fit the mood after a conditional. Found and
 * verified empirically 2026-08-23 (item 14/L1); an unrecognized future
 * connector falls back to 'simple' as the safest default.
 */
type ConnectorCategory = 'simple' | 'contrastive' | 'causal' | 'subordinate' | 'future' | 'conditional'

const CONNECTOR_CATEGORY: Record<string, ConnectorCategory> = {
  'לפתע': 'simple', 'פתאום': 'simple', 'לכן': 'simple', 'בעקבות זאת': 'simple',
  'כתוצאה מכך': 'simple', 'אז': 'simple', 'לבסוף': 'simple', 'אחר כך': 'simple',
  'בינתיים': 'simple', 'כמו כן': 'simple', 'למרבה המזל': 'simple', 'לרוע המזל': 'simple',
  'וגם': 'simple', 'מיד לאחר מכן': 'simple',
  'אבל': 'contrastive', 'אך': 'contrastive', 'למרות': 'contrastive', 'למרות זאת': 'contrastive',
  'על אף ש': 'contrastive', 'אף על פי כן': 'contrastive', 'לעומת זאת': 'contrastive', 'בניגוד לכך': 'contrastive',
  'כי': 'causal', 'בזכות': 'causal',
  'אחרי ש': 'subordinate', 'לפני ש': 'subordinate', 'עד ש': 'subordinate', 'כדי ש': 'subordinate',
  'עד כדי כך ש': 'subordinate', 'בגלל ש': 'subordinate', 'כדי ל': 'subordinate',
  'מחר': 'future', 'בשנה הבאה': 'future', 'בקיץ הבא': 'future', 'בשבוע הבא': 'future',
  'בחודש הבא': 'future', 'בעתיד': 'future',
  'אילו': 'conditional', 'לו': 'conditional', 'אילולא': 'conditional', 'כאילו': 'conditional',
}

// Generic on purpose, same trick the original 'simple' clause already relied
// on: no character names and no story-specific facts, just a vague pivot any
// opening can plausibly lead to. The first attempt at these (contrastive/
// causal/subordinate/conditional) named a fixed character ("דן") and got
// docked for referencing the wrong protagonist on every real story — fixed
// by staying as pronoun-only as the original.
const CONTINUATION_CLAUSE: Record<ConnectorCategory, string> = {
  simple: 'הכול השתנה לגמרי, והם הבינו שזה רק ההתחלה.',
  contrastive: 'בסוף הכול הסתדר בצורה שאף אחד לא ציפה לה.',
  causal: 'כולם התאחדו כדי לעזור אחד לשני.',
  subordinate: 'המצב השתנה לגמרי, וכולם ידעו מה עליהם לעשות.',
  future: 'הכול ישתנה, וכולם ידעו את האמת.',
  conditional: 'הכול היה משתנה, כולם היו יודעים את האמת.',
}

function goodContinuationClause(mandatoryWord: string): string {
  return CONTINUATION_CLAUSE[CONNECTOR_CATEGORY[mandatoryWord] ?? 'simple']
}

/** Populated by each content ticket — only סיפור בהמשכים registered here. */
/**
 * The `fields` keys each topic's blocks/highlightField actually render.
 *
 * `naale_open_questions.fields` also holds grading-only values —
 * `expected_phrasing`, `expected_summary` — which are the model answer for
 * that exact row. Any route that ships `fields` to the client should project
 * it through this first. It matters most on the mistakes-review screen: those
 * questions can be re-served by the session-opening review, so handing over
 * the model answer would hand over the answer to a question the student is
 * about to be asked again.
 */
export const OPEN_PUBLIC_FIELD_KEYS: Record<string, string[]> = {
  'סיפור בהמשכים': ['student_task', 'mandatory_word'],
  'ווטסאפ והודעות': ['recipient'],
  'סיכום טקסט קצר': ['student_task'],
  'תיאור תמונה בקול': ['picture_number'],
}

/** Drops every key the given topic does not display. Unknown topic → nothing. */
export function publicOpenFields(topic: string, fields: Record<string, string>): Record<string, string> {
  const allowed = OPEN_PUBLIC_FIELD_KEYS[topic] ?? []
  return Object.fromEntries(allowed.filter(k => k in fields).map(k => [k, fields[k]]))
}

export const OPEN_EXERCISE_DISPLAY: Record<string, OpenExerciseDisplay> = {
  'סיפור בהמשכים': {
    wordLimit: 30,
    blocks: (prompt, fields) => [
      { label: 'פתיחת הסיפור', text: prompt },
      { label: 'המשימה', text: fields.student_task },
    ],
    highlightField: fields => ({ label: 'מילת חובה', text: fields.mandatory_word }),
    emptyErrorMessage: 'אנא כתוב את המשך הסיפור.',
    devSampleAnswers: {
      // mandatory_word here is always a discourse connector (לכן, אבל, לפתע,
      // אחרי ש...) drawn from 40 distinct values across the bank, not a
      // content word — so a single fixed clause can't follow all of them.
      // They fall into grammatically distinct families: a plain past
      // declarative clause reads fine after a simple adverb (לפתע, לכן) but
      // is an outright tense mismatch after a future-time word (מחר, בעתיד)
      // and doesn't fit the mood after a conditional (אילו, לו). Confirmed
      // empirically 2026-08-23 (item 14/L1): the single-clause version
      // scored ~50% on a live sample, including two genuine grammar/coherence
      // failures. goodContinuationClause() below picks a clause built for
      // that connector's actual grammatical family instead.
      good: fields => `${fields.mandatory_word} ${goodContinuationClause(fields.mandatory_word)}`,
      // Unrelated to any story opening, and never uses the required word —
      // should reliably score 1-2 regardless of which question this fills.
      weak: () => 'חתול. שולחן. אתמול היה.',
    },
  },
  'ווטסאפ והודעות': {
    wordLimit: 20,
    blocks: (prompt, fields) => [
      { label: 'למי ההודעה', text: fields.recipient },
      { label: 'המשימה', text: prompt },
    ],
    // No exact empty-submission string in Noam's spec for this exercise
    // (unlike Story Continuation) — reusing the same phrasing pattern rather
    // than inventing new wording from scratch.
    emptyErrorMessage: 'אנא כתוב הודעה.',
    devSampleAnswers: {
      // `expected_phrasing` (grading-only, never shown to the student) IS
      // the model answer for this exact recipient/task pair, so it's a
      // stronger "good" template than Story Continuation's fixed clause —
      // reliably scores 5/5 regardless of which row this fills.
      good: fields => fields.expected_phrasing,
      // Unrelated to any task and wrong for any recipient's tone — should
      // reliably score 1-2 regardless of which question this fills.
      weak: () => 'חתול. שולחן. אתמול היה.',
    },
  },
  'סיכום טקסט קצר': {
    wordLimit: 25,
    blocks: (prompt, fields) => [
      { label: 'הפסקה', text: prompt },
      { label: 'המשימה', text: fields.student_task },
    ],
    // Same gap as WhatsApp: no exact empty-submission string in Noam's spec
    // for this exercise. Placeholder, worth a one-line confirmation.
    emptyErrorMessage: 'אנא כתוב סיכום.',
    devSampleAnswers: {
      // expected_summary (grading-only, never shown to the student) IS the
      // model summary for this exact paragraph, so — same reasoning as
      // WhatsApp's good template — it's a stronger fit than inventing a
      // generic one: reliably scores 5/5 regardless of which row this fills.
      good: fields => fields.expected_summary,
      // Unrelated to any paragraph — should reliably score 1-2 regardless
      // of which question this fills.
      weak: () => 'חתול. שולחן. אתמול היה.',
    },
  },
  'תיאור תמונה בקול': {
    // Spoken, not typed — Noam's spec sets no length cap for this exercise,
    // unlike the other 3 topics' 20/25/30-word limits. Infinity means
    // wordLimitError() (checked both client- and server-side) never fires.
    wordLimit: Infinity,
    blocks: prompt => [
      { label: 'המשימה', text: prompt },
    ],
    // Noam's exact §7 string — session/page.tsx and placement/page.tsx already
    // show this before ever calling the AI when the transcript is empty.
    emptyErrorMessage: 'לא הצלחנו לשמוע, אנא נסה שוב.',
    // No devSampleAnswers: filling a plausible spoken description from field
    // data alone (unlike WhatsApp/Text Summary's literal model-answer fields)
    // isn't meaningful here, and image_description is grading-only precisely
    // so a QA shortcut can't leak it into a dev tool.
  },
}

/** Same rule the answer textarea counts by — the one place this logic lives, so client and
 *  server can never disagree about what "over the limit" means. */
export function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

/** Null if the answer is within its topic's limit, or if the topic isn't registered here — a
 *  display-registry gap must not be able to block grading. Otherwise a Hebrew message naming
 *  the limit, ready to return to the client as-is. */
export function wordLimitError(topic: string, text: string): string | null {
  const limit = OPEN_EXERCISE_DISPLAY[topic]?.wordLimit
  if (limit === undefined) return null
  return wordCount(text) > limit ? `התשובה ארוכה מדי (מקסימום ${limit} מילים)` : null
}
