import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isRetryableGeminiError } from './gemini-retry'

export interface OpenGradingBuilder {
  /** Builds this topic's fixed system prompt (Noam's text, reproduced
   *  verbatim from the source doc — see PROMPT PROVENANCE below) with this
   *  question's main text (`prompt` — the opening line / paragraph / task,
   *  whichever column each topic's sheet reader chose as its natural upsert
   *  key), its other `fields`, and the student's text all substituted in. */
  buildPrompt: (prompt: string, fields: Record<string, string>, userText: string) => string
  /** Which of this topic's `fields` keys are safe to show the student when
   *  the question is served. Everything else in `fields` is grading-only
   *  (e.g. a model answer used only inside the AI's own feedback) and must
   *  never reach the client — same concern as correct_answer for MCQ. */
  publicFieldKeys: string[]
}

/** Populated by each content ticket registering its own topic — empty until
 *  naale-story-continuation / naale-whatsapp-messages / naale-text-summary
 *  land. Keyed by the exact topic string (the Hebrew sheet name), same as
 *  naale_questions.topic. */
export const OPEN_GRADING_BUILDERS: Record<string, OpenGradingBuilder> = {}

// * PROMPT PROVENANCE
// Source: `.claude/requirements/corrected question 8-20/` — the "Leniency v2"
// docs (2026-08-20), superseding `naale-update-8-18/`. Diffed section by
// section against v1: §1 and §3 are byte-identical, §2/§5/§6/§7 differ only in
// markdown formatting, and every real change is inside §4, the prompt. So no
// field, XP, streak or level rule moved — this is a grading-leniency change
// only, which is what makes it safe to swap the strings and nothing else.
//
// v1 carried a "⚠ VERBATIM PROMPT — do not edit, reformat, or re-translate"
// marker. v2 drops it, and Noam edited the prompts himself, so the constraint
// is lifted by the PO rather than by us.
//
// Each prompt below is byte-exact to its v2 doc apart from ONE deliberate
// addition: the sentence forbidding a preamble or a ```json fence, which v2
// dropped. That is a parsing guard, not a grading rule — gradeOpenAnswer()
// throws "Malformed grading response" on a fenced reply — so it is re-added
// rather than treated as an instruction to remove it.
//
// Note also that v2's low-score feedback note now refers to the model answer
// by NAME ("the expected phrasing") instead of interpolating its value a
// second time; it is still supplied as input #3, so the model has it either
// way. Following the doc rather than keeping our extra interpolation.

