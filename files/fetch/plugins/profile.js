(function() {
    var STORAGE_KEY = 'profileNotes';
    var overlayEl = null;

    function getProfileData() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function saveProfileData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function getProfilePhoto() {
        return localStorage.getItem('profilePhoto') || '';
    }

    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser') || '{}');
        } catch (e) {
            return {};
        }
    }

    function calculateNotesSize() {
        var notes = window.NotesApp.getNotes() || [];
        var totalBytes = 0;
        notes.forEach(function(note) {
            var content = note.content || '';
            var title = note.title || '';
            totalBytes += (content.length + title.length) * 2;
        });
        return totalBytes;
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function countEnabledPlugins() {
        var plugins = window.NotesApp.plugins.list || [];
        var count = 0;
        plugins.forEach(function(p) {
            if (p.enabled) count++;
        });
        return count;
    }

    function formatDateTime(iso) {
        if (!iso || iso === 'N/A') return 'N/A';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return 'N/A';
        var date = d.toLocaleDateString();
        var time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date + ' ' + time;
    }

    function injectStyles() {
        if (document.getElementById('profilePluginStyles')) return;
        var style = document.createElement('style');
        style.id = 'profilePluginStyles';
        style.textContent =
            '.home-profile-btn{width:40px;height:40px;border-radius:var(--radius-small);background:#202020;color:#ffffff;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;margin-right:auto;}' +
            '.home-profile-btn:hover{background:#2a2a2a;}' +
            '.profile-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg-black);z-index:1000002;display:none;flex-direction:column;overflow-y:auto;}' +
            '.profile-overlay.active{display:flex;}' +
            '.profile-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:transparent;border-bottom:none;position:sticky;top:0;z-index:10;}' +
            '.profile-title{color:var(--text-primary);font-weight:600;font-size:1.1rem;}' +
            '.profile-close{width:36px;height:36px;border-radius:50%;background:transparent;border:none;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.1rem;}' +
            '.profile-close:hover{background:rgba(255,255,255,0.08);color:var(--text-primary);}' +
            '.profile-body{max-width:800px;width:100%;margin:0 auto;padding:20px;box-sizing:border-box;}' +
            '.profile-top{display:flex;flex-direction:column;align-items:center;padding:20px 0 30px;}' +
            '.profile-avatar{width:120px;height:120px;border-radius:50%;background:var(--bg-card);border:2px solid var(--accent-color);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:3rem;color:var(--text-secondary);margin-bottom:14px;}' +
            '.profile-avatar img{width:100%;height:100%;object-fit:cover;display:block;}' +
            '.profile-username{font-size:1.4rem;font-weight:700;color:var(--text-primary);margin-bottom:4px;}' +
            '.profile-section{margin-bottom:20px;}' +
            '.profile-section-title{font-size:0.85rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;padding:0 4px;}' +
            '.profile-card{background:var(--bg-card);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-medium);padding:16px;}' +
            '.profile-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);gap:12px;}' +
            '.profile-row:last-child{border-bottom:none;padding-bottom:0;}' +
            '.profile-row:first-child{padding-top:0;}' +
            '.profile-label{color:var(--text-secondary);font-size:0.9rem;flex-shrink:0;}' +
            '.profile-value{color:var(--text-primary);font-size:0.95rem;font-weight:500;text-align:right;word-break:break-word;}' +
            '.profile-value.editable{cursor:pointer;color:var(--accent-color);}' +
            '.profile-value.editable:hover{text-decoration:underline;}' +
            '.profile-overlay::-webkit-scrollbar{display:none;}' +
            '.profile-overlay{-ms-overflow-style:none;scrollbar-width:none;}';
        document.head.appendChild(style);
    }

    function buildOverlay() {
        if (overlayEl) return;
        injectStyles();
        overlayEl = document.createElement('div');
        overlayEl.className = 'profile-overlay';
        overlayEl.id = 'profileOverlay';
        overlayEl.innerHTML =
            '<div class="profile-header">' +
            '<span class="profile-title">Profile</span>' +
            '<button class="profile-close" id="profileClose"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="profile-body" id="profileBody"></div>';
        document.body.appendChild(overlayEl);
        overlayEl.querySelector('#profileClose').addEventListener('click', closeProfile);
    }

    function renderProfile() {
        var body = document.getElementById('profileBody');
        if (!body) return;

        var data = getProfileData();
        var user = getCurrentUser();
        var username = user.username || 'Unknown';
        var photo = getProfilePhoto();
        var notesCount = (window.NotesApp.getNotes() || []).length;
        var notesSize = calculateNotesSize();
        var enabledPlugins = countEnabledPlugins();
        var firstUse = data.firstUse || '';
        var lastBackup = data.lastBackup || '';
        var gender = data.gender || '';
        var age = data.age || '';

        var avatarHTML = photo ?
            '<img src="' + photo + '" alt="Profile">' :
            '<i class="fas fa-user"></i>';

        body.innerHTML =
            '<div class="profile-top">' +
            '<div class="profile-avatar">' + avatarHTML + '</div>' +
            '<div class="profile-username">' + username + '</div>' +
            '</div>' +

            '<div class="profile-section">' +
            '<div class="profile-section-title">Notes Statistics</div>' +
            '<div class="profile-card">' +
            '<div class="profile-row"><span class="profile-label">Total Notes</span><span class="profile-value">' + notesCount + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Total Size</span><span class="profile-value">' + formatBytes(notesSize) + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">First Used</span><span class="profile-value">' + formatDateTime(firstUse) + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Plugins Enabled</span><span class="profile-value">' + enabledPlugins + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Last Backup</span><span class="profile-value">' + formatDateTime(lastBackup) + '</span></div>' +
            '</div>' +
            '</div>' +

            '<div class="profile-section">' +
            '<div class="profile-section-title">Personal Info</div>' +
            '<div class="profile-card">' +
            '<div class="profile-row"><span class="profile-label">Gender</span><span class="profile-value editable" id="profileGender">' + (gender || 'Not set') + '</span></div>' +
            '<div class="profile-row"><span class="profile-label">Age</span><span class="profile-value editable" id="profileAge">' + (age || 'Not set') + '</span></div>' +
            '</div>' +
            '</div>';

        body.querySelector('#profileGender').addEventListener('click', openGenderPopup);
        body.querySelector('#profileAge').addEventListener('click', openAgePopup);
    }

    function openGenderPopup() {
        var data = getProfileData();
        var current = data.gender || '';
        var options = ['Male', 'Female', 'Other', 'Prefer not to say'];

        var body = document.getElementById('popupBody');
        document.getElementById('popupTitle').textContent = 'Select Gender';
        body.innerHTML = '';

        options.forEach(function(opt) {
            var btn = document.createElement('button');
            btn.className = 'popup-btn secondary';
            btn.style.cssText = 'width:100%;margin-bottom:8px;text-align:left;' +
                (current === opt ? 'background:rgba(193,252,50,0.15);color:var(--accent-color);' : '');
            btn.textContent = opt;
            btn.addEventListener('click', function() {
                var d = getProfileData();
                d.gender = opt;
                saveProfileData(d);
                closeUniversalPopup();
                renderProfile();
            });
            body.appendChild(btn);
        });

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'popup-btn secondary';
        cancelBtn.style.cssText = 'width:100%;margin-top:8px;';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', closeUniversalPopup);
        body.appendChild(cancelBtn);

        document.getElementById('universalPopup').style.display = 'flex';
    }

    function openAgePopup() {
        var data = getProfileData();
        var current = data.age || '';

        document.getElementById('popupTitle').textContent = 'Enter Age';
        document.getElementById('popupBody').innerHTML =
            '<input type="number" id="profileAgeInput" class="popup-input" placeholder="Enter your age" min="1" max="150" value="' + current + '">' +
            '<div class="popup-buttons">' +
            '<button class="popup-btn secondary" onclick="closeUniversalPopup()">Cancel</button>' +
            '<button class="popup-btn primary" id="profileAgeSave">Save</button>' +
            '</div>';
        document.getElementById('universalPopup').style.display = 'flex';

        document.getElementById('profileAgeSave').addEventListener('click', function() {
            var val = document.getElementById('profileAgeInput').value.trim();
            var d = getProfileData();
            d.age = val;
            saveProfileData(d);
            closeUniversalPopup();
            renderProfile();
        });
    }

    function openProfile() {
        buildOverlay();
        var data = getProfileData();
        if (!data.firstUse) {
            data.firstUse = new Date().toISOString();
            saveProfileData(data);
        }
        renderProfile();
        overlayEl.classList.add('active');
    }

    function closeProfile() {
        if (overlayEl) overlayEl.classList.remove('active');
    }

    function injectSidebarButton() {
        var actions = document.querySelector('.home-sidebar-actions');
        if (!actions) return;
        if (document.getElementById('homeProfileBtn')) return;

        injectStyles();

        var btn = document.createElement('button');
        btn.className = 'home-profile-btn';
        btn.id = 'homeProfileBtn';
        btn.setAttribute('aria-label', 'Profile');
        btn.innerHTML = '<i class="fas fa-user"></i>';
        btn.addEventListener('click', openProfile);

        actions.insertBefore(btn, actions.firstChild);
    }

    function recordBackup() {
        var data = getProfileData();
        data.lastBackup = new Date().toISOString();
        saveProfileData(data);
    }

    function wrapExports() {
        if (window.__profilePluginWrapped) return;
        window.__profilePluginWrapped = true;

        var originalExportAll = window.exportAllMd;
        if (typeof originalExportAll === 'function') {
            window.exportAllMd = function() {
                recordBackup();
                return originalExportAll.apply(this, arguments);
            };
        }

        var originalExportZip = window.exportFolderAsZip;
        if (typeof originalExportZip === 'function') {
            window.exportFolderAsZip = function() {
                recordBackup();
                return originalExportZip.apply(this, arguments);
            };
        }
    }

    function wrapTogglePlugin() {
        if (window.__profileToggleWrapped) return;
        window.__profileToggleWrapped = true;

        var originalToggle = window.togglePlugin;
        if (typeof originalToggle !== 'function') return;

        window.togglePlugin = function(name, checked) {
            if (name === 'Profile' && !checked) {
                document.getElementById('popupTitle').textContent = 'Disable Profile';
                document.getElementById('popupBody').innerHTML =
                    '<p>Disabling Profile will erase all your profile data (gender, age, first use date, and backup history). Continue?</p>' +
                    '<div class="popup-buttons">' +
                    '<button class="popup-btn secondary" id="profileDisableCancel">Cancel</button>' +
                    '<button class="popup-btn danger" id="profileDisableConfirm">Disable</button>' +
                    '</div>';
                document.getElementById('universalPopup').style.display = 'flex';

                document.getElementById('profileDisableCancel').addEventListener('click', function() {
                    closeUniversalPopup();
                    renderPluginList();
                });

                document.getElementById('profileDisableConfirm').addEventListener('click', function() {
                    localStorage.removeItem(STORAGE_KEY);
                    closeUniversalPopup();
                    originalToggle.apply(window, [name, checked]);
                });
                return;
            }
            return originalToggle.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Profile',
        description: 'View your profile, notes stats, and personal info.',
        version: '1.0',
        init: function(app) {
            injectStyles();
            buildOverlay();
            wrapExports();
            wrapTogglePlugin();
            injectSidebarButton();
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
