'use client'

import { t } from '@/lib/dev-i18n'

export function SpeechToTextToggle({
  isListening,
  supported,
  onToggle,
}: {
  isListening: boolean
  supported: boolean
  onToggle: () => void
}) {
  if (!supported) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
        isListening
          ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 animate-pulse'
          : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'
      }`}
    >
      <span>{isListening ? '⏹' : '🎤'}</span>
      <span>{isListening ? t('עצור') : t('הקלט')}</span>
    </button>
  )
}
