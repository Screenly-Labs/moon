// Ambient declarations shared across the worker and client builds.

// The Cloudflare static-assets manifest is injected by the Workers runtime at
// build time; it has no real module on disk (tests stub it via mock.module).
declare module '__STATIC_CONTENT_MANIFEST' {
  const manifest: string
  export default manifest
}

// Worker environment bindings (wrangler.toml vars). The Moon app has no secrets;
// everything is computed at the edge or in the browser.
interface Env {
  // Deploy environment (stage | production), set per-env in wrangler.toml.
  ENV?: 'stage' | 'production'
}

// The subset of Cloudflare's request.cf (edge IP geolocation) this app reads.
// The Workers runtime attaches it to the incoming Request; hono's c.req.raw is a
// standard Request, so we cast to reach it.
interface RequestCf {
  latitude?: string
  longitude?: string
  city?: string
  country?: string
  timezone?: string
}
