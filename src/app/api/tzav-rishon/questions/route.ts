import { NextRequest, NextResponse } from 'next/server'
import { getTopicQuestions } from '@/lib/tzav-rishon'

/**
 * Public content — no student identity needed (same as /api/practice-sets).
 * `correctOption` is stripped before responding: defense in depth, since the
 * real trust boundary is server-side grading on submit, not this route.
 */
export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return NextResponse.json({ error: 'missing topic' }, { status: 400 })

  const questions = getTopicQuestions(topic)
  if (!questions) return NextResponse.json({ error: 'unknown topic' }, { status: 404 })

  const withoutAnswers = questions.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options,
  }))
  return NextResponse.json({ questions: withoutAnswers })
}
