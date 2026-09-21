(function() {
    NotesApp.plugins.register({
        name: 'Trash Bin',
        description: 'View, restore, or permanently delete deleted notes and folders.',
        init(app) {
            let trashActive = false;
            let longPressTimer = null;

            function getTrashNotes() {
                return app.getTrashNotes() || [];
            }

            function getTrashFolders() {
                return app.getTrashFolders() || [];
            }

            function ensureTrashButton() {
                const actionsContainer = document.querySelector('.home-sidebar-actions');
                if (!actionsContainer) return;
                if (document.getElementById('pluginTrashBtn')) return;

                const trashBtn = document.createElement('button');
                trashBtn.className = 'home-trash-btn';
                trashBtn.id = 'pluginTrashBtn';
                trashBtn.setAttribute('aria-label', 'Trash');
                trashBtn.innerHTML = '<i class="fas fa-trash"></i>';

                if (actionsContainer.firstChild) {
                    actionsContainer.insertBefore(trashBtn, actionsContainer.firstChild);
                } else {
                    actionsContainer.appendChild(trashBtn);
                }

                trashBtn.addEventListener('click', showTrashView);
            }

            function closeSidebarSafe() {
                const sidebar = document.getElementById('homeSidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar) sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('active');
            }

            function showTrashView() {
                trashActive = true;
                app.homeView.set(renderTrashView);
                app.clearSearch();
                app.renderHomeFolders();
                app.renderHomeNotes();
                closeSidebarSafe();
            }

            function deactivateTrash() {
                if (!trashActive) return;
                trashActive = false;
                app.homeView.clear();
                const actions = document.getElementById('trashActions');
                if (actions) actions.style.display = 'none';
            }

            function renderTrashView(itemsContainer, folderTitle, folderMeta) {
                if (!trashActive) return false;

                folderTitle.textContent = 'Trash Bin';

                const trashNotes = getTrashNotes();
                const trashFolders = getTrashFolders();
                const total = trashNotes.length + trashFolders.length;

                folderMeta.textContent = total > 0 ? `${total} item${total > 1 ? 's' : ''}` : 'Empty';

                const actions = document.getElementById('trashActions');
                if (actions) actions.style.display = total > 0 ? 'flex' : 'none';

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
                    const handler = (e) => {
                        e.preventDefault();
                        const x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) || 0;
                        const y = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) || 0;
                        showTrashContextMenu(x, y, () => restoreNote(noteId));
                    };
                    el.addEventListener('contextmenu', handler);
                    el.addEventListener('touchstart', (e) => {
                        longPressTimer = setTimeout(() => handler(e), 600);
                    });
                    el.addEventListener('touchend', () => clearTimeout(longPressTimer));
                    el.addEventListener('touchmove', () => clearTimeout(longPressTimer));
                });

                itemsContainer.querySelectorAll('[data-trash-folder-id]').forEach(el => {
                    const folderId = Number(el.getAttribute('data-trash-folder-id'));
                    const handler = (e) => {
                        e.preventDefault();
                        const x = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX) || 0;
                        const y = (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY) || 0;
                        showTrashContextMenu(x, y, () => restoreFolder(folderId));
                    };
                    el.addEventListener('contextmenu', handler);
                    el.addEventListener('touchstart', (e) => {
                        longPressTimer = setTimeout(() => handler(e), 600);
                    });
                    el.addEventListener('touchend', () => clearTimeout(longPressTimer));
                    el.addEventListener('touchmove', () => clearTimeout(longPressTimer));
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
                const trashNotes = getTrashNotes();
                const note = trashNotes.find(n => n.id === noteId);
                if (!note) return;

                const folders = app.getFolders();
                const originalFolderId = note.folderId;
                const folderExists = originalFolderId === null || folders.some(f => f.id === originalFolderId);

                const restored = Object.assign({}, note);
                delete restored.deletedAt;
                if (!folderExists) restored.folderId = null;

                const notes = app.getNotes();
                notes.unshift(restored);

                const newTrashNotes = trashNotes.filter(n => n.id !== noteId);
                app.setTrash(newTrashNotes, getTrashFolders());
                app.saveNotes();
                app.renderHomeNotes();
                app.showMessage('Note restored');
            }

            function restoreFolder(folderId) {
                const trashFolders = getTrashFolders();
                const folder = trashFolders.find(f => f.id === folderId);
                if (!folder) return;

                const folders = app.getFolders();
                const originalParentId = folder.parentId;
                const parentExists = originalParentId === null || folders.some(f => f.id === originalParentId);

                const restored = Object.assign({}, folder);
                delete restored.deletedAt;
                if (!parentExists) restored.parentId = null;

                folders.unshift(restored);

                const newTrashFolders = trashFolders.filter(f => f.id !== folderId);
                app.setTrash(getTrashNotes(), newTrashFolders);
                app.saveFolders();
                app.renderHomeNotes();
                app.showMessage('Folder restored');
            }

            function clearAllTrash() {
                const trashNotes = getTrashNotes();
                const trashFolders = getTrashFolders();
                if (trashNotes.length === 0 && trashFolders.length === 0) return;

                app.setTrash([], []);
                app.renderHomeNotes();
                app.showMessage('Trash cleared');
            }

            function restoreAllTrash() {
                const trashNotes = getTrashNotes();
                const trashFolders = getTrashFolders();
                if (trashNotes.length === 0 && trashFolders.length === 0) return;

                const notes = app.getNotes();
                const folders = app.getFolders();

                trashNotes.forEach(note => {
                    const originalFolderId = note.folderId;
                    const folderExists = originalFolderId === null || folders.some(f => f.id === originalFolderId);
                    const restored = Object.assign({}, note);
                    delete restored.deletedAt;
                    if (!folderExists) restored.folderId = null;
                    notes.unshift(restored);
                });

                trashFolders.forEach(folder => {
                    const originalParentId = folder.parentId;
                    const parentExists = originalParentId === null || folders.some(f => f.id === originalParentId);
                    const restored = Object.assign({}, folder);
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

            function confirmTrashAction(title, message, confirmLabel, onConfirm) {
                document.getElementById('popupTitle').textContent = title;
                document.getElementById('popupBody').innerHTML = '<p>' + message + '</p><div class="popup-buttons"><button class="popup-btn secondary" id="trashConfirmCancel">Cancel</button><button class="popup-btn danger" id="trashConfirmOk">' + confirmLabel + '</button></div>';
                document.getElementById('universalPopup').style.display = 'flex';
                document.getElementById('trashConfirmCancel').addEventListener('click', function() {
                    closeUniversalPopup();
                });
                document.getElementById('trashConfirmOk').addEventListener('click', function() {
                    closeUniversalPopup();
                    onConfirm();
                });
            }

            app.on('home:navigate', () => {
                deactivateTrash();
            });

            const clearBtn = document.getElementById('trashClearAllBtn');
            const restoreBtn = document.getElementById('trashRestoreAllBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    confirmTrashAction('Clear All Trash', 'Permanently delete all items in the trash? This cannot be undone.', 'Clear All', clearAllTrash);
                });
            }
            if (restoreBtn) {
                restoreBtn.addEventListener('click', function() {
                    confirmTrashAction('Restore All', 'Restore all items from the trash?', 'Restore All', restoreAllTrash);
                });
            }

            ensureTrashButton();
            app.on('app:ready', ensureTrashButton);
        }
    });
})();
