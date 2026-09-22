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
		stop: 'Stop',
		playing: 'Playing…',
		playingDevice: 'Playing with the device voice…',
		error: 'Could not play the audio. Try again.',
		noVoice: 'This device has no voice for this language.',
		history: 'History',
		clear: 'Clear',
		clearUnpinned: 'Clear unpinned',
		empty: 'Nothing has been spoken yet.',
		pin: 'Pin',
		unpin: 'Unpin',
		edit: 'Edit',
		save: 'Save',
		settings: 'Settings',
		speechLanguage: 'Speech language',
		deviceVoice: 'Only the device voice',
		deviceVoiceNote: 'Nothing you type is sent to Google. The voice sounds less natural.',
		privacy: 'Privacy',
		show: 'Show',
		close: 'Close',
	},
	cs: {
		placeholder: 'Napiš, co mám říct…',
		inputLabel: 'Text k přehrání',
		play: 'Přehrát',
		stop: 'Zastavit',
		playing: 'Přehrávám…',
		playingDevice: 'Přehrávám hlasem zařízení…',
		error: 'Zvuk se nepodařilo přehrát. Zkus to znovu.',
		noVoice: 'Zařízení nemá pro tento jazyk hlas.',
		history: 'Historie',
		clear: 'Vymazat',
		clearUnpinned: 'Vymazat nepřipnuté',
		empty: 'Zatím nic nebylo přehráno.',
		pin: 'Připnout',
		unpin: 'Odepnout',
		edit: 'Upravit',
		save: 'Uložit',
		settings: 'Nastavení',
		speechLanguage: 'Jazyk řeči',
		deviceVoice: 'Jen hlas zařízení',
		deviceVoiceNote: 'Nic z napsaného se neposílá Googlu. Hlas zní méně přirozeně.',
		privacy: 'Soukromí',
		show: 'Ukázat',
		close: 'Zavřít',
	},
	sk: {
		placeholder: 'Napíš, čo mám povedať…',
		inputLabel: 'Text na prehratie',
		play: 'Prehrať',
		stop: 'Zastaviť',
		playing: 'Prehrávam…',
		playingDevice: 'Prehrávam hlasom zariadenia…',
		error: 'Nepodarilo sa prehrať zvuk. Skús to znova.',
		noVoice: 'Zariadenie nemá pre tento jazyk hlas.',
		history: 'História',
		clear: 'Vymazať',
		clearUnpinned: 'Vymazať nepripnuté',
		empty: 'Zatiaľ nič nebolo prehraté.',
		pin: 'Pripnúť',
		unpin: 'Odopnúť',
		edit: 'Upraviť',
		save: 'Uložiť',
		settings: 'Nastavenia',
		speechLanguage: 'Jazyk reči',
		deviceVoice: 'Len hlas zariadenia',
		deviceVoiceNote: 'Nič z napísaného sa neposiela Googlu. Hlas znie menej prirodzene.',
		privacy: 'Súkromie',
		show: 'Ukázať',
		close: 'Zavrieť',
	},
}
const FALLBACK_UI_LANGUAGE = 'en'
// A browser that names none of the languages above gets Czech: the app is
// made for people here first, and the list order is no statement about that.
const DEFAULT_LANGUAGE = 'cs'
// Seeded on the very first run: with an empty history the first real situation
// is the worst moment to be typing from scratch.
const PRESETS = {
	en: [
		'I cannot speak right now, so I am writing.',
		'Please wait a moment, I am writing.',
		'Could I have a glass of water, please?',
		'Thank you.',
	],
	cs: [
		'Teď nemůžu mluvit, tak píšu.',
		'Počkejte chvíli, píšu.',
		'Prosím vás o sklenici vody.',
		'Děkuji.',
	],
	sk: [
		'Teraz nemôžem hovoriť, tak píšem.',
		'Počkajte chvíľu, píšem.',
		'Poprosím pohár vody.',
		'Ďakujem.',
	],
}
const MAX_CHUNK_LENGTH = 180
const HISTORY_STORAGE_KEY = 'speechless:history'
const LANGUAGE_STORAGE_KEY = 'speechless:language'
const DEVICE_VOICE_STORAGE_KEY = 'speechless:device-voice'
const HISTORY_LIMIT = 50

// index.html and settings.html both load this file; the form only exists on
// the app page. Settings are read on both, so a change made on settings.html
// is picked up when the app page loads again.
let language = loadLanguage()
// Opt out of Google TTS: the typed text then never leaves the phone.
let deviceVoiceOnly = loadDeviceVoiceOnly()

if (document.querySelector('#form')) {
	initApp()
} else {
	initSettings()
}

// Makes the app installable on the home screen; failing registration (file://,
// private mode) must not break speaking.
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('sw.js').catch(() => {})
	})
}

function uiLanguage() {
	return TRANSLATIONS[language] ? language : FALLBACK_UI_LANGUAGE
}

