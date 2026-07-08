'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { useLanguage } from '@/components/tzav-rishon/LanguageContext'

interface TopicMeta {
  key: string
  labelHe: string
  labelAr: string
  count: number
}

export default function TzavRishonTopicsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useStudentSession()
  const { language, setLanguage } = useLanguage()
  const [topics, setTopics] = useState<TopicMeta[] | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/tzav-rishon/topics')
      .then(r => r.json())
      .then(data => { if (!cancelled) setTopics(data.topics || []) })
      .catch(() => { if (!cancelled) setTopics([]) })
    return () => { cancelled = true }
  }, [session])

  if (sessionLoading || topics === null) return <LoadingSpinner />

  const isAr = language === 'ar'

  return (
    <div lang={isAr ? 'ar' : 'he'} className="min-h-screen p-4 max-w-md mx-auto">
      <PageHeader
        backHref="/menu"
        title={isAr ? 'دفار للاستدعاء الأول' : 'דפ״ר לצו ראשון'}
        titleColorClass="text-accent-tzav-rishon"
      />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setLanguage('he')}
          className={`py-2.5 rounded-lg font-semibold border transition ${
            language === 'he'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-white text-gray-700 border-gray-300 hover:border-accent-tzav-rishon'
          }`}
        >
          עברית
        </button>
        <button
          onClick={() => setLanguage('ar')}
          className={`py-2.5 rounded-lg font-semibold border transition ${
            language === 'ar'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-white text-gray-700 border-gray-300 hover:border-accent-tzav-rishon'
          }`}
        >
          العربية
        </button>
      </div>

      <div className="grid gap-3">
        {topics.map(t => (
          <button
            key={t.key}
            onClick={() => router.push(`/tzav-rishon/${t.key}`)}
            className="w-full text-right bg-white rounded-xl border-2 border-gray-200 hover:border-accent-tzav-rishon hover:shadow-sm p-4 transition flex items-center justify-between"
          >
            <div>
              <div className="font-semibold text-gray-800">{isAr ? t.labelAr : t.labelHe}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {isAr ? `${t.count} سؤال` : `${t.count} שאלות`}
              </div>
            </div>
            <span className="text-accent-tzav-rishon text-xl">←</span>
          </button>
        ))}
      </div>
    </div>
  )
}
