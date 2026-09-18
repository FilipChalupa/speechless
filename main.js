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
		return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : []
	} catch {
		return []
	}
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
		...history.map((text) => {
			const item = document.createElement('li')
			const button = document.createElement('button')
			button.type = 'button'
			button.className = 'history-item'
			button.textContent = text
			button.addEventListener('click', () => {
				speak(text)
			})
			item.append(button)
			return item
		}),
	)
	historyEmpty.hidden = history.length > 0
	clearHistoryButton.hidden = history.length === 0
}

function addToHistory(text) {
	history = [text, ...history.filter((item) => item !== text)].slice(0, HISTORY_LIMIT)
	saveHistory()
	renderHistory()
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
	history = []
	saveHistory()
	renderHistory()
})
