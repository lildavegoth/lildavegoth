const CACHE_NAME = 'kakoi-app-v1';
const urlsToCache = [
    // Root
    './',
    './account.html',
    './auth.js',
    './browser-homepage.html',
    './index.html',
    './manifest.json',
    './media.css',
    './navigation.css',
    './notification.js',
    './protections.js',
    './sw.js',
    // Pages
    './pages/3-tiles.html',
    './pages/2048.html',
    './pages/appflowy-json-converter.html',
    './pages/app-list.html',
    './pages/calendar.html',
    './pages/color-detector.html',
    './pages/dice-generator.html',
    './pages/dictionary-manager.html',
    './pages/giveaway.html',
    './pages/html-cleaner.html',
    './pages/html-editor.html',
    './pages/html-generator.html',
    './pages/icon-pack.html',
    './pages/image-to-base64.html',
    './pages/links-vault.html',
    './pages/markdown-editor.html',
    './pages/mockups-generator.html',
    './pages/movies-gallery.html',
    './pages/movies-player.html',
    './pages/music-player.html',
    './pages/notes-app.html',
    './pages/o-css-snippets-gallery.html',
    './pages/o-table-formatting.html',
    './pages/ocr-tool.html',
    './pages/posters-gallery.html',
    './pages/private-storage.html',
    './pages/projects-task.html',
    './pages/routine-quest.html',
    './pages/svg-color-changer.html',
    './pages/svg-optimizer.html',
    './pages/svg-rasterizer.html',
    './pages/svg-to-datauri.html',
    './pages/typing-game.html',
    './pages/userscripts-gallery.html',
    './pages/wallet.html',
    './pages/weather.html',
    './pages/yaml-validator.html',
    './pages/youtube-thumbnail-grabber.html',
    // Voidgarden
    './pages/voidgarden/adventure.html',
    './pages/voidgarden/character.html',
    './pages/voidgarden/credits.html',
    './pages/voidgarden/shared-data.js',
    './pages/voidgarden/shop.html',
    './pages/voidgarden/voidgarden.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});