(function() {
    var menuEl = null;
    var menuVisible = false;
    var targetTextarea = null;

    function createMenuElement() {
        var el = document.createElement('div');
        el.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:280px; max-height:60vh; overflow-y:auto; background:rgba(22,22,24,0.95); border:1px solid rgba(255,255,255,0.15); border-radius:16px; padding:8px 0; z-index:9999999; display:none;';
        return el;
    }

    function buildCommands() {
        return [
            { label: 'Bold', icon: '<i class="fas fa-bold"></i>', action: function() { window.insertMarkdown('**', '**'); } },
            { label: 'Italic', icon: '<i class="fas fa-italic"></i>', action: function() { window.insertMarkdown('*', '*'); } },
            { label: 'Strikethrough', icon: '<i class="fas fa-strikethrough"></i>', action: function() { window.insertMarkdown('~~', '~~'); } },
            { label: 'Heading', icon: '<i class="fas fa-heading"></i>', action: function() { window.insertMarkdown('# ', ''); } },
            { label: 'Bullet List', icon: '<i class="fas fa-list-ul"></i>', action: function() { window.insertMarkdown('• ', ''); } },
            { label: 'Numbered List', icon: '<i class="fas fa-list-ol"></i>', action: function() { window.insertMarkdown('1. ', ''); } },
            { label: 'Checklist', icon: '<i class="fas fa-check-square"></i>', action: function() { window.insertMarkdown('- [ ] ', ''); } },
            { label: 'Quote', icon: '<i class="fas fa-quote-left"></i>', action: function() { window.insertMarkdown('> ', ''); } },
            { label: 'Link', icon: '<i class="fas fa-link"></i>', action: function() { window.insertLink(); } },
            { label: 'Code', icon: '<i class="fas fa-code"></i>', action: function() { window.insertMarkdown('`', '`'); } },
            { label: 'Image', icon: '<i class="fas fa-image"></i>', action: function() { window.attachImage(); } },
            { label: 'Indent', icon: '<i class="fas fa-indent"></i>', action: function() { window.indent(); } },
            { label: 'Outdent', icon: '<i class="fas fa-outdent"></i>', action: function() { window.outdent(); } },
            { label: 'Undo', icon: '<i class="fas fa-undo"></i>', action: function() { window.undo(); } },
            { label: 'Redo', icon: '<i class="fas fa-redo"></i>', action: function() { window.redo(); } },
            { label: 'Clear', icon: '<i class="fas fa-eraser"></i>', action: function() { window.clearText(); } },
            { label: 'Table', icon: '<i class="fas fa-table"></i>', action: function() { window.insertTable(); } },
            { label: 'Callout Note', icon: '<i class="fas fa-circle-info"></i>', action: function() { window.insertMarkdown('> [!note]\n> ', ''); } },
            { label: 'Callout Warning', icon: '<i class="fas fa-triangle-exclamation"></i>', action: function() { window.insertMarkdown('> [!warning]\n> ', ''); } },
            { label: 'Callout Tip', icon: '<i class="fas fa-lightbulb"></i>', action: function() { window.insertMarkdown('> [!tip]\n> ', ''); } },
            { label: 'Custom Quote', icon: '<i class="fas fa-quote-right"></i>', action: function() { window.insertMarkdown('""\n', '\n""'); } },
            { label: 'Code Block', icon: '<i class="fas fa-code"></i>', action: function() { window.insertMarkdown('```\n', '\n```'); } }
        ];
    }

    function renderCommands(menu) {
        var commands = buildCommands();
        menu.innerHTML = '';
        commands.forEach(function(cmd) {
            var item = document.createElement('div');
            item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px 16px; cursor:pointer; color:var(--text-primary); font-size:0.95rem;';
            item.innerHTML = '<span style="width:24px;text-align:center;color:var(--accent-color);">' + cmd.icon + '</span>' + cmd.label;
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                removeTrailingSlash();
                cmd.action();
                hideMenu();
            });
            menu.appendChild(item);
        });
    }

    function showMenu() {
        if (!menuEl) {
            menuEl = createMenuElement();
            renderCommands(menuEl);
            document.body.appendChild(menuEl);
        }
        menuEl.style.display = 'block';
        menuVisible = true;
    }

    function hideMenu() {
        if (menuEl) {
            menuEl.style.display = 'none';
        }
        menuVisible = false;
    }

    function removeTrailingSlash() {
        if (!targetTextarea) return;
        var val = targetTextarea.value;
        if (val.charAt(val.length - 1) === '/') {
            targetTextarea.value = val.slice(0, -1);
            targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function onInput() {
        if (!isEditorActive()) return;
        var val = targetTextarea.value;
        if (val.charAt(val.length - 1) === '/') {
            showMenu();
        } else {
            hideMenu();
        }
    }

    function isEditorActive() {
        if (!targetTextarea) return false;
        return document.getElementById('noteEditorPage').classList.contains('active') &&
               document.activeElement === targetTextarea;
    }

    function onEscape(e) {
        if (e.key === 'Escape' && menuVisible) {
            hideMenu();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    var plugin = {
        name: 'Command Tools',
        description: 'Hide the toolbar and use / (slash) to open a formatting menu.',
        version: '1.0',
        init: function(app) {
            var toolbar = document.getElementById('richToolbar');
            if (toolbar) toolbar.style.display = 'none';

            targetTextarea = document.getElementById('editorContent');
            if (targetTextarea) {
                targetTextarea.addEventListener('input', onInput);
                targetTextarea.addEventListener('blur', hideMenu);
            }
            document.addEventListener('keydown', onEscape);
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
