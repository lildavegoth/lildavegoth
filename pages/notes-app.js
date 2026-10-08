if (typeof window.showMessage !== 'function') {
    window.showMessage = function(msg) {
        var el = document.createElement('div');
        el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#C1FC32;color:#000000;padding:12px 20px;border-radius:12px;font-weight:600;font-size:0.9rem;z-index:999999999;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,0.5);';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(function() {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 2500);
    };
}

window.NotesApp = {
    plugins: {
        list: [],
        _appReady: false,
        _enabledStates: JSON.parse(localStorage.getItem('pluginStates') || '{}'),
        register(plugin) {
            if (!plugin.name || !plugin.init) return;
            var enabled = this._enabledStates[plugin.name] !== undefined ? this._enabledStates[plugin.name] : false;
            this.list.push({
                name: plugin.name,
                description: plugin.description || '',
                init: plugin.init,
                enabled: enabled
            });
        },
        saveStates() {
            var states = {};
            this.list.forEach(function(p) {
                states[p.name] = p.enabled;
            });
            localStorage.setItem('pluginStates', JSON.stringify(states));
        },
        initEnabled() {
            this.list.forEach(function(plugin) {
                if (plugin.enabled) {
                    plugin.init(window.NotesApp);
                }
            });
        }
    },
    homeView: {
        provider: null,
        active: false,
        set(fn) {
            this.provider = fn;
            this.active = true;
        },
        clear() {
            this.provider = null;
            this.active = false;
        }
    },
    on(event, callback) {
        (this._listeners = this._listeners || {})[event] = (this._listeners[event] || []).concat(callback);
    },
    emit(event, ...args) {
        (this._listeners?.[event] || []).forEach(fn => fn(...args));
    },
    getNotes() {
        return notesData;
    },
    getFolders() {
        return foldersData;
    },
    getTrashNotes() {
        return trashNotes;
    },
    getTrashFolders() {
        return trashFolders;
    },
    setTrash(notes, folders) {
        trashNotes = notes;
        trashFolders = folders;
        saveTrash();
    },
    saveNotes() {
        return saveNotesToStorage();
    },
    saveFolders() {
        return saveFoldersToStorage();
    },
    renderHome() {
        renderHomeFolders();
        renderHomeNotes();
    },
    renderHomeNotes() {
        renderHomeNotes();
    },
    renderHomeFolders() {
        renderHomeFolders();
    },
    fadeElement(el) {
        fadeHomeView(el);
    },
    showMessage(msg) {
        window.showMessage(msg);
    },
    clearSearch() {
        currentSearchTerm = '';
        homePage = 0;
        var input = document.getElementById('homeSearchInput');
        if (input) input.value = '';
    },
    getCurrentNoteId() {
        return currentNoteId;
    },
    openNoteReadingMode(id) {
        openNoteReadingMode(id);
    },
    registerToolbarButton(btn) {
        const toolbar = document.getElementById('richToolbar');
        if (!toolbar) return;
        const el = document.createElement('button');
        el.className = 'toolbar-btn';
        el.innerHTML = btn.icon;
        el.title = btn.tooltip || '';
        el.addEventListener('click', btn.action);
        toolbar.appendChild(el);
    }
};

const DB_NAME = 'NotesAppDB';
const DB_VERSION = 3;
const HOME_PAGE_SIZE = 10;
const UNFOLDERED = '__unfoldered__';
const MEDIA_EXT_REGEX = /\.(png|jpe?g|gif|webp|svg|bmp|mp4|webm|ogg|mov|m4v|mp3|wav|m4a|aac|flac|avif|tiff?|ico)$/i;
let db = null;
let notesData = [];
let foldersData = [];
let trashNotes = JSON.parse(localStorage.getItem('trashNotes') || '[]');
let trashFolders = JSON.parse(localStorage.getItem('trashFolders') || '[]');
let currentNoteId = null;
let undoStack = [];
let redoStack = [];
let currentFolderId = null;
let selectedFolderId = null;
let autoSaveTimer = null;
let currentHomeFolderId = null;
let expandedFolders = new Set();
let importTargetFolderId = null;
let pendingImportFiles = null;
let folderMoveTargetId = null;
let folderMoveId = null;
let currentSearchTerm = '';
let homePage = 0;
let readingHistory = [];
let suppressBackLinkUntil = 0;
const attachmentUrlCache = new Map();

const turndownService = new TurndownService();

function getAttachmentNameMap() {
    try {
        return JSON.parse(localStorage.getItem('attachmentNames') || '{}');
    } catch (e) {
        return {};
    }
}

function saveAttachmentName(key, filename) {
    var map = getAttachmentNameMap();
    map[key] = filename;
    localStorage.setItem('attachmentNames', JSON.stringify(map));
}

function removeAttachmentName(key) {
    var map = getAttachmentNameMap();
    delete map[key];
    localStorage.setItem('attachmentNames', JSON.stringify(map));
}

function escapeHtmlText(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function preprocessProperties(markdown) {
    return markdown.replace(/^---\s*$[\r\n]+([\s\S]*?)[\r\n]+^---\s*$/gm, function(match, content) {
        var lines = content.split('\n').map(function(l) {
            return l.trim();
        }).filter(function(l) {
            return l !== '';
        });
        if (lines.length === 0) return match;
        var allHaveColons = lines.every(function(l) {
            return l.indexOf(':') !== -1;
        });
        if (!allHaveColons) return match;
        var rows = lines.map(function(line) {
            var idx = line.indexOf(':');
            var key = escapeHtmlText(line.substring(0, idx).trim());
            var val = escapeHtmlText(line.substring(idx + 1).trim());
            return '<tr><td>' + key + '</td><td>' + val + '</td></tr>';
        }).join('');
        return '\n\n<table class="property-table"><tbody>' + rows + '</tbody></table>\n\n';
    });
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('notes')) {
                const notesStore = db.createObjectStore('notes', {
                    keyPath: 'id'
                });
                notesStore.createIndex('folderId', 'folderId', {
                    unique: false
                });
            }
            if (!db.objectStoreNames.contains('folders')) {
                db.createObjectStore('folders', {
                    keyPath: 'id'
                });
            }
            if (!db.objectStoreNames.contains('attachments')) {
                db.createObjectStore('attachments');
            }
        };
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            resolve([]);
            return;
        }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            resolve(null);
            return;
        }
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbPut(storeName, key, value) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            reject(new Error('Store not found: ' + storeName));
            return;
        }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            resolve();
            return;
        }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            resolve();
            return;
        }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbPutAll(storeName, items) {
    return new Promise((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
            resolve();
            return;
        }
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function saveTrash() {
    localStorage.setItem('trashNotes', JSON.stringify(trashNotes));
    localStorage.setItem('trashFolders', JSON.stringify(trashFolders));
}

async function init() {
    await openDB();
    await migrateFromLocalStorage();
    await loadNotesFromStorage();
    await loadFoldersFromStorage();
    sortNotesNewestFirst();
    renderNotes();
    renderFolders();
    initHomeUI();
    setupEventListeners();
    setupHomeSearch();
    try {
        await loadPluginsIfEnabled();
    } catch (e) {}
}

async function migrateFromLocalStorage() {
    const notesJson = localStorage.getItem('notesApp');
    const foldersJson = localStorage.getItem('notesAppFolders');
    if (notesJson || foldersJson) {
        try {
            if (notesJson) {
                const oldNotes = JSON.parse(notesJson);
                await dbClear('notes');
                await dbPutAll('notes', oldNotes);
                localStorage.removeItem('notesApp');
            }
            if (foldersJson) {
                const oldFolders = JSON.parse(foldersJson);
                await dbClear('folders');
                await dbPutAll('folders', oldFolders);
                localStorage.removeItem('notesAppFolders');
            }
        } catch (e) {}
    }
}

async function loadNotesFromStorage() {
    notesData = await dbGetAll('notes');
    sortNotesNewestFirst();
}

async function loadFoldersFromStorage() {
    foldersData = await dbGetAll('folders');
    sortFoldersAZ();
    updateFolderCounts();
}

function sortNotesNewestFirst() {
    notesData.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function sortFoldersAZ() {
    foldersData.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base'
    }));
}

async function saveNotesToStorage() {
    sortNotesNewestFirst();
    await dbClear('notes');
    await dbPutAll('notes', notesData);
    renderNotes();
    updateFolderCounts();
    renderFolders();
    initHomeUI();
}

async function saveFoldersToStorage() {
    sortFoldersAZ();
    await dbClear('folders');
    await dbPutAll('folders', foldersData);
    renderFolders();
    updateFolderCounts();
    initHomeUI();
}

function updateFolderCounts() {
    foldersData.forEach(folder => {
        folder.noteCount = notesData.filter(note => note.folderId === folder.id).length;
    });
}

function getDefaultFolders() {
    return [];
}

function generateAttachmentKey() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

