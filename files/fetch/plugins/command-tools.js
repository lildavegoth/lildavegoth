(function() {
    var menuEl = null;
    var menuVisible = false;
    var pendingSlash = false;

    function createMenuElement() {
        var el = document.createElement('div');
        el.className = 'slash-command-menu';
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
            { label: 'Table', icon: '<i class="fas fa-table"></i>', action: function() { window.insertTable(); } }
        ];
    }

    function renderCommands(menu) {
        var commands = buildCommands();
        menu.innerHTML = '';
        commands.forEach(function(cmd) {
            var item = document.createElement('div');
            item.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px 16px; cursor:pointer; color:var(--text-primary); font-size:0.95rem;';
            item.innerHTML = '<span style="width:24px;text-align:center;color:var(--accent-color);">' + cmd.icon + '</span>' + cmd.label;
            item.addEventListener('click', function(e) {
                e.stopPropagation();
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
        pendingSlash = false;
    }

    function isEditorActive() {
        var editor = document.getElementById('editorContent');
        return editor && document.activeElement === editor && document.getElementById('noteEditorPage').classList.contains('active');
    }

    function onKeyDown(e) {
        if (!isEditorActive()) return;
        if (e.key === '/' && !menuVisible) {
            pendingSlash = true;
        }
    }

    function onInput(e) {
        if (!isEditorActive()) return;
        if (pendingSlash) {
            showMenu();
            pendingSlash = false;
        } else if (menuVisible) {
            hideMenu();
        }
    }

    function onBlur() {
        if (menuVisible) hideMenu();
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

            document.addEventListener('keydown', onKeyDown, true);
            var textarea = document.getElementById('editorContent');
            if (textarea) {
                textarea.addEventListener('input', onInput);
                textarea.addEventListener('blur', onBlur);
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