'use client'

import { FeatureReport } from '@/components/teacher/FeatureReport'

export default function MakbatzimTeacherPage() {
  return (
    <FeatureReport
      title="דוח מקבצים פסיכוטכני"
      titleColorClass="text-primary-700 dark:text-primary-400"
      reportEndpoint="/api/teacher/makbatzim"
      entitiesEndpoint="/api/makbatzim/sets"
      entitiesResponseKey="sets"
      filterParamName="set_id"
      filterLabel="מקבץ"
      allOptionLabel="כל המקבצים"
      selectedLabelColorClass="text-primary-600 dark:text-primary-400"
      summaryTabLabel="סיכום מקבצים"
      accent={{
        activeTab: 'bg-accent-makbatzim',
        hoverBorder: 'hover:border-accent-makbatzim',
        ring: 'focus:ring-accent-makbatzim',
      }}
    />
  )
}
