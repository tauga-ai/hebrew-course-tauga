'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { Avatar } from '@/components/naale/Avatar'
import { t } from '@/lib/dev-i18n'

interface AdminRow {
  email: string
  created_at: string
}

export default function NaaleAdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/naale/admin/me')
      if (cancelled) return
      if (res.status === 401) { router.replace('/naale/login'); return }
      if (res.status === 403) { router.replace('/naale/not-authorized'); return }
      setReady(true)
      loadAdmins()
    }
    load()
    return () => { cancelled = true }
  }, [router])

  async function loadAdmins() {
    const res = await fetch('/api/naale/admin/admins')
    if (res.ok) setAdmins((await res.json()).admins)
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

  if (!ready) return <LoadingSpinner />

  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="admin" />
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
        <div className="flex justify-center items-center mt-4 mb-6 gap-3">
          <h1 className="font-bold text-primary-700 dark:text-primary-400 text-xl">{t('ניהול')}</h1>
        </div>

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
            <div className="py-6 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : admins.length === 0 ? (
            <p className="text-fg/50 text-sm text-center py-4">{t('אין מנהלים עדיין')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-card-border mb-2">
              {admins.map(a => (
                <li key={a.email} className="flex items-center gap-3 py-2.5">
                  <Avatar name={a.email} avatarUrl={null} />
                  <span className="flex-1 min-w-0 text-sm text-fg truncate">{a.email}</span>
                  <button
                    type="button"
                    onClick={() => removeAdmin(a.email)}
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
      </div>
    </div>
  )
}
