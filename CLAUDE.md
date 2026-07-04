# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is the Screenly Moon App. It is a Cloudflare Worker that server-renders a
full-screen daily lunar display for Screenly digital signage — tonight's Moon
phase and illumination, rendered to the exact hemisphere, plus the upcoming
principal phases. Modeled on the sibling `weather-app` (Worker/Hono SSR +
aggressive edge cache) and `air-quality` (TypeScript). Intended to live at
`moon.srly.io`.

## Commands

Package manager is **Bun** (not npm/yarn). CI pins Bun 1.3.14.

```bash
bun install                  # install deps (also installs wrangler locally)
bun run build                # vendor fonts + bundle main.ts->main.js + minify CSS
bun run dev                  # build client JS, then wrangler dev on port 8888
bun test                     # run all tests
bun run typecheck            # tsc --noEmit
bun run lint                 # biome lint, fails on warnings (matches CI)
bun run format               # biome format --write
```

Deploy is via wrangler envs: `bunx wrangler deploy --env [dev|stage|production]`.
CI auto-deploys: push to `master` -> stage, push to `production` -> production.
PRs run typecheck + lint + test. Deploy needs `CF_API_TOKEN` + `CF_ACCOUNT_ID`.

## Architecture

### TypeScript throughout

All source is **TypeScript**, strict. The worker is `.ts`/`.tsx` (JSX via
`hono/jsx`, see `tsconfig.json`); the browser client is also authored as `.ts`
and bundled to JS by `build.ts`. `src/globals.d.ts` holds ambient types
(`__STATIC_CONTENT_MANIFEST`, the `Env` bindings, the `RequestCf` subset of
`request.cf` this app reads).

### Two runtimes, one repo

1. **Worker (SSR)** — `src/`, entry `src/index.tsx` (set in `wrangler.toml`).
2. **Browser (client)** — `assets/static/js/`. Computes the Moon and renders.

The SSR output is a static HTML shell; `main.js` fills the placeholders. There
is **no runtime API call** — the worker bakes everything the client needs
(coordinates + place + timezone) into the page, and the client computes the Moon
from it.

### Everything the Moon shows is computed in the browser

`assets/static/js/moon.ts` wraps **SunCalc** (bundled, no API key, no network)
for the illuminated fraction, synodic phase, phase name, the illuminated-region
SVG path (`litPath`), and the upcoming principal-phase dates
(`nextPrincipalPhases`). `main.ts` reads the baked `#location-data`, computes
tonight's Moon, and renders — rotating the disk 180° in the Southern hemisphere.

### Request flow (`src/index.tsx`) — heavily cached

- `GET /` redirects (301) to a canonical `?lat=&lng=` URL when either coord is
  missing. Resolution order: query params > Screenly headers (`x-screenly-lat/lng`)
  > Cloudflare edge geo (`request.cf`) > `defaultLocation`.
- **Coordinates are rounded to 1 decimal place** (`trimCoordinates`, ~11 km) so
  every screen in an area collapses onto one cache key — a wide cache net.
- With both coords present, the page is server-rendered and stored in the edge
  page cache (`caches.default`) for **12h** (`s-maxage=43200`), keyed by URL +
  `ASSET_VERSION`. So the origin renders only a few times a day per area; there
  is **no per-request work** (no API route). Versioned `/static/*` assets are
  cached `immutable` for a year.
- The place name + timezone are **baked into the cached page** from `request.cf`,
  but only when the edge geo matches the page's coordinates (`sameCell`) — i.e.
  the location was auto-detected. If a screen is *configured* for a different
  place than the player's IP, they are left blank and the client shows a
  coordinate label and formats dates in the browser's own timezone.

### Cache-busting (important, easy to break)

`ASSET_VERSION` is a hash of the static-asset manifest, computed at worker
startup. It is folded into the SSR page-cache key (so a deploy lands on a fresh
key) and appended as `?v=<version>` to every asset URL. Read the comments in
`src/index.tsx` before touching this. Same scheme as the weather app.

### `main.ts` / `moon.ts` split, and the build

`build.ts` bundles `assets/static/js/main.ts` (inlining `./moon` and `suncalc`,
`external: []`) into `assets/static/js/main.js` — a self-executing classic
script with no `export`, so every cached HTML variant runs it. **`main.js` is a
build artifact and is gitignored.** All unit-testable pure helpers live in
`moon.ts` as real ES exports — `test/moon.test.ts` imports them directly. Add
testable logic to `moon.ts`, not `main.ts`. CSS is minified **in place** by the
full build (`bun run build`), so don't commit that output as source — `bun run
dev` uses `build.ts --client` to skip the CSS step and keep the working-tree CSS
readable while developing; CI does a fresh checkout before deploy.

### The moon rendering (verify against a real render, not just tests)

`litPath(fraction, waxing, R)` returns the SVG path for the lit region in
Northern-hemisphere orientation; the caller rotates the disk 180° for the South.
The terminator arc runs bottom→top — **opposite** the limb — so an equal SVG
sweep flag curves it to the *opposite* side; the crescent/gibbous sweep is
chosen accordingly. The unit tests pin exact path strings, but they can encode a
wrong geometry and still pass — if you change `litPath`, confirm against a real
render (New must be dark, Full fully lit; the lit area must match the %).

## Conventions

- **Biome** is the linter+formatter (config in `biome.json`): single quotes, no
  semicolons, no trailing commas, 2-space indent, 100-col width.
- Tests use `bun:test`. Worker tests stub `__STATIC_CONTENT_MANIFEST`,
  `hono/cloudflare-workers`, and the Cache API, and set `request.cf` on a real
  `Request` driven through `app.fetch` (see `src/index.test.ts`).
- No em-dashes in copy or comments.
