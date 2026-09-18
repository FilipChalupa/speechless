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
// The interface follows the spoken language where it is translated, and falls
// back to English everywhere else.
const TRANSLATIONS = {
	en: {
		placeholder: 'Type what I should say…',
		inputLabel: 'Text to speak',
		play: 'Play',
		playing: 'Playing…',
		playingDevice: 'Playing with the device voice…',
		error: 'Could not play the audio. Try again.',
		noVoice: 'This device has no offline voice for this language.',
		history: 'History',
		clear: 'Clear',
		clearUnpinned: 'Clear unpinned',
		empty: 'Nothing has been spoken yet.',
		pin: 'Pin',
		unpin: 'Unpin',
		settings: 'Settings',
		speechLanguage: 'Speech language',
		show: 'Show',
		close: 'Close',
	},
	cs: {
		placeholder: 'Napiš, co mám říct…',
		inputLabel: 'Text k přehrání',
		play: 'Přehrát',
		playing: 'Přehrávám…',
		playingDevice: 'Přehrávám hlasem zařízení…',
		error: 'Zvuk se nepodařilo přehrát. Zkus to znovu.',
		noVoice: 'Zařízení nemá pro tento jazyk offline hlas.',
		history: 'Historie',
		clear: 'Vymazat',
		clearUnpinned: 'Vymazat nepřipnuté',
		empty: 'Zatím nic nebylo přehráno.',
		pin: 'Připnout',
		unpin: 'Odepnout',
		settings: 'Nastavení',
		speechLanguage: 'Jazyk řeči',
		show: 'Ukázat',
		close: 'Zavřít',
	},
	sk: {
		placeholder: 'Napíš, čo mám povedať…',
		inputLabel: 'Text na prehratie',
		play: 'Prehrať',
		playing: 'Prehrávam…',
		playingDevice: 'Prehrávam hlasom zariadenia…',
		error: 'Nepodarilo sa prehrať zvuk. Skús to znova.',
		noVoice: 'Zariadenie nemá pre tento jazyk offline hlas.',
		history: 'História',
		clear: 'Vymazať',
		clearUnpinned: 'Vymazať nepripnuté',
		empty: 'Zatiaľ nič nebolo prehraté.',
		pin: 'Pripnúť',
		unpin: 'Odopnúť',
		settings: 'Nastavenia',
		speechLanguage: 'Jazyk reči',
		show: 'Ukázať',
		close: 'Zavrieť',
	},
}
const FALLBACK_UI_LANGUAGE = 'en'
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
const submitButton = document.querySelector('#submit')
const historyHeading = document.querySelector('#history-heading')
const settingsHeading = document.querySelector('#settings-heading')
const languageLabel = document.querySelector('#language-label')
const showButton = document.querySelector('#show')
const overlay = document.querySelector('#overlay')
const overlayText = document.querySelector('#overlay-text')
const overlaySpeakButton = document.querySelector('#overlay-speak')
const overlayCloseButton = document.querySelector('#overlay-close')

const EYE_ICON =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
	'<path fill="currentColor" d="M12 5C7 5 3 9.5 3 12s4 7 9 7 9-4.5 9-7-4-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>' +
	'</svg>'

// A single reused element keeps playback unlocked on iOS after the first tap.
const player = new Audio()
player.preload = 'auto'

let playbackToken = 0
// Declared here, not next to setStatus: renderTexts() reads them during the
// init calls below, which would hit the temporal dead zone.
let statusKey = null
let statusTone = null
let shownText = ''
let shownLanguage = null
let wakeLock = null
let language = loadLanguage()
let history = loadHistory()

renderLanguages()
renderTexts()
renderHistory()

function uiLanguage() {
	return TRANSLATIONS[language] ? language : FALLBACK_UI_LANGUAGE
}

function texts() {
	return TRANSLATIONS[uiLanguage()]
}

function renderTexts() {
	const strings = texts()
	document.documentElement.lang = uiLanguage()
	input.placeholder = strings.placeholder
	input.setAttribute('aria-label', strings.inputLabel)
	submitButton.textContent = strings.play
	historyHeading.textContent = strings.history
	historyEmpty.textContent = strings.empty
	settingsHeading.textContent = strings.settings
	languageLabel.textContent = strings.speechLanguage
	showButton.textContent = strings.show
	overlaySpeakButton.textContent = strings.play
	overlayCloseButton.textContent = strings.close
	renderStatus()
}

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
			pin.setAttribute('aria-label', pinned ? texts().unpin : texts().pin)
			pin.addEventListener('click', () => {
				togglePin(text)
			})

			const show = document.createElement('button')
			show.type = 'button'
			show.className = 'history-show'
			show.innerHTML = EYE_ICON
			show.setAttribute('aria-label', `${texts().show}: ${text}`)
			show.addEventListener('click', () => {
				openOverlay(text, lang ?? language)
			})

			item.append(play, show, pin)
			return item
		}),
	)

	const pinnedCount = history.filter((item) => item.pinned).length
	historyEmpty.hidden = history.length > 0
	clearHistoryButton.hidden = history.length === pinnedCount
	clearHistoryButton.textContent = pinnedCount > 0 ? texts().clearUnpinned : texts().clear
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

