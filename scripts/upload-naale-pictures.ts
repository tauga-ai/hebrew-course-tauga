/**
 * Uploads Noam's 30 picture-description images to the private `naale-pictures` Supabase Storage
 * bucket, keyed by position: local `q{n}.{ext}` -> stored `12/{n}.{ext}` (12 is the topic number
 * `naale-picture-description-stt` will register for "תיאור תמונה בקול" / picture description,
 * spoken — each topic gets its own folder within the bucket, so future topics/content don't pile
 * up flat at the bucket root alongside this one). Positional mapping to spreadsheet rows was
 * confirmed with Noam — see .claude/ai-docs/docs/naale-content-update-8-18/answers.md.
 *
 * Source images are gitignored and local-only (`.claude/requirements/...`), not in the repo.
 *
 * Upserts, so re-running to replace a corrected image is safe rather than requiring a teardown.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/upload-naale-pictures.ts [--dry-run]
 */
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { createServiceClient } from '../src/lib/supabase/service'

const TOPIC_NUMBER = 12
const BUCKET = 'naale-pictures'
const TOTAL_IMAGES = 30
const SOURCE_DIR = path.join(
  process.cwd(),
  '.claude/requirements/naale-update-8-18/תמונות - images',
)

function findSourceFile(files: string[], n: number): string {
  const match = files.find(f => new RegExp(`^q${n}\\.(jpg|jpeg|png)$`, 'i').test(f))
  if (!match) throw new Error(`missing source image for row ${n} in ${SOURCE_DIR}`)
  return match
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const db = createServiceClient()

  const files = readdirSync(SOURCE_DIR)
  if (files.length !== TOTAL_IMAGES) {
    throw new Error(`expected ${TOTAL_IMAGES} source images, found ${files.length} in ${SOURCE_DIR}`)
  }

  for (let n = 1; n <= TOTAL_IMAGES; n++) {
    const sourceName = findSourceFile(files, n)
    const ext = path.extname(sourceName)
    const destPath = `${TOPIC_NUMBER}/${n}${ext}`

    if (dryRun) {
      console.log(`[dry-run] ${sourceName} -> ${destPath}`)
      continue
    }

    const body = readFileSync(path.join(SOURCE_DIR, sourceName))
    const { error } = await db.storage.from(BUCKET).upload(destPath, body, {
      contentType: ext.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    })
    if (error) throw new Error(`${sourceName} -> ${destPath}: ${error.message}`)
    console.log(`uploaded ${sourceName} -> ${destPath}`)
  }

  console.log(dryRun ? 'dry run complete, nothing uploaded' : `uploaded ${TOTAL_IMAGES} images`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
