import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface OpenGradingBuilder {
  /** Builds this topic's fixed system prompt (Noam's verbatim text, never
   *  edited/reformatted/re-translated) with this question's main text
   *  (`prompt` — the opening line / paragraph / task, whichever column each
   *  topic's sheet reader chose as its natural upsert key), its other
   *  `fields`, and the student's text all substituted in. */
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
תהליך ההערכה (flow) שעליך לבצע ברקע:
שלב 1 - בדיקת תוכן: האם ההמשך הגיוני, מתייחס לפתיח של הסיפור ותואם אותו.
שלב 2 - בדיקת מילת חובה: האם המשתמש השתמש נכון במילת החובה.
שלב 3 - ניתוח דקדוקי: בדיקת תקינות תחבירית, זכר/נקבה, יחיד/רבים ואיות.
סולם הניקוד המוחלט (מ-1 עד 5):
1 - רמה שגויה לחלוטין: תשובה לא קשורה כלל לפתיח של הסיפור, טקסט לא מובן, ג'יבריש או תשובה ריקה.
2 - רמה נמוכה: הטקסט בקושי קריא, מלא בשגיאות דקדוקיות קשות, או שההמשך לא קשור כלל לפתיח.
3 - רמה בינונית: ההמשך יחסית מובן, אך יש שגיאות דקדוקיות בולטות, ו/או אין שימוש במילת החובה.
4 - רמה טובה: תשובה טובה מאוד אך עם פגם אחד - או שיש שגיאות כתיב/דקדוק קלות, או שהטקסט ללא שגיאות אך המשתמש שכח להשתמש במילת החובה.
5 - רמה מצוינת: תשובה מושלמת. המשך הגיוני לסיפור, דקדוק נכון וללא שגיאות כתיב, ושימוש תקין במילת החובה.
פורמט הפלט המבוקש (חובה):
עליך להחזיר את התוצאה בפורמט JSON טהור ותקני בלבד. אל תוסיף שום טקסט מקדים, ללא הסברים וללא בלוקים של קוד (ללא \`\`\`json). מבנה ה-JSON חייב להיות:
{ "score": <number between 1-5>, "feedback": "<short constructive feedback in simple Hebrew>"}`,
}

export function publicFields(topic: string, fields: Record<string, string>): Record<string, string> {
  const builder = OPEN_GRADING_BUILDERS[topic]
  if (!builder) return {}
  return Object.fromEntries(
    builder.publicFieldKeys.map(k => [k, fields[k]]).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

export interface GradedResult { score: number; feedback: string }

/** Throws on a missing registration, a provider error, or a malformed reply
 *  — callers (the answer routes) are responsible for catching this and
 *  falling back to a generic message, same pattern as sentence/feedback's
 *  try/catch around its Gemini call. */
export async function gradeOpenAnswer(topic: string, prompt: string, fields: Record<string, string>, userText: string): Promise<GradedResult> {
  const builder = OPEN_GRADING_BUILDERS[topic]
  if (!builder) throw new Error(`No grading prompt registered for topic: ${topic}`)

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0.2 } })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: builder.buildPrompt(prompt, fields, userText) }] }],
    generationConfig: { responseMimeType: 'application/json' },
  })

  const parsed = JSON.parse(result.response.text().trim())
  if (typeof parsed.score !== 'number' || parsed.score < 1 || parsed.score > 5 || typeof parsed.feedback !== 'string') {
    throw new Error('Malformed grading response')
  }
  return { score: parsed.score, feedback: parsed.feedback }
}