// The status is kept as a key, not as finished text: an error stays on screen
// until the next playback, so it has to follow a language change.
function setStatus(key, tone) {
	statusKey = key
	statusTone = tone ?? null
	renderStatus()
}

function renderStatus() {
	statusElement.textContent = statusKey ? texts()[statusKey] : ''
	if (statusTone) {
		statusElement.dataset.tone = statusTone
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

function stopPlayback() {
	player.pause()
	if ('speechSynthesis' in window) {
		speechSynthesis.cancel()
	}
}

// Voices are populated asynchronously and can still be empty on first call.
function availableVoices() {
	return new Promise((resolve) => {
		const ready = speechSynthesis.getVoices()
		if (ready.length > 0) {
			resolve(ready)
			return
		}
		const timer = setTimeout(() => resolve(speechSynthesis.getVoices()), 1000)
		speechSynthesis.addEventListener(
			'voiceschanged',
			() => {
				clearTimeout(timer)
				resolve(speechSynthesis.getVoices())
			},
			{ once: true },
		)
	})
}

async function deviceSpeech(text, spokenLanguage) {
	if (!('speechSynthesis' in window)) {
		throw new Error('no-voice')
	}
	const voice = (await availableVoices()).find(
		(candidate) => candidate.lang.toLowerCase().replace('_', '-').split('-')[0] === spokenLanguage,
	)
	// Speaking with the wrong voice would produce nonsense, so refuse instead.
	if (!voice) {
		throw new Error('no-voice')
	}

	await new Promise((resolve, reject) => {
		const utterance = new SpeechSynthesisUtterance(text)
		utterance.voice = voice
		utterance.lang = voice.lang
		utterance.addEventListener('end', () => resolve())
		utterance.addEventListener('error', (event) => reject(new Error(event.error ?? 'speech-failed')))
		speechSynthesis.speak(utterance)
	})
}

async function speakWithDevice(text, spokenLanguage, token) {
	setStatus('playingDevice')
	try {
		await deviceSpeech(text, spokenLanguage)
		if (token === playbackToken) {
			setStatus(null)
		}
	} catch (error) {
		if (token === playbackToken) {
			setStatus(error.message === 'no-voice' ? 'noVoice' : 'error', 'error')
		}
	}
}

async function speak(text, spokenLanguage = language) {
	const token = ++playbackToken
	stopPlayback()

	// Offline the request would only fail slowly, and on iOS the user gesture
	// that allows speaking would be gone by then.
	if (navigator.onLine === false) {
		await speakWithDevice(text, spokenLanguage, token)
		return
	}

	setStatus('playing')
	try {
		const chunks = splitIntoChunks(text)
		for (const [index, chunk] of chunks.entries()) {
			if (token !== playbackToken) {
				return
			}
			await playChunk(chunk, index, chunks.length, spokenLanguage)
		}
		if (token === playbackToken) {
			setStatus(null)
		}
	} catch {
		if (token !== playbackToken) {
			return
		}
		// Google TTS is unreachable or refused; the device voice still works.
		await speakWithDevice(text, spokenLanguage, token)
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

// Reading distance decides the size: a short phrase is the one held up across
// a room, a long one has to stay on screen at all.
function sizeTier(text) {
	const { length } = text.trim()
	if (length <= 16) {
		return 'xl'
	}
	if (length <= 48) {
		return 'l'
	}
	if (length <= 120) {
		return 'm'
	}
	return 's'
}

async function requestWakeLock() {
	try {
		wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
	} catch {
		// Not granted or unsupported; the screen may dim but showing still works.
	}
}

function releaseWakeLock() {
	wakeLock?.release().catch(() => {})
	wakeLock = null
}

function openOverlay(text, spokenLanguage) {
	shownText = text
	shownLanguage = spokenLanguage
	overlayText.textContent = text
	overlay.dataset.size = sizeTier(text)
	overlay.hidden = false
	overlayCloseButton.focus()
	requestWakeLock()
}

function closeOverlay() {
	overlay.hidden = true
	releaseWakeLock()
	input.focus()
}

showButton.addEventListener('click', () => {
	const text = input.value.trim()
	if (!text) {
		return
	}
	input.value = ''
	addToHistory(text)
	openOverlay(text, language)
})

overlaySpeakButton.addEventListener('click', () => {
	speak(shownText, shownLanguage ?? language)
})

overlayCloseButton.addEventListener('click', closeOverlay)

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && !overlay.hidden) {
		closeOverlay()
	}
})

languageSelect.addEventListener('change', () => {
	language = languageSelect.value
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
	} catch {
		// The choice then lasts only for this visit.
	}
	// Interface language follows the spoken one; badges depend on it too.
	renderTexts()
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