async function getAttachmentUrl(key) {
    if (attachmentUrlCache.has(key)) return attachmentUrlCache.get(key);
    const blob = await dbGet('attachments', key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    attachmentUrlCache.set(key, url);
    return url;
}

function revokeAttachmentUrl(key) {
    if (attachmentUrlCache.has(key)) {
        URL.revokeObjectURL(attachmentUrlCache.get(key));
        attachmentUrlCache.delete(key);
    }
}

function isMediaFilename(filename) {
    return MEDIA_EXT_REGEX.test(filename);
}

function isMediaFileByType(file) {
    if (!file) return false;
    if (isMediaFilename(file.name)) return true;
    var t = file.type || '';
    return t.indexOf('image/') === 0 || t.indexOf('video/') === 0 || t.indexOf('audio/') === 0;
}

function openNoteByTitle(title) {
    var note = notesData.find(function(n) {
        return n.title && n.title.trim().toLowerCase() === title.trim().toLowerCase();
    });
    if (note) {
        openNoteReadingMode(note.id);
    } else {
        window.showMessage('Note not found: ' + title);
    }
}

function updateLinkedNoteReferences(oldTitle, newTitle, excludeId) {
    if (!oldTitle || !newTitle || oldTitle === newTitle) return 0;
    var escaped = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('\\[\\[' + escaped + '\\]\\]', 'g');
    var count = 0;
    notesData.forEach(function(n) {
        if (n.id === excludeId) return;
        if (!n.content) return;
        var matches = n.content.match(regex);
        if (matches && matches.length > 0) {
            n.content = n.content.replace(regex, '[[' + newTitle + ']]');
            n.date = new Date().toISOString();
            count++;
        }
    });
    if (count > 0) {
        window.showMessage('Updated ' + count + ' linked note' + (count !== 1 ? 's' : ''));
    }
    return count;
}

function enhanceWikiLinks(html) {
    return html.replace(/\[\[([^\]]+)\]\]/g, function(match, title) {
        var escaped = title.replace(/'/g, "\\'");
        return '<a class="wiki-link" onclick="event.preventDefault(); event.stopPropagation(); openNoteByTitle(\'' + escaped + '\'); return false;" style="color:var(--accent-color);cursor:pointer;text-decoration:underline;">' + title + '</a>';
    });
}

function fadeHomeView(el) {
    if (!el) return;
    el.classList.remove('home-view-fade');
    el.offsetWidth;
    el.classList.add('home-view-fade');
}

function renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');
    if (!notesGrid) return;
    if (notesData.length === 0) {
        notesGrid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    notesGrid.innerHTML = notesData.map(note => {
        let previewMd = note.content || 'No content';
        previewMd = previewMd.replace(/!\[.*?\]\(attachment:[^)]+\)/g, '');
        if (previewMd.length > 250) previewMd = previewMd.substring(0, 250) + '...';
        let html = convertMarkdownToHTML(previewMd);
        html = enhanceWikiLinks(html);
        return `<div class="note-card" onclick="openNoteReadingMode(${note.id})">
            <h3 class="note-title">${note.title || 'Untitled'}</h3>
            <p class="note-date">${formatDate(note.date)}</p>
            <div class="note-preview">${html}</div>
            <div class="note-tags">
                ${(note.tags || []).map(tag => `<span class="note-tag">${tag}</span>`).join('')}
                ${note.folderId ? `<span class="note-tag" style="background: rgba(255, 255, 255, 0.1);">${getFolderName(note.folderId)}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderFolders() {
    const foldersGrid = document.getElementById('foldersGrid');
    const emptyState = document.getElementById('foldersEmptyState');
    if (!foldersGrid) return;
    if (foldersData.length === 0) {
        foldersGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';
    const sorted = [...foldersData].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base'
    }));
    foldersGrid.innerHTML = sorted.map(folder => `
        <div class="folder-card" onclick="openFolder(${folder.id})">
            <h3 class="folder-name">${folder.name}</h3>
            <p class="folder-count">${folder.noteCount} note${folder.noteCount !== 1 ? 's' : ''}</p>
        </div>
    `).join('');
}

function getChildFolders(parentId) {
    return foldersData.filter(f => f.parentId === parentId);
}

function getTotalNotesInFolder(folderId) {
    let count = notesData.filter(n => n.folderId === folderId).length;
    const children = getChildFolders(folderId);
    children.forEach(child => {
        count += getTotalNotesInFolder(child.id);
    });
    return count;
}

function renderHomeFolders() {
    const folderList = document.getElementById('homeFolderList');
    if (!folderList) return;

    folderList.innerHTML = '';

    const totalNotesCount = notesData.length;
    const rootItem = document.createElement('button');
    rootItem.className = 'home-folder-item' + (currentHomeFolderId === null && !NotesApp.homeView.active ? ' active' : '');
    rootItem.innerHTML = `
        <span class="home-folder-icon"><i class="fas fa-folder"></i></span>
        <span class="home-folder-name">All Notes</span>
        ${totalNotesCount > 0 ? `<span class="home-folder-count">${totalNotesCount}</span>` : ''}
    `;
    rootItem.addEventListener('click', () => {
        NotesApp.emit('home:navigate');
        currentHomeFolderId = null;
        currentSearchTerm = '';
        homePage = 0;
        document.getElementById('homeSearchInput').value = '';
        renderHomeFolders();
        renderHomeNotes();
        closeSidebar();
    });
    folderList.appendChild(rootItem);

    function renderFolderRecursive(parentId, depth) {
        const children = getChildFolders(parentId).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, {
                sensitivity: 'base'
            })
        );
        children.forEach(folder => {
            const item = document.createElement('button');
            item.className = 'home-folder-item' + (currentHomeFolderId === folder.id && !NotesApp.homeView.active ? ' active' : '');
            item.style.paddingLeft = (12 + depth * 16) + 'px';

            const childCount = getChildFolders(folder.id).length;
            const noteCount = notesData.filter(n => n.folderId === folder.id).length;
            const totalCount = getTotalNotesInFolder(folder.id);
            const hasChildren = childCount > 0;
            const hasNotes = noteCount > 0;
            const hasContent = hasChildren || hasNotes;
            const isExpanded = expandedFolders.has(folder.id);
            const displayCount = (noteCount === 0 && hasChildren) ? totalCount : noteCount;

            item.innerHTML = `
                <span class="home-folder-icon"><i class="fas fa-folder"></i></span>
                <span class="home-folder-name">${folder.name}</span>
                ${displayCount > 0 ? `<span class="home-folder-count">${displayCount}</span>` : ''}
                ${hasContent ? `<button class="home-folder-chevron" data-chevron="${folder.id}">
                    <i class="fas ${isExpanded ? 'fa-chevron-circle-up' : 'fa-chevron-circle-down'}"></i>
                </button>` : ''}
            `;

            item.addEventListener('click', (e) => {
                if (e.target.closest('.home-folder-chevron')) return;
                NotesApp.emit('home:navigate');
                currentHomeFolderId = folder.id;
                currentSearchTerm = '';
                homePage = 0;
                document.getElementById('homeSearchInput').value = '';
                renderHomeFolders();
                renderHomeNotes();
                closeSidebar();
            });

            item.querySelector('.home-folder-chevron')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (expandedFolders.has(folder.id)) {
                    expandedFolders.delete(folder.id);
                } else {
                    expandedFolders.add(folder.id);
                }
                renderHomeFolders();
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showFolderContextMenu(folder.id, e.clientX, e.clientY);
            });

            item.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    e.preventDefault();
                    showFolderContextMenu(folder.id, e.touches[0].clientX, e.touches[0].clientY);
                }, 600);
            });
            item.addEventListener('touchend', () => clearTimeout(longPressTimer));
            item.addEventListener('touchmove', () => clearTimeout(longPressTimer));

            folderList.appendChild(item);

            if (isExpanded) {
                if (hasChildren) renderFolderRecursive(folder.id, depth + 1);
                if (hasNotes) {
                    const folderNotes = notesData.filter(n => n.folderId === folder.id).sort((a, b) => new Date(b.date) - new Date(a.date));
                    folderNotes.forEach(note => {
                        const noteItem = document.createElement('button');
                        noteItem.className = 'home-folder-item home-note-sidebar-item';
                        noteItem.style.paddingLeft = (12 + (depth + 1) * 16) + 'px';
                        noteItem.innerHTML = `
                            <span class="home-folder-icon"><i class="fas fa-sticky-note"></i></span>
                            <span class="home-folder-name">${note.title || 'Untitled'}</span>
                        `;
                        noteItem.addEventListener('click', () => {
                            openNoteReadingMode(note.id);
                        });
                        noteItem.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            showNoteContextMenu(note.id, e.clientX, e.clientY);
                        });
                        noteItem.addEventListener('touchstart', (e) => {
                            longPressTimer = setTimeout(() => {
                                e.preventDefault();
                                showNoteContextMenu(note.id, e.touches[0].clientX, e.touches[0].clientY);
                            }, 600);
                        });
                        noteItem.addEventListener('touchend', () => clearTimeout(longPressTimer));
                        noteItem.addEventListener('touchmove', () => clearTimeout(longPressTimer));
                        folderList.appendChild(noteItem);
                    });
                }
            }
        });
    }

    renderFolderRecursive(null, 0);
}

let longPressTimer = null;

function getCurrentFolderNotes() {
    if (currentSearchTerm) {
        const q = currentSearchTerm.toLowerCase();
        return notesData.filter(note =>
            (note.title && note.title.toLowerCase().includes(q)) ||
            (note.content && note.content.toLowerCase().includes(q))
        );
    }
    if (currentHomeFolderId === UNFOLDERED) {
        return notesData.filter(n => n.folderId === null);
    }
    const folder = currentHomeFolderId === null ? null : foldersData.find(f => f.id === currentHomeFolderId);
    if (folder) {
        return notesData.filter(n => n.folderId === folder.id);
    }
    return [...notesData];
}

function renderHomeNotes() {
    const itemsContainer = document.getElementById('homeItems');
    const folderTitle = document.getElementById('homeFolderTitle');
    const folderMeta = document.getElementById('homeFolderMeta');
    const pagination = document.getElementById('homePagination');
    if (!itemsContainer) return;

    if (NotesApp.homeView.provider && NotesApp.homeView.provider(itemsContainer, folderTitle, folderMeta)) {
        if (pagination) pagination.style.display = 'none';
        return;
    }

    let folderNotes;
    if (currentSearchTerm) {
        const q = currentSearchTerm.toLowerCase();
        folderNotes = notesData.filter(note =>
            (note.title && note.title.toLowerCase().includes(q)) ||
            (note.content && note.content.toLowerCase().includes(q))
        );
        folderTitle.textContent = 'Search Results';
        folderMeta.textContent = folderNotes.length > 0 ? `${folderNotes.length} note${folderNotes.length > 1 ? 's' : ''} found` : 'No matches';
    } else if (currentHomeFolderId === UNFOLDERED) {
        folderNotes = notesData.filter(n => n.folderId === null);
        folderTitle.textContent = 'No Folder';
        folderMeta.textContent = folderNotes.length > 0 ? `${folderNotes.length} note${folderNotes.length > 1 ? 's' : ''}` : 'Empty';
    } else {
        const folder = currentHomeFolderId === null ? null : foldersData.find(f => f.id === currentHomeFolderId);
        if (folder) {
            folderNotes = notesData.filter(n => n.folderId === folder.id);
            folderTitle.textContent = folder.name;
        } else {
            folderNotes = [...notesData];
            folderTitle.textContent = 'All Notes';
        }
        folderMeta.textContent = folderNotes.length > 0 ? `${folderNotes.length} note${folderNotes.length > 1 ? 's' : ''}` : 'Empty';
    }

    if (currentHomeFolderId === null && !currentSearchTerm) {
        folderNotes.sort((a, b) => {
            const aPinned = a.pinned ? 1 : 0;
            const bPinned = b.pinned ? 1 : 0;
            if (aPinned !== bPinned) return bPinned - aPinned;
            return new Date(b.date) - new Date(a.date);
        });
    } else {
        folderNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    const totalPages = Math.max(1, Math.ceil(folderNotes.length / HOME_PAGE_SIZE));
    if (homePage > totalPages - 1) homePage = totalPages - 1;
    if (homePage < 0) homePage = 0;

    if (folderNotes.length === 0) {
        itemsContainer.innerHTML = '<div class="home-empty-folder"><i class="far fa-folder-open"></i><div>No notes in this folder.</div></div>';
        if (pagination) pagination.style.display = 'none';
        fadeHomeView(itemsContainer);
        return;
    }

    const startIndex = homePage * HOME_PAGE_SIZE;
    const pageNotes = folderNotes.slice(startIndex, startIndex + HOME_PAGE_SIZE);

    itemsContainer.innerHTML = pageNotes.map(note => {
        let preview = note.content || 'No content';
        preview = preview.replace(/!\[.*?\]\(attachment:[^)]+\)/g, '');
        if (preview.length > 400) preview = preview.substring(0, 400) + '...';
        const pinIcon = note.pinned ? '<i class="fas fa-thumbtack home-note-pin-icon"></i>' : '';
        return `<div class="home-note-item" data-note-id="${note.id}" onclick="openNoteReadingMode(${note.id})" oncontextmenu="event.preventDefault(); showNoteContextMenu(${note.id}, event.clientX, event.clientY)">
            <div class="home-note-title">${pinIcon}${note.title || 'Untitled'}</div>
            <div class="home-note-preview">${preview}</div>
        </div>`;
    }).join('');

    document.querySelectorAll('.home-note-item').forEach(item => {
        item.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                e.preventDefault();
                const noteId = Number(item.dataset.noteId);
                if (noteId) showNoteContextMenu(noteId, e.touches[0].clientX, e.touches[0].clientY);
            }, 600);
        });
        item.addEventListener('touchend', () => clearTimeout(longPressTimer));
        item.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    });

    if (pagination) {
        if (totalPages > 1) {
            pagination.style.display = 'flex';
            document.getElementById('homePageInfo').textContent = `Page ${homePage + 1} of ${totalPages}`;
            document.getElementById('homePrevBtn').disabled = homePage === 0;
            document.getElementById('homeNextBtn').disabled = homePage >= totalPages - 1;
        } else {
            pagination.style.display = 'none';
        }
    }

    fadeHomeView(itemsContainer);
}

function initHomeUI() {
    if (foldersData.length > 0) {
        currentHomeFolderId = null;
    }
    renderHomeFolders();
    renderHomeNotes();
}

function closeSidebar() {
    document.getElementById('homeSidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('active');
}

function closeKeyboard() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
}

function showFolderContextMenu(folderId, x, y) {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed; z-index:1000001; background:#1c1c1c; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:8px 0; min-width:160px;';
    menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 190) + 'px';

    const options = [{
            label: 'New Note',
            icon: '<i class="fas fa-plus"></i>',
            action: () => createNewNoteInFolder(folderId)
        },
        {
            label: 'Rename',
            icon: '<i class="fas fa-pencil-alt"></i>',
            action: () => openRenameFolderPopup(folderId)
        },
        {
            label: 'Move',
            icon: '<i class="fas fa-folder"></i>',
            action: () => openMoveFolderPopup(folderId)
        },
        {
            label: 'Delete',
            icon: '<i class="fas fa-trash"></i>',
            action: () => deleteFolderWithConfirmation(folderId)
        }
    ];

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.style.cssText = 'display:flex; align-items:center; gap:10px; width:100%; padding:10px 16px; background:transparent; border:none; color:var(--text-primary); cursor:pointer; font-size:14px; text-align:left;';
        btn.innerHTML = `${opt.icon} ${opt.label}`;
        btn.addEventListener('click', () => {
            document.body.removeChild(menu);
            opt.action();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
            document.body.removeChild(menu);
            document.removeEventListener('click', handler);
        }
    });
}

async function createNewNoteInFolder(folderId) {
    const id = Date.now();
    const newNote = {
        id: id,
        title: '',
        content: '',
        tags: [],
        date: new Date().toISOString(),
        folderId: folderId,
        attachmentKeys: [],
        pinned: false
    };
    notesData.unshift(newNote);
    await saveNotesToStorage();
    openNoteEditor(id);
}

