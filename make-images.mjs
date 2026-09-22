import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// Regenerates every PNG from icon.svg: the home-screen icons and og-image.png,
// the preview that Slack, Facebook, iMessage and the like show next to a
// shared link. Needs a Chrome and playwright-core:
//   npm i --no-save --no-package-lock playwright-core && node make-images.mjs
//
// Every target is a page with the SVG inlined, screenshotted at its own size.
// Two traps, both of which silently produce a plausible-looking file:
//   - Pointing Chrome straight at icon.svg and shrinking the window only
//     screenshots the top-left corner of a 512-wide drawing: a blank square.
//   - A file:// page may not load another file:// resource, so an <img> wrapper
//     yields a screenshot of the bare background. The SVG is inlined instead.
// The root width/height are left alone; the CSS below overrides them, while
// stripping them by regex also hits the inner rects and throws away the
// background and the speech bubble.
// The og-image type comes from whatever sans-serif the machine has, so its
// pixels differ slightly between machines; check the result, not the size.

const root = dirname(fileURLToPath(import.meta.url))
const icon = await readFile(join(root, 'icon.svg'), 'utf8')

const iconPage = `<style>svg{display:block;width:100vw;height:100vh}</style>${icon}`

// The bubble keeps its blue background rect: it is the page colour anyway.
// The text block is sized so the title clears the right padding.
const ogPage = `<style>
	body {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 64px;
		width: 100vw;
		height: 100vh;
		padding: 0 96px;
		box-sizing: border-box;
		background: #1d63d8;
		color: #ffffff;
		font-family: Inter, "Segoe UI", Ubuntu, Roboto, "DejaVu Sans", system-ui, sans-serif;
	}
	svg { display: block; flex: none; width: 320px; height: 320px; }
	.text { display: flex; flex-direction: column; gap: 20px; max-width: 560px; }
	h1 { margin: 0; font-size: 104px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
	p { margin: 0; font-size: 40px; font-weight: 400; line-height: 1.25; opacity: 0.88; }
</style>
${icon}
<div class="text">
	<h1>Speechless</h1>
	<p>Type a message and let the phone say it out loud.</p>
</div>`

const TARGETS = [
	{ file: 'icon-192.png', width: 192, height: 192, html: iconPage },
	{ file: 'icon-512.png', width: 512, height: 512, html: iconPage },
	{ file: 'apple-touch-icon.png', width: 180, height: 180, html: iconPage },
	{ file: 'og-image.png', width: 1200, height: 630, html: ogPage },
]

const browser = await chromium.launch({ channel: 'chrome' })

for (const { file, width, height, html } of TARGETS) {
	const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
	await page.setContent(
		`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${html}`,
		{ waitUntil: 'load' },
	)
	await page.screenshot({ path: join(root, file), omitBackground: false })
	await page.close()
	console.log(`wrote ${file} at ${width}×${height}`)
}

await browser.close()
