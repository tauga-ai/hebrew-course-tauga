import 'server-only'
import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from '@google/generative-ai'
import { isRetryableGeminiError } from './gemini-retry'
import { parseSessionSummary, type SessionRanking, type SessionSummary } from './session-summary'

const SUMMARY_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary_text: { type: SchemaType.STRING },
    ui_icon: { type: SchemaType.STRING },
  },
  required: ['summary_text', 'ui_icon'],
}

const REQUEST_TIMEOUT_MS = 15_000
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Noam's prompt, copied verbatim from
// .claude/resources/Developer_Instructions_Session_Summary_Clean.md section 3,
// which carries an explicit "do not edit, reformat, or re-translate" marker.
// The tone bands, the gender-neutral phrasing rule and the "never state the
// percentage as a number" rule are product decisions he owns — if this needs
// to change, it changes in his doc first.
//
// Unlike open-grading.ts, systemInstruction here is a convention choice
// rather than a security boundary: every interpolated value is
// server-computed (a percentage, and topic names from the fixed question
// bank), so there is no untrusted student text to isolate from the rules.
const SESSION_SUMMARY_PROMPT = `תפקיד ומשימה: אתה מנטור ומורה דרך תומך המסייע לעולים חדשים שלומדים עברית. המשתמש כרגע סיים סשן תרגול המורכב ממספר נושאים. המשימה שלך היא לכתוב לו הודעת סיכום קצרה (2-3 משפטים בלבד) המותאמת אישית לביצועים שלו.
נתוני הסשן של המשתמש:
1. אחוז הצלחה כללי: {SESSION_SCORE_PERCENTAGE}%
2. הנושאים שבהם הוא הצטיין (או שבהם הלך לו הכי טוב ביחס לשאר): {STRONG_TOPICS}
3. הנושאים שבהם הוא התקשה וצריך להשתפר: {WEAK_TOPICS}
לוגיקת הכתיבה:
- אם אחוז ההצלחה גבוה (מעל 70%): פתח בברכת כל הכבוד נלהבת. לאחר מכן, ציין שעדיין יש מקום לחידוד בנושאים החלשים ({WEAK_TOPICS}) כדי להגיע לשלמות (אלא אם הרשימה ריקה).
- אם אחוז ההצלחה נמוך (מתחת ל-50%): פתח במסר מעודד ואמפתי (למשל: "למידת שפה היא תהליך שלוקח זמן..."). ציין לטובה את הנושאים שבהם הוא כן הצליח או השקיע מאמץ ({STRONG_TOPICS}), וכוון אותו בעדינות למקד את התרגול הבא בנושאים שדורשים חיזוק ({WEAK_TOPICS}).
- אם אחוז ההצלחה בינוני: הצג תמונה מאוזנת – שבח על החוזקות וציון ברור של החולשות להמשך תרגול.
- מקרה קצה (רשימות ריקות): אם משתני החוזקות והחולשות ריקים (כלומר כל הציונים היו זהים), תן סיכום כללי לפי אחוז ההצלחה מבלי לציין נושאים ספציפיים.
דגשים חשובים:
- השתמש בעברית פשוטה, ברורה ומעודדת (מותאמת לעולים חדשים).
- אל תציין את אחוז ההצלחה במספרים בתוך הטקסט (המשתמש כבר רואה את הציון שלו במסך). הנתונים נועדו רק כדי לכוון את הטון שלך.
- הטקסט חייב להיות בגוף שני (אתה/את - השתמש בניסוחים ניטרליים מגדרית היכן שאפשר, למשל: "איזה יופי של עבודה", "יש לך יכולת טובה ב...").
פורמט הפלט (JSON בלבד):
{
  "summary_text": "<The 2-3 sentences of the personalized summary>",
  "ui_icon": "<A single emoji representing the session mood, e.g., 🌟, 💪, 📈>"
}`

function buildSystemInstruction(r: SessionRanking): string {
  // An empty list is passed through as an empty string on purpose: the prompt
  // has its own documented edge case for that ("if the strengths and
  // weaknesses variables are empty, give a general summary"), so substituting
  // a placeholder like "none" would actively defeat it.
  const list = (names: string[]) => names.join(', ')
  return SESSION_SUMMARY_PROMPT
    .replaceAll('{SESSION_SCORE_PERCENTAGE}', String(r.score_pct))
    .replaceAll('{STRONG_TOPICS}', list(r.strong))
    .replaceAll('{WEAK_TOPICS}', list(r.weak))
}

/**
 * Generates Noam's 2-3 sentence end-of-session note.
 *
 * Throws on a provider error or a malformed reply — the caller is responsible
 * for falling back to SESSION_SUMMARY_FALLBACK, the same contract
 * gradeOpenAnswer() has with the answer routes.
 */
export async function generateSessionSummary(r: SessionRanking): Promise<SessionSummary> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel(
    {
      model: 'gemini-2.5-flash',
      // 0.4 per the spec - deliberately warmer than grading's 0.2, for a
      // natural conversational tone rather than a reproducible score.
      generationConfig: { temperature: 0.4 },
      systemInstruction: buildSystemInstruction(r),
    },
    { timeout: REQUEST_TIMEOUT_MS }
  )

  let result: Awaited<ReturnType<typeof model.generateContent>> | undefined
  for (let attempt = 1; !result; attempt++) {
    try {
      // The instruction block already carries every input. The user turn is
      // just the trigger - keeping Noam's prompt intact as one verbatim unit
      // matters more than splitting it across roles for its own sake.
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'צור את הודעת הסיכום.' }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SUMMARY_SCHEMA },
      })
    } catch (err) {
      const retryable = isRetryableGeminiError(err)
      if (attempt >= MAX_ATTEMPTS || !retryable) {
        console.error(`[session-summary] call failed (attempt ${attempt}/${MAX_ATTEMPTS}, ${retryable ? 'retries exhausted' : 'non-retryable'}):`, err)
        throw err
      }
      console.error(`[session-summary] transient error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying:`, err)
      await sleep(RETRY_DELAY_MS)
    }
  }

  // Captured before parsing so the raw text is logged either way a malformed
  // reply can happen - same reasoning as open-grading.ts.
  const rawText = result.response.text().trim()
  try {
    return parseSessionSummary(rawText)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`[session-summary] malformed response (${reason}):`, rawText)
    throw err
  }
}
