'use client'

import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleShell } from '@/components/naale/NaaleShell'
import { useResource } from '@/lib/hooks/use-resource'
import { useNaaleProfile } from '@/lib/naale/use-naale-profile'
import { t } from '@/lib/dev-i18n'

interface McqQuestion {
  prompt: string
  options: string[]
  correct_answer: string
  explanation: string | null
}

interface OpenQuestion {
  prompt: string
  fields: Record<string, string>
}

/**
 * Current live content for one report's question, editable in place
 * (naale-report-quick-edit). Fetches by question_row_id + question_kind —
 * that id has no FK to either question bank (see the reports migration), so
 * a null result is an expected "question deleted since reported" outcome,
 * not an error.
 */
function LiveQuestionEditor({ questionRowId, kind }: { questionRowId: string; kind: 'mcq' | 'open' }) {
  const [question, setQuestion] = useState<McqQuestion | OpenQuestion | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<McqQuestion | OpenQuestion | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/naale/staff/questions/${questionRowId}?kind=${kind}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setQuestion(data.question) })
    return () => { cancelled = true }
  }, [questionRowId, kind])

  if (question === undefined) return <p className="text-xs text-fg/40">{t('טוען...')}</p>
  if (question === null) return <p className="text-xs text-fg/40">{t('השאלה כבר לא קיימת')}</p>

  function startEditing() {
    if (!question) return
    setDraft(question)
    setEditing(true)
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/naale/staff/questions/${questionRowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...draft }),
      })
      if (res.ok) {
        setQuestion(draft)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-lg border border-card-border bg-surface px-2.5 py-1.5 text-sm text-fg'

  if (!editing) {
    return (
      <div className="text-sm">
        <p className="text-fg whitespace-pre-line">{question.prompt}</p>
        {kind === 'mcq' && (
          <ul className="mt-2 space-y-1">
            {(question as McqQuestion).options.map((opt, i) => (
              <li
                key={i}
                className={
                  opt === (question as McqQuestion).correct_answer
                    ? 'font-semibold text-green-700 dark:text-green-400'
                    : 'text-fg/70'
                }
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
        {kind === 'mcq' && (question as McqQuestion).explanation && (
          <p className="mt-2 text-xs text-fg/50">
            {t('הסבר')}: {(question as McqQuestion).explanation}
          </p>
        )}
        {kind === 'open' && (
          <dl className="mt-2 space-y-1 text-xs text-fg/60">
            {Object.entries((question as OpenQuestion).fields).map(([key, value]) => (
              <div key={key} className="flex gap-1">
                <dt className="font-semibold">{key}:</dt>
                <dd className="whitespace-pre-line">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 rounded-lg border border-card-border px-3 py-1 text-xs font-semibold text-fg/70 transition hover:text-fg"
        >
          {t('עריכה')}
        </button>
      </div>
    )
  }

  const mcqDraft = draft as McqQuestion
  const openDraft = draft as OpenQuestion

  return (
    <div className="space-y-2 text-sm">
      <textarea
        className={inputClass}
        rows={2}
        value={draft?.prompt ?? ''}
        onChange={e => setDraft(d => (d ? { ...d, prompt: e.target.value } : d))}
      />

      {kind === 'mcq' && (
        <>
          {mcqDraft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${questionRowId}`}
                checked={opt === mcqDraft.correct_answer}
                onChange={() => setDraft({ ...mcqDraft, correct_answer: opt })}
              />
              <input
                className={inputClass}
                value={opt}
                onChange={e => {
                  const options = [...mcqDraft.options]
                  const wasCorrect = options[i] === mcqDraft.correct_answer
                  options[i] = e.target.value
                  setDraft({ ...mcqDraft, options, correct_answer: wasCorrect ? e.target.value : mcqDraft.correct_answer })
                }}
              />
            </div>
          ))}
          <textarea
            className={inputClass}
            rows={2}
            placeholder={t('הסבר')}
            value={mcqDraft.explanation ?? ''}
            onChange={e => setDraft({ ...mcqDraft, explanation: e.target.value })}
          />
        </>
      )}

      {kind === 'open' && (
        <div className="space-y-1.5">
          {Object.entries(openDraft.fields).map(([key, value]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-fg/60">{key}</label>
              <textarea
                className={inputClass}
                rows={2}
                value={value}
                onChange={e => setDraft({ ...openDraft, fields: { ...openDraft.fields, [key]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t('שמור')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="rounded-lg border border-card-border px-3 py-1 text-xs font-semibold text-fg/70 transition hover:text-fg disabled:opacity-50"
        >
          {t('ביטול')}
        </button>
      </div>
    </div>
  )
}

interface QuestionReport {
  id: string
  created_at: string
  status: 'open' | 'resolved'
  question_kind: 'mcq' | 'open'
  question_row_id: string
  question_id: string
  topic: string
  difficulty: number
  prompt_snapshot: string
  student_answer: string | null
  student_was_correct: boolean | null
  note: string
  student_name: string | null
  resolved_at: string | null
}

/**
 * Staff triage for reported questions (N4, step 5).
 *
 * The report itself (note, prompt_snapshot, student answer) is the snapshot
 * stored at report time, not a live join against the question bank — see the
 * migration for why. That means a report still reads correctly after the
 * question it describes has been edited or removed, which is the entire
 * point of keeping it. The live current content is now shown too, alongside
 * (not replacing) that snapshot — see LiveQuestionEditor below
 * (naale-report-quick-edit) — so staff can fix a mistake without a separate
 * Excel re-import.
 *
 * Not using useResource() here: the list has to be re-fetched after a resolve,
 * and that hook re-fetches on URL change only.
 */
export default function NaaleStaffReportsPage() {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  // Bumped after a resolve/reopen to re-run the fetch. useResource re-fetches
  // on URL change only, which is the whole reason the counter is in the URL —
  // the route ignores the param.
  const [version, setVersion] = useState(0)
  // Shared with NaaleSidebar/staff/page.tsx — same cache, no extra fetch.
  const { profile: me } = useNaaleProfile('staff')

  const { data, loading, error } = useResource<{ reports: QuestionReport[] }>(
    `/api/naale/staff/reports?v=${version}`
  )
  const reports = data?.reports ?? null

  const setStatus = async (id: string, status: 'open' | 'resolved') => {
    setBusyId(id)
    try {
      const res = await fetch('/api/naale/staff/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) setVersion(v => v + 1)
    } finally {
      setBusyId(null)
    }
  }

  const visible = (reports ?? []).filter(r => showResolved || r.status === 'open')
  const openCount = (reports ?? []).filter(r => r.status === 'open').length

  return (
    <NaaleShell role="staff" contentClassName="max-w-4xl" showAdminLink={me?.is_admin ?? false}>
      <div className="flex justify-between items-center mt-4 mb-6 gap-3">
          {/* "Reported questions" */}
          <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl">
            {t('דיווחים על שאלות')}
            {openCount > 0 && (
              <span className="ms-2 rounded-full bg-red-500/10 px-2 py-0.5 text-sm font-semibold text-red-600 dark:text-red-400">
                <LtrIsolate>{openCount}</LtrIsolate>
              </span>
            )}
          </h1>
          <label className="flex items-center gap-2 text-sm text-fg/70">
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            {/* "Show handled" */}
            {t('הצג גם דיווחים שטופלו')}
          </label>
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
        {loading && <LoadingSpinner />}

        {reports && visible.length === 0 && (
          // "No reports" / "No open reports"
          <p className="text-center text-fg/50 py-10">{showResolved ? t('אין דיווחים') : t('אין דיווחים פתוחים')}</p>
        )}

        <div className="space-y-3">
          {visible.map(report => (
            <div
              key={report.id}
              className={`rounded-2xl border p-4 ${
                report.status === 'open'
                  ? 'border-card-border bg-surface'
                  : 'border-card-border/60 bg-surface/60 opacity-70'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {/* The workbook id is what a content editor actually searches
                    for — the reason N4 waited on the stable-question_id work. */}
                <span className="rounded-lg bg-accent-naale/10 px-2 py-0.5 text-xs font-semibold text-accent-naale">
                  <LtrIsolate>{report.question_id}</LtrIsolate>
                </span>
                <span className="text-xs text-fg/60">{report.topic}</span>
                <span className="text-xs text-fg/40">
                  {/* "difficulty" */}
                  {t('רמה')} <LtrIsolate>{report.difficulty}</LtrIsolate>
                </span>
                <span className="ms-auto text-xs text-fg/40">
                  <LtrIsolate>{new Date(report.created_at).toLocaleDateString('he-IL')}</LtrIsolate>
                </span>
              </div>

              {/* What the reporter wrote — the reason the row exists, so it
                  leads rather than sitting under the question text. */}
              <p className="text-fg whitespace-pre-line text-right mb-3">{report.note}</p>

              <div className="rounded-xl bg-surface p-3 text-right text-sm text-fg/70 whitespace-pre-line">
                {report.prompt_snapshot}
              </div>

              {/* naale-report-quick-edit: current live content, editable —
                  the block above stays exactly as it was, frozen at report
                  time. */}
              <div className="mt-2 rounded-xl border border-card-border/60 p-3 text-right">
                <LiveQuestionEditor questionRowId={report.question_row_id} kind={report.question_kind} />
              </div>

              {(report.student_answer || report.student_was_correct !== null) && (
                <p className="mt-2 text-xs text-fg/50 text-right">
                  {/* "Their answer" / "answered correctly" / "answered incorrectly" */}
                  {report.student_answer
                    ? <>{t('התשובה שלהם')}: {report.student_answer}</>
                    : report.student_was_correct
                      ? t('ענו נכון')
                      : t('ענו לא נכון')}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-fg/40">{report.student_name ?? t('תלמיד/ה')}</span>
                <button
                  type="button"
                  onClick={() => setStatus(report.id, report.status === 'open' ? 'resolved' : 'open')}
                  disabled={busyId === report.id}
                  className="ms-auto rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-fg/70 transition hover:text-fg disabled:opacity-50"
                >
                  {/* "Mark as handled" / "Reopen" */}
                  {report.status === 'open' ? t('סמן כטופל') : t('פתח מחדש')}
                </button>
              </div>
            </div>
          ))}
        </div>
    </NaaleShell>
  )
}
