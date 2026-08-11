'use client'

import { FeatureReport } from '@/components/teacher/FeatureReport'
import { t } from '@/lib/dev-i18n'

export default function TzavRishonTeacherPage() {
  return (
    <FeatureReport
      title={t('דוח תרגול עצמי כמותי - עברית וערבית')}
      titleColorClass="text-accent-tzav-rishon-fg"
      reportEndpoint="/api/teacher/tzav-rishon"
      entitiesEndpoint="/api/tzav-rishon/topics"
      entitiesResponseKey="topics"
      filterParamName="topic"
      filterLabel={t('נושא')}
      allOptionLabel={t('כל הנושאים')}
      selectedLabelColorClass="text-accent-tzav-rishon-fg"
      summaryTabLabel={t('סיכום נושאים')}
      accent={{
        activeTab: 'bg-accent-tzav-rishon',
        hoverBorder: 'hover:border-accent-tzav-rishon',
        ring: 'focus:ring-accent-tzav-rishon',
      }}
    />
  )
}
