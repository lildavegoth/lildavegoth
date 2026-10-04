(function() {
    var STORAGE_KEY = 'recentNotesPluginList';
    var EXPAND_KEY = 'recentNotesPluginExpanded';
    var MAX_RECENT = 5;

    function getRecent() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveRecent(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function isExpanded() {
        return localStorage.getItem(EXPAND_KEY) === 'true';
    }

    function setExpanded(value) {
        localStorage.setItem(EXPAND_KEY, value ? 'true' : 'false');
    }

    function trackNote(noteId) {
        var num = Number(noteId);
        if (!num) return;
        var list = getRecent().filter(function(id) {
            return Number(id) !== num;
        });
        list.unshift(num);
        if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT);
        saveRecent(list);
    }

    function removeInjected() {
        document.querySelectorAll('[data-recent-plugin]').forEach(function(el) {
            el.remove();
        });
    }

    function injectSidebarItems() {
        var folderList = document.getElementById('homeFolderList');
        if (!folderList) return;

        removeInjected();

        var notes = window.NotesApp.getNotes();
        var recent = getRecent().filter(function(id) {
            return notes.some(function(n) {
                return Number(n.id) === Number(id);
            });
        });
        saveRecent(recent);

        var rootItem = folderList.querySelector('.home-folder-item');
        if (!rootItem) return;

        var expanded = isExpanded();

        var header = document.createElement('button');
        header.className = 'home-folder-item';
        header.setAttribute('data-recent-plugin', 'header');
        header.innerHTML =
            '<span class="home-folder-icon"><i class="fas fa-clock"></i></span>' +
            '<span class="home-folder-name">Recently Open</span>' +
            (recent.length > 0 ? '<span class="home-folder-count">' + recent.length + '</span>' : '') +
            '<button class="home-folder-chevron" data-chevron="recent-plugin"><i class="fas ' + (expanded ? 'fa-chevron-circle-up' : 'fa-chevron-circle-down') + '"></i></button>';

        header.querySelector('.home-folder-chevron').addEventListener('click', function(e) {
            e.stopPropagation();
            setExpanded(!isExpanded());
            injectSidebarItems();
        });

        if (rootItem.nextSibling) {
            folderList.insertBefore(header, rootItem.nextSibling);
        } else {
            folderList.appendChild(header);
        }

        if (expanded && recent.length > 0) {
            var insertAfter = header;
            recent.forEach(function(noteId) {
                var note = notes.find(function(n) {
                    return Number(n.id) === Number(noteId);
                });
                if (!note) return;

                var noteItem = document.createElement('button');
                noteItem.className = 'home-folder-item home-note-sidebar-item';
                noteItem.setAttribute('data-recent-plugin', 'note');
                noteItem.style.paddingLeft = '28px';
                noteItem.innerHTML =
                    '<span class="home-folder-icon"><i class="fas fa-sticky-note"></i></span>' +
                    '<span class="home-folder-name">' + (note.title || 'Untitled') + '</span>';

                noteItem.addEventListener('click', function() {
                    window.openNoteReadingMode(note.id);
                });

                if (insertAfter.nextSibling) {
                    folderList.insertBefore(noteItem, insertAfter.nextSibling);
                } else {
                    folderList.appendChild(noteItem);
                }
                insertAfter = noteItem;
            });
        }
    }

    function wrapFunctions() {
        if (window.__recentNotesPluginWrapped) return;
        window.__recentNotesPluginWrapped = true;

        var originalRender = window.renderHomeFolders;
        if (typeof originalRender === 'function') {
            window.renderHomeFolders = function() {
                originalRender.apply(this, arguments);
                injectSidebarItems();
            };
        }

        var originalOpen = window.openNoteReadingMode;
        if (typeof originalOpen === 'function') {
            window.openNoteReadingMode = function(noteId) {
                trackNote(noteId);
                var result = originalOpen.apply(this, arguments);
                setTimeout(injectSidebarItems, 10);
                return result;
            };
        }
    }

    var plugin = {
        name: 'Recent Notes',
        description: 'Show your last 5 opened notes in the sidebar.',
        version: '1.0',
        init: function(app) {
            wrapFunctions();
            setTimeout(injectSidebarItems, 100);
            app.on('app:ready', function() {
                setTimeout(injectSidebarItems, 200);
            });
            app.on('note:save', function() {
                setTimeout(injectSidebarItems, 50);
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
