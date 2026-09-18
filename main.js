const LANGUAGE = 'sk'
const MAX_CHUNK_LENGTH = 180
const HISTORY_STORAGE_KEY = 'speechless:history'
const HISTORY_LIMIT = 50

const form = document.querySelector('#form')
const input = document.querySelector('#input')
const statusElement = document.querySelector('#status')
const historyList = document.querySelector('#history')
const historyEmpty = document.querySelector('#history-empty')
const clearHistoryButton = document.querySelector('#clear-history')

// A single reused element keeps playback unlocked on iOS after the first tap.
const player = new Audio()
player.preload = 'auto'

let playbackToken = 0
let history = loadHistory()

renderHistory()

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
						return { text: item, pinned: false }
					}
					if (item && typeof item.text === 'string') {
						return { text: item.text, pinned: item.pinned === true }
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
		...history.map(({ text, pinned }) => {
			const item = document.createElement('li')
			item.className = 'history-item'

			const play = document.createElement('button')
			play.type = 'button'
			play.className = 'history-play'
			play.textContent = text
			play.addEventListener('click', () => {
				speak(text)
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
	history = trimHistory(sortPinnedFirst([{ text, pinned: wasPinned }, ...others]))
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

function chunkUrl(chunk, index, total) {
	const parameters = new URLSearchParams({
		ie: 'UTF-8',
		client: 'tw-ob',
		tl: LANGUAGE,
		total: String(total),
		idx: String(index),
		textlen: String(chunk.length),
		q: chunk,
	})
	return `https://translate.google.com/translate_tts?${parameters}`
}

function playChunk(chunk, index, total) {
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
		player.src = chunkUrl(chunk, index, total)
		player.play().catch((error) => {
			cleanUp()
			reject(error)
		})
	})
}

async function speak(text) {
	const token = ++playbackToken
	const chunks = splitIntoChunks(text)

	player.pause()
	setStatus('Prehrávam…')

	try {
		for (const [index, chunk] of chunks.entries()) {
			if (token !== playbackToken) {
				return
			}
			await playChunk(chunk, index, chunks.length)
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

clearHistoryButton.addEventListener('click', () => {
	history = history.filter((item) => item.pinned)
	saveHistory()
	renderHistory()
})