function showNoteContextMenu(noteId, x, y) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed; z-index:1000001; background:#1c1c1c; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:8px 0; min-width:160px;';
    menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 240) + 'px';

    const options = [{
            label: note.pinned ? 'Unpin' : 'Pin',
            icon: '<i class="fas fa-thumbtack"></i>',
            action: () => togglePinNote(noteId)
        },
        {
            label: 'Rename',
            icon: '<i class="fas fa-pencil-alt"></i>',
            action: () => openRenameNotePopup(noteId)
        },
        {
            label: 'Move',
            icon: '<i class="fas fa-folder"></i>',
            action: () => openMoveNoteFromContext(noteId)
        },
        {
            label: 'Delete',
            icon: '<i class="fas fa-trash"></i>',
            action: () => deleteNoteFromContext(noteId)
        },
        {
            label: 'Share',
            icon: '<i class="fas fa-share"></i>',
            action: () => shareNoteFromContext(noteId)
        }
    ];

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.style.cssText = 'display:flex; align-items:center; gap:10px; width:100%; padding:10px 16px; background:transparent; border:none; color:var(--text-primary); cursor:pointer; font-size:14px; text-align:left;';
        btn.innerHTML = `${opt.icon} ${opt.label}`;
        btn.addEventListener('click', () => {
            document.body.removeChild(menu);
            opt.action();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
            document.body.removeChild(menu);
            document.removeEventListener('click', handler);
        }
    });
}

function togglePinNote(noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;
    note.pinned = !note.pinned;
    saveNotesToStorage();
    window.showMessage(note.pinned ? 'Note pinned' : 'Note unpinned');
}

function openRenameNotePopup(noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;
    document.getElementById('popupTitle').textContent = 'Rename Note';
    document.getElementById('popupBody').innerHTML = `
        <input type="text" id="renameNoteInput" class="popup-input" value="${note.title || ''}">
        <div class="popup-buttons">
            <button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>
            <button class="popup-btn primary" onclick="confirmRenameNote(${noteId})">Save</button>
        </div>`;
    document.getElementById('universalPopup').style.display = 'flex';
}

function confirmRenameNote(noteId) {
    const newTitle = document.getElementById('renameNoteInput').value.trim();
    const note = notesData.find(n => n.id === noteId);
    if (note) {
        var oldTitle = note.title || '';
        var finalTitle = newTitle || 'Untitled';
        note.title = finalTitle;
        if (oldTitle && oldTitle !== finalTitle) {
            updateLinkedNoteReferences(oldTitle, finalTitle, noteId);
        }
        saveNotesToStorage();
        closeUniversalPopup();
        window.showMessage('Note renamed');
    }
}

function openMoveNoteFromContext(noteId) {
    currentNoteId = noteId;
    openFolderWindow();
}

function deleteNoteFromContext(noteId) {
    deleteCurrentNote(noteId);
}

function shareNoteFromContext(noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;
    const text = `${note.title || 'Untitled'}\n\n${note.content || ''}`;
    if (navigator.share) {
        navigator.share({
            title: note.title,
            text: text
        }).catch(() => {});
    } else {
        copyTextToClipboard(text);
        window.showMessage('Note text copied to clipboard');
    }
}

function openRenameFolderPopup(folderId) {
    const folder = foldersData.find(f => f.id === folderId);
    if (!folder) return;
    document.getElementById('popupTitle').textContent = 'Rename Folder';
    document.getElementById('popupBody').innerHTML = `
        <input type="text" id="renameFolderInput" class="popup-input" value="${folder.name}">
        <div class="popup-buttons">
            <button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>
            <button class="popup-btn primary" onclick="confirmRenameFolder(${folderId})">Save</button>
        </div>`;
    document.getElementById('universalPopup').style.display = 'flex';
}

function confirmRenameFolder(folderId) {
    const newName = document.getElementById('renameFolderInput').value.trim();
    if (!newName) {
        window.showMessage('Folder name required');
        return;
    }
    const folder = foldersData.find(f => f.id === folderId);
    if (folder) {
        folder.name = newName;
        saveFoldersToStorage();
        closeUniversalPopup();
        window.showMessage('Folder renamed');
    }
}

function openMoveFolderPopup(folderId) {
    folderMoveId = folderId;
    const folder = foldersData.find(f => f.id === folderId);
    if (!folder) return;
    folderMoveTargetId = folder.parentId;
    showMoveFolderWindow(folderId);
}

function showMoveFolderWindow(folderId) {
    document.getElementById('folderMoveWindow')?.remove();

    const moveWindow = document.createElement('div');
    moveWindow.id = 'folderMoveWindow';
    moveWindow.className = 'folder-window';

    moveWindow.style.display = 'block';
    moveWindow.style.opacity = '1';
    moveWindow.style.pointerEvents = 'auto';
    moveWindow.style.zIndex = '100000001';

    moveWindow.innerHTML = `
        <div class="folder-window-header">
            <h3>Move Folder</h3>
            <button type="button" class="folder-window-close" onclick="closeMoveFolderWindow()" aria-label="Close move window" title="Close">
                <i class="fas fa-close"></i>
            </button>
        </div>
        <div class="folder-window-search">
            <input type="text" id="folderMoveSearchInput" class="folder-window-search-input" placeholder="Search folders...">
        </div>
        <div class="folder-window-content" id="folderMoveContent"></div>
        <div class="folder-window-actions">
            <button type="button" class="folder-window-btn secondary" onclick="closeMoveFolderWindow()">
                Cancel
            </button>
            <button type="button" class="folder-window-btn primary" onclick="confirmFolderMove()">
                Move Here
            </button>
        </div>
    `;

    document.body.appendChild(moveWindow);

    document.getElementById('folderMoveSearchInput').addEventListener('input', function() {
        renderMoveFolderList(this.value);
    });

    renderMoveFolderList('');
}

function renderMoveFolderList(filterText) {
    var container = document.getElementById('folderMoveContent');
    if (!container) return;
    var q = (filterText || '').toLowerCase();
    container.innerHTML = '';

    var possibleTargets = foldersData.filter(function(folder) {
        return folder.id !== folderMoveId && !isDescendant(folder.id, folderMoveId);
    });

    var rootDiv = document.createElement('div');
    rootDiv.className = 'folder-window-item' + (folderMoveTargetId === null ? ' selected' : '');
    rootDiv.setAttribute('data-folder-id', 'root');
    rootDiv.onclick = function() {
        folderMoveTargetId = null;
        document.querySelectorAll('#folderMoveContent .folder-window-item').forEach(function(i) {
            i.classList.remove('selected');
        });
        rootDiv.classList.add('selected');
    };
    rootDiv.innerHTML = '<i class="fas fa-times"></i><span>No Folder (Root)</span>';
    container.appendChild(rootDiv);

    possibleTargets.sort(function(a, b) {
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });

    possibleTargets.forEach(function(folder) {
        if (q && !(folder.name || '').toLowerCase().includes(q)) return;
        var div = document.createElement('div');
        div.className = 'folder-window-item' + (folderMoveTargetId === folder.id ? ' selected' : '');
        div.setAttribute('data-folder-id', String(folder.id));
        var count = folder.noteCount || 0;
        div.innerHTML = '<i class="fas fa-folder"></i><span>' + folder.name + '</span><span class="note-count">' + count + ' notes</span>';
        div.onclick = function() {
            folderMoveTargetId = folder.id;
            document.querySelectorAll('#folderMoveContent .folder-window-item').forEach(function(i) {
                i.classList.remove('selected');
            });
            div.classList.add('selected');
        };
        container.appendChild(div);
    });
}

function closeMoveFolderWindow() {
    document.getElementById('folderMoveWindow')?.remove();
    folderMoveId = null;
    folderMoveTargetId = null;
}

async function confirmFolderMove() {
    const folder = foldersData.find(folder => folder.id === folderMoveId);
    if (!folder) return;

    const oldParentId = folder.parentId;
    const newParentId = folderMoveTargetId;

    if (newParentId === folder.id || isDescendant(newParentId, folder.id)) {
        window.showMessage('A folder cannot be moved into itself or a descendant folder');
        return;
    }

    folder.parentId = newParentId;

    try {
        await saveFoldersToStorage();
        closeMoveFolderWindow();
        window.showMessage('Folder moved');
    } catch (error) {
        folder.parentId = oldParentId;
        window.showMessage('Failed to move folder');
    }
}

function isDescendant(folderId, ancestorId) {
    let current = folderId;
    while (current !== null) {
        const folder = foldersData.find(f => f.id === current);
        if (!folder) return false;
        if (folder.parentId === ancestorId) return true;
        current = folder.parentId;
    }
    return false;
}

function deleteFolderWithConfirmation(folderId) {
    const folder = foldersData.find(f => f.id === folderId);
    if (!folder) return;
    document.getElementById('popupTitle').textContent = 'Delete Folder';
    document.getElementById('popupBody').innerHTML = `
        <p>Delete "${folder.name}"? It will be moved to Trash.</p>
        <div class="popup-buttons">
            <button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>
            <button class="popup-btn danger" onclick="confirmDeleteFolderById(${folderId})">Delete</button>
        </div>`;
    document.getElementById('universalPopup').style.display = 'flex';
}

async function confirmDeleteFolderById(folderId) {
    const folder = foldersData.find(f => f.id === folderId);
    if (!folder) return;
    const notesInFolder = notesData.filter(note => note.folderId === folderId);
    notesInFolder.forEach(note => {
        trashNotes.unshift({
            ...note,
            deletedAt: new Date().toISOString()
        });
    });
    notesData = notesData.filter(note => note.folderId !== folderId);
    const subFolders = foldersData.filter(f => f.parentId === folderId);
    subFolders.forEach(sub => {
        const subNotes = notesData.filter(note => note.folderId === sub.id);
        subNotes.forEach(note => {
            trashNotes.unshift({
                ...note,
                deletedAt: new Date().toISOString()
            });
        });
        notesData = notesData.filter(note => note.folderId !== sub.id);
        trashFolders.unshift({
            ...sub,
            deletedAt: new Date().toISOString()
        });
        foldersData = foldersData.filter(f => f.id !== sub.id);
    });
    trashFolders.unshift({
        ...folder,
        deletedAt: new Date().toISOString()
    });
    foldersData = foldersData.filter(f => f.id !== folderId);
    saveTrash();
    await saveNotesToStorage();
    await saveFoldersToStorage();
    closeUniversalPopup();
    window.showMessage('Folder moved to Trash');
}

function openFolder(folderId) {
    const folder = foldersData.find(f => f.id === folderId);
    if (!folder) return;
    currentFolderId = folderId;
    const folderNotes = notesData.filter(note => note.folderId === folderId);
    document.getElementById('folderPageTitle').textContent = folder.name;
    document.getElementById('folderPageSubtitle').textContent = `${folderNotes.length} note${folderNotes.length !== 1 ? 's' : ''}`;
    const folderNotesGrid = document.getElementById('folderNotesGrid');
    const folderEmptyState = document.getElementById('folderEmptyState');
    if (folderNotes.length === 0) {
        folderNotesGrid.innerHTML = '';
        folderEmptyState.style.display = 'block';
    } else {
        folderEmptyState.style.display = 'none';
        folderNotesGrid.innerHTML = folderNotes.map(note => {
            return `<div class="note-card" onclick="openNoteReadingMode(${note.id})" style="padding: 12px;">
                <h3 class="note-title">${note.title || 'Untitled'}</h3>
                <p class="note-date">${formatDate(note.date)}</p>
            </div>`;
        }).join('');
    }
    switchPage('folder-notes');
}

function editCurrentFolder() {
    const folder = foldersData.find(f => f.id === currentFolderId);
    if (!folder) return;
    openRenameFolderPopup(folder.id);
}

async function updateFolderName() {
    await saveFoldersToStorage();
    closeUniversalPopup();
    window.showMessage('Folder updated');
}

function deleteCurrentFolder() {
    deleteFolderWithConfirmation(currentFolderId);
}

async function confirmDeleteFolder() {
    await confirmDeleteFolderById(currentFolderId);
    switchPage('folders');
}

async function createNewNote() {
    const id = Date.now();
    const newNote = {
        id: id,
        title: '',
        content: '',
        tags: [],
        date: new Date().toISOString(),
        folderId: null,
        attachmentKeys: [],
        pinned: false
    };
    notesData.unshift(newNote);
    await saveNotesToStorage();
    openNoteEditor(id);
}

function openNewFolderPopup() {
    document.getElementById('popupTitle').textContent = 'New Folder';
    document.getElementById('popupBody').innerHTML = `
        <input type="text" id="popupFolderName" class="popup-input" placeholder="Folder name" autofocus>
        <div class="popup-buttons">
            <button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>
            <button class="popup-btn primary" onclick="createFolderFromPopup()">Create</button>
        </div>`;
    document.getElementById('universalPopup').style.display = 'flex';
}

