'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface TeacherStats {
  class_name: string
  join_code: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { email } = useTeacherAuth()
  const { data, loading, error } = useResource<TeacherStats>(email ? '/api/teacher/stats' : null)
  const className = data?.class_name ?? ''
  const joinCode = data?.join_code ?? ''
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (error) router.replace('/teacher/login')
  }, [error, router])

  function handleCopyCode() {
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return <LoadingSpinner />

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">לוח בקרה - מורה</h1>
        <p className="text-sm text-fg/60">{className} · {email}</p>
      </div>

      <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-primary-600 dark:text-primary-400 mb-1">קוד הצטרפות לכיתה, לשלוח לתלמידים חדשים</p>
          <p className="text-2xl font-bold text-primary-800 dark:text-primary-300 tracking-widest">{joinCode}</p>
        </div>
        <button
          onClick={handleCopyCode}
          className="text-sm bg-surface border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-500/20"
        >
          {copied ? 'הועתק!' : 'העתק'}
        </button>
      </div>
    </>
  )
}
