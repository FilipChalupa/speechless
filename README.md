# Speechless

Type a message, press Enter (or the Play button) and the phone says it out
loud. Built for a phone, for people whose voice is temporarily gone.

Live at <https://speechless.filipchalupa.cz/>.

## How it works

- `index.html`, `style.css` and `main.js` are the whole app; `settings.html`
  is the settings page and `privacy.html` the privacy notice. No framework,
  no bundler; `build.mjs` only renames assets (see Deployment).
- `main.js` runs on the app page and on the settings page alike and picks
  its part by whether the composer form exists. The settings page saves to
  localStorage; the app reads it back when it loads again, so nothing has to
  be synced between the two.
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
- The pencil puts an entry's text into the composer and stays lit while it
  is there. A Save button appears next to Play and Show and writes the field
  back into that entry, keeping its pin and language. Play and Show treat
  the field as something new, so a pinned phrase can serve as a template
  for a variant; either ends the edit, as does emptying the field by hand or
  tapping the lit pencil again. Saving a text that another entry already has
  merges the two, keeping a pin from either.
- While something is playing the main button turns into Stop — but only while
  the field is empty. Once the next sentence is typed it says Play again and
  speaks that, so the button always does what it says. The overlay button
  behaves the same way.
- The Show button (and the eye icon on each entry) puts the text across the
  whole screen, for noise, for someone hard of hearing, and anywhere playing a
  phone out loud is awkward. Font size follows the length of the text and a
  wake lock keeps the screen on while it is up. Showing stays silent on
  purpose; the overlay carries its own button to speak.
- The speech language is chosen in Settings and defaults to the first of
  `navigator.languages` that the app has (list of `LANGUAGES` in `main.js`),
  or Czech when none of them is. The choice is
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
- The settings page has an *Only the device voice* switch
  (`speechless:device-voice` in localStorage). With it on, Play never contacts Google and goes straight
  to `speechSynthesis`, the same path as offline. It exists for privacy, not
  quality: the typed text then never leaves the phone.

## Privacy

Every text played the normal way goes to Google as a query parameter, along
with the user's IP address, and the people this is for may well be typing in
a hospital. `privacy.html` says so in plain words, in English, Czech and
Slovak; `main.js` links to it from the app page with the interface language
in the hash, and `style.css` shows only that section where `:has()` is
supported. Its "last updated" date is filled in by the build from the last
commit that touched the file, which is why the workflow checks out the full
history. Keep the page true to the code: a new request to anyone, or a new
place data is kept, belongs on that page in the same commit.

## Sharing

All three pages carry Open Graph and Twitter card tags, with
an absolute `og:image` URL because crawlers do not resolve relative ones.
The picture is `og-image.png`, 1200×630, generated together with the icons
(see Images).

## Development

Open `index.html` directly, or serve the sources — no build needed:

```sh
npx serve .
```

## Images

`icon.svg` is the source; every PNG is generated from it by `make-images.mjs`:
the home-screen icons (iOS ignores both SVG icons and the manifest icons when
adding to the home screen, hence `apple-touch-icon.png`) and `og-image.png`
for link previews. The install flags matter: a plain `npm i` in a directory
without a `package.json` writes one, plus a lock file.

```sh
npm i --no-save --no-package-lock playwright-core
node make-images.mjs
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
white for the bubble. The og-image is set in whatever sans-serif the machine
has, so it renders a little differently elsewhere.

## Deployment

A push to the `deploy` branch runs the workflow, which calls `node build.mjs`
and deploys the resulting `dist/` to GitHub Pages. Work lands on `main` without
going live; to release, move `deploy` to the commit that should be public:

```sh
git push origin main:deploy
``` Nothing is compiled: the build renames
`style.css` and `main.js` to `style.<hash>.css` and `main.<hash>.js`, rewrites
the references in `index.html`, `settings.html` and `privacy.html`, and stamps
those names into the service worker.

Why: Pages serves assets with `cache-control: max-age=14400`, so a CDN edge and
a phone would otherwise hold an old version for hours. `index.html` is
short-lived, so a deploy immediately points at the new file names.

The service worker precaches those hashed files, `settings.html` and
`privacy.html`, which is why those pages are part of the build id too: without
that a reworded page would never reach an installed app that stays offline. `og-image.png` is copied
but not precached; only crawlers fetch it. Runtime caching alone is not
enough — the script is fetched before the worker is even registered, so offline
it would be missing on the first try, and a cache miss answered with
`index.html` gives the browser HTML where it expects JavaScript.

When checking a deployed version with `curl`, use `?cb=$(date +%s)` rather than
the plain URL.
