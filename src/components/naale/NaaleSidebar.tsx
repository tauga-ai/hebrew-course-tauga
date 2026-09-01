'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Avatar } from '@/components/naale/Avatar'
import { createClient } from '@/lib/supabase/client'
import { useNaaleProfile } from '@/lib/naale/use-naale-profile'
import { t } from '@/lib/dev-i18n'

// Inline SVGs, no icon library — matches this codebase's existing pattern
// (GoogleIcon.tsx, the progress-ring in naale/stats/page.tsx). `currentColor`
// so each picks up its button's own text color/theme classes for free.
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export interface NaaleSidebarProps {
  role: 'student' | 'staff' | 'admin'
  /** Set by a student/staff page when this account is ALSO a Naale admin —
   *  appends the admin nav item. Ignored when role='admin' (isAdmin is
   *  already implied there). */
  showAdminLink?: boolean
  /** Set by the admin page when this account is ALSO on naale_roster — names
   *  its roster role so the matching practice/staff nav items appear.
   *  Ignored outside role='admin' (the roster role there is just `role`
   *  itself). Together with showAdminLink, this means "admin" is always
   *  treated as one flag layered on top of a roster role, never a second
   *  competing role — see the ordering comment in NaaleSidebar below
   *  (naale-admin-staff-nav-link). */
  alsoRole?: 'student' | 'staff'
}

interface NavItem {
  /** Stable identity, independent of the route — the React key, and the one
   *  thing that doesn't change if a route ever gets renamed. */
  slug: string
  name: string
  route: string
  emoji: string
  /** True only for items whose route is a PREFIX of a sibling route
   *  (Dashboard vs every other /naale/* page; Students vs its own
   *  /naale/staff/* sub-pages) — see isActive() for why this matters: a
   *  plain prefix match would make those items "active" on every page
   *  nested under them, not just their own. */
  exact?: boolean
}

const STUDENT_ITEMS: NavItem[] = [
  { slug: 'dashboard', name: 'לוח בקרה', route: '/naale', emoji: '🏠', exact: true },
  { slug: 'progress', name: 'ההתקדמות שלי', route: '/naale/stats', emoji: '📊' },
]
const STAFF_ITEMS: NavItem[] = [
  { slug: 'students', name: 'תלמידים', route: '/naale/staff', emoji: '👥', exact: true },
  // N4: reported questions. Staff-only, same gate as the students list.
  { slug: 'reports', name: 'דיווחים', route: '/naale/staff/reports', emoji: '🚩' },
]
const ADMIN_ITEMS: NavItem[] = [
  { slug: 'admin', name: 'ניהול', route: '/naale/admin', emoji: '🛠️', exact: true },
]

function LogoutDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" onClick={onCancel} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-xs bg-surface rounded-2xl shadow-xl p-5 text-center outline-none"
      >
        <p id="logout-dialog-title" className="text-sm text-fg mb-5">
          {t('האם את/ה בטוח/ה שברצונך להתנתק?')}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            {t('ביטול')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:opacity-90 transition"
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
 * collide for a hypothetical future account that sees both — desktop-only,
 * since the mobile layout below never collapses.
 *
 * Desktop (md+) is the vertical rail: "Account" (profile), "Menu" (nav), and
 * a bottom-pinned theme/logout block — logout lives here and only here now;
 * naale/page.tsx and naale/staff/page.tsx no longer have their own.
 *
 * Mobile is two separate fixed elements, not the rail reflowed: a slim top
 * bar (identity + theme + logout — the two controls that don't fit a tab
 * bar) and a bottom tab bar for primary nav. Replaces an earlier version
 * that squeezed the whole rail into one horizontal-scrolling strip at the
 * top — nothing hinted that it scrolled, so Logout was reachable only by
 * knowing to swipe past "Practice." NaaleShell's content pane carries
 * matching bottom padding on mobile so the fixed tab bar never overlaps it.
 *
 * Rendered inside NaaleShell (see NaaleShell.tsx), which is a plain wrapper
 * with no opinion on text direction — the rail sits wherever the document's
 * real `dir` puts it, right-side in the app's actual Hebrew/RTL mode.
 */
export function NaaleSidebar({ role, showAdminLink, alsoRole }: NaaleSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  // One fixed order — practice items, then the admin item — regardless of
  // which page rendered the sidebar. An account that's both a Naale admin
  // and roster staff/student sees the exact same nav, in the exact same
  // order, whether it's currently on /naale/staff or /naale/admin
  // (naale-admin-staff-nav-link). "Admin" is treated as one additional flag
  // layered on top of the roster role, never a competing base role.
  const rosterRole = role === 'admin' ? alsoRole : role
  const isAdmin = role === 'admin' || !!showAdminLink
  const practiceItems = rosterRole === 'staff' ? STAFF_ITEMS : rosterRole === 'student' ? STUDENT_ITEMS : []
  const items = isAdmin ? [...practiceItems, ...ADMIN_ITEMS] : practiceItems

  const { profile, loading: profileLoading } = useNaaleProfile(role)
  const fullName = profile?.full_name ?? null
  const avatarUrl = profile?.avatar_url ?? null

  const [collapsed, setCollapsed] = useState(
    () => typeof document !== 'undefined' && document.cookie.includes('naale_sidebar_collapsed=1')
  )
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

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

  // Desktop-rail-only concern — the mobile top bar and bottom tab bar below
  // never read `collapsed` at all, so this only ever adds an `md:` prefixed
  // class, matching the rail's own `hidden md:flex`.
  const hideOnCollapse = collapsed ? 'md:hidden' : ''
  // Centered while collapsed (a narrow icon-only rail); `justify-start`
  // only once there's a label next to the icon to align against.
  const justifyClass = collapsed ? 'justify-center' : 'justify-start'

  function isActive(item: NavItem) {
    return item.exact
      ? pathname === item.route
      : pathname === item.route || pathname.startsWith(`${item.route}/`)
  }

  return (
    <>
      {/* Mobile-only utility strip — replaces the old horizontal scrolling
          version of the full sidebar, which had no visual hint that it
          scrolled and buried Logout/Dark mode past the visible edge. Primary
          nav moves to the bottom tab bar below; this keeps account identity
          and the two controls that don't fit a tab bar reachable. */}
      <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-card-border bg-surface">
        <Link href="/naale/profile" className="flex items-center gap-2 min-w-0">
          {fullName && <Avatar name={fullName} avatarUrl={avatarUrl} sizeClass="w-7 h-7 text-xs" />}
          <span className="font-bold text-fg whitespace-nowrap">{t('נעלה')}</span>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}
            title={t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            onClick={() => setShowLogoutDialog(true)}
            aria-label={t('יציאה')}
            title={t('יציאה')}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>

      {/* Mobile-only bottom tab bar — primary nav, thumb-reachable, no
          scrolling and no hidden items. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t border-card-border bg-surface [padding-bottom:env(safe-area-inset-bottom)]">
        {items.map(item => (
          <Link
            key={item.slug}
            href={item.route}
            aria-current={isActive(item) ? 'page' : undefined}
            aria-label={t(item.name)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-2 text-[11px] font-medium transition ${isActive(item) ? 'text-highlight' : 'text-fg/50'
              }`}
          >
            <span className="text-lg" aria-hidden>{item.emoji}</span>
            {t(item.name)}
          </Link>
        ))}
      </nav>

      {/* Desktop rail — unaffected by the mobile layout above; hidden below
          md, exactly the shell this component always was from md up. */}
      <aside
        className={`hidden md:flex ${collapsed ? 'md:w-14' : 'md:w-60'} shrink-0 md:h-screen md:sticky md:top-0 bg-surface md:border-l border-card-border p-4 md:flex-col gap-4 transition-all`}
      >
        <div className="flex items-center justify-between shrink-0">
          <span className={`font-bold text-fg whitespace-nowrap ${hideOnCollapse}`}>{t('נעלה')}</span>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t(collapsed ? 'הרחב סרגל' : 'כווץ סרגל')}
            aria-expanded={!collapsed}
            title={t(collapsed ? 'הרחב סרגל' : 'כווץ סרגל')}
            className="flex items-center justify-center w-11 h-11 -m-1.5 rounded-lg text-fg/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-fg/80 transition shrink-0"
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
              <Link
                href="/naale/profile"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                <Avatar name={fullName} avatarUrl={avatarUrl} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg truncate">{fullName.split(' ')[0]}</div>
                  <div className="text-xs text-fg/50">{t(role === 'admin' ? 'מנהל' : role === 'staff' ? 'צוות' : 'תלמיד')}</div>
                </div>
              </Link>
            )
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <span className={`text-[10px] font-semibold tracking-wide text-fg/40 uppercase px-3 ${hideOnCollapse}`}>{t('תפריט')}</span>
          <nav className="flex flex-col gap-1">
            {items.map(item => (
              <Link
                key={item.slug}
                href={item.route}
                aria-current={isActive(item) ? 'page' : undefined}
                aria-label={t(item.name)}
                title={t(item.name)}
                className={`flex items-center ${justifyClass} gap-2 px-3 min-h-[44px] rounded-lg text-sm whitespace-nowrap transition ${isActive(item) ? 'bg-highlight/10 text-highlight' : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
              >
                <span aria-hidden>{item.emoji}</span>
                <span className={hideOnCollapse}>{t(item.name)}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1 shrink-0 md:mt-auto">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}
            title={t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}
            className={`flex items-center ${justifyClass} gap-2 px-3 min-h-[44px] rounded-lg text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span className={hideOnCollapse}>{t(theme === 'dark' ? 'מצב בהיר' : 'מצב כהה')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutDialog(true)}
            aria-label={t('יציאה')}
            title={t('יציאה')}
            className={`flex items-center ${justifyClass} gap-2 px-3 min-h-[44px] rounded-lg text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition`}
          >
            <LogoutIcon />
            <span className={hideOnCollapse}>{t('יציאה')}</span>
          </button>
        </div>
      </aside>

      {showLogoutDialog && (
        <LogoutDialog onConfirm={confirmLogout} onCancel={() => setShowLogoutDialog(false)} />
      )}
    </>
  )
}
