'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { NaaleShell } from '@/components/naale/NaaleShell'
import { Avatar } from '@/components/naale/Avatar'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

interface ProfileIdentity {
  shellRole: 'student' | 'staff' | 'admin'
  showAdminLink: boolean
  alsoRole?: 'student' | 'staff'
  backHref: string
  fullName: string
  email: string
  avatarUrl: string | null
  roleLabel: 'student' | 'staff' | 'admin'
  hasPassword: boolean
}

/**
 * Reachable from all three roles via the sidebar's Account block, so — like
 * naale/page.tsx — it resolves identity from /api/naale/me first, falling
 * back to /api/naale/admin/me only for a plain admin-only account with no
 * roster row (naale-self-service-password-change).
 */
export default function NaaleProfilePage() {
  const router = useRouter()
  const [identity, setIdentity] = useState<ProfileIdentity | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/naale/me')
      if (cancelled) return

      if (res.status === 401) { router.replace('/naale/login'); return }

      if (res.status === 403) {
        const adminRes = await fetch('/api/naale/admin/me')
        if (cancelled) return
        if (!adminRes.ok) { router.replace('/naale/not-authorized'); return }
        const admin = await adminRes.json()
        if (cancelled) return
        setIdentity({
          shellRole: 'admin',
          showAdminLink: false,
          alsoRole: admin.roster_role ?? undefined,
          backHref: '/naale/admin',
          fullName: admin.full_name,
          email: admin.email,
          avatarUrl: admin.avatar_url,
          roleLabel: 'admin',
          hasPassword: admin.has_password,
        })
        return
      }

      if (!res.ok) { router.replace('/naale/not-authorized'); return }
      const me = await res.json()
      if (cancelled) return
      setIdentity({
        shellRole: me.role,
        showAdminLink: me.is_admin,
        backHref: me.role === 'staff' ? '/naale/staff' : '/naale',
        fullName: me.student.full_name,
        email: me.email,
        avatarUrl: me.avatar_url,
        roleLabel: me.role,
        hasPassword: me.has_password,
      })
    }
    load()
    return () => { cancelled = true }
  }, [router])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setSaveError(t('הסיסמה חייבת להיות לפחות 6 תווים'))
      return
    }
    if (newPassword !== confirmPassword) {
      setSaveError(t('הסיסמאות אינן תואמות'))
      return
    }
    setSaving(true)
    setSaveError('')
    setSaved(false)

    const supabase = createClient()
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: identity!.email,
      password: currentPassword,
    })
    if (reauthError) {
      setSaving(false)
      setSaveError(t('הסיסמה הנוכחית שגויה'))
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) {
      setSaveError(t('שגיאה בעדכון הסיסמה, נסה/י לבקש קישור חדש'))
      return
    }
    setSaved(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  if (!identity) return <LoadingSpinner />

  return (
    <NaaleShell role={identity.shellRole} showAdminLink={identity.showAdminLink} alsoRole={identity.alsoRole}>
      <PageHeader backHref={identity.backHref} title={t('הפרופיל שלי')} />

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5 flex items-center gap-3 mb-4">
        <Avatar name={identity.fullName} avatarUrl={identity.avatarUrl} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg truncate">{identity.fullName}</div>
          <div className="text-xs text-fg/50 truncate">{identity.email}</div>
          <div className="text-xs text-fg/50">
            {t(identity.roleLabel === 'admin' ? 'מנהל' : identity.roleLabel === 'staff' ? 'צוות' : 'תלמיד')}
          </div>
        </div>
      </div>

      {identity.hasPassword && (
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-5">
          <h2 className="text-sm font-semibold text-fg/70 mb-3">{t('עדכון סיסמה')}</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-fg/80 mb-1">
                {t('סיסמה נוכחית')}
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
                required
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-fg/80 mb-1">
                {t('סיסמה חדשה')}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
                placeholder={t('לפחות 6 תווים')}
                minLength={6}
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-fg/80 mb-1">
                {t('אימות סיסמה')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
                placeholder={t('הכנס/י שוב את הסיסמה')}
                minLength={6}
                required
              />
            </div>
            {saveError && <p className="text-red-500 dark:text-red-400 text-sm">{saveError}</p>}
            {saved && <p className="text-green-600 dark:text-green-400 text-sm">{t('הסיסמה עודכנה בהצלחה')}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving ? t('מעדכן/ת...') : t('עדכון סיסמה')}
            </button>
          </form>
        </div>
      )}
    </NaaleShell>
  )
}
