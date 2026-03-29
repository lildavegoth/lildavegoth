const PAGES_URL = 'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/pages.json';
const POPUP_URL = 'https://j1x1ajaevaygfyxv.public.blob.vercel-storage.com/Index/popup-pages.json';

async function loadPages() {
    const response = await fetch(PAGES_URL);
    const data = await response.json();
    
    document.getElementById('highlight-projects').innerHTML = data.highlightProjects.map(item => `
        <div class="project-card" data-url="${item.url}">
            <div alt="${item.title}" class="img ${item.icon} project-icon"></div>
            <div class="project-title">
                <h3>${item.title}</h3>
            </div>
            <p class="project-description">${item.description}</p>
            <div class="project-tech">
                ${item.tags.map(tag => `<span class="tech-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
    
    document.getElementById('apps-container').innerHTML = data.apps.map(item => {
        if (item.type === 'popup') {
            return `
                <div class="project-card" data-popup="${item.popupType}" data-pin-id="${item.title}">
                    <div class="project-title">
                        <h3>${item.title}</h3>
                    </div>
                    <p class="project-description">${item.description}</p>
                    <div class="project-tech">
                        ${item.tags.map(tag => `<span class="tech-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="project-card" data-url="${item.url}" data-pin-id="${item.title}">
                    <div class="project-title">
                        <h3>${item.title}</h3>
                    </div>
                    <p class="project-description">${item.description}</p>
                    <div class="project-tech">
                        ${item.tags.map(tag => `<span class="tech-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }
    }).join('');
    
    document.getElementById('games-container').innerHTML = data.games.map(item => `
        <div class="project-card" data-url="${item.url}" data-pin-id="${item.title}">
            <div class="project-title">
                <h3>${item.title}</h3>
            </div>
            <p class="project-description">${item.description}</p>
            <div class="project-tech">
                ${item.tags.map(tag => `<span class="tech-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
    
    initPinFeatures();
}

async function loadPopupData() {
    const response = await fetch(POPUP_URL);
    popupData = await response.json();
}

let popupData = {};

function setActivePage(page) {
    const target = document.getElementById(page + '-page');
    const current = document.querySelector('.page-section.active');
    if (current === target) return;
    if (current) {
        current.classList.remove('active');
        current.style.height = '0';
        current.style.overflow = 'hidden';
        current.style.opacity = '0';
        current.style.visibility = 'hidden';
    }
    target.classList.add('active');
    target.style.height = 'auto';
    target.style.overflow = 'visible';
    target.style.opacity = '1';
    target.style.visibility = 'visible';
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.transform = '';
        btn.style.padding = '';
    });
    const activeBtn = document.querySelector(`.nav-button[data-page="${page}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function switchPage(page, event) {
    const currentActivePage = document.querySelector('.page-section.active');
    const targetPage = document.getElementById(page + '-page');
    
    if (currentActivePage === targetPage) return;
    
    document.querySelectorAll('.nav-button').forEach(button => {
        button.classList.remove('active');
        button.style.transform = 'scaleX(1)';
        button.style.padding = '10px 20px';
    });
    
    const clickedButton = event.currentTarget;
    
    if (currentActivePage) {
        currentActivePage.style.opacity = '0';
        currentActivePage.style.visibility = 'hidden';
        
        setTimeout(() => {
            currentActivePage.classList.remove('active');
            currentActivePage.style.height = '0';
            currentActivePage.style.overflow = 'hidden';
            
            targetPage.style.height = 'auto';
            targetPage.style.overflow = 'visible';
            targetPage.classList.add('active');
            
            setTimeout(() => {
                targetPage.style.opacity = '1';
                targetPage.style.visibility = 'visible';
                
                clickedButton.classList.add('active');
                clickedButton.style.transform = 'scaleX(1.1)';
                clickedButton.style.padding = '10px 25px';
                
                window.scrollTo(0, 0);
            }, 50);
        }, 300);
    } else {
        targetPage.style.height = 'auto';
        targetPage.style.overflow = 'visible';
        targetPage.classList.add('active');
        targetPage.style.opacity = '1';
        targetPage.style.visibility = 'visible';
        
        clickedButton.classList.add('active');
        clickedButton.style.transform = 'scaleX(1.1)';
        clickedButton.style.padding = '10px 25px';
        
        window.scrollTo(0, 0);
    }
}

function saveStateBeforeNavigate() {
    const activeSection = document.querySelector('.page-section.active');
    if (!activeSection) return;
    const page = activeSection.id.replace('-page', '');
    const scrollY = window.scrollY;
    sessionStorage.setItem('lastPageState', JSON.stringify({ activePage: page, scrollY: scrollY }));
}

function restoreState() {
    const saved = sessionStorage.getItem('lastPageState');
    if (!saved) return;
    try {
        const { activePage, scrollY } = JSON.parse(saved);
        if (activePage && document.getElementById(activePage + '-page')) {
            setActivePage(activePage);
            setTimeout(() => window.scrollTo(0, scrollY), 50);
        }
    } catch (e) {}
}

document.body.addEventListener('click', (e) => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    if (card.dataset.url && !e.target.closest('.pin-button')) {
        saveStateBeforeNavigate();
        window.location.href = card.dataset.url;
    } else if (card.dataset.popup) {
        openPopup(card.dataset.popup);
    }
});

function openPopup(type) {
    const popup = document.getElementById('universalPopup');
    const title = document.getElementById('popupTitle');
    const content = document.getElementById('popupContent');
    
    title.textContent = popupData[type].title;
    
    if (type === 'credits') {
        content.innerHTML = popupData[type].html;
    } else {
        let itemsHTML = '';
        popupData[type].items.forEach(item => {
            itemsHTML += `
                <div class="tool-option" onclick="window.location.href='${item.url}'">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                </div>
            `;
        });
        content.innerHTML = itemsHTML;
    }
    
    popup.style.display = 'flex';
}

function closeUniversalPopup() {
    document.getElementById('universalPopup').style.display = 'none';
}

function navigateToTool(url) {
    closeUniversalPopup();
    setTimeout(() => {
        window.location.href = url;
    }, 100);
}

function setupCreditsButton() {
    const creditsButton = document.getElementById('creditsBarBtn');
    if (creditsButton) {
        creditsButton.addEventListener('click', function() {
            openPopup('credits');
        });
    }
}

function setupMoreBarToggle() {
    const moreButton = document.getElementById('moreButton');
    const moreBar = document.getElementById('moreBar');
    const overlay = document.getElementById('moreBarOverlay');
    
    if (moreButton && moreBar && overlay) {
        moreButton.addEventListener('click', function(event) {
            event.stopPropagation();
            
            const isActive = moreBar.classList.contains('active');
            
            if (isActive) {
                moreBar.classList.remove('active');
                overlay.classList.remove('active');
                moreButton.classList.remove('active');
            } else {
                moreBar.classList.add('active');
                overlay.classList.add('active');
                moreButton.classList.add('active');
            }
        });
        
        overlay.addEventListener('click', function() {
            moreBar.classList.remove('active');
            overlay.classList.remove('active');
            moreButton.classList.remove('active');
        });
        
        document.addEventListener('click', function(event) {
            if (moreBar.classList.contains('active') && 
                !moreBar.contains(event.target) && 
                event.target !== moreButton && 
                !moreButton.contains(event.target)) {
                moreBar.classList.remove('active');
                overlay.classList.remove('active');
                moreButton.classList.remove('active');
            }
        });
        
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && moreBar.classList.contains('active')) {
                moreBar.classList.remove('active');
                overlay.classList.remove('active');
                moreButton.classList.remove('active');
            }
        });
        
        const moreBarItems = moreBar.querySelectorAll('.more-bar-item');
        moreBarItems.forEach(item => {
            item.addEventListener('click', function() {
                setTimeout(() => {
                    moreBar.classList.remove('active');
                    overlay.classList.remove('active');
                    moreButton.classList.remove('active');
                }, 300);
            });
        });
    }
}

function setupMoreShareButton() {
    const shareButton = document.getElementById('shareBarBtn');
    
    if (shareButton) {
        shareButton.addEventListener('click', async function(event) {
            const shareData = {
                title: 'lildavegoth',
                text: 'Check out lildavegoth\'s amazing projects and tools!',
                url: 'https://kakoi-kiraku-home.vercel.app/',
            };
            
            const originalHTML = shareButton.innerHTML;
            
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    await navigator.clipboard.writeText(shareData.url);
                    
                    shareButton.innerHTML = `
                        <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='#4CAF50'>
                            <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/>
                        </svg>
                        <span class="btn-label">Copied!</span>
                    `;
                    
                    setTimeout(() => {
                        shareButton.innerHTML = originalHTML;
                    }, 1500);
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                
                try {
                    await navigator.clipboard.writeText(shareData.url);
                    
                    shareButton.innerHTML = `
                        <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='#4CAF50'>
                            <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/>
                        </svg>
                        <span class="btn-label">Copied!</span>
                    `;
                    
                    setTimeout(() => {
                        shareButton.innerHTML = originalHTML;
                    }, 1500);
                } catch (clipboardError) {
                    shareButton.innerHTML = `
                        <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='#FF3B30'>
                            <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/>
                        </svg>
                        <span class="btn-label">Error</span>
                    `;
                    
                    setTimeout(() => {
                        shareButton.innerHTML = originalHTML;
                    }, 1500);
                }
            }
        });
    }
}

function setupProfilePicture() {
    const profilePic = document.getElementById('profilePic');
    if (!profilePic) return;
    
    const savedPic = localStorage.getItem('profilePicture');
    if (savedPic) {
        profilePic.style.backgroundImage = `url('${savedPic}')`;
        profilePic.classList.remove('default');
    } else {
        profilePic.classList.add('default');
    }
    
    profilePic.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(readerEvent) {
                    const dataUrl = readerEvent.target.result;
                    profilePic.style.backgroundImage = `url('${dataUrl}')`;
                    profilePic.classList.remove('default');
                    localStorage.setItem('profilePicture', dataUrl);
                };
                reader.readAsDataURL(file);
            }
        };
        
        input.click();
    });
}

