import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// Regenerates og-image.png, the preview that Slack, Facebook, iMessage and the
// like show next to a shared link. Same route as make-icons.mjs:
//   npm i playwright-core && node make-og-image.mjs
//
// The bubble is icon.svg inlined (a file:// page may not load another file://
// resource) with its blue background rect left in: it is the page colour
// anyway. The type comes from whatever sans-serif the machine has, so the
// pixels differ slightly between machines; check the result, not the size.

const root = dirname(fileURLToPath(import.meta.url))
const WIDTH = 1200
const HEIGHT = 630

const icon = await readFile(join(root, 'icon.svg'), 'utf8')

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
await page.setContent(
	`<!doctype html><meta charset="utf-8">
	<style>
		html, body { margin: 0; padding: 0; }
		body {
			display: flex;
			align-items: center;
			gap: 72px;
			width: ${WIDTH}px;
			height: ${HEIGHT}px;
			padding: 0 96px;
			box-sizing: border-box;
			background: #1d63d8;
			color: #ffffff;
			font-family: Inter, "Segoe UI", Ubuntu, Roboto, "DejaVu Sans", system-ui, sans-serif;
		}
		svg { display: block; flex: none; width: 360px; height: 360px; }
		.text { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
		h1 { margin: 0; font-size: 128px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
		p { margin: 0; font-size: 44px; font-weight: 400; line-height: 1.25; opacity: 0.88; }
	</style>
	${icon}
	<div class="text">
		<h1>Speechless</h1>
		<p>Type a message and let the phone say it out loud.</p>
	</div>`,
	{ waitUntil: 'load' },
)
await page.screenshot({ path: join(root, 'og-image.png'), omitBackground: false })
await browser.close()
console.log(`wrote og-image.png at ${WIDTH}×${HEIGHT}`)
