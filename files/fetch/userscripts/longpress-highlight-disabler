// ==UserScript==
// @name         Long Press Highlight Disabler
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Disables the blue highlight on long press for URLs and elements with embedded URLs
// @author       lildavegoth
// @match        *://*/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    var style = document.createElement('style');
    style.textContent = '* { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }';
    document.head.appendChild(style);
})();
