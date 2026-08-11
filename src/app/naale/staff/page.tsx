'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

/**
 * Placeholder only — the real staff views land in ticket 13
 * (naale-staff-views). This exists purely so ticket 3's routing shim
 * ('/naale' -> here, for role: 'staff') has somewhere to land instead of a
 * 404 while manually verifying the auth flow.
 */
export default function NaaleStaffPlaceholderPage() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/naale/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <p className="text-fg/70 mb-6">{t('בקרוב...')}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-fg/40 hover:text-fg/70"
        >
          {t('יציאה')}
        </button>
      </div>
    </div>
  )
}
