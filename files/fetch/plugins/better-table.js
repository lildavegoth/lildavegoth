(function() {
    var overlayEl = null;
    var tablesData = [];

    function injectStyles() {
        if (document.getElementById('betterTableStyles')) return;
        var style = document.createElement('style');
        style.id = 'betterTableStyles';
        style.textContent =
            '.bt-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:1000002;display:none;flex-direction:column;overflow:hidden;}' +
            '.bt-overlay.active{display:flex;}' +
            '.bt-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#111;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;gap:12px;}' +
            '.bt-title{color:#f5f5f7;font-weight:600;font-size:1.05rem;}' +
            '.bt-actions{display:flex;gap:8px;flex-wrap:wrap;}' +
            '.bt-btn{padding:8px 14px;border:1px solid rgba(255,255,255,0.15);border-radius:10px;background:transparent;color:#f5f5f7;cursor:pointer;font-size:0.9rem;display:inline-flex;align-items:center;gap:6px;}' +
            '.bt-btn:hover{background:rgba(255,255,255,0.08);}' +
            '.bt-btn.primary{background:#C1FC32;color:#000;border-color:transparent;font-weight:600;}' +
            '.bt-btn.primary:hover{background:#d2ff62;}' +
            '.bt-body{flex:1;overflow-y:auto;padding:20px;}' +
            '.bt-table-card{background:rgba(30,30,30,0.7);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:16px;margin-bottom:20px;}' +
            '.bt-table-toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;}' +
            '.bt-table-toolbar .bt-btn{padding:6px 12px;font-size:0.82rem;}' +
            '.bt-table-label{color:#a1a1a6;font-size:0.8rem;margin-right:auto;}' +
            '.bt-table-wrap{overflow-x:auto;}' +
            '.bt-table{border-collapse:collapse;width:100%;table-layout:fixed;}' +
            '.bt-table th,.bt-table td{border:1px solid rgba(255,255,255,0.15);padding:8px 12px;text-align:left;word-break:break-word;overflow-wrap:anywhere;white-space:normal;vertical-align:top;}' +
            '.bt-table th{background:rgba(193,252,50,0.1);color:#C1FC32;font-weight:bold;}' +
            '.bt-cell{outline:none;cursor:text;min-width:40px;}' +
            '.bt-cell:focus{background:rgba(193,252,50,0.08);}' +
            '.bt-empty{text-align:center;color:#a1a1a6;padding:60px 20px;font-size:1rem;line-height:1.6;}' +
            '.bt-close-btn{width:36px;height:36px;padding:0;justify-content:center;font-size:1.1rem;}' +
            '@media(max-width:520px){.bt-header{padding:10px 12px;}.bt-title{display:none;}.bt-btn{padding:8px 10px;font-size:0.82rem;}.bt-body{padding:12px;}}';
        document.head.appendChild(style);
    }

    function buildOverlay() {
        if (overlayEl) return;
        injectStyles();
        overlayEl = document.createElement('div');
        overlayEl.className = 'bt-overlay';
        overlayEl.id = 'betterTableOverlay';
        overlayEl.innerHTML =
            '<div class="bt-header">' +
            '<span class="bt-title">Table Editor</span>' +
            '<div class="bt-actions">' +
            '<button type="button" class="bt-btn" id="btAddTable"><i class="fas fa-plus"></i> New Table</button>' +
            '<button type="button" class="bt-btn primary" id="btSave"><i class="fas fa-save"></i> Save</button>' +
            '<button type="button" class="bt-btn bt-close-btn" id="btClose"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="bt-body" id="btBody"></div>';
        document.body.appendChild(overlayEl);

        overlayEl.querySelector('#btClose').addEventListener('click', closeOverlay);
        overlayEl.querySelector('#btSave').addEventListener('click', saveAndClose);
        overlayEl.querySelector('#btAddTable').addEventListener('click', addNewTable);
    }

    function looksLikeTableHeader(lines, i) {
        if (i + 1 >= lines.length) return false;
        var l0 = lines[i].trim();
        var l1 = lines[i + 1].trim();
        if (!l0.startsWith('|')) return false;
        return /^\|[\s\-:|]+\|$/.test(l1);
    }

    function parseRow(line) {
        var trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.substring(0, trimmed.length - 1);
        return trimmed.split('|').map(function(c) { return c.trim(); });
    }

    function parseTables(lines) {
        var result = [];
        var i = 0;
        while (i < lines.length) {
            if (looksLikeTableHeader(lines, i)) {
                var startLine = i;
                var tableLines = [];
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }
                var header = parseRow(tableLines[0]);
                var body = tableLines.slice(2).map(parseRow);
                result.push({
                    startLine: startLine,
                    endLine: i - 1,
                    header: header,
                    body: body,
                    isNew: false
                });
            } else {
                i++;
            }
        }
        return result;
    }

    function buildMarkdownLines(header, body) {
        var lines = [];
        lines.push('| ' + header.join(' | ') + ' |');
        lines.push('|' + header.map(function() { return ' --- '; }).join('|') + '|');
        body.forEach(function(row) {
            var padded = row.slice();
            while (padded.length < header.length) padded.push('');
            if (padded.length > header.length) padded = padded.slice(0, header.length);
            lines.push('| ' + padded.join(' | ') + ' |');
        });
        return lines;
    }

    function renderTables() {
        if (!overlayEl) return;
        var body = overlayEl.querySelector('#btBody');
        body.innerHTML = '';

        if (tablesData.length === 0) {
            body.innerHTML = '<div class="bt-empty"><i class="far fa-table" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:0.4;"></i>No tables found in this note.<br>Click <strong>New Table</strong> to add one.</div>';
            return;
        }

        tablesData.forEach(function(t, index) {
            var card = document.createElement('div');
            card.className = 'bt-table-card';

            var toolbar = document.createElement('div');
            toolbar.className = 'bt-table-toolbar';

            var label = document.createElement('span');
            label.className = 'bt-table-label';
            label.textContent = 'Table ' + (index + 1);
            toolbar.appendChild(label);

            var addRowBtn = document.createElement('button');
            addRowBtn.type = 'button';
            addRowBtn.className = 'bt-btn';
            addRowBtn.innerHTML = '<i class="fas fa-plus"></i> Row';
            addRowBtn.addEventListener('click', function() {
                syncAllCellsFromDOM();
                t.body.push(new Array(t.header.length).fill(''));
                renderTables();
            });

            var addColBtn = document.createElement('button');
            addColBtn.type = 'button';
            addColBtn.className = 'bt-btn';
            addColBtn.innerHTML = '<i class="fas fa-plus"></i> Column';
            addColBtn.addEventListener('click', function() {
                syncAllCellsFromDOM();
                t.header.push('');
                t.body.forEach(function(row) { row.push(''); });
                renderTables();
            });

            var delRowBtn = document.createElement('button');
            delRowBtn.type = 'button';
            delRowBtn.className = 'bt-btn';
            delRowBtn.innerHTML = '<i class="fas fa-minus"></i> Row';
            delRowBtn.addEventListener('click', function() {
                syncAllCellsFromDOM();
                if (t.body.length > 0) t.body.pop();
                renderTables();
            });

            var delColBtn = document.createElement('button');
            delColBtn.type = 'button';
            delColBtn.className = 'bt-btn';
            delColBtn.innerHTML = '<i class="fas fa-minus"></i> Column';
            delColBtn.addEventListener('click', function() {
                syncAllCellsFromDOM();
                if (t.header.length > 1) {
                    t.header.pop();
                    t.body.forEach(function(row) { if (row.length > 1) row.pop(); });
                }
                renderTables();
            });

            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'bt-btn';
            deleteBtn.style.color = '#ff6b6b';
            deleteBtn.style.borderColor = 'rgba(255,107,107,0.3)';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            deleteBtn.addEventListener('click', function() {
                tablesData.splice(index, 1);
                renderTables();
            });

            toolbar.appendChild(addRowBtn);
            toolbar.appendChild(addColBtn);
            toolbar.appendChild(delRowBtn);
            toolbar.appendChild(delColBtn);
            toolbar.appendChild(deleteBtn);

            var wrap = document.createElement('div');
            wrap.className = 'bt-table-wrap';

            var table = document.createElement('table');
            table.className = 'bt-table';

            var thead = document.createElement('thead');
            var headRow = document.createElement('tr');
            t.header.forEach(function(cellText, cIdx) {
                var th = document.createElement('th');
                th.className = 'bt-cell';
                th.contentEditable = 'true';
                th.setAttribute('data-table', index);
                th.setAttribute('data-row', '-1');
                th.setAttribute('data-col', cIdx);
                th.textContent = cellText;
                headRow.appendChild(th);
            });
            thead.appendChild(headRow);
            table.appendChild(thead);

            var tbody = document.createElement('tbody');
            t.body.forEach(function(row, rIdx) {
                var tr = document.createElement('tr');
                row.forEach(function(cellText, cIdx) {
                    var td = document.createElement('td');
                    td.className = 'bt-cell';
                    td.contentEditable = 'true';
                    td.setAttribute('data-table', index);
                    td.setAttribute('data-row', rIdx);
                    td.setAttribute('data-col', cIdx);
                    td.textContent = cellText;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);

            wrap.appendChild(table);
            card.appendChild(toolbar);
            card.appendChild(wrap);
            body.appendChild(card);
        });
    }

    function syncAllCellsFromDOM() {
        if (!overlayEl) return;
        var cells = overlayEl.querySelectorAll('.bt-cell');
        cells.forEach(function(cell) {
            var tIdx = parseInt(cell.getAttribute('data-table'), 10);
            var rIdx = parseInt(cell.getAttribute('data-row'), 10);
            var cIdx = parseInt(cell.getAttribute('data-col'), 10);
            var t = tablesData[tIdx];
            if (!t) return;
            var value = cell.textContent.trim();
            if (rIdx === -1) {
                t.header[cIdx] = value;
            } else if (t.body[rIdx]) {
                t.body[rIdx][cIdx] = value;
            }
        });
    }

    function addNewTable() {
        syncAllCellsFromDOM();
        tablesData.push({
            startLine: -1,
            endLine: -1,
            header: ['Header 1', 'Header 2', 'Header 3'],
            body: [
                ['', '', ''],
                ['', '', '']
            ],
            isNew: true
        });
        renderTables();
    }

    function openOverlay() {
        buildOverlay();
        var textarea = document.getElementById('editorContent');
        if (!textarea) return;
        var lines = textarea.value.split('\n');
        tablesData = parseTables(lines);
        renderTables();
        overlayEl.classList.add('active');
    }

    function closeOverlay() {
        if (overlayEl) overlayEl.classList.remove('active');
        tablesData = [];
    }

    function saveAndClose() {
        syncAllCellsFromDOM();
        var textarea = document.getElementById('editorContent');
        if (!textarea) {
            closeOverlay();
            return;
        }

        var lines = textarea.value.split('\n');
        var existing = tablesData.filter(function(t) { return !t.isNew; });
        var newOnes = tablesData.filter(function(t) { return t.isNew; });

        existing.sort(function(a, b) { return b.startLine - a.startLine; });
        existing.forEach(function(t) {
            var newLines = buildMarkdownLines(t.header, t.body);
            lines.splice(t.startLine, t.endLine - t.startLine + 1);
            Array.prototype.splice.apply(lines, [t.startLine, 0].concat(newLines));
        });

        newOnes.forEach(function(t) {
            var newLines = buildMarkdownLines(t.header, t.body);
            if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
                lines.push('');
            }
            newLines.forEach(function(l) { lines.push(l); });
        });

        textarea.value = lines.join('\n');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        window.showMessage('Table saved');
        closeOverlay();
    }

    var plugin = {
        name: 'Better Table',
        description: 'Edit Markdown tables visually with add row and column buttons.',
        version: '1.0',
        init: function(app) {
            injectStyles();
            buildOverlay();
            app.registerToolbarButton({
                icon: '<i class="fas fa-table"></i>',
                tooltip: 'Table Editor',
                action: openOverlay
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