// * STORY CONTINUATION
// `mandatory_word` is public — the spec is explicit that this word is shown
// to the student as part of the task, unlike a reference/model answer.
OPEN_GRADING_BUILDERS['סיפור בהמשכים'] = {
  publicFieldKeys: ['student_task', 'mandatory_word'],
  buildPrompt: (prompt, fields, userText) => `תפקיד ומשימה: אתה מעריך פדגוגי חכם המסייע לעולים חדשים ללמוד עברית בהבעה בכתב. המשתמש מתבקש להמשיך סיפור קצר בהתבסס על פתיח שניתן לו, תוך עמידה באילוץ ספציפי (שימוש במילת חובה). מגבלת האורך למשתמש היא עד 30 מילים.
הקלט שיועבר אליך:
1. הפתיח לסיפור: "${prompt}"
2. משימת המשתמש: "${fields.student_task}"
3. מילת חובה שעליו לשלב: "${fields.mandatory_word}"
4. הטקסט שהמשתמש כתב: "${userText}"

חוקי גמישות פדגוגית (חובה ליישם לפני ההערכה):
1. כתיב מלא/חסר: התעלם לחלוטין משגיאות של כתיב מלא או חסר (למשל: מידי/מדי, אמא/אימא). שגיאות אלו לא יורידו ניקוד כלל (יקבלו ציון 5 בהיבט זה). בשום פנים ואופן אל תסביר שגיאות ברמת האות הבודדת (למשל אל תכתוב "חסרה לך האות י'").
2. ניסוח אלטרנטיבי יצירתי: כל עוד המשך הסיפור הגיוני ומשלב את מילת החובה, יש לקבל ניסוחים שונים ומקוריים כראויים לציון הגבוה (5). אין להוריד ניקוד על יצירתיות.
3. בלבול הומופוני והתאמה קלה: שגיאות של מילים בעלות צליל זהה (כמו אם/עם, לא/לו) או טעויות זכר/נקבה קלות נחשבות כפגם קטן. אם שאר התשובה מושלמת, הן יורידו את הציון ל-4 בלבד. עם זאת, במקרה שבו קיימות שגיאות משמעותיות נוספות בטקסט (כגון חוסר הגיון או שגיאות תחביר קשות), הציון ימשיך לרדת ל-3 ומטה בהתאם למחוון.

תהליך ההערכה (flow) שעליך לבצע ברקע:
שלב 1 - בדיקת תוכן: האם ההמשך הגיוני, מתייחס לפתיח של הסיפור ותואם אותו.
שלב 2 - בדיקת מילת חובה: האם המשתמש השתמש נכון במילת החובה.
שלב 3 - ניתוח דקדוקי: בדיקת תקינות תחבירית, זכר/נקבה, יחיד/רבים ואיות (תוך התחשבות בחוקי הגמישות).

סולם הניקוד המוחלט (מ-1 עד 5):
1 - רמה שגויה לחלוטין: תשובה לא קשורה כלל לפתיח של הסיפור, טקסט לא מובן, ג'יבריש או תשובה ריקה.
2 - רמה נמוכה: הטקסט בקושי קריא, מלא בשגיאות דקדוקיות קשות, או שההמשך לא קשור כלל לפתיח.
3 - רמה בינונית: ההמשך יחסית מובן, אך יש שגיאות דקדוקיות בולטות, ו/או אין שימוש במילת החובה.
4 - רמה טובה: תשובה טובה מאוד אך עם פגם אחד - או שיש שגיאות דקדוק קלות (כגון בלבול "אם/עם"), או שהטקסט ללא שגיאות אך המשתמש שכח להשתמש במילת החובה.
5 - רמה מצוינת: תשובה מושלמת. המשך הגיוני לסיפור, דקדוק נכון וללא שגיאות כתיב (שגיאות כתיב מלא/חסר מתקבלות ולא מורידות ניקוד), ושימוש תקין במילת החובה.

פורמט הפלט המבוקש (חובה):
עליך להחזיר את התוצאה בפורמט JSON טהור ותקני בלבד. אל תוסיף שום טקסט מקדים, ללא הסברים וללא בלוקים של קוד (ללא \`\`\`json). מבנה ה-JSON חייב להיות:
{  "score": <number between 1-5>,  "feedback": "<short constructive feedback in simple Hebrew>"}`,
}

// * WHATSAPP MESSAGES
// `expected_phrasing` is NOT public — it's a model answer, only ever used
// inside the grading prompt (and, per the prompt's own instruction, echoed
// back inside the AI's feedback text when the score is 3 or below — the app
// doesn't need to handle that specially, it's already baked into the prompt).
OPEN_GRADING_BUILDERS['ווטסאפ והודעות'] = {
  publicFieldKeys: ['recipient'],
  buildPrompt: (prompt, fields, userText) => `תפקיד ומשימה: אתה מעריך פדגוגי חכם המסייע לעולים חדשים ללמוד עברית בהבעה בכתב. המשתמש מתבקש לכתוב הודעת טקסט (כמו ווטסאפ) בהתבסס על משימה ונמען. מגבלת האורך למשתמש היא עד 20 מילים.
הקלט שיועבר אליך:
1. הנמען (למי ההודעה נשלחת): "${fields.recipient}"
2. המשימה (מה צריך לכתוב): "${prompt}"
3. ניסוח מצופה (רפרנס לכוונת המשורר): "${fields.expected_phrasing}"
4. הטקסט שהמשתמש כתב: "${userText}"

חוקי גמישות פדגוגית (חובה ליישם לפני ההערכה):
1. כתיב מלא/חסר: התעלם לחלוטין משגיאות של כתיב מלא או חסר (למשל: מידי/מדי, אמא/אימא). אין להוריד ניקוד על כך. בשום אופן אל תסביר שגיאות ברמת האות.
2. ניסוח אלטרנטיבי (הגולדן סטנדרט הוא רק המלצה רעיונית): אם המשתמש בחר במילים נרדפות או בניסוח שונה לחלוטין מה"ניסוח המצופה", אך הרעיון והמשלב הלשוני נכונים, מגיע לו לשמור על הציון הגבוה (5).
3. בלבול הומופוני והתאמה קלה: שגיאות של מילים בעלות צליל זהה (כמו אם/עם, לא/לו) או טעויות זכר/נקבה קלות נחשבות כפגם קטן. אם שאר התשובה מושלמת, הן יורידו את הציון ל-4 בלבד. עם זאת, במקרה שבו קיימות שגיאות משמעותיות נוספות בטקסט (כגון טון שגוי לחלוטין), הציון ימשיך לרדת ל-3 ומטה בהתאם למחוון.

תהליך ההערכה (flow) שעליך לבצע ברקע:
שלב 1 - העברת המסר: האם המשתמש ביצע את המשימה. ודא שהרעיון המרכזי עבר (גמישות בניסוח).
שלב 2 - התאמת משלב לשוני (טון): האם סגנון הדיבור מתאים לנמען.
שלב 3 - ניתוח דקדוקי: בדיקת תקינות תחבירית (בכפוף לחוקי הגמישות).

סולם הניקוד המוחלט (מ-1 עד 5):
1 - רמה שגויה לחלוטין: הודעה לא קשורה, ג'יבריש, או שתיקה.
2 - רמה נמוכה: קיימת בעיה כפולה - גם שגיאות דקדוקיות קשות וגם משלב לשוני (טון) שגוי לחלוטין בהתייחס לנמען, מה שפוגע משמעותית בתקשורת.
3 - רמה בינונית: המסר הובן, אך יש שגיאות דקדוקיות בולטות מאוד, או משלב לשוני (טון) שגוי לחלוטין.
4 - רמה טובה: תשובה טובה מאוד אך עם פגם אחד קטן - שגיאות דקדוק קלות (כמו אם/עם) או חוסר נימוס קל.
5 - רמה מצוינת: תשובה מושלמת. המסר עבר, דקדוק נכון (כתיב מלא/חסר מותר), והטון מתאים. ניסוחים אלטרנטיביים מקוריים מתקבלים בברכה.

פורמט הפלט המבוקש (חובה):
עליך להחזיר את התוצאה בפורמט JSON טהור ותקני בלבד. אל תוסיף שום טקסט מקדים, ללא הסברים וללא בלוקים של קוד (ללא \`\`\`json). הערה חשובה: בציון 3 ומטה, כלול בתוך הפידבק את ה"ניסוח מצופה" כדוגמה.
מבנה ה-JSON חייב להיות:
{  "score": <number between 1-5>,  "feedback": "<short constructive feedback in simple Hebrew>"}`,
}

