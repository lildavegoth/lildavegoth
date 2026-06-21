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

function findConfirmButton() {
    const patterns = ['^(Blokir|Block|Konfirmasi|Confirm|OK|Ya|Yes)$', '^Lanjutkan$', '^Continue$'];
    for (let pat of patterns) {
        const btn = findMenuItem(pat);
        if (btn) return btn;
    }
    const allBtns = qsa('button[role="button"], button, [role="button"]');
    return allBtns.find(b => /blokir|block|konfirmasi|confirm|ok|ya|yes|lanjutkan|continue/i.test(txt(b)));
}

async function doAction(index) {
    closeOpenMenus();

    let btn = getOptionButtons().find(inViewport) || getOptionButtons()[0];
    if (!btn) {
        if (OPTIONS.autoScroll) window.scrollBy({ top: OPTIONS.scrollStep, behavior: 'smooth' });
        console.warn(`[#${index}] SKIP: No option button found`);
        return { ok: false, reason: 'NoOptionButton' };
    }

    const container = btn.closest ? btn.closest('div[role="article"], div[data-ad-comet-preview]') : null;
    if (container && isFriend(container)) {
        btn.dataset._done = "1";
        console.warn(`[#${index}] SKIP: Mutual friend`);
        return { ok: false, reason: 'FriendSkipped' };
    }

    btn.dataset._done = "1";
    btn.scrollIntoView({ block: 'center' });

    const name = parseNameFromAria(btn) || '';
    const url = profileLinkNear(btn);

    btn.click();
    await wait(OPTIONS.openDelayMs);

    let item = findMenuItem('^(Batal mengikuti|Berhenti Mengikuti|Berhenti mengikuti|Tak lagi mengikuti|Unfollow|Dejar de seguir|Ne plus suivre|Nicht mehr folgen)$');
    if (item) {
        item.click();
        await wait(400);
        const again = findMenuItem('^(Batal mengikuti|Berhenti Mengikuti|Berhenti mengikuti|Tak lagi mengikuti|Unfollow|Dejar de seguir|Ne plus suivre|Nicht mehr folgen)$');
        if (again) again.click();
        closeOpenMenus();
        console.log(`[#${index}] ✅ UNFOLLOW success: ${name || '(unknown)'}`);
        return { ok: true, meta: { name, url } };
    }

    let blockItem = findMenuItem('^(Blokir|Block)$');
    if (blockItem) {
        blockItem.click();
        console.log(`[#${index}] ⏳ Block clicked, waiting for confirmation...`);
        await wait(3000);

        let confirmBtn = findConfirmButton();
        let retries = 0;
        while (!confirmBtn && retries < 8) {
            await wait(600);
            confirmBtn = findConfirmButton();
            retries++;
        }

        if (confirmBtn) {
            confirmBtn.click();
            console.log(`[#${index}] ✅ Confirmation clicked, waiting for dialog to close...`);
            await wait(2000);
            closeOpenMenus();
            console.log(`[#${index}] 🚫 BLOCK success: ${name || '(unknown)'}`);
            return { ok: true, meta: { name, url } };
        } else {
            closeOpenMenus();
            console.warn(`[#${index}] FAIL: Block confirmation not found`);
            return { ok: false, reason: 'BlockConfirmNotFound' };
        }
    }

    console.warn(`[#${index}] FAIL: No Unfollow or Block found for ${name || '(unknown)'}`);
    return { ok: false, reason: 'NoActionFound' };
}

async function run() {
    console.log('===== Bulk Unfollow Started =====');
    console.log(`Max actions: ${OPTIONS.maxActions} | Delay: ${OPTIONS.delayMs}ms`);
    console.log('Type "bulkStop()" to stop manually');

    for (let i = 1; i <= OPTIONS.maxActions; i++) {
        if (window.__unfollowStopFlag) {
            console.warn('===== Stopped by user =====');
            break;
        }
        await doAction(i);
        await wait(OPTIONS.delayMs);
    }
    console.log('===== Bulk Unfollow Finished =====');
}
run();
