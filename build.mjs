import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Content hashes in asset file names: GitHub Pages serves assets with
// max-age=14400, so a renamed file is the only reliable way to make a deploy
// visible right away. index.html itself stays unhashed and short-lived.

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')

// Precached by the service worker, so the installed app opens offline.
const COPIED = [
	'manifest.webmanifest',
	'icon.svg',
	'icon-192.png',
	'icon-512.png',
	'apple-touch-icon.png',
]
// Fetched by link-preview crawlers only, never by the app itself, so it stays
// out of every phone's cache.
const COPIED_UNCACHED = ['og-image.png']

const hashOf = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8)

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

const styleCss = await readFile(join(root, 'style.css'), 'utf8')
const mainJs = await readFile(join(root, 'main.js'), 'utf8')
const styleName = `style.${hashOf(styleCss)}.css`
const mainName = `main.${hashOf(mainJs)}.js`

await writeFile(join(dist, styleName), styleCss)
await writeFile(join(dist, mainName), mainJs)

// Every page gets the hashed stylesheet; the privacy page runs no script.
const PAGES = [
	['index.html', [['style.css', styleName], ['main.js', mainName]]],
	['settings.html', [['style.css', styleName], ['main.js', mainName]]],
	['privacy.html', [['style.css', styleName]]],
]
let pagesHtml = ''
for (const [page, references] of PAGES) {
	let html = await readFile(join(root, page), 'utf8')
	for (const [name, hashed] of references) {
		html = html.replace(`href="${name}"`, `href="${hashed}"`).replace(`src="${name}"`, `src="${hashed}"`)
		// A silently unreplaced reference would ship a page pointing at a file
		// that the build no longer emits.
		if (!html.includes(hashed)) {
			throw new Error(`${page} does not reference ${hashed}; is the ${name} link unchanged?`)
		}
		if (html.includes(`"${name}"`)) {
			throw new Error(`${page} still references unhashed ${name}`)
		}
	}
	await writeFile(join(dist, page), html)
	pagesHtml += html
}

// The other pages are precached by name, so they have to move the build id
// too, or a changed text would never reach an installed app that stays offline.
const sw = (await readFile(join(root, 'sw.js'), 'utf8'))
	.replace('__BUILD_ID__', hashOf(pagesHtml + styleCss + mainJs))
	.replace('const BUILD_ASSETS = []', `const BUILD_ASSETS = ${JSON.stringify([styleName, mainName, ...COPIED])}`)

// Without the hashed names the worker would cache a shell it cannot run.
if (!sw.includes(mainName) || !sw.includes(styleName)) {
	throw new Error('sw.js did not receive the hashed asset names')
}

await writeFile(join(dist, 'sw.js'), sw)

for (const asset of [...COPIED, ...COPIED_UNCACHED]) {
	await cp(join(root, asset), join(dist, asset))
}

console.log(`built dist/ with ${styleName} and ${mainName}`)
