(function() {
    var GAME_STORAGE = 'gamifyNotesData';
    var ACTIVE_STORAGE = 'gamifyActiveNotes';
    var XP_PER_TASK = 10;
    var COINS_PER_TASK = 1;
    var XP_PER_LEVEL_BASE = 250;

    function defaultGameData() {
        return {
            xp: 0,
            level: 1,
            coins: 0,
            items: [],
            totalTasksCompleted: 0
        };
    }

    function getGameData() {
        try {
            var raw = localStorage.getItem(GAME_STORAGE);
            if (!raw) return defaultGameData();
            var data = JSON.parse(raw);
            if (!data || typeof data.level !== 'number') return defaultGameData();
            return data;
        } catch (e) {
            return defaultGameData();
        }
    }

    function saveGameData(data) {
        localStorage.setItem(GAME_STORAGE, JSON.stringify(data));
    }

    function getActiveNotes() {
        try {
            return JSON.parse(localStorage.getItem(ACTIVE_STORAGE) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveActiveNotes(ids) {
        localStorage.setItem(ACTIVE_STORAGE, JSON.stringify(ids));
    }

    function isNoteGamified(noteId) {
        var num = Number(noteId);
        return getActiveNotes().indexOf(num) !== -1;
    }

    function addNoteToActive(noteId) {
        var num = Number(noteId);
        var list = getActiveNotes();
        if (list.indexOf(num) === -1) {
            list.push(num);
            saveActiveNotes(list);
        }
    }

    function removeNoteFromActive(noteId) {
        var num = Number(noteId);
        var list = getActiveNotes().filter(function(id) { return id !== num; });
        saveActiveNotes(list);
    }

    function clearAllGamifyData() {
        localStorage.removeItem(GAME_STORAGE);
        localStorage.removeItem(ACTIVE_STORAGE);
    }

    function maxXPForLevel(level) {
        return XP_PER_LEVEL_BASE * level;
    }

    function grantTaskReward() {
        var data = getGameData();
        data.xp += XP_PER_TASK;
        data.coins += COINS_PER_TASK;
        data.totalTasksCompleted = (data.totalTasksCompleted || 0) + 1;
        while (data.xp >= maxXPForLevel(data.level)) {
            data.xp -= maxXPForLevel(data.level);
            data.level += 1;
        }
        saveGameData(data);
        return data;
    }

    function injectStyles() {
        if (document.getElementById('gamifyPluginStyles')) return;
        var style = document.createElement('style');
        style.id = 'gamifyPluginStyles';
        style.textContent =
            '.gamify-bar{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--bg-black);border-bottom:1px solid rgba(255,255,255,0.05);}' +
            '.gamify-progress-wrap{flex:1;position:relative;height:10px;background:rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;}' +
            '.gamify-progress-fill{position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,var(--accent-color),#9bc726);border-radius:20px;transition:width 0.5s ease;}' +
            '.gamify-shimmer{position:absolute;top:0;left:-8px;width:3px;height:100%;background:rgba(255,255,255,0.9);border-radius:4px;box-shadow:0 0 8px rgba(255,255,255,0.7);animation:gamifyShimmer 2s linear infinite;pointer-events:none;z-index:2;}' +
            '@keyframes gamifyShimmer{0%{left:-8px;}100%{left:calc(100% + 8px);}}' +
            '.gamify-level-badge{background:var(--accent-color);color:#000;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;white-space:nowrap;flex-shrink:0;}' +
            '.gamify-btn{background:rgba(30,30,30,0.9) !important;color:var(--text-secondary) !important;border:none !important;width:40px;height:40px;border-radius:var(--radius-small);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s ease;flex-shrink:0;}' +
            '.gamify-btn.active{background:var(--accent-color) !important;color:#000 !important;}' +
            '.gamify-btn:hover{transform:scale(1.05);}' +
            '.gamify-btn-wrapper{display:flex;gap:8px;align-items:center;}' +
            '.gamify-choice-btn{width:100%;padding:16px;margin-bottom:10px;background:var(--bg-card);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:var(--text-primary);font-weight:600;font-size:1rem;cursor:pointer;display:flex;align-items:center;gap:14px;transition:all 0.3s;text-align:left;}' +
            '.gamify-choice-btn:hover{border-color:var(--accent-color);background:rgba(193,252,50,0.08);}' +
            '.gamify-choice-btn i{font-size:1.5rem;color:var(--accent-color);flex-shrink:0;}' +
            '.gamify-choice-btn.disabled{opacity:0.45;cursor:not-allowed;}' +
            '.gamify-choice-btn.disabled:hover{border-color:rgba(255,255,255,0.1);background:var(--bg-card);}' +
            '.gamify-choice-desc{font-size:0.8rem;color:var(--text-secondary);font-weight:400;margin-top:2px;}' +
            '.gamify-choice-body{flex:1;}';
        document.head.appendChild(style);
    }

    function barHTML() {
        return '<div class="gamify-progress-wrap">' +
            '<div class="gamify-progress-fill"></div>' +
            '<div class="gamify-shimmer"></div>' +
            '</div>' +
            '<div class="gamify-level-badge">Lv 1</div>';
    }

    function injectBars() {
        var readingMeta = document.querySelector('.reading-meta');
        if (readingMeta && !document.querySelector('[data-gamify-bar-reading]')) {
            var readingBar = document.createElement('div');
            readingBar.className = 'gamify-bar';
            readingBar.setAttribute('data-gamify-bar-reading', 'true');
            readingBar.style.display = 'none';
            readingBar.innerHTML = barHTML();
            readingMeta.parentNode.insertBefore(readingBar, readingMeta.nextSibling);
        }

        var editorHeader = document.querySelector('.editor-header');
        if (editorHeader && !document.querySelector('[data-gamify-bar-editor]')) {
            var editorBar = document.createElement('div');
            editorBar.className = 'gamify-bar';
            editorBar.setAttribute('data-gamify-bar-editor', 'true');
            editorBar.style.display = 'none';
            editorBar.innerHTML = barHTML();
            editorHeader.parentNode.insertBefore(editorBar, editorHeader.nextSibling);
        }
    }

    function updateBar(bar) {
        if (!bar) return;
        var data = getGameData();
        var max = maxXPForLevel(data.level);
        var percent = Math.min(100, (data.xp / max) * 100);
        var fill = bar.querySelector('.gamify-progress-fill');
        if (fill) fill.style.width = percent + '%';
        var badge = bar.querySelector('.gamify-level-badge');
        if (badge) badge.textContent = 'Lv ' + data.level;
    }

    function updateGamifyBars(noteId) {
        injectBars();
        var gamified = noteId && isNoteGamified(noteId);
        var readingBar = document.querySelector('[data-gamify-bar-reading]');
        var editorBar = document.querySelector('[data-gamify-bar-editor]');
        [readingBar, editorBar].forEach(function(bar) {
            if (!bar) return;
            bar.style.display = gamified ? 'flex' : 'none';
            if (gamified) updateBar(bar);
        });
    }

    function injectGameButton() {
        var headerRow = document.querySelector('.reading-mode-header .header-row');
        if (!headerRow) return;
        if (headerRow.querySelector('.gamify-btn')) return;

        var editBtn = headerRow.querySelector('.back-button.square-accent');
        if (!editBtn) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'gamify-btn-wrapper';
        editBtn.parentNode.insertBefore(wrapper, editBtn);
        wrapper.appendChild(editBtn);

        var gameBtn = document.createElement('button');
        gameBtn.type = 'button';
        gameBtn.className = 'back-button gamify-btn';
        gameBtn.id = 'gamifyToggleBtn';
        gameBtn.innerHTML = '<i class="fas fa-gamepad"></i>';
        gameBtn.title = 'Game Mode';
        gameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleGameButtonClick();
        });
        wrapper.insertBefore(gameBtn, editBtn);
    }

    function updateGameButtonState(noteId) {
        var btn = document.getElementById('gamifyToggleBtn');
        if (!btn) return;
        if (noteId && isNoteGamified(noteId)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    function handleGameButtonClick() {
        var noteId = Number(window.NotesApp.getCurrentNoteId());
        if (!noteId) return;
        if (isNoteGamified(noteId)) {
            openDisableConfirm(noteId);
        } else {
            openGameModeChoice(noteId);
        }
    }

    function openGameModeChoice(noteId) {
        document.getElementById('popupTitle').textContent = 'Choose Game Mode';
        document.getElementById('popupBody').innerHTML =
            '<button type="button" class="gamify-choice-btn" id="gamifyPickTodo">' +
            '<i class="fas fa-list-check"></i>' +
            '<div class="gamify-choice-body">' +
            '<div>To-Do List Game</div>' +
            '<div class="gamify-choice-desc">Check to-do items to earn XP and coins.</div>' +
            '</div>' +
            '</button>' +
            '<button type="button" class="gamify-choice-btn disabled" id="gamifyPickRpg">' +
            '<i class="fas fa-dragon"></i>' +
            '<div class="gamify-choice-body">' +
            '<div>RPG Game</div>' +
            '<div class="gamify-choice-desc">Coming soon.</div>' +
            '</div>' +
            '</button>';
        document.getElementById('universalPopup').style.display = 'flex';

        document.getElementById('gamifyPickTodo').addEventListener('click', function() {
            activateGamify(noteId);
            closeUniversalPopup();
        });
    }

    function activateGamify(noteId) {
        addNoteToActive(noteId);
        if (!localStorage.getItem(GAME_STORAGE)) {
            saveGameData(defaultGameData());
        }
        updateGameButtonState(noteId);
        updateGamifyBars(noteId);
        window.showMessage('Game mode activated');
    }

    function openDisableConfirm(noteId) {
        document.getElementById('popupTitle').textContent = 'Disable Game Mode';
        document.getElementById('popupBody').innerHTML =
            '<p>Disabling Game Mode for this note will remove its gamify data. Continue?</p>' +
            '<div class="popup-buttons">' +
            '<button class="popup-btn secondary" id="gamifyDisableCancel">Cancel</button>' +
            '<button class="popup-btn danger" id="gamifyDisableConfirm">Disable</button>' +
            '</div>';
        document.getElementById('universalPopup').style.display = 'flex';

        document.getElementById('gamifyDisableCancel').addEventListener('click', function() {
            closeUniversalPopup();
        });

        document.getElementById('gamifyDisableConfirm').addEventListener('click', function() {
            removeNoteFromActive(noteId);
            updateGameButtonState(noteId);
            updateGamifyBars(noteId);
            closeUniversalPopup();
            window.showMessage('Game mode disabled');
        });
    }

    function wrapTaskToggle() {
        if (window.__gamifyTaskWrapped) return;
        window.__gamifyTaskWrapped = true;

        var original = window.toggleTaskListItem;
        if (typeof original !== 'function') return;

        window.toggleTaskListItem = function(lineIndex) {
            var noteId = Number(window.NotesApp.getCurrentNoteId());
            if (noteId && isNoteGamified(noteId)) {
                var note = window.NotesApp.getNotes().find(function(n) {
                    return Number(n.id) === noteId;
                });
                if (note) {
                    var lines = (note.content || '').split('\n');
                    var line = lines[lineIndex];
                    if (line && line.indexOf('- [ ]') !== -1) {
                        grantTaskReward();
                    }
                }
            }
            return original.apply(this, arguments);
        };
    }

    function wrapNoteOpen() {
        if (window.__gamifyOpenWrapped) return;
        window.__gamifyOpenWrapped = true;

        var originalReading = window.openNoteReadingMode;
        if (typeof originalReading === 'function') {
            window.openNoteReadingMode = function(noteId) {
                var result = originalReading.apply(this, arguments);
                setTimeout(function() {
                    injectBars();
                    updateGameButtonState(noteId);
                    updateGamifyBars(noteId);
                }, 50);
                return result;
            };
        }

        var originalEditor = window.openNoteEditor;
        if (typeof originalEditor === 'function') {
            window.openNoteEditor = function(noteId) {
                var result = originalEditor.apply(this, arguments);
                setTimeout(function() {
                    injectBars();
                    updateGamifyBars(noteId);
                }, 50);
                return result;
            };
        }

        var originalEditFromReading = window.editFromReading;
        if (typeof originalEditFromReading === 'function') {
            window.editFromReading = function() {
                var result = originalEditFromReading.apply(this, arguments);
                var id = Number(window.NotesApp.getCurrentNoteId());
                setTimeout(function() {
                    injectBars();
                    updateGamifyBars(id);
                }, 50);
                return result;
            };
        }
    }

    function injectProfileSection(profileBody) {
        var existing = profileBody.querySelector('.gamify-profile-section');
        if (existing) existing.remove();

        if (getActiveNotes().length === 0) return;
        if (localStorage.getItem(GAME_STORAGE) === null) return;

        var data = getGameData();
        var max = maxXPForLevel(data.level);

        var section = document.createElement('div');
        section.className = 'profile-section gamify-profile-section';
        section.innerHTML =
            '<div class="profile-section-title">Gamify Progress</div>' +
            '<div class="profile-card">' +
            '<div class="profile-row"><span class="profile-label">Level</span><span class="profile-value">' + data.level + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Experience</span><span class="profile-value">' + data.xp + ' / ' + max + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Coins</span><span class="profile-value">' + data.coins + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Tasks Completed</span><span class="profile-value">' + (data.totalTasksCompleted || 0) + '</span></div>' +
            '</div>';
        profileBody.appendChild(section);
    }

    function setupProfileObserver() {
        if (window.__gamifyProfileObserver) return;
        window.__gamifyProfileObserver = true;

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    var target = m.target;
                    if (target.id === 'profileOverlay' && target.classList.contains('active')) {
                        var body = target.querySelector('.profile-body');
                        if (body) injectProfileSection(body);
                    }
                }
            });
        });
        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['class']
        });
    }

    function wrapOpenProfile() {
        if (window.__gamifyProfileWrapped) return;
        window.__gamifyProfileWrapped = true;

        var original = window.openProfile;
        if (typeof original !== 'function') return;

        window.openProfile = function() {
            var result = original.apply(this, arguments);
            var body = document.querySelector('.profile-body');
            if (body) injectProfileSection(body);
            return result;
        };
    }

    function wrapDisablePlugin() {
        if (window.__gamifyDisableWrapped) return;
        window.__gamifyDisableWrapped = true;

        var original = window.togglePlugin;
        if (typeof original !== 'function') return;

        window.togglePlugin = function(name, checked) {
            if (name === 'Gamify Notes' && !checked) {
                document.getElementById('popupTitle').textContent = 'Disable Gamify Notes';
                document.getElementById('popupBody').innerHTML =
                    '<p>Disabling Gamify Notes will erase all game data (XP, level, coins, tasks completed) for every note. Continue?</p>' +
                    '<div class="popup-buttons">' +
                    '<button class="popup-btn secondary" id="gamifyPluginCancel">Cancel</button>' +
                    '<button class="popup-btn danger" id="gamifyPluginConfirm">Disable</button>' +
                    '</div>';
                document.getElementById('universalPopup').style.display = 'flex';

                document.getElementById('gamifyPluginCancel').addEventListener('click', function() {
                    closeUniversalPopup();
                    if (typeof window.renderPluginList === 'function') window.renderPluginList();
                });

                document.getElementById('gamifyPluginConfirm').addEventListener('click', function() {
                    clearAllGamifyData();
                    closeUniversalPopup();
                    return original.apply(window, [name, checked]);
                });
                return;
            }
            return original.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Gamify Notes',
        description: 'Turn notes into a gamified to-do list with XP, levels, and coins.',
        version: '1.0',
        init: function(app) {
            injectStyles();
            injectBars();
            injectGameButton();
            wrapTaskToggle();
            wrapNoteOpen();
            wrapOpenProfile();
            wrapDisablePlugin();
            setupProfileObserver();
            app.on('app:ready', function() {
                setTimeout(function() {
                    injectBars();
                    injectGameButton();
                }, 200);
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