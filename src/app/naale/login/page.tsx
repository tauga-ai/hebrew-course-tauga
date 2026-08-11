'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { t } from '@/lib/dev-i18n'

export default function NaaleLoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    // /naale resolves the role via /api/naale/me and forwards to the student
    // home or the staff view — the student never picks a track.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/naale` },
    })
    if (oauthError) {
      setError('שגיאה בהתחברות עם Google')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">{t('נעלה')}</h1>
        <p className="text-fg/60 mb-8 text-sm">{t('תרגול עברית')}</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 border border-card-border rounded-lg py-2.5 font-medium text-fg/80 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? t('מעביר ל-Google...') : t('התחברות עם Google')}
        </button>

        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
