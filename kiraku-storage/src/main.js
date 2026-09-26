import {
    getStoredCredentials,
    saveCredentials,
    sendCode,
    signIn,
    checkPassword,
    getClient,
    logout,
    getActiveClient
} from './telegram.js'

let currentUser = null
let messages = []
let folders = ['general']
let selectedFolder = 'general'
let phoneNumber = ''
let phoneCodeHash = ''
let currentStep = 'credentials'

const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    mobileMenu: document.getElementById('mobileMenu'),
    mobileTitle: document.getElementById('mobileTitle'),
    folderList: document.getElementById('folderList'),
    selection: document.getElementById('selection'),
    emptyState: document.getElementById('emptyState'),
    workspace: document.getElementById('workspace'),
    folderTitle: document.getElementById('folderTitle'),
    folderMeta: document.getElementById('folderMeta'),
    items: document.getElementById('items'),
    loginModal: document.getElementById('loginModal'),
    folderModal: document.getElementById('folderModal'),
    noteModal: document.getElementById('noteModal'),
    loginForm: document.getElementById('loginForm'),
    folderForm: document.getElementById('folderForm'),
    noteForm: document.getElementById('noteForm'),
    loginTitle: document.getElementById('loginTitle'),
    loginHint: document.getElementById('loginHint'),
    loginError: document.getElementById('loginError'),
    apiId: document.getElementById('apiId'),
    apiHash: document.getElementById('apiHash'),
    phone: document.getElementById('phone'),
    otp: document.getElementById('otp'),
    password: document.getElementById('password'),
    folderName: document.getElementById('folderName'),
    noteTitle: document.getElementById('noteTitle'),
    noteText: document.getElementById('noteText'),
    noteMessageId: document.getElementById('noteMessageId'),
    noteModalTitle: document.getElementById('noteModalTitle'),
    universalPopup: document.getElementById('universalPopup'),
    popupTitle: document.getElementById('popupTitle'),
    popupContent: document.getElementById('popupContent')
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }
        return entities[character]
    })
}

