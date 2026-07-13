import { html } from 'hono/html'
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
      <!-- Degraded mode for older/weaker signage players. Runs before the
           stylesheet so html.legacy is set on the first paint: flags the device
           as legacy when the browser engine is old (no Element.replaceChildren,
           a 2020-era API) or the hardware looks weak, then the stylesheet drops
           all animation. classList.add keeps it idempotent. -->
      <script>
        (function () {
          try {
            var slow =
              (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
              (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
            var old = !('replaceChildren' in Element.prototype)
            if (slow || old) document.documentElement.classList.add('legacy')
          } catch (e) {
            document.documentElement.classList.add('legacy')
          }
        })()
      </script>
      <link rel="stylesheet" href="/static/styles/main.css?v=${props.v}" />
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
