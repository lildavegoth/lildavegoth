const CACHE_NAME = 'kakoi-kiraku-app-v1.7.1';
const META_CACHE = 'kakoi-kiraku-meta-v1';
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

const monitoredUrls = new Set(urlsToCache.map(url => {
    if (url.startsWith('http')) return url;
    return new URL(url, self.location.origin).href;
}));

function resolveUrl(url) {
    if (url.startsWith('http')) return url;
    return new URL(url, self.location.origin).href;
}

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(urlsToCache.map(url => cache.add(url).catch(() => {})));
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME && cacheName !== META_CACHE) {
                    return caches.delete(cacheName);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/pages/articles/images/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    const requestUrl = event.request.url;
    const isMonitored = monitoredUrls.has(requestUrl);

    if (isMonitored) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const fetchAndUpdate = async () => {
                    try {
                        const headResp = await fetch(requestUrl, { method: 'HEAD', cache: 'no-store' });
                        const newSize = headResp.headers.get('Content-Length');
                        if (!newSize) return;

                        const metaCache = await caches.open(META_CACHE);
                        const sizeRecord = await metaCache.match(requestUrl);
                        let oldSize = null;
                        if (sizeRecord) oldSize = await sizeRecord.text();

                        if (oldSize !== newSize) {
                            const freshResp = await fetch(requestUrl, { cache: 'no-store' });
                            if (freshResp.ok) {
                                const cache = await caches.open(CACHE_NAME);
                                await cache.put(event.request, freshResp.clone());
                                await metaCache.put(requestUrl, new Response(newSize));
                            }
                        }
                    } catch (e) {}
                };
                fetchAndUpdate();
                return cached;
            })
        );
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return response;
        }))
    );
});
