    function buildSettingsUI() {
        injectStyles();
        if (document.getElementById('homepagePluginSection')) return;

        var settingsPage = document.getElementById('settings-page');
        if (!settingsPage) return;

        var section = document.createElement('div');
        section.id = 'homepagePluginSection';

        var card = document.createElement('div');
        card.className = 'settings-card';
        card.style.cursor = 'default';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.style.gap = '0';

        var headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:16px;';

        var icon = document.createElement('div');
        icon.className = 'settings-card-icon';
        icon.innerHTML = '<i class="fas fa-home"></i>';

        var content = document.createElement('div');
        content.className = 'settings-card-content';
        content.innerHTML =
            '<div class="settings-card-title">Homepage Note</div>' +
            '<div class="settings-card-desc">Type a note title to open automatically on launch</div>';

        headerRow.appendChild(icon);
        headerRow.appendChild(content);

        var inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;width:100%;';

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'homepage-card-input';
        input.placeholder = 'Note title...';
        input.value = getHomepageTitle();
        input.style.flex = '1';
        input.style.minWidth = '0';

        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'homepage-card-save';
        saveBtn.textContent = 'Save';

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'homepage-card-clear';
        clearBtn.textContent = 'Clear';

        saveBtn.addEventListener('click', function() {
            var title = input.value.trim();
            if (!title) {
                window.showMessage('Please enter a note title');
                return;
            }
            var note = findNoteByTitle(title);
            if (!note) {
                window.showMessage('No note found with that title');
                return;
            }
            setHomepageTitle(title);
            window.showMessage('Homepage set: ' + title);
        });

        clearBtn.addEventListener('click', function() {
            setHomepageTitle('');
            input.value = '';
            window.showMessage('Homepage removed');
        });

        inputRow.appendChild(input);
        inputRow.appendChild(saveBtn);
        inputRow.appendChild(clearBtn);

        card.appendChild(headerRow);
        card.appendChild(inputRow);

        section.appendChild(card);

        var pluginsList = document.getElementById('pluginsList');
        if (pluginsList && pluginsList.parentNode === settingsPage) {
            settingsPage.insertBefore(section, pluginsList);
        } else {
            settingsPage.appendChild(section);
        }
    }