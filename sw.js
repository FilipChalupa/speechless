// build.mjs stamps the build id, so every deploy starts with a clean cache.
const CACHE_NAME = 'speechless-shell-__BUILD_ID__'
// Only the entry document is precached; versioned assets (main.js?v=…) are
// picked up by the fetch handler, so the list never goes out of sync.
const SHELL = ['./', 'index.html']

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting()),
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((names) =>
				Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
			)
			.then(() => self.clients.claim()),
	)
})

// Network first: a deploy is picked up immediately and the cache is only a
// fallback for being offline. Speech itself always needs the network.
self.addEventListener('fetch', (event) => {
	const { request } = event
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
		return
	}

	// GitHub Pages serves assets with max-age=14400, so without forcing a
	// revalidation an installed app could keep a stale build for hours.
	event.respondWith(
		fetch(request, { cache: 'no-cache' })
			.then((response) => {
				const copy = response.clone()
				caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
				return response
			})
			.catch(() => caches.match(request).then((cached) => cached ?? caches.match('./'))),
	)
})
