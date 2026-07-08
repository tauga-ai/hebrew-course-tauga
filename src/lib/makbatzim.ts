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

export type { Segment, SetKey, SetMeta, MakbatzimQuestion }
export { SETS, getSetMeta, getSetQuestions, getQuestionById, getTotalQuestionCount, gradeAnswer }
