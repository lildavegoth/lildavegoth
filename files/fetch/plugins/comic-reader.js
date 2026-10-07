(function() {
    var STYLE_ID = 'comicReaderStyles';
    var INPUT_ID = 'comicReaderInput';
    var pluginActive = false;
    var originalAttach = null;
    var contentObserver = null;
    var readingObserver = null;
    var markDebounce = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '.reading-content p.comic-strip{margin:0 !important;padding:0;line-height:0;}' +
            '.reading-content p.comic-strip img{display:block !important;margin:0 !important;padding:0;border-radius:0 !important;width:100% !important;height:auto !important;max-width:100%;object-fit:contain;}' +
            '.reading-content p.comic-strip .media-container{margin:0 !important;border-radius:0 !important;background:transparent !important;aspect-ratio:auto !important;height:auto !important;overflow:visible !important;}';
        document.head.appendChild(style);
    }

    function removeStyles() {
        var el = document.getElementById(STYLE_ID);
        if (el) el.remove();
    }

    function buildInput() {
        var existing = document.getElementById(INPUT_ID);
        if (existing) return existing;
        var input = document.createElement('input');
        input.type = 'file';
        input.id = INPUT_ID;
        input.multiple = true;
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', handleComicFiles);
        return input;
    }

    function removeInput() {
        var el = document.getElementById(INPUT_ID);
        if (el) el.remove();
    }

    async function handleComicFiles(e) {
        var files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;

        files = files.filter(function(f) {
            return f.type.indexOf('image/') === 0 || /\.(png|jpe?g|gif|webp|svg|bmp|avif|tiff?|ico)$/i.test(f.name);
        });

        if (!files.length) {
            window.showMessage('No image files selected');
            return;
        }

        files.sort(function(a, b) {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        var textarea = document.getElementById('editorContent');
        if (!textarea) return;

        var lines = [];
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var key = window.generateAttachmentKey();
            await window.dbPut('attachments', key, file);
            window.saveAttachmentName(key, file.name);
            lines.push('![' + file.name + '](attachment:' + key + ')');
        }

        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var text = textarea.value;
        var prefix = (start > 0 && text.charAt(start - 1) !== '\n') ? '\n' : '';
        var insertText = prefix + lines.join('\n');

        textarea.value = text.substring(0, start) + insertText + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
        textarea.focus();
        window.triggerAutoSave();
        window.showMessage('Imported ' + files.length + ' comic page' + (files.length !== 1 ? 's' : ''));
    }

    function showSelectionPopup() {
        document.getElementById('popupTitle').textContent = 'Add Attachment';
        var body = document.getElementById('popupBody');
        body.innerHTML =
            '<p>Choose how you want to add files.</p>' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">' +
            '<button class="popup-btn primary" id="comicPickComics" style="width:100%;"><i class="fas fa-book-open" style="margin-right:8px;"></i> Comics</button>' +
            '<button class="popup-btn secondary" id="comicPickNormal" style="width:100%;"><i class="fas fa-paperclip" style="margin-right:8px;"></i> Normal Files</button>' +
            '</div>';
        document.getElementById('universalPopup').style.display = 'flex';

        document.getElementById('comicPickComics').addEventListener('click', function() {
            window.closeUniversalPopup();
            buildInput().click();
        });
        document.getElementById('comicPickNormal').addEventListener('click', function() {
            window.closeUniversalPopup();
            if (typeof originalAttach === 'function') {
                originalAttach.call(window);
            }
        });
    }

    function wrapAttach() {
        if (!originalAttach) {
            originalAttach = window.attachImage;
        }
        window.attachImage = function() {
            if (!pluginActive) {
                if (typeof originalAttach === 'function') return originalAttach.apply(this, arguments);
                return;
            }
            showSelectionPopup();
        };
    }

    function unwrapAttach() {
        if (typeof originalAttach === 'function') {
            window.attachImage = originalAttach;
        }
    }

    function markComicParagraphs() {
        if (!pluginActive) return;
        var content = document.getElementById('readingContent');
        if (!content) return;
        var paragraphs = content.querySelectorAll('p');
        paragraphs.forEach(function(p) {
            var imgCount = 0;
            var hasNonImg = false;
            var childNodes = p.childNodes;
            for (var i = 0; i < childNodes.length; i++) {
                var node = childNodes[i];
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') {
                        imgCount++;
                    } else if (node.classList && node.classList.contains('media-container') && node.querySelector('img')) {
                        imgCount++;
                    } else {
                        hasNonImg = true;
                    }
                } else if (node.nodeType === 3 && node.textContent.trim() !== '') {
                    hasNonImg = true;
                }
            }
            if (imgCount > 1 && !hasNonImg) {
                p.classList.add('comic-strip');
                p.querySelectorAll('.media-container').forEach(function(mc) {
                    var img = mc.querySelector('img');
                    if (img) {
                        mc.parentNode.insertBefore(img, mc);
                        mc.remove();
                        img.removeAttribute('style');
                        img.style.width = '100%';
                        img.style.height = 'auto';
                        img.style.display = 'block';
                        img.style.margin = '0';
                        img.style.borderRadius = '0';
                        img.style.maxWidth = '100%';
                    }
                });
            }
        });
    }

    function scheduleMark() {
        if (!pluginActive) return;
        if (markDebounce) clearTimeout(markDebounce);
        markDebounce = setTimeout(markComicParagraphs, 150);
    }

    function hookReading() {
        var content = document.getElementById('readingContent');
        if (content) {
            if (contentObserver) contentObserver.disconnect();
            contentObserver = new MutationObserver(scheduleMark);
            contentObserver.observe(content, { childList: true, subtree: true });
        }
        var readingMode = document.getElementById('readingMode');
        if (readingMode) {
            if (readingObserver) readingObserver.disconnect();
            readingObserver = new MutationObserver(function() {
                if (readingMode.classList.contains('active')) {
                    scheduleMark();
                }
            });
            readingObserver.observe(readingMode, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function unhookReading() {
        if (contentObserver) {
            contentObserver.disconnect();
            contentObserver = null;
        }
        if (readingObserver) {
            readingObserver.disconnect();
            readingObserver = null;
        }
        if (markDebounce) {
            clearTimeout(markDebounce);
            markDebounce = null;
        }
    }

    function deactivate() {
        pluginActive = false;
        unwrapAttach();
        removeStyles();
        removeInput();
        unhookReading();
        var content = document.getElementById('readingContent');
        if (content) {
            content.querySelectorAll('.comic-strip').forEach(function(el) {
                el.classList.remove('comic-strip');
            });
        }
    }

    function wrapTogglePlugin() {
        if (window.__comicReaderToggleWrapped) return;
        window.__comicReaderToggleWrapped = true;
        var orig = window.togglePlugin;
        if (typeof orig !== 'function') return;
        window.togglePlugin = function(name, checked) {
            if (name === 'Comic Reader' && !checked) {
                deactivate();
            }
            return orig.apply(window, arguments);
        };
    }

    var plugin = {
        name: 'Comic Reader',
        description: 'Read comics, manga, or manhwa pages inside Notes App.',
        version: '1.0',
        init: function(app) {
            pluginActive = true;
            injectStyles();
            buildInput();
            wrapAttach();
            hookReading();
            wrapTogglePlugin();
            app.on('app:ready', function() {
                wrapAttach();
                hookReading();
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