document.getElementById('contact-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            showPopupMessage('Success', 'Message sent successfully!');
            form.reset();
        } else {
            showPopupMessage('Error', result.message || 'Failed to send message.');
        }
    } catch (error) {
        showPopupMessage('Error', 'Network error. Please try again.');
    }
});

function showPopupMessage(title, message) {
    const popup = document.getElementById('universalPopup');
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('popupContent').innerHTML = `<div style="padding:20px;text-align:center;">${message}</div>`;
    popup.style.display = 'flex';
}

function showNotificationsPopup() {
    const popup = document.getElementById('notificationPopup');
    const content = document.getElementById('notificationPopupContent');
    const template = document.getElementById('notificationItemsTemplate');
    content.innerHTML = template.innerHTML;
    
    Array.from(content.children).forEach(item => {
        item.addEventListener('click', function() {
            const title = this.getAttribute('data-title');
            scrollToCardByTitle(title);
            closeNotificationPopup();
        });
    });
    
    popup.style.display = 'flex';
}

function closeNotificationPopup() {
    document.getElementById('notificationPopup').style.display = 'none';
}

function scrollToCardByTitle(title) {
    const allCards = document.querySelectorAll('.project-card');
    let foundCard = null;
    let targetPage = '';
    
    allCards.forEach(card => {
        if (card.querySelector('.project-title h3').textContent === title) {
            foundCard = card;
            const gamesSection = document.getElementById('games-page');
            const appsSection = document.getElementById('apps-page');
            if (gamesSection.contains(card)) {
                targetPage = 'games';
            } else if (appsSection.contains(card)) {
                targetPage = 'apps';
            }
        }
    });
    
    if (foundCard && targetPage) {
        setActivePage(targetPage);
        setTimeout(() => {
            foundCard.style.borderColor = 'var(--accent-color)';
            foundCard.style.borderWidth = '2px';
            foundCard.style.transition = 'border-color 0.3s ease, border-width 0.3s ease';
            foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                foundCard.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                foundCard.style.borderWidth = '1px';
            }, 3000);
        }, 100);
    }
}