async function createFolderFromPopup() {
    const folderName = document.getElementById('popupFolderName').value.trim();
    if (!folderName) {
        window.showMessage('Folder name required');
        return;
    }
    const newFolder = {
        id: Date.now(),
        name: folderName,
        icon: '',
        noteCount: 0,
        parentId: null
    };
    foldersData.unshift(newFolder);
    await saveFoldersToStorage();
    closeUniversalPopup();
    window.showMessage('Folder created!');
}

function getFolderName(folderId) {
    const folder = foldersData.find(f => f.id === folderId);
    return folder ? folder.name : 'Unknown';
}

async function openNoteReadingMode(noteId, fromHistory) {
    if (document.getElementById('noteEditorPage').classList.contains('active')) {
        document.getElementById('noteEditorPage').classList.remove('active');
    }

    const readingModeActive = document.getElementById('readingMode').classList.contains('active');

    if (!fromHistory) {
        if (readingModeActive && currentNoteId !== null && currentNoteId !== noteId) {
            readingHistory.push(currentNoteId);
        } else if (!readingModeActive) {
            readingHistory = [];
        }
    }

    currentNoteId = noteId;
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('readingTitle').textContent = note.title || 'Untitled';
    document.getElementById('readingDate').textContent = formatDate(note.date);
    document.getElementById('readingFolder').textContent = note.folderId ? getFolderName(note.folderId) : 'No Folder';
    let html = await replaceAttachmentRefs(note.content);
    html = preprocessProperties(html);
    html = convertMarkdownToHTML(html);
    html = enhanceWikiLinks(html);
    document.getElementById('readingContent').innerHTML = html;
    document.getElementById('readingMode').classList.add('active');
    document.getElementById('readingMode').scrollTop = 0;
    document.body.style.overflow = 'hidden';
    enhanceReadingContent(document.getElementById('readingContent'));
}

async function replaceAttachmentRefs(markdown) {
    let result = markdown.replace(/!\[\[([^\]]+)\]\]/g, function(_, filename) {
        return '![' + filename + '](attachment-by-name:' + encodeURIComponent(filename.trim()) + ')';
    });

    result = result.replace(/!\[([^\]]*)\]\(([^):\/\\]+\.(?:png|jpe?g|gif|webp|svg|bmp|mp4|webm|ogg|mov|m4v|mp3|wav|m4a|aac|flac|avif|tiff?|ico|pdf))\)/gi, function(match, alt, filename) {
        return '![' + alt + '](attachment-by-name:' + encodeURIComponent(filename.trim()) + ')';
    });

    const nameMap = getAttachmentNameMap();
    const byName = {};
    for (const key in nameMap) {
        byName[(nameMap[key] || '').toLowerCase()] = key;
    }

    const keysToResolve = new Set();
    let m;

    const regexByName = /!\[([^\]]*)\]\(attachment-by-name:([^)]+)\)/g;
    while ((m = regexByName.exec(result)) !== null) {
        const filename = decodeURIComponent(m[2]).toLowerCase();
        const key = byName[filename];
        if (key) keysToResolve.add(key);
    }

    const regexAttach = /!\[([^\]]*)\]\(attachment:([a-zA-Z0-9]+)\)/g;
    while ((m = regexAttach.exec(result)) !== null) {
        keysToResolve.add(m[2]);
    }

    const urlMap = {};
    for (const key of keysToResolve) {
        const url = await getAttachmentUrl(key);
        if (url) urlMap[key] = url;
    }

    result = result.replace(/!\[([^\]]*)\]\(attachment-by-name:([^)]+)\)/g, function(match, alt, filename) {
        const decoded = decodeURIComponent(filename).toLowerCase();
        const key = byName[decoded];
        if (key && urlMap[key]) {
            return '![' + alt + '](' + urlMap[key] + ')';
        }
        return match;
    });

    result = result.replace(/!\[([^\]]*)\]\(attachment:([a-zA-Z0-9]+)\)/g, function(match, alt, key) {
        if (urlMap[key]) {
            return '![' + alt + '](' + urlMap[key] + ')';
        }
        return match;
    });

    return result;
}

function blockClicksAfterReading() {
    var blockUntil = Date.now() + 400;
    var handler = function(e) {
        if (Date.now() < blockUntil) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        } else {
            document.removeEventListener('click', handler, true);
            document.removeEventListener('pointerup', handler, true);
        }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('pointerup', handler, true);
}

function goHomeFromReading() {
    if (readingHistory.length > 0) {
        const prevId = readingHistory.pop();
        openNoteReadingMode(prevId, true);
        return;
    }
    readingHistory = [];
    document.getElementById('readingMode').classList.remove('active');
    document.body.style.overflow = 'auto';
    suppressBackLinkUntil = Date.now() + 600;
    blockClicksAfterReading();
    switchPage('home');
}

function jumpHomeFromReading() {
    readingHistory = [];
    document.getElementById('readingMode').classList.remove('active');
    document.body.style.overflow = 'auto';
    suppressBackLinkUntil = Date.now() + 600;
    blockClicksAfterReading();
    switchPage('home');
}

function editFromReading() {
    if (currentNoteId) {
        document.getElementById('readingMode').classList.remove('active');
        openNoteEditor(currentNoteId);
    }
}

function convertMarkdownToHTML(markdown) {
    if (!markdown) return '';
    return marked.parse(markdown, {
        mangle: false,
        headerIds: false
    });
}

function enhanceReadingContent(container) {
    replaceArrowsInTextNodes(container);
    enhanceCallouts(container);
    enhanceTables(container);
    enhanceTableCellMarkdown(container);
    enhanceCustomQuotes(container);
    enhanceAttachments(container);
    enhanceVideos(container);
    processCardListBlocksInContainer(container);
    setupCardListInteractions(container);
    processTwoColumnButtonsInContainer(container);
    enhanceCodeBlocks(container);
    applyMediaContainers(container);
    setupFullscreenPreviews();
    attachCheckboxListeners();
}

function getFileIcon(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
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
        'mp4': 'fa-file-video',
        'mov': 'fa-file-video'
    };
    return map[ext] || 'fa-file';
}

function enhanceAttachments(container) {
    var images = container.querySelectorAll('img');
    images.forEach(function(img) {
        var alt = img.getAttribute('alt') || '';
        if (isMediaFilename(alt)) return;
        var src = img.getAttribute('src') || '';
        if (!src) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'attachment-file-card';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'attachment-file-name';
        var iconClass = getFileIcon(alt);
        nameSpan.innerHTML = '<i class="fas ' + iconClass + '"></i> ' + alt;
        var downloadBtn = document.createElement('a');
        downloadBtn.className = 'attachment-download-btn';
        downloadBtn.href = src;
        downloadBtn.download = alt;
        downloadBtn.title = 'Download';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var a = document.createElement('a');
            a.href = src;
            a.download = alt;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
        wrapper.appendChild(nameSpan);
        wrapper.appendChild(downloadBtn);
        img.parentNode.replaceChild(wrapper, img);
    });
}

function replaceArrowsInTextNodes(element) {
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (node.parentNode.tagName === 'CODE' || node.parentNode.tagName === 'PRE') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    var replacements = {
        '\u2190': 'fa-arrow-left',
        '\u2191': 'fa-arrow-up',
        '\u2193': 'fa-arrow-down',
        '\u2192': 'fa-arrow-right'
    };
    var nodesToReplace = [];
    while (walker.nextNode()) nodesToReplace.push(walker.currentNode);
    nodesToReplace.forEach(function(node) {
        var html = node.textContent;
        var changed = false;
        for (var arrow in replacements) {
            if (html.indexOf(arrow) !== -1) {
                html = html.split(arrow).join('<i class="fas ' + replacements[arrow] + ' arrow-icon"></i>');
                changed = true;
            }
        }
        if (changed) {
            var span = document.createElement('span');
            span.innerHTML = html;
            node.parentNode.replaceChild(span, node);
        }
    });
}

function enhanceCallouts(container) {
    var blockquotes = container.querySelectorAll('blockquote');
    blockquotes.forEach(function(blockquote) {
        var lines = blockquote.innerHTML
            .replace(/<\/p>\s*<p>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?p>/gi, '')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l);
        if (!lines.length) return;
        var match = lines[0].match(/^\[!(.*?)\]\s*(.*)$/i);
        if (!match) return;
        var typeSelector = match[1].trim();
        var titleText = match[2].trim();
        var typeLower = typeSelector.toLowerCase();
        var callout = document.createElement('div');
        callout.className = 'callout callout-' + (['note', 'warning', 'tip'].includes(typeLower) ? typeLower : 'default');
        var titleDiv = document.createElement('div');
        titleDiv.className = 'callout-title';
        var iconHTML = '<i class="fas fa-circle-info"></i>';
        if (typeLower === 'warning') iconHTML = '<i class="fas fa-triangle-exclamation"></i>';
        else if (typeLower === 'tip') iconHTML = '<i class="fas fa-lightbulb"></i>';
        else if (/^fa[srlbd]?\s+fa-/.test(typeSelector)) iconHTML = '<i class="' + typeSelector + '"></i>';
        titleDiv.innerHTML = iconHTML + ' ' + titleText;
        var contentDiv = document.createElement('div');
        contentDiv.className = 'callout-content';
        for (var i = 1; i < lines.length; i++) {
            var p = document.createElement('p');
            p.innerHTML = lines[i];
            contentDiv.appendChild(p);
        }
        callout.appendChild(titleDiv);
        callout.appendChild(contentDiv);
        blockquote.parentNode.replaceChild(callout, blockquote);
    });
}

function enhanceCustomQuotes(container) {
    var children = Array.from(container.children);
    var i = 0;
    while (i < children.length) {
        var child = children[i];
        if (child.tagName === 'P' && child.textContent.trim() === '""') {
            var quoteDiv = document.createElement('div');
            quoteDiv.className = 'custom-quote';
            var icon = document.createElement('i');
            icon.className = 'fas fa-quote-right quote-icon';
            quoteDiv.appendChild(icon);
            var next = child.nextSibling;
            while (next && (next.nodeType !== 1 || next.tagName !== 'P' || next.textContent.trim() !== '""')) {
                var toMove = next;
                next = next.nextSibling;
                quoteDiv.appendChild(toMove);
            }
            if (next && next.nodeType === 1 && next.tagName === 'P' && next.textContent.trim() === '""') next.remove();
            child.parentNode.replaceChild(quoteDiv, child);
            children = Array.from(container.children);
            continue;
        } else if (child.tagName === 'P' && child.textContent.trim().startsWith('""') && child.textContent.trim().endsWith('""') && child.textContent.trim().length > 4) {
            var innerHTML = child.innerHTML.trim().slice(2, -2).trim();
            var quoteDiv = document.createElement('div');
            quoteDiv.className = 'custom-quote';
            var icon = document.createElement('i');
            icon.className = 'fas fa-quote-right quote-icon';
            quoteDiv.appendChild(icon);
            var p = document.createElement('p');
            p.innerHTML = innerHTML;
            quoteDiv.appendChild(p);
            child.parentNode.replaceChild(quoteDiv, child);
            children = Array.from(container.children);
            continue;
        }
        i++;
    }
}

