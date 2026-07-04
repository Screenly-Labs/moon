export interface Coordinates {
  lat: string | number
  lng: string | number
}

// Coordinate precision for the canonical URL — and therefore the SSR page-cache
// key. 1 decimal place (~11 km) deliberately casts a WIDE cache net: every
// screen within ~11 km rounds to the same key and shares one cached page, so
// the origin renders only a few times per day per area. It stays fine-grained
// enough to keep the hemisphere and the (city-level) baked place/timezone right.
const COORD_DP = 1

export const trimCoordinates = (location: Coordinates): { lat: string; lng: string } => {
  const { lat, lng } = location
  return {
    lat: parseFloat(String(lat)).toFixed(COORD_DP),
    lng: parseFloat(String(lng)).toFixed(COORD_DP)
  }
}

// Two coordinate pairs are "the same place" when they round to the same cache
// key. Used to decide whether Cloudflare's edge geo (the viewer's IP location)
// describes the page's coordinates, and so may be baked in as the place name.
export const sameCell = (a: Coordinates, b: Coordinates): boolean => {
  const ta = trimCoordinates(a)
  const tb = trimCoordinates(b)
  return ta.lat === tb.lat && ta.lng === tb.lng
}

// Cloudflare's cf.country is an ISO-3166 alpha-2 code (e.g. "SE"); turn it into
// a display name ("Sweden") when the runtime can. Built once, lazily, and
// tolerant of unknown/special codes (XX, T1) and engines without DisplayNames.
let regionNames: Intl.DisplayNames | null | undefined
export const countryName = (code: string | undefined): string => {
  if (!code) return ''
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}