function performSearch() {
    document.getElementById('searchSuggestions').style.display = 'none';
    const searchInput = document.getElementById('globalSearch');
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) return;
    const allCards = document.querySelectorAll('.project-card');
    let foundCard = null;
    let targetPage = '';
    allCards.forEach(card => {
        const cardTitle = card.querySelector('.project-title h3').textContent.toLowerCase();
        const cardDescription = card.querySelector('.project-description').textContent.toLowerCase();
        if (cardTitle.includes(searchTerm) || cardDescription.includes(searchTerm)) {
            foundCard = card;
            const gamesSection = document.getElementById('games-page');
            const appsSection = document.getElementById('apps-page');
            if (gamesSection.contains(card)) {
                targetPage = 'games';
            } else if (appsSection.contains(card)) {
                targetPage = 'apps';
            }
        }
    });
    if (foundCard && targetPage) {
        setActivePage(targetPage);
        setTimeout(() => {
            foundCard.style.borderColor = 'var(--accent-color)';
            foundCard.style.borderWidth = '2px';
            foundCard.style.transition = 'border-color 0.3s ease, border-width 0.3s ease';
            foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                foundCard.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                foundCard.style.borderWidth = '1px';
            }, 3000);
        }, 100);
    }
}

let searchTimeout;
function setupSearchDebounce() {
    const searchInput = document.getElementById('globalSearch');
    const suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            showSearchSuggestions(this.value);
        });
        
        const searchIcon = searchInput.parentElement.querySelector('.fa-search');
        if (searchIcon) {
            searchIcon.style.pointerEvents = 'auto';
            searchIcon.addEventListener('click', function() {
                suggestionsContainer.style.display = 'none';
                performSearch();
            });
        }
        
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                suggestionsContainer.style.display = 'none';
                performSearch();
            }
        });
        
        searchInput.addEventListener('focus', function() {
            if (this.value.trim()) {
                showSearchSuggestions(this.value);
            }
        });
        
        document.addEventListener('click', function(event) {
            if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
                suggestionsContainer.style.display = 'none';
            }
        });
        
        suggestionsContainer.addEventListener('click', function(event) {
            const suggestionItem = event.target.closest('.search-suggestion-item');
            if (suggestionItem) {
                selectSuggestion(suggestionItem);
            }
        });
        
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && suggestionsContainer.style.display === 'block') {
                suggestionsContainer.style.display = 'none';
            }
        });
    }
}

