import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import manifest from '__STATIC_CONTENT_MANIFEST'
import App from './components/App'
import { locationHeaders, locationQueryParams, defaultLocation } from './constants'
import { countryName, sameCell, trimCoordinates } from './utils'
import signageManifest from '../signage-app.json'

const app = new Hono<{ Bindings: Env }>()

// A short, deploy-stable token derived from the hashed static-asset manifest.
// It changes whenever any asset (JS/CSS/font) changes, which is exactly when a
// deploy ships. Folding it into the page-cache key means a new deploy lands on
// a fresh key instead of serving a previously cached HTML shell that points at
// the previous build's assets. Without this, the 12h SSR page cache outlives a
// deploy and pairs stale HTML with freshly served /static assets.
const ASSET_VERSION = (() => {
  const source = typeof manifest === 'string' ? manifest : JSON.stringify(manifest)
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (Math.imul(31, hash) + source.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
})()

app.use('*', logger())

// Cache headers for static assets. Asset URLs in the HTML carry ?v=<version>
// (see ASSET_VERSION / Layout), so a versioned request is safe to cache forever
// — a content change ships a new ?v and therefore a new URL. Legacy unversioned
// URLs (only referenced by pre-cache-busting HTML still in the edge cache) get a
// short TTL so they can pick up the current bundle.
app.use('/static/*', async (c, next) => {
  await next()
  const versioned = c.req.query('v') !== undefined
  c.header(
    'Cache-Control',
    versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
  )
})
app.use('/static/*', serveStatic({ root: './', manifest }))

// The signage-app manifest lets the app store and signage players render this
// app's settings form and build its launch URL from a single source of truth.
// Consumers fetch it cross-origin, so CORS must be open; a dedicated route (not
// /static) guarantees the application/json content type and CORS header.
app.get('/.well-known/signage-app.json', (c) =>
  c.json(signageManifest, 200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600'
  })
)

app.get('/', async (c) => {
  const qLat = c.req.query(locationQueryParams.lat)
  const qLng = c.req.query(locationQueryParams.lng)
  const cf = (c.req.raw as unknown as { cf?: RequestCf }).cf

  // Redirect to a canonical URL whenever either coordinate is missing, filling
  // gaps so the render path always has both lat and lng. Resolution order, most
  // to least specific: explicit query params > the Screenly player's
  // asset-metadata headers > Cloudflare's edge geo > the default. trimCoordinates
  // rounds to a coarse grid, so nearby screens collapse onto one cacheable URL.
  if (!qLat || !qLng) {
    const lat = qLat || c.req.header(locationHeaders.lat) || cf?.latitude || defaultLocation.lat
    const lng = qLng || c.req.header(locationHeaders.lng) || cf?.longitude || defaultLocation.lng
    const coordinates = trimCoordinates({ lat, lng })

    const url = new URL(c.req.url)
    url.searchParams.set('lat', coordinates.lat)
    url.searchParams.set('lng', coordinates.lng)

    return new Response(null, {
      status: 301,
      headers: { Location: url.toString() }
    })
  }

  const cache = (caches as unknown as { default: Cache }).default
  // hono v4's c.req is a HonoRequest wrapper; the Cache API needs a raw Request.
  // Version the key by the deployed asset bundle so each deploy busts the SSR
  // page cache rather than serving HTML that references stale assets.
  const keyUrl = new URL(c.req.url)
  keyUrl.searchParams.set('v', ASSET_VERSION)
  const key = new Request(keyUrl.toString(), c.req.raw)
  let response = await cache.match(key)

  if (!response) {
    const coordinates = trimCoordinates({ lat: qLat, lng: qLng })

    // Bake the place name + timezone into the page so the whole display is
    // computed with zero per-request work — the cached HTML carries everything
    // the client needs. We only trust Cloudflare's edge geo (the viewer's IP
    // location) when it matches the page's coordinates, i.e. the location was
    // auto-detected. If the screen is configured for a different place than the
    // player's IP, we leave these blank: the client shows a coordinate label and
    // formats dates in the browser's own timezone instead of a wrong one.
    const geoMatches =
      cf?.latitude != null && cf?.longitude != null && sameCell(coordinates, { lat: cf.latitude, lng: cf.longitude })
    const place = geoMatches
      ? { city: cf?.city ?? '', country: countryName(cf?.country), timezone: cf?.timezone ?? '' }
      : { city: '', country: '', timezone: '' }

    const body = (<App {...coordinates} {...place} v={ASSET_VERSION} />).toString()
    response = new Response(body, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=43200',
        'Content-Type': 'text/html; charset=UTF-8'
      }
    })

    c.executionCtx.waitUntil(cache.put(key, response.clone()))
  }

  return response
})

export default app
