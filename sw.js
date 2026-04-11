const CACHE_NAME = 'kakoi-kiraku-app-v1.6.2';
const urlsToCache = [
    // Root
    '/',
    'account.html',
    'auth-check.js',
    'browser-homepage.html',
    'giveaway.html',
    'index.html',
    'javascript',
    'manifest.json',
    'media.css',
    'navigation.css',
    'notification.cssjs',
    'protections.js',
    'storage.html',
    'sw.js',
    // Pages
    'pages/2048.html',
    'pages/appflowy-json-converter.html',
    'pages/adblock-checker.html',
    'pages/ai-chat.html',
    'pages/calculator.html',
    'pages/calendar.html',
    'pages/card-maker.html',
    'pages/code-comparator.html',
    'pages/color-detector.html',
    'pages/currency-converter.html',
    'pages/dice-generator.html',
    'pages/dictionary-manager.html',
    'pages/downloads-task.html',
    'page/font-previewer.html',
    'pages/heartopia-gcodes.html',
    'pages/hiragana-learner.html',
    'pages/html-cleaner.html',
    'pages/html-editor.html',
    'pages/html-generator.html',
    'pages/icon-list',
    'pages/icon-pack.html',
    'pages/image-to-base64.html',
    'pages/journal.html',
    'pages/kiraku-store.html',
    'pages/links-vault.html',
    'pages/lyricure.html',
    'pages/markdown-editor.html',
    'pages/mockups-generator.html',
    'pages/movies-gallery.html',
    'pages/movies-player.html',
    'pages/music-player.html',
    'pages/notes-app.html',
    'pages/o-css-snippets-gallery.html',
    'pages/o-table-formatting.html',
    'pages/ocr-tool.html',
    'pages/pixel-svg-maker.html',
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
    'pages/typing-game.html',
    'pages/userscripts-gallery.html',
    'pages/userscript-json-format',
    'pages/wallet.html',
    'pages/watermark-applier.html',
    'pages/weather.html',
    'pages/yaml-validator.html',
    'pages/youtube-thumbnail-grabber.html',
    // Pocket Garden
    'pages/pocket-garden/pocket-garden.html',
    'pages/pocket-garden/images/decorations/flowery-hanger.png',
    'pages/pocket-garden/images/decorations/wood-bed-board.png',
    'pages/pocket-garden/images/plants/empty.png',
    'pages/pocket-garden/images/plants/pothos-hearted.png',
    'pages/pocket-garden/images/plants/pothos-normal.png',
    'pages/pocket-garden/images/plants/pothos-hearted/stage1.png',
    'pages/pocket-garden/images/plants/pothos-hearted/stage2.png',
    'pages/pocket-garden/images/plants/pothos-hearted/stage3.png',
    'pages/pocket-garden/images/plants/pothos-normal/stage1.png',
    'pages/pocket-garden/images/plants/pothos-normal/stage2.png',
    'pages/pocket-garden/images/plants/pothos-normal/stage3.png',
    'pages/pocket-garden/images/pots/glassy.png',
    // Voidgarden
    'pages/voidgarden/adventure.html',
    'pages/voidgarden/character.html',
    'pages/voidgarden/credits.html',
    'pages/voidgarden/shared-data.js',
    'pages/voidgarden/shop.html',
    'pages/voidgarden/voidgarden.html',
    'pages/voidgarden/images/carrot-grow.png',
    'pages/voidgarden/images/carrot-ready.png',
    'pages/voidgarden/images/carrot-seed.png',
    'pages/voidgarden/images/door-closed.png',
    'pages/voidgarden/images/door-open.png',
    'pages/voidgarden/images/land-decor.png',
    'pages/voidgarden/images/land-decor2.gif',
    'pages/voidgarden/images/land.png',
    'pages/voidgarden/images/land2.png',
    'pages/voidgarden/images/wheat-grow.png',
    'pages/voidgarden/images/wheat-ready.png',
    'pages/voidgarden/images/wheat-seed.png',
    'pages/voidgarden/images/ui/icon-carrot.png',
    'pages/voidgarden/images/ui/icon-wheat.png',
    // Images
    'images/4ever.webp',
    'images/card.webp',
    'images/left-side.webp',
    'images/right-side.webp',
    'images/screenshots.webp',
    'images/icons/browser-homepage.webp',
    'images/icons/kiraku-home.png',
    // Posters
    'images/posters/again-n-again.webp',
    'images/posters/dear-god.webp',
    'images/posters/feelings.webp',
    'images/posters/its-too-late.webp',
    'images/posters/no-longer-priority.webp',
    'images/posters/sickens-me.webp',
    // Blob Storage
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Articles/articles.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/pages.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/popup-pages.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/javascript.js',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Obsidian%20CSS%20Snippets%20Gallery/css-snippets.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/UserScripts%20Gallery/userscripts.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Calendar/world-events.json',
    // Stories
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/easy_story_1.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/easy_story_2.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/easy_story_3.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/easy_story_4.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/med_story_1.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/med_story_2.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/med_story_3.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/med_story_4.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/hard_story_1.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/hard_story_2.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/hard_story_3.txt',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Typing%20Game/hard_story_4.txt',
    // Bundles
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/webfonts/fa-solid-900.woff2'
];

const STALE_WHILE_REVALIDATE_URLS = [
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Articles/articles.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/pages.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/popup-pages.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/javascript.js',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Obsidian%20CSS%20Snippets%20Gallery/css-snippets.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/UserScripts%20Gallery/userscripts.json',
    'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Calendar/world-events.json'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(() => {});
                })
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
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const requestPath = url.origin + url.pathname;

    if (STALE_WHILE_REVALIDATE_URLS.includes(requestPath)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cachedResponse = await cache.match(event.request);
                const fetchUrl = event.request.url + '?t=' + Date.now();
                const fetchPromise = fetch(fetchUrl, { cache: 'no-cache' })
                    .then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
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
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(cached => cached || caches.match('index.html')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request).then(response => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            }))
    );
});

self.addEventListener('message', event => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});