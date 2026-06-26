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
            document.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])').forEach(function(el) {
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

        var focusStyle = document.createElement('style');
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
        var protectionEnabled = true;
        var rightClickAttempts = 0;
        var MAX_ATTEMPTS = 3;
        var EXCLUDED_CLASSES = [
            'clickable', 'allow-interaction', 'ui-icon',
            'nav-icon', 'button-icon', 'logo', 'favicon'
        ];
        var PROTECTED_FORMATS = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?|ico|apng)/i;

        var protectionStyle = document.createElement('style');
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
            img.clickable, img.allow-interaction, img[data-no-protect] {
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
            .protection-flash { animation: protectionFlash 0.5s; }
            .protection-warning { animation: warningSlide 0.3s; }
        `;
        document.head.appendChild(protectionStyle);

        function isExceptionPage() {
            return window.location.pathname === '/pages/userscript-json-format.html';
        }

        function shouldProtect(img) {
            if (img.hasAttribute('data-protected')) return false;
            for (var i = 0; i < EXCLUDED_CLASSES.length; i++) {
                if (img.classList.contains(EXCLUDED_CLASSES[i])) return false;
            }
            if (img.hasAttribute('data-no-protect')) return false;
            var src = img.src.toLowerCase();
            if (PROTECTED_FORMATS.test(src) || src.startsWith('data:image/') || src.startsWith('blob:')) {
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
            var target = e.target;
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
            var target = e.target;
            if ((e.button === 1 || e.ctrlKey || e.metaKey) &&
                target.tagName === 'IMG' && target.classList.contains('protected')) {
                e.preventDefault();
                if (window.showMessage) {
                    window.showMessage('Content Protected', 'Protected content cannot be opened', 'warning');
                }
                return false;
            }
        }, true);

        document.addEventListener('copy', function(e) {
            if (isExceptionPage()) return;
            var selection = window.getSelection();
            var text = selection.toString();
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
            var target = e.target;
            if (target.tagName === 'IMG' && target.classList.contains('protected')) {
                var touchTimer = setTimeout(function() {
                    e.preventDefault();
                    showRightClickWarning(e);
                }, 1000);
                target.addEventListener('touchend', function() {
                    clearTimeout(touchTimer);
                }, { once: true });
                target.addEventListener('touchmove', function() {
                    clearTimeout(touchTimer);
                }, { once: true });
            }
        }, { passive: false });

        function showRightClickWarning(event) {
            var img = event.target;
            img.classList.add('protection-flash');
            setTimeout(function() { img.classList.remove('protection-flash'); }, 500);
            var tooltip = document.createElement('div');
            tooltip.textContent = 'Image saving disabled';
            tooltip.style.cssText = 'position: fixed; top: ' + (event.clientY + 15) + 'px; left: ' + (event.clientX + 15) + 'px; background: rgba(220, 0, 0, 0.9); color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 1000000; pointer-events: none; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
            document.body.appendChild(tooltip);
            setTimeout(function() { tooltip.remove(); }, 1500);
            if (rightClickAttempts >= 2) {
                showProtectionAlert();
            }
        }

        function showProtectionAlert() {
            var existing = document.querySelector('.protection-alert');
            if (existing) existing.remove();
            var alert = document.createElement('div');
            alert.className = 'protection-warning';
            alert.innerHTML = '<div style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #ff3333, #ff6666); color: white; padding: 12px 20px; border-radius: 8px; z-index: 999999; box-shadow: 0 4px 12px rgba(255,0,0,0.4); font-size: 14px; text-align: center; max-width: 90%;"><strong>⚠️ Content Protected Active</strong><br><small style="opacity: 0.9;">Content is protected from downloading</small></div>';
            document.body.appendChild(alert);
            setTimeout(function() { alert.remove(); }, 4000);
            if (window.showMessage) {
                window.showMessage('Content Protected', 'Image protection is now active', 'warning', '', 'Content is protected from downloading');
            }
        }

        function enableStrongProtection() {
            var strongStyle = document.createElement('style');
            strongStyle.textContent = '.protected { position: relative; } .protected::after { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,0,0,0.05) 5px, rgba(255,0,0,0.05) 10px); pointer-events: none; z-index: 1; }';
            document.head.appendChild(strongStyle);
            setTimeout(function() { strongStyle.remove(); }, 30000);
        }

        var observer = new MutationObserver(function(mutations) {
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
            observer.observe(document.body, { childList: true, subtree: true });
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
                document.querySelectorAll('.protected').forEach(function(img) {
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
                setTimeout(function() {
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
            document.querySelectorAll('img.protected').forEach(function(img) {
                if (img.src.startsWith('blob:') || img.src.startsWith('data:')) {
                    img.src = '';
                }
            });
        });
    })();

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
        // No touchstart prevention – back gesture works
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
