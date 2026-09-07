/**
 * Builds a question-bank .xlsx workbook in the exact shape
 * question-import.ts / open-question-import.ts expect to read back — so a
 * downloaded workbook can be edited and re-uploaded through the existing
 * import with zero format conversion (naale-question-bank-excel-export).
 *
 * Three MCQ topics synthesize their DB `prompt` from multiple source columns
 * at import time (sentence correction, reading comprehension,
 * synonyms/antonyms) — this module reverses each of those transforms via the
 * helpers question-import.ts exports next to their forward counterparts, so
 * re-importing an unmodified export regenerates byte-identical prompts.
 *
 * Also mirrors the rest of Noam's real workbook structure as closely as
 * possible (sheet order, exact title text, the "Summary" sheet, and the 6
 * not-yet-built topic sheets) via static content where nothing in the DB
 * backs it — see the *_SHEET_AOA consts below. English guide sheet is one
 * deliberate omission; the "Summary" sheet (Hebrew "סיכום" in the real
 * workbook) is translated to English, per the user's own request — the 6
 * placeholder topic sheets are NOT translated (byte-for-byte Hebrew copies),
 * a deliberate, narrower scoping the user gave after first asking for both
 * to be translated, then reverting both, then asking for just this one.
 * Summary's complexity-level column is colored to match the real workbook's
 * own badge colors (see COMPLEXITY_FILL).
 *
 * Writes via `exceljs`, not `xlsx` — deliberately a different library from
 * the read/import side (question-import.ts / open-question-import.ts stay on
 * `xlsx`, untouched). `xlsx`'s free edition can write column widths and
 * merges but not cell colors/bold/wrap-text (confirmed directly: a written
 * fill silently doesn't survive a read-back); `exceljs` writes all of that
 * for real, which is the whole point of the colored/bold header row and
 * wrapped data cells below. No reason to touch the import side just because
 * the export side needed a capability `xlsx` doesn't have.
 */
import ExcelJS from 'exceljs'
import {
  TOPIC_NUMBERS, numberFromQuestionId,
  brokenSentenceFromPrompt, passageAndQuestionFromPrompt, wordAndContextFromPrompt,
  SENTENCE_COMPLETION_COL, SENTENCE_CORRECTION_COL, READING_COMPREHENSION_COL, SYNONYMS_ANTONYMS_COL,
} from './question-import'
import { STORY_CONTINUATION_COL, WHATSAPP_COL, TEXT_SUMMARY_COL, PICTURE_DESCRIPTION_COL } from './open-question-import'

export interface ExportQuestionRow {
  topic: string
  question_id: string
  difficulty: number
  prompt: string
  options: string[]
  correct_answer: string
  explanation: string
}

export interface ExportOpenQuestionRow {
  topic: string
  question_id: string
  difficulty: number
  prompt: string
  fields: Record<string, string>
}

const LETTERS = ['A', 'B', 'C', 'D'] as const

/** Verbatim title-row text from Noam's real workbook (confirmed against
 *  naale_categorized_questions_updated_v2.xlsx) — fuller descriptions than
 *  "<number>. <topic>" would generate, kept exact so a downloaded file reads
 *  the same as his own copy. checkTopicNumber() only requires the title
 *  contain "<number>." somewhere, which every one of these still does. */
const TOPIC_TITLES: Record<string, string> = {
  'הבנת הנקרא': '4. מענה על שאלות הבנת הנקרא (בכתב ובעל פה)',
  'נרדפות והופכיות': '6. משחק מילים נרדפות והופכיות (רמות 1-3: מילה נרדפת בלבד | רמות 4-5: מילה נרדפת ומילה הפכית)',
  'השלמת משפטים': '7. השלמת משפטים',
  'תיקון משפטים': '8. תיקון משפטים שאינם תקינים',
  'סיפור בהמשכים': '9. כתיבת סיפור בהמשכים (הבעה בכתב)',
  'ווטסאפ והודעות': '10. כתיבת ווטסאפים והודעות בעברית (הבעה בכתב)',
  'סיכום טקסט קצר': 'סיכום טקסט קצר (הבעה בכתב) – 11. סיכום טקסט קצר',
  'תיאור תמונה בקול': '12. תיאור תמונה בקול',
}

