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
