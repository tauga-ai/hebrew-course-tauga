import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export interface InterviewFeedback {
  score: number
  level: string
  summary: string
  strengths: string[]
  improvements: string[]
  corrections: { original: string; corrected: string; explanation: string }[]
  tips: string[]
}

export async function POST(req: NextRequest) {
  const { student_name, qa_pairs } = await req.json() as {
    student_name: string
    qa_pairs: { question: string; answer: string }[]
  }

  const qaText = qa_pairs
    .map((qa, i) => `שאלה ${i + 1}: ${qa.question}\nתשובה: ${qa.answer || '(לא ענה)'}`)
    .join('\n\n')

  const prompt = `אתה מראיין מקצועי בתוכנית ניצנים — תוכנית ללימוד עברית לחיילים לפני השירות הצבאי.
שמך של המרואיין: ${student_name}

הנה שאלות הראיון ותשובות הסטודנט:

${qaText}

הערך את הראיון. תן תשובה רק בפורמט JSON (בלי markdown, בלי \`\`\`):
{
  "score": <מספר 0-100>,
  "level": "<אחד מ: מצוין | טוב מאוד | טוב | בינוני | צריך שיפור>",
  "summary": "<סיכום של 2-3 משפטים על ביצועי הסטודנט>",
  "strengths": ["<נקודת חוזק 1>", "<נקודת חוזק 2>", "<נקודת חוזק 3>"],
  "improvements": ["<נקודה לשיפור 1>", "<נקודה לשיפור 2>", "<נקודה לשיפור 3>"],
  "corrections": [
    {"original": "<מה שנאמר לא נכון>", "corrected": "<הגרסה הנכונה>", "explanation": "<הסבר קצר>"}
  ],
  "tips": ["<טיפ מעשי 1>", "<טיפ מעשי 2>", "<טיפ מעשי 3>"]
}

הנחיות:
- אם תשובה ריקה — ציין בנקודות לשיפור
- תקן שגיאות עברית ספציפיות בmassage corrections
- היה מעודד אך כן
- הכל בעברית`

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Strip any accidental markdown fences
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const feedback: InterviewFeedback = JSON.parse(clean)

    return NextResponse.json({ feedback })
  } catch (err) {
    console.error('Gemini error:', err)
    return NextResponse.json({ error: 'שגיאה בעיבוד הפידבק' }, { status: 500 })
  }
}