/** Per-sheet column widths (character units), copied from Noam's real
 *  workbook (`ws['!cols'][i].wch`, read with `{ cellStyles: true }` — plain
 *  `readFile()` doesn't populate `!cols` at all). `xlsx`'s free edition can
 *  write column widths and merges fine; it just can't write cell colors/
 *  bold/wrap-text (tested directly — a written fill silently doesn't survive
 *  a read-back). This is the "structural, no new dependency" readability
 *  pass; a colored/bold header row would need a different library. */
const COLUMN_WIDTHS: Record<string, number[]> = {
  // Column A is 5 in the real workbook (sized for the "#" data rows only),
  // but this sheet's own legend section (rows 19-23) also puts text directly
  // in column A (e.g. "Easy-Medium — Phase 2") with no merge to spread into
  // — rendered cramped/clipped at width 5 (confirmed live); widened here so
  // the legend labels render on one line instead of wrapping mid-word.
  'Summary': [24, 39, 23, 13, 17, 59],
  'שיחה קולית - עצמי': [4, 25, 25, 15],
  'שיחה קולית - יום יום': [4, 25, 25, 15],
  'שיחה קולית - בית ספר': [4, 25, 25, 15],
  'הבנת הנקרא': [4, 41, 25, 21, 21, 21, 21, 13, 54],
  'הבנת הנשמע': [4, 25, 41, 25, 41, 15],
  'נרדפות והופכיות': [4, 25, 41, 21, 21, 21, 21, 13, 54],
  'השלמת משפטים': [4, 25, 41, 21, 21, 21, 13, 54, 15],
  'תיקון משפטים': [4, 25, 41, 21, 21, 21, 21, 13, 54],
  'סיפור בהמשכים': [4, 47, 47, 21, 13],
  'ווטסאפ והודעות': [4, 21, 54, 49, 13],
  'סיכום טקסט קצר': [4, 47, 37, 47, 15],
  'משחק תפקידים': [4, 25, 25, 41, 15],
  'דיבייט הבעת דעה': [4, 25, 41, 15],
  'תיאור תמונה בקול': [4, 44, 44, 13, 29, 29],
}

// Extra merges inside the summary sheet's own "legend" section (rows 19-23),
// beyond the universal title-row merge every sheet gets — copied verbatim
// from the real workbook so that section reads as intended (one wide
// description cell per row) rather than five cramped columns.
const SUMMARY_EXTRA_MERGES = [
  { s: { r: 19, c: 0 }, e: { r: 19, c: 5 } },
  { s: { r: 20, c: 1 }, e: { r: 20, c: 5 } },
  { s: { r: 21, c: 1 }, e: { r: 21, c: 5 } },
  { s: { r: 22, c: 1 }, e: { r: 22, c: 5 } },
  { s: { r: 23, c: 1 }, e: { r: 23, c: 5 } },
]

/** Next unused "#" for a topic, given the question_ids already in the DB for
 *  it — surfaced per-sheet as a trailing note so a new question can be added
 *  without colliding with an existing number. */
export function nextFreeNumber(sheetName: string, questionIds: string[]): number {
  const numbers = questionIds.map(id => numberFromQuestionId(sheetName, id))
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}

/** A row with only the "#" cell filled and every other cell blank. Every
 *  sheet reader filters rows on a sheet-specific "real content" column
 *  (never the "#" column itself) before parsing — so this row is always
 *  silently skipped on re-import, exactly like a blank row would be. */
function noteRow(width: number, text: string): string[] {
  const row = new Array(width).fill('')
  row[0] = text
  return row
}

function sheetAOA(sheetName: string, header: string[], dataRows: string[][], questionIds: string[]): string[][] {
  const topicNumber = TOPIC_NUMBERS[sheetName]
  const title = TOPIC_TITLES[sheetName] ?? `${topicNumber}. ${sheetName}`
  const note = noteRow(header.length, `Next free #: ${nextFreeNumber(sheetName, questionIds)}`)
  return [[title], [], header, ...dataRows, note]
}

function correctLetterFor(options: string[], correctAnswer: string): string {
  const idx = options.indexOf(correctAnswer)
  return idx >= 0 ? LETTERS[idx] : ''
}

