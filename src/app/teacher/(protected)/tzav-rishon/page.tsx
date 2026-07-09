'use client'

import { useEffect, useState } from 'react'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'

interface TopicSummary { topic: string; topic_label_he: string; attempted_count: number; avg_pct: number | null }
interface StudentSummary {
  student_id: string; student_name: string; topic: string; topic_label_he: string
  correct_count: number; total_answered: number; pct: number
}
interface QuestionStat {
  question_id: number; correct_answer: number; total_answers: number
  correct_count: number; success_pct: number | null; distribution: Record<string, number>
}
interface TopicMeta { key: string; labelHe: string; labelAr: string; count: number }

export default function TzavRishonTeacherPage() {
  const { email } = useTeacherAuth()
  const [className, setClassName] = useState('')
  const [allTopics, setAllTopics] = useState<TopicMeta[]>([])
  const [topicsSummary, setTopicsSummary] = useState<TopicSummary[]>([])
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [selectedTopic, setSelectedTopic] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [tab, setTab] = useState<'topics' | 'students' | 'questions'>('topics')

  async function loadData(topic: string) {
    const res = await fetch(`/api/teacher/tzav-rishon${topic ? `?topic=${topic}` : ''}`)
    if (!res.ok) throw new Error('load failed')
    const data = await res.json()
    setClassName(data.class_name)
    setTopicsSummary(data.topics_summary)
    setStudents(data.students)
    setQuestionStats(data.question_stats)
  }

  useEffect(() => {
    if (!email) return
    async function init() {
      try {
        const topicsRes = await fetch('/api/tzav-rishon/topics')
        if (!topicsRes.ok) throw new Error('load failed')
        const topicsData = await topicsRes.json()
        setAllTopics(topicsData.topics || [])
        await loadData('')
      } catch {
        setError('שגיאה בטעינת הדוח. בדוק חיבור לאינטרנט ונסה שוב.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [email, retryToken])

  async function handleTopicSelect(topic: string) {
    setSelectedTopic(topic)
    setLoading(true)
    setError('')
    try {
      await loadData(topic)
      if (topic) setTab('questions')
    } catch {
      setError('שגיאה בטעינת הדוח. בדוק חיבור לאינטרנט ונסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  const barColor = (v: number | null) => scoreColor(v, { palette: { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' } })

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 text-center mt-12">
      <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      <button onClick={() => { setError(''); setRetryToken(t => t + 1) }} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">נסה שוב</button>
    </div>
  )

  if (loading) return <LoadingSpinner />

  const filteredStudents = selectedTopic ? students.filter(s => s.topic === selectedTopic) : students
  const selectedTopicLabel = selectedTopic ? allTopics.find(t => t.key === selectedTopic)?.labelHe : null

  return (
    <>
      <h1 className="font-bold text-accent-tzav-rishon-fg mb-1">דוח דפ״ר לצו ראשון</h1>
      <p className="text-xs text-fg/60 mb-5">{className}</p>

      <div className="bg-surface rounded-xl border border-card-border p-4 mb-4">
        <label htmlFor="topicFilter" className="text-sm font-medium text-fg/80 block mb-2">סנן לפי נושא:</label>
        <select
          id="topicFilter"
          value={selectedTopic}
          onChange={e => handleTopicSelect(e.target.value)}
          className="w-full border border-card-border rounded-lg px-3 py-2 text-right bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-tzav-rishon"
        >
          <option value="">כל הנושאים</option>
          {allTopics.map(t => (
            <option key={t.key} value={t.key}>{t.labelHe}</option>
          ))}
        </select>
        {selectedTopicLabel && (
          <p className="text-xs text-accent-tzav-rishon-fg mt-1">{filteredStudents.length} תלמידים ענו ב{selectedTopicLabel}</p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('topics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'topics' ? 'bg-accent-tzav-rishon text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          סיכום נושאים
        </button>
        <button onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'students' ? 'bg-accent-tzav-rishon text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          לפי תלמיד ({filteredStudents.length})
        </button>
        {selectedTopic && (
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'questions' ? 'bg-accent-tzav-rishon text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
            ניתוח שאלות
          </button>
        )}
      </div>

      {tab === 'topics' && (
        topicsSummary.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {topicsSummary.map(t => (
              <button key={t.topic} onClick={() => handleTopicSelect(t.topic)}
                className="w-full text-right bg-surface rounded-xl border border-card-border p-4 hover:border-accent-tzav-rishon hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-fg">{t.topic_label_he}</div>
                    <div className="text-xs text-fg/60 mt-0.5">{t.attempted_count} תשובות</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(t.avg_pct)}`}>
                      {t.avg_pct !== null ? `${t.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-fg/40">ממוצע</div>
                  </div>
                </div>
                {t.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${barColor(t.avg_pct)}`}
                      style={{ width: `${t.avg_pct}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'students' && (
        filteredStudents.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface rounded-xl border border-card-border text-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                  <th className="text-right p-3 font-semibold text-fg/80">תלמיד</th>
                  <th className="p-3 text-right font-semibold text-fg/80">נושא</th>
                  <th className="p-3 text-center font-semibold text-fg/80">ציון</th>
                  <th className="p-3 text-center font-semibold text-fg/80">%</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={`${s.student_id}-${s.topic}`} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                    <td className="p-3 font-medium text-fg">{s.student_name}</td>
                    <td className="p-3 text-fg/70 text-sm">{s.topic_label_he}</td>
                    <td className="p-3 text-center font-semibold text-fg">{s.correct_count}/{s.total_answered}</td>
                    <td className={`p-3 text-center font-bold ${scoreColor(s.pct)}`}>{s.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'questions' && selectedTopic && (
        questionStats.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתוני שאלות עדיין</p>
        ) : (
          <div className="space-y-3">
            {questionStats.map(q => (
              <div key={q.question_id} className="bg-surface rounded-xl border border-card-border p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-semibold text-fg">שאלה {q.question_id}</span>
                    <span className="text-xs text-green-700 bg-green-100 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full mr-2">תשובה נכונה: {q.correct_answer}</span>
                  </div>
                  <div className={`text-2xl font-bold ${scoreColor(q.success_pct)}`}>
                    {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                    <span className="text-xs text-fg/40 block text-center">{q.correct_count}/{q.total_answers}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map(opt => {
                    const count = q.distribution[opt] || 0
                    const pct = q.total_answers > 0 ? Math.round((count / q.total_answers) * 100) : 0
                    const isCorrect = opt === q.correct_answer
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-fg/60'}`}>{opt}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-white/10 rounded-full h-4 overflow-hidden">
                          <div className={`h-4 rounded-full transition-all ${isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-300' : 'bg-gray-200 dark:bg-white/10'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs w-16 text-left ${isCorrect ? 'text-green-700 dark:text-green-400 font-semibold' : 'text-fg/60'}`}>
                          {count} ({pct}%) {isCorrect ? '✓' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  )
}
