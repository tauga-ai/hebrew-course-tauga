export interface InterviewQuestion {
  id: number
  text: string
  category: 'אישי' | 'עברית' | 'משפחה' | 'לימודים' | 'פנאי' | 'צבא' | 'עתיד' | 'מאתגר'
}

export const MANDATORY_QUESTIONS: InterviewQuestion[] = [
  { id: 1, text: 'איך קוראים לך?', category: 'אישי' },
  { id: 2, text: 'מאיפה אתה?', category: 'אישי' },
  { id: 3, text: 'איפה אתה גר?', category: 'אישי' },
  { id: 4, text: 'בן כמה אתה?', category: 'אישי' },
  { id: 5, text: 'איך העברית שלך?', category: 'עברית' },
  { id: 6, text: 'אתה מדבר עברית בבית?', category: 'עברית' },
]

export const ADDITIONAL_QUESTIONS: InterviewQuestion[] = [
  { id: 7,  text: 'עם מי אתה מדבר עברית?', category: 'עברית' },
  { id: 8,  text: 'איפה למדת עברית?', category: 'עברית' },
  { id: 9,  text: 'כמה זמן אתה לומד עברית?', category: 'עברית' },
  { id: 10, text: 'מה קשה לך בעברית?', category: 'עברית' },
  { id: 11, text: 'מה קל לך בעברית?', category: 'עברית' },
  { id: 12, text: 'ספר לי על המשפחה שלך', category: 'משפחה' },
  { id: 13, text: 'כמה אחים יש לך?', category: 'משפחה' },
  { id: 14, text: 'יש לך אחים או אחיות?', category: 'משפחה' },
  { id: 15, text: 'מה ההורים שלך עושים?', category: 'משפחה' },
  { id: 16, text: 'אתה גר עם המשפחה שלך?', category: 'משפחה' },
  { id: 17, text: 'אתה קרוב למשפחה שלך?', category: 'משפחה' },
  { id: 18, text: 'מה אתה לומד בבית הספר?', category: 'לימודים' },
  { id: 19, text: 'איזה מקצוע אתה אוהב?', category: 'לימודים' },
  { id: 20, text: 'איזה מקצוע קשה לך?', category: 'לימודים' },
  { id: 21, text: 'אתה תלמיד טוב? למה?', category: 'לימודים' },
  { id: 22, text: 'אתה עושה שיעורי בית?', category: 'לימודים' },
  { id: 23, text: 'איך הולך לך בלימודים?', category: 'לימודים' },
  { id: 24, text: 'מה אתה עושה בזמן הפנוי?', category: 'פנאי' },
  { id: 25, text: 'יש לך תחביבים?', category: 'פנאי' },
  { id: 26, text: 'אתה עושה ספורט? איזה?', category: 'פנאי' },
  { id: 27, text: 'אתה נפגש עם חברים?', category: 'פנאי' },
  { id: 28, text: 'מה אתה אוהב לעשות עם חברים?', category: 'פנאי' },
  { id: 29, text: 'מה אתה רוצה לעשות בצבא?', category: 'צבא' },
  { id: 30, text: 'לאן אתה רוצה להגיע בצבא?', category: 'צבא' },
  { id: 31, text: 'למה אתה רוצה את התפקיד הזה?', category: 'צבא' },
  { id: 32, text: 'חשוב לך לשרת בצבא? למה?', category: 'צבא' },
  { id: 33, text: 'אתה מוכן לשירות צבאי?', category: 'צבא' },
  { id: 34, text: 'מה אתה רוצה ללמוד בעתיד?', category: 'עתיד' },
  { id: 35, text: 'מה אתה רוצה להיות בעתיד?', category: 'עתיד' },
  { id: 36, text: 'יש לך מטרות לעתיד?', category: 'עתיד' },
  { id: 37, text: 'איפה אתה רואה את עצמך בעתיד?', category: 'עתיד' },
]

export const HARD_QUESTIONS: InterviewQuestion[] = [
  { id: 38, text: 'למה אתה חושב שחשוב ללמוד עברית לשירות בצבא?', category: 'מאתגר' },
  { id: 39, text: 'תאר מצב שהיה לך קשה בלימודים ואיך התמודדת עם זה', category: 'מאתגר' },
  { id: 40, text: 'מה לדעתך האתגר הכי גדול שלך בעברית?', category: 'מאתגר' },
  { id: 41, text: 'איך אתה חושב שתוכל לשפר את העברית שלך בזמן הקרוב?', category: 'מאתגר' },
  { id: 42, text: 'למה בחרת את התפקיד שאתה רוצה בצבא?', category: 'מאתגר' },
  { id: 43, text: 'איך אתה חושב שהשירות בצבא ישפיע על העתיד שלך?', category: 'מאתגר' },
  { id: 44, text: 'תאר יום רגיל שלך מהבוקר עד הערב', category: 'מאתגר' },
  { id: 45, text: 'מה לדעתך ההבדל בין לימודים בבית ספר ללמידה עצמאית?', category: 'מאתגר' },
  { id: 46, text: 'ספר על משהו שלמדת לאחרונה והיה לך מעניין', category: 'מאתגר' },
  { id: 47, text: 'איך אתה מתמודד עם מצבים של לחץ או קושי?', category: 'מאתגר' },
  { id: 48, text: 'מה לדעתך חשוב יותר – לעבוד קשה או להיות מוכשר? למה?', category: 'מאתגר' },
  { id: 49, text: 'תאר מטרה שיש לך ואיך אתה מתכנן להגיע אליה', category: 'מאתגר' },
  { id: 50, text: 'מה היית רוצה לשפר בעצמך ולמה?', category: 'מאתגר' },
]

export const ALL_PRACTICE_QUESTIONS: InterviewQuestion[] = [
  ...MANDATORY_QUESTIONS,
  ...ADDITIONAL_QUESTIONS,
  ...HARD_QUESTIONS,
]

export function buildSimulationQuestions(): InterviewQuestion[] {
  const pool = [...ADDITIONAL_QUESTIONS, ...HARD_QUESTIONS]
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return [...MANDATORY_QUESTIONS, ...shuffled.slice(0, 9)]
}

export const CATEGORY_COLORS: Record<string, string> = {
  'אישי':    'bg-blue-100 text-blue-700',
  'עברית':   'bg-purple-100 text-purple-700',
  'משפחה':   'bg-pink-100 text-pink-700',
  'לימודים': 'bg-yellow-100 text-yellow-700',
  'פנאי':    'bg-green-100 text-green-700',
  'צבא':     'bg-red-100 text-red-700',
  'עתיד':    'bg-indigo-100 text-indigo-700',
  'מאתגר':   'bg-orange-100 text-orange-700',
}
