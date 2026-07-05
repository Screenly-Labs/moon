// Pure, framework-free lunar helpers, extracted from main.ts so they can be
// unit-tested with a real ES module import (see test/moon.test.ts). main.ts
// bundles this in at build time; keeping these here (and OUT of main.ts's
// exports) is what lets main.ts stay a plain self-executing browser script with
// no `export` token — same rule as the weather app's locale.ts.
//
// The astronomy is delegated to SunCalc — a small, well-worn library that
// computes the Moon's illuminated fraction and synodic phase from a Date, with
// no API key and no network. Everything here is deterministic given its inputs,
// so the whole display is produced in the browser. Location only affects three
// things: hemisphere (which way the disk is lit/oriented), the timezone used to
// label "today" and the upcoming-phase dates, and the place name.

import SunCalc from 'suncalc'

export type Hemisphere = 'N' | 'S'

export interface MoonNow {
  fraction: number // illuminated fraction, 0 (new) … 1 (full)
  phase: number // synodic phase, 0/1 new · .25 first qtr · .5 full · .75 last qtr
  name: string // human phase name
  waxing: boolean // growing toward full (true) vs shrinking toward new (false)
  percent: number // illuminated fraction as a rounded percentage
  hemisphere: Hemisphere
}

export interface PrincipalPhase {
  name: string
  date: Date
}

// The four principal phases and their synodic-phase values. Names between them
// describe the growing (waxing, <.5) or shrinking (waning, >.5) disk.
const PRINCIPAL = [
  { name: 'New Moon', value: 0 },
  { name: 'First Quarter', value: 0.25 },
  { name: 'Full Moon', value: 0.5 },
  { name: 'Last Quarter', value: 0.75 }
] as const

// A principal phase is "reached" within this window of synodic progress
// (~0.6 day either side of the exact instant), so the night of a full moon
// reads "Full Moon" rather than "Waxing Gibbous".
const PRINCIPAL_EPS = 0.02

const norm = (phase: number): number => ((phase % 1) + 1) % 1

export const phaseName = (phase: number): string => {
  const p = norm(phase)
  if (p < PRINCIPAL_EPS || p > 1 - PRINCIPAL_EPS) return 'New Moon'
  if (Math.abs(p - 0.25) < PRINCIPAL_EPS) return 'First Quarter'
  if (Math.abs(p - 0.5) < PRINCIPAL_EPS) return 'Full Moon'
  if (Math.abs(p - 0.75) < PRINCIPAL_EPS) return 'Last Quarter'
  if (p < 0.25) return 'Waxing Crescent'
  if (p < 0.5) return 'Waxing Gibbous'
  if (p < 0.75) return 'Waning Gibbous'
  return 'Waning Crescent'
}

export const isWaxing = (phase: number): boolean => norm(phase) < 0.5

export const hemisphereFor = (lat: number): Hemisphere => (lat >= 0 ? 'N' : 'S')

export const illuminationPercent = (fraction: number): number =>
  Math.round(Math.max(0, Math.min(1, fraction)) * 100)

export const moonNow = (date: Date, lat: number): MoonNow => {
  const { fraction, phase } = SunCalc.getMoonIllumination(date)
  return {
    fraction,
    phase,
    name: phaseName(phase),
    waxing: isWaxing(phase),
    percent: illuminationPercent(fraction),
    hemisphere: hemisphereFor(lat)
  }
}

