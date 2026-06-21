const OPTIONS = {
    delayMs: 3500,
    openDelayMs: 600,
    maxActions: 300,
    autoScroll: true,
    scrollStep: 1400
};

window.__unfollowStopFlag = false;
window.bulkStop = () => { window.__unfollowStopFlag = true; };

function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function txt(el) {
    return (el?.innerText || el?.textContent || "").trim();
}

function qsa(sel, root = document) {
    return [...root.querySelectorAll(sel)];
}

function inViewport(el) {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
}

function closeOpenMenus() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    qsa('[role="menu"], [role="dialog"], [aria-modal="true"], .uiLayer, .uiOverlay').forEach(m => {
        if (m.style) m.style.display = 'none';
    });
}

function parseNameFromAria(el) {
    const al = el.getAttribute('aria-label') || '';
    let m = al.match(/untuk\s+(.+?)\s*$/i) || al.match(/for\s+(.+?)\s*$/i);
    return m ? m[1].trim() : '';
}

function profileLinkNear(el) {
    let n = el;
    for (let i = 0; i < 6 && n && n.parentElement; i++) n = n.parentElement;
    const scope = n || document;
    const a = scope.querySelector('a[role="link"][tabindex]:not([tabindex="-1"])') ||
        scope.querySelector('a[href*="facebook.com"][role="link"]') ||
        scope.querySelector('a[href*="facebook.com"]');
    return a?.href || '';
}

function getOptionButtons() {
    return qsa('[aria-label^="Opsi lainnya untuk"], [aria-label^="More options for"], [aria-label^="Options for"]')
        .filter(b => !b.dataset._done);
}

function findMenuItem(pattern) {
    const re = new RegExp(pattern, 'i');
    const candidates = qsa('[role="menuitem"], [role="button"], button, div[role="menuitem"]');
    return candidates.find(n => re.test(txt(n)));
}

function isFriend(container) {
    const texts = qsa('span, div, a', container).map(txt);
    return texts.some(t => /friend|teman/i.test(t));
}

async function waitForDialogToClose() {
    let dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
    while (dialog) {
        await wait(300);
        dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
    }
}

async function doAction(index) {
    closeOpenMenus();

    let btn = getOptionButtons().find(inViewport) || getOptionButtons()[0];
    if (!btn) {
        if (OPTIONS.autoScroll) window.scrollBy({ top: OPTIONS.scrollStep, behavior: 'smooth' });
        return { ok: false, reason: 'NoOptionButton' };
    }

    const container = btn.closest ? btn.closest('div[role="article"], div[data-ad-comet-preview]') : null;
    if (container && isFriend(container)) {
        btn.dataset._done = "1";
        return { ok: false, reason: 'FriendSkipped' };
    }

    btn.dataset._done = "1";
    btn.scrollIntoView({ block: 'center' });

    const name = parseNameFromAria(btn) || '';
    const url = profileLinkNear(btn);

    btn.click();
    await wait(OPTIONS.openDelayMs);

    let blockItem = findMenuItem('^(Blokir|Block)$');
    if (blockItem) {
        blockItem.click();
        await wait(800);

        let dialog = null;
        let tries = 0;
        while (!dialog && tries < 15) {
            dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
            if (!dialog) await wait(500);
            tries++;
        }

        if (dialog) {
            await waitForDialogToClose();
            closeOpenMenus();
            return { ok: true, meta: { name, url } };
        } else {
            closeOpenMenus();
            return { ok: false, reason: 'NoBlockDialog' };
        }
    }

    return { ok: false, reason: 'NoBlockItem' };
}

async function run() {
    for (let i = 1; i <= OPTIONS.maxActions; i++) {
        if (window.__unfollowStopFlag) break;
        await doAction(i);
        await wait(OPTIONS.delayMs);
    }
}
run();