function enhanceTables(container) {
    var tables = container.querySelectorAll('table');
    tables.forEach(function(table) {
        if (table.classList.contains('property-table')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        var rows = table.querySelectorAll('tr');
        if (rows.length > 0) {
            var firstRow = rows[0];
            if (!firstRow.querySelector('th')) {
                var thead = document.createElement('thead');
                var tbody = table.querySelector('tbody') || document.createElement('tbody');
                while (firstRow.firstChild) {
                    var th = document.createElement('th');
                    th.innerHTML = firstRow.firstChild.innerHTML;
                    thead.appendChild(th);
                    firstRow.firstChild.remove();
                }
                firstRow.remove();
                table.insertBefore(thead, table.firstChild);
                if (!table.querySelector('tbody')) table.appendChild(tbody);
            }
        }
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
}

function limitCellWords(cell) {
    var text = cell.textContent.trim();
    if (!text) return;
    var words = text.split(/\s+/);
    if (words.length <= 70) return;
    var chunks = [];
    for (var i = 0; i < words.length; i += 70) {
        chunks.push(words.slice(i, i + 70).join(' '));
    }
    cell.innerHTML = chunks.join('<br>');
}

function enhanceTableCellMarkdown(container) {
    var cells = container.querySelectorAll('td, th');
    cells.forEach(function(cell) {
        if (cell.closest('.property-table')) return;
        var raw = cell.innerHTML.trim();
        if (raw.includes('\\n')) {
            raw = raw.replace(/\\n/g, '\n');
            cell.innerHTML = marked.parse(raw);
        }
        limitCellWords(cell);
    });
}

function enhanceVideos(container) {
    var images = container.querySelectorAll('img');
    images.forEach(function(img) {
        var src = img.getAttribute('src') || '';
        var cleanSrc = src.split('?')[0];
        var isVideo = /\.(mp4|webm|ogg)$/i.test(cleanSrc);
        if (!isVideo) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        var video = document.createElement('video');
        video.src = src;
        video.preload = 'metadata';
        video.setAttribute('controlsList', 'nodownload');
        video.setAttribute('disablepictureinpicture', 'true');
        video.style.webkitTouchCallout = 'none';
        video.style.webkitUserSelect = 'none';
        video.style.userSelect = 'none';
        video.addEventListener('contextmenu', (e) => e.preventDefault());
        var sizeOverlay = document.createElement('div');
        sizeOverlay.className = 'video-overlay-size';
        sizeOverlay.textContent = '...';
        var controls = document.createElement('div');
        controls.className = 'video-controls';
        var playBtn = document.createElement('button');
        playBtn.className = 'video-play-btn';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        var progress = document.createElement('input');
        progress.type = 'range';
        progress.className = 'video-progress';
        progress.min = 0;
        progress.max = 100;
        progress.value = 0;
        var timeDisplay = document.createElement('span');
        timeDisplay.className = 'video-time';
        timeDisplay.textContent = '0:00 / 0:00';
        controls.appendChild(playBtn);
        controls.appendChild(progress);
        controls.appendChild(timeDisplay);
        wrapper.appendChild(video);
        wrapper.appendChild(sizeOverlay);
        wrapper.appendChild(controls);
        img.parentNode.replaceChild(wrapper, img);

        function formatTime(seconds) {
            var mins = Math.floor(seconds / 60);
            var secs = Math.floor(seconds % 60);
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }

        function updateProgress() {
            var percent = (video.currentTime / video.duration) * 100;
            progress.value = percent;
            progress.style.background = 'linear-gradient(to right, var(--accent-color) ' + percent + '%, transparent ' + percent + '%)';
            timeDisplay.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
        }
        video.addEventListener('loadedmetadata', updateProgress);
        video.addEventListener('timeupdate', updateProgress);
        progress.addEventListener('input', function() {
            video.currentTime = (this.value / 100) * video.duration;
        });
        playBtn.addEventListener('click', function() {
            if (video.paused) {
                video.play();
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                sizeOverlay.style.opacity = '0';
            } else {
                video.pause();
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                sizeOverlay.style.opacity = '1';
            }
        });
        video.addEventListener('ended', function() {
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            sizeOverlay.style.opacity = '1';
        });
        fetch(src, {
            method: 'HEAD'
        }).then(response => {
            var length = response.headers.get('Content-Length');
            if (length) {
                var size = parseInt(length, 10);
                sizeOverlay.textContent = size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : (size / 1024).toFixed(1) + ' KB';
            }
        }).catch(() => {
            sizeOverlay.textContent = '?';
        });
    });
}

function processCardListBlocksInContainer(container) {
    var html = container.innerHTML;
    html = html.replace(/<p>\s*-- (.*?)<\/p>/gi, function(_, content) {
        return '<div class="card-list-item">' + marked.parseInline(content.trim()) + '</div>';
    });
    html = html.replace(/<p>\s*--email\s+(\S+)\s+"([^"]*)"<\/p>/gi, function(_, email, body) {
        var mailtoLink = 'mailto:' + email + '?subject=ROM%20Bug%20Submission&body=' + encodeURIComponent(body);
        return '<div class="submission-btn" data-url="' + mailtoLink + '"><i class="fas fa-envelope"></i> Email</div>';
    });
    html = html.replace(/<p>\s*--telegram\s+(\S+)\s+"([^"]*)"<\/p>/gi, function(_, url, text) {
        var tgLink = url + '?text=' + encodeURIComponent(text);
        return '<div class="submission-btn" data-url="' + tgLink + '"><i class="fab fa-telegram-plane"></i> Telegram</div>';
    });
    container.innerHTML = html;
}

function setupCardListInteractions(container) {
    container.addEventListener('click', function(e) {
        var target = e.target.closest('.card-list-item, .submission-btn');
        if (!target) return;
        if (target.classList.contains('card-list-item')) {
            target.classList.add('card-list-item-clicked');
            setTimeout(() => target.classList.remove('card-list-item-clicked'), 350);
            var link = target.querySelector('a');
            if (link) window.location.href = link.getAttribute('href');
            else if (target.getAttribute('data-url')) window.location.href = target.getAttribute('data-url');
        } else if (target.classList.contains('submission-btn')) {
            target.classList.add('submission-btn-clicked');
            setTimeout(() => target.classList.remove('submission-btn-clicked'), 350);
            var url = target.getAttribute('data-url');
            if (url) window.location.href = url;
        }
    });
}

function processTwoColumnButtonsInContainer(container) {
    container.innerHTML = container.innerHTML.replace(/<code>\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*<\/code>/gi, function(_, text1, url1, text2, url2) {
        return '<div class="two-column-buttons"><div class="card-list-item" data-url="' + url1 + '">' + text1 + '</div><div class="card-list-item" data-url="' + url2 + '">' + text2 + '</div></div>';
    });
}

function runHtmlCode(code) {
    var overlay = document.getElementById('codeRunOverlay');
    var frame = document.getElementById('codeRunFrame');
    if (!overlay || !frame) return;
    frame.srcdoc = code;
    overlay.classList.add('active');
}

function closeCodeRun() {
    var overlay = document.getElementById('codeRunOverlay');
    var frame = document.getElementById('codeRunFrame');
    if (!overlay) return;
    overlay.classList.remove('active');
    if (frame) frame.srcdoc = '';
}

function enhanceCodeBlocks(container) {
    var preElements = container.querySelectorAll('pre');
    preElements.forEach(function(pre) {
        var wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        var header = document.createElement('div');
        header.className = 'code-header';
        var codeElement = pre.querySelector('code');
        var language = '';
        if (codeElement && codeElement.className) {
            var match = codeElement.className.match(/language-(\w+)/);
            if (match) language = match[1];
        }
        var label = document.createElement('span');
        label.className = 'code-label';
        label.textContent = language || 'code';
        header.appendChild(label);

        var actions = document.createElement('div');
        actions.className = 'code-header-actions';

        if (language === 'html') {
            var playButton = document.createElement('button');
            playButton.className = 'copy-code-btn';
            playButton.innerHTML = '<i class="fas fa-play"></i>';
            playButton.title = 'Run HTML';
            playButton.addEventListener('click', function(e) {
                e.stopPropagation();
                runHtmlCode(codeElement ? codeElement.textContent : pre.textContent);
            });
            actions.appendChild(playButton);
        }

        var button = document.createElement('button');
        button.className = 'copy-code-btn';
        button.innerHTML = '<i class="far fa-copy"></i>';
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            var code = codeElement ? codeElement.textContent : pre.textContent;
            copyTextToClipboard(code);
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            setTimeout(function() {
                button.innerHTML = '<i class="far fa-copy"></i>';
                button.classList.remove('copied');
            }, 1500);
        });
        actions.appendChild(button);
        header.appendChild(actions);

        var contentDiv = document.createElement('div');
        contentDiv.className = 'code-content';
        if (codeElement) {
            var safeCode = document.createElement('code');
            safeCode.textContent = codeElement.textContent;
            if (codeElement.className) safeCode.className = codeElement.className;
            var safePre = document.createElement('pre');
            safePre.appendChild(safeCode);
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(contentDiv);
            contentDiv.appendChild(safePre);
            pre.remove();
        } else {
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(header);
            wrapper.appendChild(contentDiv);
            contentDiv.appendChild(pre);
        }
    });
}

function applyMediaContainers(container) {
    if (!window.matchMedia('(min-width: 720px)').matches) return;
    var images = container.querySelectorAll('img');
    images.forEach(function(img) {
        if (img.closest('.video-wrapper') || img.closest('.media-container') || img.closest('.attachment-file-card')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'media-container';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.margin = '0';
    });
}

function setupFullscreenPreviews() {
    if (document.getElementById('fullscreenOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'fullscreenOverlay';
    overlay.className = 'fullscreen-overlay';
    overlay.innerHTML = '<button class="fullscreen-close-btn" id="fullscreenClose"><i class="fas fa-times"></i></button><div class="fullscreen-media-container"><img id="fullscreenImage" style="display: none;"><video id="fullscreenVideo" controls style="display: none;"></video></div>';
    document.body.appendChild(overlay);
    var closeBtn = overlay.querySelector('#fullscreenClose');
    var imgEl = overlay.querySelector('#fullscreenImage');
    var videoEl = overlay.querySelector('#fullscreenVideo');

    function closeFullscreen() {
        overlay.classList.remove('active');
        imgEl.style.display = 'none';
        videoEl.style.display = 'none';
        videoEl.pause();
        videoEl.src = '';
    }
    closeBtn.addEventListener('click', closeFullscreen);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeFullscreen();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeFullscreen();
    });
    var content = document.getElementById('readingContent');
    if (content) {
        content.addEventListener('click', function(e) {
            if (!window.matchMedia('(min-width: 720px)').matches) return;
            var target = e.target.closest('.media-container');
            if (!target) return;
            e.preventDefault();
            var img = target.querySelector('img');
            var video = target.querySelector('video');
            if (img) {
                imgEl.src = img.src;
                imgEl.style.display = 'block';
                videoEl.style.display = 'none';
            } else if (video) {
                videoEl.src = video.currentSrc || video.src;
                videoEl.style.display = 'block';
                imgEl.style.display = 'none';
            } else return;
            overlay.classList.add('active');
        });
    }
}

function attachCheckboxListeners() {
    var note = notesData.find(n => n.id === currentNoteId);
    if (!note) return;
    var lines = note.content.split('\n');
    var taskLineIndices = [];
    for (var i = 0; i < lines.length; i++) {
        if (/^(\s*)- \[[ x]\]\s+/.test(lines[i])) taskLineIndices.push(i);
    }
    var checkboxes = document.querySelectorAll('.reading-content input[type="checkbox"]');
    checkboxes.forEach((checkbox, idx) => {
        checkbox.removeAttribute('disabled');
        var li = checkbox.closest('li');
        if (!li || idx >= taskLineIndices.length) return;
        var lineIndex = taskLineIndices[idx];
        li.dataset.lineIndex = lineIndex;
        checkbox.addEventListener('change', () => toggleTaskListItem(lineIndex));
    });
}

function toggleTaskListItem(lineIndex) {
    var note = notesData.find(n => n.id === currentNoteId);
    if (!note || lineIndex === undefined) return;
    var lines = note.content.split('\n');
    if (lines[lineIndex]) {
        if (lines[lineIndex].includes('- [ ]')) lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
        else if (lines[lineIndex].includes('- [x]')) lines[lineIndex] = lines[lineIndex].replace('- [x]', '- [ ]');
    }
    note.content = lines.join('\n');
    note.date = new Date().toISOString();
    saveNotesToStorage();
    openNoteReadingMode(currentNoteId);
}

async function cleanupAttachments(noteId, newContent) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) return;
    const newKeys = [];
    const regex = /!\[.*?\]\(attachment:([a-zA-Z0-9]+)\)/g;
    let match;
    while ((match = regex.exec(newContent)) !== null) {
        newKeys.push(match[1]);
    }
    note.attachmentKeys = newKeys;
}

function attachImage() {
    document.getElementById('imageFileInput').click();
}

document.getElementById('imageFileInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const key = generateAttachmentKey();
    await dbPut('attachments', key, file);
    saveAttachmentName(key, file.name);
    const insertText = '![' + file.name + '](attachment:' + key + ')';
    const textarea = document.getElementById('editorContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + insertText + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    textarea.focus();
    triggerAutoSave();
    e.target.value = '';
});

function openNoteEditor(noteId) {
    if (document.getElementById('readingMode').classList.contains('active')) document.getElementById('readingMode').classList.remove('active');
    currentNoteId = noteId;
    var note = notesData.find(n => n.id === noteId);
    if (!note) return;
    document.getElementById('editorTitle').value = note.title;
    document.getElementById('editorContent').value = note.content;
    renderEditorTags();
    document.getElementById('noteEditorPage').classList.add('active');
    document.body.style.overflow = 'hidden';
    undoStack = [note.content];
    redoStack = [];
}