// SVG path for the lit region of the disk, drawn for the NORTHERN hemisphere
// (lit limb on the right while waxing). The disk is centered at (R, R) with
// radius R; the path runs top → bottom down the outer limb, then back up along
// the terminator (the shadow boundary). The terminator is a half-ellipse whose
// horizontal radius is R·|1−2·fraction|: it collapses to a straight line at the
// quarters and grows to a full semicircle at new/full. Callers rotate the whole
// disk 180° for the Southern hemisphere (where the Moon appears inverted).
export const litPath = (fraction: number, waxing: boolean, R: number): string => {
  const f = Math.max(0, Math.min(1, fraction))
  const cx = R
  const top = 0
  const bottom = 2 * R
  // Trim float noise (e.g. 39.999…) so the emitted path is clean and stable.
  const rx = Number((R * Math.abs(1 - 2 * f)).toFixed(3))
  const sweepLimb = waxing ? 1 : 0
  // The terminator arc runs bottom→top — opposite the limb's top→bottom — so an
  // equal sweep flag curves it to the opposite side. Crescent (f<.5): the
  // terminator must bulge toward the dark side (opposite the limb), leaving a
  // lit sliver → 1−sweepLimb. Gibbous (f>.5): it bulges into the lit side,
  // leaving a dark sliver → sweepLimb.
  const sweepTerm = f < 0.5 ? 1 - sweepLimb : sweepLimb
  return `M ${cx} ${top} A ${R} ${R} 0 0 ${sweepLimb} ${cx} ${bottom} A ${rx} ${R} 0 0 ${sweepTerm} ${cx} ${top} Z`
}

const DAY_MS = 86_400_000

const phaseAt = (t: number): number => SunCalc.getMoonIllumination(new Date(t)).phase

// Root-find where f crosses 0 within [lo, hi] (f(lo) ≤ 0 ≤ f(hi)); ~30 s.
const bisect = (lo: number, hi: number, f: (t: number) => number): number => {
  for (let i = 0; i < 40 && hi - lo > 30_000; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) <= 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// The next occurrence after `from` of each principal phase, in chronological
// order. Scans forward on a coarse grid detecting where the synodic phase
// crosses each target value, then bisects each crossing to the minute. The New
// Moon is the point where phase wraps 1→0, handled by unwrapping across the gap.
export const nextPrincipalPhases = (
  from: Date,
  opts: { horizonDays?: number; stepMinutes?: number } = {}
): PrincipalPhase[] => {
  const horizonDays = opts.horizonDays ?? 40
  const stepMs = (opts.stepMinutes ?? 60) * 60_000
  const start = from.getTime()
  const end = start + horizonDays * DAY_MS
  const found = new Map<string, number>()

  let prevT = start
  let prevP = phaseAt(prevT)

  for (let t = start + stepMs; t <= end && found.size < PRINCIPAL.length; t += stepMs) {
    const p = phaseAt(t)
    if (p < prevP - 0.5) {
      // Synodic wrap 1→0: a New Moon fell in (prevT, t]. Find where the
      // unwrapped phase crosses 1.0.
      if (!found.has('New Moon')) {
        const ref = prevP
        found.set(
          'New Moon',
          bisect(prevT, t, (x) => {
            const v = phaseAt(x)
            return (v < ref - 0.5 ? v + 1 : v) - 1
          })
        )
      }
    } else {
      for (const { name, value } of PRINCIPAL) {
        if (value === 0) continue
        if (prevP < value && p >= value && !found.has(name)) {
          found.set(
            name,
            bisect(prevT, t, (x) => phaseAt(x) - value)
          )
        }
      }
    }
    prevT = t
    prevP = p
  }

  return PRINCIPAL.filter(({ name }) => found.has(name))
    .map(({ name }) => ({ name, date: new Date(found.get(name) as number) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

// Build an Intl formatter, tolerating a malformed timezone/locale (e.g. from a
// hand-set query param) by falling back to the runtime default.
const dtf = (
  tz: string | undefined,
  locale: string | undefined,
  opts: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  try {
    return new Intl.DateTimeFormat(locale || undefined, tz ? { ...opts, timeZone: tz } : opts)
  } catch {
    return new Intl.DateTimeFormat(undefined, opts)
  }
}

export const formatToday = (date: Date, tz?: string, locale?: string): string =>
  dtf(tz, locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(date)

export const formatPhaseDate = (date: Date, tz?: string, locale?: string): string =>
  dtf(tz, locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
