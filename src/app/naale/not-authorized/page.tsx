import { t } from '@/lib/dev-i18n'

/**
 * Dead end for a Google account whose email isn't on the school's roster.
 * Reachable only after a successful Google sign-in, so the person is real —
 * they're just not on the list (typo in the CSV, not added yet, wrong Google
 * account). There is no manual path picker on this track, so without this page
 * they'd have no way to understand what happened.
 */
export default function NaaleNotAuthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-bold text-fg mb-2">{t('החשבון לא נמצא ברשימה')}</h1>
        <p className="text-fg/70 text-sm mb-6">
          {t('הכתובת שאיתה התחברת לא מופיעה ברשימת המשתתפים. פנה/י למדריך/ה כדי לבדוק את הפרטים.')}
        </p>
        <a href="/naale/login" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
          {t('נסה/י להתחבר עם חשבון אחר')}
        </a>
      </div>
    </div>
  )
}
