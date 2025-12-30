// Simple XOR encryption/decryption (must match account.html)
function simpleEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
}

function simpleDecrypt(encrypted, key) {
    try {
        const decoded = atob(encrypted);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return JSON.parse(result);
    } catch {
        return null;
    }
}

// Check if user is logged in
function isUserLoggedIn() {
    const currentUser = localStorage.getItem('currentUser');
    return currentUser ? JSON.parse(currentUser) : null;
}

// Get current user info
function getCurrentUser() {
    return isUserLoggedIn();
}

// Check if user has access to specific page/action
function checkAuth(redirectToLogin = true) {
    const user = isUserLoggedIn();
    
    if (!user && redirectToLogin) {
        window.location.href = '../account.html';
        return false;
    }
    
    return user;
}

// Protect specific page - call this on pages that require login
function protectPage() {
    const user = checkAuth(true);
    return user;
}

// Show beautiful sign in notification
function showSignInNotification() {
    // Remove any existing notification
    const existingNotification = document.getElementById('authNotification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification container
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
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = `
        flex: 1;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    // Create message text
    const messageText = document.createElement('div');
    messageText.style.cssText = `
        flex: 1;
    `;
    
    const title = document.createElement('div');
    title.style.cssText = `
        font-weight: 600;
        font-size: 15px;
        margin-bottom: 4px;
        margin-left: 10px;
        color: #f5f5f7;
    `;
    title.textContent = 'Sign In Required';
    
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
        font-size: 12px;
        color: #a1a1a6;
        margin-left: 10px;
    `;
    subtitle.textContent = 'You need to sign in to access this feature';
    
    messageText.appendChild(title);
    messageText.appendChild(subtitle);
    
    messageContainer.appendChild(messageText);
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        padding: 20px 24px;
    `;
    
    // Create sign in button
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
    
    // Add hover effects
    signInButton.onmouseover = function() {
        this.style.background = '#9bc726';
        this.style.transform = 'translateY(-2px)';
    };
    
    signInButton.onmouseout = function() {
        this.style.background = '#C1FC32';
        this.style.transform = 'translateY(0)';
    };
    
    // Add click event
    signInButton.onclick = function() {
        window.location.href = '../account.html';
    };
    
    buttonContainer.appendChild(signInButton);
    
    // Add CSS animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        
        @keyframes fadeOutUp {
            from {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            to {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Assemble notification
    notification.appendChild(messageContainer);
    notification.appendChild(buttonContainer);
    
    // Add to document
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode && document.getElementById('authNotification')) {
            notification.style.animation = 'fadeOutUp 0.4s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }
    }, 5000);
    
    return notification;
}

// Create protected links - for pages that need login
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
        
        // If logged in, proceed to target page
        window.location.href = targetPage;
    });
}

// Add auth status to page (optional)
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

// Save data with user association
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

// Load user-specific data
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

// Clear user-specific data
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

// Function to protect elements with a class
function protectElement(element) {
    element.addEventListener('click', function(e) {
        if (!isUserLoggedIn()) {
            e.preventDefault();
            e.stopPropagation();
            showSignInNotification();
            return false;
        }
        
        // Check if element has href
        if (element.tagName === 'A' && element.href) {
            window.location.href = element.href;
        }
    });
}

// Auto-protect pages with specific class
function autoProtect() {
    // Protect all elements with class 'protected-link'
    document.querySelectorAll('.protected-link').forEach(link => {
        protectElement(link);
    });
    
    // Protect all elements with class 'protected-action'
    document.querySelectorAll('.protected-action').forEach(element => {
        protectElement(element);
    });
    
    // Protect pages with class 'protected-page'
    if (document.body.classList.contains('protected-page')) {
        const user = checkAuth(false);
        if (!user) {
            showSignInNotification();
            // Optional: redirect after delay
            setTimeout(() => {
                window.location.href = '../account.html';
            }, 3000);
        }
    }
}

// Initialize auth system when page loads
document.addEventListener('DOMContentLoaded', function() {
    autoProtect();
});

// Export functions for use in other scripts
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