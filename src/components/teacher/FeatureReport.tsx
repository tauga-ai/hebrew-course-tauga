'use client'

import { useState } from 'react'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'
import { t } from '@/lib/dev-i18n'

interface EntitySummary { entity_id: string; label_he: string; attempted_count: number; avg_pct: number | null }
interface StudentSummary {
  student_id: string; student_name: string; entity_id: string; label_he: string
  correct_count: number; total_answered: number; pct: number
}
interface QuestionStat {
  question_id: number; correct_answer: number; total_answers: number
  correct_count: number; success_pct: number | null; distribution: Record<string, number>
}
interface EntityMeta { key: string; labelHe: string }

interface ReportData {
  class_name: string
  entities_summary: EntitySummary[]
  students: StudentSummary[]
  question_stats: QuestionStat[]
}

export interface FeatureReportProps {
  title: string
  titleColorClass: string
  reportEndpoint: string
  entitiesEndpoint?: string
  /** Key the entities-list response nests its array under (e.g. 'topics' | 'sets'). */
  entitiesResponseKey?: string
  filterParamName: string
  filterLabel: string
  allOptionLabel?: string
  selectedLabelColorClass: string
  summaryTabLabel?: string
  accent: { activeTab: string; hoverBorder: string; ring: string }
  /** Entity keys to hide from the filter dropdown (e.g. דפ"ר, which has its own dedicated report page). */
  excludeEntityKeys?: string[]
  /** Locks the report to a single entity and hides the picker entirely — used for single-set dedicated report pages (e.g. דפ"ר) instead of the multi-entity dropdown. */
  fixedEntity?: { key: string; labelHe: string }
}

/**
 * Shared UI for the tzav-rishon and makbatzim teacher report pages —
 * summary/students/questions tabs, an entity filter dropdown, and the
 * question-level answer-distribution breakdown. The two pages differ only
 * in labels, endpoints, and accent color, all passed as props; a few
 * pre-existing visual divergences between them (title color, selected-label
 * color) are preserved via explicit props rather than unified.
 */
