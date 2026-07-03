'use client'

import type { StudentSession } from '@/lib/types'
import type { SimulationResults } from '../page'

interface ResultsPhaseProps {
  session: StudentSession | null
  results: SimulationResults
  onBackToMenu: () => void
}

/** Final summary screen shown after all 4 simulation parts are complete. */
export function ResultsPhase({ session, results, onBackToMenu }: ResultsPhaseProps) {
  const readingTotal = results.part_a.total + results.part_b.total
  const readingCorrect = results.part_a.correct + results.part_b.correct
  const readingPct = Math.round((readingCorrect / readingTotal) * 100)

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto pb-12">
      <div className="text-center mt-6 mb-6">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold text-primary-700">סיימת את הסימולציה!</h1>
        <p className="text-gray-500 text-sm">{session?.full_name}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-primary-700">{readingPct}%</div>
          <div className="text-xs text-primary-600 mt-1">הבנת הנקרא (א+ב)<br/>{readingCorrect}/{readingTotal}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-purple-700">{results.part_c.avg}/10</div>
          <div className="text-xs text-purple-600 mt-1">בניית משפטים (ממוצע)</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{results.part_a.pct}%</div>
          <div className="text-xs text-green-600 mt-1">חלק א — שאלות קשות<br/>{results.part_a.correct}/{results.part_a.total}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-700">{results.part_b.pct}%</div>
          <div className="text-xs text-orange-600 mt-1">חלק ב — שאלות קשות מאוד<br/>{results.part_b.correct}/{results.part_b.total}</div>
        </div>
      </div>

      {/* Interview score */}
      <div className={`rounded-2xl border p-4 text-center mb-5 ${results.part_d.score >= 70 ? 'bg-green-50 border-green-200' : results.part_d.score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`text-4xl font-bold ${results.part_d.score >= 70 ? 'text-green-600' : results.part_d.score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{results.part_d.score}/100</div>
        <div className="text-sm text-gray-600 mt-1">ראיון אישי — {results.part_d.level}</div>
        <p className="text-gray-600 text-sm mt-2 leading-relaxed">{results.part_d.summary}</p>
      </div>

      <button onClick={onBackToMenu}
        className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition">
        חזור לתפריט
      </button>
    </div>
  )
}