function extractHashtags(text) {
    const matches = text.match(/#[\w]+/g) || []
    return matches.map(tag => tag.substring(1).toLowerCase())
}

function getFolderFromText(text) {
    const tags = extractHashtags(text)
    if (tags.length > 0) {
        const knownFolder = folders.find(folder => folder !== 'general' && tags.includes(folder))
        if (knownFolder) return knownFolder
    }
    return 'general'
}

function getTitleAndBody(text) {
    const lines = text.split('\n')
    if (lines.length > 1) {
        const title = lines[0].replace(/^#\w+\s*/, '')
        const body = lines.slice(1).join('\n')
        return { title, body }
    }
    return { title: '', body: text.replace(/^#\w+\s*/, '') }
}

function formatNoteText(title, text, folder) {
    let folderTag = ''
    if (folder && folder !== 'general') {
        folderTag = '#' + folder + ' '
    }
    return (title ? title + '\n' : '') + folderTag + (text || '')
}

function showLoginError(message) {
    elements.loginError.textContent = message
    elements.loginError.classList.remove('hidden')
}

function clearLoginError() {
    elements.loginError.textContent = ''
    elements.loginError.classList.add('hidden')
}

function setLoginStep(step) {
    currentStep = step
    clearLoginError()
    elements.apiId.classList.add('hidden')
    elements.apiHash.classList.add('hidden')
    elements.phone.classList.add('hidden')
    elements.otp.classList.add('hidden')
    elements.password.classList.add('hidden')

    if (step === 'credentials') {
        elements.loginTitle.textContent = 'API credentials'
        elements.loginHint.textContent = 'Enter your api_id and api_hash from my.telegram.org'
        elements.apiId.classList.remove('hidden')
        elements.apiHash.classList.remove('hidden')
        elements.apiId.focus()
    } else if (step === 'phone') {
        elements.loginTitle.textContent = 'Phone number'
        elements.loginHint.textContent = 'Enter the phone number linked to your Telegram account'
        elements.phone.classList.remove('hidden')
        elements.phone.focus()
    } else if (step === 'otp') {
        elements.loginTitle.textContent = 'Login code'
        elements.loginHint.textContent = 'Enter the code sent to your Telegram app'
        elements.otp.classList.remove('hidden')
        elements.otp.focus()
    } else if (step === 'password') {
        elements.loginTitle.textContent = 'Two-step verification'
        elements.loginHint.textContent = 'Enter your Telegram cloud password (2FA)'
        elements.password.classList.remove('hidden')
        elements.password.focus()
    }
}

function openLoginModal() {
    if (!elements.loginModal.open) {
        elements.loginModal.showModal()
    }
}

function showLoginState() {
    elements.emptyState.classList.remove('hidden')
    elements.workspace.classList.add('hidden')
}

function showWorkspace() {
    elements.emptyState.classList.add('hidden')
    elements.workspace.classList.remove('hidden')
    render()
}

async function loadMessages() {
    const client = await getClient()
    const result = await client.getMessages('me', { limit: 100 })
    messages = result
        .filter(msg => msg.message && !msg.media)
        .map(msg => ({
            id: msg.id,
            text: msg.message,
            date: msg.date
        }))

    const hashtags = new Set()
    messages.forEach(msg => {
        const tags = extractHashtags(msg.text)
        tags.forEach(tag => hashtags.add(tag))
    })

    folders = ['general', ...Array.from(hashtags).filter(tag => tag !== 'general')]
    if (!folders.includes(selectedFolder)) {
        selectedFolder = 'general'
    }
    render()
}

function renderFolders() {
    elements.folderList.innerHTML = folders.map(folder => {
        const active = folder === selectedFolder ? 'active' : ''
        const count = messages.filter(msg => getFolderFromText(msg.text) === folder).length
        const countHtml = count ? `<span class="folder-count">${count}</span>` : ''
        return `
            <button class="folder-item ${active}" type="button" data-folder="${folder}">
                <span class="folder-icon">
                    <i class="fa-solid fa-folder"></i>
                </span>
                <span class="folder-name">${escapeHtml(folder.charAt(0).toUpperCase() + folder.slice(1))}</span>
                ${countHtml}
            </button>
        `
    }).join('')

    elements.folderList.querySelectorAll('[data-folder]').forEach(button => {
        button.addEventListener('click', () => {
            selectedFolder = button.dataset.folder
            render()
            closeSidebar()
        })
    })

    elements.selection.textContent = selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1)
}

function renderWorkspace() {
    const folderMessages = messages.filter(msg => getFolderFromText(msg.text) === selectedFolder)

    elements.folderTitle.textContent = selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1)
    elements.mobileTitle.textContent = selectedFolder.charAt(0).toUpperCase() + selectedFolder.slice(1)
    elements.folderMeta.textContent = folderMessages.length
        ? `${folderMessages.length} item${folderMessages.length === 1 ? '' : 's'}`
        : 'Empty'

    if (!folderMessages.length) {
        elements.items.innerHTML = `
            <div class="empty-folder">
                <i class="fa-regular fa-folder-open"></i>
                <div>No saved messages in this folder.</div>
            </div>
        `
        return
    }

    elements.items.innerHTML = folderMessages.map(msg => {
        const { title, body } = getTitleAndBody(msg.text)
        return `
            <article class="item">
                ${title ? `<div class="item-title">${escapeHtml(title)}</div>` : ''}
                <div class="item-text">${escapeHtml(body)}</div>
                <div class="item-footer">
                    <button class="edit-button" type="button" data-message-id="${msg.id}">
                        <i class="fa-solid fa-pen"></i>
                        Edit
                    </button>
                    <button class="delete-button" type="button" data-message-id="${msg.id}">
                        <i class="fa-solid fa-trash"></i>
                        Delete
                    </button>
                </div>
            </article>
        `
    }).join('')

    elements.items.querySelectorAll('.edit-button').forEach(button => {
        button.addEventListener('click', () => {
            const messageId = Number(button.dataset.messageId)
            const msg = messages.find(m => m.id === messageId)
            if (msg) {
                const { title, body } = getTitleAndBody(msg.text)
                elements.noteModalTitle.textContent = 'Edit note'
                elements.noteTitle.value = title
                elements.noteText.value = body
                elements.noteMessageId.value = messageId
                elements.noteModal.showModal()
            }
        })
    })

    elements.items.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', async () => {
            const messageId = Number(button.dataset.messageId)
            if (confirm('Delete this message?')) {
                try {
                    const client = await getClient()
                    await client.deleteMessages('me', [messageId], { revoke: true })
                    messages = messages.filter(m => m.id !== messageId)
                    render()
                } catch (error) {
                    alert('Failed to delete message: ' + (error.message || error))
                }
            }
        })
    })
}