async function saveCurrentNote() {
    var note = notesData.find(n => n.id === currentNoteId);
    if (note) {
        var oldTitle = note.title || '';
        var newTitle = document.getElementById('editorTitle').value;
        note.title = newTitle;
        const newContent = document.getElementById('editorContent').value;
        await cleanupAttachments(note.id, newContent);
        note.content = newContent;
        note.date = new Date().toISOString();
        if (oldTitle && newTitle && oldTitle !== newTitle) {
            updateLinkedNoteReferences(oldTitle, newTitle, note.id);
        }
        await saveNotesToStorage();
        NotesApp.emit('note:save', note);
    }
}

async function closeNoteEditor() {
    await saveCurrentNote();
    if (document.getElementById('readingMode').classList.contains('active')) document.getElementById('readingMode').classList.remove('active');
    document.getElementById('noteEditorPage').classList.remove('active');
    document.body.style.overflow = 'auto';
    suppressBackLinkUntil = Date.now() + 600;
    window.showMessage('Note saved!');
}

async function deleteCurrentNote(noteId = currentNoteId) {
    document.getElementById('popupTitle').textContent = 'Delete Note';
    document.getElementById('popupBody').innerHTML = `
        <p>Are you sure you want to delete this note? It will be moved to Trash.</p>
        <div class="popup-buttons">
            <button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>
            <button class="popup-btn danger" onclick="confirmDeleteNote(${noteId})">Delete</button>
        </div>`;
    document.getElementById('universalPopup').style.display = 'flex';
}

async function confirmDeleteNote(noteId = currentNoteId) {
    if (document.getElementById('readingMode').classList.contains('active')) document.getElementById('readingMode').classList.remove('active');
    const note = notesData.find(n => n.id === noteId);
    if (note) {
        trashNotes.unshift({
            ...note,
            deletedAt: new Date().toISOString()
        });
        notesData = notesData.filter(n => n.id !== noteId);
        saveTrash();
    }
    document.getElementById('noteEditorPage').classList.remove('active');
    document.body.style.overflow = 'auto';
    await saveNotesToStorage();
    closeUniversalPopup();
    window.showMessage('Note moved to Trash');
}

function renderEditorTags() {
    var container = document.getElementById('editorTagsContainer');
    var note = notesData.find(n => n.id === currentNoteId);
    if (!note || !container) return;
    container.innerHTML = '';
    (note.tags || []).forEach(tag => {
        var span = document.createElement('span');
        span.className = 'note-tag';
        span.textContent = tag;
        container.appendChild(span);
    });
}

function openFolderWindow() {
    var note = notesData.find(n => n.id === currentNoteId);
    selectedFolderId = note ? note.folderId : null;
    var searchInput = document.getElementById('folderWindowSearchInput');
    if (searchInput) searchInput.value = '';
    renderFolderWindow('');
    document.getElementById('folderWindow').classList.add('active');
    document.getElementById('folderWindowOverlay').classList.add('active');
}

function closeFolderWindow() {
    document.getElementById('folderWindow').classList.remove('active');
    document.getElementById('folderWindowOverlay').classList.remove('active');
}

function renderFolderWindow(filterText) {
    var note = notesData.find(n => n.id === currentNoteId);
    var folderWindowContent = document.getElementById('folderWindowContent');
    if (!folderWindowContent) return;
    var q = (filterText || '').toLowerCase();
    folderWindowContent.innerHTML = '';

    var noFolderDiv = document.createElement('div');
    noFolderDiv.className = 'folder-window-item' + (!note.folderId ? ' selected' : '');
    noFolderDiv.setAttribute('data-folder-id', 'null');
    noFolderDiv.onclick = () => selectFolderInWindow(null);
    noFolderDiv.innerHTML = '<i class="fas fa-times"></i><span>No Folder</span>';
    folderWindowContent.appendChild(noFolderDiv);

    const sortedFolders = [...foldersData].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, {
            sensitivity: 'base'
        })
    );

    sortedFolders.forEach(folder => {
        if (q && !(folder.name || '').toLowerCase().includes(q)) return;
        var folderDiv = document.createElement('div');
        folderDiv.className = 'folder-window-item' + (note.folderId === folder.id ? ' selected' : '');
        folderDiv.setAttribute('data-folder-id', String(folder.id));
        folderDiv.onclick = () => selectFolderInWindow(folder.id);
        folderDiv.innerHTML = '<i class="fas fa-folder"></i><span>' + folder.name + '</span><span class="note-count">' + folder.noteCount + ' notes</span>';
        folderWindowContent.appendChild(folderDiv);
    });
}

function selectFolderInWindow(folderId) {
    selectedFolderId = folderId;
    document.querySelectorAll('#folderWindowContent .folder-window-item').forEach(item => item.classList.remove('selected'));
    var target = folderId === null ? 'null' : String(folderId);
    var el = document.querySelector('#folderWindowContent .folder-window-item[data-folder-id="' + target + '"]');
    if (el) el.classList.add('selected');
}

async function applyFolderSelection() {
    var note = notesData.find(n => n.id === currentNoteId);
    if (note) {
        note.folderId = selectedFolderId;
        await saveNotesToStorage();
        closeFolderWindow();
        window.showMessage('Note moved!');
    }
}

function createNewFolderFromWindow() {
    openNewFolderPopup();
}

function insertMarkdown(before, after) {
    var textarea = document.getElementById('editorContent');
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    var selected = text.substring(start, end);
    var newText = text.substring(0, start) + before + selected + after + text.substring(end);
    textarea.value = newText;
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
    textarea.focus();
    triggerAutoSave();
}

function insertLink() {
    var textarea = document.getElementById('editorContent');
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    var selected = text.substring(start, end);
    var insertText = '[' + selected + ']()';
    textarea.value = text.substring(0, start) + insertText + text.substring(end);
    var cursorPos = start + selected.length + 3;
    textarea.selectionStart = textarea.selectionEnd = cursorPos;
    textarea.focus();
    triggerAutoSave();
}

function insertTable() {
    var tableTemplate = '\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n';
    insertMarkdown(tableTemplate, '');
}

function indent() {
    var textarea = document.getElementById('editorContent');
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var lines = textarea.value.substring(start, end).split('\n');
    var indented = lines.map(line => '  ' + line).join('\n');
    textarea.value = textarea.value.substring(0, start) + indented + textarea.value.substring(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + indented.length;
    textarea.focus();
    triggerAutoSave();
}

function outdent() {
    var textarea = document.getElementById('editorContent');
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var selectedText = textarea.value.substring(start, end);
    var lines = selectedText.split('\n');
    var outdented = lines.map(line => line.replace(/^ {1,2}/, '')).join('\n');
    textarea.value = textarea.value.substring(0, start) + outdented + textarea.value.substring(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + outdented.length;
    textarea.focus();
    triggerAutoSave();
}

function clearText() {
    if (confirm('Clear all content?')) {
        document.getElementById('editorContent').value = '';
        document.getElementById('editorContent').focus();
        triggerAutoSave();
    }
}

function undo() {
    var textarea = document.getElementById('editorContent');
    if (undoStack.length > 0) {
        var current = textarea.value;
        redoStack.push(current);
        textarea.value = undoStack.pop();
        textarea.focus();
    }
}

function redo() {
    var textarea = document.getElementById('editorContent');
    if (redoStack.length > 0) {
        var current = textarea.value;
        undoStack.push(current);
        textarea.value = redoStack.pop();
        textarea.focus();
    }
}

function handleEditorKeyDown(e) {
    if (e.key !== 'Enter') return;
    var textarea = e.target;
    var start = textarea.selectionStart;
    var text = textarea.value;
    var lineStart = text.lastIndexOf('\n', start - 1) + 1;
    var currentLine = text.substring(lineStart, start);
    var bulletMatch = currentLine.match(/^(\s*)([-*]|(\d+\.)|(- \[[ x]\]))\s+/);
    if (bulletMatch) {
        e.preventDefault();
        var indent = bulletMatch[1] || '';
        var marker = bulletMatch[2];
        var newMarker = marker;
        if (marker.match(/\d+\./)) newMarker = (parseInt(marker) + 1) + '.';
        var newLine = '\n' + indent + newMarker + ' ';
        textarea.value = text.substring(0, start) + newLine + text.substring(start);
        textarea.selectionStart = textarea.selectionEnd = start + newLine.length;
        triggerAutoSave();
    }
}

function formatDate(dateString) {
    var date = new Date(dateString);
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    else if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    else return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    });
}

function openImportExportPopup() {
    document.getElementById('popupTitle').textContent = 'Import & Export';
    document.getElementById('popupBody').innerHTML =
        '<button class="popup-btn primary" onclick="document.getElementById(\'importMdFiles\').click();" style="width:100%; margin-bottom:8px;"><i class="fas fa-file-import"></i> Import Markdown files</button>' +
        '<button class="popup-btn primary" onclick="document.getElementById(\'importFolder\').click();" style="width:100%; margin-bottom:8px;"><i class="fas fa-folder-open"></i> Import Folder</button>' +
        '<button class="popup-btn primary" onclick="exportAllMd(); closeUniversalPopup();" style="width:100%; margin-bottom:8px;"><i class="fas fa-file-export"></i> Export All as Markdown files</button>' +
        '<button class="popup-btn primary" onclick="exportFolderAsZip(); closeUniversalPopup();" style="width:100%;"><i class="fas fa-file-archive"></i> Export as Folder Structures</button>';
    document.getElementById('universalPopup').style.display = 'flex';
}

function toggleReadingMode() {
    saveCurrentNote();
    openNoteReadingMode(currentNoteId);
}

function switchPage(page, event) {
    closeSidebar();
    var currentActivePage = document.querySelector('.page-section.active');
    var targetPage = document.getElementById(page + '-page');

    if (currentActivePage === targetPage) return;

    if (currentActivePage) {
        currentActivePage.style.opacity = '0';
        currentActivePage.style.visibility = 'hidden';

        setTimeout(function() {
            currentActivePage.classList.remove('active');
            currentActivePage.style.height = '0';
            currentActivePage.style.overflow = 'hidden';

            targetPage.style.height = 'auto';
            targetPage.style.overflow = 'visible';
            targetPage.classList.add('active');

            setTimeout(function() {
                targetPage.style.opacity = '1';
                targetPage.style.visibility = 'visible';
                window.scrollTo(0, 0);
            }, 50);
        }, 300);
    } else {
        targetPage.style.height = 'auto';
        targetPage.style.overflow = 'visible';
        targetPage.classList.add('active');
        targetPage.style.opacity = '1';
        targetPage.style.visibility = 'visible';
        window.scrollTo(0, 0);
    }
}

function triggerAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveCurrentNote();
    }, 3000);
}

function closeUniversalPopup() {
    document.getElementById('universalPopup').style.display = 'none';
}