// * SHORT TEXT SUMMARTY
// `expected_summary` is NOT public — same reasoning as Story Continuation's
// `mandatory_word`-is-public case in reverse: this is a model answer, only
// ever used inside the grading prompt (and echoed into feedback at a low
// score, per the prompt's own instruction).
OPEN_GRADING_BUILDERS['סיכום טקסט קצר'] = {
  publicFieldKeys: ['student_task'],
  buildPrompt: (prompt, fields, userText) => `תפקיד ומשימה: אתה מעריך פדגוגי חכם המסייע לעולים חדשים ללמוד עברית בהבעה בכתב. המשתמש מתבקש לקרוא פסקה קצרה ולסכם אותה במשפט אחד. מגבלת האורך למשתמש היא עד 25 מילים.
הקלט שיועבר אליך:
1. הפסקה המקורית: "${prompt}"
2. המשימה (מה צריך לעשות): "${fields.student_task}"
3. סיכום מצופה (רפרנס לכוונת המשורר): "${fields.expected_summary}"
4. הסיכום שהמשתמש כתב: "${userText}"

חוקי גמישות פדגוגית (חובה ליישם לפני ההערכה):
1. כתיב מלא/חסר: התעלם לחלוטין משגיאות של כתיב מלא או חסר (למשל: מידי/מדי). אין להוריד ניקוד על כך. בשום אופן אל תסביר שגיאות ברמת האות.
2. ניסוח אלטרנטיבי: ה"סיכום המצופה" נועד לשמש ככיוון רעיוני בלבד. ניסוחים אלטרנטיביים טובים שונים לחלוטין שמעבירים את אותו הרעיון ישמרו על הציון הגבוה (5). אין לדרוש היצמדות לטקסט המצופה.
3. בלבול הומופוני והתאמה קלה: שגיאות של מילים בעלות צליל זהה (כמו אם/עם, לא/לו) או טעויות זכר/נקבה קלות נחשבות כפגם קטן. אם שאר התשובה מושלמת, הן יורידו את הציון ל-4 בלבד. עם זאת, במקרה שבו קיימות שגיאות משמעותיות נוספות בטקסט (כגון חוסר הבנה של התוכן), הציון ימשיך לרדת ל-3 ומטה בהתאם למחוון.

תהליך ההערכה (flow) שעליך לבצע ברקע:
שלב 1 - בדיקת תוכן והבחנה בין עיקר לטפל: הבנת הרעיון המרכזי והשמטת דוגמאות.
שלב 2 - מידת העיבוד ("העתקה"): הורדת ניקוד על Copy-Paste מדויק ללא עיבוד משלו.
שלב 3 - ניתוח דקדוקי: בדיקת תקינות (בכפוף לחוקי הגמישות).

סולם הניקוד המוחלט (מ-1 עד 5):
1 - רמה שגויה לחלוטין: הסיכום לא קשור כלל, או התעלמות מהרעיון המרכזי.
2 - רמה נמוכה: טעויות קשות בהבנת הנקרא או שגיאות שמפריעות מהותית להבנה.
3 - רמה בינונית: הבין את הרעיון, אך יש שגיאות דקדוקיות משמעותיות או הכללת פרטים טפלים.
4 - רמה טובה: הסיכום מעביר את הרעיון היטב, אך עם פגם אחד: שגיאות דקדוק קלות (כמו אם/עם), או העתקת משפט מהמקור כמעט מילה-במילה.
5 - רמה מצוינת: תשובה מושלמת. רעיון מרכזי מדויק, ניסוח מעובד, ודקדוק נקי (שגיאות כתיב מלא/חסר מותרות). ניסוחים מקוריים מתקבלים בברכה.

פורמט הפלט המבוקש (חובה):
עליך להחזיר JSON טהור ותקני בלבד. אל תוסיף שום טקסט מקדים, ללא הסברים וללא בלוקים של קוד (ללא \`\`\`json). הערה חשובה: בציון 3 ומטה, כלול בתוך הפידבק את ה"סיכום מצופה" כדוגמה.
מבנה ה-JSON חייב להיות:
{  "score": <number between 1-5>,  "feedback": "<short constructive feedback in simple Hebrew>"}`,
}

