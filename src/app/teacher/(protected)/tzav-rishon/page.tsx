'use client'

import { useEffect, useState } from 'react'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'

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
  const [tab, setTab] = useState<'topics' | 'students' | 'questions'>('topics')

  async function loadData(topic: string) {
    const res = await fetch(`/api/teacher/tzav-rishon${topic ? `?topic=${topic}` : ''}`)
    if (!res.ok) return
    const data = await res.json()
    setClassName(data.class_name)
    setTopicsSummary(data.topics_summary)
    setStudents(data.students)
    setQuestionStats(data.question_stats)
  }

  useEffect(() => {
    if (!email) return
    async function init() {
      const topicsRes = await fetch('/api/tzav-rishon/topics').then(r => r.json())
      setAllTopics(topicsRes.topics || [])
      await loadData('')
      setLoading(false)
    }
    init()
  }, [email])

  async function handleTopicSelect(topic: string) {
    setSelectedTopic(topic)
    setLoading(true)
    await loadData(topic)
    setLoading(false)
    if (topic) setTab('questions')
  }

  const scoreColor = (v: number | null) => {
    if (v === null) return 'text-gray-300'
    return v >= 70 ? 'text-green-600' : v >= 50 ? 'text-yellow-600' : 'text-red-500'
  }

  if (loading) return <LoadingSpinner />

  const filteredStudents = selectedTopic ? students.filter(s => s.topic === selectedTopic) : students
  const selectedTopicLabel = selectedTopic ? allTopics.find(t => t.key === selectedTopic)?.labelHe : null

  return (
    <>
      <h1 className="font-bold text-accent-tzav-rishon mb-1">דוח דפ״ר לצו ראשון</h1>
      <p className="text-xs text-gray-500 mb-5">{className}</p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <label htmlFor="topicFilter" className="text-sm font-medium text-gray-700 block mb-2">סנן לפי נושא:</label>
        <select
          id="topicFilter"
          value={selectedTopic}
          onChange={e => handleTopicSelect(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-right bg-white focus:outline-none focus:ring-2 focus:ring-accent-tzav-rishon"
        >
          <option value="">כל הנושאים</option>
          {allTopics.map(t => (
            <option key={t.key} value={t.key}>{t.labelHe}</option>
          ))}
        </select>
        {selectedTopicLabel && (
          <p className="text-xs text-accent-tzav-rishon mt-1">{filteredStudents.length} תלמידים ענו ב{selectedTopicLabel}</p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('topics')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'topics' ? 'bg-accent-tzav-rishon text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          סיכום נושאים
        </button>
        <button onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'students' ? 'bg-accent-tzav-rishon text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          לפי תלמיד ({filteredStudents.length})
        </button>
        {selectedTopic && (
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'questions' ? 'bg-accent-tzav-rishon text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            ניתוח שאלות
          </button>
        )}
      </div>

      {tab === 'topics' && (
        topicsSummary.length === 0 ? (
          <p className="text-center text-gray-400 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {topicsSummary.map(t => (
              <button key={t.topic} onClick={() => handleTopicSelect(t.topic)}
                className="w-full text-right bg-white rounded-xl border border-gray-200 p-4 hover:border-accent-tzav-rishon hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-800">{t.topic_label_he}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.attempted_count} תשובות</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(t.avg_pct)}`}>
                      {t.avg_pct !== null ? `${t.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-gray-400">ממוצע</div>
                  </div>
                </div>
                {t.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${t.avg_pct >= 70 ? 'bg-green-500' : t.avg_pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
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
          <p className="text-center text-gray-400 mt-12">אין נתונים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right p-3 font-semibold text-gray-700">תלמיד</th>
                  <th className="p-3 text-right font-semibold text-gray-700">נושא</th>
                  <th className="p-3 text-center font-semibold text-gray-700">ציון</th>
                  <th className="p-3 text-center font-semibold text-gray-700">%</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={`${s.student_id}-${s.topic}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-medium text-gray-800">{s.student_name}</td>
                    <td className="p-3 text-gray-600 text-sm">{s.topic_label_he}</td>
                    <td className="p-3 text-center font-semibold text-gray-800">{s.correct_count}/{s.total_answered}</td>
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
          <p className="text-center text-gray-400 mt-12">אין נתוני שאלות עדיין</p>
        ) : (
          <div className="space-y-3">
            {questionStats.map(q => (
              <div key={q.question_id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-semibold text-gray-800">שאלה {q.question_id}</span>
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full mr-2">תשובה נכונה: {q.correct_answer}</span>
                  </div>
                  <div className={`text-2xl font-bold ${scoreColor(q.success_pct)}`}>
                    {q.success_pct !== null ? `${q.success_pct}%` : '—'}
                    <span className="text-xs text-gray-400 block text-center">{q.correct_count}/{q.total_answers}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[1, 2, 3, 4].map(opt => {
                    const count = q.distribution[opt] || 0
                    const pct = q.total_answers > 0 ? Math.round((count / q.total_answers) * 100) : 0
                    const isCorrect = opt === q.correct_answer
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{opt}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div className={`h-4 rounded-full transition-all ${isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-300' : 'bg-gray-200'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs w-16 text-left ${isCorrect ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
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
