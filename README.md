# Screenly Moon

A full-screen **daily Moon phase** display for digital signage. Shows tonight's
Moon — rendered to the exact illuminated fraction and oriented for the viewer's
hemisphere — with its phase name, illumination percentage, and the upcoming
principal phases (New, First Quarter, Full, Last Quarter) and their dates.

A TypeScript Cloudflare Worker, modeled on the sibling `weather-app`. Intended to
live at **[moon.srly.io](https://moon.srly.io/)**.

## How it works

- The Worker server-renders an HTML shell and stores it in the Cloudflare edge
  page cache for **12h**, keyed by location + asset version. Coordinates are
  rounded (~11 km) so nearby screens share one cached page — the origin renders
  only a few times a day per area. Static assets are fingerprinted and cached
  immutably for a year.
- There is **no runtime API call**: the Worker bakes the coordinates, place name
  and timezone (from Cloudflare's edge geo, `request.cf`) straight into the
  cached page.
- The Moon phase, illumination and upcoming-phase dates are computed **in the
  browser** with [SunCalc](https://github.com/mourner/suncalc) (bundled — no API
  key, no network). Location only sets the hemisphere, the timezone of the date
  labels, and the place name.

## Configuration

The location is auto-detected by IP. To pin a screen, pass query parameters (the
signage manifest builds these for you):

| Param | Example | Meaning |
| --- | --- | --- |
| `lat`, `lng` | `?lat=59.3&lng=18.1` | Coordinates (required together) |

The app redirects to a canonical, rounded `?lat=&lng=` URL, so any screen ends up
on a cacheable, location-specific page. When a screen is configured for a place
other than the player's IP, the display falls back to a coordinate label and the
browser's own timezone.

## Development

Requires [Bun](https://bun.sh) (CI pins 1.3.14).

```sh
bun install
bun run dev        # build client JS, then wrangler dev on http://localhost:8888
bun test           # unit tests (lunar helpers + worker routing)
bun run typecheck
bun run lint
bun run build      # vendor fonts + bundle main.ts->main.js + minify CSS
```

The client is TypeScript: `build.ts` bundles `assets/static/js/main.ts` to
`main.js` (a gitignored artifact). The full build also minifies the CSS in place
— don't commit that; `bun run dev` skips it.

## Deploy

Wrangler envs `dev` / `stage` / `production`:

```sh
bunx wrangler deploy --env dev         # *.workers.dev
bunx wrangler deploy --env stage       # stage-moon.srly.io
bunx wrangler deploy --env production  # moon.srly.io
```

CI auto-deploys: push to `master` → stage, push to `production` → production
(needs `CF_API_TOKEN` + `CF_ACCOUNT_ID` repo secrets).

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
