// Side-effect import: installs the replaceChildren shim for the older-browser
// degraded mode. Must stay first so the shim is in place before any render.
import './polyfills'
import {
  formatPhaseDate,
  formatToday,
  type Hemisphere,
  litPath,
  moonNow,
  nextPrincipalPhases
} from './moon'

// This file is bundled by esbuild (inlining ./moon and the suncalc dep) into a
// self-contained IIFE with NO top-level `export`/`import`, so it loads from a
// plain <script> and every cached HTML variant runs it identically — same rule
// as the weather app's main.ts. The testable helpers live in ./moon.
//
// Everything the display needs is baked into the SSR page (#location-data), so
// there is no per-request network call: the worker resolved the location and
// place/timezone once, cached the HTML, and this script just computes tonight's
// Moon with SunCalc and renders. It re-renders on a timer so illumination
// advances and the date rolls over at local midnight.

interface MoonLocation {
  lat: number | null // null → unknown; hemisphere defaults to Northern
  lng: number | null
  city: string
  country: string
  timezone: string // '' → format dates in the browser's own timezone
  locale: string // '' → the browser's own locale
}

// SVG disk radius used for both the hero moon and the mini phase glyphs.
const R = 100
const RERENDER_MS = 30 * 60 * 1000

// Known illuminated fraction + waxing state at each principal phase, for the
// mini glyph beside each row of the upcoming-phases list.
const PRINCIPAL_GLYPH: Record<string, { fraction: number; waxing: boolean }> = {
  'New Moon': { fraction: 0, waxing: true },
  'First Quarter': { fraction: 0.5, waxing: true },
  'Full Moon': { fraction: 1, waxing: true },
  'Last Quarter': { fraction: 0.5, waxing: false }
}

const byId = (id: string): HTMLElement | null => document.getElementById(id)

const text = (id: string, value: string): void => {
  const el = byId(id)
  if (el) el.textContent = value
}

// The location the worker baked into the page (coordinates + place + timezone).
const readLocation = (): MoonLocation => {
  const node = byId('location-data')
  const data = node?.dataset ?? {}
  const lat = Number.parseFloat(data.locationLat ?? '')
  const lng = Number.parseFloat(data.locationLng ?? '')
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    city: data.locationCity ?? '',
    country: data.locationCountry ?? '',
    timezone: data.locationTz ?? '',
    locale: ''
  }
}

// Human place label: "City, Country" when known, else the coordinates, else a
// neutral note so the header is never empty.
const placeLabel = (loc: MoonLocation): string => {
  if (loc.city) return loc.country ? `${loc.city}, ${loc.country}` : loc.city
  if (loc.country) return loc.country
  if (loc.lat !== null && loc.lng !== null) {
    const ns = loc.lat >= 0 ? 'N' : 'S'
    const ew = loc.lng >= 0 ? 'E' : 'W'
    return `${Math.abs(loc.lat).toFixed(1)}°${ns}, ${Math.abs(loc.lng).toFixed(1)}°${ew}`
  }
  return 'Tonight’s sky'
}

// A mini moon showing a principal phase, as an inline SVG string. Content is
// derived entirely from our fixed phase set, so setting it via innerHTML is safe.
const glyphSvg = (fraction: number, waxing: boolean, hemisphere: Hemisphere): string => {
  const rot = hemisphere === 'S' ? ` transform="rotate(180 ${R} ${R})"` : ''
  return (
    `<svg class="phase__glyph" viewBox="0 0 ${2 * R} ${2 * R}" aria-hidden="true">` +
    `<circle cx="${R}" cy="${R}" r="${R}" class="glyph__disk"/>` +
    `<g${rot}><path d="${litPath(fraction, waxing, R)}" class="glyph__lit"/></g>` +
    `</svg>`
  )
}

const renderPhaseList = (from: Date, loc: MoonLocation, hemisphere: Hemisphere): void => {
  const list = byId('phase-list')
  if (!list) return
  const phases = nextPrincipalPhases(from)
  list.replaceChildren(
    ...phases.map(({ name, date }) => {
      const glyph = PRINCIPAL_GLYPH[name] ?? { fraction: 0, waxing: true }
      const li = document.createElement('li')
      li.className = 'phase'
      li.innerHTML =
        `${glyphSvg(glyph.fraction, glyph.waxing, hemisphere)}` +
        `<span class="phase__name">${name}</span>` +
        `<span class="phase__date">${formatPhaseDate(date, loc.timezone, loc.locale)}</span>`
      return li
    })
  )
}

const render = (loc: MoonLocation): void => {
  const now = new Date()
  const moon = moonNow(now, loc.lat ?? 0)

  // Hero moon: set the illuminated path and orient the disk for the hemisphere.
  const lit = byId('moon-lit')
  if (lit) lit.setAttribute('d', litPath(moon.fraction, moon.waxing, R))
  const body = byId('moon-body')
  if (body) body.setAttribute('transform', moon.hemisphere === 'S' ? `rotate(180 ${R} ${R})` : '')

  const illum = `${moon.percent}% illuminated`
  text('moon-title', `${moon.name}, ${illum}`)
  text('phase-name', moon.name)
  text('phase-illum', illum)
  // At the exact quarters/new/full the name already says it all; only annotate
  // the intermediate crescent/gibbous nights with the direction of travel.
  const intermediate = /Crescent|Gibbous/.test(moon.name)
  text('phase-motion', intermediate ? (moon.waxing ? 'Waxing' : 'Waning') : '')

  text('place', placeLabel(loc))
  text('today', formatToday(now, loc.timezone, loc.locale))

  renderPhaseList(now, loc, moon.hemisphere)

  document.documentElement.dataset.state = 'ready'
}

// On a Screenly player the viewer is already a Screenly customer, so the
// promotional Screenly badge is removed. The 'screenly-viewer' token in the
// user agent marks these devices; every other browser keeps the badge.
const removeScreenlyBranding = (): void => {
  if (navigator.userAgent.includes('screenly-viewer')) {
    document.querySelector('.brand')?.remove()
  }
}

const init = (): void => {
  removeScreenlyBranding()
  const loc = readLocation()
  render(loc)
  // Re-render periodically so illumination advances, the date rolls over at
  // local midnight, and a passed phase drops off the upcoming list.
  setInterval(() => render(loc), RERENDER_MS)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
