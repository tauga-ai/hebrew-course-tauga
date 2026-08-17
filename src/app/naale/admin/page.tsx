'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { Avatar } from '@/components/naale/Avatar'
import type { QuestionImportReport } from '@/lib/naale/question-import'
import type { RosterImportReport } from '@/lib/naale/roster-import'
import { t } from '@/lib/dev-i18n'

interface AdminRow {
  email: string
  created_at: string
  avatar_url: string | null
}

interface RosterRow {
  email: string
  role: 'student' | 'staff'
  created_at: string
}

function StatChip({ label, value, accentClass = 'text-fg' }: { label: string; value: number; accentClass?: string }) {
  return (
    <div className="rounded-lg bg-black/5 dark:bg-white/5 p-2 text-center">
      <div className={`text-lg font-bold ${accentClass}`}>{value}</div>
      <div className="text-[10px] text-fg/50 mt-0.5">{label}</div>
    </div>
  )
}

/** Same shape as NaaleSidebar's LogoutDialog — a small centered modal instead
 *  of the browser's native confirm(), which this repo does use elsewhere
 *  (session/placement leave prompts) but not for account-affecting actions
 *  like this one. */
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-xs bg-surface rounded-2xl shadow-xl p-5 text-center">
        <p className="text-sm text-fg mb-5 whitespace-pre-line">{message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition">
            {t('ביטול')}
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:opacity-90 transition">
            {t('הסר')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NaaleAdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<QuestionImportReport | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File | null) {
    setFile(f)
    setReport(null)
    setImportError('')
  }

  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const [rosterReport, setRosterReport] = useState<RosterImportReport | null>(null)
  const [rosterImporting, setRosterImporting] = useState(false)
  const [rosterImportError, setRosterImportError] = useState('')
  const [rosterDragActive, setRosterDragActive] = useState(false)
  const rosterFileInputRef = useRef<HTMLInputElement>(null)

  function pickRosterFile(f: File | null) {
    setRosterFile(f)
    setRosterReport(null)
    setRosterImportError('')
  }

  const [roster, setRoster] = useState<RosterRow[] | null>(null)
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterError, setRosterError] = useState('')

  const [confirmTarget, setConfirmTarget] = useState<{ kind: 'roster' | 'admin'; email: string } | null>(null)

  function confirmDelete() {
    if (!confirmTarget) return
    const { kind, email } = confirmTarget
    setConfirmTarget(null)
    if (kind === 'roster') removeRosterEntry(email)
    else removeAdmin(email)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/naale/admin/me')
      if (cancelled) return
      if (res.status === 401) { router.replace('/naale/login'); return }
      if (res.status === 403) { router.replace('/naale/not-authorized'); return }
      setReady(true)
      loadAdmins()
      loadRoster()
    }
    load()
    return () => { cancelled = true }
  }, [router])

  async function loadAdmins() {
    const res = await fetch('/api/naale/admin/admins')
    if (res.ok) setAdmins((await res.json()).admins)
  }

  async function loadRoster() {
    const res = await fetch('/api/naale/admin/roster')
    if (res.ok) setRoster((await res.json()).roster)
  }

  async function removeRosterEntry(email: string) {
    setRosterError('')
    const res = await fetch('/api/naale/admin/roster', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) { setRosterError((await res.json()).error ?? 'שגיאה'); return }
    loadRoster()
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAdding(true)
    const res = await fetch('/api/naale/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    })
    setAdding(false)
    if (!res.ok) { setError((await res.json()).error ?? 'שגיאה'); return }
    setNewEmail('')
    loadAdmins()
  }

  async function removeAdmin(email: string) {
    setError('')
    const res = await fetch('/api/naale/admin/admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'שגיאה'); return }
    loadAdmins()
  }

  async function runImport(mode: 'preview' | 'commit') {
    if (!file) return
    setImporting(true)
    setImportError('')
    const body = new FormData()
    body.set('file', file)
    body.set('mode', mode)
    const res = await fetch('/api/naale/admin/questions/import', { method: 'POST', body })
    setImporting(false)
    if (!res.ok) { setImportError((await res.json()).error ?? 'שגיאה'); return }
    setReport(await res.json())
  }

  async function runRosterImport(mode: 'preview' | 'commit') {
    if (!rosterFile) return
    setRosterImporting(true)
    setRosterImportError('')
    const body = new FormData()
    body.set('file', rosterFile)
    body.set('mode', mode)
    const res = await fetch('/api/naale/admin/roster/import', { method: 'POST', body })
    setRosterImporting(false)
    if (!res.ok) { setRosterImportError((await res.json()).error ?? 'שגיאה'); return }
    const result: RosterImportReport = await res.json()
    setRosterReport(result)
    if (result.written) loadRoster()
  }

  if (!ready) return <LoadingSpinner />

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="admin" />
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mt-4 mb-6 gap-3">
          <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl">{t('ניהול')}</h1>
        </div>

        <div className="grid grid-cols-1 gap-4">
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg/70">{t('מנהלים')}</h2>
            {admins && (
              <span className="text-xs text-fg/40">
                {admins.length} {t('סה"כ')}
              </span>
            )}
          </div>

          {admins === null ? (
            <ul className="flex flex-col divide-y divide-card-border mb-2">
              {[0, 1, 2].map(i => (
                <li key={i} className="flex items-center gap-3 py-2.5 animate-pulse">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10" />
                  <span className="h-3 w-40 rounded bg-gray-200 dark:bg-white/10" />
                </li>
              ))}
            </ul>
          ) : admins.length === 0 ? (
            <p className="text-fg/50 text-sm text-center py-4">{t('אין מנהלים עדיין')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-card-border mb-2">
              {admins.map(a => (
                <li key={a.email} className="flex items-center gap-3 py-2.5">
                  <Avatar name={a.email} avatarUrl={a.avatar_url} />
                  <span className="flex-1 min-w-0 text-sm text-fg truncate">{a.email}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ kind: 'admin', email: a.email })}
                    title={t('הסר')}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-fg/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addAdmin} className="flex gap-2 pt-3 mt-1 border-t border-card-border">
            <input
              type="email"
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder={t('כתובת אימייל')}
              className="flex-1 border border-card-border rounded-lg px-4 py-2 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
            >
              {adding ? t('מוסיף...') : t('הוסף מנהל')}
            </button>
          </form>
          {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5">
          <h2 className="text-sm font-semibold text-fg/70 mb-3">{t('ייבוא מאגר שאלות')}</h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={e => pickFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => {
              e.preventDefault()
              setDragActive(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`mb-3 rounded-xl border-2 border-dashed p-6 text-center text-sm cursor-pointer transition ${
              dragActive
                ? 'border-primary-500 bg-primary-500/5'
                : 'border-card-border hover:border-primary-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {file ? (
              <span className="text-fg font-medium">{file.name}</span>
            ) : (
              <span className="text-fg/50">{t('גרור לכאן קובץ אקסל, או לחץ לבחירה')}</span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              disabled={!file || importing}
              onClick={() => runImport('preview')}
              className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-40"
            >
              {importing ? t('טוען...') : t('תצוגה מקדימה')}
            </button>
            {report && report.anomalies.length === 0 && !report.written && (
              <button
                type="button"
                disabled={importing}
                onClick={() => runImport('commit')}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {t('אשר ייבוא')}
              </button>
            )}
          </div>

          {importError && <p className="text-red-500 dark:text-red-400 text-sm mb-2">{importError}</p>}

          {report && (
            <div className="border-t border-card-border pt-3 space-y-3">
              {report.written ? (
                <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-3 py-2 text-green-700 dark:text-green-400 text-sm font-medium">
                  {t('הייבוא הושלם בהצלחה')} · {report.totalRows} {t('שאלות')}
                </div>
              ) : (
                <p className="text-xs text-fg/50">
                  {t('תצוגה מקדימה')} — {t('שום דבר לא נשמר עדיין')}. {report.totalRows} {t('שאלות סה"כ')}, {report.summary.length} {t('נושאים')}.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-fg/40 text-xs">
                      <th className="text-start font-medium pb-1.5 pe-2">{t('נושא')}</th>
                      <th className="text-center font-medium pb-1.5 px-1">{t('סה"כ')}</th>
                      {[1, 2, 3, 4, 5].map(l => (
                        <th key={l} className="text-center font-medium pb-1.5 px-1">L{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.map(s => (
                      <tr key={s.topic} className="border-t border-card-border">
                        <td className="py-2 pe-2 text-fg">{s.topic}</td>
                        <td className="py-2 px-1 text-center font-semibold text-fg">{s.count}</td>
                        {[1, 2, 3, 4, 5].map(l => (
                          <td
                            key={l}
                            className={`py-2 px-1 text-center ${(s.byLevel[l] ?? 0) === 0 ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-fg/60'}`}
                          >
                            {s.byLevel[l] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-fg/40">{t('עמודות אדומות מציינות רמה ללא שאלות בכלל')}</p>

              {report.skippedSheets.length > 0 && (
                <div className="text-xs text-fg/40">
                  {t('גיליונות שלא יובאו')}: {report.skippedSheets.join(', ')}
                </div>
              )}

              {report.anomalies.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
                  <div className="text-red-600 dark:text-red-400 text-xs font-semibold mb-1.5">
                    {report.anomalies.length} {t('בעיות שנמצאו')}
                  </div>
                  <ul className="text-red-600 dark:text-red-400 text-xs space-y-1 list-disc ps-4">
                    {report.anomalies.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {report.orphans.length > 0 && (
                <p className="text-xs text-fg/40">
                  {report.orphans.length} {t('שאלות קיימות שלא נמצאות בקובץ זה (לא נמחקו)')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg/70">{t('רשימת נרשמים')}</h2>
            {roster && (
              <span className="text-xs text-fg/40">
                {roster.length} {t('סה"כ')}
              </span>
            )}
          </div>

          {roster === null ? (
            <ul className="flex flex-col divide-y divide-card-border mb-3">
              {[0, 1, 2].map(i => (
                <li key={i} className="flex items-center gap-3 py-2.5 animate-pulse">
                  <span className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                </li>
              ))}
            </ul>
          ) : roster.length === 0 ? (
            <p className="text-fg/50 text-sm text-center py-4">{t('אין עדיין נרשמים')}</p>
          ) : (
            <>
              <input
                type="text"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                placeholder={t('חיפוש לפי אימייל...')}
                className="w-full mb-2 border border-card-border rounded-lg px-4 py-2 text-sm bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <ul className="flex flex-col divide-y divide-card-border mb-3 max-h-64 overflow-y-auto">
                {roster
                  .filter(r => r.email.toLowerCase().includes(rosterSearch.trim().toLowerCase()))
                  .map(r => (
                    <li key={r.email} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 min-w-0 text-sm text-fg truncate">{r.email}</span>
                      <span className="shrink-0 text-xs text-fg/40">{r.role === 'staff' ? t('צוות') : t('תלמיד')}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget({ kind: 'roster', email: r.email })}
                        title={t('הסר')}
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-fg/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
          {rosterError && <p className="text-red-500 dark:text-red-400 text-sm mb-3">{rosterError}</p>}

          <h3 className="text-sm font-semibold text-fg/70 mb-3 pt-3 border-t border-card-border">{t('ייבוא רשימת נרשמים')}</h3>

          <input
            ref={rosterFileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={e => pickRosterFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <div
            onClick={() => rosterFileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setRosterDragActive(true) }}
            onDragLeave={() => setRosterDragActive(false)}
            onDrop={e => {
              e.preventDefault()
              setRosterDragActive(false)
              pickRosterFile(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`mb-3 rounded-xl border-2 border-dashed p-6 text-center text-sm cursor-pointer transition ${
              rosterDragActive
                ? 'border-primary-500 bg-primary-500/5'
                : 'border-card-border hover:border-primary-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {rosterFile ? (
              <span className="text-fg font-medium">{rosterFile.name}</span>
            ) : (
              <span className="text-fg/50">{t('גרור לכאן קובץ CSV או אקסל, או לחץ לבחירה')}</span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              disabled={!rosterFile || rosterImporting}
              onClick={() => runRosterImport('preview')}
              className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-40"
            >
              {rosterImporting ? t('טוען...') : t('תצוגה מקדימה')}
            </button>
            {rosterReport && rosterReport.parseErrors.length === 0 && !rosterReport.written && (
              <button
                type="button"
                disabled={rosterImporting}
                onClick={() => runRosterImport('commit')}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {t('אשר ייבוא')}
              </button>
            )}
          </div>

          {rosterImportError && <p className="text-red-500 dark:text-red-400 text-sm mb-2">{rosterImportError}</p>}

          {rosterReport && (
            <div className="border-t border-card-border pt-3 space-y-3">
              {rosterReport.parseErrors.length > 0 ? (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3">
                  <div className="text-red-600 dark:text-red-400 text-xs font-semibold mb-1.5">
                    {rosterReport.parseErrors.length} {t('בעיות שנמצאו — לא נשמר דבר')}
                  </div>
                  <ul className="text-red-600 dark:text-red-400 text-xs space-y-1 list-disc ps-4">
                    {rosterReport.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              ) : (
                <>
                  {rosterReport.written ? (
                    <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-3 py-2 text-green-700 dark:text-green-400 text-sm font-medium">
                      {t('הייבוא הושלם בהצלחה')} · {rosterReport.totalRows} {t('רשומות')}
                    </div>
                  ) : (
                    <p className="text-xs text-fg/50">
                      {t('תצוגה מקדימה')} — {t('שום דבר לא נשמר עדיין')}.
                    </p>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    <StatChip label={t('סה"כ')} value={rosterReport.totalRows} />
                    <StatChip label={t('תלמידים')} value={rosterReport.students} />
                    <StatChip label={t('צוות')} value={rosterReport.staff} />
                    <StatChip label={t('חדשות')} value={rosterReport.added} accentClass="text-green-600 dark:text-green-400" />
                    <StatChip label={t('שינויי תפקיד')} value={rosterReport.changed} accentClass="text-amber-600 dark:text-amber-400" />
                  </div>
                </>
              )}

              {rosterReport.missingFromFile.length > 0 && (
                <div className="rounded-lg bg-black/5 dark:bg-white/5 p-3">
                  <div className="text-fg/60 text-xs font-semibold mb-1.5">
                    {rosterReport.missingFromFile.length} {t('רשומות קיימות שלא נמצאות בקובץ זה (לא נמחקו)')}
                  </div>
                  <ul className="text-fg/50 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                    {rosterReport.missingFromFile.slice(0, 20).map(r => (
                      <li key={r.email}>{r.email} ({r.role === 'staff' ? t('צוות') : t('תלמיד')})</li>
                    ))}
                  </ul>
                  {rosterReport.missingFromFile.length > 20 && (
                    <div className="text-fg/40 text-xs mt-1">
                      +{rosterReport.missingFromFile.length - 20} {t('נוספים')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {confirmTarget && (
        <ConfirmDialog
          message={`${confirmTarget.email}\n${t(confirmTarget.kind === 'roster' ? 'להסיר נרשם זה מרשימת הנרשמים?' : 'להסיר מנהל זה?')}`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
