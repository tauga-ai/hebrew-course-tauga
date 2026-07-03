'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS: { href: string; label: string; classes: string }[] = [
  { href: '/teacher/dashboard', label: 'לוח בקרה', classes: 'bg-primary-50 text-primary-700 hover:bg-primary-100' },
  { href: '/teacher/students', label: 'הבנת הנקרא', classes: 'bg-primary-50 text-primary-700 hover:bg-primary-100' },
  { href: '/teacher/activity', label: 'משפטים + ראיון', classes: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { href: '/teacher/simulation-report', label: '🏆 סימולציה', classes: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
  { href: '/teacher/psychotechnic', label: '🧠 פסיכוטכני', classes: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { href: '/teacher/dapar', label: 'דפ"ר', classes: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
]

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
        <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600 flex-shrink-0">
          יציאה
        </button>
      </div>
      {children}
    </div>
  )
}
