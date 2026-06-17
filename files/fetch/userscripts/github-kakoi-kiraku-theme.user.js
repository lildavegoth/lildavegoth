// ==UserScript==
// @name         GitHub Kakoi Kiraku Theme
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Applies Kakoi Kiraku Theme to GitHub repositories with card-styles.
// @author       lildavegoth
// @match        https://github.com/*
// @match        https://github.com/*/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var style = document.createElement('style');
    style.textContent = `
        html, body {
            background: #000000 !important;
        }

        * {
            box-shadow: none !important;
            border: none !important;
        }

        .octicon-file-directory-fill,
        .octicon-file {
            fill: #C1FC32 !important;
        }

        table[aria-labelledby="folders-and-files"] {
            border-collapse: separate;
            border-spacing: 0 12px;
            background: transparent;
        }

        table[aria-labelledby="folders-and-files"] tbody tr:not(.show-for-mobile) {
            background: rgba(30, 30, 30, 0.7);
            transition: transform 0.1s ease, background 0.1s ease;
        }

        table[aria-labelledby="folders-and-files"] tbody tr:not(.show-for-mobile):hover {
            transform: translateY(-1px);
        }

        table[aria-labelledby="folders-and-files"] tbody tr:not(.show-for-mobile):active {
            background: rgba(50, 50, 50, 0.8);
        }

        table[aria-labelledby="folders-and-files"] tbody td {
            background: transparent;
            padding: 12px 12px;
            vertical-align: middle;
        }

        table[aria-labelledby="folders-and-files"] tbody td:first-child {
            border-radius: 12px 0 0 12px;
            padding-left: 16px;
        }

        table[aria-labelledby="folders-and-files"] tbody td:last-child {
            border-radius: 0 12px 12px 0;
            padding-right: 16px;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-row-name-cell-small-screen td:first-child,
        table[aria-labelledby="folders-and-files"] tbody .react-directory-row-name-cell-large-screen td:first-child {
            border-radius: 12px 0 0 12px;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-row-commit-cell {
            color: var(--color-fg-muted, #8b949e);
            font-size: 0.9em;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-commit-age {
            text-align: right;
            white-space: nowrap;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-filename-column svg {
            margin-right: 8px;
            vertical-align: middle;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-filename-column a {
            font-weight: 500;
            color: var(--color-fg-default, #e6edf3);
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-row-commit-cell a,
        table[aria-labelledby="folders-and-files"] tbody .react-directory-commit-age a {
            color: var(--color-fg-muted, #8b949e);
            text-decoration: none;
        }

        table[aria-labelledby="folders-and-files"] tbody .react-directory-row-commit-cell a:hover,
        table[aria-labelledby="folders-and-files"] tbody .react-directory-commit-age a:hover {
            text-decoration: underline;
        }

        @media (max-width: 768px) {
            table[aria-labelledby="folders-and-files"] tbody td {
                padding: 10px 8px;
            }
            table[aria-labelledby="folders-and-files"] tbody td:first-child {
                padding-left: 12px;
            }
            table[aria-labelledby="folders-and-files"] tbody td:last-child {
                padding-right: 12px;
            }
        }
    `;
    document.head.appendChild(style);
})();
