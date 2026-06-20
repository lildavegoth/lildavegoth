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
                -webkit-touch-callout: none !important;
                touch-action: pan-y pinch-zoom !important;
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
        
        function isExceptionPage() {
            return window.location.pathname === '/pages/userscript-json-format.html';
        }
        
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
            if (isExceptionPage()) return;
            if (!shouldProtect(img)) return;
            
            img.classList.add('protected');
            img.setAttribute('data-protected', 'true');
            img.setAttribute('draggable', 'false');
            
            img.setAttribute('oncontextmenu', 'return false');
            img.setAttribute('ondragstart', 'return false');
        }
        
        function protectAllImages() {
            document.querySelectorAll('img:not([data-protected])').forEach(protectImage);
        }
        
        document.addEventListener('contextmenu', function(e) {
            if (isExceptionPage()) return;
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
            if (isExceptionPage()) return;
            if (e.target.tagName === 'IMG' && e.target.classList.contains('protected')) {
                e.preventDefault();
                return false;
            }
        }, true);
        
        document.addEventListener('click', function(e) {
            if (isExceptionPage()) return;
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
            if (isExceptionPage()) return;
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
        
        document.addEventListener('touchstart', function(e) {
            if (isExceptionPage()) return;
            const target = e.target;
            if (target.tagName === 'IMG' && target.classList.contains('protected')) {
                const touch = e.touches[0];
                let touchTimer = setTimeout(function() {
                    e.preventDefault();
                    showRightClickWarning(e);
                }, 500);
                
                target.addEventListener('touchend', function() {
                    clearTimeout(touchTimer);
                }, { once: true });
                
                target.addEventListener('touchmove', function() {
                    clearTimeout(touchTimer);
                }, { once: true });
            }
        }, { passive: false });
        
        function showRightClickWarning(event) {
            const img = event.target;
            img.classList.add('protection-flash');
            setTimeout(() => img.classList.remove('protection-flash'), 500);
            
            const tooltip = document.createElement('div');
            tooltip.textContent = 'Image saving disabled';
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
            if (isExceptionPage()) {
                protectionEnabled = false;
                return;
            }
            
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
        function isExceptionPage() {
            return window.location.pathname === '/pages/userscript-json-format.html';
        }
        
        document.addEventListener('keydown', function(e) {
            if (isExceptionPage()) return;
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
            if (isExceptionPage()) return;
            if (e.target.tagName === 'IMG' && e.target.classList.contains('protected')) {
                e.preventDefault();
                return false;
            }
        }, true);
        
        document.addEventListener('beforeunload', function() {
            if (isExceptionPage()) return;
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
    
    const selectionStyle = document.createElement('style');
    selectionStyle.textContent = `
        ::selection {
            color: #C1FC32 !important;
        }
        
        ::-moz-selection {
            color: #C1FC32 !important;
        }
        
        img.protected::selection,
        img.protected::-moz-selection {
            color: transparent !important;
        }
    `;
    
    document.head.appendChild(selectionStyle);
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
    const CONFIG = { useSpa: false, preloadPages: false, transitionSpeed: 300, cacheSize: 10 };
    var currentPage = getCurrentPageId();
    
    function init() {
        console.log('FastNav initialized');
        
        if (CONFIG.useSpa) {
            setupSpaNavigation();
        } else {
            setupFastTraditionalNav();
        }
        
        // Preload linked pages in background
        if (CONFIG.preloadPages) {
            preloadLinkedPages();
        }
    }
    
    // ==================== SPA MODE ====================
    function setupSpaNavigation() {
        // Hide original body content, show in SPA container
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = `
            <div id="spa-container">
                <div id="page-${currentPage}" class="spa-page active">
                    ${originalContent}
                </div>
            </div>
            <div id="spa-loading" style="display:none;">Loading...</div>
        `;
        
        // Intercept ALL link clicks
        document.addEventListener('click', handleSpaClick);
        
        // Handle browser back/forward
        window.addEventListener('popstate', handlePopState);
    }
    
    function handleSpaClick(e) {
        const link = e.target.closest('a[href]');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Skip external links and anchors
        if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        // Remove .html extension for page ID
        const pageId = href.replace('.html', '').replace('./', '') || 'index';
        
        // Load the page
        loadSpaPage(pageId, href);
    }
    
    async function loadSpaPage(pageId, url) {
        // Show loading indicator
        showLoading(true);
        
        try {
            let content;
            
            // Check cache first
            if (pageCache.has(pageId)) {
                content = pageCache.get(pageId);
            } else {
                // Fetch the page
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to load');
                
                const html = await response.text();
                
                // Extract body content (remove head, scripts, etc)
                const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                content = bodyMatch ? bodyMatch[1] : html;
                
                // Cache it
                pageCache.set(pageId, content);
                trimCache();
            }
            
            // Create new page container
            const newPage = document.createElement('div');
            newPage.id = `page-${pageId}`;
            newPage.className = 'spa-page';
            newPage.innerHTML = content;
            
            // Add to container
            const container = document.getElementById('spa-container');
            const oldPage = container.querySelector('.active');
            
            container.appendChild(newPage);
            
            // Animate transition
            setTimeout(() => {
                if (oldPage) oldPage.classList.remove('active');
                newPage.classList.add('active');
                
                // Update URL without reload
                window.history.pushState({pageId}, '', url);
                
                // Update current page
                currentPage = pageId;
                
                // Remove old page after animation
                setTimeout(() => {
                    if (oldPage && oldPage.id !== `page-${pageId}`) {
                        oldPage.remove();
                    }
                    showLoading(false);
                    
                    // Reinitialize scripts for new page
                    initScripts(newPage);
                }, CONFIG.transitionSpeed);
            }, 10);
            
        } catch (error) {
            console.error('Failed to load page:', error);
            showLoading(false);
            // Fallback to traditional navigation
            window.location.href = url;
        }
    }
    
    // ==================== FAST TRADITIONAL MODE ====================
    function setupFastTraditionalNav() {
        // Add fast-click handler
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a[href$=".html"]');
            if (!link || link.href.startsWith('http')) return;
            
            const url = link.getAttribute('href');
            
            // Check cache for instant preview
            if (pageCache.has(url)) {
                e.preventDefault();
                showLoading(true);
                
                // Quick navigation with cached preview
                setTimeout(() => {
                    window.location.href = url;
                }, 50);
            }
        });
        
        // Accelerate page transitions
        if ('connection' in navigator) {
            document.body.classList.add(
                navigator.connection.saveData ? 'save-data' : 'no-save-data'
            );
        }
    }
    
    // ==================== UTILITY FUNCTIONS ====================
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
                          
                          // Add animation
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
    
    async function preloadLinkedPages() {
        // Find all internal links
        const links = Array.from(document.querySelectorAll('a[href$=".html"]'))
            .map(link => link.getAttribute('href'))
            .filter(href => !href.startsWith('http'))
            .slice(0, CONFIG.cacheSize);
        
        // Preload in background
        for (const url of links) {
            if (!pageCache.has(url)) {
                try {
                    const response = await fetch(url);
                    const html = await response.text();
                    pageCache.set(url, html);
                    console.log('Preloaded:', url);
                } catch (e) {
                    // Silent fail - network might be offline
                }
            }
        }
    }
    
    function trimCache() {
        if (pageCache.size > CONFIG.cacheSize) {
            const firstKey = pageCache.keys().next().value;
            pageCache.delete(firstKey);
        }
    }
    
    function handlePopState(event) {
        if (event.state && event.state.pageId) {
            loadSpaPage(event.state.pageId, `${event.state.pageId}.html`);
        }
    }
    
    function initScripts(container) {
        // Reinitialize any scripts in the new page
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Copy all attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy inline script content
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        // Dispatch event for page-specific initialization
        container.dispatchEvent(new Event('pageinit', { bubbles: true }));
    }
    
    // Add SPA styles
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
    
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = spaStyles;
    document.head.appendChild(styleEl);
    
    // Make functions available globally (optional)
    window.FastNav = {
        clearCache: () => pageCache.clear(),
        preloadPage: (url) => preloadPage(url),
        navigateTo: (pageId) => loadSpaPage(pageId, `${pageId}.html`)
    };
    
    // Force Rounded Scrollbars
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
            if (element.classList.contains('spreadsheet-wrapper')) return;
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
        
        function isExceptionPage() {
            return window.location.pathname === '/pages/userscript-json-format.html';
        }
        
        setTimeout(initAllScrollbars, 100);
        setTimeout(initAllScrollbars, 500);
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                const observer = new MutationObserver(function() {
                    setTimeout(initAllScrollbars, 50);
                });
                observer.observe(document.body, { childList: true, subtree: true });
            });
        } else {
            const observer = new MutationObserver(function() {
                setTimeout(initAllScrollbars, 50);
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        
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
    
    (function() {
        function preventVideoDownload(video) {
            video.setAttribute('controlsList', 'nodownload');
            video.setAttribute('disablepictureinpicture', 'true');
            video.style.webkitTouchCallout = 'none';
            video.style.webkitUserSelect = 'none';
            video.style.userSelect = 'none';
            video.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });
            video.addEventListener('dragstart', function(e) {
                e.preventDefault();
                return false;
            });
            var longPressTimer;
            video.addEventListener('touchstart', function(e) {
                longPressTimer = setTimeout(function() {
                    e.preventDefault();
                }, 500);
            }, { passive: false });
            video.addEventListener('touchend', function() {
                clearTimeout(longPressTimer);
            });
            video.addEventListener('touchmove', function() {
                clearTimeout(longPressTimer);
            });
        }

        function protectAllVideos() {
            document.querySelectorAll('video').forEach(preventVideoDownload);
        }

        document.addEventListener('DOMContentLoaded', protectAllVideos);

        var videoObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.tagName === 'VIDEO') {
                        preventVideoDownload(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('video').forEach(preventVideoDownload);
                    }
                });
            });
        });

        if (document.body) {
            videoObserver.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                videoObserver.observe(document.body, { childList: true, subtree: true });
            });
        }
    })();
    
})();
