import { test } from 'node:test'
import assert from 'node:assert/strict'
import katex from 'katex'
import type { MakbatzimQuestion, Segment } from '../src/data/makbatzim/types'
import set1Data from '../src/data/makbatzim/set-1/data.json'
import set2Data from '../src/data/makbatzim/set-2/data.json'
import set3Data from '../src/data/makbatzim/set-3/data.json'
import set4Data from '../src/data/makbatzim/set-4/data.json'
import set1TzuraniData from '../src/data/makbatzim/set-1-tzurani/data.json'
import daparSimulationData from '../src/data/makbatzim/dapar-simulation/data.json'

const SETS: Record<string, MakbatzimQuestion[]> = {
  'set-1': set1Data as MakbatzimQuestion[],
  'set-2': set2Data as MakbatzimQuestion[],
  'set-3': set3Data as MakbatzimQuestion[],
  'set-4': set4Data as MakbatzimQuestion[],
  'set-1-tzurani': set1TzuraniData as MakbatzimQuestion[],
  'dapar-simulation': daparSimulationData as MakbatzimQuestion[],
}

/**
 * The conversion script's brace-balance check is a NECESSARY but not
 * SUFFICIENT condition for valid LaTeX (e.g. `\frac{x}` is balanced but
 * missing \frac's second argument). This test is the real check: every math
 * segment actually shipped to students must be renderable by the exact
 * library the app uses to render it. throwOnError:true here (unlike the
 * app's own throwOnError:false) is deliberate — we want this test to fail
 * loudly on anything KaTeX would otherwise silently show as a red error to
 * a student.
 */
function collectMathSegments(q: MakbatzimQuestion): { field: string; content: string }[] {
  const out: { field: string; content: string }[] = []
  const collect = (field: string, segs: Segment[]) => {
    for (const s of segs) if (s.type === 'math') out.push({ field, content: s.content })
  }
  collect('question', q.question)
  collect('explanation', q.explanation)
  q.options.forEach((o, i) => collect(`option[${i}]`, o))
  return out
}

for (const [setKey, questions] of Object.entries(SETS)) {
  test(`${setKey}: every math segment renders through KaTeX without a parse error`, () => {
    const failures: string[] = []
    for (const q of questions) {
      for (const { field, content } of collectMathSegments(q)) {
        try {
          katex.renderToString(content, { throwOnError: true })
        } catch (err) {
          failures.push(`q${q.id} ${field}: ${JSON.stringify(content)} -> ${(err as Error).message}`)
        }
      }
    }
    assert.deepEqual(failures, [], `KaTeX rejected ${failures.length} segment(s):\n${failures.join('\n')}`)
  })
}
