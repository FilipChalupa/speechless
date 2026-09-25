import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

// Takes the screenshots in screenshots/ for the README and for the install
// prompt (the "screenshots" list in manifest.webmanifest). Same route as
// make-images.mjs:
//   npm i --no-save --no-package-lock playwright-core && node make-screenshots.mjs
//
// The app is opened straight from the source files over file://, so no build
// or server is needed. Storage is seeded with English and a couple of
// phrases, so the pictures do not depend on this machine's language. Google
// TTS is never called: the request is left hanging, which is exactly what
// keeps the "Playing…" state on screen.
//
// Chrome shows these in its install dialog only within limits: every side
// between 320 and 3840 px, the long side at most 2.3× the short one, and one
// aspect ratio per form factor. The sizes below satisfy that, and the
// manifest lists them by pixel size, so change both together.

const root = dirname(fileURLToPath(import.meta.url))
const out = join(root, 'screenshots')
await mkdir(out, { recursive: true })

const app = pathToFileURL(join(root, 'index.html')).href

const HISTORY = [
	{ text: 'I cannot speak right now, so I am writing.', pinned: true, lang: 'en' },
	{ text: 'Please wait a moment, I am writing.', pinned: true, lang: 'en' },
	{ text: 'Could I have a glass of water, please?', pinned: true, lang: 'en' },
	{ text: 'Thank you.', pinned: true, lang: 'en' },
	{ text: 'Could I have some tea instead?', pinned: false, lang: 'en' },
]

// form_factor narrow: a phone, 3× so the text is crisp in the dialog.
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }
// form_factor wide: a laptop window.
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }

const browser = await chromium.launch({ channel: 'chrome' })

async function open(device, path = 'index.html') {
	const context = await browser.newContext({ ...device, locale: 'en-US', colorScheme: 'light' })
	const page = await context.newPage()
	// Never reaches Google; the pending request holds the speaking state.
	await page.route('https://translate.google.com/**', () => {})
	await page.goto(app)
	await page.evaluate((history) => {
		localStorage.setItem('speechless:language', 'en')
		localStorage.setItem('speechless:history', JSON.stringify(history))
	}, HISTORY)
	await page.goto(app.replace('index.html', path))
	return { context, page }
}

async function shoot(device, file, act = async () => {}) {
	const { context, page } = await open(device)
	await act(page)
	await page.screenshot({ path: join(out, file) })
	const { width, height } = device.viewport
	console.log(`wrote screenshots/${file} at ${width * device.deviceScaleFactor}×${height * device.deviceScaleFactor}`)
	await context.close()
}

await shoot(PHONE, 'phone-home.png')
await shoot(PHONE, 'phone-speaking.png', async (page) => {
	await page.fill('#input', 'Could I have a glass of water, please?')
	await page.click('#submit')
	await page.waitForSelector('.speaking')
})
await shoot(PHONE, 'phone-show.png', async (page) => {
	await page.fill('#input', 'Could I have a glass of water, please?')
	await page.click('#show')
	await page.waitForSelector('#overlay:not([hidden])')
})
await shoot(DESKTOP, 'desktop-home.png')

await browser.close()
