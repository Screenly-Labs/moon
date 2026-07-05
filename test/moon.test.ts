import { describe, expect, it } from 'bun:test'
import SunCalc from 'suncalc'
import {
  formatPhaseDate,
  formatToday,
  hemisphereFor,
  illuminationPercent,
  isWaxing,
  litPath,
  moonNow,
  nextPrincipalPhases,
  phaseName
} from '../assets/static/js/moon'

describe('phaseName', () => {
  it('names the four principal phases at their exact values', () => {
    expect(phaseName(0)).toBe('New Moon')
    expect(phaseName(0.25)).toBe('First Quarter')
    expect(phaseName(0.5)).toBe('Full Moon')
    expect(phaseName(0.75)).toBe('Last Quarter')
    expect(phaseName(1)).toBe('New Moon')
  })

  it('names the intermediate crescents and gibbous', () => {
    expect(phaseName(0.12)).toBe('Waxing Crescent')
    expect(phaseName(0.38)).toBe('Waxing Gibbous')
    expect(phaseName(0.62)).toBe('Waning Gibbous')
    expect(phaseName(0.88)).toBe('Waning Crescent')
  })

  it('normalizes out-of-range phase values', () => {
    expect(phaseName(2)).toBe('New Moon')
    expect(phaseName(-0.5)).toBe('Full Moon')
  })
})

describe('isWaxing', () => {
  it('is true before full and false after', () => {
    expect(isWaxing(0.1)).toBe(true)
    expect(isWaxing(0.49)).toBe(true)
    expect(isWaxing(0.51)).toBe(false)
    expect(isWaxing(0.9)).toBe(false)
  })
})

describe('hemisphereFor', () => {
  it('splits on the equator', () => {
    expect(hemisphereFor(51.5)).toBe('N')
    expect(hemisphereFor(0)).toBe('N')
    expect(hemisphereFor(-33.9)).toBe('S')
  })
})

describe('illuminationPercent', () => {
  it('rounds and clamps to 0-100', () => {
    expect(illuminationPercent(0)).toBe(0)
    expect(illuminationPercent(0.724)).toBe(72)
    expect(illuminationPercent(1)).toBe(100)
    expect(illuminationPercent(1.5)).toBe(100)
    expect(illuminationPercent(-0.2)).toBe(0)
  })
})

describe('litPath', () => {
  it('draws a full disk at full moon', () => {
    expect(litPath(1, true, 100)).toBe('M 100 0 A 100 100 0 0 1 100 200 A 100 100 0 0 1 100 0 Z')
  })

  it('collapses the terminator onto the limb at new moon (zero area)', () => {
    expect(litPath(0, true, 100)).toBe('M 100 0 A 100 100 0 0 1 100 200 A 100 100 0 0 0 100 0 Z')
  })

  it('flattens the terminator to a straight line at the quarter', () => {
    expect(litPath(0.5, true, 100)).toContain('A 0 100 0 0')
  })

  it('bulges away from the lit limb for a crescent and into it for a gibbous', () => {
    expect(litPath(0.25, true, 100)).toBe('M 100 0 A 100 100 0 0 1 100 200 A 50 100 0 0 0 100 0 Z')
    expect(litPath(0.75, true, 100)).toBe('M 100 0 A 100 100 0 0 1 100 200 A 50 100 0 0 1 100 0 Z')
  })

  it('mirrors the limb sweep for a waning (left-lit) moon', () => {
    expect(litPath(0.7, false, 100)).toBe('M 100 0 A 100 100 0 0 0 100 200 A 40 100 0 0 0 100 0 Z')
  })
})

describe('moonNow', () => {
  it('assembles a self-consistent snapshot', () => {
    // 2024-01-26 was a waning gibbous (just past the Jan 25 full moon).
    const snap = moonNow(new Date('2024-01-26T00:00:00Z'), 51.5)
    expect(snap.hemisphere).toBe('N')
    expect(snap.percent).toBe(illuminationPercent(snap.fraction))
    expect(snap.name).toBe(phaseName(snap.phase))
    expect(snap.waxing).toBe(isWaxing(snap.phase))
    expect(snap.percent).toBeGreaterThan(90)
    expect(snap.waxing).toBe(false)
  })

  it('reports the southern hemisphere for negative latitudes', () => {
    expect(moonNow(new Date('2024-01-26T00:00:00Z'), -33.9).hemisphere).toBe('S')
  })
})

describe('nextPrincipalPhases', () => {
  const from = new Date('2024-03-01T12:00:00Z')
  const phases = nextPrincipalPhases(from)

  it('returns all four principal phases, chronologically, in the future', () => {
    expect(phases).toHaveLength(4)
    expect(new Set(phases.map((p) => p.name))).toEqual(
      new Set(['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'])
    )
    for (const p of phases) expect(p.date.getTime()).toBeGreaterThan(from.getTime())
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].date.getTime()).toBeGreaterThan(phases[i - 1].date.getTime())
    }
  })

  it('lands each returned date on its actual phase value (cross-checked vs SunCalc)', () => {
    const target: Record<string, number> = {
      'First Quarter': 0.25,
      'Full Moon': 0.5,
      'Last Quarter': 0.75
    }
    for (const p of phases) {
      const phase = SunCalc.getMoonIllumination(p.date).phase
      if (p.name === 'New Moon') {
        expect(Math.min(phase, 1 - phase)).toBeLessThan(0.01)
      } else {
        expect(Math.abs(phase - target[p.name])).toBeLessThan(0.01)
      }
    }
  })

  it('finds every phase within a synodic month', () => {
    const horizonMs = 40 * 86_400_000
    for (const p of phases) {
      expect(p.date.getTime() - from.getTime()).toBeLessThan(horizonMs)
    }
  })
})

describe('date formatting', () => {
  const date = new Date('2024-07-04T09:00:00Z')

  it('formats today and phase dates in a target timezone', () => {
    expect(formatToday(date, 'America/New_York', 'en-US')).toBe('Thursday, July 4')
    expect(formatPhaseDate(date, 'America/New_York', 'en-US')).toBe('Thu, Jul 4')
  })

  it('falls back to the runtime default on a malformed timezone/locale', () => {
    expect(() => formatToday(date, 'Not/AZone', 'en-GB,en')).not.toThrow()
  })
})