async function exportSingleMd() {
    var note = notesData.find(n => n.id === currentNoteId);
    if (!note) return;
    var blob = new Blob([note.content], {
        type: 'text/markdown'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (note.title || 'Untitled') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function exportAllMd() {
    if (notesData.length === 0) {
        window.showMessage('No notes to export');
        return;
    }
    var zip = new JSZip();
    for (var note of notesData) {
        var filename = (note.title || 'Untitled') + '.md';
        zip.file(filename, note.content);
    }
    var blob = await zip.generateAsync({
        type: 'blob'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Kiraku Notes.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function exportFolderAsZip() {
    if (notesData.length === 0 && foldersData.length === 0) {
        window.showMessage('Nothing to export');
        return;
    }
    var zip = new JSZip();
    var attachmentsFolder = zip.folder('Attachments');
    var nameMap = getAttachmentNameMap();
    var usedNames = {};

    function uniqueName(name) {
        var base = name;
        var counter = 1;
        while (usedNames[name]) {
            var dot = base.lastIndexOf('.');
            if (dot > 0) {
                name = base.substring(0, dot) + ' (' + counter + ')' + base.substring(dot);
            } else {
                name = base + ' (' + counter + ')';
            }
            counter++;
        }
        usedNames[name] = true;
        return name;
    }

    function sanitize(str) {
        return String(str || '').replace(/[\\\/:*?"<>|]/g, '_').trim() || 'Untitled';
    }

    function buildFolderPath(folderId) {
        var parts = [];
        var current = folderId;
        var safety = 0;
        while (current !== null && current !== undefined && safety < 100) {
            var f = foldersData.find(function(x) {
                return x.id === current;
            });
            if (!f) break;
            parts.unshift(sanitize(f.name));
            current = f.parentId;
            safety++;
        }
        return parts;
    }

    var attachmentKeyToPath = {};

    for (const note of notesData) {
        var attRegex = /!\[.*?\]\(attachment:([a-zA-Z0-9]+)\)/g;
        var m;
        var noteContent = note.content || '';
        while ((m = attRegex.exec(noteContent)) !== null) {
            var key = m[1];
            if (attachmentKeyToPath[key]) continue;
            var blob = await dbGet('attachments', key);
            if (blob) {
                var origName = nameMap[key] || key;
                var finalName = uniqueName(sanitize(origName));
                attachmentKeyToPath[key] = finalName;
                attachmentsFolder.file(finalName, blob);
            }
        }
    }

    for (const note of notesData) {
        var folderPath = note.folderId ? buildFolderPath(note.folderId) : [];
        var targetFolder = zip;
        for (const part of folderPath) {
            targetFolder = targetFolder.folder(part);
        }
        var noteContent = note.content || '';
        noteContent = noteContent.replace(/!\[([^\]]*)\]\(attachment:([a-zA-Z0-9]+)\)/g, function(match, alt, key) {
            if (attachmentKeyToPath[key]) {
                return '![' + alt + '](Attachments/' + attachmentKeyToPath[key] + ')';
            }
            return match;
        });
        var filename = sanitize(note.title || 'Untitled') + '.md';
        var existing = targetFolder.file(filename);
        if (existing) {
            var base = filename.replace(/\.md$/i, '');
            var c = 2;
            while (targetFolder.file(base + ' (' + c + ').md')) c++;
            filename = base + ' (' + c + ').md';
        }
        targetFolder.file(filename, noteContent);
    }

    if (attachmentsFolder && Object.keys(attachmentKeyToPath).length === 0) {
        zip.remove('Attachments');
    }

    var blob = await zip.generateAsync({
        type: 'blob'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Kiraku Notes.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function openFolderSelectPopup(callback) {
    importTargetFolderId = null;
    document.getElementById('popupTitle').textContent = 'Select Folder';
    document.getElementById('popupBody').innerHTML = '';
    const body = document.getElementById('popupBody');
    const noFolderDiv = document.createElement('div');
    noFolderDiv.className = 'folder-window-item ' + (importTargetFolderId === null ? 'selected' : '');
    noFolderDiv.onclick = () => selectImportFolder(null);
    noFolderDiv.innerHTML = '<i class="fas fa-times"></i><span>No Folder (Root)</span>';
    body.appendChild(noFolderDiv);
    const sortedFolders = [...foldersData].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, {
            sensitivity: 'base'
        })
    );
    sortedFolders.forEach(folder => {
        const div = document.createElement('div');
        div.className = 'folder-window-item';
        div.onclick = () => selectImportFolder(folder.id);
        div.innerHTML = `<i class="fas fa-folder"></i><span>${folder.name}</span>`;
        body.appendChild(div);
    });
    const buttons = document.createElement('div');
    buttons.className = 'popup-buttons';
    buttons.innerHTML = '<button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button><button class="popup-btn primary" onclick="confirmImportFolderSelection()">Import Here</button>';
    body.appendChild(buttons);
    document.getElementById('universalPopup').style.display = 'flex';
    pendingImportFiles = callback;
}

function selectImportFolder(folderId) {
    importTargetFolderId = folderId;
    document.querySelectorAll('#popupBody .folder-window-item').forEach(item => item.classList.remove('selected'));
    const items = document.querySelectorAll('#popupBody .folder-window-item');
    if (folderId === null) items[0].classList.add('selected');
    else {
        const sortedFolders = [...foldersData].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, {
                sensitivity: 'base'
            })
        );
        const index = sortedFolders.findIndex(f => f.id === folderId) + 1;
        if (items[index]) items[index].classList.add('selected');
    }
}

function confirmImportFolderSelection() {
    closeUniversalPopup();
    if (pendingImportFiles) {
        pendingImportFiles(importTargetFolderId);
        pendingImportFiles = null;
    }
}

function getOrCreateFolderByPath(pathParts, parentId) {
    if (pathParts.length === 0) return parentId;
    var name = pathParts[0];
    var existing = foldersData.find(f => f.name === name && f.parentId === parentId);
    if (existing) {
        return getOrCreateFolderByPath(pathParts.slice(1), existing.id);
    }
    var newFolder = {
        id: Date.now() + Math.random(),
        name: name,
        icon: '',
        noteCount: 0,
        parentId: parentId
    };
    foldersData.push(newFolder);
    return getOrCreateFolderByPath(pathParts.slice(1), newFolder.id);
}

async function processMediaFiles(mediaFiles) {
    var count = 0;
    for (const file of mediaFiles) {
        const key = generateAttachmentKey();
        await dbPut('attachments', key, file);
        saveAttachmentName(key, file.name);
        count++;
    }
    return count;
}

function importFolderHandler(event) {
    var files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) {
        window.showMessage('No files selected');
        return;
    }
    closeUniversalPopup();
    openFolderSelectPopup(async function(targetFolderId) {
        var mdFiles = files.filter(f => /\.(md|txt)$/i.test(f.name));
        var mediaFiles = files.filter(f => isMediaFileByType(f));

        var mediaCount = 0;
        if (mediaFiles.length > 0) {
            mediaCount = await processMediaFiles(mediaFiles);
        }

        if (mdFiles.length === 0) {
            if (mediaCount > 0) {
                window.showMessage('Imported ' + mediaCount + ' media file' + (mediaCount !== 1 ? 's' : ''));
            } else {
                window.showMessage('No notes or media found');
            }
            return;
        }

        var processed = 0;
        var total = mdFiles.length;

        mdFiles.forEach(file => {
            var reader = new FileReader();
            reader.onload = async (e) => {
                var content = e.target.result;
                var relativePath = file.webkitRelativePath || file.name;
                var parts = relativePath.split('/');
                var fileName = parts.pop();
                var title = fileName.replace(/\.(md|txt)$/i, '') || 'Imported';
                var folderId = targetFolderId;
                if (parts.length > 0) parts.shift();
                if (parts.length > 0) {
                    folderId = getOrCreateFolderByPath(parts, targetFolderId);
                }
                var existing = notesData.find(n => n.title === title && n.folderId === folderId);
                if (existing) {
                    var copyCount = 1;
                    var newTitle = title + ' Copy';
                    while (notesData.find(n => n.title === newTitle && n.folderId === folderId)) {
                        copyCount++;
                        newTitle = title + ' Copy ' + copyCount;
                    }
                    title = newTitle;
                }
                var id = Date.now() + Math.random();
                notesData.unshift({
                    id: id,
                    title: title,
                    content: content,
                    tags: [],
                    date: new Date().toISOString(),
                    folderId: folderId,
                    attachmentKeys: [],
                    pinned: false
                });
                processed++;
                if (processed === total) {
                    await saveNotesToStorage();
                    await saveFoldersToStorage();
                    var msgParts = [];
                    msgParts.push(mdFiles.length + ' note' + (mdFiles.length !== 1 ? 's' : ''));
                    if (mediaCount > 0) msgParts.push(mediaCount + ' media');
                    window.showMessage('Imported ' + msgParts.join(' and '));
                }
            };
            reader.readAsText(file);
        });
    });
}

async function importMdFilesHandler(event) {
    const files = Array.from(event.target.files || []).filter(file => /\.md$/i.test(file.name));
    event.target.value = '';

    if (!files.length) {
        window.showMessage('No Markdown files selected');
        return;
    }

    closeUniversalPopup();

    openFolderSelectPopup(async function(targetFolderId) {
        try {
            const importedNotes = await Promise.all(
                files.map(file => new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = () => {
                        const content = typeof reader.result === 'string' ? reader.result : '';
                        const title = file.name.replace(/\.md$/i, '') || 'Imported';

                        resolve({
                            id: Date.now() + Math.random(),
                            title: title,
                            content: content,
                            tags: [],
                            date: new Date().toISOString(),
                            folderId: targetFolderId,
                            attachmentKeys: [],
                            pinned: false
                        });
                    };

                    reader.onerror = () => {
                        reject(reader.error || new Error('Failed to read ' + file.name));
                    };

                    reader.readAsText(file);
                }))
            );

            notesData.unshift(...importedNotes);

            await saveNotesToStorage();
            await saveFoldersToStorage();

            window.showMessage('Imported ' + importedNotes.length + ' .md files');
        } catch (error) {
            window.showMessage('Failed to import Markdown files');
        }
    });
}

function setupHomeSearch() {
    const input = document.getElementById('homeSearchInput');
    const container = document.getElementById('homeSearchSuggestions');
    if (!input || !container) return;

    input.addEventListener('input', function() {
        NotesApp.emit('home:navigate');
        currentSearchTerm = this.value.trim();
        homePage = 0;
        showHomeSearchSuggestions(this.value);
        renderHomeNotes();
    });

    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            container.style.display = 'none';
            NotesApp.emit('home:navigate');
            currentSearchTerm = this.value.trim();
            homePage = 0;
            renderHomeNotes();
        }
    });

    input.addEventListener('focus', function() {
        if (this.value.trim()) showHomeSearchSuggestions(this.value);
    });

    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.style.display = 'none';
        }
    });

    container.addEventListener('click', function(e) {
        const item = e.target.closest('.search-suggestion-item');
        if (item) {
            const term = item.querySelector('.suggestion-title')?.textContent || '';
            NotesApp.emit('home:navigate');
            input.value = term;
            currentSearchTerm = term;
            homePage = 0;
            container.style.display = 'none';
            renderHomeNotes();
        }
    });
}

function showHomeSearchSuggestions(term) {
    const container = document.getElementById('homeSearchSuggestions');
    if (!term.trim()) {
        container.style.display = 'none';
        return;
    }
    const q = term.toLowerCase();
    const results = notesData.filter(note =>
        (note.title && note.title.toLowerCase().includes(q)) ||
        (note.content && note.content.toLowerCase().includes(q))
    );
    if (results.length === 0) {
        container.innerHTML = '<div class="search-suggestion-item"><div class="suggestion-title">No notes found</div></div>';
    } else {
        container.innerHTML = results.slice(0, 8).map(note => {
            const desc = (note.content || '').replace(/!\[.*?\]\(attachment:[^)]+\)/g, '').substring(0, 100);
            const folderName = note.folderId ? getFolderName(note.folderId) : 'Root';
            return `<div class="search-suggestion-item" data-note-id="${note.id}">
                <div class="suggestion-title">${note.title || 'Untitled'}</div>
                <div class="suggestion-description">${desc}</div>
                <div class="suggestion-folder">${folderName}</div>
            </div>`;
        }).join('');
    }
    container.style.display = 'block';
}

function setupPluginsSearch() {
    var input = document.getElementById('pluginsSearchInput');
    if (!input) return;
    input.addEventListener('input', function() {
        filterPlugins(this.value);
    });
}

function filterPlugins(query) {
    var container = document.getElementById('pluginsContainer');
    if (!container) return;
    var items = container.querySelectorAll('.plugin-item');
    var q = (query || '').toLowerCase().trim();
    var visible = 0;
    items.forEach(function(item) {
        var nameEl = item.querySelector('.plugin-name');
        var name = nameEl ? nameEl.textContent.toLowerCase() : '';
        var match = !q || name.indexOf(q) !== -1;
        item.style.display = match ? 'flex' : 'none';
        if (match) visible++;
    });
    var empty = document.getElementById('pluginsEmptyState');
    if (empty && items.length > 0) {
        if (visible === 0) {
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
        }
    }
}

var editorSearchIndex = 0;
var editorSearchMatches = [];

function toggleEditorSearch() {
    var bar = document.getElementById('editorSearchBar');
    var input = document.getElementById('editorSearchInput');
    if (bar.style.display === 'flex') {
        bar.style.display = 'none';
        clearEditorSearchHighlights();
    } else {
        bar.style.display = 'flex';
        input.focus();
        input.value = '';
        clearEditorSearchHighlights();
        document.getElementById('editorSearchCount').textContent = '';
    }
}

