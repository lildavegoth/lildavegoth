(function() {
    NotesApp.plugins.register({
        name: 'Trash Bin',
        description: 'View, restore, or permanently delete deleted notes and folders.',
        init(app) {
            let trashActive = false;

            function ensureTrashButton() {
                const actionsContainer = document.querySelector('.home-sidebar-actions');
                if (!actionsContainer) return;
                if (document.getElementById('pluginTrashBtn')) return;

                const trashBtn = document.createElement('button');
                trashBtn.className = 'home-trash-btn';
                trashBtn.id = 'pluginTrashBtn';
                trashBtn.setAttribute('aria-label', 'Trash');
                trashBtn.innerHTML = '<i class="fas fa-trash"></i>';

                const settingsBtn = actionsContainer.querySelector('.home-settings-btn');
                if (settingsBtn) {
                    actionsContainer.insertBefore(trashBtn, settingsBtn);
                } else {
                    actionsContainer.appendChild(trashBtn);
                }

                trashBtn.addEventListener('click', showTrashView);
            }

            function showTrashView() {
                trashActive = true;
                app.homeView.set(renderTrashView);
                app.clearSearch();
                app.renderHomeFolders();
                app.renderHomeNotes();
                closeSidebarSafe();
            }

            function closeSidebarSafe() {
                const sidebar = document.getElementById('homeSidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar) sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('active');
            }

            function getTrashActions() {
                return document.getElementById('trashActions');
            }

            function getTrashItems() {
                const trashNotes = app.getTrashNotes();
                const trashFolders = app.getTrashFolders();
                return {
                    trashNotes,
                    trashFolders,
                    total: trashNotes.length + trashFolders.length
                };
            }

            function renderTrashView(itemsContainer, folderTitle, folderMeta) {
                if (!trashActive) return false;

                folderTitle.textContent = 'Trash Bin';

                const trashActions = getTrashActions();
                const {
                    trashNotes,
                    trashFolders,
                    total
                } = getTrashItems();

                folderMeta.textContent = total > 0 ? `${total} item${total > 1 ? 's' : ''}` : 'Empty';

                if (trashActions) {
                    trashActions.style.display = total > 0 ? 'flex' : 'none';
                }

                if (total === 0) {
                    itemsContainer.innerHTML = '<div class="home-empty-folder"><i class="fas fa-trash"></i><div>Trash is empty.</div></div>';
                    app.fadeElement(itemsContainer);
                    return true;
                }

                let html = '';

                trashFolders.forEach(folder => {
                    html += `<div class="home-note-item" data-trash-folder-id="${folder.id}">
                        <div class="home-note-title"><i class="fas fa-folder" style="color:var(--accent-color);margin-right:8px;"></i>${folder.name}</div>
                        <div class="home-note-preview">Folder</div>
                    </div>`;
                });

                trashNotes.forEach(note => {
                    let preview = note.content || 'No content';
                    preview = preview.replace(/!\[.*?\]\(attachment:[^)]+\)/g, '');
                    if (preview.length > 200) preview = preview.substring(0, 200) + '...';
                    html += `<div class="home-note-item" data-trash-note-id="${note.id}">
                        <div class="home-note-title">${note.title || 'Untitled'}</div>
                        <div class="home-note-preview">${preview}</div>
                    </div>`;
                });

                itemsContainer.innerHTML = html;

                itemsContainer.querySelectorAll('[data-trash-note-id]').forEach(el => {
                    const noteId = Number(el.getAttribute('data-trash-note-id'));
                    el.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        showTrashContextMenu(e.clientX, e.clientY, () => restoreNote(noteId));
                    });
                    let timer = null;
                    el.addEventListener('touchstart', (e) => {
                        timer = setTimeout(() => {
                            e.preventDefault();
                            showTrashContextMenu(e.touches[0].clientX, e.touches[0].clientY, () => restoreNote(noteId));
                        }, 600);
                    });
                    el.addEventListener('touchend', () => {
                        if (timer) clearTimeout(timer);
                    });
                    el.addEventListener('touchmove', () => {
                        if (timer) clearTimeout(timer);
                    });
                });

                itemsContainer.querySelectorAll('[data-trash-folder-id]').forEach(el => {
                    const folderId = Number(el.getAttribute('data-trash-folder-id'));
                    el.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        showTrashContextMenu(e.clientX, e.clientY, () => restoreFolder(folderId));
                    });
                    let timer = null;
                    el.addEventListener('touchstart', (e) => {
                        timer = setTimeout(() => {
                            e.preventDefault();
                            showTrashContextMenu(e.touches[0].clientX, e.touches[0].clientY, () => restoreFolder(folderId));
                        }, 600);
                    });
                    el.addEventListener('touchend', () => {
                        if (timer) clearTimeout(timer);
                    });
                    el.addEventListener('touchmove', () => {
                        if (timer) clearTimeout(timer);
                    });
                });

                app.fadeElement(itemsContainer);
                return true;
            }

            function showTrashContextMenu(x, y, onRestore) {
                const menu = document.createElement('div');
                menu.style.cssText = 'position:fixed; z-index:1000001; background:#1c1c1c; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:8px 0; min-width:160px;';
                menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
                menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';

                const btn = document.createElement('button');
                btn.style.cssText = 'display:flex; align-items:center; gap:10px; width:100%; padding:10px 16px; background:transparent; border:none; color:var(--text-primary); cursor:pointer; font-size:14px; text-align:left;';
                btn.innerHTML = '<i class="fas fa-undo"></i> Restore';
                btn.addEventListener('click', () => {
                    document.body.removeChild(menu);
                    onRestore();
                });
                menu.appendChild(btn);

                document.body.appendChild(menu);
                document.addEventListener('click', function handler(e) {
                    if (!menu.contains(e.target)) {
                        document.body.removeChild(menu);
                        document.removeEventListener('click', handler);
                    }
                });
            }

            function restoreNote(noteId) {
                const trashNotes = app.getTrashNotes();
                const note = trashNotes.find(n => n.id === noteId);
                if (!note) return;

                const folders = app.getFolders();
                const originalFolderId = note.folderId;
                const folderExists = originalFolderId === null || folders.some(f => f.id === originalFolderId);

                const restored = { ...note };
                delete restored.deletedAt;
                if (!folderExists) restored.folderId = null;

                const notes = app.getNotes();
                notes.unshift(restored);

                const newTrashNotes = trashNotes.filter(n => n.id !== noteId);
                app.setTrash(newTrashNotes, app.getTrashFolders());
                app.saveNotes();
                app.renderHomeNotes();
                app.showMessage('Note restored');
            }

            function restoreFolder(folderId) {
                const trashFolders = app.getTrashFolders();
                const folder = trashFolders.find(f => f.id === folderId);
                if (!folder) return;

                const folders = app.getFolders();
                const originalParentId = folder.parentId;
                const parentExists = originalParentId === null || folders.some(f => f.id === originalParentId);

                const restored = { ...folder };
                delete restored.deletedAt;
                if (!parentExists) restored.parentId = null;

                folders.unshift(restored);

                const newTrashFolders = trashFolders.filter(f => f.id !== folderId);
                app.setTrash(app.getTrashNotes(), newTrashFolders);
                app.saveFolders();
                app.renderHomeNotes();
                app.showMessage('Folder restored');
            }

            function clearAllTrash() {
                const {
                    total
                } = getTrashItems();
                if (total === 0) return;

                app.setTrash([], []);
                app.renderHomeNotes();
                app.showMessage('Trash cleared');
            }

            function restoreAllTrash() {
                const trashNotes = app.getTrashNotes();
                const trashFolders = app.getTrashFolders();
                if (trashNotes.length === 0 && trashFolders.length === 0) return;

                const notes = app.getNotes();
                const folders = app.getFolders();

                trashNotes.forEach(note => {
                    const originalFolderId = note.folderId;
                    const folderExists = originalFolderId === null || folders.some(f => f.id === originalFolderId);
                    const restored = { ...note };
                    delete restored.deletedAt;
                    if (!folderExists) restored.folderId = null;
                    notes.unshift(restored);
                });

                trashFolders.forEach(folder => {
                    const originalParentId = folder.parentId;
                    const parentExists = originalParentId === null || folders.some(f => f.id === originalParentId);
                    const restored = { ...folder };
                    delete restored.deletedAt;
                    if (!parentExists) restored.parentId = null;
                    folders.unshift(restored);
                });

                app.setTrash([], []);
                app.saveNotes();
                app.saveFolders();
                app.renderHomeNotes();
                app.showMessage('All items restored');
            }

            app.on('home:navigate', () => {
                if (trashActive) {
                    trashActive = false;
                    app.homeView.clear();
                    const trashActions = getTrashActions();
                    if (trashActions) trashActions.style.display = 'none';
                }
            });

            ensureTrashButton();

            const clearBtn = document.getElementById('trashClearAllBtn');
            const restoreBtn = document.getElementById('trashRestoreAllBtn');
            if (clearBtn) clearBtn.addEventListener('click', clearAllTrash);
            if (restoreBtn) restoreBtn.addEventListener('click', restoreAllTrash);

            app.on('app:ready', () => {
                ensureTrashButton();
            });
        }
    });
})();
