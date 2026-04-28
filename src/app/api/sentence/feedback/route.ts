import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface SentenceFeedback {
  used_all_starred: boolean
  missing_starred: string[]
  words_used_count: number
  score: number
  feedback: string
  improved_sentence: string
  improvement_note: string
}

export async function POST(req: NextRequest) {
  const { sentence, starred_words, all_words } = await req.json() as {
    sentence: string
    starred_words: string[]
    all_words: string[]
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

כללי ניקוד (הסבר לתלמיד מה השפיע על הציון):
- משתמש בכל מילות החובה + 6+ מילים + דקדוק תקין = 9-10
- משתמש בכל מילות החובה + 6+ מילים + שגיאות קלות = 7-8
- משתמש בכל מילות החובה + פחות מ-6 מילים = מקסימום 6
- חסרה מילת חובה = מקסימום 5
- אל תוריד נקודות על פסיקים חסרים — התלמיד עשוי להכתיב בעל-פה
- אל תוריד נקודות על שגיאות כתיב קלות (ניקוד, אות כפולה)

פידבק:
- היה מעודד ואוהד
- אם הציון נמוך מ-10 — הסבר בדיוק מה גרם לכך (מילה חסרה? פחות מ-6 מילים? שגיאה דקדוקית מה?)
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

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    const text = result.response.text().trim()
    const feedback: SentenceFeedback = JSON.parse(text)
    return NextResponse.json({ feedback })
  } catch (err) {
    console.error('Gemini sentence error:', err)
    return NextResponse.json({ error: 'שגיאה בעיבוד' }, { status: 500 })
  }
}
