(function() {
    'use strict';
    
    const currentHost = window.location.hostname;
    const currentPath = window.location.pathname;
    
    if (currentHost === 'lildavegoth.github.io') {
        const basePath = '/lildavegoth';
        const vercelBase = 'https://kakoi-kiraku-home.vercel.app';
        
        let newPath = currentPath;
        
        if (currentPath.startsWith(basePath)) {
            newPath = currentPath.replace(basePath, '');
        }
        
        if (newPath === '' || newPath === '/') {
            window.location.href = vercelBase + '/';
        } else {
            window.location.href = vercelBase + newPath;
        }
    }
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('./sw.js').then(function() {
            });
        });
    }
    
    (function() {
        let originalStyles = {
            outline: '',
            outlineOffset: '',
            webkitTapHighlightColor: ''
        };
        
        function removeFocusIndicators() {
            if (!originalStyles.outline) {
                originalStyles.outline = document.documentElement.style.outline;
                originalStyles.outlineOffset = document.documentElement.style.outlineOffset;
                originalStyles.webkitTapHighlightColor = document.documentElement.style.webkitTapHighlightColor;
            }
            
            document.documentElement.style.outline = 'none';
            document.documentElement.style.outlineOffset = '0';
            document.documentElement.style.webkitTapHighlightColor = 'transparent';
            
            document.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])').forEach(el => {
                el.style.outline = 'none';
                el.style.outlineOffset = '0';
                el.style.webkitTapHighlightColor = 'transparent';
            });
        }
        
        function restoreFocusIndicators() {
            if (originalStyles.outline) {
                document.documentElement.style.outline = originalStyles.outline;
                document.documentElement.style.outlineOffset = originalStyles.outlineOffset;
                document.documentElement.style.webkitTapHighlightColor = originalStyles.webkitTapHighlightColor;
            }
        }
        
        const focusStyle = document.createElement('style');
        focusStyle.textContent = `
            *:focus, *:focus-visible, *:focus-within {
                outline: none !important;
                outline-offset: 0 !important;
                box-shadow: none !important;
            }
            
            a, button, input, textarea, select {
                -webkit-tap-highlight-color: transparent !important;
                tap-highlight-color: transparent !important;
            }
        `;
        document.head.appendChild(focusStyle);
        
        document.addEventListener('DOMContentLoaded', removeFocusIndicators);
        document.addEventListener('click', function(e) {
            if (e.target.closest('a')) {
                if (document.activeElement) document.activeElement.blur();
                removeFocusIndicators();
            }
        });
        
        window.disableFocusSquare = { remove: removeFocusIndicators, restore: restoreFocusIndicators };
    })();
    
    (function() {
        let protectionEnabled = true;
        let rightClickAttempts = 0;
        const MAX_ATTEMPTS = 3;
        
        const EXCLUDED_CLASSES = [
            'clickable', 'allow-interaction', 'ui-icon', 
            'nav-icon', 'button-icon', 'logo', 'favicon'
        ];
        
        const PROTECTED_FORMATS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?|ico|apng)/i;
        
        const protectionStyle = document.createElement('style');
        protectionStyle.id = 'image-protection-styles';
        protectionStyle.textContent = `
            img.protected {
                -webkit-user-drag: none !important;
                user-drag: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
                pointer-events: none !important;
            }
            
            img.clickable,
            img.allow-interaction,
            img[data-no-protect] {
                pointer-events: auto !important;
            }
            
            @keyframes protectionFlash {
                0% { background-color: transparent; }
                50% { background-color: rgba(255, 0, 0, 0.1); }
                100% { background-color: transparent; }
            }
            
            @keyframes warningSlide {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .protection-flash {
                animation: protectionFlash 0.5s;
            }
            
            .protection-warning {
                animation: warningSlide 0.3s;
            }
        `;
        document.head.appendChild(protectionStyle);
        
        function shouldProtect(img) {
            if (img.hasAttribute('data-protected')) return false;
            
            for (const className of EXCLUDED_CLASSES) {
                if (img.classList.contains(className)) {
                    return false;
                }
            }
            
            if (img.hasAttribute('data-no-protect')) {
                return false;
            }
            
            const src = img.src.toLowerCase();
            if (PROTECTED_FORMATS.test(src) || 
                src.startsWith('data:image/') || 
                src.startsWith('blob:')) {
                return true;
            }
            
            return false;
        }
        
        function protectImage(img) {
            if (!shouldProtect(img)) return;
            
            img.classList.add('protected');
            img.setAttribute('data-protected', 'true');
            
            img.setAttribute('oncontextmenu', 'return false');
            img.setAttribute('ondragstart', 'return false');
            img.setAttribute('onmousedown', 'return false');
        }
        
        function protectAllImages() {
            document.querySelectorAll('img:not([data-protected])').forEach(protectImage);
        }
        
        document.addEventListener('contextmenu', function(e) {
            const target = e.target;
            
            if (target.tagName === 'IMG' && target.classList.contains('protected')) {
                e.preventDefault();
                e.stopPropagation();
                
                rightClickAttempts++;
                
                showRightClickWarning(e);
                
                if (rightClickAttempts >= MAX_ATTEMPTS) {
                    enableStrongProtection();
                }
                
                return false;
            }
        }, true);
        
        document.addEventListener('dragstart', function(e) {
            if (e.target.tagName === 'IMG' && e.target.classList.contains('protected')) {
                e.preventDefault();
                return false;
            }
        }, true);
        
        document.addEventListener('click', function(e) {
            const target = e.target;
            
            if ((e.button === 1 || e.ctrlKey || e.metaKey) && 
                target.tagName === 'IMG' && 
                target.classList.contains('protected')) {
                e.preventDefault();
                if (window.showMessage) {
                    window.showMessage('Content Protected', 'Protected content cannot be opened', 'warning');
                }
                return false;
            }
        }, true);
        
        document.addEventListener('copy', function(e) {
            const selection = window.getSelection();
            const text = selection.toString();
            
            if (text.includes('http') && text.match(PROTECTED_FORMATS)) {
                e.preventDefault();
                if (window.showMessage) {
                    window.showMessage('Content Protected', 'Image URL copying disabled', 'warning');
                }
                return false;
            }
        });
        
        function showRightClickWarning(event) {
            const img = event.target;
            img.classList.add('protection-flash');
            setTimeout(() => img.classList.remove('protection-flash'), 500);
            
            const tooltip = document.createElement('div');
            tooltip.textContent = 'Right-click disabled';
            tooltip.style.cssText = `
                position: fixed;
                top: ${event.clientY + 15}px;
                left: ${event.clientX + 15}px;
                background: rgba(220, 0, 0, 0.9);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000000;
                pointer-events: none;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            
            document.body.appendChild(tooltip);
            setTimeout(() => tooltip.remove(), 1500);
            
            if (rightClickAttempts >= 2) {
                showProtectionAlert();
            }
        }
        
        function showProtectionAlert() {
            const existing = document.querySelector('.protection-alert');
            if (existing) existing.remove();
            
            const alert = document.createElement('div');
            alert.className = 'protection-warning';
            alert.innerHTML = `
                <div style="
                    position: fixed;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #ff3333, #ff6666);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 999999;
                    box-shadow: 0 4px 12px rgba(255,0,0,0.4);
                    font-size: 14px;
                    text-align: center;
                    max-width: 90%;
                ">
                    <strong>⚠️ Content Protected Active</strong><br>
                    <small style="opacity: 0.9;">Content is protected from downloading</small>
                </div>
            `;
            
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 4000);
            
            if (window.showMessage) {
                window.showMessage('Content Protected', 'Image protection is now active', 'warning', '', 'Content is protected from downloading');
            }
        }
        
        function enableStrongProtection() {
            const strongStyle = document.createElement('style');
            strongStyle.textContent = `
                .protected {
                    position: relative;
                }
                
                .protected::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 5px,
                        rgba(255,0,0,0.05) 5px,
                        rgba(255,0,0,0.05) 10px
                    );
                    pointer-events: none;
                    z-index: 1;
                }
            `;
            document.head.appendChild(strongStyle);
            
            setTimeout(() => strongStyle.remove(), 30000);
        }
        
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'IMG') {
                        protectImage(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('img:not([data-protected])').forEach(protectImage);
                    }
                });
            });
        });
        
        function initImageProtection() {
            if (!protectionEnabled) return;
            
            protectAllImages();
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(protectAllImages, 100);
            setTimeout(protectAllImages, 1000);
            setInterval(protectAllImages, 5000);
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initImageProtection);
        } else {
            initImageProtection();
        }
        
        window.imageProtection = {
            enable: function() {
                protectionEnabled = true;
                protectAllImages();
            },
            disable: function() {
                protectionEnabled = false;
                document.querySelectorAll('.protected').forEach(img => {
                    img.classList.remove('protected');
                    img.removeAttribute('data-protected');
                });
            },
            reprotect: protectAllImages
        };
    })();
    
    (function() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                
                document.body.style.backgroundColor = '#ffeded';
                setTimeout(() => {
                    document.body.style.backgroundColor = '';
                }, 200);
                
                if (window.showMessage) {
                    window.showMessage('Security', 'Developer tools are restricted', 'error');
                }
                
                return false;
            }
        });
        
        document.addEventListener('selectstart', function(e) {
            if (e.target.tagName === 'IMG' && e.target.classList.contains('protected')) {
                e.preventDefault();
                return false;
            }
        }, true);
        
        document.addEventListener('beforeunload', function() {
            document.querySelectorAll('img.protected').forEach(img => {
                if (img.src.startsWith('blob:') || img.src.startsWith('data:')) {
                    img.src = '';
                }
            });
        });
    })();
    
    document.addEventListener('DOMContentLoaded', function() {
        const backLink = document.querySelector('.back-link');
        if (backLink) {
            backLink.style.pointerEvents = 'auto';
            
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) {
                    backLink.style.animation = 'none';
                    backLink.style.pointerEvents = 'auto';
                    backLink.style.cursor = 'pointer';
                    
                    setTimeout(function() {
                        backLink.style.animation = '';
                    }, 10);
                }
            });
            
            window.addEventListener('focus', function() {
                backLink.style.pointerEvents = 'auto';
                backLink.style.cursor = 'pointer';
            });
        }
    });
    
    (function() {
        const ACCENT_COLOR_HEX = '#C1FC32';
        
        function rgbToHex(rgb) {
            const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!match) return rgb;
            return '#' + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1).toUpperCase();
        }
        
        function getBackgroundColorHex(element) {
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const bgColor = style.backgroundColor;
            if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
                return getBackgroundColorHex(element.parentElement);
            }
            return rgbToHex(bgColor);
        }
        
        function updateSelectionColor() {
            const selection = window.getSelection();
            let targetColor = ACCENT_COLOR_HEX;
            
            if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const startContainer = range.startContainer;
                let element = startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentElement : startContainer;
                if (element) {
                    const bgHex = getBackgroundColorHex(element);
                    if (bgHex && bgHex.toUpperCase() === ACCENT_COLOR_HEX.toUpperCase()) {
                        targetColor = '#C42833';
                    }
                }
            }
            
            let styleEl = document.getElementById('dynamic-selection-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'dynamic-selection-style';
                document.head.appendChild(styleEl);
            }
            
            styleEl.textContent = `
                ::selection {
                    color: ${targetColor} !important;
                    background: transparent !important;
                }
                ::-moz-selection {
                    color: ${targetColor} !important;
                    background: transparent !important;
                }
            `;
        }
        
        document.addEventListener('selectionchange', updateSelectionColor);
        document.addEventListener('DOMContentLoaded', function() {
            updateSelectionColor();
        });
        
        const staticSelectionStyle = document.createElement('style');
        staticSelectionStyle.textContent = `
            img.protected::selection,
            img.protected::-moz-selection {
                color: transparent !important;
                background: transparent !important;
            }
        `;
        document.head.appendChild(staticSelectionStyle);
    })();
    
    document.addEventListener('DOMContentLoaded', function() {
        const CONFIG = {
            useSpa: true,
            preloadPages: true,
            transitionSpeed: 200,
            cacheSize: 10
        };
        
        let currentPage = '';
        const pageCache = new Map();
        
        function getCurrentPageId() {
            const path = window.location.pathname;
            const page = path.split('/').pop().replace('.html', '') || 'index';
            return page;
        }
        
        function showLoading(show) {
            const loader = document.getElementById('spa-loading') || 
                          (() => {
                              const div = document.createElement('div');
                              div.id = 'spa-loading';
                              div.style.cssText = `
                                  position: fixed;
                                  top: 0;
                                  left: 0;
                                  width: 100%;
                                  height: 3px;
                                  background: linear-gradient(90deg, #007aff, #00c6ff);
                                  z-index: 9999;
                                  display: none;
                                  animation: loading 1s infinite;
                              `;
                              document.body.appendChild(div);
                              
                              const style = document.createElement('style');
                              style.textContent = `
                                  @keyframes loading {
                                      0% { transform: translateX(-100%); }
                                      100% { transform: translateX(100%); }
                                  }
                              `;
                              document.head.appendChild(style);
                              return div;
                          })();
            
            loader.style.display = show ? 'block' : 'none';
        }
        
        function trimCache() {
            if (pageCache.size > CONFIG.cacheSize) {
                const firstKey = pageCache.keys().next().value;
                pageCache.delete(firstKey);
            }
        }
        
        async function preloadLinkedPages() {
            const links = Array.from(document.querySelectorAll('a[href$=".html"]'))
                .map(link => link.getAttribute('href'))
                .filter(href => !href.startsWith('http'))
                .slice(0, CONFIG.cacheSize);
            
            for (const url of links) {
                if (!pageCache.has(url)) {
                    try {
                        const response = await fetch(url);
                        const html = await response.text();
                        pageCache.set(url, html);
                    } catch (e) {}
                }
            }
        }
        
        function initScripts(container) {
            const scripts = container.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                if (oldScript.textContent) {
                    newScript.textContent = oldScript.textContent;
                }
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
            container.dispatchEvent(new Event('pageinit', { bubbles: true }));
        }
        
        function setupSpaNavigation() {
            const originalContent = document.body.innerHTML;
            document.body.innerHTML = `
                <div id="spa-container">
                    <div id="page-${currentPage}" class="spa-page active">
                        ${originalContent}
                    </div>
                </div>
                <div id="spa-loading" style="display:none;">Loading...</div>
            `;
            
            document.addEventListener('click', handleSpaClick);
            window.addEventListener('popstate', handlePopState);
        }
        
        function handleSpaClick(e) {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
                return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            const pageId = href.replace('.html', '').replace('./', '') || 'index';
            loadSpaPage(pageId, href);
        }
        
        async function loadSpaPage(pageId, url) {
            showLoading(true);
            
            try {
                let content;
                if (pageCache.has(pageId)) {
                    content = pageCache.get(pageId);
                } else {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Failed to load');
                    const html = await response.text();
                    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                    content = bodyMatch ? bodyMatch[1] : html;
                    pageCache.set(pageId, content);
                    trimCache();
                }
                
                const newPage = document.createElement('div');
                newPage.id = `page-${pageId}`;
                newPage.className = 'spa-page';
                newPage.innerHTML = content;
                
                const container = document.getElementById('spa-container');
                const oldPage = container.querySelector('.active');
                container.appendChild(newPage);
                
                setTimeout(() => {
                    if (oldPage) oldPage.classList.remove('active');
                    newPage.classList.add('active');
                    window.history.pushState({pageId}, '', url);
                    currentPage = pageId;
                    setTimeout(() => {
                        if (oldPage && oldPage.id !== `page-${pageId}`) {
                            oldPage.remove();
                        }
                        showLoading(false);
                        initScripts(newPage);
                    }, CONFIG.transitionSpeed);
                }, 10);
            } catch (error) {
                showLoading(false);
                window.location.href = url;
            }
        }
        
        function handlePopState(event) {
            if (event.state && event.state.pageId) {
                loadSpaPage(event.state.pageId, `${event.state.pageId}.html`);
            }
        }
        
        function setupFastTraditionalNav() {
            document.addEventListener('click', function(e) {
                const link = e.target.closest('a[href$=".html"]');
                if (!link || link.href.startsWith('http')) return;
                
                const url = link.getAttribute('href');
                if (pageCache.has(url)) {
                    e.preventDefault();
                    showLoading(true);
                    setTimeout(() => {
                        window.location.href = url;
                    }, 50);
                }
            });
            
            if ('connection' in navigator) {
                document.body.classList.add(
                    navigator.connection.saveData ? 'save-data' : 'no-save-data'
                );
            }
        }
        
        function init() {
            currentPage = getCurrentPageId();
            if (CONFIG.useSpa) {
                setupSpaNavigation();
            } else {
                setupFastTraditionalNav();
            }
            if (CONFIG.preloadPages) {
                preloadLinkedPages();
            }
        }
        
        const spaStyles = `
            .spa-page {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                min-height: 100vh;
                opacity: 0;
                transform: translateX(10px);
                transition: opacity ${CONFIG.transitionSpeed}ms ease, 
                            transform ${CONFIG.transitionSpeed}ms ease;
                pointer-events: none;
            }
            .spa-page.active {
                opacity: 1;
                transform: translateX(0);
                position: relative;
                pointer-events: all;
            }
            .save-data .image {
                opacity: 0.8;
                filter: blur(0.5px);
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.textContent = spaStyles;
        document.head.appendChild(styleEl);
        
        window.FastNav = {
            clearCache: () => pageCache.clear(),
            preloadPage: (url) => preloadLinkedPages(),
            navigateTo: (pageId) => loadSpaPage(pageId, `${pageId}.html`)
        };
        
        init();
    })();
    
    document.addEventListener('DOMContentLoaded', function() {
        const scrollbarCSS = document.createElement('style');
        scrollbarCSS.textContent = `
            * {
                scrollbar-width: none !important;
            }
            
            ::-webkit-scrollbar {
                display: none !important;
            }
            
            .has-custom-scroll {
                position: relative;
                overflow: hidden !important;
            }
            
            .scroll-content {
                width: 100%;
                height: 100%;
                overflow: auto;
                padding-right: 12px;
                margin-right: -12px;
            }
            
            .scroll-content::-webkit-scrollbar {
                display: none !important;
            }
            
            .custom-scrollbar {
                position: absolute;
                top: 0;
                right: 0;
                width: 10px;
                height: 100%;
                background: transparent;
                pointer-events: none;
                z-index: 9999;
            }
            
            .custom-scrollbar-track {
                position: absolute;
                top: 2px;
                right: 2px;
                width: 6px;
                height: calc(100% - 4px);
                background: #f1f1f1;
                border-radius: 100px;
            }
            
            .custom-scrollbar-thumb {
                position: absolute;
                top: 0;
                right: 2px;
                width: 6px;
                background: var(--accent-color, #ec4899);
                border-radius: 100px;
                transition: background 0.2s;
                pointer-events: auto;
                cursor: pointer;
            }
            
            .custom-scrollbar-thumb:hover {
                background: var(--accent-hover, #db2777);
            }
        `;
        document.head.appendChild(scrollbarCSS);
        
        function makeRoundedScrollbar(element) {
            if (element.classList.contains('has-custom-scroll')) return;
            if (element.scrollHeight <= element.clientHeight) return;
            
            const originalHTML = element.innerHTML;
            const originalStyle = element.getAttribute('style') || '';
            
            const container = document.createElement('div');
            container.className = 'has-custom-scroll';
            container.style.cssText = element.style.cssText + '; position: relative;';
            
            const content = document.createElement('div');
            content.className = 'scroll-content';
            content.innerHTML = originalHTML;
            
            const scrollbar = document.createElement('div');
            scrollbar.className = 'custom-scrollbar';
            
            const track = document.createElement('div');
            track.className = 'custom-scrollbar-track';
            
            const thumb = document.createElement('div');
            thumb.className = 'custom-scrollbar-thumb';
            
            const elementHeight = element.clientHeight;
            const contentHeight = element.scrollHeight;
            const thumbHeight = Math.max(30, (elementHeight / contentHeight) * elementHeight);
            thumb.style.height = thumbHeight + 'px';
            
            scrollbar.appendChild(track);
            scrollbar.appendChild(thumb);
            container.appendChild(content);
            container.appendChild(scrollbar);
            
            element.parentNode.replaceChild(container, element);
            
            container.dataset.originalElement = true;
            
            content.addEventListener('scroll', function() {
                const scrollTop = content.scrollTop;
                const maxScroll = content.scrollHeight - elementHeight;
                const thumbTop = (scrollTop / maxScroll) * (elementHeight - thumbHeight);
                thumb.style.top = thumbTop + 'px';
            });
            
            let isDragging = false;
            thumb.addEventListener('mousedown', function(e) {
                isDragging = true;
                const startY = e.clientY;
                const startTop = parseFloat(thumb.style.top) || 0;
                
                function onMouseMove(e) {
                    if (!isDragging) return;
                    const deltaY = e.clientY - startY;
                    let newTop = startTop + deltaY;
                    newTop = Math.max(0, Math.min(newTop, elementHeight - thumbHeight));
                    thumb.style.top = newTop + 'px';
                    
                    const scrollPercent = newTop / (elementHeight - thumbHeight);
                    content.scrollTop = scrollPercent * (content.scrollHeight - elementHeight);
                }
                
                function onMouseUp() {
                    isDragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            
            thumb.addEventListener('touchstart', function(e) {
                isDragging = true;
                const touch = e.touches[0];
                const startY = touch.clientY;
                const startTop = parseFloat(thumb.style.top) || 0;
                
                function onTouchMove(e) {
                    if (!isDragging) return;
                    e.preventDefault();
                    const touch = e.touches[0];
                    const deltaY = touch.clientY - startY;
                    let newTop = startTop + deltaY;
                    newTop = Math.max(0, Math.min(newTop, elementHeight - thumbHeight));
                    thumb.style.top = newTop + 'px';
                    
                    const scrollPercent = newTop / (elementHeight - thumbHeight);
                    content.scrollTop = scrollPercent * (content.scrollHeight - elementHeight);
                }
                
                function onTouchEnd() {
                    isDragging = false;
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                }
                
                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('touchend', onTouchEnd);
            });
        }
        
        function initAllScrollbars() {
            const allElements = document.querySelectorAll('body, div, section, article, main, aside');
            
            allElements.forEach(function(el) {
                if (el.clientHeight > 0 && 
                    el.scrollHeight > el.clientHeight + 10 && 
                    window.getComputedStyle(el).overflowY === 'auto') {
                    makeRoundedScrollbar(el);
                }
            });
            
            document.querySelectorAll('body').forEach(function(body) {
                if (body.scrollHeight > window.innerHeight) {
                    makeRoundedScrollbar(body);
                }
            });
        }
        
        setTimeout(initAllScrollbars, 100);
        setTimeout(initAllScrollbars, 500);
        
        const observer = new MutationObserver(function() {
            setTimeout(initAllScrollbars, 50);
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        window.addEventListener('resize', function() {
            setTimeout(initAllScrollbars, 100);
        });
        
        window.changeScrollbarColor = function(color, hover) {
            document.documentElement.style.setProperty('--accent-color', color);
            document.documentElement.style.setProperty('--accent-hover', hover || color);
            
            document.querySelectorAll('.custom-scrollbar-thumb').forEach(function(thumb) {
                thumb.style.background = color;
            });
        };
    });
    
})();