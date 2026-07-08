'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Segments } from '@/components/tzav-rishon/Segments'
import { QuestionMap } from '@/components/tzav-rishon/QuestionMap'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { useLanguage } from '@/components/tzav-rishon/LanguageContext'
import type { Segment } from '@/data/tzav-rishon/types'

interface QuestionOut {
  id: number
  question: { he: Segment[]; ar: Segment[] }
  options: { he: Segment[]; ar: Segment[] }[]
}

interface ProgressEntry {
  question_id: number
  selected_option: number
  is_correct: boolean
  correct_option: number | null
  explanation: { he: Segment[]; ar: Segment[] } | null
}

interface TopicMeta {
  key: string
  labelHe: string
  labelAr: string
  count: number
}

export default function TzavRishonPracticePage() {
  const params = useParams()
  const router = useRouter()
  const topic = String(params.topic)
  const { session, loading: sessionLoading } = useStudentSession()
  const { language, setLanguage } = useLanguage()

  const [questions, setQuestions] = useState<QuestionOut[] | null>(null)
  const [topicMeta, setTopicMeta] = useState<TopicMeta | null>(null)
  const [progress, setProgress] = useState<Record<number, ProgressEntry>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Adjusting state when a prop changes (React's recommended pattern for
  // this — https://react.dev/learn/you-might-not-need-an-effect) rather
  // than resetting inside the effect below: keeps stale percentages-topic
  // data from ever being shown, mislabeled, while averages is loading.
  const [loadedForTopic, setLoadedForTopic] = useState(topic)
  if (topic !== loadedForTopic) {
    setLoadedForTopic(topic)
    setQuestions(null)
    setProgress({})
    setError('')
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function load() {
      const [qRes, pRes, tRes] = await Promise.all([
        fetch(`/api/tzav-rishon/questions?topic=${topic}`).then(r => r.json()),
        fetch(`/api/tzav-rishon/progress?topic=${topic}`).then(r => r.json()),
        fetch('/api/tzav-rishon/topics').then(r => r.json()),
      ])
      if (cancelled) return
      if (!qRes.questions) { router.replace('/tzav-rishon'); return }

      const map: Record<number, ProgressEntry> = {}
      for (const p of pRes.progress || []) map[p.question_id] = p

      const loaded: QuestionOut[] = qRes.questions
      const firstUnanswered = loaded.findIndex(q => !(q.id in map))
      setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered)

      setQuestions(loaded)
      setProgress(map)
      setTopicMeta((tRes.topics || []).find((t: TopicMeta) => t.key === topic) || null)
    }
    load()
    return () => { cancelled = true }
  }, [session, topic, router])

  if (sessionLoading || questions === null || topicMeta === null) return <LoadingSpinner />

  const isAr = language === 'ar'
  const current = questions[currentIndex]
  const answered = progress[current.id]
  const total = questions.length
  const answeredCount = Object.keys(progress).length

  async function selectOption(optionNum: number) {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/tzav-rishon/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, question_id: current.id, selected_option: optionNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      setProgress(prev => ({
        ...prev,
        [current.id]: {
          question_id: current.id,
          selected_option: optionNum,
          is_correct: data.is_correct,
          correct_option: data.correct_option,
          explanation: data.explanation,
        },
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isAr ? 'خطأ في الإرسال' : 'שגיאה בשליחה'))
    } finally {
      setSubmitting(false)
    }
  }

  const resultsByQuestion = Object.fromEntries(
    Object.entries(progress).map(([qid, p]) => [qid, p.is_correct])
  )

  return (
    <div lang={isAr ? 'ar' : 'he'} className="min-h-screen p-4 max-w-2xl mx-auto">
      <PageHeader
        backHref="/tzav-rishon"
        title={isAr ? topicMeta.labelAr : topicMeta.labelHe}
        titleColorClass="text-accent-tzav-rishon"
        right={<LtrIsolate>{`${answeredCount}/${total}`}</LtrIsolate>}
      />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setLanguage('he')}
          className={`py-1.5 rounded-lg text-sm font-semibold border transition ${
            language === 'he'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-white text-gray-700 border-gray-300 hover:border-accent-tzav-rishon'
          }`}
        >
          עברית
        </button>
        <button
          onClick={() => setLanguage('ar')}
          className={`py-1.5 rounded-lg text-sm font-semibold border transition ${
            language === 'ar'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-white text-gray-700 border-gray-300 hover:border-accent-tzav-rishon'
          }`}
        >
          العربية
        </button>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-accent-tzav-rishon h-2 rounded-full transition-all"
          style={{ width: `${(answeredCount / total) * 100}%` }}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="text-xs text-gray-400 mb-3">
          {isAr ? 'السؤال' : 'שאלה'} <LtrIsolate>{`${currentIndex + 1} / ${total}`}</LtrIsolate>
        </div>
        <p className="text-gray-800 leading-relaxed text-base">
          <Segments segments={current.question[language]} />
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {current.options.map((opt, i) => {
          const optionNum = i + 1
          const isSelected = answered?.selected_option === optionNum
          const isTheCorrectOne = answered && answered.correct_option === optionNum
          let stateClass = 'bg-white border-gray-200 hover:border-accent-tzav-rishon text-gray-800'
          if (answered) {
            if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800'
            else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800'
            else stateClass = 'bg-white border-gray-200 text-gray-500'
          }
          return (
            <button
              key={i}
              onClick={() => !answered && selectOption(optionNum)}
              disabled={!!answered || submitting}
              className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
            >
              <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100">
                {optionNum}
              </span>
              <span><Segments segments={opt[language]} /></span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      {answered && (
        <div className={`rounded-2xl p-4 mb-4 border ${answered.is_correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`font-bold mb-2 ${answered.is_correct ? 'text-green-700' : 'text-red-700'}`}>
            {answered.is_correct
              ? (isAr ? 'إجابة صحيحة!' : 'תשובה נכונה!')
              : (isAr ? 'إجابة غير صحيحة' : 'תשובה לא נכונה')}
          </div>
          {answered.explanation && (
            <div className="text-sm text-gray-700 leading-relaxed">
              <Segments segments={answered.explanation[language]} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          {isAr ? '← السابق' : '← הקודמת'}
        </button>
        <button
          onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          {isAr ? 'التالي →' : 'הבאה →'}
        </button>
      </div>

      <QuestionMap count={total} currentIndex={currentIndex} results={resultsByQuestion} onJump={setCurrentIndex} />
    </div>
  )
}
