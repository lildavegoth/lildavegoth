// ==UserScript==
// @name         DeepSeek Tools Manager
// @namespace    http://tampermonkey.net/
// @version      4.2
// @description  Tools Manager - Mobile friendly
// @author       lildavegoth
// @match        https://chat.deepseek.com/*
// @icon        https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/favicon.ico
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SVG_ICONS = {
        refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><title>refresh_1_fill</title><g id="refresh_1_fill" fill="none" fill-rule="evenodd"><path d="M24 0v24H0V0zM12.59 23.26l-.11.00-.71.03-.2.00-.014-.004-.071-.035c-.01-.004-.019-.001-.24.00l-.004.01-.17.43.005.02.1.01.104.07.15.00.012-.4.10-.74.01-.16.00-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.13.00-.185.09-.01.01-.3.01.018.43.01.12.01.7.20.093c.12.00.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.00a.23.02 0 0 0-.27.01l-.6.01-.34.61c0 .12.01.2.02.024l.015-.2.20-.093.01-.8.00-.11.02-.43-.003-.012-.01-.01z"/><path fill="#C1FC32" d="M10.7 19.37a7.50 7.50 0 0 0 7.88-3.78 1.5 1.5 0 0 1 2.63 1.44c-2.10 3.83-6.48 6.09-11.03 5.29-5.71-1.01-9.52-6.45-8.52-12.16C2.67 4.46 8.12.641 13.83 1.65a10.50 10.50 0 0 1 8.63 9.34c.125 1.31-1.26 2.16-2.37 1.55l-2.82-1.56c-1.55-.857-.767-3.22.99-2.99l.102.01A7.5 7.5 0 1 0 10.7 19.37"/></g></svg>',
        clear: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><title>delete_2_fill</title><g id="delete_2_fill" fill="none" fill-rule="evenodd"><path d="M24 0v24H0V0zM12.59 23.26l-.11.00-.71.03-.2.00-.014-.004-.071-.035c-.01-.004-.019-.001-.24.00l-.004.01-.17.43.005.02.1.01.104.07.15.00.012-.4.10-.74.01-.16.00-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.13.00-.185.09-.01.01-.3.01.018.43.01.12.01.7.20.093c.12.00.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.00a.23.02 0 0 0-.27.01l-.6.01-.34.61c0 .12.01.2.02.024l.015-.2.20-.093.01-.8.00-.11.02-.43-.003-.012-.01-.01z"/><path fill="#C1FC32" d="M14.28 2a2 2 0 0 1 1.90 1.37L16.72 5H20a1 1 0 1 1 0 2l-.3.07-.867 12.14A3 3 0 0 1 16.14 22H7.86a3 3 0 0 1-2.99-2.79L4.00 7.07A1.01 1.01 0 0 1 4 7a1 1 0 0 1 0-2h3.28l.543-1.63A2 2 0 0 1 9.72 2zM9 10a1 1 0 0 0-.993.88L8 11v6a1 1 0 0 0 1.99.117L10 17v-6a1 1 0 0 0-1-1m6 0a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1m-.72-6H9.72l-.333 1h5.23z"/></g></svg>',
        timer: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><title>stopwatch_fill</title><g id="stopwatch_fill" fill="none"><path d="M24 0v24H0V0zM12.59 23.26l-.11.00-.71.03-.2.00-.014-.004-.071-.035c-.01-.004-.019-.001-.24.00l-.004.01-.17.43.005.02.1.01.104.07.15.00.012-.4.10-.74.01-.16.00-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.13.00-.185.09-.01.01-.3.01.018.43.01.12.01.7.20.093c.12.00.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.00a.23.02 0 0 0-.27.01l-.6.01-.34.61c0 .12.01.2.02.024l.015-.2.20-.093.01-.8.00-.11.02-.43-.003-.012-.01-.01z"/><path fill="#C1FC32" d="M12 2c.937 0 1.85.11 2.73.311a1 1 0 1 1-.452 1.95 9.98 9.98 0 0 0-1.50-.23l-.42-.023.34.02a8.95 8.95 0 0 1 4.07 1.34l.273.18.606-.606a1 1 0 0 1 1.50 1.32l-.83.09-.495.5a9 9 0 1 1-7.10-2.83l.199-.01-.6.00c-.517.02-1.02.08-1.52.174l-.368.08a1 1 0 0 1-.452-1.95C10.15 2.11 11.06 2 12 2m0 6a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1"/></g></svg>',
        memory: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><title>chart_bar_fill</title><g id="chart_bar_fill" fill="none"><path d="M24 0v24H0V0zM12.59 23.26l-.11.00-.71.03-.2.00-.014-.004-.071-.035c-.01-.004-.019-.001-.24.00l-.004.01-.17.43.005.02.1.01.104.07.15.00.012-.4.10-.74.01-.16.00-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.13.00-.185.09-.01.01-.3.01.018.43.01.12.01.7.20.093c.12.00.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.00a.23.02 0 0 0-.27.01l-.6.01-.34.61c0 .12.01.2.02.024l.015-.2.20-.093.01-.8.00-.11.02-.43-.003-.012-.01-.01z"/><path fill="#C1FC32" d="M13 3a2 2 0 0 1 2.00 1.85L15 5v16H9V5a2 2 0 0 1 1.85-2.00L11 3zm7 5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3V8zM7 11v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/></g></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><title>settings_3_fill</title><g id="settings_3_fill" fill="none" fill-rule="evenodd"><path d="M24 0v24H0V0zM12.59 23.26l-.11.00-.71.03-.2.00-.014-.004-.071-.035c-.01-.004-.019-.001-.24.00l-.004.01-.17.43.005.02.1.01.104.07.15.00.012-.4.10-.74.01-.16.00-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.13.00-.185.09-.01.01-.3.01.018.43.01.12.01.7.20.093c.12.00.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.00a.23.02 0 0 0-.27.01l-.6.01-.34.61c0 .12.01.2.02.024l.015-.2.20-.093.01-.8.00-.11.02-.43-.003-.012-.01-.01z"/><path fill="#C1FC32" d="M9.96 2.81a1.51 1.51 0 0 0-1.40-.203 9.99 9.99 0 0 0-2.98 1.73 1.51 1.51 0 0 0-.524 1.31c.75.75-.058 1.48-.42 2.11-.361.63-.925 1.11-1.61 1.42a1.51 1.51 0 0 0-.875 1.11 10.06 10.06 0 0 0 0 3.44c.93.54.46.93.875 1.11.69.31 1.25.79 1.62 1.42.361.63.494 1.35.419 2.11-.45.45.107.96.524 1.31a9.99 9.99 0 0 0 2.98 1.73 1.51 1.51 0 0 0 1.4-.203c.615-.442 1.31-.691 2.04-.691s1.42.25 2.04.691c.37.27.89.39 1.40.203a9.99 9.99 0 0 0 2.98-1.73c.417-.349.57-.86.52-1.31-.075-.753.06-1.48.42-2.11.361-.627.92-1.10 1.61-1.42.414-.187.78-.577.88-1.11a10.06 10.06 0 0 0 0-3.44 1.51 1.51 0 0 0-.875-1.11c-.69-.311-1.25-.79-1.62-1.42-.362-.626-.494-1.35-.419-2.11a1.51 1.51 0 0 0-.524-1.31 9.99 9.99 0 0 0-2.98-1.73 1.51 1.51 0 0 0-1.4.20C13.42 3.25 12.72 3.5 12 3.5s-1.42-.249-2.04-.691M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0"/></g></svg>'
    };

    const CONFIG = {
        isVisible: false,
        toolsPosition: { top: '70px', right: '20px' }
    };

    const TOOLS = [
        { icon: SVG_ICONS.refresh, title: 'Soft Refresh', action: () => location.reload() },
        { icon: SVG_ICONS.clear, title: 'Clear Cache', action: clearCache },
        { icon: SVG_ICONS.timer, title: '30min Timer', action: setAutoRefresh },
        { icon: SVG_ICONS.memory, title: 'Memory Check', action: checkMemory }
    ];

    window.addEventListener('load', () => {
        createInterface();
    });

    function createInterface() {
        const existing = document.getElementById('deepseekToolsContainer');
        if (existing) existing.remove();
        
        addAnimationStyles();
        
        const container = document.createElement('div');
        container.id = 'deepseekToolsContainer';
        
        const toolsWindow = document.createElement('div');
        toolsWindow.id = 'deepseekToolsWindow';
        toolsWindow.style.cssText = `
            position: fixed;
            top: ${CONFIG.toolsPosition.top};
            right: ${CONFIG.toolsPosition.right};
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(193, 252, 50, 0.3);
            border-radius: 16px;
            padding: 12px;
            flex-direction: column;
            gap: 10px;
            z-index: 999999;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            display: none;
        `;

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'deepseekToolsToggle';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 15px;
            left: 170px;
            width: 37px;
            height: 37px;
            background: transparent;
            border: 1px solid rgba(193, 252, 50, 0.25);
            border-radius: 50%;
            cursor: pointer;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            padding: 0;
        `;
        toggleBtn.innerHTML = SVG_ICONS.settings;
        toggleBtn.title = 'DeepSeek Tools';

        TOOLS.forEach(tool => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                width: 40px;
                height: 40px;
                background: rgba(193, 252, 50, 0.08);
                border: 1px solid rgba(193, 252, 50, 0.15);
                border-radius: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                padding: 0;
                position: relative;
            `;
            
            btn.innerHTML = tool.icon;
            btn.title = tool.title;
            btn.onclick = tool.action;
            
            btn.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(193, 252, 50, 0.15)';
                this.style.transform = 'scale(1.08)';
                this.style.borderColor = 'rgba(193, 252, 50, 0.3)';
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(193, 252, 50, 0.08)';
                this.style.transform = 'scale(1)';
                this.style.borderColor = 'rgba(193, 252, 50, 0.15)';
            });
            
            toolsWindow.appendChild(btn);
        });

        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            if (!CONFIG.isVisible) {
                toolsWindow.style.display = 'flex';
                toolsWindow.classList.add('slide-in');
                toolsWindow.classList.remove('slide-out');
                CONFIG.isVisible = true;
                
                this.style.transform = 'rotate(180deg) scale(1.1)';
                this.style.background = 'rgba(193, 252, 50, 0.2)';
                this.style.borderColor = 'rgba(193, 252, 50, 0.5)';
            } else {
                toolsWindow.classList.remove('slide-in');
                toolsWindow.classList.add('slide-out');
                CONFIG.isVisible = false;
                
                setTimeout(() => {
                    if (!CONFIG.isVisible) {
                        toolsWindow.style.display = 'none';
                    }
                }, 300);
                
                this.style.transform = 'rotate(0deg) scale(1)';
                this.style.background = 'rgba(0, 0, 0, 0.85)';
                this.style.borderColor = 'rgba(193, 252, 50, 0.25)';
            }
        });

        document.addEventListener('click', function(e) {
            const toolsWindowEl = document.getElementById('deepseekToolsWindow');
            const toggleBtnEl = document.getElementById('deepseekToolsToggle');
            
            if (!toolsWindowEl.contains(e.target) && 
                e.target !== toggleBtnEl && 
                !toggleBtnEl.contains(e.target) &&
                CONFIG.isVisible) {
                
                toolsWindowEl.classList.remove('slide-in');
                toolsWindowEl.classList.add('slide-out');
                CONFIG.isVisible = false;
                
                setTimeout(() => {
                    if (!CONFIG.isVisible) {
                        toolsWindowEl.style.display = 'none';
                    }
                }, 300);
                
                toggleBtnEl.style.transform = 'rotate(0deg) scale(1)';
                toggleBtnEl.style.background = 'rgba(0, 0, 0, 0.85)';
                toggleBtnEl.style.borderColor = 'rgba(193, 252, 50, 0.25)';
            }
        });

        container.appendChild(toolsWindow);
        container.appendChild(toggleBtn);
        document.body.appendChild(container);
    }

    function addAnimationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInFromRight {
                from {
                    transform: translateX(120%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutToRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(120%);
                    opacity: 0;
                }
            }
            
            #deepseekToolsWindow.slide-in {
                animation: slideInFromRight 0.3s ease-out forwards;
            }
            
            #deepseekToolsWindow.slide-out {
                animation: slideOutToRight 0.3s ease-in forwards;
            }
            
            @media (max-width: 768px) {
                #deepseekToolsWindow {
                    top: 60px;
                    right: 10px;
                    padding: 10px;
                    gap: 8px;
                }
                
                #deepseekToolsToggle {
                    top: 10px;
                    right: 10px;
                    width: 36px;
                    height: 36px;
                }
                
                #deepseekToolsWindow button {
                    width: 36px;
                    height: 36px;
                }
            }
            
            @media (max-width: 480px) {
                #deepseekToolsWindow {
                    top: 50px;
                    right: 8px;
                    padding: 8px;
                    gap: 6px;
                }
                
                #deepseekToolsToggle {
                    top: 8px;
                    right: 8px;
                    width: 32px;
                    height: 32px;
                }
                
                #deepseekToolsWindow button {
                    width: 32px;
                    height: 32px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function clearCache() {
        localStorage.clear();
        sessionStorage.clear();
        showNotification('Cache cleared!');
        setTimeout(() => location.reload(), 800);
    }
    
    function setAutoRefresh() {
        if (confirm('Set auto-refresh every 30 minutes?')) {
            setInterval(() => {
                if (confirm('Time to refresh to prevent crash!')) {
                    location.reload();
                }
            }, 30 * 60 * 1000);
            showNotification('Auto-refresh set!');
        }
    }
    
    function checkMemory() {
        if (performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
            showNotification(`Memory: ${used}MB`);
        }
    }
    
    function showNotification(msg) {
        const existing = document.getElementById('deepseekNotification');
        if (existing) existing.remove();
        
        const note = document.createElement('div');
        note.id = 'deepseekNotification';
        note.textContent = msg;
        note.style.cssText = `
            position: fixed;
            top: 120px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: #C1FC32;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 1000000;
            border: 1px solid rgba(193, 252, 50, 0.3);
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 2000);
    }
})();
