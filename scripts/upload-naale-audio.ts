/**
 * Uploads Noam's 53 Listening Comprehension audio clips to the private
 * `naale-audio` Supabase Storage bucket, keyed by position: local
 * `audio_{n}.mp3` -> stored `5/{n}.mp3` (5 is the topic number
 * naale-listening-comprehension-content registers for "הבנת הנשמע" /
 * listening comprehension) — same per-topic-folder convention as
 * upload-naale-pictures.ts, but keeping the `.mp3` extension in the stored
 * key: unlike pictures (a mix of source jpg/png all normalized to jpg,
 * which is why that bucket strips extensions and relies on the upload-time
 * contentType instead), every source clip here is already .mp3, so there's
 * no format-mixing reason to drop it — keeping it makes the bucket
 * browsable/debuggable directly in the Supabase dashboard without needing
 * to know the content-type out of band.
 *
 * No re-encoding step, unlike the picture upload script's sharp()
 * compression — these clips are already small (largest ~560KB) and the
 * serving route streams them unmodified.
 *
 * Upserts, so re-running to replace a corrected clip is safe rather than
 * requiring a teardown.
 *
 * Source files are gitignored and local-only (.claude/resources/...), not in
 * the repo.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/upload-naale-audio.ts [--dry-run]
 */
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { createServiceClient } from '../src/lib/supabase/service'

const TOPIC_NUMBER = 5
const BUCKET = 'naale-audio'
const TOTAL_CLIPS = 53
const SOURCE_DIR = path.join(
  process.cwd(),
  '.claude/resources/Listening Comprehension Module/קטעי אודיו',
)

function sourceFileFor(n: number): string {
  const p = path.join(SOURCE_DIR, `audio_${n}.mp3`)
  if (!existsSync(p)) throw new Error(`missing source audio for row ${n}: ${p}`)
  return p
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const db = createServiceClient()

  for (let n = 1; n <= TOTAL_CLIPS; n++) {
    const sourcePath = sourceFileFor(n)
    const destPath = `${TOPIC_NUMBER}/${n}.mp3`

    if (dryRun) {
      console.log(`[dry-run] ${sourcePath} -> ${destPath}`)
      continue
    }

    const bytes = readFileSync(sourcePath)
    const { error } = await db.storage.from(BUCKET).upload(destPath, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    })
    if (error) throw new Error(`${sourcePath} -> ${destPath}: ${error.message}`)
    console.log(`uploaded audio_${n}.mp3 -> ${destPath} (${(bytes.length / 1024).toFixed(0)}KB)`)
  }

  console.log(dryRun ? 'dry run complete, nothing uploaded' : `uploaded ${TOTAL_CLIPS} audio clips`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