export function publicFields(topic: string, fields: Record<string, string>): Record<string, string> {
  const builder = OPEN_GRADING_BUILDERS[topic]
  if (!builder) return {}
  return Object.fromEntries(
    builder.publicFieldKeys.map(k => [k, fields[k]]).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

export interface GradedResult { score: number; feedback: string }

const REQUEST_TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Throws on a missing registration, a provider error, or a malformed reply
 *  — callers (the answer routes) are responsible for catching this and
 *  falling back to a generic message, same pattern as sentence/feedback's
 *  try/catch around its Gemini call. */
export async function gradeOpenAnswer(topic: string, prompt: string, fields: Record<string, string>, userText: string): Promise<GradedResult> {
  const builder = OPEN_GRADING_BUILDERS[topic]
  if (!builder) throw new Error(`No grading prompt registered for topic: ${topic}`)

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel(
    { model: 'gemini-2.5-flash', generationConfig: { temperature: 0.2 } },
    { timeout: REQUEST_TIMEOUT_MS }
  )

  let result: Awaited<ReturnType<typeof model.generateContent>> | undefined
  for (let attempt = 1; !result; attempt++) {
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: builder.buildPrompt(prompt, fields, userText) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      })
    } catch (err) {
      const retryable = isRetryableGeminiError(err)
      if (attempt >= MAX_ATTEMPTS || !retryable) {
        console.error(`[open-grading] grading call failed for topic "${topic}" (attempt ${attempt}/${MAX_ATTEMPTS}, ${retryable ? 'retries exhausted' : 'non-retryable'}):`, err)
        throw err
      }
      console.error(`[open-grading] transient error for topic "${topic}" (attempt ${attempt}/${MAX_ATTEMPTS}), retrying:`, err)
      await sleep(RETRY_DELAY_MS)
    }
  }

  // Per the content-update spec docs' §7 ("if JSON parsing fails, log the raw
  // response"): the raw text is captured up front so it's logged either way a
  // malformed reply can happen below — otherwise a caller only ever sees a
  // generic "Malformed grading response"/SyntaxError with no way to tell
  // whether Gemini truncated, refused, wrapped in a code fence, etc.
  const rawText = result.response.text().trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error(`[open-grading] non-JSON response for topic "${topic}":`, rawText)
    throw new Error('Malformed grading response')
  }
  const graded = parsed as { score?: unknown; feedback?: unknown }
  if (typeof graded.score !== 'number' || graded.score < 1 || graded.score > 5 || typeof graded.feedback !== 'string') {
    console.error(`[open-grading] wrong-shape response for topic "${topic}":`, rawText)
    throw new Error('Malformed grading response')
  }
  return { score: graded.score, feedback: graded.feedback }
}
