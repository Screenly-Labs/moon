#!/usr/bin/env bun
// Vendor this app's webfonts into ./assets/static/fonts. The files, versions,
// and copy logic all live in @screenly-labs/signage-kit — this just names the
// families "Observatory" uses (Fraunces phase name + JetBrains Mono logbook).

import { syncFonts } from '@screenly-labs/signage-kit/sync-fonts'

export const run = (): Promise<number> => syncFonts(['fraunces', 'jetbrains-mono'])

if (import.meta.main) {
  await run()
}
