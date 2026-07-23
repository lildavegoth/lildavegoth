// ==UserScript==
// @name         Long Press Highlight Disabler
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Disables the blue highlight on long press for URLs and elements with embedded URLs
// @author       lildavegoth
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var style = document.createElement('style');
    style.textContent = '* { -webkit-tap-highlight-color: transparent !important; -webkit-touch-callout: none !important; }';
    document.head.appendChild(style);
})();