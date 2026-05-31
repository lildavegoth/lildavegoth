(function() {
    const FA_VERSION = '7.2.0';
    const BI_VERSION = '1.13.1';
    const RPG_VERSION = '1.0.0';

    const FA_CSS = `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${FA_VERSION}/css/all.min.css`;
    const BI_CSS = `https://cdn.jsdelivr.net/npm/bootstrap-icons@${BI_VERSION}/font/bootstrap-icons.min.css`;
    const RPG_CSS = `https://cdn.jsdelivr.net/gh/nagoshiashumari/Rpg-Awesome@${RPG_VERSION}/css/rpg-awesome.min.css`;

    const FA_PKG = 'https://data.jsdelivr.com/v1/packages/npm/@fortawesome/fontawesome-free';
    const BI_PKG = 'https://data.jsdelivr.com/v1/packages/npm/bootstrap-icons';

    function loadCSS(url) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    function categorizeIcon(name, isBrand) {
        const lower = name.toLowerCase();
        if (isBrand) return 'Brands';
        if (lower.includes('arrow') || lower.includes('chevron') || lower.includes('angle') || lower.includes('caret')) return 'Arrows';
        if (lower.includes('user') || lower.includes('person') || lower.includes('people')) return 'People';
        if (lower.includes('file') || lower.includes('folder') || lower.includes('document')) return 'Files';
        if (lower.includes('chart') || lower.includes('graph') || lower.includes('bar') || lower.includes('pie')) return 'Charts';
        if (lower.includes('heart') || lower.includes('hospital') || lower.includes('medical') || lower.includes('health')) return 'Health';
        if (lower.includes('bell') || lower.includes('alert') || lower.includes('exclamation') || lower.includes('warning')) return 'Alerts';
        if (lower.includes('envelope') || lower.includes('mail') || lower.includes('message') || lower.includes('comment') || lower.includes('phone')) return 'Communication';
        if (lower.includes('play') || lower.includes('pause') || lower.includes('stop') || lower.includes('music') || lower.includes('video') || lower.includes('camera')) return 'Media';
        if (lower.includes('lock') || lower.includes('key') || lower.includes('shield') || lower.includes('security')) return 'Security';
        if (lower.includes('calendar') || lower.includes('clock') || lower.includes('time') || lower.includes('hourglass')) return 'Time';
        if (lower.includes('map') || lower.includes('location') || lower.includes('pin') || lower.includes('globe')) return 'Maps';
        if (lower.includes('cloud') || lower.includes('sun') || lower.includes('moon') || lower.includes('weather')) return 'Weather';
        if (lower.includes('car') || lower.includes('bus') || lower.includes('train') || lower.includes('plane') || lower.includes('bicycle')) return 'Transportation';
        if (lower.includes('shopping') || lower.includes('cart') || lower.includes('bag') || lower.includes('basket')) return 'Shopping';
        if (lower.includes('game') || lower.includes('dice') || lower.includes('chess') || lower.includes('puzzle')) return 'Gaming';
        if (lower.includes('hand') || lower.includes('thumbs') || lower.includes('finger')) return 'Hands';
        if (lower.includes('gear') || lower.includes('settings') || lower.includes('wrench') || lower.includes('tool')) return 'Tools';
        if (lower.includes('circle') || lower.includes('square') || lower.includes('triangle') || lower.includes('shape')) return 'Shapes';
        if (lower.includes('spinner') || lower.includes('loading') || lower.includes('refresh')) return 'Spinners';
        if (lower.includes('text') || lower.includes('font') || lower.includes('bold') || lower.includes('italic')) return 'Text';
        return 'Other';
    }

    function parseFontAwesomeIcons(cssText) {
        const iconMap = new Map();
        const ruleRegex = /\.(fa-[a-zA-Z0-9-]+)(?::before|,|\s|\{)/g;
        const utilityPrefixes = [
            'fa-stack-', 'fa-ul', 'fa-li', 'fa-fw', 'fa-border',
            'fa-pull-left', 'fa-pull-right', 'fa-spin', 'fa-pulse',
            'fa-rotate-', 'fa-flip-', 'fa-inverse', 'fa-2x', 'fa-3x',
            'fa-4x', 'fa-5x', 'fa-lg', 'fa-sm', 'fa-xs',
            'fa-fade', 'fa-beat', 'fa-beat-fade', 'fa-bounce', 'fa-shake', 'fa-flip'
        ];
        let match;
        while ((match = ruleRegex.exec(cssText)) !== null) {
            const fullClass = match[1];
            if (fullClass === 'fa' || fullClass === 'fa-solid' || fullClass === 'fa-regular' || 
                fullClass === 'fa-brands' || fullClass === 'fa-light' || fullClass === 'fa-thin' || fullClass === 'fa-duotone') continue;
            if (utilityPrefixes.some(prefix => fullClass.startsWith(prefix))) continue;
            const base = fullClass.replace(/^fa-/, '');
            if (!base || !/^[a-zA-Z0-9-]+$/.test(base)) continue;
            if (!iconMap.has(base)) iconMap.set(base, new Set());
        }
        const styleMatches = cssText.matchAll(/\.(fa-solid|fa-regular|fa-brands)\s*\.(fa-[a-zA-Z0-9-]+)(?::before|,|\s|\{)/g);
        for (const m of styleMatches) {
            const styleClass = m[1];
            const iconClass = m[2];
            const baseName = iconClass.replace(/^fa-/, '');
            if (utilityPrefixes.some(prefix => iconClass.startsWith(prefix))) continue;
            if (iconMap.has(baseName)) {
                iconMap.get(baseName).add(styleClass);
            }
        }
        const icons = [];
        for (let [name, styles] of iconMap.entries()) {
            let primaryStyle = 'fa-solid';
            if (styles.has('fa-brands')) primaryStyle = 'fa-brands';
            else if (styles.has('fa-regular') && !styles.has('fa-solid')) primaryStyle = 'fa-regular';
            const prefix = primaryStyle === 'fa-brands' ? 'fab' : (primaryStyle === 'fa-regular' ? 'far' : 'fas');
            const copyValue = `${prefix} fa-${name}`;
            const displayClass = `${primaryStyle} fa-${name}`;
            const category = categorizeIcon(name, primaryStyle === 'fa-brands');
            icons.push({ name, copyValue, displayClass, category });
        }
        return icons.sort((a,b) => a.name.localeCompare(b.name));
    }

    function parseBootstrapIcons(cssText) {
        const set = new Set();
        const patterns = [
            /\.(bi-[a-zA-Z0-9-]+)::before/g,
            /\.(bi-[a-zA-Z0-9-]+):before/g
        ];
        for (const regex of patterns) {
            let match;
            while ((match = regex.exec(cssText)) !== null) {
                const full = match[1];
                if (full === 'bi') continue;
                const name = full.replace(/^bi-/, '');
                if (name && /^[a-zA-Z0-9-]+$/.test(name)) set.add(name);
            }
        }
        return Array.from(set).sort((a,b)=> a.localeCompare(b)).map(name => ({
            name,
            copyValue: `bi bi-${name}`,
            displayClass: `bi bi-${name}`,
            category: categorizeIcon(name, false)
        }));
    }

    function parseRpgIcons(cssText) {
        const set = new Set();
        const regex = /\.(ra-[a-zA-Z0-9-]+)::?before/g;
        let match;
        while ((match = regex.exec(cssText)) !== null) {
            const full = match[1];
            if (full === 'ra') continue;
            const name = full.replace(/^ra-/, '');
            if (name && /^[a-zA-Z0-9-]+$/.test(name)) set.add(name);
        }
        return Array.from(set).sort((a,b)=> a.localeCompare(b)).map(name => ({
            name,
            copyValue: `ra ra-${name}`,
            displayClass: `ra ra-${name}`,
            category: categorizeIcon(name, false)
        }));
    }

    function extractVersion(versionsArray) {
        if (!versionsArray || !versionsArray.length) return null;
        const first = versionsArray[0];
        if (typeof first === 'string') return first;
        if (typeof first === 'object' && first !== null && typeof first.version === 'string') return first.version;
        return null;
    }

    (async () => {
        let latestFA = FA_VERSION;
        let latestBI = BI_VERSION;

        try {
            const [faMeta, biMeta] = await Promise.all([
                fetch(FA_PKG).then(r => r.json()),
                fetch(BI_PKG).then(r => r.json())
            ]);
            const faFromAPI = extractVersion(faMeta.versions);
            if (faFromAPI) latestFA = faFromAPI;
            const biFromAPI = extractVersion(biMeta.versions);
            if (biFromAPI) latestBI = biFromAPI;
        } catch (e) {}

        const latestVersions = {
            fa: latestFA,
            bi: latestBI,
            rpg: RPG_VERSION
        };

        try {
            await Promise.all([loadCSS(FA_CSS), loadCSS(BI_CSS), loadCSS(RPG_CSS)]);

            const [faCss, biCss, rpgCss] = await Promise.all([
                fetch(FA_CSS).then(r => r.text()),
                fetch(BI_CSS).then(r => r.text()),
                fetch(RPG_CSS).then(r => r.text())
            ]);

            window.iconSets = {
                fa: parseFontAwesomeIcons(faCss),
                bi: parseBootstrapIcons(biCss),
                rpg: parseRpgIcons(rpgCss),
                versions: {
                    fa: FA_VERSION,
                    bi: BI_VERSION,
                    rpg: RPG_VERSION
                },
                latest: latestVersions
            };
        } catch (e) {
            window.iconSets = {
                fa: [],
                bi: [],
                rpg: [],
                versions: { fa: FA_VERSION, bi: BI_VERSION, rpg: RPG_VERSION },
                latest: latestVersions
            };
        } finally {
            window.dispatchEvent(new CustomEvent('iconsReady'));
        }
    })();
})();