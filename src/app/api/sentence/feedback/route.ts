import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getStudentFromSession } from '@/lib/auth'
import { checkAiRateLimit } from '@/lib/ai-rate-limit'

export interface SentenceFeedback {
  used_all_starred: boolean
  missing_starred: string[]
  words_used_count: number
  score: number
  feedback: string
  improved_sentence: string
  improvement_note: string
  /** Whether improved_sentence is a genuinely better, judge-verified rewrite — false means the student's own sentence was already fine and improved_sentence was reset to match it. */
  improved_sentence_changed: boolean
}

interface JudgeVerdict {
  verdict: 'improved_is_better' | 'original_is_fine' | 'tie'
  reason: string
}

/** Loose equality for "is this actually a different sentence" — ignores whitespace/punctuation-only diffs. */
function normalizeSentence(s: string): string {
  return s.trim().replace(/[.,!?;:״"'׳]/g, '').replace(/\s+/g, ' ')
}

export async function POST(req: NextRequest) {
  const session = await getStudentFromSession()
  if (session.status !== 'ok') {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!(await checkAiRateLimit(session.student.id, 'sentence/feedback')).ok) {
    return NextResponse.json({ error: 'יותר מדי בקשות, נסה שוב בעוד כמה דקות' }, { status: 429 })
  }

  let sentence: string, starred_words: string[], all_words: string[]
  try {
    ({ sentence, starred_words, all_words } = await req.json())
  } catch {
    return NextResponse.json({ error: 'גוף בקשה לא תקין' }, { status: 400 })
  }

  if (!sentence?.trim()) {
    return NextResponse.json({ error: 'משפט ריק' }, { status: 400 })
  }

  const starredList = starred_words.join(', ')
  const allList = all_words.join(', ')

  const prompt = `אתה מורה מנוסה לשפה העברית. התלמיד הוא דרוזי ועברית אינה שפת אמו.

משימת התלמיד: לבנות משפט בעברית שמשתמש בלפחות 6 מילים מהרשימה, כולל חובה בכל המילים המסומנות בכוכב.

מילים חובה (מסומנות בכוכב): ${starredList}
כל המילים הזמינות: ${allList}

המשפט שכתב התלמיד: "${sentence}"

כללי בדיקת מילים (חשוב מאוד):
- קבל כל צורה דקדוקית של המילה: "חברים" ← מקבל גם "חבריי", "חבר", "חברינו"
- קבל מילה עם כינוי שייכות: "משפחה" ← מקבל גם "משפחתי", "משפחתו"
- קבל פועל בכל זמן/גוף: "ללמוד" ← מקבל גם "לומד", "למד", "ילמד"
- אל תדרוש התאמה מילולית מדויקת

בדיקת קוהרנטיות (חובה לבצע לפני כללי הניקוד):
- קודם כל, בדוק אם המשפט קורא כמשפט אמיתי אחד עם רעיון אחד ברור — לא רצף של ביטויים או משפטי-חלקים שהודבקו זה לזה בלי שום קשר הגיוני ביניהם.
- אם המשפט אינו קוהרנטי — גם אם כל מילות החובה נמצאות בו וגם אם יש בו 6+ מילים — הציון המקסימלי הוא 5-6, לא יותר.
- אם המשפט כן קוהרנטי, המשך לכללי הניקוד הרגילים למטה.

כללי ניקוד (רק כשהמשפט קוהרנטי; הסבר לתלמיד מה השפיע על הציון):
- משתמש בכל מילות החובה + 6+ מילים + דקדוק תקין = 9-10
- משתמש בכל מילות החובה + 6+ מילים + שגיאות קלות = 7-8
- משתמש בכל מילות החובה + פחות מ-6 מילים = מקסימום 6
- חסרה מילת חובה = מקסימום 5
- אל תוריד נקודות על פסיקים חסרים — התלמיד עשוי להכתיב בעל-פה
- אל תוריד נקודות על שגיאות כתיב קלות (ניקוד, אות כפולה)

פידבק:
- היה מעודד ואוהד תמיד — גם כשהציון נמוך בגלל חוסר קוהרנטיות, אל תהיה קשוח או שיפוטי. התלמיד עדיין מתאמן ולומד עברית כשפה שנייה
- אם המשפט אינו קוהרנטי — הסבר בעדינות ובלי לבייש שכדאי לחבר את הרעיונות למשפט אחד ברור, ותן דוגמה קצרה איך אפשר
- אם הציון נמוך מ-10 מסיבה אחרת — הסבר בדיוק מה גרם לכך (מילה חסרה? פחות מ-6 מילים? שגיאה דקדוקית מה?)
- אל תאמר "מצוין" אם הורדת נקודות — תהיה עקבי
- הצבע רק על שגיאות משמעותיות, לא על כל פרט קטן

גרסה מושלמת:
- שמור על רעיון המקורי של התלמיד
- השתמש בדיוק באותן מילות החובה שהתלמיד השתמש בהן (לא תחליפים)
- תקן רק שגיאות דקדוקיות ברורות
- אם המשפט כבר תקין — שפר קלות את הניסוח בלבד
- אל תחליף מילה מהרשימה במילה אחרת שאינה ברשימה

לפני שתחזיר — בדוק שהגרסה המושלמת נכונה דקדוקית ב-100%. אם לא בטוח — אל תתקן.

החזר JSON בלבד:
{
  "used_all_starred": true,
  "missing_starred": [],
  "words_used_count": 7,
  "score": 8,
  "feedback": "פידבק מעודד ומדויק בעברית שמסביר את הציון (2-3 משפטים)",
  "improved_sentence": "גרסה מושלמת של המשפט",
  "improvement_note": "הסבר קצר במה שיניתי ולמה"
}`

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  let feedback: SentenceFeedback
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    const text = result.response.text().trim()
    feedback = JSON.parse(text)
  } catch (err) {
    console.error('Gemini sentence error:', err)
    return NextResponse.json({ error: 'שגיאה בעיבוד' }, { status: 500 })
  }

  // The model that just wrote improved_sentence is biased toward defending its
  // own rewrite, so a second, independent call judges original vs. improved
  // rather than trusting the first call's self-assessment — this is what
  // catches cases where the "correction" was actually a downgrade.
  let improvedSentenceChanged = !(normalizeSentence(feedback.improved_sentence) === normalizeSentence(sentence))
  if (improvedSentenceChanged) {
    const judgePrompt = `אתה בוחן עברית מקצועי ומחמיר. קיבלת משפט שכתב תלמיד דרוזי שלומד עברית כשפה שנייה, וגרסה מתוקנת שהוצעה לו על ידי כלי אחר.

משפט מקורי של התלמיד: "${sentence}"
גרסה מתוקנת שהוצעה: "${feedback.improved_sentence}"
מילים שהיה חובה להשתמש בהן: ${starredList}

המשימה שלך: להכריע בכנות איזה מהמשפטים טוב יותר בפועל — אל תניח שהגרסה ה"מתוקנת" עדיפה רק כי היא סומנה כתיקון. שקול:
- האם המשפט המקורי כבר תקין דקדוקית וטבעי כפי שהוא?
- האם הגרסה המתוקנת מתקנת שגיאה אמיתית, או שהיא רק משנה ניסוח בלי סיבה טובה (מאריכה, מוסיפה מילים גבוהות/לא נחוצות, או נשמעת פחות טבעית)?
- האם הגרסה המתוקנת עדיין משתמשת בדיוק באותן מילות החובה?

אם אינך בטוח שהגרסה המתוקנת עדיפה משמעותית — העדף את המשפט המקורי.

החזר JSON בלבד:
{ "verdict": "improved_is_better", "reason": "הסבר קצר בעברית" }
כאשר verdict הוא אחד מ: "improved_is_better", "original_is_fine", "tie"`

    try {
      const judgeResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: judgePrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      })
      const judgeVerdict: JudgeVerdict = JSON.parse(judgeResult.response.text().trim())
      improvedSentenceChanged = judgeVerdict.verdict === 'improved_is_better'
    } catch (err) {
      console.error('Gemini sentence judge error:', err)
      // Fail safe toward the student's own sentence, same as an unsure judge verdict.
      improvedSentenceChanged = false
    }
  }

  feedback.improved_sentence_changed = improvedSentenceChanged
  if (!improvedSentenceChanged) {
    feedback.improved_sentence = sentence
  }

  return NextResponse.json({ feedback })
}
