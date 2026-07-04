#!/usr/bin/env bun
// Copies the self-hosted webfont files out of the Bun-managed @fontsource
// packages and into ./assets/static/fonts, where wrangler's [site] config
// serves them at /static/fonts/. Bun owns the font versions (package.json);
// this step vendors the exact files we ship and serve ourselves — no CDN.
//
// Fonts: Fraunces (display serif, "standard" axis = opsz + wght, normal +
// italic) for the phase name; JetBrains Mono is the observatory "logbook" voice
// for the ephemeris data — illumination, coordinates, dates, the phase table.

import { rm } from 'node:fs/promises'

const FONTS = [
  '@fontsource-variable/fraunces/files/fraunces-latin-standard-normal.woff2',
  '@fontsource-variable/fraunces/files/fraunces-latin-standard-italic.woff2',
  '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'
]
const DEST_DIR = 'assets/static/fonts'

export const run = async (): Promise<void> => {
  let count = 0

  // Clear the vendored dir first so a renamed/removed font can't linger and get
  // shipped — this dir is gitignored and rebuilt from @fontsource every time.
  await rm(DEST_DIR, { recursive: true, force: true })

  for (const rel of FONTS) {
    const file = rel.split('/').pop()
    const src = Bun.file(`node_modules/${rel}`)

    if (!(await src.exists())) {
      console.error(`✗ Missing ${file} — run \`bun install\` first.`)
      process.exit(1)
    }

    await Bun.write(`${DEST_DIR}/${file}`, src)
    console.log(`✓ Font: ${DEST_DIR}/${file}`)
    count++
  }

  console.log(`Fonts synced — ${count} file(s) vendored from @fontsource.`)
}

// Allow running standalone: `bun run sync-fonts.ts`
if (import.meta.main) {
  await run()
}