function showSearchSuggestions(searchTerm) {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!searchTerm.trim()) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    const allCards = document.querySelectorAll('.project-card');
    const suggestions = [];
    const term = searchTerm.toLowerCase();
    allCards.forEach(card => {
        const cardTitle = card.querySelector('.project-title h3').textContent;
        const cardDescription = card.querySelector('.project-description').textContent;
        if (cardTitle.toLowerCase().includes(term) || cardDescription.toLowerCase().includes(term)) {
            const category = card.closest('#games-page') ? 'Games' : card.closest('#apps-page') ? 'Apps' : 'Highlight';
            suggestions.push({ title: cardTitle, description: cardDescription, category: category, element: card });
        }
    });
    if (suggestions.length === 0) {
        suggestionsContainer.innerHTML = `<div class="search-suggestion-item"><div class="suggestion-title">No results found</div><div class="suggestion-description">Try different keywords</div></div>`;
    } else {
        suggestionsContainer.innerHTML = suggestions.slice(0, 5).map(item => `
            <div class="search-suggestion-item" data-card-title="${item.title}">
                <div class="suggestion-title">${item.title}</div>
                <div class="suggestion-description">${item.description}</div>
                <div class="suggestion-category">${item.category}</div>
            </div>
        `).join('');
    }
    suggestionsContainer.style.display = 'block';
}

function selectSuggestion(suggestionItem) {
    const cardTitle = suggestionItem.getAttribute('data-card-title');
    const allCards = document.querySelectorAll('.project-card');

    let foundCard = null;
    let targetPage = '';

    allCards.forEach(card => {
        if (card.querySelector('.project-title h3').textContent === cardTitle) {
            foundCard = card;
            const homeSection = document.getElementById('home-page');
            const gamesSection = document.getElementById('games-page');
            const appsSection = document.getElementById('apps-page');
            if (homeSection.contains(card)) {
                targetPage = 'home';
            } else if (gamesSection.contains(card)) {
                targetPage = 'games';
            } else if (appsSection.contains(card)) {
                targetPage = 'apps';
            }
        }
    });

    if (foundCard && targetPage) {
        if (targetPage !== 'home') {
            setActivePage(targetPage);
        } else {
            const activePage = document.querySelector('.page-section.active');
            if (activePage && activePage.id !== 'home-page') {
                setActivePage('home');
            }
        }
        setTimeout(() => {
            foundCard.style.borderColor = 'var(--accent-color)';
            foundCard.style.borderWidth = '2px';
            foundCard.style.transition = 'border-color 0.3s ease, border-width 0.3s ease';
            foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                foundCard.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                foundCard.style.borderWidth = '1px';
            }, 3000);
            document.getElementById('searchSuggestions').style.display = 'none';
            document.getElementById('globalSearch').value = cardTitle;
        }, 100);
    }
}

function initPinFeatures() {
    const containers = ['apps-container', 'games-container'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = container.querySelectorAll('.project-card');
        cards.forEach(card => {
            const pinId = card.dataset.pinId;
            if (!pinId) return;
            const pinButton = document.createElement('button');
            pinButton.className = 'pin-button';
            pinButton.innerHTML = '<i class="fas fa-thumbtack"></i>';
            pinButton.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePin(card, containerId, pinId);
            });
            card.appendChild(pinButton);
        });
    });
    loadPinnedState();
}

function getStorageKey(containerId) {
    if (containerId === 'apps-container') return 'pinnedAppsContainer';
    if (containerId === 'games-container') return 'pinnedGamesContainer';
    return `pinned${containerId}`; // fallback (not used in current code)
}

