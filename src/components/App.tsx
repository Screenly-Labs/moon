import Layout from './Layout'

interface AppProps {
  lat: string
  lng: string
  city?: string
  country?: string
  timezone?: string
  v: string
}

// The SSR output is a static shell: main.js reads the baked coordinates and
// place/timezone from #location-data, computes tonight's Moon with SunCalc, and
// fills the placeholders — no per-request network call. Visible elements are
// seeded with a plausible moon so the screen is never blank pre-JS.
const App = ({ lat, lng, city = '', country = '', timezone = '', v }: AppProps) => {
  return (
    <Layout v={v}>
      <main class='sky'>
        <div class='stars' aria-hidden='true' />

        <header class='masthead'>
          <p class='masthead__place'>
            <span class='masthead__pin' aria-hidden='true' />
            <span id='place'>Tonight’s sky</span>
          </p>
          <p class='masthead__date' id='today'>
            Today
          </p>
        </header>

        <section class='hero'>
          <svg id='moon' class='moon' viewBox='0 0 200 200' role='img' aria-labelledby='moon-title'>
            <title id='moon-title'>Tonight's Moon</title>
            <defs>
              <radialGradient id='lit-grad' cx='42%' cy='38%' r='72%'>
                <stop offset='0%' stop-color='#fffdf5' />
                <stop offset='62%' stop-color='#f3e7c4' />
                <stop offset='100%' stop-color='#cdb98a' />
              </radialGradient>
              <clipPath id='moon-clip'>
                <circle cx='100' cy='100' r='100' />
              </clipPath>
            </defs>

            <circle class='moon__halo' cx='100' cy='100' r='100' />

            <g id='moon-body'>
              <circle class='moon__disk' cx='100' cy='100' r='100' />
              {/* main.js sets `d` for tonight's phase; seeded as a waxing gibbous. */}
              <path id='moon-lit' class='moon__lit' d='M 100 0 A 100 100 0 0 1 100 200 A 40 100 0 0 1 100 0 Z' />
              <g class='moon__craters' clip-path='url(#moon-clip)'>
                <circle cx='66' cy='70' r='16' />
                <circle cx='120' cy='58' r='10' />
                <circle cx='140' cy='104' r='20' />
                <circle cx='86' cy='126' r='24' />
                <circle cx='120' cy='150' r='9' />
                <circle cx='52' cy='104' r='7' />
              </g>
            </g>
          </svg>
        </section>

        <section class='readout'>
          <p class='readout__motion' id='phase-motion'>Waxing</p>
          <h1 class='readout__name' id='phase-name'>Waxing Gibbous</h1>
          <p class='readout__illum' id='phase-illum'>72% illuminated</p>
        </section>

        <section class='upcoming' aria-label='Upcoming phases'>
          <ul class='upcoming__list' id='phase-list'>
            <li class='phase'>
              <svg class='phase__glyph' viewBox='0 0 200 200' aria-hidden='true'>
                <circle cx='100' cy='100' r='100' class='glyph__disk' />
                <g>
                  <path class='glyph__lit' d='M 100 0 A 100 100 0 0 1 100 200 A 100 100 0 0 1 100 0 Z' />
                </g>
              </svg>
              <span class='phase__name'>Full Moon</span>
              <span class='phase__date'>—</span>
            </li>
          </ul>
        </section>

        <footer class='colophon'>
          <a
            class='brand'
            href='https://www.screenly.io'
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Screenly - opens in a new tab'
          >
            <img src={`/static/images/screenly-logo.svg?v=${v}`} alt='Screenly' />
          </a>
        </footer>

        <span
          id='location-data'
          data-location-lat={lat}
          data-location-lng={lng}
          data-location-city={city}
          data-location-country={country}
          data-location-tz={timezone}
        />
      </main>
    </Layout>
  )
}

export default App
