// Link Clicks
(function() {
    'use strict';

    // Store the original focus styles
    let originalOutlineStyle = '';
    let originalOutlineOffset = '';
    let originalWebkitTapHighlightColor = '';
    
    // Function to remove blue square/focus indicators
    function removeFocusIndicators() {
        // Save original styles if not already saved
        if (!originalOutlineStyle) {
            originalOutlineStyle = document.documentElement.style.outline;
            originalOutlineOffset = document.documentElement.style.outlineOffset;
            originalWebkitTapHighlightColor = document.documentElement.style.webkitTapHighlightColor;
        }
        
        // Remove focus indicators globally
        document.documentElement.style.outline = 'none';
        document.documentElement.style.outlineOffset = '0';
        document.documentElement.style.webkitTapHighlightColor = 'transparent';
        
        // Apply to all focusable elements
        const focusableElements = document.querySelectorAll(
            'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        
        focusableElements.forEach(element => {
            element.style.outline = 'none';
            element.style.outlineOffset = '0';
            element.style.webkitTapHighlightColor = 'transparent';
        });
    }
    
    // Function to restore original styles (optional, if needed)
    function restoreFocusIndicators() {
        if (originalOutlineStyle) {
            document.documentElement.style.outline = originalOutlineStyle;
            document.documentElement.style.outlineOffset = originalOutlineOffset;
            document.documentElement.style.webkitTapHighlightColor = originalWebkitTapHighlightColor;
        }
    }
    
    // Remove focus indicators on page load
    document.addEventListener('DOMContentLoaded', function() {
        removeFocusIndicators();
        
        // Also remove on any focus events
        document.addEventListener('focusin', function(e) {
            // Remove outline immediately when element gets focus
            e.target.style.outline = 'none';
            e.target.style.outlineOffset = '0';
        });
    });
    
    // Remove focus indicators on click for all links
    document.addEventListener('click', function(e) {
        // If the clicked element is a link or inside a link
        const link = e.target.closest('a');
        if (link) {
            // Remove focus from any currently focused element
            if (document.activeElement) {
                document.activeElement.blur();
            }
            
            // Remove any lingering outlines
            removeFocusIndicators();
            
            // Prevent default focus behavior (optional - can be commented out)
            // e.preventDefault();
            // link.focus();
            // setTimeout(() => link.blur(), 10);
        }
    });
    
    // Also handle touch events for mobile
    document.addEventListener('touchstart', function(e) {
        const link = e.target.closest('a');
        if (link) {
            // Pre-touch cleanup
            removeFocusIndicators();
        }
    }, { passive: true });
    
    // Additional CSS to inject globally
    const style = document.createElement('style');
    style.textContent = `
        /* Remove focus outlines globally */
        *:focus,
        *:focus-visible,
        *:focus-within {
            outline: none !important;
            outline-offset: 0 !important;
            box-shadow: none !important;
        }
        
        /* Remove tap highlight on mobile */
        a, button, input, textarea, select {
            -webkit-tap-highlight-color: transparent !important;
            tap-highlight-color: transparent !important;
        }
        
        /* Hide focus ring for mouse users */
        .focus-visible {
            outline: none !important;
        }
        
        /* Custom focus style if you want to keep accessibility */
        .custom-focus:focus {
            outline: 2px solid var(--accent-color) !important;
            outline-offset: 2px !important;
        }
    `;
    
    // Add the styles to the document head
    document.head.appendChild(style);
    
    // Make functions available globally if needed elsewhere
    window.disableFocusSquare = {
        remove: removeFocusIndicators,
        restore: restoreFocusIndicators
    };
    
})();

// Image Protections
(function() {
    'use strict';
    
    // ADD GLOBAL PROTECTION STYLES (invisible)
    const style = document.createElement('style');
    style.textContent = `
        /* Invisible protection - applied to ALL images */
        img {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-user-drag: none !important;
            -khtml-user-drag: none !important;
            -moz-user-drag: none !important;
            -o-user-drag: none !important;
            pointer-events: none !important;
        }
        
        /* Allow clicking on specific images if needed */
        img.clickable {
            pointer-events: auto !important;
        }
        
        /* Remove blue focus outlines globally */
        *:focus,
        *:focus-visible,
        *:focus-within {
            outline: none !important;
            box-shadow: none !important;
        }
        
        /* Remove tap highlight on mobile */
        * {
            -webkit-tap-highlight-color: transparent !important;
            tap-highlight-color: transparent !important;
        }
        
        /* Remove selection outlines on buttons/images */
        button:focus,
        img:focus,
        .plot:focus,
        .pixel-btn:focus {
            outline: 2px solid transparent !important;
            outline-offset: 2px !important;
        }
        
        /* For accessibility - add custom focus style (optional) */
        .pixel-btn:focus-visible {
            transform: scale(0.98) !important;
            filter: brightness(1.2) !important;
            transition: all 0.2s ease !important;
        }
    `;
    document.head.appendChild(style);
    
    // IMAGE FORMATS TO PROTECT
    const PROTECTED_FORMATS = [
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
        '.bmp', '.tiff', '.tif', '.ico', '.apng'
    ];
    
    const EXCLUDED_SRC_PARTS = [
        '/icons/', '/ui/', '/buttons/', '/logos/',
        'icon-', 'btn-', 'ui-'
    ];
    
    // CHECK IF IMAGE SHOULD BE PROTECTED
    function shouldProtect(img) {
        // Skip if already processed
        if (img.hasAttribute('data-protection-processed')) {
            return img.classList.contains('protected-image');
        }
        
        // Check if image is clickable (explicitly allowed)
        if (img.classList.contains('clickable')) {
            return false;
        }
        
        // Check for excluded classes
        for (const excludedClass of EXCLUDED_CLASSES) {
            if (img.classList.contains(excludedClass)) {
                return false;
            }
        }
        
        // Check src for excluded patterns
        const src = img.src.toLowerCase();
        for (const excludedPart of EXCLUDED_SRC_PARTS) {
            if (src.includes(excludedPart)) {
                return false;
            }
        }
        
        // Check if it's a valid image format
        for (const format of PROTECTED_FORMATS) {
            if (src.includes(format) || img.src.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?|ico|apng)/i)) {
                return true;
            }
        }
        
        // Also protect data URLs and blob URLs
        if (src.startsWith('data:image/') || src.startsWith('blob:')) {
            return true;
        }
        
        // Default: protect all img tags
        return true;
    }
    
    // APPLY PROTECTION TO IMAGE
    function protectImage(img) {
        if (!shouldProtect(img)) return;
        
        // Mark as protected
        img.classList.add('protected-image');
        img.setAttribute('data-protected', 'true');
        img.setAttribute('data-protection-processed', 'true');
        
        // Additional protection attributes
        img.setAttribute('oncontextmenu', 'return false');
        img.setAttribute('ondragstart', 'return false');
    }
    
    // APPLY PROTECTION TO ALL IMAGES
    function protectAllImages() {
        const images = document.querySelectorAll('img:not([data-protection-processed])');
        
        images.forEach(img => {
            protectImage(img);
        });
        
        return images.length;
    }
    
    // BLOCK RIGHT-CLICK GLOBALLY (silent)
    document.addEventListener('contextmenu', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    }, true);
    
    // BLOCK DRAG-AND-DROP GLOBALLY (silent)
    document.addEventListener('dragstart', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    }, true);
    
    // 9. ALSO BLOCK THESE EVENTS
    document.addEventListener('selectstart', function(e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
            return false;
        }
    }, true);
    
    // WATCH FOR NEW IMAGES
    const observer = new MutationObserver(function(mutations) {
        let foundImages = false;
        
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.tagName === 'IMG') {
                    foundImages = true;
                    protectImage(node);
                } else if (node.querySelectorAll) {
                    const images = node.querySelectorAll('img:not([data-protection-processed])');
                    if (images.length > 0) {
                        foundImages = true;
                        images.forEach(protectImage);
                    }
                }
            });
        });
        
        if (foundImages) {
            setTimeout(protectAllImages, 10);
        }
    });
    
    // INITIALIZE PROTECTION
    function initProtection() {
        // Protect existing images
        const protectedCount = protectAllImages();
        
        // Run multiple times to catch dynamic content
        setTimeout(protectAllImages, 100);
        setTimeout(protectAllImages, 300);
        setTimeout(protectAllImages, 1000);
        setTimeout(protectAllImages, 3000);
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Recheck periodically
        setInterval(protectAllImages, 5000);
    }
    
    // START PROTECTION
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProtection);
    } else {
        initProtection();
    }
    
    // EXPOSE UTILITY FUNCTIONS (optional, for debugging)
    window.imageProtection = {
        reprotect: protectAllImages,
        count: function() {
            return document.querySelectorAll('img[data-protected]').length;
        },
        list: function() {
            return Array.from(document.querySelectorAll('img[data-protected]')).map(img => ({
                src: img.src,
                class: img.className
            }));
        }
    };
    
})();