function loadPinnedState() {
    const containers = ['apps-container', 'games-container'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const pinnedIds = JSON.parse(localStorage.getItem(getStorageKey(containerId)) || '[]');
        const cards = Array.from(container.querySelectorAll('.project-card'));
        cards.forEach(card => {
            const pinId = card.dataset.pinId;
            const isPinned = pinnedIds.includes(pinId);
            const pinButton = card.querySelector('.pin-button');
            if (isPinned) {
                card.classList.add('pinned');
                if (pinButton) pinButton.classList.add('active');
            } else {
                card.classList.remove('pinned');
                if (pinButton) pinButton.classList.remove('active');
            }
        });
        reorderContainer(containerId);
    });
}

function togglePin(card, containerId, pinId) {
    let pinnedIds = JSON.parse(localStorage.getItem(getStorageKey(containerId)) || '[]');
    const pinButton = card.querySelector('.pin-button');
    if (pinnedIds.includes(pinId)) {
        pinnedIds = pinnedIds.filter(id => id !== pinId);
        card.classList.remove('pinned');
        if (pinButton) pinButton.classList.remove('active');
    } else {
        pinnedIds.push(pinId);
        card.classList.add('pinned');
        if (pinButton) pinButton.classList.add('active');
    }
    localStorage.setItem(getStorageKey(containerId), JSON.stringify(pinnedIds));
    reorderContainer(containerId);
}

function reorderContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const pinnedIds = JSON.parse(localStorage.getItem(getStorageKey(containerId)) || '[]');
    const cards = Array.from(container.querySelectorAll('.project-card'));
    const pinnedCards = [];
    const unpinnedCards = [];

    cards.forEach(card => {
        const pinId = card.dataset.pinId;
        if (pinnedIds.includes(pinId)) {
            pinnedCards.push(card);
        } else {
            unpinnedCards.push(card);
        }
    });

    pinnedCards.sort((a, b) => {
        const indexA = pinnedIds.indexOf(a.dataset.pinId);
        const indexB = pinnedIds.indexOf(b.dataset.pinId);
        return indexA - indexB;
    });

    unpinnedCards.sort((a, b) => {
        const idxA = parseInt(a.dataset.originalIndex, 10);
        const idxB = parseInt(b.dataset.originalIndex, 10);
        return idxA - idxB;
    });

    const allCardsSorted = [...pinnedCards, ...unpinnedCards];
    allCardsSorted.forEach(card => container.appendChild(card));
}

document.addEventListener('DOMContentLoaded', async function() {
    if (window.cordova || /cordova/i.test(navigator.userAgent)) {
        const submissionSection = document.getElementById('submission-section');
        if (submissionSection) submissionSection.style.display = 'none';
    }
    await loadPopupData();
    await loadPages();
    
    if (window.cordova || /cordova/i.test(navigator.userAgent)) {
        const highlightContainer = document.getElementById('highlight-projects');
        if (highlightContainer) {
            const cards = highlightContainer.querySelectorAll('.project-card');
            for (let card of cards) {
                const titleElem = card.querySelector('.project-title h3');
                if (titleElem && titleElem.textContent === 'Browser Homepage') {
                    card.remove();
                    break;
                }
            }
        }
        
        const allContainers = ['highlight-projects', 'apps-container', 'games-container'];
        allContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                const cards = container.querySelectorAll('.project-card');
                cards.forEach(card => {
                    const titleElem = card.querySelector('.project-title h3');
                    if (titleElem && titleElem.textContent === 'AdBlock Checker') {
                        card.remove();
                    }
                });
            }
        });
    }
    
    setupMoreBarToggle();
    setupMoreShareButton();
    setupCreditsButton();
    setupSearchDebounce();
    setupProfilePicture();
    restoreState();
});

document.addEventListener('click', function(event) {
    const popup = document.getElementById('universalPopup');
    const popupContent = document.querySelector('#universalPopup .popup-content');
    
    if (popup.style.display === 'flex' && 
        popupContent && 
        !popupContent.contains(event.target)) {
        
        const isPopupTrigger = event.target.closest('.project-card[data-popup]') || 
                               event.target.closest('#creditsBarBtn');
        
        if (!isPopupTrigger) {
            closeUniversalPopup();
        }
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && 
        document.getElementById('universalPopup').style.display === 'flex') {
        closeUniversalPopup();
    }
});

if (typeof authCheck !== 'undefined') {
    authCheck.createProtectedLink('protectedFeature', 'protected-page.html');
    
    const user = authCheck.isUserLoggedIn();
}