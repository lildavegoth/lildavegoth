(function() {
    'use strict';
    
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
                    window.showMessage('Image Protection', 'Protected content cannot be opened', 'warning');
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
                    window.showMessage('Image Protection', 'Image URL copying disabled', 'warning');
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
                    <strong>⚠️ Image Protection Active</strong><br>
                    <small style="opacity: 0.9;">Content is protected from downloading</small>
                </div>
            `;
            
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 4000);
            
            if (window.showMessage) {
                window.showMessage('Image Protection', 'Image protection is now active', 'warning', '', 'Content is protected from downloading');
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
    
    // Cordova system
    // Don't run in regular browsers (only in Cordova)
    if (!window.cordova) return;
    
    // Configuration
    const CONFIG = {
        useSpa: true,          // true=SPA mode, false=traditional
        preloadPages: true,    // Preload linked pages
        cacheSize: 5,          // How many pages to cache
        transitionSpeed: 200   // ms for page transitions
    };
    
    // Page cache
    const pageCache = new Map();
    let currentPage = null;
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
    
    function init() {
        console.log('FastNav initialized');
        
        // Extract current page ID from URL
        currentPage = getCurrentPageId();
        
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
    
    // Input files
    window.AutoFileImport = {
        cordovaMode: !!(window.cordova && cordova.plugins.file),
        
        init() {
            if (!this.cordovaMode) return;
            
            const originalClick = HTMLInputElement.prototype.click;
            HTMLInputElement.prototype.click = function() {
                if (this.type === 'file') {
                    AutoFileImport.handleFileSelect(this, (error, files) => {
                        if (error) return;
                        const dataTransfer = new DataTransfer();
                        files.forEach(fileData => {
                            const file = new File([fileData.content], fileData.name, { type: fileData.type });
                            dataTransfer.items.add(file);
                        });
                        this.files = dataTransfer.files;
                        this.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                } else {
                    originalClick.call(this);
                }
            };
        },
        
        handleFileSelect(inputElement, callback) {
            const accept = inputElement.getAttribute('accept') || '*/*';
            const multiple = inputElement.hasAttribute('multiple');
            
            if (this.cordovaMode) {
                this._cordovaImport(accept, multiple, callback);
            } else {
                this._browserImport(accept, multiple, callback);
            }
        },
        
        _cordovaImport(accept, multiple, callback) {
            window.FileChooser.open({ mime: accept, multiple: multiple }, (uri) => {
                const uris = multiple && Array.isArray(uri) ? uri : [uri];
                Promise.all(uris.map(u => this.readCordovaFile(u)))
                    .then(files => callback(null, files))
                    .catch(() => callback('Failed'));
            }, () => callback('Cancelled'));
        },
        
        readCordovaFile(uri) {
            return new Promise((resolve, reject) => {
                window.resolveLocalFileSystemURL(uri, (fileEntry) => {
                    fileEntry.file((file) => {
                        const reader = new FileReader();
                        reader.onloadend = (e) => resolve({
                            name: fileEntry.name,
                            content: e.target.result,
                            type: file.type
                        });
                        reader.onerror = reject;
                        reader.readAsText(file);
                    }, reject);
                }, reject);
            });
        },
        
        _browserImport(accept, multiple, callback) {
            callback('Not Cordova');
        }
    };
    
    document.addEventListener('deviceready', () => AutoFileImport.init());
    
})();
