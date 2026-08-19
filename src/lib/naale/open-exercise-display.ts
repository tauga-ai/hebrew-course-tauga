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

/** Populated by each content ticket — only סיפור בהמשכים registered here. */
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
      // mandatory_word here is always a discourse connector (לכן, אבל,
      // לפתע, אחרי ש...), not a content word — so a fixed clause after it
      // reads as a plausible (if generic) continuation for almost any
      // opening, regardless of which connector this specific question uses.
      good: fields => `${fields.mandatory_word} הכול השתנה לגמרי, והם הבינו שזה רק ההתחלה.`,
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
}
