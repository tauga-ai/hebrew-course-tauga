import 'server-only'
import {
  SETS,
  getSetMeta,
  getSetQuestions,
  getQuestionById,
  getTotalQuestionCount,
} from '@/data/makbatzim'
import type { Segment, SetKey, SetMeta, MakbatzimQuestion } from '@/data/makbatzim/types'
import { gradeAnswer } from './makbatzim-grading'
import { createServiceClient } from './supabase/service'

export type { Segment, SetKey, SetMeta, MakbatzimQuestion }
export { SETS, getSetMeta, getSetQuestions, getQuestionById, getTotalQuestionCount, gradeAnswer }

/**
 * Whether `studentId` has answered every question in `setId` — used to gate
 * when a set's correct answers may be revealed (e.g. dapar-simulation,
 * which withholds them until the whole 40-question set is done, unlike
 * every other makbatzim set which reveals immediately per question).
 */
export async function isSetComplete(db: ReturnType<typeof createServiceClient>, studentId: string, setId: string): Promise<boolean> {
  const total = getSetQuestions(setId)?.length ?? 0
  if (total === 0) return true
  const { count } = await db
    .from('makbatzim_results')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('set_id', setId)
  return (count ?? 0) >= total
}