function texts() {
	return TRANSLATIONS[uiLanguage()]
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
	return DEFAULT_LANGUAGE
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

function loadDeviceVoiceOnly() {
	try {
		return localStorage.getItem(DEVICE_VOICE_STORAGE_KEY) === 'true'
	} catch {
		return false
	}
}

function initSettings() {
	const heading = document.querySelector('#settings-heading')
	const languageSelect = document.querySelector('#language')
	const languageLabel = document.querySelector('#language-label')
	const deviceVoiceCheckbox = document.querySelector('#device-voice')
	const deviceVoiceLabel = document.querySelector('#device-voice-label')
	const deviceVoiceNote = document.querySelector('#device-voice-note')

	languageSelect.replaceChildren(
		...LANGUAGES.map(({ code, label }) => {
			const option = document.createElement('option')
			option.value = code
			option.textContent = label
			return option
		}),
	)
	languageSelect.value = language
	deviceVoiceCheckbox.checked = deviceVoiceOnly
	render()

	function render() {
		const strings = texts()
		document.documentElement.lang = uiLanguage()
		document.title = `${strings.settings} · Speechless`
		heading.textContent = strings.settings
		languageLabel.textContent = strings.speechLanguage
		deviceVoiceLabel.textContent = strings.deviceVoice
		deviceVoiceNote.textContent = strings.deviceVoiceNote
	}

	languageSelect.addEventListener('change', () => {
		language = languageSelect.value
		try {
			localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
		} catch {
			// The choice then lasts only for this visit.
		}
		// The page follows the spoken language right away, like the app does.
		render()
	})

	deviceVoiceCheckbox.addEventListener('change', () => {
		deviceVoiceOnly = deviceVoiceCheckbox.checked
		try {
			localStorage.setItem(DEVICE_VOICE_STORAGE_KEY, String(deviceVoiceOnly))
		} catch {
			// The choice then lasts only for this visit.
		}
	})
}

function initApp() {
	const form = document.querySelector('#form')
	const input = document.querySelector('#input')
	const statusElement = document.querySelector('#status')
	const historyList = document.querySelector('#history')
	const historyEmpty = document.querySelector('#history-empty')
	const clearHistoryButton = document.querySelector('#clear-history')
	const submitButton = document.querySelector('#submit')
	const historyHeading = document.querySelector('#history-heading')
	const settingsLabel = document.querySelector('#settings-label')
	const privacyLink = document.querySelector('#privacy-link')
	const showButton = document.querySelector('#show')
	const saveButton = document.querySelector('#save')
	const overlay = document.querySelector('#overlay')
	const overlayText = document.querySelector('#overlay-text')
	const overlaySpeakButton = document.querySelector('#overlay-speak')
	const overlayCloseButton = document.querySelector('#overlay-close')

	const EYE_ICON =
		'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<path fill="currentColor" d="M12 5C7 5 3 9.5 3 12s4 7 9 7 9-4.5 9-7-4-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/>' +
		'</svg>'
	const PENCIL_ICON =
		'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
		'<path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>' +
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
	let playing = false
	let abortCurrentChunk = null
	// The history entry whose text is in the composer for editing, or null.
	// Save writes the field back into it; Play and Show treat the field as
	// something new, so a pinned phrase can serve as a template.
	let editingText = null
	let history = loadHistory()

	renderTexts()
	renderHistory()

	function renderTexts() {
		const strings = texts()
		document.documentElement.lang = uiLanguage()
		input.placeholder = strings.placeholder
		input.setAttribute('aria-label', strings.inputLabel)
		submitButton.textContent = strings.play
		historyHeading.textContent = strings.history
		historyEmpty.textContent = strings.empty
		settingsLabel.textContent = strings.settings
		privacyLink.textContent = strings.privacy
		// The page holds every translation; the hash picks the matching one.
		privacyLink.href = `privacy.html#${uiLanguage()}`
		showButton.textContent = strings.show
		saveButton.textContent = strings.save
		overlayCloseButton.textContent = strings.close
		renderActionButtons()
		renderStatus()
	}

	// Phrases keep the language they are written in, so a German speaker gets the
	// English wording read by an English voice instead of German nonsense.
	function seededHistory() {
		const presetLanguage = PRESETS[language] ? language : FALLBACK_UI_LANGUAGE
		return PRESETS[presetLanguage].map((text) => ({ text, pinned: true, lang: presetLanguage }))
	}

	function loadHistory() {
		let raw = null
		try {
			raw = localStorage.getItem(HISTORY_STORAGE_KEY)
		} catch {
			// Storage unavailable; the presets are still better than nothing.
		}

		// Only a missing key means a first run. An empty array means the user
		// cleared the history, and seeding it again would undo that.
		if (raw === null) {
			return seededHistory()
		}

		try {
			const stored = JSON.parse(raw)
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
		historyList.replaceChildren(...history.map(renderEntry))

		const pinnedCount = history.filter((item) => item.pinned).length
		historyEmpty.hidden = history.length > 0
		clearHistoryButton.hidden = history.length === pinnedCount
		clearHistoryButton.textContent = pinnedCount > 0 ? texts().clearUnpinned : texts().clear
	}

	function renderEntry({ text, pinned, lang }) {
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

		const edit = document.createElement('button')
		edit.type = 'button'
		edit.className = 'history-edit-button'
		edit.innerHTML = PENCIL_ICON
		edit.setAttribute('aria-label', `${texts().edit}: ${text}`)
		// Lit while this entry's text is in the composer.
		edit.setAttribute('aria-pressed', String(text === editingText))
		edit.addEventListener('click', () => {
			toggleEditing(text)
		})

		item.append(play, show, edit, pin)
		return item
	}

	// The pencil puts the entry into the composer, where the ordinary keyboard
	// and buttons already are; a second tap on the same pencil takes it out.
	function toggleEditing(text) {
		if (text === editingText) {
			input.value = ''
			stopEditing()
			input.focus()
			return
		}
		editingText = text
		input.value = text
		renderHistory()
		renderActionButtons()
		input.focus()
		input.setSelectionRange(text.length, text.length)
	}

	function stopEditing() {
		if (editingText === null) {
			return
		}
		editingText = null
		renderHistory()
		renderActionButtons()
	}

	function saveEdit() {
		const text = input.value.trim()
		if (editingText === null || !text) {
			return
		}
		if (text !== editingText) {
			const edited = history.find((item) => item.text === editingText)
			const duplicate = history.find((item) => item.text === text)
			// Two rows with one text would be a puzzle, so they merge, and a pin
			// on either side survives.
			history = sortPinnedFirst(
				history
					.filter((item) => item === edited || item.text !== text)
					.map((item) => (item === edited ? { ...item, text, pinned: item.pinned || duplicate?.pinned === true } : item)),
			)
			saveHistory()
		}
		input.value = ''
		stopEditing()
		input.focus()
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
	// The button says Stop only while it would actually stop: once something is
	// typed, the same press speaks that instead.
	function renderActionButtons() {
		const strings = texts()
		submitButton.textContent = playing && input.value.trim() === '' ? strings.stop : strings.play
		overlaySpeakButton.textContent = playing ? strings.stop : strings.play
		saveButton.hidden = editingText === null
	}

	function setPlaying(value) {
		playing = value
		renderActionButtons()
	}

	function cancelPlayback() {
		// Bumping the token first makes the aborted chunk read as cancelled rather
		// than as a failure, which would hand over to the device voice.
		playbackToken += 1
		stopPlayback()
		setPlaying(false)
		setStatus(null)
	}

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
				abortCurrentChunk = null
			}
			const handleEnded = () => {
				cleanUp()
				resolve()
			}
			const handleError = () => {
				cleanUp()
				reject(new Error('audio-failed'))
			}

			// Pausing fires no event, so the pending chunk has to be settled by hand.
			abortCurrentChunk = () => {
				cleanUp()
				reject(new Error('cancelled'))
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
		abortCurrentChunk?.()
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
				setPlaying(false)
			}
		} catch (error) {
			if (token === playbackToken) {
				setStatus(error.message === 'no-voice' ? 'noVoice' : 'error', 'error')
				setPlaying(false)
			}
		}
	}

	async function speak(text, spokenLanguage = language) {
		const token = ++playbackToken
		stopPlayback()
		setPlaying(true)

		// Offline the request would only fail slowly, and on iOS the user gesture
		// that allows speaking would be gone by then. With the opt-in the request
		// must not be made at all: that is the whole point of the setting.
		if (deviceVoiceOnly || navigator.onLine === false) {
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
				setPlaying(false)
			}
		} catch {
			if (token !== playbackToken) {
				return
			}
			// Google TTS is unreachable or refused; the device voice still works.
			await speakWithDevice(text, spokenLanguage, token)
		}
	}

	// Play and Show both start by taking what is in the field: it goes into
	// the history as its own entry, whether or not it began as an edit of
	// another one, and the field is left empty for the next thing to say.
	function takeText() {
		const text = input.value.trim()
		if (!text) {
			return ''
		}
		input.value = ''
		// Keeps the on-screen keyboard open on a phone.
		input.focus()
		editingText = null
		// Renders the rows, so the pencil goes out with it.
		addToHistory(text)
		renderActionButtons()
		return text
	}

	function submit() {
		const text = takeText()
		if (!text) {
			// Nothing to say: the same button is the way to stop what is playing.
			if (playing) {
				cancelPlayback()
			}
			return
		}
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
		const text = takeText()
		if (text) {
			openOverlay(text, language)
		}
	})

	saveButton.addEventListener('click', saveEdit)

	overlaySpeakButton.addEventListener('click', () => {
		if (playing) {
			cancelPlayback()
			return
		}
		speak(shownText, shownLanguage ?? language)
	})

	input.addEventListener('input', () => {
		if (editingText !== null && input.value.trim() === '') {
			// Renders the buttons itself.
			stopEditing()
		} else {
			renderActionButtons()
		}
	})

	overlayCloseButton.addEventListener('click', closeOverlay)

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !overlay.hidden) {
			closeOverlay()
		}
	})

	clearHistoryButton.addEventListener('click', () => {
		history = history.filter((item) => item.pinned)
		saveHistory()
		renderHistory()
	})
}