function findInEditor(direction) {
    var textarea = document.getElementById('editorContent');
    var query = document.getElementById('editorSearchInput').value;
    if (!query) return;
    var content = textarea.value;
    editorSearchMatches = [];
    var regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    var match;
    while ((match = regex.exec(content)) !== null) {
        editorSearchMatches.push(match.index);
    }
    var count = editorSearchMatches.length;
    document.getElementById('editorSearchCount').textContent = count ? (editorSearchIndex + 1) + '/' + count : '0/0';
    if (count === 0) return;
    if (direction === 'next') {
        editorSearchIndex = (editorSearchIndex + 1) % count;
    } else {
        editorSearchIndex = (editorSearchIndex - 1 + count) % count;
    }
    var pos = editorSearchMatches[editorSearchIndex];
    textarea.setSelectionRange(pos, pos + query.length);
    textarea.focus({
        preventScroll: true
    });
    var lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    var paddingTop = parseFloat(getComputedStyle(textarea).paddingTop);
    var textBeforeMatch = content.substring(0, pos);
    var lineNumber = (textBeforeMatch.match(/\n/g) || []).length;
    var scrollTarget = lineNumber * lineHeight + paddingTop - textarea.clientHeight / 3;
    textarea.scrollTop = Math.max(0, scrollTarget);
    document.getElementById('noteEditorPage').scrollTop = 0;
}

function clearEditorSearchHighlights() {
    editorSearchIndex = 0;
    editorSearchMatches = [];
    document.getElementById('editorSearchCount').textContent = '';
}

function setupEditorSearch() {
    document.getElementById('editorSearchToggle').addEventListener('click', toggleEditorSearch);
    document.getElementById('editorSearchClose').addEventListener('click', toggleEditorSearch);
    document.getElementById('editorSearchPrev').addEventListener('click', function() {
        findInEditor('prev');
    });
    document.getElementById('editorSearchNext').addEventListener('click', function() {
        findInEditor('next');
    });
    document.getElementById('editorSearchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            findInEditor('next');
        }
        if (e.key === 'Escape') {
            toggleEditorSearch();
        }
    });
}

function fallbackCopy(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (typeof window.showMessage === 'function') window.showMessage('Copied to clipboard');
    } catch (err) {}
    document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof window.showMessage === 'function') window.showMessage('Copied to clipboard');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function resetAllSettings() {
    document.getElementById('popupTitle').textContent = 'Reset All';
    document.getElementById('popupBody').innerHTML = '<p>Reset all notes and folders? This cannot be undone.</p><div class="popup-buttons"><button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button><button class="popup-btn danger" onclick="confirmReset()">Reset</button></div>';
    document.getElementById('universalPopup').style.display = 'flex';
}

async function loadPluginsIfEnabled() {
    var masterEnabled = localStorage.getItem('pluginsEnabled') === 'true';
    document.getElementById('pluginsMasterToggle').checked = masterEnabled;
    if (!masterEnabled) {
        document.getElementById('pluginsList').classList.remove('active');
        return;
    }
    var fileList = [];
    try {
        var resp = await fetch('../files/fetch/plugins/plugins.json');
        if (resp.ok) {
            var jsonList = await resp.json();
            if (Array.isArray(jsonList)) {
                fileList = jsonList;
            }
        }
    } catch (e) {}
    var base = '../files/fetch/plugins/';
    var promises = fileList.map(function(file) {
        return new Promise(function(resolve) {
            var script = document.createElement('script');
            script.src = base + file;
            script.onload = resolve;
            script.onerror = resolve;
            document.head.appendChild(script);
        });
    });
    await Promise.all(promises);
    renderPluginList();
}

function togglePluginsMaster() {
    var masterEnabled = document.getElementById('pluginsMasterToggle').checked;
    localStorage.setItem('pluginsEnabled', masterEnabled);
    if (masterEnabled) {
        document.getElementById('pluginsList').classList.add('active');
        window.showMessage('Plugins enabled. Reload to apply.');
    } else {
        document.getElementById('pluginsList').classList.remove('active');
        window.showMessage('Plugins disabled. Reload to apply.');
    }
}

async function syncPlugins() {
    var icon = document.getElementById('pluginsSyncIcon');
    if (icon) {
        icon.classList.remove('plugins-sync-icon-spin');
        void icon.offsetWidth;
        icon.classList.add('plugins-sync-icon-spin');
    }
    try {
        var resp = await fetch('../files/fetch/plugins/plugins.json?t=' + Date.now());
        if (!resp.ok) throw new Error('not ok');
        var list = await resp.json();
        if (!Array.isArray(list)) throw new Error('bad list');
        window.NotesApp.plugins.list = [];
        var base = '../files/fetch/plugins/';
        var promises = list.map(function(file) {
            return new Promise(function(resolve) {
                var script = document.createElement('script');
                script.src = base + file + '?t=' + Date.now();
                script.onload = resolve;
                script.onerror = resolve;
                document.head.appendChild(script);
            });
        });
        await Promise.all(promises);
        renderPluginList();
        window.showMessage('Plugins synced');
    } catch (e) {
        window.showMessage('Failed to sync plugins');
    }
    setTimeout(function() {
        if (icon) icon.classList.remove('plugins-sync-icon-spin');
    }, 1200);
}

function renderPluginList() {
    var container = document.getElementById('pluginsContainer');
    var plugins = window.NotesApp.plugins.list;
    var empty = document.getElementById('pluginsEmptyState');
    if (plugins.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    container.innerHTML = plugins.map(function(plugin) {
        return '<div class="plugin-item">' +
            '<div class="plugin-info">' +
            '<div class="plugin-name">' + plugin.name + '</div>' +
            '<div class="plugin-desc">' + plugin.description + '</div>' +
            '</div>' +
            '<label class="toggle-switch">' +
            '<input type="checkbox" ' + (plugin.enabled ? 'checked' : '') + ' onchange="togglePlugin(\'' + plugin.name + '\', this.checked)">' +
            '<span class="toggle-slider"></span>' +
            '</label>' +
            '</div>';
    }).join('');
    document.getElementById('pluginsList').classList.add('active');
    var searchInput = document.getElementById('pluginsSearchInput');
    if (searchInput && searchInput.value.trim()) {
        filterPlugins(searchInput.value);
    }
}

function togglePlugin(name, checked) {
    var plugin = window.NotesApp.plugins.list.find(function(p) {
        return p.name === name;
    });
    if (plugin) {
        plugin.enabled = checked;
        window.NotesApp.plugins.saveStates();
        window.showMessage('Plugin ' + (checked ? 'enabled' : 'disabled') + '. Reload to apply.');
    }
}

function setupLongPress(el, onLongPress, onShortPress) {
    let timer = null;
    let triggered = false;

    function start() {
        triggered = false;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            triggered = true;
            onLongPress();
        }, 600);
    }

    function cancel() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    function end() {
        cancel();
        if (!triggered) {
            onShortPress();
        }
    }

    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupReadingBackButton() {
    const btn = document.getElementById('readingBackBtn');
    if (!btn) return;
    setupLongPress(btn, jumpHomeFromReading, goHomeFromReading);
}

function setupPaginationButtons() {
    const prevBtn = document.getElementById('homePrevBtn');
    const nextBtn = document.getElementById('homeNextBtn');
    if (!prevBtn || !nextBtn) return;

    setupLongPress(prevBtn, () => {
        homePage = 0;
        renderHomeNotes();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, () => {
        if (homePage > 0) {
            homePage--;
            renderHomeNotes();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });

    setupLongPress(nextBtn, () => {
        const folderNotes = getCurrentFolderNotes();
        const totalPages = Math.max(1, Math.ceil(folderNotes.length / HOME_PAGE_SIZE));
        homePage = totalPages - 1;
        renderHomeNotes();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, () => {
        const folderNotes = getCurrentFolderNotes();
        const totalPages = Math.max(1, Math.ceil(folderNotes.length / HOME_PAGE_SIZE));
        if (homePage < totalPages - 1) {
            homePage++;
            renderHomeNotes();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    });
}

function setupEventListeners() {
    document.getElementById('backToHome').addEventListener('click', closeNoteEditor);
    document.getElementById('saveNote').addEventListener('click', () => {
        saveCurrentNote();
        window.showMessage('Note saved!');
    });
    document.getElementById('moveNote').addEventListener('click', openFolderWindow);
    document.getElementById('readingModeBtn').addEventListener('click', toggleReadingMode);
    document.getElementById('exportMdBtn').addEventListener('click', exportSingleMd);
    document.getElementById('closeFolderWindow').addEventListener('click', closeFolderWindow);
    document.getElementById('folderWindowOverlay').addEventListener('click', closeFolderWindow);
    document.getElementById('folderWindowSearchInput').addEventListener('input', function() {
        renderFolderWindow(this.value);
    });
    document.getElementById('importMdFiles').addEventListener('change', importMdFilesHandler);
    document.getElementById('importFolder').addEventListener('change', importFolderHandler);
    document.getElementById('homeAddNoteBtn').addEventListener('click', () => {
        createNewNote();
    });
    document.getElementById('homeNewFolderBtn').addEventListener('click', () => {
        openNewFolderPopup();
    });
    document.getElementById('homeSettingsBtn').addEventListener('click', () => {
        closeSidebar();
        switchPage('settings');
    });
    document.getElementById('pluginsSyncBtn').addEventListener('click', syncPlugins);
    document.getElementById('codeRunClose').addEventListener('click', closeCodeRun);
    document.getElementById('codeRunOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'codeRunOverlay') closeCodeRun();
    });
    document.getElementById('homeMobileMenuBtn').addEventListener('click', () => {
        document.getElementById('homeSidebar').classList.toggle('open');
        document.getElementById('sidebarBackdrop').classList.toggle('active');
    });
    document.getElementById('sidebarBackdrop').addEventListener('click', () => {
        document.getElementById('homeSidebar').classList.remove('open');
        document.getElementById('sidebarBackdrop').classList.remove('active');
    });
    document.addEventListener('click', function(e) {
        var link = e.target.closest('.back-link');
        if (!link) return;
        var editorOpen = document.getElementById('noteEditorPage').classList.contains('active');
        var readingOpen = document.getElementById('readingMode').classList.contains('active');
        var popupEl = document.getElementById('universalPopup');
        var popupOpen = popupEl && popupEl.style.display === 'flex';
        if (editorOpen || readingOpen || popupOpen || Date.now() < suppressBackLinkUntil) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('noteEditorPage').classList.contains('active')) closeNoteEditor();
        if (e.key === 'Escape' && document.getElementById('folderWindow').classList.contains('active')) closeFolderWindow();
        if (e.key === 'Escape' && document.getElementById('readingMode').classList.contains('active')) goHomeFromReading();
        if (e.key === 'Escape' && document.getElementById('universalPopup').style.display === 'flex') closeUniversalPopup();
        if (e.key === 'Escape' && document.getElementById('codeRunOverlay').classList.contains('active')) closeCodeRun();
        if (e.key === 'Tab' && document.getElementById('noteEditorPage').classList.contains('active')) {
            e.preventDefault();
            e.shiftKey ? outdent() : indent();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });
    document.getElementById('readingContent').addEventListener('click', async (e) => {
        var button = e.target.closest('.copy-code-btn');
        if (!button) return;
        if (button.querySelector('.fa-play')) return;
        e.preventDefault();
        var wrapper = button.closest('.code-block-wrapper');
        if (!wrapper) return;
        var codeElement = wrapper.querySelector('code') || wrapper.querySelector('pre');
        if (!codeElement) return;
        try {
            await navigator.clipboard.writeText(codeElement.textContent);
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = '<i class="far fa-copy"></i>';
                button.classList.remove('copied');
            }, 1500);
        } catch (err) {}
    });
    var textarea = document.getElementById('editorContent');
    if (textarea) {
        textarea.addEventListener('input', () => {
            undoStack.push(textarea.value);
            if (undoStack.length > 50) undoStack.shift();
            redoStack = [];
            triggerAutoSave();
        });
        textarea.addEventListener('keydown', handleEditorKeyDown);
    }
    setupEditorSearch();
    setupPaginationButtons();
    setupReadingBackButton();
    setupPluginsSearch();
}

async function confirmReset() {
    for (const note of notesData) {
        if (note.attachmentKeys) {
            for (const key of note.attachmentKeys) {
                await dbDelete('attachments', key);
                removeAttachmentName(key);
                revokeAttachmentUrl(key);
            }
        }
    }
    await dbClear('attachments');
    localStorage.removeItem('attachmentNames');
    attachmentUrlCache.forEach((url) => {
        URL.revokeObjectURL(url);
    });
    attachmentUrlCache.clear();
    notesData = [];
    foldersData = [];
    trashNotes = [];
    trashFolders = [];
    saveTrash();
    await saveNotesToStorage();
    await saveFoldersToStorage();
    closeUniversalPopup();
    window.showMessage('All notes deleted!');
}

init().then(function() {
    NotesApp.plugins._appReady = true;
    NotesApp.plugins.initEnabled();
    NotesApp.emit('app:ready');
    switchPage('home');
}).catch(function() {});
