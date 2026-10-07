(function() {
    var STYLE_ID = 'attachmentsManagerStyles';
    var BTN_ID = 'homeAttachmentsBtn';
    var OVERLAY_ID = 'attachmentsManagerOverlay';
    var MAIN_DB_NAME = 'NotesAppDB';
    var MAIN_DB_VERSION = 3;
    var TRASH_DB_NAME = 'AttachmentsManagerDB';
    var TRASH_DB_VERSION = 1;
    var TRASH_STORE = 'trash';
    var NAME_MAP_KEY = 'attachmentNames';
    var pluginActive = false;
    var mainDb = null;
    var trashDb = null;
    var currentTab = 'active';
    var overlayEl = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '.home-attachments-btn{width:40px;height:40px;border-radius:var(--radius-small);background:#202020;color:#ffffff;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;}' +
            '.home-attachments-btn:hover{background:#2a2a2a;}' +
            '.att-mgr-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-black);z-index:1000002;display:none;flex-direction:column;overflow:hidden;}' +
            '.att-mgr-overlay.active{display:flex;}' +
            '.att-mgr-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;flex-shrink:0;background:var(--bg-black);}' +
            '.att-mgr-title{color:var(--text-primary);font-weight:600;font-size:1.1rem;}' +
            '.att-mgr-close{width:36px;height:36px;border-radius:50%;background:transparent;border:none;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;}' +
            '.att-mgr-close:hover{background:rgba(255,255,255,0.08);color:var(--text-primary);}' +
            '.att-mgr-tabs{display:flex;gap:8px;padding:0 20px 12px;max-width:800px;width:100%;margin:0 auto;box-sizing:border-box;flex-shrink:0;}' +
            '.att-mgr-tab{flex:1;padding:10px 16px;background:var(--bg-card);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-small);color:var(--text-secondary);font-weight:600;font-size:0.9rem;cursor:pointer;}' +
            '.att-mgr-tab.active{background:var(--accent-color);color:#000;border-color:var(--accent-color);}' +
            '.att-mgr-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 20px 60px;max-width:800px;width:100%;margin:0 auto;box-sizing:border-box;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}' +
            '.att-mgr-body::-webkit-scrollbar{display:none;}' +
            '.att-mgr-toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}' +
            '.att-mgr-toolbar button{padding:8px 14px;border-radius:var(--radius-small);font-weight:600;font-size:0.85rem;cursor:pointer;border:none;display:flex;align-items:center;gap:6px;}' +
            '.att-mgr-toolbar .clear-all{background:rgba(255,59,48,0.2);color:#ff3b30;border:1px solid rgba(255,59,48,0.3);}' +
            '.att-mgr-toolbar .clear-all:hover{background:rgba(255,59,48,0.3);}' +
            '.att-mgr-toolbar .restore-all{background:var(--accent-color);color:#000;}' +
            '.att-mgr-toolbar .restore-all:hover{opacity:0.9;}' +
            '.att-mgr-item{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-medium);padding:14px 16px;margin-bottom:10px;}' +
            '.att-mgr-icon{width:40px;height:40px;flex-shrink:0;border-radius:var(--radius-small);background:rgba(193,252,50,0.1);color:var(--accent-color);display:flex;align-items:center;justify-content:center;font-size:1.1rem;}' +
            '.att-mgr-info{flex:1;min-width:0;}' +
            '.att-mgr-name{color:var(--text-primary);font-weight:600;font-size:0.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.att-mgr-meta{color:var(--text-secondary);font-size:0.8rem;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}' +
            '.att-mgr-badge{background:rgba(255,184,108,0.15);color:#ffb86c;padding:1px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;}' +
            '.att-mgr-actions{display:flex;gap:6px;flex-shrink:0;}' +
            '.att-mgr-btn{width:36px;height:36px;border-radius:var(--radius-small);border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.9rem;}' +
            '.att-mgr-btn:hover{background:rgba(255,255,255,0.06);color:var(--text-primary);}' +
            '.att-mgr-btn.delete:hover{background:rgba(255,59,48,0.15);color:#ff3b30;border-color:rgba(255,59,48,0.3);}' +
            '.att-mgr-btn.restore{color:var(--accent-color);}' +
            '.att-mgr-btn.restore:hover{background:rgba(193,252,50,0.1);}' +
            '.att-mgr-empty{text-align:center;padding:60px 20px;color:var(--text-secondary);font-size:0.9rem;}';
        document.head.appendChild(style);
    }

    function openMainDb() {
        return new Promise(function(resolve, reject) {
            if (mainDb) { resolve(mainDb); return; }
            var req = indexedDB.open(MAIN_DB_NAME, MAIN_DB_VERSION);
            req.onsuccess = function() { mainDb = req.result; resolve(mainDb); };
            req.onerror = function() { reject(req.error); };
        });
    }

    function openTrashDb() {
        return new Promise(function(resolve, reject) {
            if (trashDb) { resolve(trashDb); return; }
            var req = indexedDB.open(TRASH_DB_NAME, TRASH_DB_VERSION);
            req.onupgradeneeded = function(e) {
                var d = e.target.result;
                if (!d.objectStoreNames.contains(TRASH_STORE)) {
                    d.createObjectStore(TRASH_STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = function() { trashDb = req.result; resolve(trashDb); };
            req.onerror = function() { reject(req.error); };
        });
    }

    function getAllAttachmentKeys() {
        return openMainDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction('attachments', 'readonly');
                var store = tx.objectStore('attachments');
                var req = store.getAllKeys();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function getAttachmentBlob(key) {
        return openMainDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction('attachments', 'readonly');
                var store = tx.objectStore('attachments');
                var req = store.get(key);
                req.onsuccess = function() { resolve(req.result || null); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function putAttachmentBlob(key, blob) {
        return openMainDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction('attachments', 'readwrite');
                var store = tx.objectStore('attachments');
                var req = store.put(blob, key);
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function deleteAttachmentBlob(key) {
        return openMainDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction('attachments', 'readwrite');
                var store = tx.objectStore('attachments');
                var req = store.delete(key);
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function getTrashItems() {
        return openTrashDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction(TRASH_STORE, 'readonly');
                var store = tx.objectStore(TRASH_STORE);
                var req = store.getAll();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function putTrashItem(item) {
        return openTrashDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction(TRASH_STORE, 'readwrite');
                var store = tx.objectStore(TRASH_STORE);
                var req = store.put(item);
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function deleteTrashItem(id) {
        return openTrashDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction(TRASH_STORE, 'readwrite');
                var store = tx.objectStore(TRASH_STORE);
                var req = store.delete(id);
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function clearTrashStore() {
        return openTrashDb().then(function(d) {
            return new Promise(function(resolve, reject) {
                var tx = d.transaction(TRASH_STORE, 'readwrite');
                var store = tx.objectStore(TRASH_STORE);
                var req = store.clear();
                req.onsuccess = function() { resolve(); };
                req.onerror = function() { reject(req.error); };
            });
        });
    }

    function getAttachmentNames() {
        try {
            return JSON.parse(localStorage.getItem(NAME_MAP_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function saveAttachmentNames(map) {
        localStorage.setItem(NAME_MAP_KEY, JSON.stringify(map));
    }

    function removeAttachmentNameFromMap(key) {
        var map = getAttachmentNames();
        delete map[key];
        saveAttachmentNames(map);
    }

    function setAttachmentNameInMap(key, name) {
        var map = getAttachmentNames();
        map[key] = name;
        saveAttachmentNames(map);
    }

    function formatBytes(bytes) {
        if (!bytes || bytes < 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function formatDateTime(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getFileIconFromName(name) {
        var ext = (String(name || '').split('.').pop() || '').toLowerCase();
        var map = {
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel',
            'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint',
            'txt': 'fa-file-alt',
            'md': 'fa-file-alt',
            'csv': 'fa-file-csv',
            'zip': 'fa-file-archive',
            'rar': 'fa-file-archive',
            '7z': 'fa-file-archive',
            'tar': 'fa-file-archive',
            'gz': 'fa-file-archive',
            'json': 'fa-file-code',
            'js': 'fa-file-code',
            'css': 'fa-file-code',
            'html': 'fa-file-code',
            'xml': 'fa-file-code',
            'mp3': 'fa-file-audio',
            'wav': 'fa-file-audio',
            'm4a': 'fa-file-audio',
            'aac': 'fa-file-audio',
            'flac': 'fa-file-audio',
            'ogg': 'fa-file-audio',
            'mp4': 'fa-file-video',
            'mov': 'fa-file-video',
            'webm': 'fa-file-video',
            'png': 'fa-file-image',
            'jpg': 'fa-file-image',
            'jpeg': 'fa-file-image',
            'gif': 'fa-file-image',
            'webp': 'fa-file-image',
            'svg': 'fa-file-image'
        };
        return map[ext] || 'fa-file';
    }

    function collectReferencedKeys() {
        var notes = window.NotesApp.getNotes() || [];
        var names = getAttachmentNames();
        var byName = {};
        for (var k in names) {
            if (Object.prototype.hasOwnProperty.call(names, k)) {
                byName[String(names[k]).toLowerCase()] = k;
            }
        }
        var referenced = {};
        notes.forEach(function(note) {
            var content = note.content || '';
            var m;
            var re1 = /attachment:([a-zA-Z0-9]+)/g;
            while ((m = re1.exec(content)) !== null) {
                referenced[m[1]] = true;
            }
            var re2 = /attachment-by-name:([^)]+)/g;
            while ((m = re2.exec(content)) !== null) {
                var decoded = decodeURIComponent(m[1]).toLowerCase();
                if (byName[decoded]) referenced[byName[decoded]] = true;
            }
        });
        return referenced;
    }

    function buildOverlay() {
        if (overlayEl) return;
        injectStyles();
        overlayEl = document.createElement('div');
        overlayEl.className = 'att-mgr-overlay';
        overlayEl.id = OVERLAY_ID;
        overlayEl.innerHTML =
            '<div class="att-mgr-header">' +
            '<span class="att-mgr-title">Attachments Manager</span>' +
            '<button class="att-mgr-close" id="attMgrClose" aria-label="Close"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="att-mgr-tabs">' +
            '<button class="att-mgr-tab active" id="attMgrTabActive" data-tab="active">Active</button>' +
            '<button class="att-mgr-tab" id="attMgrTabTrash" data-tab="trash">Trash</button>' +
            '</div>' +
            '<div class="att-mgr-body" id="attMgrBody"></div>';
        document.body.appendChild(overlayEl);
        overlayEl.querySelector('#attMgrClose').addEventListener('click', closeOverlay);
        overlayEl.querySelectorAll('.att-mgr-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                currentTab = tab.dataset.tab;
                overlayEl.querySelectorAll('.att-mgr-tab').forEach(function(t) {
                    t.classList.toggle('active', t.dataset.tab === currentTab);
                });
                renderTab();
            });
        });
    }

    function openOverlay() {
        if (!pluginActive) return;
        buildOverlay();
        overlayEl.classList.add('active');
        renderTab();
    }

    function closeOverlay() {
        if (overlayEl) overlayEl.classList.remove('active');
    }

    function renderTab() {
        if (currentTab === 'active') renderActive();
        else renderTrash();
    }

    function renderActive() {
        var body = document.getElementById('attMgrBody');
        if (!body) return;
        body.innerHTML = '<div class="att-mgr-empty">Loading...</div>';

        getAllAttachmentKeys().then(function(keys) {
            var names = getAttachmentNames();
            var referenced = collectReferencedKeys();

            if (keys.length === 0) {
                body.innerHTML = '<div class="att-mgr-empty">No active attachments.</div>';
                return;
            }

            var tasks = keys.map(function(key) {
                return getAttachmentBlob(key).then(function(blob) {
                    return { key: key, blob: blob, name: names[key] || key };
                });
            });

            Promise.all(tasks).then(function(items) {
                items = items.filter(function(x) { return x.blob; });
                items.sort(function(a, b) {
                    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
                });

                var orphanCount = 0;
                items.forEach(function(item) {
                    if (!referenced[item.key]) orphanCount++;
                });

                var html = '';
                if (orphanCount > 0) {
                    html += '<div class="att-mgr-toolbar">';
                    html += '<button class="clear-all" id="attMgrDeleteOrphans"><i class="fas fa-broom"></i> Delete ' + orphanCount + ' Orphan' + (orphanCount !== 1 ? 's' : '') + '</button>';
                    html += '</div>';
                }

                items.forEach(function(item) {
                    var isOrphan = !referenced[item.key];
                    var icon = getFileIconFromName(item.name);
                    html += '<div class="att-mgr-item">';
                    html += '<div class="att-mgr-icon"><i class="fas ' + icon + '"></i></div>';
                    html += '<div class="att-mgr-info">';
                    html += '<div class="att-mgr-name">' + escapeHtml(item.name) + '</div>';
                    html += '<div class="att-mgr-meta">';
                    html += '<span>' + formatBytes(item.blob.size || 0) + '</span>';
                    if (isOrphan) html += '<span class="att-mgr-badge">Orphaned</span>';
                    html += '</div>';
                    html += '</div>';
                    html += '<div class="att-mgr-actions">';
                    html += '<button class="att-mgr-btn delete" data-action="delete" data-key="' + item.key + '" title="Move to Trash"><i class="fas fa-trash"></i></button>';
                    html += '</div>';
                    html += '</div>';
                });

                body.innerHTML = html;
                bindActiveActions();
            });
        });
    }

    function bindActiveActions() {
        var body = document.getElementById('attMgrBody');
        if (!body) return;
        body.querySelectorAll('[data-action="delete"]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                moveToTrash(btn.dataset.key);
            });
        });
        var orphanBtn = body.querySelector('#attMgrDeleteOrphans');
        if (orphanBtn) {
            orphanBtn.addEventListener('click', moveAllOrphansToTrash);
        }
    }

    function moveToTrash(key) {
        moveToTrashSilent(key).then(function() {
            window.showMessage('Attachment moved to Trash');
            renderActive();
        });
    }

    function moveToTrashSilent(key) {
        return getAttachmentBlob(key).then(function(blob) {
            if (!blob) {
                return deleteAttachmentBlob(key);
            }
            var names = getAttachmentNames();
            var item = {
                id: 'trash_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                originalKey: key,
                name: names[key] || key,
                size: blob.size || 0,
                type: blob.type || '',
                deletedAt: new Date().toISOString(),
                blob: blob
            };
            return putTrashItem(item).then(function() {
                return deleteAttachmentBlob(key);
            }).then(function() {
                removeAttachmentNameFromMap(key);
            });
        });
    }

    function moveAllOrphansToTrash() {
        getAllAttachmentKeys().then(function(keys) {
            var referenced = collectReferencedKeys();
            var orphans = keys.filter(function(k) { return !referenced[k]; });
            if (orphans.length === 0) {
                window.showMessage('No orphans to delete');
                return;
            }
            var chain = Promise.resolve();
            orphans.forEach(function(key) {
                chain = chain.then(function() {
                    return moveToTrashSilent(key);
                });
            });
            chain.then(function() {
                window.showMessage('Moved ' + orphans.length + ' orphan' + (orphans.length !== 1 ? 's' : '') + ' to Trash');
                renderActive();
            });
        });
    }

    function renderTrash() {
        var body = document.getElementById('attMgrBody');
        if (!body) return;
        body.innerHTML = '<div class="att-mgr-empty">Loading...</div>';

        getTrashItems().then(function(items) {
            if (items.length === 0) {
                body.innerHTML = '<div class="att-mgr-empty">Trash is empty.</div>';
                return;
            }

            items.sort(function(a, b) {
                return new Date(b.deletedAt) - new Date(a.deletedAt);
            });

            var html = '';
            html += '<div class="att-mgr-toolbar">';
            html += '<button class="clear-all" id="attMgrClearAll"><i class="fas fa-trash"></i> Clear All</button>';
            html += '<button class="restore-all" id="attMgrRestoreAll"><i class="fas fa-undo"></i> Restore All</button>';
            html += '</div>';

            items.forEach(function(item) {
                var icon = getFileIconFromName(item.name);
                html += '<div class="att-mgr-item">';
                html += '<div class="att-mgr-icon"><i class="fas ' + icon + '"></i></div>';
                html += '<div class="att-mgr-info">';
                html += '<div class="att-mgr-name">' + escapeHtml(item.name) + '</div>';
                html += '<div class="att-mgr-meta">';
                html += '<span>' + formatBytes(item.size || 0) + '</span>';
                html += '<span>' + formatDateTime(item.deletedAt) + '</span>';
                html += '</div>';
                html += '</div>';
                html += '<div class="att-mgr-actions">';
                html += '<button class="att-mgr-btn restore" data-action="restore" data-id="' + item.id + '" title="Restore"><i class="fas fa-undo"></i></button>';
                html += '<button class="att-mgr-btn delete" data-action="permdelete" data-id="' + item.id + '" title="Delete Forever"><i class="fas fa-times"></i></button>';
                html += '</div>';
                html += '</div>';
            });

            body.innerHTML = html;
            bindTrashActions();
        });
    }

    function bindTrashActions() {
        var body = document.getElementById('attMgrBody');
        if (!body) return;
        body.querySelectorAll('[data-action="restore"]').forEach(function(btn) {
            btn.addEventListener('click', function() { restoreItem(btn.dataset.id); });
        });
        body.querySelectorAll('[data-action="permdelete"]').forEach(function(btn) {
            btn.addEventListener('click', function() { permanentDelete(btn.dataset.id); });
        });
        var clearBtn = body.querySelector('#attMgrClearAll');
        if (clearBtn) clearBtn.addEventListener('click', clearAllTrash);
        var restoreAllBtn = body.querySelector('#attMgrRestoreAll');
        if (restoreAllBtn) restoreAllBtn.addEventListener('click', restoreAllTrash);
    }

    function restoreItem(id) {
        getTrashItems().then(function(items) {
            var item = items.find(function(x) { return x.id === id; });
            if (!item) return;
            putAttachmentBlob(item.originalKey, item.blob).then(function() {
                setAttachmentNameInMap(item.originalKey, item.name);
                return deleteTrashItem(item.id);
            }).then(function() {
                window.showMessage('Attachment restored');
                renderTrash();
            });
        });
    }

    function restoreAllTrash() {
        getTrashItems().then(function(items) {
            if (items.length === 0) return;
            var chain = Promise.resolve();
            items.forEach(function(item) {
                chain = chain.then(function() {
                    return putAttachmentBlob(item.originalKey, item.blob).then(function() {
                        setAttachmentNameInMap(item.originalKey, item.name);
                        return deleteTrashItem(item.id);
                    });
                });
            });
            chain.then(function() {
                window.showMessage('Restored ' + items.length + ' file' + (items.length !== 1 ? 's' : ''));
                renderTrash();
            });
        });
    }

    function permanentDelete(id) {
        deleteTrashItem(id).then(function() {
            window.showMessage('Attachment deleted forever');
            renderTrash();
        });
    }

    function clearAllTrash() {
        clearTrashStore().then(function() {
            window.showMessage('Trash cleared');
            renderTrash();
        });
    }

    function injectSidebarButton() {
        var actions = document.querySelector('.home-sidebar-actions');
        if (!actions) return;
        if (document.getElementById(BTN_ID)) return;
        injectStyles();

        var btn = document.createElement('button');
        btn.className = 'home-attachments-btn';
        btn.id = BTN_ID;
        btn.setAttribute('aria-label', 'Attachments Manager');
        btn.title = 'Attachments Manager';
        btn.innerHTML = '<i class="fas fa-paperclip"></i>';
        btn.addEventListener('click', openOverlay);

        var trashBtn = actions.querySelector('.home-trash-btn');
        if (trashBtn) {
            actions.insertBefore(btn, trashBtn);
        } else {
            actions.insertBefore(btn, actions.firstChild);
        }
    }

    function deactivate() {
        pluginActive = false;
        closeOverlay();
        var btn = document.getElementById(BTN_ID);
        if (btn) btn.remove();
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.remove();
        var styleEl = document.getElementById(STYLE_ID);
        if (styleEl) styleEl.remove();
        overlayEl = null;
    }

    function wrapTogglePlugin() {
        if (window.__attachmentsManagerToggleWrapped) return;
        window.__attachmentsManagerToggleWrapped = true;
        var orig = window.togglePlugin;
        if (typeof orig !== 'function') return;
        window.togglePlugin = function(name, checked) {
            if (name === 'Attachments Manager' && !checked) deactivate();
            return orig.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Attachments Manager',
        description: 'Manage all note attachments, detect orphans, and restore deleted files.',
        version: '1.0',
        init: function(app) {
            pluginActive = true;
            injectStyles();
            buildOverlay();
            injectSidebarButton();
            wrapTogglePlugin();
            app.on('app:ready', function() {
                setTimeout(injectSidebarButton, 200);
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