function render() {
    renderFolders()
    renderWorkspace()
}

function closeSidebar() {
    elements.sidebar.classList.remove('open')
    elements.sidebarOverlay.classList.remove('open')
}

function openSidebar() {
    elements.sidebar.classList.add('open')
    elements.sidebarOverlay.classList.add('open')
}

function openGuidePopup() {
    const guideHTML = `
        <h3>Welcome to Kiraku Storage</h3>
        <p>This app organizes your Telegram Saved Messages into folders using hashtags.</p>
        <h3>Setup Instructions</h3>
        <ul>
            <li>Go to <strong>my.telegram.org</strong> and log in with your Telegram account.</li>
            <li>Click on <strong>API development tools</strong> and fill out the form.</li>
            <li>You will receive an <strong>API ID</strong> and <strong>API Hash</strong>. Enter them in the login form.</li>
            <li>Enter your phone number in international format (e.g., +1234567890).</li>
            <li>Telegram will send a verification code. Enter it.</li>
            <li>If you have two-step verification enabled, enter your password.</li>
            <li>After login, your Saved Messages will be loaded and organized by hashtags.</li>
        </ul>
        <h3>How to Use</h3>
        <ul>
            <li>Create a new folder by clicking the <strong>+</strong> button in the sidebar.</li>
            <li>The folder name becomes a hashtag (e.g., "Work" becomes #Work).</li>
            <li>Add a note by clicking <strong>Add note</strong>.</li>
            <li>The first line becomes the title, the rest becomes the body.</li>
            <li>Edit or delete notes directly from the interface. Changes sync to Telegram.</li>
            <li>Click <strong>Logout</strong> to disconnect and remove the session.</li>
        </ul>
        <h3>Important Notes</h3>
        <ul>
            <li>Your API credentials and session are stored only in your browser.</li>
            <li>Never share your API credentials or session with anyone.</li>
        </ul>
    `
    elements.popupTitle.textContent = 'Guide'
    elements.popupContent.innerHTML = guideHTML
    elements.universalPopup.style.display = 'flex'
}

function closeUniversalPopup() {
    elements.universalPopup.style.display = 'none'
}

async function afterLoginSuccess() {
    const client = getActiveClient()
    currentUser = await client.getMe()
    await loadMessages()
    if (elements.loginModal.open) {
        elements.loginModal.close()
    }
    showWorkspace()
}

async function initClient() {
    const { apiId, apiHash, session } = getStoredCredentials()
    if (!apiId || !apiHash || !session) {
        showLoginState()
        return
    }
    try {
        await getClient()
        currentUser = await getActiveClient().getMe()
        await loadMessages()
        showWorkspace()
    } catch (error) {
        showLoginState()
    }
}

document.getElementById('connectButton').addEventListener('click', () => {
    clearLoginError()
    const saved = getStoredCredentials()
    if (saved.apiId) elements.apiId.value = saved.apiId
    if (saved.apiHash) elements.apiHash.value = saved.apiHash
    setLoginStep('credentials')
    openLoginModal()
})

document.getElementById('guideButton').addEventListener('click', openGuidePopup)
document.getElementById('closePopupButton').addEventListener('click', closeUniversalPopup)

document.getElementById('cancelLogin').addEventListener('click', () => {
    phoneCodeHash = ''
    elements.loginModal.close()
})

