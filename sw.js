// All Page
const CACHE_NAME = 'kakoi-kiraku-app-v3';
const urlsToCache = [
    // Root
    '',
    'account.html',
    'auth.js',
    'browser-homepage.html',
    'index.html',
    'manifest.json',
    'media.css',
    'navigation.css',
    'notification.cssjs',
    'protections.js',
    'sw.js',
    // Pages
    'pages/3-tiles.html',
    'pages/2048.html',
    'pages/appflowy-json-converter.html',
    'pages/app-list.html',
    'pages/calendar.html',
    'pages/color-detector.html',
    'pages/dice-generator.html',
    'pages/dictionary-manager.html',
    'pages/giveaway.html',
    'pages/html-cleaner.html',
    'pages/html-editor.html',
    'pages/html-generator.html',
    'pages/icon-pack.html',
    'pages/image-to-base64.html',
    'pages/links-vault.html',
    'pages/markdown-editor.html',
    'pages/mockups-generator.html',
    'pages/movies-gallery.html',
    'pages/movies-player.html',
    'pages/music-player.html',
    'pages/notes-app.html',
    'pages/o-css-snippets-gallery.html',
    'pages/o-table-formatting.html',
    'pages/ocr-tool.html',
    'pages/posters-gallery.html',
    'pages/private-storage.html',
    'pages/projects-task.html',
    'pages/routine-quest.html',
    'pages/svg-color-changer.html',
    'pages/svg-optimizer.html',
    'pages/svg-rasterizer.html',
    'pages/svg-to-datauri.html',
    'pages/typing-game.html',
    'pages/userscripts-gallery.html',
    'pages/wallet.html',
    'pages/weather.html',
    'pages/yaml-validator.html',
    'pages/youtube-thumbnail-grabber.html',
    // Voidgarden
    'pages/voidgarden/adventure.html',
    'pages/voidgarden/character.html',
    'pages/voidgarden/credits.html',
    'pages/voidgarden/shared-data.js',
    'pages/voidgarden/shop.html',
    'pages/voidgarden/voidgarden.html'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache).catch(err => {
                });
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
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                return caches.match('index.html');
            })
    );
});

const ALL_FILES_TO_CACHE = [
    // Root
    '',
    'account.html',
    'auth.js',
    'browser-homepage.html',
    'index.html',
    'manifest.json',
    'media.css',
    'navigation.css',
    'notification.cssjs',
    'protections.js',
    'sw.js',
    // Pages
    'pages/3-tiles.html',
    'pages/2048.html',
    'pages/appflowy-json-converter.html',
    'pages/app-list.html',
    'pages/calendar.html',
    'pages/color-detector.html',
    'pages/dice-generator.html',
    'pages/dictionary-manager.html',
    'pages/giveaway.html',
    'pages/html-cleaner.html',
    'pages/html-editor.html',
    'pages/html-generator.html',
    'pages/icon-pack.html',
    'pages/image-to-base64.html',
    'pages/links-vault.html',
    'pages/markdown-editor.html',
    'pages/mockups-generator.html',
    'pages/movies-gallery.html',
    'pages/movies-player.html',
    'pages/music-player.html',
    'pages/notes-app.html',
    'pages/o-css-snippets-gallery.html',
    'pages/o-table-formatting.html',
    'pages/ocr-tool.html',
    'pages/posters-gallery.html',
    'pages/private-storage.html',
    'pages/projects-task.html',
    'pages/routine-quest.html',
    'pages/svg-color-changer.html',
    'pages/svg-optimizer.html',
    'pages/svg-rasterizer.html',
    'pages/svg-to-datauri.html',
    'pages/typing-game.html',
    'pages/userscripts-gallery.html',
    'pages/wallet.html',
    'pages/weather.html',
    'pages/yaml-validator.html',
    'pages/youtube-thumbnail-grabber.html',
    // Voidgarden
    'pages/voidgarden/adventure.html',
    'pages/voidgarden/character.html',
    'pages/voidgarden/credits.html',
    'pages/voidgarden/shared-data.js',
    'pages/voidgarden/shop.html',
    'pages/voidgarden/voidgarden.html'
];

self.addEventListener('message', event => {
    if (event.data.type === 'CACHE_ALL') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return Promise.all(
                    ALL_FILES_TO_CACHE.map(url => {
                        return cache.add(url).catch(err => {
                            console.log('Failed to cache:', url, err);
                        });
                    })
                );
            })
        );
    }
});

// Music
let audioCheckInterval = null;
let currentAudioData = null;
let lastUpdateTime = 0;

self.addEventListener('message', (event) => {
    if (event.data.type === 'START_AUDIO_CHECK') {
        if (audioCheckInterval) clearInterval(audioCheckInterval);
        
        currentAudioData = event.data.audioData;
        lastUpdateTime = Date.now();
        
        audioCheckInterval = setInterval(() => {
            if (!currentAudioData) return;
            
            const now = Date.now();
            const timePassed = (now - lastUpdateTime) / 1000;
            
            currentAudioData.currentTime += timePassed;
            lastUpdateTime = now;
            
            if (currentAudioData.currentTime >= currentAudioData.duration - 1) {
                self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'AUDIO_END_SOON' });
                    });
                });
            }
        }, 500);
    }
    
    if (event.data.type === 'UPDATE_AUDIO_TIME') {
        currentAudioData = event.data.audioData;
        lastUpdateTime = Date.now();
    }
    
    if (event.data.type === 'STOP_AUDIO_CHECK') {
        if (audioCheckInterval) clearInterval(audioCheckInterval);
        audioCheckInterval = null;
        currentAudioData = null;
    }
    
    if (event.data.type === 'NEXT_SONG') {
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({ type: 'PLAY_NEXT_SONG' });
            });
        });
    }
});