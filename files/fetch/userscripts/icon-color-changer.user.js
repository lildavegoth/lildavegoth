// ==UserScript==
// @name         Icon Color Changer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Change SVG and FontAwesome icons color to Kakoi Kiraku Accent Color
// @author       lildavegoth
// @match        *://*/*
// @exclude      *://kakoi-kiraku-home.vercel.app/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    var style = document.createElement('style');
    style.textContent = 'svg { fill: #C1FC32 !important; } .fa, .fas, .far, .fab, .fa-solid, .fa-regular, .fa-brands, [class*="fa-"] { color: #C1FC32 !important; }';
    document.head.appendChild(style);
})();
