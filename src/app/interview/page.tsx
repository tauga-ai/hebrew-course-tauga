'use client'

import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'

export default function InterviewLanding() {
  const router = useRouter()
  const { session } = useStudentSession()

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
      <PageHeader backHref="/menu" backLabel="← חזרה לתפריט" right={session?.full_name} />

      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🗣️</div>
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">ראיון אישי</h1>
        <p className="text-fg/60 text-sm">תרגול לראיון אישי בעברית לקראת השירות הצבאי</p>
      </div>

      <div className="space-y-4">
        {/* Practice */}
        <button
          onClick={() => router.push('/interview/practice')}
          className="w-full text-right bg-surface rounded-2xl border border-card-border p-6 hover:border-primary-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl mb-2">📋</div>
              <h2 className="font-bold text-fg text-lg group-hover:text-primary-700">תרגול שאלות</h2>
              <p className="text-sm text-fg/60 mt-1 leading-relaxed">
                50 שאלות ראיון, שאלה אחר שאלה.<br />
                כתוב או הקלט את התשובות שלך.<br />
                <span className="text-fg/40">ללא ניקוד, לתרגול עצמאי</span>
              </p>
            </div>
            <span className="text-primary-400 text-2xl group-hover:translate-x-1 transition-transform">←</span>
          </div>
        </button>

        {/* Simulation */}
        <button
          onClick={() => router.push('/interview/simulate')}
          className="w-full text-right bg-primary-600 rounded-2xl border border-primary-600 p-6 hover:bg-primary-700 transition group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl mb-2">🤖</div>
              <h2 className="font-bold text-white text-lg">סימולציית ראיון עם AI</h2>
              <p className="text-sm text-primary-100 mt-1 leading-relaxed">
                15 שאלות עם מראיין AI.<br />
                קול + טקסט, ניתוח בסוף.<br />
                <span className="text-primary-200">ציון + פידבק מפורט מ-Gemini</span>
              </p>
            </div>
            <span className="text-white text-2xl group-hover:translate-x-1 transition-transform">←</span>
          </div>
        </button>
      </div>

      <div className="mt-8 bg-surface rounded-xl p-4 text-sm text-fg/60 text-right border border-card-border">
        <p className="font-medium text-fg/80 mb-1">💡 טיפ</p>
        <p>התחל עם תרגול השאלות כדי להכיר את הנושאים, ואחרי כן נסה את סימולציית הראיון.</p>
      </div>
      </div>
    </div>
  )
}