// Noam's real workbook has an extra "סוג מילת קישור" (connector-word type)
// column, between "#" and the prompt, that SENTENCE_COMPLETION_COL doesn't
// include — it's read as a header cell but never referenced by
// readSentenceCompletionSheet(), so it's silently dropped on import and
// never stored anywhere. Same situation as תיקון משפטים's "סוג השגיאה":
// included here for header/structure parity, exported blank since the DB
// has nothing to recover it from.
const SENTENCE_COMPLETION_HEADER = [
  SENTENCE_COMPLETION_COL.num,
  'סוג מילת קישור',
  SENTENCE_COMPLETION_COL.prompt,
  SENTENCE_COMPLETION_COL.answerA,
  SENTENCE_COMPLETION_COL.answerB,
  SENTENCE_COMPLETION_COL.answerC,
  SENTENCE_COMPLETION_COL.correctLetter,
  SENTENCE_COMPLETION_COL.explanation,
  SENTENCE_COMPLETION_COL.difficulty,
]

function sentenceCompletionSheet(rows: ExportQuestionRow[]): string[][] {
  const sheetName = 'השלמת משפטים'
  const dataRows = rows.map(r => {
    const [a, b, c] = r.options
    return [
      String(numberFromQuestionId(sheetName, r.question_id)),
      '', // סוג מילת קישור — not derivable from stored content, see comment above
      r.prompt, a ?? '', b ?? '', c ?? '',
      correctLetterFor(r.options, r.correct_answer),
      r.explanation, String(r.difficulty),
    ]
  })
  return sheetAOA(sheetName, SENTENCE_COMPLETION_HEADER, dataRows, rows.map(r => r.question_id))
}

