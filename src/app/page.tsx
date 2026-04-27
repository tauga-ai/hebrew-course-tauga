'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const session = localStorage.getItem('student_session')
    if (session) {
      router.replace('/menu')
    } else {
      router.replace('/student')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-lg">טוען...</div>
    </div>
  )
}