elements.loginForm.addEventListener('submit', async event => {
    event.preventDefault()
    clearLoginError()

    if (currentStep === 'credentials') {
        const id = elements.apiId.value.trim()
        const hash = elements.apiHash.value.trim()
        if (!id || !hash) {
            showLoginError('API ID and API Hash are required.')
            return
        }
        saveCredentials(id, hash)
        setLoginStep('phone')
        return
    }

    if (currentStep === 'phone') {
        const phone = elements.phone.value.trim()
        if (!phone) {
            showLoginError('Phone number is required.')
            return
        }
        phoneNumber = phone
        elements.loginHint.textContent = 'Sending code... please wait.'
        try {
            phoneCodeHash = await sendCode(phone)
            setLoginStep('otp')
        } catch (error) {
            const msg = error.errorMessage || error.message || String(error)
            showLoginError('Failed to send code: ' + msg)
            elements.loginHint.textContent = 'Enter the phone number linked to your Telegram account'
        }
        return
    }

    if (currentStep === 'otp') {
        const code = elements.otp.value.trim()
        if (!code) {
            showLoginError('Login code is required.')
            return
        }
        elements.loginHint.textContent = 'Verifying code...'
        try {
            await signIn(phoneNumber, phoneCodeHash, code)
            await afterLoginSuccess()
        } catch (error) {
            const msg = error.errorMessage || error.message || String(error)
            if (msg.includes('SESSION_PASSWORD_NEEDED')) {
                setLoginStep('password')
            } else {
                showLoginError('Login failed: ' + msg)
                elements.loginHint.textContent = 'Enter the code sent to your Telegram app'
            }
        }
        return
    }

    if (currentStep === 'password') {
        const pwd = elements.password.value
        if (!pwd) {
            showLoginError('Cloud password is required.')
            return
        }
        elements.loginHint.textContent = 'Verifying password...'
        try {
            await checkPassword(pwd)
            await afterLoginSuccess()
        } catch (error) {
            const msg = error.errorMessage || error.message || String(error)
            showLoginError('Password failed: ' + msg)
            elements.loginHint.textContent = 'Enter your Telegram cloud password (2FA)'
        }
    }
})

document.getElementById('disconnectButton').addEventListener('click', async () => {
    await logout()
    messages = []
    folders = ['general']
    selectedFolder = 'general'
    phoneCodeHash = ''
    phoneNumber = ''
    currentUser = null
    showLoginState()
})

document.getElementById('newFolderButton').addEventListener('click', () => {
    elements.folderName.value = ''
    elements.folderModal.showModal()
    elements.folderName.focus()
})

document.getElementById('addNoteButton').addEventListener('click', () => {
    elements.noteModalTitle.textContent = 'Add note'
    elements.noteTitle.value = ''
    elements.noteText.value = ''
    elements.noteMessageId.value = ''
    elements.noteModal.showModal()
    elements.noteTitle.focus()
})

document.getElementById('cancelFolder').addEventListener('click', () => {
    elements.folderModal.close()
})

document.getElementById('cancelNote').addEventListener('click', () => {
    elements.noteModal.close()
})

elements.folderForm.addEventListener('submit', event => {
    event.preventDefault()
    const name = elements.folderName.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!name) return
    if (folders.includes(name)) {
        alert('Folder already exists.')
        return
    }
    folders.push(name)
    selectedFolder = name
    elements.folderModal.close()
    render()
})

elements.noteForm.addEventListener('submit', async event => {
    event.preventDefault()
    const title = elements.noteTitle.value.trim()
    const text = elements.noteText.value.trim()
    const messageId = elements.noteMessageId.value

    if (!text) {
        alert('Text cannot be empty.')
        return
    }

    const finalText = formatNoteText(title, text, selectedFolder)

    try {
        const client = await getClient()
        if (messageId) {
            await client.editMessage('me', {
                message: parseInt(messageId),
                text: finalText
            })
        } else {
            await client.sendMessage('me', { message: finalText })
        }

        elements.noteModal.close()
        await loadMessages()
        render()
    } catch (error) {
        alert('Failed to save note: ' + (error.message || error))
    }
})

document.getElementById('clearSelection').addEventListener('click', () => {
    selectedFolder = 'general'
    render()
})

document.getElementById('accountButton').addEventListener('click', () => {
    if (currentUser) {
        alert('Logged in as ' + (currentUser.firstName || '') + ' ' + (currentUser.lastName || '') + ' (@' + (currentUser.username || 'no username') + ')')
    } else {
        alert('Not connected.')
    }
})

document.getElementById('settingsButton').addEventListener('click', () => {
    alert('Settings: API credentials are stored locally. Session is stored in your browser.')
})

document.getElementById('devicesButton').addEventListener('click', () => {
    alert('Active session is stored in this browser.')
})

document.getElementById('quickMenuButton').addEventListener('click', () => {
    alert('Quick access: select a folder from the list.')
})

elements.mobileMenu.addEventListener('click', openSidebar)
elements.sidebarOverlay.addEventListener('click', closeSidebar)

window.addEventListener('resize', () => {
    if (window.innerWidth > 760) {
        closeSidebar()
    }
})

initClient()
