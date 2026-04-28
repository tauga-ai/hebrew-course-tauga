import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface AIWordItem { text: string; starred: boolean }
export interface AIWordList { theme: string; words: AIWordItem[] }

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'אוצר מילים יומיומי בסיסי מאוד: בית, משפחה, אוכל, בית ספר, חברים, ללכת, לאכול, לישון, בוקר, ערב.',
  2: 'אוצר מילים יומיומי מורכב יותר: עבודה, אוטובוס, רישיון, לנסוע, לקנות, חנות, כסף, בריאות, לשתות, לרוץ.',
  3: 'נושאים מגוונים: ספורט, מוזיקה, טיול, אינטרנט, לשחק, לשמוע, טבע, להתאמן, ספרייה, ללמוד.',
  4: 'אוצר מילים מתקדם: טכנולוגיה, להשפיע, מדיניות, תהליך, מערכת, נתונים, תוצאה, גורם, שינוי, ניתוח.',
  5: 'מושגים אקדמיים/מורכבים: השוואה, להסיק, מסקנה, אמינות, תוקף, הסתברות, אינטגרציה, מורכבות, ביצועים, פרשנות.',
}

export async function POST(req: NextRequest) {
  const { level } = await req.json() as { level: number }
  if (!level || level < 1 || level > 5) {
    return NextResponse.json({ error: 'רמה לא תקינה' }, { status: 400 })
  }

  const prompt = `אתה יוצר תרגילי בניית משפטים בעברית לתלמידים דרוזים שלומדים עברית כשפה שנייה.

צור רשימת מילים לתרגיל ברמה ${level}.
תיאור הרמה: ${LEVEL_DESCRIPTIONS[level]}

דרישות:
- בדיוק 12 מילים/ביטויים בעברית
- בדיוק 2 או 3 מילים מסומנות כ starred: true (מילים חיוניות שחייבים להשתמש בהן)
- המילים המסומנות צריכות לאפשר בניית משפט בעל משמעות
- לכלול: פעלים (בצורת שם פועל: ללמוד, לאכול...), שמות עצם, תארים, מילות זמן, מחברים
- כל המילים בעברית
- נושא מגוון שונה מהקודמים

החזר JSON בלבד:
{
  "theme": "נושא כללי של 2-3 מילים",
  "words": [
    {"text": "ללמוד", "starred": true},
    {"text": "חברים", "starred": true},
    {"text": "בית ספר", "starred": false},
    {"text": "היום", "starred": false},
    {"text": "אוהב", "starred": false},
    {"text": "מחר", "starred": false},
    {"text": "ספר", "starred": false},
    {"text": "מורה", "starred": false},
    {"text": "ללכת", "starred": false},
    {"text": "שיעור", "starred": false},
    {"text": "יחד", "starred": false},
    {"text": "רוצה", "starred": false}
  ]
}`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    const wordList: AIWordList = JSON.parse(result.response.text())
    return NextResponse.json({ wordList })
  } catch (err) {
    console.error('AI sentence words error:', err)
    return NextResponse.json({ error: 'שגיאה ביצירת התרגיל' }, { status: 500 })
  }
}
