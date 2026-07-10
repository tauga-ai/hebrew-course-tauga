'use client'

import { FeatureReport } from '@/components/teacher/FeatureReport'

export default function TzavRishonTeacherPage() {
  return (
    <FeatureReport
      title='דוח תרגול עצמי כמותי - עברית וערבית'
      titleColorClass="text-accent-tzav-rishon-fg"
      reportEndpoint="/api/teacher/tzav-rishon"
      entitiesEndpoint="/api/tzav-rishon/topics"
      entitiesResponseKey="topics"
      filterParamName="topic"
      filterLabel="נושא"
      allOptionLabel="כל הנושאים"
      selectedLabelColorClass="text-accent-tzav-rishon-fg"
      summaryTabLabel="סיכום נושאים"
      accent={{
        activeTab: 'bg-accent-tzav-rishon',
        hoverBorder: 'hover:border-accent-tzav-rishon',
        ring: 'focus:ring-accent-tzav-rishon',
      }}
    />
  )
}
