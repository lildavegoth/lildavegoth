// ==UserScript==
// @name         Selected Text Color Changer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Change selected text color to Kakoi Kiraku Accent Color
// @author       lildavegoth
// @match        *://*/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = '::selection { color: #C1FC32 !important; } ::-moz-selection { color: #C1FC32 !important; }';

    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            document.head.appendChild(style);
        });
    }
})();
