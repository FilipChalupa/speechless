import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

// Regenerates the PNG icons from icon.svg. Needs a Chrome and playwright-core:
//   npm i playwright-core && node make-icons.mjs
//
// Two traps, both of which silently produce a plausible-looking file:
//   - Pointing Chrome straight at icon.svg and shrinking the window only
//     screenshots the top-left corner of a 512-wide drawing: a blank square.
//   - A file:// page may not load another file:// resource, so an <img> wrapper
//     yields a screenshot of the bare background. The SVG is inlined instead.
// The root width/height are left alone; the CSS rule below overrides them,
// while stripping them by regex also hits the inner rects and throws away the
// background and the speech bubble.

const root = dirname(fileURLToPath(import.meta.url))

const TARGETS = [
	{ size: 192, file: 'icon-192.png' },
	{ size: 512, file: 'icon-512.png' },
	{ size: 180, file: 'apple-touch-icon.png' },
]

const source = await readFile(join(root, 'icon.svg'), 'utf8')

const browser = await chromium.launch({ channel: 'chrome' })

for (const { size, file } of TARGETS) {
	const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
	await page.setContent(
		`<!doctype html><meta charset="utf-8">
		<style>html,body{margin:0;padding:0}svg{display:block;width:100vw;height:100vh}</style>
		${source}`,
		{ waitUntil: 'load' },
	)
	await page.screenshot({ path: join(root, file), omitBackground: false })
	await page.close()
	console.log(`wrote ${file} at ${size}×${size}`)
}

await browser.close()
