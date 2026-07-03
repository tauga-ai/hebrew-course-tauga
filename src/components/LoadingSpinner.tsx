'use client'

interface LoadingSpinnerProps {
  label?: string
}

/** Full-page centered loading indicator — replaces the plain "טוען..." text repeated across pages. */
export function LoadingSpinner({ label = 'טוען...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-gray-500">{label}</p>
      </div>
    </div>
  )
}
