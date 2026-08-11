'use client'

import { FeatureReport } from '@/components/teacher/FeatureReport'
import { t } from '@/lib/dev-i18n'

export default function MakbatzimTeacherPage() {
  return (
    <FeatureReport
      title={t('דוח מקבצים פסיכוטכני')}
      titleColorClass="text-primary-700 dark:text-primary-400"
      reportEndpoint="/api/teacher/makbatzim"
      entitiesEndpoint="/api/makbatzim/sets"
      entitiesResponseKey="sets"
      excludeEntityKeys={['dapar-simulation']}
      filterParamName="set_id"
      filterLabel={t('מקבץ')}
      allOptionLabel={t('כל המקבצים')}
      selectedLabelColorClass="text-primary-600 dark:text-primary-400"
      summaryTabLabel={t('סיכום מקבצים')}
      accent={{
        activeTab: 'bg-accent-makbatzim',
        hoverBorder: 'hover:border-accent-makbatzim',
        ring: 'focus:ring-accent-makbatzim',
      }}
    />
  )
}
