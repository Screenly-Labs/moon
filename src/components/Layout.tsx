import { html, raw } from 'hono/html'
import { analyticsBootstrap } from '@screenly-labs/signage-kit/analytics-bootstrap'
import { PLAYER_PROFILE_PATH } from '@screenly-labs/signage-kit/analytics-server'
import { GATE } from '@screenly-labs/signage-kit/gate'
import type { Child } from 'hono/jsx'

interface LayoutProps {
  v: string
  children?: Child
}

const Layout = (props: LayoutProps) => html`<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Screenly Moon - Tonight's Moon Phase</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="A full-screen daily lunar display for digital signage - tonight's Moon phase and illumination, plus the upcoming principal phases, for the viewer's location."
      />
      <link
        rel="icon"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M21 4a12 12 0 1 0 7 21A10 10 0 0 1 21 4z' fill='%23f4e8c1'/%3E%3C/svg%3E"
      />
      <link
        rel="preload"
        href="/static/fonts/fraunces-latin-standard-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <link
        rel="preload"
        href="/static/fonts/jetbrains-mono-latin-wght-normal.woff2?v=${props.v}"
        as="font"
        type="font/woff2"
        crossorigin
      />
      <!-- Shared degraded-mode gate from @screenly-labs/signage-kit, before the
           stylesheet so html.legacy is set on the first paint. -->
      ${raw(GATE)}
      <link rel="stylesheet" href="/static/styles/main.css?v=${props.v}" />
      <!-- Google Analytics 4. client_id is pinned to the Screenly device id by the kit
           bootstrap, so one screen is one GA4 user: GA4's own client_id lives in the _ga
           cookie and these players largely boot with fresh storage, so it churns. -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-QGK9VDL805"></script>
      ${raw(analyticsBootstrap({ gaId: 'G-QGK9VDL805', profilePath: PLAYER_PROFILE_PATH }))}
      <!-- main.js is the bundled, self-executing classic script (no ES module
           export), so a plain async <script> runs it and any cached HTML stays
           compatible across deploys. The ?v= busts it whenever the bundle
           changes. It is built from main.ts/moon.ts by build.ts. -->
      <script src="/static/js/main.js?v=${props.v}" async defer></script>
    </head>
    <body>
      ${props.children}
    </body>
  </html>`

export default Layout
