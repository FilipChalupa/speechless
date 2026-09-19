import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Content hashes in asset file names: GitHub Pages serves assets with
// max-age=14400, so a renamed file is the only reliable way to make a deploy
// visible right away. index.html itself stays unhashed and short-lived.

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')

const COPIED = [
	'manifest.webmanifest',
	'icon.svg',
	'icon-192.png',
	'icon-512.png',
	'apple-touch-icon.png',
]

const hashOf = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8)

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

const styleCss = await readFile(join(root, 'style.css'), 'utf8')
const mainJs = await readFile(join(root, 'main.js'), 'utf8')
const styleName = `style.${hashOf(styleCss)}.css`
const mainName = `main.${hashOf(mainJs)}.js`

await writeFile(join(dist, styleName), styleCss)
await writeFile(join(dist, mainName), mainJs)

const sourceHtml = await readFile(join(root, 'index.html'), 'utf8')
const html = sourceHtml
	.replace('href="style.css"', `href="${styleName}"`)
	.replace('src="main.js"', `src="${mainName}"`)

// A silently unreplaced reference would ship a page pointing at a file that
// the build no longer emits.
for (const [name, expected] of [
	['style.css', styleName],
	['main.js', mainName],
]) {
	if (!html.includes(expected)) {
		throw new Error(`index.html does not reference ${expected}; is the ${name} link unchanged?`)
	}
	if (html.includes(`"${name}"`)) {
		throw new Error(`index.html still references unhashed ${name}`)
	}
}

await writeFile(join(dist, 'index.html'), html)

const sw = (await readFile(join(root, 'sw.js'), 'utf8'))
	.replace('__BUILD_ID__', hashOf(html + styleCss + mainJs))
	.replace('const BUILD_ASSETS = []', `const BUILD_ASSETS = ${JSON.stringify([styleName, mainName, ...COPIED])}`)

// Without the hashed names the worker would cache a shell it cannot run.
if (!sw.includes(mainName) || !sw.includes(styleName)) {
	throw new Error('sw.js did not receive the hashed asset names')
}

await writeFile(join(dist, 'sw.js'), sw)

for (const asset of COPIED) {
	await cp(join(root, asset), join(dist, asset))
}

console.log(`built dist/ with ${styleName} and ${mainName}`)
