# Speechless

Type a message, press Enter (or the Play button) and the device says it out
loud. Built for a phone, for people whose voice is temporarily gone.

Live at <https://filipchalupa.cz/speechless/>.

## How it works

- `index.html`, `style.css` and `main.js` are the whole app. No framework, no
  bundler; `build.mjs` only renames assets (see Deployment).
- Speech comes from Google Translate TTS
  (`translate.google.com/translate_tts`). Longer text is split into chunks of
  up to 180 characters and played in order through a single reused `<audio>`
  element, which is also what keeps playback unlocked on iOS after the first
  tap.
- The page sends no `Referer`: Google Translate TTS answers 404 to any request
  that carries one.
- Enter and the Play button clear the field and put the text into the history
  (localStorage). Tapping an entry plays it again.
- The star pins an entry: pinned ones stay on top, never age out of the
  history limit, and survive the Clear unpinned button.
- While something is playing the main button turns into Stop — but only while
  the field is empty. Once the next sentence is typed it says Play again and
  speaks that, so the button always does what it says. The overlay button
  behaves the same way.
- The Show button (and the eye icon on each entry) puts the text across the
  whole screen, for noise, for someone hard of hearing, and anywhere playing a
  phone out loud is awkward. Font size follows the length of the text and a
  wake lock keeps the screen on while it is up. Showing stays silent on
  purpose; the overlay carries its own button to speak.
- The speech language is chosen in Settings and defaults to
  `navigator.languages` (list of `LANGUAGES` in `main.js`). The choice is
  remembered, and every history entry keeps the language it was recorded in,
  so a pinned Slovak phrase is never read out by a German voice.
- The interface language follows the speech language. `en`, `cs` and `sk` are
  translated (`TRANSLATIONS` in `main.js`); anything else falls back to
  English.
- On a first run the history is seeded with pinned phrases (`PRESETS` in
  `main.js`) in the device language, because an empty history means typing
  from scratch in the first real situation. A language without wording of its
  own gets the English one stored as English. Only a missing `localStorage`
  key counts as a first run: a cleared history stays cleared.
- Offline, or when Google TTS fails, the app speaks with the device voice
  (`speechSynthesis`) and says so in the status line. Offline it skips the
  request entirely — on iOS the user gesture that permits speaking would
  expire while waiting for a request that cannot succeed. If the device has no
  voice for the language it says so rather than reading the text in a foreign
  accent.
- It installs to the home screen (`manifest.webmanifest`,
  `apple-touch-icon.png`, service worker) and opens without a connection.
  On iPhone: Safari → Share → Add to Home Screen.

## Development

Open `index.html` directly, or serve the sources — no build needed:

```sh
npx serve .
```

## Icons

`icon.svg` is the source; the PNGs are generated from it by `make-icons.mjs`
(iOS ignores both SVG icons and the manifest icons when adding to the home
screen, hence `apple-touch-icon.png`):

```sh
npm i playwright-core
node make-icons.mjs
```

The script inlines the SVG into a page and sizes it with CSS, because the
obvious routes both fail quietly, leaving a file of the right dimensions and
the wrong content: pointing headless Chrome at `icon.svg` with a smaller window
screenshots only the top-left corner of a 512-wide drawing, and wrapping it in
an `<img>` on a `file://` page captures the bare background, since a `file://`
document may not load another `file://` resource.

So check the pixels after regenerating, not the file names or sizes. The icons
must stay square and fully opaque — iOS rounds the corners itself — and the
colour balance should match `icon.svg`: roughly 82% background blue and 17%
white for the bubble.

## Deployment

A push to `main` runs the workflow, which calls `node build.mjs` and deploys
the resulting `dist/` to GitHub Pages. Nothing is compiled: the build renames
`style.css` and `main.js` to `style.<hash>.css` and `main.<hash>.js`, rewrites
the references in `index.html`, and stamps those names into the service worker.

Why: Pages serves assets with `cache-control: max-age=14400`, so a CDN edge and
a phone would otherwise hold an old version for hours. `index.html` is
short-lived, so a deploy immediately points at the new file names.

The service worker precaches those hashed files. Runtime caching alone is not
enough — the script is fetched before the worker is even registered, so offline
it would be missing on the first try, and a cache miss answered with
`index.html` gives the browser HTML where it expects JavaScript.

When checking a deployed version with `curl`, use `?cb=$(date +%s)` rather than
the plain URL.
