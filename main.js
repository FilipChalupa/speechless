const LANGUAGES = [
	{ code: 'sk', label: 'Slovenčina' },
	{ code: 'cs', label: 'Čeština' },
	{ code: 'en', label: 'English' },
	{ code: 'de', label: 'Deutsch' },
	{ code: 'pl', label: 'Polski' },
	{ code: 'hu', label: 'Magyar' },
	{ code: 'uk', label: 'Українська' },
	{ code: 'es', label: 'Español' },
	{ code: 'fr', label: 'Français' },
	{ code: 'it', label: 'Italiano' },
]
const MAX_CHUNK_LENGTH = 180
const HISTORY_STORAGE_KEY = 'speechless:history'
const LANGUAGE_STORAGE_KEY = 'speechless:language'
const HISTORY_LIMIT = 50

const form = document.querySelector('#form')
const input = document.querySelector('#input')
const statusElement = document.querySelector('#status')
const historyList = document.querySelector('#history')
const historyEmpty = document.querySelector('#history-empty')
const clearHistoryButton = document.querySelector('#clear-history')
const languageSelect = document.querySelector('#language')

// A single reused element keeps playback unlocked on iOS after the first tap.
const player = new Audio()
player.preload = 'auto'

let playbackToken = 0
let language = loadLanguage()
let history = loadHistory()

renderLanguages()
renderHistory()

// Without a stored choice, follow what the browser says the user reads.
function preferredLanguage() {
	const preferences = navigator.languages?.length ? navigator.languages : [navigator.language]
	for (const preference of preferences) {
		const base = String(preference ?? '').toLowerCase().split('-')[0]
		if (LANGUAGES.some((item) => item.code === base)) {
			return base
		}
	}
	return LANGUAGES[0].code
}

function loadLanguage() {
	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
		if (stored && LANGUAGES.some((item) => item.code === stored)) {
			return stored
		}
	} catch {
		// Fall through to the browser preference.
	}
	return preferredLanguage()
}

function renderLanguages() {
	languageSelect.replaceChildren(
		...LANGUAGES.map(({ code, label }) => {
			const option = document.createElement('option')
			option.value = code
			option.textContent = label
			return option
		}),
	)
	languageSelect.value = language
}

function loadHistory() {
	try {
		const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY))
		if (!Array.isArray(stored)) {
			return []
		}
		return sortPinnedFirst(
			stored
				.map((item) => {
					// History used to be a plain array of strings.
					if (typeof item === 'string') {
						return { text: item, pinned: false, lang: null }
					}
					if (item && typeof item.text === 'string') {
						return {
							text: item.text,
							pinned: item.pinned === true,
							lang: typeof item.lang === 'string' ? item.lang : null,
						}
					}
					return null
				})
				.filter(Boolean),
		)
	} catch {
		return []
	}
}

function sortPinnedFirst(items) {
	return [...items.filter((item) => item.pinned), ...items.filter((item) => !item.pinned)]
}

function saveHistory() {
	try {
		localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
	} catch {
		// Private mode or a full quota only costs us persistence, not the app.
	}
}

function renderHistory() {
	historyList.replaceChildren(
		...history.map(({ text, pinned, lang }) => {
			const item = document.createElement('li')
			item.className = 'history-item'

			const play = document.createElement('button')
			play.type = 'button'
			play.className = 'history-play'
			// An entry recorded in another language keeps speaking that one, so
			// say which it is.
			if (lang && lang !== language) {
				const badge = document.createElement('span')
				badge.className = 'history-lang'
				badge.textContent = lang
				// Visual only; the label below says it without running the code
				// into the phrase.
				badge.setAttribute('aria-hidden', 'true')
				play.append(badge)
				play.setAttribute('aria-label', `${text} (${lang})`)
			}
			play.append(text)
			play.addEventListener('click', () => {
				speak(text, lang ?? language)
			})

			const pin = document.createElement('button')
			pin.type = 'button'
			pin.className = 'history-pin'
			pin.textContent = pinned ? '★' : '☆'
			pin.setAttribute('aria-pressed', String(pinned))
			pin.setAttribute('aria-label', pinned ? 'Odopnúť' : 'Pripnúť')
			pin.addEventListener('click', () => {
				togglePin(text)
			})

			item.append(play, pin)
			return item
		}),
	)

	const pinnedCount = history.filter((item) => item.pinned).length
	historyEmpty.hidden = history.length > 0
	clearHistoryButton.hidden = history.length === pinnedCount
	clearHistoryButton.textContent = pinnedCount > 0 ? 'Vymazať nepripnuté' : 'Vymazať'
}

