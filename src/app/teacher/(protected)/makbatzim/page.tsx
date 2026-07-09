'use client'

import { useEffect, useState } from 'react'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'

interface SetSummary { set_id: string; set_label_he: string; attempted_count: number; avg_pct: number | null }
interface StudentSummary {
  student_id: string; student_name: string; set_id: string; set_label_he: string
  correct_count: number; total_answered: number; pct: number
}
interface QuestionStat {
  question_id: number; correct_answer: number; total_answers: number
  correct_count: number; success_pct: number | null; distribution: Record<string, number>
}
interface SetMeta { key: string; labelHe: string; count: number }

export default function MakbatzimTeacherPage() {
  const { email } = useTeacherAuth()
  const [className, setClassName] = useState('')
  const [allSets, setAllSets] = useState<SetMeta[]>([])
  const [setsSummary, setSetsSummary] = useState<SetSummary[]>([])
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [selectedSet, setSelectedSet] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [tab, setTab] = useState<'sets' | 'students' | 'questions'>('sets')

  async function loadData(setId: string) {
    const res = await fetch(`/api/teacher/makbatzim${setId ? `?set_id=${setId}` : ''}`)
    if (!res.ok) throw new Error('load failed')
    const data = await res.json()
    setClassName(data.class_name)
    setSetsSummary(data.sets_summary)
    setStudents(data.students)
    setQuestionStats(data.question_stats)
  }

  useEffect(() => {
    if (!email) return
    async function init() {
      try {
        const setsRes = await fetch('/api/makbatzim/sets')
        if (!setsRes.ok) throw new Error('load failed')
        const setsData = await setsRes.json()
        setAllSets(setsData.sets || [])
        await loadData('')
      } catch {
        setError('שגיאה בטעינת הדוח. בדוק חיבור לאינטרנט ונסה שוב.')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [email, retryToken])

  async function handleSetSelect(setId: string) {
    setSelectedSet(setId)
    setLoading(true)
    setError('')
    try {
      await loadData(setId)
      if (setId) setTab('questions')
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

  const filteredStudents = selectedSet ? students.filter(s => s.set_id === selectedSet) : students
  const selectedSetLabel = selectedSet ? allSets.find(s => s.key === selectedSet)?.labelHe : null

  return (
    <>
      <h1 className="font-bold text-primary-700 dark:text-primary-400 mb-1">דוח שאלות שעדי שלחה</h1>
      <p className="text-xs text-fg/60 mb-5">{className}</p>

      <div className="bg-surface rounded-xl border border-card-border p-4 mb-4">
        <label htmlFor="setFilter" className="text-sm font-medium text-fg/80 block mb-2">סנן לפי מקבץ:</label>
        <select
          id="setFilter"
          value={selectedSet}
          onChange={e => handleSetSelect(e.target.value)}
          className="w-full border border-card-border rounded-lg px-3 py-2 text-right bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent-makbatzim"
        >
          <option value="">כל המקבצים</option>
          {allSets.map(s => (
            <option key={s.key} value={s.key}>{s.labelHe}</option>
          ))}
        </select>
        {selectedSetLabel && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">{filteredStudents.length} תלמידים ענו ב{selectedSetLabel}</p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('sets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sets' ? 'bg-accent-makbatzim text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          סיכום מקבצים
        </button>
        <button onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'students' ? 'bg-accent-makbatzim text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          לפי תלמיד ({filteredStudents.length})
        </button>
        {selectedSet && (
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'questions' ? 'bg-accent-makbatzim text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
            ניתוח שאלות
          </button>
        )}
      </div>

      {tab === 'sets' && (
        setsSummary.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">אין נתונים עדיין</p>
        ) : (
          <div className="grid gap-3">
            {setsSummary.map(s => (
              <button key={s.set_id} onClick={() => handleSetSelect(s.set_id)}
                className="w-full text-right bg-surface rounded-xl border border-card-border p-4 hover:border-accent-makbatzim hover:shadow-sm transition">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-fg">{s.set_label_he}</div>
                    <div className="text-xs text-fg/60 mt-0.5">{s.attempted_count} תשובות</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(s.avg_pct)}`}>
                      {s.avg_pct !== null ? `${s.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-fg/40">ממוצע</div>
                  </div>
                </div>
                {s.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${barColor(s.avg_pct)}`}
                      style={{ width: `${s.avg_pct}%` }} />
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
                  <th className="p-3 text-right font-semibold text-fg/80">מקבץ</th>
                  <th className="p-3 text-center font-semibold text-fg/80">ציון</th>
                  <th className="p-3 text-center font-semibold text-fg/80">%</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={`${s.student_id}-${s.set_id}`} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                    <td className="p-3 font-medium text-fg">{s.student_name}</td>
                    <td className="p-3 text-fg/70 text-sm">{s.set_label_he}</td>
                    <td className="p-3 text-center font-semibold text-fg">{s.correct_count}/{s.total_answered}</td>
                    <td className={`p-3 text-center font-bold ${scoreColor(s.pct)}`}>{s.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'questions' && selectedSet && (
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
