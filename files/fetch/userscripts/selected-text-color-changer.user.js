// ==UserScript==
// @name         Selected Text Color Changer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Change selected text color to Kakoi Kiraku Accent Color
// @author       lildavegoth
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    var style = document.createElement('style');
    style.textContent = '::selection { color: #C1FC32 !important; } ::-moz-selection { color: #C1FC32 !important; } ::-webkit-selection { color: #C1FC32 !important; }';

    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            document.head.appendChild(style);
        });
    }
})();