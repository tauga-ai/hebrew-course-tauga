'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'
import { t } from '@/lib/dev-i18n'

interface SentenceStat { set_id: number; attempts: number; avg_score: number | null }
interface InterviewStat { total: number; avg_score: number | null }
interface StudentRow {
  id: string; name: string
  sentence_attempts: number; sentence_avg: number | null
  interview_count: number; interview_avg: number | null
}

export default function ActivityPage() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const [sentenceStats, setSentenceStats] = useState<SentenceStat[]>([])
  const [interviewStats, setInterviewStats] = useState<InterviewStat | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) return
    async function load() {
      const res = await fetch('/api/teacher/activity')
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const data = await res.json()
      setSentenceStats(data.sentence_stats)
      setInterviewStats(data.interview_stats)
      setStudents(data.students)
      setLoading(false)
    }
    load()
  }, [email, router])

  if (loading) return <LoadingSpinner />

  // Scores here are on a 0-10 scale; 7/5 is the 0-10 equivalent of the app-wide 70/50 thresholds.
  const activityScoreColor = (s: number | null) => scoreColor(s, { thresholds: { good: 7, ok: 5 }, emptyClass: 'text-fg/40' })

  return (
    <>
      <h1 className="font-bold text-primary-700 dark:text-primary-400 mb-6">{t('פעילות תלמידים')}</h1>

      {/* Interview summary */}
      <div className="bg-surface rounded-2xl border border-card-border p-5 mb-5">
        <h2 className="font-semibold text-fg mb-3">🎤 {t('ראיון אישי')}</h2>
        <div className="flex gap-6">
          <div>
            <div className="text-2xl font-bold text-fg">{interviewStats?.total ?? 0}</div>
            <div className="text-xs text-fg/60">{t('ניסיונות')}</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${activityScoreColor(interviewStats?.avg_score != null ? interviewStats.avg_score / 10 : null)}`}>
              {interviewStats?.avg_score != null ? `${Math.round(interviewStats.avg_score)}/100` : '—'}
            </div>
            <div className="text-xs text-fg/60">{t('ממוצע')}</div>
          </div>
        </div>
      </div>

      {/* Sentence building by set */}
      <div className="bg-surface rounded-2xl border border-card-border p-5 mb-5">
        <h2 className="font-semibold text-fg mb-3">✍️ {t('בניית משפטים, לפי סט')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {sentenceStats.map(s => (
            <div key={s.set_id} className="bg-black/5 dark:bg-white/5 rounded-xl p-3 text-center">
              <div className="text-xs text-fg/60 mb-1">{t('סט')} {s.set_id}</div>
              <div className={`text-lg font-bold ${activityScoreColor(s.avg_score)}`}>
                {s.avg_score != null ? `${s.avg_score.toFixed(1)}/10` : '—'}
              </div>
              <div className="text-xs text-fg/40">{s.attempts} {t('ניסיונות')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-student table */}
      <div className="bg-surface rounded-2xl border border-card-border p-5">
        <h2 className="font-semibold text-fg mb-3">👤 {t('פירוט לפי תלמיד')}</h2>
        {students.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-4">{t('אין נתונים עדיין')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                  <th className="text-right p-2 font-semibold text-fg/80">{t('תלמיד')}</th>
                  <th className="p-2 text-center font-semibold text-fg/80">{t('משפטים (ניסיונות)')}</th>
                  <th className="p-2 text-center font-semibold text-fg/80">{t('ממוצע משפטים')}</th>
                  <th className="p-2 text-center font-semibold text-fg/80">{t('ראיונות')}</th>
                  <th className="p-2 text-center font-semibold text-fg/80">{t('ממוצע ראיון')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => (
                  <tr key={st.id} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                    <td className="p-2 font-medium text-fg">{st.name}</td>
                    <td className="p-2 text-center text-fg/70">{st.sentence_attempts}</td>
                    <td className={`p-2 text-center font-semibold ${activityScoreColor(st.sentence_avg)}`}>
                      {st.sentence_avg != null ? `${st.sentence_avg.toFixed(1)}/10` : '—'}
                    </td>
                    <td className="p-2 text-center text-fg/70">{st.interview_count}</td>
                    <td className={`p-2 text-center font-semibold ${activityScoreColor(st.interview_avg != null ? st.interview_avg / 10 : null)}`}>
                      {st.interview_avg != null ? `${Math.round(st.interview_avg)}/100` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
