'use client'

import { FeatureReport } from '@/components/teacher/FeatureReport'

export default function DaparSimulationTeacherPage() {
  return (
    <FeatureReport
      title="דוח סימולציית דפ״ר"
      titleColorClass="text-primary-700 dark:text-primary-400"
      reportEndpoint="/api/teacher/makbatzim"
      filterParamName="set_id"
      filterLabel="מקבץ"
      selectedLabelColorClass="text-primary-600 dark:text-primary-400"
      fixedEntity={{ key: 'dapar-simulation', labelHe: 'סימולציה דפ״ר' }}
      accent={{
        activeTab: 'bg-accent-makbatzim',
        hoverBorder: 'hover:border-accent-makbatzim',
        ring: 'focus:ring-accent-makbatzim',
      }}
    />
  )
}
