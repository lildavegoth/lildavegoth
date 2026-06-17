// ==UserScript==
// @name         YouTube Background Playback
// @description  Enables YouTube videos to play in the background when tab is not active.
// @author       lildavegoth
// @icon         https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @license      MIT
// @match        *://*.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    Object.defineProperty(document, 'hidden', {
        value: false,
        writable: false
    });
    Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: false
    });

    document.addEventListener('visibilitychange', function(e) {
        e.stopImmediatePropagation();
    }, true);
})();
