function isUserLoggedIn() {
    const currentUser = localStorage.getItem('currentUser');
    return currentUser ? JSON.parse(currentUser) : null;
}

function getCurrentUser() {
    return isUserLoggedIn();
}

function checkAuth(redirectToLogin = true) {
    const user = isUserLoggedIn();
    if (!user && redirectToLogin) {
        window.location.href = '../account.html';
        return false;
    }
    return user;
}

function protectPage() {
    return checkAuth(true);
}

function showSignInNotification() {
    const existingNotification = document.getElementById('authNotification');
    if (existingNotification) existingNotification.remove();
    const notification = document.createElement('div');
    notification.id = 'authNotification';
    notification.style.cssText = `
        position: fixed;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(22, 22, 24, 0.6);
        backdrop-filter: saturate(180%) blur(20px);
        -webkit-backdrop-filter: saturate(180%) blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 0;
        min-width: 350px;
        max-width: 450px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        animation: fadeInDown 0.4s ease forwards;
    `;
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        flex: 1;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    const messageText = document.createElement('div');
    messageText.style.cssText = `flex: 1;`;
    const title = document.createElement('div');
    title.style.cssText = `font-weight: 600; font-size: 15px; margin-bottom: 4px; margin-left: 10px; color: #f5f5f7;`;
    title.textContent = 'Sign In Required';
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `font-size: 12px; color: #a1a1a6; margin-left: 10px;`;
    subtitle.textContent = 'You need to sign in to access this feature';
    messageText.appendChild(title);
    messageText.appendChild(subtitle);
    messageContainer.appendChild(messageText);
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `padding: 20px 24px;`;
    const signInButton = document.createElement('button');
    signInButton.style.cssText = `
        background: #C1FC32;
        color: #000000;
        border: none;
        padding: 9px 21px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 120px;
        justify-content: center;
    `;
    signInButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    signInButton.onmouseover = () => { signInButton.style.background = '#9bc726'; signInButton.style.transform = 'translateY(-2px)'; };
    signInButton.onmouseout = () => { signInButton.style.background = '#C1FC32'; signInButton.style.transform = 'translateY(0)'; };
    signInButton.onclick = () => { window.location.href = '../account.html'; };
    buttonContainer.appendChild(signInButton);
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOutUp {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    notification.appendChild(messageContainer);
    notification.appendChild(buttonContainer);
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode && document.getElementById('authNotification')) {
            notification.style.animation = 'fadeOutUp 0.4s ease forwards';
            setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 400);
        }
    }, 5000);
    return notification;
}

function createProtectedLink(elementId, targetPage) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.addEventListener('click', function(e) {
        if (!isUserLoggedIn()) {
            e.preventDefault();
            e.stopPropagation();
            showSignInNotification();
            return false;
        }
        window.location.href = targetPage;
    });
}

function showAuthStatus(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const user = isUserLoggedIn();
    if (user) {
        element.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 12px;
                background: rgba(193, 252, 50, 0.1);
                border-radius: 12px;
                border: 1px solid rgba(193, 252, 50, 0.3);
                cursor: pointer;
                transition: all 0.3s ease;
            " onclick="window.location.href='../account.html'">
                <div style="
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(193, 252, 50, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 12px;
                    color: #C1FC32;
                ">${user.username.charAt(0).toUpperCase()}</div>
                <div style="font-size: 14px;">
                    <div style="font-weight: 600; color: #f5f5f7;">${user.username}</div>
                    <div style="font-size: 11px; color: #a1a1a6;">${user.id.substring(0, 8)}...</div>
                </div>
            </div>
        `;
    } else {
        element.innerHTML = `
            <a href="../account.html" style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #f5f5f7;
                text-decoration: none;
                font-size: 14px;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(193, 252, 50, 0.1)'; this.style.borderColor='rgba(193, 252, 50, 0.3)'"
            onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.1)'">
                <i class="fas fa-user" style="font-size: 14px;"></i>
                Sign In
            </a>
        `;
    }
}

function saveUserData(key, data) {
    const user = isUserLoggedIn();
    if (!user) {
        showSignInNotification();
        return false;
    }
    const userKey = `${user.id}_${key}`;
    localStorage.setItem(userKey, JSON.stringify(data));
    return true;
}

function loadUserData(key) {
    const user = isUserLoggedIn();
    if (!user) {
        showSignInNotification();
        return null;
    }
    const userKey = `${user.id}_${key}`;
    const data = localStorage.getItem(userKey);
    return data ? JSON.parse(data) : null;
}

function clearUserData(key) {
    const user = isUserLoggedIn();
    if (!user) {
        showSignInNotification();
        return false;
    }
    const userKey = `${user.id}_${key}`;
    localStorage.removeItem(userKey);
    return true;
}

function protectElement(element) {
    element.addEventListener('click', function(e) {
        if (!isUserLoggedIn()) {
            e.preventDefault();
            e.stopPropagation();
            showSignInNotification();
            return false;
        }
        if (element.tagName === 'A' && element.href) {
            window.location.href = element.href;
        }
    });
}

function autoProtect() {
    document.querySelectorAll('.protected-link, .protected-action').forEach(link => protectElement(link));
    if (document.body.classList.contains('protected-page')) {
        const user = checkAuth(false);
        if (!user) {
            showSignInNotification();
            setTimeout(() => { window.location.href = '../account.html'; }, 3000);
        }
    }
}

document.addEventListener('DOMContentLoaded', autoProtect);

window.authCheck = {
    isUserLoggedIn,
    getCurrentUser,
    checkAuth,
    protectPage,
    createProtectedLink,
    showAuthStatus,
    showSignInNotification,
    saveUserData,
    loadUserData,
    clearUserData
};