import { afterEach, describe, expect, it, mock } from 'bun:test'

// The Cloudflare static-assets middleware and its build-time manifest only exist
// in the Workers runtime; stub both before importing the app.
mock.module('__STATIC_CONTENT_MANIFEST', () => ({ default: '{}' }))
mock.module('hono/cloudflare-workers', () => ({
  serveStatic: () => async (_c: unknown, next: () => Promise<void>) => next()
}))

interface CacheLike {
  store: Map<string, Response>
  match: (k: Request | string) => Promise<Response | undefined>
  put: (k: Request | string, res: Response) => Promise<void>
}

// A Map-backed caches.default stub (the SSR page cache, keyed by Request).
const makeCache = (): CacheLike => {
  const store = new Map<string, Response>()
  const keyOf = (k: Request | string) => (typeof k === 'string' ? k : k.url)
  return {
    store,
    match: async (k) => store.get(keyOf(k))?.clone(),
    put: async (k, res) => {
      store.set(keyOf(k), res.clone())
    }
  }
}

const BASELINE_CACHE = { default: makeCache() }
;(globalThis as unknown as { caches: unknown }).caches = BASELINE_CACHE

const app = (await import('.')).default

// Hono needs an ExecutionContext for the SSR path's waitUntil(cache.put); a
// structural stub satisfies it (matching the sibling apps' tests).
const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} }

// Drive app.fetch with a request that carries a Cloudflare cf geo object.
const requestWithCf = (url: string, cf?: Record<string, string>) => {
  const req = new Request(url)
  ;(req as unknown as { cf?: Record<string, string> }).cf = cf
  return app.fetch(req, {} as Env, ctx)
}

afterEach(() => {
  ;(globalThis as unknown as { caches: unknown }).caches = { default: makeCache() }
})

describe('Routing', () => {
  it('redirects a location-less request to the (rounded) default location', async () => {
    const res = await app.request('http://localhost/', undefined, {} as Env, ctx)
    expect(res.status).toBe(301)
    const location = res.headers.get('Location')
    expect(location).toContain('lat=37.8') // San Francisco 37.77 rounded to 1 dp
    expect(location).toContain('lng=-122.4')
  })

  it('redirects using the Screenly asset-metadata headers, rounded', async () => {
    const res = await app.request(
      'http://localhost/',
      { headers: { 'x-screenly-lat': '-33.87', 'x-screenly-lng': '151.21' } },
      {} as Env,
      ctx
    )
    expect(res.status).toBe(301)
    const location = res.headers.get('Location')
    expect(location).toContain('lat=-33.9')
    expect(location).toContain('lng=151.2')
  })

  it('redirects when only one coordinate is provided, without a malformed query', async () => {
    const res = await app.request('http://localhost/?lat=51.5', undefined, {} as Env, ctx)
    expect(res.status).toBe(301)
    const location = res.headers.get('Location') ?? ''
    expect(location).toContain('lat=51.5')
    expect(location).toContain('lng=')
    expect(location.match(/\?/g)).toHaveLength(1)
  })

  it('renders and caches the SSR page when both coordinates are present', async () => {
    const url = 'http://localhost/?lat=51.5&lng=0.0'
    const res = await app.request(url, undefined, {} as Env, ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=43200')
    const bodyText = await res.text()
    expect(bodyText).toContain('data-location-lat="51.5"')

    // Second request is served from the edge page cache.
    const cached = await app.request(url, undefined, {} as Env, ctx)
    expect(await cached.text()).toBe(bodyText)
  })

  it('bakes the place name and timezone when edge geo matches the coordinates', async () => {
    const res = await requestWithCf('http://localhost/?lat=59.3&lng=18.1', {
      latitude: '59.33',
      longitude: '18.07',
      city: 'Stockholm',
      country: 'SE',
      timezone: 'Europe/Stockholm'
    })
    const body = await res.text()
    expect(body).toContain('data-location-city="Stockholm"')
    expect(body).toContain('data-location-country="Sweden"') // ISO resolved to a name
    expect(body).toContain('data-location-tz="Europe/Stockholm"')
  })

  it('does not bake geo when edge geo is a different place than the coordinates', async () => {
    // Page configured for Sydney, player IP in London → do not trust cf city/tz.
    const res = await requestWithCf('http://localhost/?lat=-33.9&lng=151.2', {
      latitude: '51.5',
      longitude: '-0.1',
      city: 'London',
      country: 'GB',
      timezone: 'Europe/London'
    })
    const body = await res.text()
    expect(body).toContain('data-location-lat="-33.9"')
    expect(body).toContain('data-location-city=""')
    expect(body).not.toContain('London')
  })
})

describe('signage manifest', () => {
  it('is served with open CORS and the app id', async () => {
    const res = await app.request(
      'http://localhost/.well-known/signage-app.json',
      undefined,
      {} as Env,
      ctx
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const data = (await res.json()) as { id: string }
    expect(data.id).toBe('moon')
  })
})
