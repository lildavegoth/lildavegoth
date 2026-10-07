(function() {
    var STYLE_ID = 'audioPlayerStyles';
    var AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|oga|opus|weba|mp2|mpga|3gp|3gpp)$/i;
    var pluginActive = false;
    var contentObserver = null;
    var readingObserver = null;
    var scanDebounce = null;
    var activeAudio = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '.audio-player{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-medium);padding:10px 14px;margin:1rem 0;box-sizing:border-box;width:100%;}' +
            '.audio-play-btn{width:42px;height:42px;flex-shrink:0;border-radius:50%;background:var(--accent-color);color:#000;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:transform 0.15s ease;}' +
            '.audio-play-btn:hover{opacity:0.9;}' +
            '.audio-play-btn:active{transform:scale(0.9);}' +
            '.audio-progress-wrap{flex:1;min-width:0;display:flex;align-items:center;}' +
            '.audio-progress{width:100%;-webkit-appearance:none;appearance:none;height:8px;background:rgba(255,255,255,0.15);border-radius:4px;outline:none;cursor:pointer;}' +
            '.audio-progress::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:transparent;}' +
            '.audio-progress::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;background:var(--accent-color);border-radius:50%;border:none;margin-top:-3px;cursor:pointer;}' +
            '.audio-progress::-moz-range-track{height:8px;border-radius:4px;background:transparent;}' +
            '.audio-progress::-moz-range-thumb{width:14px;height:14px;background:var(--accent-color);border-radius:50%;border:none;cursor:pointer;}' +
            '.audio-time{color:var(--text-secondary);font-size:0.8rem;white-space:nowrap;min-width:82px;text-align:right;font-variant-numeric:tabular-nums;}' +
            '.audio-hidden{display:none !important;}';
        document.head.appendChild(style);
    }

    function removeStyles() {
        var el = document.getElementById(STYLE_ID);
        if (el) el.remove();
    }

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        var m = Math.floor(seconds / 60);
        var s = Math.floor(seconds % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function createPlayer(audioUrl) {
        var wrapper = document.createElement('div');
        wrapper.className = 'audio-player';

        var audio = document.createElement('audio');
        audio.src = audioUrl;
        audio.preload = 'metadata';
        audio.className = 'audio-hidden';
        wrapper.appendChild(audio);

        var playBtn = document.createElement('button');
        playBtn.className = 'audio-play-btn';
        playBtn.type = 'button';
        playBtn.setAttribute('aria-label', 'Play');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        wrapper.appendChild(playBtn);

        var progressWrap = document.createElement('div');
        progressWrap.className = 'audio-progress-wrap';
        var progress = document.createElement('input');
        progress.type = 'range';
        progress.className = 'audio-progress';
        progress.min = 0;
        progress.max = 100;
        progress.value = 0;
        progress.setAttribute('aria-label', 'Seek');
        progressWrap.appendChild(progress);
        wrapper.appendChild(progressWrap);

        var timeEl = document.createElement('span');
        timeEl.className = 'audio-time';
        timeEl.textContent = '0:00 / 0:00';
        wrapper.appendChild(timeEl);

        function paintProgress(pct) {
            progress.style.background = 'linear-gradient(to right, var(--accent-color) ' + pct + '%, rgba(255,255,255,0.15) ' + pct + '%)';
        }

        function updateProgress() {
            if (audio.duration && isFinite(audio.duration)) {
                var pct = (audio.currentTime / audio.duration) * 100;
                progress.value = pct;
                paintProgress(pct);
                timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
            }
        }

        audio.addEventListener('loadedmetadata', updateProgress);
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', function() {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            progress.value = 0;
            paintProgress(0);
            timeEl.textContent = '0:00 / ' + formatTime(audio.duration);
            if (activeAudio === audio) activeAudio = null;
        });

        playBtn.addEventListener('click', function() {
            if (audio.paused) {
                if (activeAudio && activeAudio !== audio) {
                    activeAudio.pause();
                    var otherBtn = activeAudio.parentNode ? activeAudio.parentNode.querySelector('.audio-play-btn') : null;
                    if (otherBtn) otherBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
                audio.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                activeAudio = audio;
            } else {
                audio.pause();
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (activeAudio === audio) activeAudio = null;
            }
        });

        progress.addEventListener('input', function() {
            if (audio.duration && isFinite(audio.duration)) {
                audio.currentTime = (this.value / 100) * audio.duration;
                paintProgress(this.value);
                timeEl.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
            }
        });

        return wrapper;
    }

    function scanAndReplace() {
        if (!pluginActive) return;
        var content = document.getElementById('readingContent');
        if (!content) return;
        var imgs = content.querySelectorAll('img');
        imgs.forEach(function(img) {
            var alt = img.getAttribute('alt') || '';
            if (!AUDIO_EXT.test(alt)) return;
            var src = img.getAttribute('src') || '';
            if (!src) return;
            var player = createPlayer(src);
            var mc = img.closest('.media-container');
            var target = mc || img;
            if (target.parentNode) {
                target.parentNode.replaceChild(player, target);
            }
        });
    }

    function scheduleScan() {
        if (!pluginActive) return;
        if (scanDebounce) clearTimeout(scanDebounce);
        scanDebounce = setTimeout(scanAndReplace, 150);
    }

    function hookReading() {
        var content = document.getElementById('readingContent');
        if (content) {
            if (contentObserver) contentObserver.disconnect();
            contentObserver = new MutationObserver(scheduleScan);
            contentObserver.observe(content, { childList: true, subtree: true });
        }
        var readingMode = document.getElementById('readingMode');
        if (readingMode) {
            if (readingObserver) readingObserver.disconnect();
            readingObserver = new MutationObserver(function() {
                if (readingMode.classList.contains('active')) scheduleScan();
            });
            readingObserver.observe(readingMode, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function unhookReading() {
        if (contentObserver) { contentObserver.disconnect(); contentObserver = null; }
        if (readingObserver) { readingObserver.disconnect(); readingObserver = null; }
        if (scanDebounce) { clearTimeout(scanDebounce); scanDebounce = null; }
    }

    function deactivate() {
        pluginActive = false;
        if (activeAudio) {
            try { activeAudio.pause(); } catch (e) {}
            activeAudio = null;
        }
        removeStyles();
        unhookReading();
        document.querySelectorAll('.audio-player').forEach(function(p) {
            var audio = p.querySelector('audio');
            var src = audio ? audio.getAttribute('src') : '';
            var img = document.createElement('img');
            if (src) img.setAttribute('src', src);
            if (p.parentNode) p.parentNode.replaceChild(img, p);
        });
    }

    function wrapTogglePlugin() {
        if (window.__audioPlayerToggleWrapped) return;
        window.__audioPlayerToggleWrapped = true;
        var orig = window.togglePlugin;
        if (typeof orig !== 'function') return;
        window.togglePlugin = function(name, checked) {
            if (name === 'Audio Player' && !checked) deactivate();
            return orig.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Audio Player',
        description: 'Play audio files attached to notes with a custom player.',
        version: '1.0',
        init: function(app) {
            pluginActive = true;
            injectStyles();
            hookReading();
            wrapTogglePlugin();
            scheduleScan();
            app.on('app:ready', function() {
                hookReading();
                scheduleScan();
            });
        }
    };

    if (window.NotesApp) {
        window.NotesApp.plugins.register(plugin);
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            window.NotesApp.plugins.register(plugin);
        });
    }
})();
