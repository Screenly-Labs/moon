export const locationHeaders = {
  lat: 'x-screenly-lat',
  lng: 'x-screenly-lng'
} as const

export const locationQueryParams = {
  lat: 'lat',
  lng: 'lng'
} as const

// Defaults to San Francisco (matching the other Screenly apps). Used only when
// no location can be resolved from the query, Screenly headers, or Cloudflare's
// edge geo.
export const defaultLocation = {
  lat: '37.77',
  lng: '-122.43'
} as const
