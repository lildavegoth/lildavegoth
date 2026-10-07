(function() {
    var SIDEBAR_ID = 'linkedNotesSidebar';
    var BACKDROP_ID = 'linkedNotesBackdrop';
    var STYLE_ID = 'linkedNotesStyles';
    var pluginActive = false;
    var sidebarEl = null;
    var expandedFolders = new Set();

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '.reading-folder.linked-notes-btn{background:var(--accent-color);color:#000000;padding:6px 14px;border-radius:20px;cursor:pointer;font-weight:600;max-width:60%;transition:opacity 0.2s ease;}' +
            '.reading-folder.linked-notes-btn:hover{opacity:0.85;}' +
            '.linked-notes-backdrop{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:1000002;display:none;}' +
            '.linked-notes-backdrop.active{display:block;}' +
            '.linked-notes-sidebar{position:fixed;top:0;right:0;width:min(340px,90vw);height:100vh;background:var(--bg-dark);border-left:1px solid rgba(255,255,255,0.08);z-index:1000003;display:flex;flex-direction:column;transform:translateX(105%);transition:transform 0.28s ease;}' +
            '.linked-notes-sidebar.open{transform:translateX(0);}' +
            '.linked-notes-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;gap:10px;}' +
            '.linked-notes-title{font-size:1rem;font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.linked-notes-close{width:34px;height:34px;border-radius:50%;background:transparent;border:none;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;flex-shrink:0;}' +
            '.linked-notes-close:hover{background:rgba(255,255,255,0.08);color:var(--text-primary);}' +
            '.linked-notes-body{flex:1;overflow-y:auto;padding:10px 8px 40px;scrollbar-width:none;-ms-overflow-style:none;}' +
            '.linked-notes-body::-webkit-scrollbar{display:none;}' +
            '.linked-notes-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;margin:2px 0;background:transparent;border:none;color:var(--text-primary);border-radius:10px;cursor:pointer;text-align:left;font-size:14px;box-sizing:border-box;}' +
            '.linked-notes-item:hover{background:rgba(255,255,255,0.06);}' +
            '.linked-notes-item.active{background:rgba(193,252,50,0.15);color:var(--accent-color);}' +
            '.linked-notes-item .ln-icon{width:18px;text-align:center;font-size:13px;color:var(--accent-color);flex-shrink:0;}' +
            '.linked-notes-item.note-item .ln-icon{color:var(--text-secondary);font-size:12px;}' +
            '.linked-notes-item .ln-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.linked-notes-item .ln-chevron{background:transparent;border:none;color:var(--text-secondary);cursor:pointer;padding:0;font-size:13px;flex-shrink:0;}' +
            '.linked-notes-empty{padding:30px 20px;text-align:center;color:var(--text-secondary);font-size:13px;}';
        document.head.appendChild(style);
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getCurrentNote() {
        var id = window.NotesApp.getCurrentNoteId();
        var notes = window.NotesApp.getNotes() || [];
        for (var i = 0; i < notes.length; i++) {
            if (notes[i].id === id) return notes[i];
        }
        return null;
    }

    function getRootAncestor(folderId) {
        var folders = window.NotesApp.getFolders() || [];
        var current = folders.find(function(f) { return f.id === folderId; });
        if (!current) return null;
        var safety = 0;
        while (current.parentId !== null && current.parentId !== undefined && safety < 100) {
            var parent = folders.find(function(f) { return f.id === current.parentId; });
            if (!parent) break;
            current = parent;
            safety++;
        }
        return current;
    }

    function getChildFolders(parentId) {
        return (window.NotesApp.getFolders() || []).filter(function(f) {
            return f.parentId === parentId;
        }).sort(function(a, b) {
            return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        });
    }

    function getNotesInFolder(folderId) {
        return (window.NotesApp.getNotes() || []).filter(function(n) {
            return n.folderId === folderId;
        }).sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });
    }

    function expandPathToNote(note, root) {
        var folders = window.NotesApp.getFolders() || [];
        var current = folders.find(function(f) { return f.id === note.folderId; });
        var safety = 0;
        while (current && current.id !== root.id && safety < 100) {
            expandedFolders.add(current.id);
            current = folders.find(function(f) { return f.id === current.parentId; });
            safety++;
        }
    }

    function renderFolderTree(folder, container, depth, currentNoteId) {
        var folders = getChildFolders(folder.id);
        var notes = getNotesInFolder(folder.id);
        var hasContent = folders.length > 0 || notes.length > 0;
        var isExpanded = expandedFolders.has(folder.id);

        var item = document.createElement('button');
        item.className = 'linked-notes-item';
        item.style.paddingLeft = (10 + depth * 14) + 'px';
        item.innerHTML =
            '<span class="ln-icon"><i class="fas fa-folder"></i></span>' +
            '<span class="ln-name">' + escapeHtml(folder.name) + '</span>' +
            (hasContent ? '<button class="ln-chevron" type="button" aria-label="Toggle"><i class="fas ' + (isExpanded ? 'fa-chevron-down' : 'fa-chevron-right') + '"></i></button>' : '');
        item.addEventListener('click', function(e) {
            if (e.target.closest('.ln-chevron')) return;
            if (!hasContent) return;
            if (expandedFolders.has(folder.id)) expandedFolders.delete(folder.id);
            else expandedFolders.add(folder.id);
            rebuildTree();
        });
        var chev = item.querySelector('.ln-chevron');
        if (chev) {
            chev.addEventListener('click', function(e) {
                e.stopPropagation();
                if (expandedFolders.has(folder.id)) expandedFolders.delete(folder.id);
                else expandedFolders.add(folder.id);
                rebuildTree();
            });
        }
        container.appendChild(item);

        if (isExpanded) {
            folders.forEach(function(child) {
                renderFolderTree(child, container, depth + 1, currentNoteId);
            });
            notes.forEach(function(note) {
                var noteItem = document.createElement('button');
                noteItem.className = 'linked-notes-item note-item' + (note.id === currentNoteId ? ' active' : '');
                noteItem.style.paddingLeft = (10 + (depth + 1) * 14) + 'px';
                noteItem.innerHTML =
                    '<span class="ln-icon"><i class="fas fa-sticky-note"></i></span>' +
                    '<span class="ln-name">' + escapeHtml(note.title || 'Untitled') + '</span>';
                noteItem.addEventListener('click', function() {
                    closeSidebar();
                    window.NotesApp.openNoteReadingMode(note.id);
                });
                container.appendChild(noteItem);
            });
        }
    }

    function rebuildTree() {
        var body = document.getElementById('linkedNotesBody');
        var title = document.getElementById('linkedNotesTitle');
        if (!body) return;
        body.innerHTML = '';

        var note = getCurrentNote();
        if (!note) {
            body.innerHTML = '<div class="linked-notes-empty">No note is currently open.</div>';
            if (title) title.textContent = 'Linked Notes';
            return;
        }
        if (!note.folderId) {
            body.innerHTML = '<div class="linked-notes-empty">This note is not inside a folder.</div>';
            if (title) title.textContent = 'Linked Notes';
            return;
        }

        var root = getRootAncestor(note.folderId);
        if (!root) {
            body.innerHTML = '<div class="linked-notes-empty">Folder not found.</div>';
            if (title) title.textContent = 'Linked Notes';
            return;
        }

        if (title) title.textContent = root.name;
        expandedFolders.add(root.id);
        expandPathToNote(note, root);
        renderFolderTree(root, body, 0, note.id);
    }

    function buildSidebar() {
        injectStyles();

        if (!document.getElementById(BACKDROP_ID)) {
            var backdrop = document.createElement('div');
            backdrop.className = 'linked-notes-backdrop';
            backdrop.id = BACKDROP_ID;
            backdrop.addEventListener('click', closeSidebar);
            document.body.appendChild(backdrop);
        }

        if (document.getElementById(SIDEBAR_ID)) {
            sidebarEl = document.getElementById(SIDEBAR_ID);
            return;
        }

        sidebarEl = document.createElement('aside');
        sidebarEl.className = 'linked-notes-sidebar';
        sidebarEl.id = SIDEBAR_ID;
        sidebarEl.innerHTML =
            '<div class="linked-notes-header">' +
            '<span class="linked-notes-title" id="linkedNotesTitle">Linked Notes</span>' +
            '<button class="linked-notes-close" id="linkedNotesClose" aria-label="Close"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="linked-notes-body" id="linkedNotesBody"></div>';
        document.body.appendChild(sidebarEl);

        sidebarEl.querySelector('#linkedNotesClose').addEventListener('click', closeSidebar);
    }

    function openSidebar() {
        if (!pluginActive) return;
        buildSidebar();
        rebuildTree();
        sidebarEl.classList.add('open');
        var backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) backdrop.classList.add('active');
    }

    function closeSidebar() {
        if (sidebarEl) sidebarEl.classList.remove('open');
        var backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) backdrop.classList.remove('active');
    }

    function updateFolderIndicator() {
        var el = document.getElementById('readingFolder');
        if (!el) return;
        if (!pluginActive) return;
        if (!el.textContent || el.textContent === 'No Folder') {
            el.classList.remove('linked-notes-btn');
            return;
        }
        el.classList.add('linked-notes-btn');
    }

    function attachFolderClick() {
        var el = document.getElementById('readingFolder');
        if (!el) return;
        if (el.dataset.lnBound === '1') return;
        el.dataset.lnBound = '1';
        el.addEventListener('click', function() {
            if (!pluginActive) return;
            if (!el.textContent || el.textContent === 'No Folder') return;
            openSidebar();
        });
    }

    function hookReadingMode() {
        var readingModeEl = document.getElementById('readingMode');
        if (!readingModeEl) return;
        attachFolderClick();
        var observer = new MutationObserver(function() {
            if (readingModeEl.classList.contains('active')) {
                setTimeout(updateFolderIndicator, 0);
            } else {
                closeSidebar();
            }
        });
        observer.observe(readingModeEl, { attributes: true, attributeFilter: ['class'] });
    }

    function deactivate() {
        pluginActive = false;
        closeSidebar();
        var el = document.getElementById('readingFolder');
        if (el) el.classList.remove('linked-notes-btn');
        var sidebar = document.getElementById(SIDEBAR_ID);
        if (sidebar) sidebar.remove();
        var backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) backdrop.remove();
        sidebarEl = null;
    }

    function wrapTogglePlugin() {
        if (window.__linkedNotesToggleWrapped) return;
        window.__linkedNotesToggleWrapped = true;

        var originalToggle = window.togglePlugin;
        if (typeof originalToggle !== 'function') return;

        window.togglePlugin = function(name, checked) {
            if (name === 'Linked Notes' && !checked) {
                deactivate();
            }
            return originalToggle.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Linked Notes',
        description: 'See all notes inside the same folder as the currently opened note.',
        version: '1.0',
        init: function(app) {
            pluginActive = true;
            injectStyles();
            buildSidebar();
            hookReadingMode();
            wrapTogglePlugin();
            app.on('app:ready', function() {
                hookReadingMode();
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
