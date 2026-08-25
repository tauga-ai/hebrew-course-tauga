'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Avatar } from '@/components/naale/Avatar'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

export interface NaaleSidebarProps {
  role: 'student' | 'staff' | 'admin'
  /** Shown as an extra nav item for a student/staff account that's ALSO a
   *  Naale admin — separate from role='admin', which is for someone who
   *  visits /naale/admin directly and may have no roster row at all. */
  showAdminLink?: boolean
}

interface NavItem {
  href: string
  icon: string
  label: string
}

const STUDENT_ITEMS: NavItem[] = [
  { href: '/naale', icon: '▶️', label: 'תרגול' },
  { href: '/naale/stats', icon: '📊', label: 'ההתקדמות שלי' },
]
const STAFF_ITEMS: NavItem[] = [
  { href: '/naale/staff', icon: '👥', label: 'תלמידים' },
  // N4: reported questions. Staff-only, same gate as the students list.
  { href: '/naale/staff/reports', icon: '🚩', label: 'דיווחים' },
]
const ADMIN_ITEMS: NavItem[] = [{ href: '/naale/admin', icon: '🛠️', label: 'ניהול' }]

function LogoutDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" onClick={onCancel} />
      <div className="relative w-full max-w-xs bg-surface rounded-2xl shadow-xl p-5 text-center">
        <p className="text-sm text-fg mb-5">{t('האם את/ה בטוח/ה שברצונך להתנתק?')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            {t('ביטול')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:opacity-90 transition"
          >
            {t('יציאה')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Naale's own desktop-aware shell — visually cloned from StudentSidebar
 * (same tokens, breakpoints, and collapse pattern), but a genuinely separate
 * component living under components/naale/, not a reuse of StudentSidebar
 * itself: that component's NavItem[] is hardcoded to draft-prep routes, and
 * importing it would break Naale's track isolation (see
 * naale-track-first-build/CONTEXT.md's "traps" list). Keeping it under a
 * Naale-specific path — rather than components/layout/, which reads as "the
 * shared layout, safe to use anywhere" — keeps that isolation boundary
 * visible in the codebase, not just in a comment.
 *
 * A distinct cookie (naale_sidebar_collapsed, not StudentSidebar's
 * sidebar_collapsed) so the two components' collapse preferences don't
 * collide for a hypothetical future account that sees both.
 *
 * Grouped into "Account" (profile only), "Menu" (nav), and a bottom-pinned
 * theme/logout block — logout lives here and only here now; naale/page.tsx
 * and naale/staff/page.tsx no longer have their own.
 */
export function NaaleSidebar({ role, showAdminLink }: NaaleSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const baseItems = role === 'staff' ? STAFF_ITEMS : role === 'admin' ? ADMIN_ITEMS : STUDENT_ITEMS
  const items = showAdminLink && role !== 'admin' ? [...baseItems, ...ADMIN_ITEMS] : baseItems

  const [collapsed, setCollapsed] = useState(
    () => typeof document !== 'undefined' && document.cookie.includes('naale_sidebar_collapsed=1')
  )
  const [fullName, setFullName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  useEffect(() => {
    let cancelled = false
    // role='admin' means this account may have no roster/students row at
    // all, so /api/naale/me (roster-gated) would 403 it — use the
    // admin-only profile endpoint instead. Best-effort either way: a failed
    // fetch just leaves the profile row showing nothing (past the skeleton)
    // rather than erroring the whole shell.
    const url = role === 'admin' ? '/api/naale/admin/me' : '/api/naale/me'
    fetch(url)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled) return
        if (data) {
          setFullName(role === 'admin' ? data.full_name : data.student.full_name)
          setAvatarUrl(data.avatar_url)
        }
        setProfileLoading(false)
      })
      .catch(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [role])

  async function confirmLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/naale/login')
  }

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = next
      ? 'naale_sidebar_collapsed=1; path=/; max-age=31536000'
      : 'naale_sidebar_collapsed=; path=/; max-age=0'
  }

  // Desktop-only concern — collapsed never affects the mobile horizontal
  // scroll strip, so every conditional class below only ever adds an
  // `md:` prefixed class, never a bare one that would also hide on mobile.
  const hideOnCollapse = collapsed ? 'md:hidden' : ''

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={`w-full ${collapsed ? 'md:w-14' : 'md:w-60'} shrink-0 md:h-screen md:sticky md:top-0 bg-surface border-b md:border-b-0 md:border-l border-card-border p-4 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible transition-all`}
    >
      <div className="flex items-center justify-between shrink-0">
        <span className={`font-bold text-fg whitespace-nowrap ${hideOnCollapse}`}>{t('נעלה')}</span>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t(collapsed ? 'הרחב סרגל' : 'כווץ סרגל')}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-fg/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-fg/80 transition shrink-0"
        >
          ☰
        </button>
      </div>

      <div className={`flex flex-col gap-2 shrink-0 ${hideOnCollapse}`}>
        <span className="text-[10px] font-semibold tracking-wide text-fg/40 uppercase px-3">{t('חשבון')}</span>

        {profileLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 animate-pulse">
            <span className="shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
              <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-white/10" />
            </div>
          </div>
        ) : (
          fullName && (
            <div className="flex items-center gap-2 px-3 py-2">
              <Avatar name={fullName} avatarUrl={avatarUrl} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-fg truncate">{fullName}</div>
                <div className="text-xs text-fg/50">{t(role === 'admin' ? 'מנהל' : role === 'staff' ? 'צוות' : 'תלמיד')}</div>
              </div>
            </div>
          )
        )}
      </div>

      <div className={`flex flex-col gap-1 shrink-0 ${hideOnCollapse}`}>
        <span className="text-[10px] font-semibold tracking-wide text-fg/40 uppercase px-3">{t('תפריט')}</span>
        <nav className="flex flex-row md:flex-col gap-1">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={t(item.label)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${isActive(item.href) ? 'bg-highlight/10 text-highlight' : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
            >
              <span>{item.icon}</span>
              <span>{t(item.label)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Collapsed rail still needs the nav icons visible even though the
          labeled section above is hidden — a bare icon-only copy. */}
      {collapsed && (
        <nav className="hidden md:flex md:flex-col gap-1 shrink-0">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={t(item.label)}
              className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm transition ${isActive(item.href) ? 'bg-highlight/10 text-highlight' : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-1 shrink-0 md:mt-auto">
        <button
          type="button"
          onClick={toggleTheme}
          title={t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}
          className="flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className={hideOnCollapse}>{t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowLogoutDialog(true)}
          title={t('יציאה')}
          className="flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
        >
          <span>🚪</span>
          <span className={hideOnCollapse}>{t('יציאה')}</span>
        </button>
      </div>

      {showLogoutDialog && (
        <LogoutDialog onConfirm={confirmLogout} onCancel={() => setShowLogoutDialog(false)} />
      )}
    </aside>
  )
}
