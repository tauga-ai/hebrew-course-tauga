'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

const NAV_ITEMS: { href: string; label: string; classes: string }[] = [
  { href: '/teacher/dashboard', label: 'לוח בקרה', classes: 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20' },
  { href: '/teacher/monitor', label: '🔴 ניטור בזמן אמת', classes: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20' },
  { href: '/teacher/students', label: 'הבנת הנקרא', classes: 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20' },
  { href: '/teacher/activity', label: 'משפטים + ראיון', classes: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20' },
  { href: '/teacher/simulation-report', label: '🏆 סימולציה עברית', classes: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20' },
  { href: '/teacher/tzav-rishon', label: 'צו ראשון פסיכוטכני בערבית', classes: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20' },
  { href: '/teacher/makbatzim', label: 'מקבצים פסיכוטכני', classes: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/20' },
  { href: '/teacher/dapar-simulation', label: '📘 סימולציית דפ״ר', classes: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20' },
]

interface TeacherClassOption {
  id: number
  name: string
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Class selector — renders for admins (who can view every class) and for
 * any regular teacher who owns more than one class (e.g. teaching both
 * Arabic and Russian); absent otherwise, since /api/teacher/classes only
 * ever returns more than one class in those two cases. Switching class
 * sets the `active_class_id` cookie that getClassAndStudents() reads
 * server-side, then reloads so every page re-fetches under it.
 */
function ClassSelector() {
  const [classes, setClasses] = useState<TeacherClassOption[]>([])
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/teacher/classes')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !Array.isArray(data?.classes)) return
        setClasses(data.classes)
        setActiveId(getCookie('active_class_id') || String(data.classes[0]?.id || ''))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (classes.length <= 1) return null

  function handleChange(id: string) {
    document.cookie = `active_class_id=${id}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <select
      value={activeId}
      onChange={e => handleChange(e.target.value)}
      className="text-sm border border-card-border rounded-lg px-2 py-1.5 bg-surface text-fg/80"
    >
      {classes.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}

/** Shared chrome (nav + logout) for every authenticated teacher page — proxy.ts is the actual auth gate. */
export default function TeacherProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/teacher/login')
  }

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap gap-2 items-center justify-between mt-4 mb-6">
        <nav className="flex flex-wrap gap-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${item.classes} ${
                pathname === item.href ? 'ring-2 ring-offset-1 ring-primary-400' : ''
              }`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ClassSelector />
          <ThemeToggle />
          <button onClick={handleLogout} className="text-sm text-fg/40 hover:text-fg/70">
            יציאה
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