export function FeatureReport({
  title, titleColorClass, reportEndpoint, entitiesEndpoint, entitiesResponseKey,
  filterParamName, filterLabel, allOptionLabel, selectedLabelColorClass, summaryTabLabel, accent,
  excludeEntityKeys, fixedEntity,
}: FeatureReportProps) {
  const { email } = useTeacherAuth()
  const [selectedEntity, setSelectedEntity] = useState(fixedEntity?.key ?? '')
  const [tab, setTab] = useState<'summary' | 'students' | 'questions'>(fixedEntity ? 'students' : 'summary')
  const [retryToken, setRetryToken] = useState(0)

  const { data: entitiesData, loading: entitiesLoading, error: entitiesError } = useResource<Record<string, EntityMeta[]>>(
    !fixedEntity && email && entitiesEndpoint ? `${entitiesEndpoint}?_r=${retryToken}` : null
  )
  const allEntities = fixedEntity
    ? []
    : (entitiesData?.[entitiesResponseKey ?? ''] ?? []).filter(e => !excludeEntityKeys?.includes(e.key))

  const reportParams = new URLSearchParams()
  if (selectedEntity) reportParams.set(filterParamName, selectedEntity)
  reportParams.set('_r', String(retryToken))
  const { data: report, loading: reportLoading, error: reportError } = useResource<ReportData>(
    email ? `${reportEndpoint}?${reportParams.toString()}` : null
  )

  const error = entitiesError || reportError
  const loading = entitiesLoading || reportLoading

  function handleEntitySelect(entityId: string) {
    setSelectedEntity(entityId)
    setTab(entityId ? 'questions' : 'summary')
  }

  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 text-center mt-12">
      <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
      <button onClick={() => setRetryToken(n => n + 1)} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">{t('נסה שוב')}</button>
    </div>
  )

  if (loading || !report) return <LoadingSpinner />

  const filteredStudents = selectedEntity ? report.students.filter(s => s.entity_id === selectedEntity) : report.students
  const selectedLabel = fixedEntity ? fixedEntity.labelHe : (selectedEntity ? allEntities.find(e => e.key === selectedEntity)?.labelHe : null)

  return (
    <>
      <h1 className={`font-bold mb-1 ${titleColorClass}`}>{title}</h1>
      <p className="text-xs text-fg/60 mb-5">{report.class_name}</p>

      {!fixedEntity && (
      <div className="bg-surface rounded-xl border border-card-border p-4 mb-4">
        <label htmlFor="entityFilter" className="text-sm font-medium text-fg/80 block mb-2">{t('סנן לפי')} {filterLabel}:</label>
        <select
          id="entityFilter"
          value={selectedEntity}
          onChange={e => handleEntitySelect(e.target.value)}
          className={`w-full border border-card-border rounded-lg px-3 py-2 text-right bg-surface text-fg focus:outline-none focus:ring-2 ${accent.ring}`}
        >
          <option value="">{allOptionLabel}</option>
          {allEntities.map(e => (
            <option key={e.key} value={e.key}>{e.labelHe}</option>
          ))}
        </select>
        {selectedLabel && (
          <p className={`text-xs mt-1 ${selectedLabelColorClass}`}>{filteredStudents.length} {t('תלמידים ענו ב')}{selectedLabel}</p>
        )}
      </div>
      )}

      <div className="flex gap-2 mb-4">
        {!fixedEntity && (
        <button onClick={() => setTab('summary')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'summary' ? `${accent.activeTab} text-white` : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          {summaryTabLabel}
        </button>
        )}
        <button onClick={() => setTab('students')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'students' ? `${accent.activeTab} text-white` : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
          {t('לפי תלמיד')} ({filteredStudents.length})
        </button>
        {selectedEntity && (
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'questions' ? `${accent.activeTab} text-white` : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'}`}>
            {t('ניתוח שאלות')}
          </button>
        )}
      </div>

      {tab === 'summary' && (
        report.entities_summary.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">{t('אין נתונים עדיין')}</p>
        ) : (
          <div className="grid gap-3">
            {report.entities_summary.map(e => (
              <button key={e.entity_id} onClick={() => handleEntitySelect(e.entity_id)}
                className={`w-full text-right bg-surface rounded-xl border border-card-border p-4 hover:shadow-sm transition ${accent.hoverBorder}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-fg">{e.label_he}</div>
                    <div className="text-xs text-fg/60 mt-0.5">{e.attempted_count} {t('תשובות')}</div>
                  </div>
                  <div className="text-left">
                    <div className={`text-2xl font-bold ${scoreColor(e.avg_pct)}`}>
                      {e.avg_pct !== null ? `${e.avg_pct}%` : '—'}
                    </div>
                    <div className="text-xs text-fg/40">{t('ממוצע')}</div>
                  </div>
                </div>
                {e.avg_pct !== null && (
                  <div className="mt-2 w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${scoreColor(e.avg_pct, { palette: { good: 'bg-green-500', ok: 'bg-yellow-400', bad: 'bg-red-400' } })}`}
                      style={{ width: `${e.avg_pct}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {tab === 'students' && (
        filteredStudents.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">{t('אין נתונים')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-surface rounded-xl border border-card-border text-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5 border-b border-card-border">
                  <th className="text-right p-3 font-semibold text-fg/80">{t('תלמיד')}</th>
                  <th className="p-3 text-right font-semibold text-fg/80">{filterLabel}</th>
                  <th className="p-3 text-center font-semibold text-fg/80">{t('ציון')}</th>
                  <th className="p-3 text-center font-semibold text-fg/80">%</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, i) => (
                  <tr key={`${s.student_id}-${s.entity_id}`} className={i % 2 === 0 ? 'bg-surface' : 'bg-black/5 dark:bg-white/5'}>
                    <td className="p-3 font-medium text-fg">{s.student_name}</td>
                    <td className="p-3 text-fg/70 text-sm">{s.label_he}</td>
                    <td className="p-3 text-center font-semibold text-fg">{s.correct_count}/{s.total_answered}</td>
                    <td className={`p-3 text-center font-bold ${scoreColor(s.pct)}`}>{s.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'questions' && selectedEntity && (
        report.question_stats.length === 0 ? (
          <p className="text-center text-fg/40 mt-12">{t('אין נתוני שאלות עדיין')}</p>
        ) : (
          <div className="space-y-3">
            {report.question_stats.map(q => (
              <div key={q.question_id} className="bg-surface rounded-xl border border-card-border p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-semibold text-fg">{t('שאלה')} {q.question_id}</span>
                    <span className="text-xs text-green-700 bg-green-100 dark:bg-green-500/10 dark:text-green-400 px-2 py-0.5 rounded-full mr-2">{t('תשובה נכונה')}: {q.correct_answer}</span>
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
