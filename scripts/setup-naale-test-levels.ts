import { createServiceClient } from '../src/lib/supabase/service'

async function setup() {
  const client = createServiceClient()

  // Get students 1 and 2's auth users
  const { data: authData } = await client.auth.admin.listUsers()
  const emails = ['naale_student1@test.com', 'naale_student2@test.com']
  
  for (const email of emails) {
    const authUser = authData?.users?.find(u => u.email === email)
    if (!authUser) {
      console.log(`${email} not found`)
      continue
    }

    console.log(`Setting up levels for ${email}...`)

    // Get the student record for this auth user
    const { data: students, error: studentError } = await client
      .from('students')
      .select('id')
      .eq('auth_user_id', authUser.id)

    if (studentError || !students || students.length === 0) {
      console.log(`Could not find student record. Error:`, studentError?.message)
      continue
    }

    const studentId = students[0].id
    console.log(`  Student ID:`, studentId)

    // Upsert topic level for reading comprehension
    const { error } = await client
      .from('naale_topic_levels')
      .upsert(
        {
          student_id: studentId,
          topic: 'הבנת הנקרא',
          level: 3,
        },
        { onConflict: 'student_id,topic' }
      )

    console.log(`  Updated topic level. Error:`, error?.message || 'none')
  }
}

setup().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
