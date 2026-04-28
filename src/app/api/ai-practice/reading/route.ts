import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface AIReadingQuestion {
  passage: string
  question: string
  options: [string, string, string, string]
  correct_index: number
  explanation: string
}

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'משפט אחד פשוט מאוד. שאלות בסיסיות: מי, מה, איפה, מתי. אוצר מילים: בית, בית ספר, אוכל, ילד, ללכת, ישן, קורא, יום, לילה.',
  2: 'שניים–שלושה משפטים. שאלות על סיבה (למה) או רצף זמן (מתי, לפני, אחרי). אוצר מילים: יומיומי, פשוט.',
  3: 'שניים–שלושה משפטים עם ניגוד (למרות ש, אבל) או סיבה מורכבת. שאלות על מסקנה או כוונה.',
  4: 'פסקה של 4–5 משפטים בנושא מידעי (תחבורה, בריאות, כלכלה בסיסית). שאלה אחת על הרעיון המרכזי.',
  5: 'פסקה ארוכה יותר (5–7 משפטים) בנושא מורכב. שאלה על ניתוח, השוואה, או מסקנה.',
}

export async function POST(req: NextRequest) {
  const { level } = await req.json() as { level: number }
  if (!level || level < 1 || level > 5) {
    return NextResponse.json({ error: 'רמה לא תקינה' }, { status: 400 })
  }

  const prompt = `אתה יוצר שאלות הבנת הנקרא בעברית לתלמידים דרוזים שלומדים עברית כשפה שנייה.

צור שאלת הבנת הנקרא ברמה ${level}.
תיאור הרמה: ${LEVEL_DESCRIPTIONS[level]}

דרישות:
- הטקסט בעברית תקינה ופשוטה (לא מנוקד)
- שאלה ברורה עם תשובה חד-משמעית שנמצאת בטקסט
- 4 אפשרויות תשובה — אחת נכונה, שלוש שגויות אך סבירות
- את correct_index קבע באופן אקראי — לא תמיד 0 ולא תמיד 3 — פזר בין 0, 1, 2, 3
- הסבר קצר מדוע התשובה הנכונה היא הנכונה

החזר JSON בלבד:
{
  "passage": "הטקסט",
  "question": "השאלה?",
  "options": ["אפשרות א", "אפשרות ב", "אפשרות ג", "אפשרות ד"],
  "correct_index": 2,
  "explanation": "הסבר קצר"
}`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
    const question: AIReadingQuestion = JSON.parse(result.response.text())
    return NextResponse.json({ question })
  } catch (err) {
    console.error('AI reading error:', err)
    return NextResponse.json({ error: 'שגיאה ביצירת השאלה' }, { status: 500 })
  }
}