function addToHistory(text) {
	const wasPinned = history.some((item) => item.text === text && item.pinned)
	const others = history.filter((item) => item.text !== text)
	// The new entry goes to the top of its own group, pinned or not.
	history = trimHistory(sortPinnedFirst([{ text, pinned: wasPinned, lang: language }, ...others]))
	saveHistory()
	renderHistory()
}

function togglePin(text) {
	history = sortPinnedFirst(
		history.map((item) => (item.text === text ? { ...item, pinned: !item.pinned } : item)),
	)
	saveHistory()
	renderHistory()
}

// Pinned entries are kept by hand, so only unpinned ones age out.
function trimHistory(items) {
	return [
		...items.filter((item) => item.pinned),
		...items.filter((item) => !item.pinned).slice(0, HISTORY_LIMIT),
	]
}

function setStatus(message, tone) {
	statusElement.textContent = message
	if (tone) {
		statusElement.dataset.tone = tone
	} else {
		delete statusElement.dataset.tone
	}
}

function splitIntoChunks(text) {
	const chunks = []
	let current = ''

	for (const word of text.split(/\s+/).filter(Boolean)) {
		if (word.length > MAX_CHUNK_LENGTH) {
			if (current) {
				chunks.push(current)
				current = ''
			}
			for (let offset = 0; offset < word.length; offset += MAX_CHUNK_LENGTH) {
				chunks.push(word.slice(offset, offset + MAX_CHUNK_LENGTH))
			}
			continue
		}

		const candidate = current ? `${current} ${word}` : word
		if (candidate.length > MAX_CHUNK_LENGTH) {
			chunks.push(current)
			current = word
		} else {
			current = candidate
		}
	}

	if (current) {
		chunks.push(current)
	}
	return chunks
}

function chunkUrl(chunk, index, total, spokenLanguage) {
	const parameters = new URLSearchParams({
		ie: 'UTF-8',
		client: 'tw-ob',
		tl: spokenLanguage,
		total: String(total),
		idx: String(index),
		textlen: String(chunk.length),
		q: chunk,
	})
	return `https://translate.google.com/translate_tts?${parameters}`
}

function playChunk(chunk, index, total, spokenLanguage) {
	return new Promise((resolve, reject) => {
		const cleanUp = () => {
			player.removeEventListener('ended', handleEnded)
			player.removeEventListener('error', handleError)
		}
		const handleEnded = () => {
			cleanUp()
			resolve()
		}
		const handleError = () => {
			cleanUp()
			reject(new Error('Zvuk sa nepodarilo načítať.'))
		}

		player.addEventListener('ended', handleEnded)
		player.addEventListener('error', handleError)
		player.src = chunkUrl(chunk, index, total, spokenLanguage)
		player.play().catch((error) => {
			cleanUp()
			reject(error)
		})
	})
}

async function speak(text, spokenLanguage = language) {
	const token = ++playbackToken
	const chunks = splitIntoChunks(text)

	player.pause()
	setStatus('Prehrávam…')

	try {
		for (const [index, chunk] of chunks.entries()) {
			if (token !== playbackToken) {
				return
			}
			await playChunk(chunk, index, chunks.length, spokenLanguage)
		}
		if (token === playbackToken) {
			setStatus('')
		}
	} catch {
		if (token === playbackToken) {
			setStatus('Nepodarilo sa prehrať zvuk. Skús to znova.', 'error')
		}
	}
}

function submit() {
	const text = input.value.trim()
	if (!text) {
		return
	}
	input.value = ''
	// Keeps the on-screen keyboard open on a phone.
	input.focus()
	addToHistory(text)
	speak(text)
}

form.addEventListener('submit', (event) => {
	event.preventDefault()
	submit()
})

input.addEventListener('keydown', (event) => {
	if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
		event.preventDefault()
		submit()
	}
})

languageSelect.addEventListener('change', () => {
	language = languageSelect.value
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
	} catch {
		// The choice then lasts only for this visit.
	}
	// Badges depend on which language is current.
	renderHistory()
	input.focus()
})

clearHistoryButton.addEventListener('click', () => {
	history = history.filter((item) => item.pinned)
	saveHistory()
	renderHistory()
})

// Makes the app installable on the home screen; failing registration (file://,
// private mode) must not break speaking.
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('sw.js').catch(() => {})
	})
}
