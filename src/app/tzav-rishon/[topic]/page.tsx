'use client'

import { useParams } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useQuizEngine } from '@/lib/hooks/use-quiz-engine'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Segments } from '@/components/tzav-rishon/Segments'
import { QuestionMap } from '@/components/tzav-rishon/QuestionMap'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { useLanguage } from '@/components/tzav-rishon/LanguageContext'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { t } from '@/lib/dev-i18n'
import type { Segment } from '@/data/tzav-rishon/types'

interface Bilingual { he: Segment[]; ar: Segment[] }

interface QuestionOut {
  id: number
  question: Bilingual
  options: Bilingual[]
}

interface TopicMeta {
  key: string
  labelHe: string
  labelAr: string
  count: number
}

export default function TzavRishonPracticePage() {
  const params = useParams()
  const topic = String(params.topic)
  const { session, loading: sessionLoading } = useStudentSession()
  const { language, setLanguage } = useLanguage()
  const isAr = language === 'ar'

  const engine = useQuizEngine<QuestionOut, TopicMeta, Bilingual>({
    entityId: topic,
    session,
    questionsUrl: `/api/tzav-rishon/questions?topic=${topic}`,
    progressUrl: `/api/tzav-rishon/progress?topic=${topic}`,
    entityMetaUrl: '/api/tzav-rishon/topics',
    entityMetaKey: 'topics',
    submitUrl: '/api/tzav-rishon/submit',
    submitBodyExtra: { topic },
    submitErrorMessage: isAr ? 'خطأ في الإرسال' : t('שגיאה בשליחה'),
  })

  if (engine.loadError && engine.questions === null) {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-red-500 dark:text-red-400 text-sm">{engine.loadError}</p>
          <button onClick={engine.retryLoad} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">{t('נסה שוב')}</button>
        </div>
      </div>
    )
  }

  if (sessionLoading || engine.loading || !engine.current || !engine.entityMeta) return <LoadingSpinner />

  const { current, answered, total, currentIndex, answeredCount, submitting, error, resultsByQuestion, entityMeta: topicMeta } = engine

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div lang={isAr ? 'ar' : 'he'} className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        backHref="/tzav-rishon"
        title={isAr ? topicMeta.labelAr : topicMeta.labelHe}
        titleColorClass="text-accent-tzav-rishon-fg"
        right={<LtrIsolate>{`${answeredCount}/${total}`}</LtrIsolate>}
      />

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setLanguage('he')}
          className={`py-1.5 rounded-lg text-sm font-semibold border transition ${
            language === 'he'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-surface text-fg border-card-border hover:border-accent-tzav-rishon'
          }`}
        >
          {t('עברית')}
        </button>
        <button
          onClick={() => setLanguage('ar')}
          className={`py-1.5 rounded-lg text-sm font-semibold border transition ${
            language === 'ar'
              ? 'bg-accent-tzav-rishon text-white border-accent-tzav-rishon'
              : 'bg-surface text-fg border-card-border hover:border-accent-tzav-rishon'
          }`}
        >
          العربية
        </button>
      </div>

      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 mb-4">
        <div
          className="bg-accent-tzav-rishon h-2 rounded-full transition-all"
          style={{ width: `${(answeredCount / total) * 100}%` }}
        />
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
        <div className="text-xs text-fg/40 mb-3">
          {isAr ? 'السؤال' : t('שאלה')} <LtrIsolate>{`${currentIndex + 1} / ${total}`}</LtrIsolate>
        </div>
        <p className="text-fg leading-relaxed text-base">
          <Segments segments={current.question[language]} />
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {current.options.map((opt, i) => {
          const optionNum = i + 1
          const isSelected = answered?.selected_option === optionNum
          const isTheCorrectOne = answered && answered.correct_option === optionNum
          let stateClass = 'bg-surface border-card-border hover:border-accent-tzav-rishon text-fg'
          if (answered) {
            if (isTheCorrectOne) stateClass = 'bg-green-50 border-green-400 text-green-800 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300'
            else if (isSelected) stateClass = 'bg-red-50 border-red-400 text-red-800 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300'
            else stateClass = 'bg-surface border-card-border text-fg/60'
          }
          return (
            <button
              key={i}
              onClick={() => !answered && engine.selectOption(optionNum)}
              disabled={!!answered || submitting}
              className={`w-full text-right rounded-xl border-2 p-4 transition flex items-center gap-3 disabled:cursor-default ${stateClass}`}
            >
              <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-black/5 dark:bg-white/10">
                {optionNum}
              </span>
              <span className="flex-1"><Segments segments={opt[language]} /></span>
              {answered && isTheCorrectOne && (
                <span className="text-green-700 dark:text-green-400 font-bold flex-shrink-0">✓<span className="sr-only">{isAr ? ' إجابة صحيحة' : t(' תשובה נכונה')}</span></span>
              )}
              {answered && isSelected && !isTheCorrectOne && (
                <span className="text-red-700 dark:text-red-400 font-bold flex-shrink-0">✗<span className="sr-only">{isAr ? ' اخترت هذه الإجابة، خاطئة' : t(' בחרת בתשובה זו, שגויה')}</span></span>
              )}
            </button>
          )
        })}
      </div>

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{error}</p>}

      {answered && (
        <div className={`rounded-2xl p-4 mb-4 border ${answered.is_correct ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'}`}>
          <div className={`font-bold mb-2 ${answered.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {answered.is_correct
              ? (isAr ? 'إجابة صحيحة!' : t('תשובה נכונה!'))
              : (isAr ? 'إجابة غير صحيحة' : t('תשובה לא נכונה'))}
          </div>
          {answered.explanation && (
            <div className="text-sm text-fg/80 leading-relaxed">
              <Segments segments={answered.explanation[language]} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={engine.goPrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {isAr ? '← السابق' : t('← הקודמת')}
        </button>
        <button
          onClick={engine.goNext}
          disabled={currentIndex === total - 1}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {isAr ? 'التالي →' : t('הבאה →')}
        </button>
      </div>

      <QuestionMap count={total} currentIndex={currentIndex} results={resultsByQuestion} onJump={engine.jumpTo} />
      </div>
    </div>
  )
}
