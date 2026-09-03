/**
 * Uploads Noam's 30 picture-description images to the private `naale-pictures` Supabase Storage
 * bucket, keyed by position: local `q{n}.{ext}` -> stored `12/{n}` (12 is the topic number
 * `naale-picture-description-stt` registers for "תיאור תמונה בקול" / picture description, spoken
 * — each topic gets its own folder within the bucket, so future topics/content don't pile up
 * flat at the bucket root alongside this one). Positional mapping to spreadsheet rows was
 * confirmed with Noam — see .claude/ai-docs/docs/naale-content-update-8-18/answers.md.
 *
 * Stored extension-less on purpose: the serving route (/api/naale/pictures/[number]) used to
 * need a list() call to discover which extension a given picture actually had (source images
 * are a mix of .jpg/.png); dropping the extension from the stored key means the route can build
 * the exact path directly with zero lookup, and the browser still gets the right image type from
 * the `contentType` set on upload below, not from the key name.
 *
 * Source images are gitignored and local-only (`.claude/requirements/...`), not in the repo.
 *
 * Upserts, so re-running to replace a corrected image is safe rather than requiring a teardown.
 *
 * Resizes and re-encodes every source image before upload (naale-picture-description-image-
 * compression) — source files ranged up to 10.1MB as-is, served unmodified through the display
 * route to a card that only ever renders the image at max-w-sm (384 CSS px), so almost none of
 * that resolution/weight was ever visible. Output is always JPEG regardless of source format
 * (flatten() composites any alpha channel onto white first, since JPEG has no alpha support).
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/upload-naale-pictures.ts [--dry-run]
 */
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import sharp from 'sharp'
import { createServiceClient } from '../src/lib/supabase/service'

const TOPIC_NUMBER = 12
const BUCKET = 'naale-pictures'
const TOTAL_IMAGES = 30
const SOURCE_DIR = path.join(
  process.cwd(),
  '.claude/requirements/naale-update-8-18/תמונות - images',
)
// Comfortably covers the display card's actual size (aspect-[4/3] object-contain inside
// max-w-sm, i.e. 384 CSS px — never wider, mobile or desktop, no responsive override) even at
// retina density, while cutting the largest source files (up to 10.1MB, 2816x1536) by 10-20x.
const MAX_DIMENSION = 1200
const JPEG_QUALITY = 82

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
    const destPath = `${TOPIC_NUMBER}/${n}`

    if (dryRun) {
      console.log(`[dry-run] ${sourceName} -> ${destPath}`)
      continue
    }

    const original = readFileSync(path.join(SOURCE_DIR, sourceName))
    const compressed = await sharp(original)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()

    const { error } = await db.storage.from(BUCKET).upload(destPath, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    })
    if (error) throw new Error(`${sourceName} -> ${destPath}: ${error.message}`)
    console.log(
      `uploaded ${sourceName} -> ${destPath} ` +
      `(${(original.length / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB)`
    )
  }

  console.log(dryRun ? 'dry run complete, nothing uploaded' : `uploaded ${TOTAL_IMAGES} images`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