// The "סוג השגיאה" (error type) column is read by the importer but never
// stored anywhere in the DB — it's dropped entirely on import, so the export
// has no way to recover it and leaves it blank. Flagged in the ticket for
// Noam; not fixed here without a DB column to hold it.
function sentenceCorrectionSheet(rows: ExportQuestionRow[]): string[][] {
  const sheetName = 'תיקון משפטים'
  const col = SENTENCE_CORRECTION_COL
  const dataRows = rows.map(r => {
    const [a, b, c, d] = r.options
    return [
      String(numberFromQuestionId(sheetName, r.question_id)),
      '', // סוג השגיאה — not derivable from stored content, see comment above
      brokenSentenceFromPrompt(r.prompt),
      a ?? '', b ?? '', c ?? '', d ?? '',
      correctLetterFor(r.options, r.correct_answer),
      r.explanation, String(r.difficulty),
    ]
  })
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function readingComprehensionSheet(rows: ExportQuestionRow[]): string[][] {
  const sheetName = 'הבנת הנקרא'
  const col = READING_COMPREHENSION_COL
  const dataRows = rows.map(r => {
    const [a, b, c, d] = r.options
    const { passage, question } = passageAndQuestionFromPrompt(r.prompt)
    return [
      String(numberFromQuestionId(sheetName, r.question_id)),
      passage, question,
      a ?? '', b ?? '', c ?? '', d ?? '',
      correctLetterFor(r.options, r.correct_answer),
      r.explanation, String(r.difficulty),
    ]
  })
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function synonymsAntonymsSheet(rows: ExportQuestionRow[]): string[][] {
  const sheetName = 'נרדפות והופכיות'
  const col = SYNONYMS_ANTONYMS_COL
  const dataRows = rows.map(r => {
    const [a, b, c, d] = r.options
    const { word, context } = wordAndContextFromPrompt(r.prompt, r.difficulty)
    return [
      String(numberFromQuestionId(sheetName, r.question_id)),
      word, context,
      a ?? '', b ?? '', c ?? '', d ?? '',
      correctLetterFor(r.options, r.correct_answer),
      r.explanation, String(r.difficulty),
    ]
  })
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function storyContinuationSheet(rows: ExportOpenQuestionRow[]): string[][] {
  const sheetName = 'סיפור בהמשכים'
  const col = STORY_CONTINUATION_COL
  const dataRows = rows.map(r => [
    String(numberFromQuestionId(sheetName, r.question_id)),
    r.prompt, r.fields.student_task ?? '', r.fields.mandatory_word ?? '', String(r.difficulty),
  ])
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function whatsappSheet(rows: ExportOpenQuestionRow[]): string[][] {
  const sheetName = 'ווטסאפ והודעות'
  const col = WHATSAPP_COL
  const dataRows = rows.map(r => [
    String(numberFromQuestionId(sheetName, r.question_id)),
    r.fields.recipient ?? '', r.prompt, r.fields.expected_phrasing ?? '', String(r.difficulty),
  ])
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function textSummarySheet(rows: ExportOpenQuestionRow[]): string[][] {
  const sheetName = 'סיכום טקסט קצר'
  const col = TEXT_SUMMARY_COL
  const dataRows = rows.map(r => [
    String(numberFromQuestionId(sheetName, r.question_id)),
    r.prompt, r.fields.student_task ?? '', r.fields.expected_summary ?? '', String(r.difficulty),
  ])
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

function pictureDescriptionSheet(rows: ExportOpenQuestionRow[]): string[][] {
  const sheetName = 'תיאור תמונה בקול'
  const col = PICTURE_DESCRIPTION_COL
  const dataRows = rows.map(r => [
    String(numberFromQuestionId(sheetName, r.question_id)),
    r.fields.image_description ?? '', r.prompt, String(r.difficulty),
    r.fields.mandatory_anchors ?? '', r.fields.optional_anchors ?? '',
  ])
  return sheetAOA(sheetName, Object.values(col), dataRows, rows.map(r => r.question_id))
}

// English translation of Noam's own "סיכום" (summary) sheet — his planning
// notes (dev complexity, priority/rollout notes per topic) aren't derivable
// from the DB at all, so this stays a static, hand-maintained copy of his
// content, just translated. Per the user's own scoping call: ONLY this
// sheet is translated, not the 6 placeholder sheets below — their tabs stay
// Hebrew, so column C ("Sheet Name") here is deliberately left pointing at
// their real (Hebrew) tab names, not translated names — those are actual
// pointers to other tabs in this same workbook. The "questions found"
// column can go stale as the bank grows; that's accepted, not a bug.
const SUMMARY_SHEET_AOA: (string | number)[][] = [
  ["Summary: Categorization of Practice Questions by Type", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["#", "Category / Module Name", "Sheet Name", "Questions Found", "Dev Complexity", "Priority / Note"],
  [1, "Voice conversation with AI about yourself", "שיחה קולית - עצמי", 3, "Complex", "Deferred — real-time two-way conversation (STT+LLM) — not in scope for phase 1"],
  [2, "Voice conversation with AI about daily life", "שיחה קולית - יום יום", 3, "Complex", "Deferred — real-time two-way conversation (STT+LLM) — not in scope for phase 1"],
  [3, "Voice conversation with AI about school topics", "שיחה קולית - בית ספר", 3, "Complex", "Deferred — real-time two-way conversation (STT+LLM) — not in scope for phase 1"],
  [4, "Answering reading comprehension questions (written and spoken)", "הבנת הנקרא", 350, "Easy", "Phase 1 — converted to American format (4 options) at the product owner's request — fully automatic checking, no AI grading"],
  [5, "Answering listening comprehension questions (written and spoken)", "הבנת הנשמע", 3, "Complex", "Deferred — requires a real audio-file bank, not just text — not in scope for phase 1"],
  [6, "Synonyms & antonyms word game", "נרדפות והופכיות", 350, "Easy", "Phase 1 - start here — combined question (synonym+antonym together) with a context sentence, 4 multiple-choice options — fully automatic checking"],
  [7, "Sentence Completion", "השלמת משפטים", 350, "Easy", "Phase 1 - start here — choice from 3 options, exact match — fully automatic checking"],
  [8, "Correcting invalid sentences", "תיקון משפטים", 350, "Easy", "Phase 1 — converted to American format (4 options) at the product owner's request — fully automatic checking, no AI grading"],
  [9, "Writing a continuing story (written expression)", "סיפור בהמשכים", 175, "Medium", "Phase 3 — free, creative text — requires real quality judging from AI, but text only (no voice/image)"],
  [10, "Writing WhatsApp messages in Hebrew (written expression)", "ווטסאפ והודעות", 175, "Medium", "Phase 3 — free text — requires AI judgment of tone and grammatical correctness, but text only"],
  [11, "Short text summary (written expression)", "סיכום טקסט קצר", 175, "Medium", "Phase 3 — free text — requires AI judgment of summary quality, but text only"],
  [12, "Picture description (spoken)", "תיאור תמונה בקול", 30, "Complex", "Deferred — requires a real image bank + STT — not in scope for phase 1"],
  [13, "Role-play in everyday situations", "משחק תפקידים", 3, "Complex", "Deferred — open-ended conversation the AI runs and evaluates in real time — not in scope for phase 1"],
  [14, "Debate / opinion expression", "דיבייט הבעת דעה", 3, "Complex", "Deferred — open-ended conversation the AI runs and evaluates in real time — not in scope for phase 1"],
  ["", "Total", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["Complexity Level Key + Recommended Build Order", "", "", "", "", ""],
  ["Easy — Phase 1", "Exact match (choice / word), fully automatic checking, no AI grading. Fastest to build.", "", "", "", ""],
  ["Easy-Medium — Phase 2", "Free but short and clear answer, easy to compare to the expected answer.", "", "", "", ""],
  ["Medium — Phase 3", "More free and creative text, requires real quality judging from AI — but still text only, no voice/image.", "", "", "", ""],
  ["Complex — Deferred", "Real-time open-ended conversation (STT+LLM), or requires a new content bank (audio/images). Not in scope for phase 1.", "", "", "", ""],
]

// Fill colors extracted directly from the real workbook's own "רמת מורכבות
// לפיתוח" (dev complexity) column cells — pastel fills (Excel's dark UI
// theme renders them more saturated on screen, but these are the actual
// stored values). Applied per-row below by matching column E's text.
const COMPLEXITY_FILL: Record<string, string> = {
  Complex: 'FFF4CCCC',
  Easy: 'FFD9EAD3',
  Medium: 'FFFCE5CD',
}

// Static copies of the 6 not-yet-built topic sheets (voice chat x3, listening
// comprehension, role-play, debate) — no DB table, reader, or app feature
// exists for any of them yet, so there's nothing to derive these from. Kept
// anyway (Noam's own call): he edits this export with his own Claude, and
// dropping these sheets would drop that design context from his working
// copy entirely, not just from ours. Same "frozen, may go stale" tradeoff as
// SUMMARY_SHEET_AOA above — captured verbatim from
// naale_categorized_questions_updated_v2.xlsx. If any of these topics gets a
// real reader/DB table later, replace its static sheet here with a real
// DB-derived one, same as the 8 already-supported sheets.
const VOICE_CHAT_SELF_SHEET_AOA: (string | number)[][] = [
  ["1. שיחה קולית עם AI על עצמי", "", "", ""],
  ["", "", "", ""],
  ["#", "נושא", "שאלת פתיחה (AI)", "רמת קושי (1-5)"],
  [1, "תחביבים ופנאי", "היי! מה התחביב שאתה הכי אוהב לעשות אחרי בית הספר ולמה?", ""],
  [2, "האוכל האהוב עליי", "אם היית צריך לאכול רק מאכל אחד כל החיים, מה זה היה?", ""],
  [3, "מוזיקה וסרטונים", "איזה סוג מוזיקה אתה אוהב לשמוע כשמח לך?", ""],
]

const VOICE_CHAT_DAILY_SHEET_AOA: (string | number)[][] = [
  ["2. שיחה קולית עם AI על חיי היום-יום", "", "", ""],
  ["", "", "", ""],
  ["#", "נושא", "שאלת פתיחה (AI)", "רמת קושי (1-5)"],
  [1, "קניות בקיוסק", "אהלן! מה בא לך לקנות מהקיוסק בהפסקה?", ""],
  [2, "פגישה אחרי הצהריים", "מה הלו\"ז להיום? בא לך לקפוץ למגרש ב-5?", ""],
  [3, "בתחבורה הציבורית", "סליחה, אתה יודע באיזה קו מגיעים לקניון?", ""],
]

const VOICE_CHAT_SCHOOL_SHEET_AOA: (string | number)[][] = [
  ["3. שיחה קולית עם AI על נושאי בית הספר", "", "", ""],
  ["", "", "", ""],
  ["#", "נושא", "שאלת פתיחה (AI)", "רמת קושי (1-5)"],
  [1, "פנייה למורה בסוף השיעור", "שלום, רצית לשאול משהו לגבי המבחן במדעים?", ""],
  [2, "שיחה על מערכת השעות", "איזה שיעור יש לנו עכשיו? שכחתי את מערכת השעות.", ""],
  [3, "עבודה קבוצתית", "אנחנו צריכים לחלק את התפקידים במצגת, מה אתה רוצה לעשות?", ""],
]

const LISTENING_COMPREHENSION_SHEET_AOA: (string | number)[][] = [
  ["5. מענה על שאלות הבנת הנשמע (בכתב ובעל פה)", "", "", "", "", ""],
  ["", "", "", "", "", ""],
  ["#", "סוג קטע השמע", "תמלול קטע השמע", "שאלה", "תשובה", "רמת קושי (1-5)"],
  [1, "הודעה מהמנהל", "תלמידים יקרים, מחר יתקיים יום ספורט. יש להגיע בתלבושת ספורט ובנעלי ספורט בלבד.", "מה צריך ללבוש מחר לבית הספר?", "תלבושת ספורט ונעלי ספורט.", ""],
  [2, "שיחה בין חברים", "אני לא מוצא את מפתח הבית, נראה לי השארתי אותו בלוקר בבית הספר.", "איפה החבר חושב שהמפתח נמצא?", "בלוקר בבית הספר.", ""],
  [3, "פודקאסט מדעי קל", "הדולפינים אינם דגים אלא יונקים, והם נושמים אוויר דרך חור בחלק העליון של ראשם.", "כיצד נושמים הדולפינים?", "דרך חור בחלק העליון של ראשם.", ""],
]

const ROLE_PLAY_SHEET_AOA: (string | number)[][] = [
  ["13. משחק תפקידים במצבי יומיום", "", "", "", ""],
  ["", "", "", "", ""],
  ["#", "סיטואציה", "שורת פתיחה (AI)", "משימה לתלמיד", "רמת קושי (1-5)"],
  [1, "החלפת מוצר בחנות", "שלום, איך אפשר לעזור לך? (AI בתפקיד מוכר)", "לבקש להחליף חולצה ללא קבלה.", ""],
  [2, "איחור לשיעור", "שלום, למה איחרת ב-10 דקות לשיעור? (AI בתפקיד מורה)", "להסביר שהאוטובוס לא הגיע.", ""],
  [3, "בקשת עזרה מחבר", "מה נשמע? מה אתה עושה? (AI בתפקיד חבר)", "לבקש עזרה בשיעורי הבית.", ""],
]

const DEBATE_SHEET_AOA: (string | number)[][] = [
  ["14. דיבייט / הבעת דעה", "", "", ""],
  ["", "", "", ""],
  ["#", "נושא", "טענת AI", "רמת קושי (1-5)"],
  [1, "תלבושת אחידה בבית הספר", "אני חושב שתלבושת אחידה זה מצוין כי זה חוסך זמן בבוקר.", ""],
  [2, "שימוש בטלפונים בהפסקות", "צריך לאסור טלפונים בהפסקה כדי שילדים ידברו זה עם זה.", ""],
  [3, "שיעורי בית בסופ\"ש", "שיעורי בית בסוף השבוע עוזרים לזכור את החומר.", ""],
]


// Colors/positions confirmed against Noam's real workbook's header cells
// (fgColor "1F4E78" on a solid-pattern fill — see the ticket's task.md for
// how this was checked). Row heights are a reasonable fixed value, not
// extracted per-row from the source — the real file's heights vary row by
// row with content length, which exceljs doesn't auto-compute either, so
// matching them exactly would need per-row measurement with no real payoff.
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 12 }
const WRAP_TOP: Partial<ExcelJS.Alignment> = { wrapText: true, vertical: 'top' }
const HEADER_ROW_HEIGHT = 22
const DATA_ROW_HEIGHT = 40

export function buildQuestionBankWorkbook(
  mcqRows: ExportQuestionRow[],
  openRows: ExportOpenQuestionRow[]
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  // All content is Hebrew — confirmed against Noam's real workbook
  // (Workbook.Views: [{ RTL: true }] when read via xlsx), not guessed.
  // exceljs only exposes rightToLeft as a per-worksheet view property (its
  // WorkbookView type is unrelated — window position/size, not direction),
  // so this is set on each addWorksheet() call below instead of here.

  // The DB read has no ORDER BY (selectAll() pages by range, not by content),
  // so rows land in whatever order Postgres happens to return them — visibly
  // wrong once multiple import batches exist (e.g. #171-175 appearing before
  // #100-103). Sort by the numeric "#" every time, not just for cosmetics —
  // Noam edits this file expecting it to read top-to-bottom in order.
  const byTopic = <T extends { topic: string; question_id: string }>(rows: T[], topic: string) =>
    rows
      .filter(r => r.topic === topic)
      .sort((a, b) => numberFromQuestionId(topic, a.question_id) - numberFromQuestionId(topic, b.question_id))

  const append = (sheetName: string, aoa: (string | number)[][]) => {
    const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true }] })
    const widths = COLUMN_WIDTHS[sheetName]
    if (widths) ws.columns = widths.map(width => ({ width }))

    aoa.forEach((row, i) => {
      const excelRow = ws.addRow(row)
      if (i === 2) {
        // Header row.
        excelRow.eachCell(cell => {
          cell.fill = HEADER_FILL
          cell.font = HEADER_FONT
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        })
        excelRow.height = HEADER_ROW_HEIGHT
      } else if (i > 2) {
        // Data rows, including the trailing "next free #" note row — wrap
        // styling on that row is harmless (it's still skipped on import
        // regardless of how it looks).
        excelRow.eachCell(cell => { cell.alignment = WRAP_TOP })
        excelRow.height = DATA_ROW_HEIGHT

        // Summary sheet only: color the "Dev Complexity" cell (column E, the
        // 5th column) to match the real workbook's own badge colors for
        // that value.
        if (sheetName === 'Summary') {
          const complexity = row[4]
          const fillColor = typeof complexity === 'string' ? COMPLEXITY_FILL[complexity] : undefined
          if (fillColor) {
            excelRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
          }
        }
      }
    })

    // Every sheet's title row spans its full width — matches the real
    // workbook's own layout (single banner, not one cell + blank neighbors).
    const width = aoa[2]?.length ?? aoa[0]?.length ?? 1
    ws.mergeCells(1, 1, 1, Math.max(width, 1))
    ws.getCell(1, 1).font = TITLE_FONT
    ws.getCell(1, 1).alignment = { horizontal: 'center' }

    if (sheetName === 'Summary') {
      // SUMMARY_EXTRA_MERGES is 0-indexed (xlsx convention, matches how it
      // was originally extracted from the reference file); mergeCells() here
      // wants 1-indexed row/col.
      for (const m of SUMMARY_EXTRA_MERGES) {
        ws.mergeCells(m.s.r + 1, m.s.c + 1, m.e.r + 1, m.e.c + 1)
      }
    }
  }

  // Order matches Noam's real workbook (naale_categorized_questions_updated_v2.xlsx),
  // minus the English guide sheet, with one deliberate fix: the real
  // workbook's own tab order runs ...11, 13, 14, 12 at the end (not
  // sequential) — reordered to 11, 12, 13, 14 below. The other not-yet-built
  // topics stay in place as static sheets (see the consts above) so his
  // design context isn't lost from the downloaded copy.
  append('Summary', SUMMARY_SHEET_AOA)
  append('שיחה קולית - עצמי', VOICE_CHAT_SELF_SHEET_AOA)
  append('שיחה קולית - יום יום', VOICE_CHAT_DAILY_SHEET_AOA)
  append('שיחה קולית - בית ספר', VOICE_CHAT_SCHOOL_SHEET_AOA)
  append('הבנת הנקרא', readingComprehensionSheet(byTopic(mcqRows, 'הבנת הנקרא')))
  append('הבנת הנשמע', LISTENING_COMPREHENSION_SHEET_AOA)
  append('נרדפות והופכיות', synonymsAntonymsSheet(byTopic(mcqRows, 'נרדפות והופכיות')))
  append('השלמת משפטים', sentenceCompletionSheet(byTopic(mcqRows, 'השלמת משפטים')))
  append('תיקון משפטים', sentenceCorrectionSheet(byTopic(mcqRows, 'תיקון משפטים')))
  append('סיפור בהמשכים', storyContinuationSheet(byTopic(openRows, 'סיפור בהמשכים')))
  append('ווטסאפ והודעות', whatsappSheet(byTopic(openRows, 'ווטסאפ והודעות')))
  append('סיכום טקסט קצר', textSummarySheet(byTopic(openRows, 'סיכום טקסט קצר')))
  // The real workbook's own tab order runs 11, 13, 14, 12 here (not
  // sequential) — deliberately not copied; reordered to 11, 12, 13, 14.
  append('תיאור תמונה בקול', pictureDescriptionSheet(byTopic(openRows, 'תיאור תמונה בקול')))
  append('משחק תפקידים', ROLE_PLAY_SHEET_AOA)
  append('דיבייט הבעת דעה', DEBATE_SHEET_AOA)

  return wb
}
