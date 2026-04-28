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

  const prompt = `אתה מורה לשפה העברית. התלמיד הוא דרוזי ועברית אינה שפת אמו.

משימת התלמיד: לבנות משפט בעברית שמשתמש בלפחות 6 מילים מהרשימה, כולל חובה בכל המילים המסומנות בכוכב.

מילים חובה (מסומנות בכוכב): ${starredList}
כל המילים הזמינות: ${allList}

המשפט שכתב התלמיד: "${sentence}"

הוראות הערכה:
1. בדוק האם כל המילים החובה נמצאות במשפט (חיפוש גמיש — קבל צורות שונות של אותה מילה, למשל "ללמוד"/"לומד"/"למד")
2. ספור כמה מילים מהרשימה שימש בסה"כ
3. תן ציון מ-1 עד 10:
   - אם חסרה מילת חובה: מקסימום 5
   - אם פחות מ-6 מילים: מקסימום 6
   - ציין על תקינות דקדוקית, בהירות, ומידת השימוש במילים
4. פידבק: היה מעודד ואוהד. הצבע רק על שגיאות ברורות ומשמעותיות (לא כל פרט קטן)
5. שפר את המשפט: שמור על רעיון התלמיד אך תקן שגיאות ודקדוק. אם המשפט כבר טוב — שפר קלות את הניסוח

חשוב מאוד: לפני שתחזיר את הגרסה המשופרת — בדוק שוב שהיא נכונה לחלוטין מבחינה דקדוקית!
אם אתה לא בטוח לגבי תיקון מסוים — אל תתקן אותו.

החזר JSON בלבד (ללא \`\`\` ובלי טקסט נוסף):
{
  "used_all_starred": true,
  "missing_starred": [],
  "words_used_count": 7,
  "score": 8,
  "feedback": "פידבק קצר ומעודד בעברית (2-3 משפטים)",
  "improved_sentence": "גרסה משופרת של המשפט",
  "improvement_note": "הסבר קצר מה שיפרת ולמה (משפט אחד)"
}`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const feedback: SentenceFeedback = JSON.parse(clean)
    return NextResponse.json({ feedback })
  } catch (err) {
    console.error('Gemini sentence error:', err)
    return NextResponse.json({ error: 'שגיאה בעיבוד' }, { status: 500 })
  }
}
