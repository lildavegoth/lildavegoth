(function() {
    var STORAGE_KEY = 'homepageNoteTitle';

    function getHomepageTitle() {
        return localStorage.getItem(STORAGE_KEY) || '';
    }

    function setHomepageTitle(title) {
        if (title) {
            localStorage.setItem(STORAGE_KEY, title);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    function findNoteByTitle(title) {
        if (!title) return null;
        var notes = window.NotesApp.getNotes();
        var lower = title.trim().toLowerCase();
        return notes.find(function(n) {
            return n.title && n.title.trim().toLowerCase() === lower;
        }) || null;
    }

    function openHomepageNote() {
        var title = getHomepageTitle();
        if (!title) return false;
        var note = findNoteByTitle(title);
        if (note) {
            window.openNoteReadingMode(note.id);
            return true;
        }
        return false;
    }

    function injectStyles() {
        if (document.getElementById('homepagePluginStyles')) return;
        var style = document.createElement('style');
        style.id = 'homepagePluginStyles';
        style.textContent =
            '.homepage-card-input-wrap{display:flex;gap:8px;align-items:center;padding:0 0 4px 0;}' +
            '.homepage-card-input{flex:1;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:var(--text-primary);font-size:0.9rem;outline:none;}' +
            '.homepage-card-input::placeholder{color:var(--text-secondary);}' +
            '.homepage-card-save{padding:10px 16px;border:none;border-radius:12px;background:var(--accent-color);color:#000;font-weight:600;cursor:pointer;font-size:0.85rem;}' +
            '.homepage-card-save:hover{background:var(--accent-hover,#d2ff62);}' +
            '.homepage-card-clear{padding:10px 16px;border:1px solid rgba(255,255,255,0.15);border-radius:12px;background:transparent;color:var(--text-secondary);font-weight:600;cursor:pointer;font-size:0.85rem;}' +
            '.homepage-card-clear:hover{color:var(--text-primary);background:rgba(255,255,255,0.06);}';
        document.head.appendChild(style);
    }

    function buildSettingsUI() {
        injectStyles();
        if (document.getElementById('homepagePluginSection')) return;

        var settingsPage = document.getElementById('settings-page');
        if (!settingsPage) return;

        var section = document.createElement('div');
        section.id = 'homepagePluginSection';

        var card = document.createElement('div');
        card.className = 'settings-card';
        card.style.cursor = 'default';
        card.innerHTML =
            '<div class="settings-card-icon"><i class="fas fa-home"></i></div>' +
            '<div class="settings-card-content">' +
            '<div class="settings-card-title">Homepage Note</div>' +
            '<div class="settings-card-desc">Type a note title to open it automatically on launch</div>' +
            '</div>';

        var inputWrap = document.createElement('div');
        inputWrap.className = 'homepage-card-input-wrap';
        inputWrap.style.padding = '0 0 12px 0';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'homepage-card-input';
        input.placeholder = 'Note title...';
        input.value = getHomepageTitle();

        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'homepage-card-save';
        saveBtn.textContent = 'Save';

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'homepage-card-clear';
        clearBtn.textContent = 'Clear';

        saveBtn.addEventListener('click', function() {
            var title = input.value.trim();
            if (!title) {
                window.showMessage('Please enter a note title');
                return;
            }
            var note = findNoteByTitle(title);
            if (!note) {
                window.showMessage('No note found with that title');
                return;
            }
            setHomepageTitle(title);
            window.showMessage('Homepage set: ' + title);
        });

        clearBtn.addEventListener('click', function() {
            setHomepageTitle('');
            input.value = '';
            window.showMessage('Homepage removed');
        });

        inputWrap.appendChild(input);
        inputWrap.appendChild(saveBtn);
        inputWrap.appendChild(clearBtn);

        section.appendChild(card);
        section.appendChild(inputWrap);

        var pluginsList = document.getElementById('pluginsList');
        if (pluginsList && pluginsList.parentNode === settingsPage) {
            settingsPage.insertBefore(section, pluginsList);
        } else {
            settingsPage.appendChild(section);
        }
    }

    var plugin = {
        name: 'Homepage',
        description: 'Open a specific note automatically when the app launches.',
        version: '1.0',
        init: function(app) {
            buildSettingsUI();

            app.on('app:ready', function() {
                setTimeout(function() {
                    openHomepageNote();
                }, 350);
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
