#!/usr/bin/env bun
// Builds the served static assets. The client TS is bundled to a self-executing
// classic script and the CSS is down-leveled + minified in place, both through
// @screenly-labs/signage-kit (shared support floor + pipeline). The shared
// degraded-mode kill-switch is prepended to the CSS by the kit (includeDegraded),
// so it lives in the package, not here. main.js is a gitignored artifact; pass
// --client to skip the CSS step (used by `bun run dev`, keeping working-tree CSS
// unminified for editing). Note: --client also skips the includeDegraded
// injection, so a `bun run dev` build serves no html.legacy kill-switch — build
// without --client to exercise degraded mode locally.

import { readFileSync } from 'node:fs'
import { Glob } from 'bun'
import { bundleJs, processCss } from '@screenly-labs/signage-kit/build'
import { run as syncFonts } from './sync-fonts'

const clientOnly = process.argv.includes('--client')

// Shared chrome CSS from @screenly-labs/signage-kit — the canonical @font-face
// set and the standardized fixed footer badge. Prepended to this app's raw
// main.css at build time (a raw-CSS Worker can't resolve a bare `@import`), so
// the shared rules land before the app's, which override where they overlap.
const sharedCss = ['fonts.css', 'brand.css']
  .map((f) => readFileSync(Bun.resolveSync(`@screenly-labs/signage-kit/styles/${f}`, import.meta.dir), 'utf8'))
  .join('\n')

// Vendor the Bun-managed webfonts into ./assets first.
await syncFonts()

// ---- Client JS bundle: main.ts -> main.js (inlining ./moon + suncalc + the
// shared polyfills shim), a self-contained IIFE at the floor's syntax level.
try {
  await bundleJs('assets/static/js/main.ts', 'assets/static/js/main.js')
} catch (error) {
  console.error('✗ JS build failed')
  console.error(error)
  process.exit(1)
}
console.log('✓ JS: assets/static/js/main.js')

// ---- CSS: down-level + minify in place (skipped for --client), with the shared
// html.legacy kill-switch prepended by the kit.
if (!clientOnly) {
  for await (const path of new Glob('assets/static/styles/*.css').scan('.')) {
    try {
      const code = await processCss(`${sharedCss}\n${await Bun.file(path).text()}`, {
        includeDegraded: true,
        filename: path
      })
      await Bun.write(path, code)
    } catch (error) {
      console.error(`✗ CSS build failed (${path})`)
      console.error(error)
      process.exit(1)
    }
    console.log(`✓ CSS: ${path}`)
  }
}

console.log(`Build complete${clientOnly ? ' (client JS only)' : ''}.`)
