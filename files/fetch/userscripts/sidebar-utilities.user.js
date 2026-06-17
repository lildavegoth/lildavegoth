// ==UserScript==
// @name         Sidebar Utilities
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Sidebar with utilities to make browsing more easier in mobile. This Sidebar Utilities included: Hard Refresh, Scroll to Top and Down, Clear Cookies & Data and Image Grabber. Double click the sidebar to open the Tools.
// @author       lildavegoth
// @match        *://*/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'sidebar_utilities_settings';
    const DEFAULT_SETTINGS = {
        side: 'left',
        tools: {
            hardRefresh: true,
            scrollTop: true,
            scrollBottom: true,
            clearCookies: true,
            imageGrabber: true
        }
    };

    let currentSettings = { ...DEFAULT_SETTINGS };
    let sidebar = null;
    let buttonPanel = null;
    let isPanelVisible = false;
    let settingsPopup = null;
    let overlay = null;

    function loadSettings() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                currentSettings = {
                    ...DEFAULT_SETTINGS,
                    ...parsed,
                    tools: { ...DEFAULT_SETTINGS.tools, ...parsed.tools }
                };
            } catch (e) {}
        }
    }

    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    }

    function addFontAwesome() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
        document.head.appendChild(link);
    }

    function addPopupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --bg-card: #1a1a1a;
                --radius-large: 20px;
                --spacing-md: 15px;
                --text-secondary: #aaa;
            }
            .popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999999;
                animation: fadeIn 0.3s ease;
            }
            .popup-content {
                background: var(--bg-card);
                border-radius: var(--radius-large);
                width: 90%;
                max-width: 500px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                max-height: 70vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .popup-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .popup-header h2 {
                font-size: 1.5rem;
                font-weight: 600;
                color: white;
                margin: 0;
            }
            .close-popup {
                background: transparent;
                border: none;
                color: var(--text-secondary);
                font-size: 1.2rem;
                cursor: pointer;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .close-popup:hover {
                background: rgba(255,255,255,0.1);
            }
            .popup-grid {
                padding: var(--spacing-md);
                overflow-y: auto;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 12px;
            }
            .image-item {
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 8px;
                text-align: center;
            }
            .image-item img {
                width: 100%;
                height: 80px;
                object-fit: cover;
                border-radius: 8px;
                margin-bottom: 8px;
            }
            .image-item button {
                background: #C1FC32;
                border: none;
                padding: 6px 10px;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                width: 100%;
                font-weight: bold;
            }
            .settings-section {
                padding: var(--spacing-md);
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .settings-section h3 {
                color: white;
                margin: 0 0 10px 0;
                font-size: 1rem;
            }
            .settings-option {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                color: white;
            }
            .settings-option label {
                cursor: pointer;
            }
            .toggle-group {
                display: flex;
                gap: 10px;
            }
            .toggle-btn {
                background: #333;
                border: none;
                padding: 6px 12px;
                border-radius: 20px;
                color: white;
                cursor: pointer;
            }
            .toggle-btn.active {
                background: #C1FC32;
                color: black;
            }
            .custom-checkbox {
                cursor: pointer;
                font-size: 1.4rem;
                width: 28px;
                text-align: center;
            }
            .custom-checkbox i {
                color: #C1FC32;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        const div = document.createElement('div');
        div.id = 'sidebar-overlay';
        div.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999998;
            display: none;
            cursor: pointer;
        `;
        div.addEventListener('click', () => {
            hidePanel();
        });
        document.body.appendChild(div);
        return div;
    }

    function createImagePopup() {
        const popup = document.createElement('div');
        popup.id = 'image-grabber-popup';
        popup.className = 'popup-overlay';
        popup.style.display = 'none';
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-header">
                    <h2>Images on Page</h2>
                    <button class="close-popup"><i class="fas fa-times"></i></button>
                </div>
                <div class="popup-grid" id="popupGrid"></div>
            </div>
        `;
        document.body.appendChild(popup);
        const closeBtn = popup.querySelector('.close-popup');
        closeBtn.addEventListener('click', () => {
            popup.style.display = 'none';
        });
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.style.display = 'none';
        });
        return popup;
    }

    function showImagePopup() {
        const popup = document.getElementById('image-grabber-popup');
        const grid = document.getElementById('popupGrid');
        if (!popup || !grid) return;
        const images = Array.from(document.images);
        const uniqueSrcs = new Map();
        images.forEach(img => {
            const src = img.src;
            if (src && src.startsWith('http') && !uniqueSrcs.has(src)) {
                uniqueSrcs.set(src, img.alt || 'image');
            }
        });
        if (uniqueSrcs.size === 0) {
            alert('No images found on this page');
            return;
        }
        grid.innerHTML = '';
        for (let [src, alt] of uniqueSrcs.entries()) {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.innerHTML = `
                <img src="${src}" alt="${alt}" loading="lazy">
                <button data-src="${src}"><i class="fas fa-download"></i> Download</button>
            `;
            const btn = item.querySelector('button');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = src;
                a.download = src.split('/').pop() || 'image.jpg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
            grid.appendChild(item);
        }
        popup.style.display = 'flex';
    }

    function clearSiteData() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
        }
        localStorage.clear();
        sessionStorage.clear();
        window.history.back();
    }

    function updateSidebarHandlePosition() {
        if (!sidebar) return;
        if (currentSettings.side === 'left') {
            sidebar.style.left = '10px';
            sidebar.style.right = 'auto';
        } else {
            sidebar.style.left = 'auto';
            sidebar.style.right = '10px';
        }
    }

    function getPanelOffscreenPosition() {
        if (currentSettings.side === 'left') {
            return { left: '-100px', right: 'auto' };
        } else {
            return { left: 'auto', right: '-100px' };
        }
    }

    function getPanelVisiblePosition() {
        if (currentSettings.side === 'left') {
            return { left: '20px', right: 'auto' };
        } else {
            return { left: 'auto', right: '20px' };
        }
    }

    function hidePanel() {
        if (!isPanelVisible || !buttonPanel) return;
        const offscreen = getPanelOffscreenPosition();
        buttonPanel.style.left = offscreen.left;
        buttonPanel.style.right = offscreen.right;
        isPanelVisible = false;
        if (sidebar) sidebar.style.display = 'block';
        if (overlay) overlay.style.display = 'none';
    }

    function showPanel() {
        if (isPanelVisible || !buttonPanel) return;
        const visible = getPanelVisiblePosition();
        buttonPanel.style.left = visible.left;
        buttonPanel.style.right = visible.right;
        isPanelVisible = true;
        if (sidebar) sidebar.style.display = 'none';
        if (overlay) overlay.style.display = 'block';
    }

    function rebuildButtonPanel() {
        if (buttonPanel && buttonPanel.parentNode) {
            buttonPanel.parentNode.removeChild(buttonPanel);
        }
        const panel = document.createElement('div');
        panel.id = 'mobile-button-panel';
        const offscreen = getPanelOffscreenPosition();
        panel.style.cssText = `
            position: fixed;
            top: 30%;
            transform: translateY(-50%);
            width: 65px;
            background: black;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 15px 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 7px;
            z-index: 999999;
            transition: left 0.3s ease, right 0.3s ease;
            left: ${offscreen.left};
            right: ${offscreen.right};
        `;
        const isExcludedDomain = window.location.hostname === 'kakoi-kiraku-home.vercel.app';
        const buttons = [];
        if (currentSettings.tools.hardRefresh) {
            buttons.push({ icon: 'fas fa-sync-alt', action: () => location.reload(true) });
        }
        if (currentSettings.tools.scrollTop) {
            buttons.push({ icon: 'fas fa-arrow-up', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) });
        }
        if (currentSettings.tools.scrollBottom) {
            buttons.push({ icon: 'fas fa-arrow-down', action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) });
        }
        if (currentSettings.tools.clearCookies) {
            buttons.push({ icon: 'fas fa-trash-alt', action: clearSiteData });
        }
        if (currentSettings.tools.imageGrabber && !isExcludedDomain) {
            buttons.push({ icon: 'fas fa-images', action: showImagePopup });
        }
        buttons.forEach(item => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                width: 45px;
                height: 45px;
                background: #1a1a1a;
                border: none;
                border-radius: 30px;
                font-size: 18px;
                color: #C1FC32 !important;
                cursor: pointer;
                transition: background 0.2s;
                touch-action: manipulation;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            const icon = document.createElement('i');
            icon.className = item.icon;
            icon.style.cssText = `font-family: 'Font Awesome 6 Free'; font-weight: 900;`;
            btn.appendChild(icon);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                hidePanel();
            });
            panel.appendChild(btn);
        });
        const settingsBtn = document.createElement('button');
        settingsBtn.style.cssText = `
            width: 45px;
            height: 45px;
            background: #1a1a1a;
            border: none;
            border-radius: 30px;
            font-size: 18px;
            color: #C1FC32 !important;
            cursor: pointer;
            touch-action: manipulation;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 5px;
        `;
        const settingsIcon = document.createElement('i');
        settingsIcon.className = 'fas fa-cog';
        settingsIcon.style.cssText = `font-family: 'Font Awesome 6 Free'; font-weight: 900;`;
        settingsBtn.appendChild(settingsIcon);
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSettingsPopup();
        });
        panel.appendChild(settingsBtn);
        document.body.appendChild(panel);
        buttonPanel = panel;
        if (isPanelVisible) {
            const visible = getPanelVisiblePosition();
            buttonPanel.style.left = visible.left;
            buttonPanel.style.right = visible.right;
        } else {
            const off = getPanelOffscreenPosition();
            buttonPanel.style.left = off.left;
            buttonPanel.style.right = off.right;
        }
    }

    function createSidebar() {
        const bar = document.createElement('div');
        bar.id = 'mobile-sidebar';
        bar.style.cssText = `
            position: fixed;
            top: 30%;
            width: 12px;
            height: 8%;
            border-radius: 50px;
            background: rgba(255,255,255,0.4);
            z-index: 999998;
            cursor: pointer;
            pointer-events: auto;
            transform: none;
        `;
        updateSidebarHandlePosition();
        bar.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showPanel();
        });
        return bar;
    }

    function dismissOnOutside(e) {
        if (!isPanelVisible) return;
        if (settingsPopup && settingsPopup.style.display === 'flex') return;
        if (buttonPanel && !buttonPanel.contains(e.target)) {
            hidePanel();
        }
    }

    function openSettingsPopup() {
        if (settingsPopup) {
            settingsPopup.style.display = 'flex';
            updateSettingsPopupUI();
            return;
        }
        const popup = document.createElement('div');
        popup.className = 'popup-overlay';
        popup.style.display = 'flex';
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-header">
                    <h2>Settings</h2>
                    <button class="close-popup"><i class="fas fa-times"></i></button>
                </div>
                <div style="overflow-y: auto;">
                    <div class="settings-section">
                        <h3>Sidebar Position</h3>
                        <div class="settings-option">
                            <span>Move sidebar to:</span>
                            <div class="toggle-group">
                                <button data-side="left" class="toggle-btn">Left</button>
                                <button data-side="right" class="toggle-btn">Right</button>
                            </div>
                        </div>
                    </div>
                    <div class="settings-section">
                        <h3>Tools</h3>
                        <div class="settings-option">
                            <label>Hard Refresh</label>
                            <div class="custom-checkbox" data-tool="hardRefresh"></div>
                        </div>
                        <div class="settings-option">
                            <label>Scroll to Top</label>
                            <div class="custom-checkbox" data-tool="scrollTop"></div>
                        </div>
                        <div class="settings-option">
                            <label>Scroll to Bottom</label>
                            <div class="custom-checkbox" data-tool="scrollBottom"></div>
                        </div>
                        <div class="settings-option">
                            <label>Clear Cookies & Data</label>
                            <div class="custom-checkbox" data-tool="clearCookies"></div>
                        </div>
                        <div class="settings-option">
                            <label>Image Grabber</label>
                            <div class="custom-checkbox" data-tool="imageGrabber"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        settingsPopup = popup;
        const closeBtn = popup.querySelector('.close-popup');
        closeBtn.addEventListener('click', () => {
            popup.style.display = 'none';
        });
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.style.display = 'none';
        });
        const leftBtn = popup.querySelector('[data-side="left"]');
        const rightBtn = popup.querySelector('[data-side="right"]');
        const updateSideButtons = () => {
            if (currentSettings.side === 'left') {
                leftBtn.classList.add('active');
                rightBtn.classList.remove('active');
            } else {
                rightBtn.classList.add('active');
                leftBtn.classList.remove('active');
            }
        };
        leftBtn.addEventListener('click', () => {
            currentSettings.side = 'left';
            saveSettings();
            updateSideButtons();
            updateSidebarHandlePosition();
            rebuildButtonPanel();
            hidePanel();
        });
        rightBtn.addEventListener('click', () => {
            currentSettings.side = 'right';
            saveSettings();
            updateSideButtons();
            updateSidebarHandlePosition();
            rebuildButtonPanel();
            hidePanel();
        });
        const toolCheckboxes = {};
        const toolNames = ['hardRefresh', 'scrollTop', 'scrollBottom', 'clearCookies', 'imageGrabber'];
        toolNames.forEach(tool => {
            const wrapper = popup.querySelector(`.custom-checkbox[data-tool="${tool}"]`);
            if (wrapper) {
                const icon = document.createElement('i');
                wrapper.appendChild(icon);
                toolCheckboxes[tool] = wrapper;
                const updateIcon = () => {
                    if (currentSettings.tools[tool]) {
                        icon.className = 'fas fa-circle';
                    } else {
                        icon.className = 'far fa-circle';
                    }
                };
                updateIcon();
                wrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentSettings.tools[tool] = !currentSettings.tools[tool];
                    saveSettings();
                    updateIcon();
                    rebuildButtonPanel();
                    hidePanel();
                });
            }
        });
        updateSideButtons();
    }

    function updateSettingsPopupUI() {
        if (!settingsPopup) return;
        const leftBtn = settingsPopup.querySelector('[data-side="left"]');
        const rightBtn = settingsPopup.querySelector('[data-side="right"]');
        if (leftBtn && rightBtn) {
            if (currentSettings.side === 'left') {
                leftBtn.classList.add('active');
                rightBtn.classList.remove('active');
            } else {
                rightBtn.classList.add('active');
                leftBtn.classList.remove('active');
            }
        }
        const toolNames = ['hardRefresh', 'scrollTop', 'scrollBottom', 'clearCookies', 'imageGrabber'];
        toolNames.forEach(tool => {
            const wrapper = settingsPopup.querySelector(`.custom-checkbox[data-tool="${tool}"]`);
            if (wrapper && wrapper.firstChild) {
                const icon = wrapper.firstChild;
                if (currentSettings.tools[tool]) {
                    icon.className = 'fas fa-circle';
                } else {
                    icon.className = 'far fa-circle';
                }
            }
        });
    }

    function init() {
        loadSettings();
        addFontAwesome();
        addPopupStyles();
        createImagePopup();
        overlay = createOverlay();
        sidebar = createSidebar();
        document.body.appendChild(sidebar);
        rebuildButtonPanel();
        document.addEventListener('click', dismissOnOutside);
        document.addEventListener('touchstart', dismissOnOutside);
    }

    init();
})();
