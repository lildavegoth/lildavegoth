const CACHE_NAME = 'kakoi-kiraku-app-v2';
const IDB_NAME = 'AppCacheManifest';
const IDB_STORE = 'versions';

const urlsToCache = [
    '/',
    'account.html',
    'auth-check.js',
    'browser-homepage.html',
    'giveaway.html',
    'index.html',
    'manifest.json',
    'media.css',
    'navigation.css',
    'notification.cssjs',
    'protections.js',
    'storage.html',
    'sw.js',
    'apps-manager.html',
    'pages/2048.html',
    'pages/appflowy-json-converter.html',
    'pages/adblock-checker.html',
    'pages/ai-chat.html',
    'pages/authenticator.html',
    'pages/bytes-converter.html',
    'pages/calculator.html',
    'pages/calendar.html',
    'pages/card-maker.html',
    'pages/code-comparator.html',
    'pages/color-detector.html',
    'pages/currency-converter.html',
    'pages/css-icons-displayer.html',
    'pages/dice-generator.html',
    'pages/dictionary-manager.html',
    'pages/downloads-task.html',
    'pages/font-previewer.html',
    'pages/github-publisher.html',
    'pages/heartopia-gcodes.html',
    'pages/hiragana-learner.html',
    'pages/html-cleaner.html',
    'pages/html-editor.html',
    'pages/html-generator.html',
    'pages/icon-list',
    'pages/icon-pack.html',
    'pages/image-to-base64.html',
    'pages/inertia.html',
    'pages/journal.html',
    'pages/kiraku-store.html',
    'pages/links-vault.html',
    'pages/lyricure.html',
    'pages/markdown-editor.html',
    'pages/mockups-generator.html',
    'pages/movies-gallery.html',
    'pages/movies-player.html',
    'pages/multi-countdown.html',
    'pages/music-player.html',
    'pages/notes-app.html',
    'pages/o-css-snippets-gallery.html',
    'pages/o-table-formatting.html',
    'pages/ocr-tool.html',
    'pages/pixel-svg-maker.html',
    'pages/pocket-garden/pocket-garden.html',
    'pages/posters-gallery.html',
    'pages/private-storage.html',
    'pages/projects-task.html',
    'pages/routine-quest.html',
    'pages/sitemapxml-generator.html',
    'pages/subscriptions-manager.html',
    'pages/svg-color-changer.html',
    'pages/svg-optimizer.html',
    'pages/svg-rasterizer.html',
    'pages/svg-to-datauri.html',
    'pages/text-based-life.html',
    'pages/timer-converter.html',
    'pages/tic-tac-toe.html',
    'pages/typing-game.html',
    'pages/userscripts-gallery.html',
    'pages/userscript-json-format',
    'pages/wallet.html',
    'pages/watermark-applier.html',
    'pages/weather.html',
    'pages/yaml-validator.html',
    'pages/youtube-thumbnail-grabber.html',
    'pages/articles/articles-home.html',
    'pages/articles/article-page.html',
    'pages/articles/articles-publisher.html',
    'pages/voidgarden/adventure.html',
    'pages/voidgarden/character.html',
    'pages/voidgarden/credits.html',
    'pages/voidgarden/shared-data.js',
    'pages/voidgarden/shop.html',
    'pages/voidgarden/voidgarden.html',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/articles.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/pages.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/popup-pages.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/gift-codes.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/javascript.js',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/o-css-snippets.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/userscripts.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/world-events.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/easy_story_1.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/easy_story_2.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/easy_story_3.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/easy_story_4.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/med_story_1.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/med_story_2.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/med_story_3.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/med_story_4.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/hard_story_1.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/hard_story_2.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/hard_story_3.txt',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/hard_story_4.txt',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/webfonts/fa-solid-900.woff2',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

const STALE_WHILE_REVALIDATE_URLS = [
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/articles.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/pages.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/popup-pages.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/gift-codes.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/javascript.js',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/o-css-snippets.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/userscripts.json',
    'https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/files/fetch/world-events.json'
];

let manifest = {};

function openIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'url' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadManifest() {
    try {
        const db = await openIDB();
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getAll = store.getAll();
        return new Promise((resolve, reject) => {
            getAll.onsuccess = () => {
                const entries = getAll.result || [];
                const map = {};
                entries.forEach(entry => { map[entry.url] = { version: entry.version, live: entry.live }; });
                manifest = map;
                resolve(map);
            };
            getAll.onerror = reject;
        });
    } catch (e) {
        manifest = {};
        return {};
    }
}

async function saveManifestEntry(url, version, live) {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    if (version === undefined && live === undefined) {
        store.delete(url);
    } else {
        store.put({ url, version, live });
    }
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
    });
}

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => cache.add(url).catch(() => {}))
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
    event.waitUntil(loadManifest());
});

function getVersionedRequest(request, url) {
    const entry = manifest[url];
    if (!entry || !entry.version || entry.live) return request;
    const versionedUrl = url + '?__cache_version__=' + entry.version;
    return new Request(versionedUrl, {
        method: request.method,
        headers: request.headers,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect,
        referrer: request.referrer,
        integrity: request.integrity
    });
}

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const requestUrl = url.origin + url.pathname;

    if (url.pathname.startsWith('/pages/articles/images/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    const entry = manifest[requestUrl];
    if (entry && entry.live) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (STALE_WHILE_REVALIDATE_URLS.includes(requestUrl)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const versionedReq = getVersionedRequest(event.request, requestUrl);
                const cachedResponse = await cache.match(versionedReq);
                const fetchUrl = event.request.url + '?t=' + Date.now();
                const fetchPromise = fetch(fetchUrl, { cache: 'no-cache' })
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(versionedReq, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {});
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(getVersionedRequest(event.request, requestUrl), clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    const versionedReq = getVersionedRequest(event.request, requestUrl);
                    return caches.match(versionedReq).then(cached => cached || caches.match('index.html'));
                })
        );
        return;
    }

    event.respondWith(
        caches.match(getVersionedRequest(event.request, requestUrl))
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(getVersionedRequest(event.request, requestUrl), clone);
                        });
                    }
                    return response;
                });
            })
    );
});

self.addEventListener('message', async event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    const port = event.ports[0];
    if (!port) return;

    try {
        if (event.data.type === 'GET_URL_LIST') {
            port.postMessage({ urls: urlsToCache.filter(u => !u.startsWith('http') || u.startsWith(location.origin)) });
        } else if (event.data.type === 'GET_MANIFEST') {
            await loadManifest();
            port.postMessage({ manifest: { ...manifest } });
        } else if (event.data.type === 'SET_VERSION') {
            const { url, version } = event.data;
            manifest[url] = { version, live: false };
            await saveManifestEntry(url, version, false);
            port.postMessage({ success: true });
        } else if (event.data.type === 'TOGGLE_LIVE') {
            const { url } = event.data;
            const current = manifest[url] || {};
            const newLive = !current.live;
            manifest[url] = { version: current.version || '', live: newLive };
            await saveManifestEntry(url, current.version || '', newLive);
            port.postMessage({ success: true });
        } else {
            port.postMessage({ error: 'Unknown message type' });
        }
    } catch (e) {
        port.postMessage({ error: e.message });
    }
});
