import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { PromisedWebSockets } from 'telegram/extensions/PromisedWebSockets'
import { Api } from 'telegram'
import { computeCheck } from 'telegram/Password'

const SESSION_KEY = 'kiraku-session'
const API_ID_KEY = 'kiraku-api-id'
const API_HASH_KEY = 'kiraku-api-hash'

let client = null

export function getStoredCredentials() {
    return {
        apiId: localStorage.getItem(API_ID_KEY),
        apiHash: localStorage.getItem(API_HASH_KEY),
        session: localStorage.getItem(SESSION_KEY)
    }
}

export function saveCredentials(apiId, apiHash, session = '') {
    localStorage.setItem(API_ID_KEY, String(apiId))
    localStorage.setItem(API_HASH_KEY, apiHash)
    if (session) {
        localStorage.setItem(SESSION_KEY, session)
    }
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY)
    client = null
}

export async function createClient(apiId, apiHash, sessionString = '') {
    const session = new StringSession(sessionString || '')
    client = new TelegramClient(session, Number(apiId), apiHash, {
        connectionRetries: 5,
        useWSS: true,
        networkSocket: PromisedWebSockets
    })
    await client.connect()
    return client
}

export async function sendCode(phone) {
    const { apiId, apiHash } = getStoredCredentials()
    if (!client) {
        await createClient(apiId, apiHash)
    }
    const result = await client.invoke(
        new Api.auth.SendCode({
            phoneNumber: phone,
            apiId: Number(apiId),
            apiHash,
            settings: new Api.CodeSettings({})
        })
    )
    return result.phoneCodeHash
}

export async function signIn(phone, phoneCodeHash, code) {
    await client.invoke(
        new Api.auth.SignIn({
            phoneNumber: phone,
            phoneCodeHash,
            phoneCode: code
        })
    )
    const session = client.session.save()
    localStorage.setItem(SESSION_KEY, session)
    return client
}

export async function checkPassword(password) {
    const pwd = await client.invoke(new Api.account.GetPassword())
    const check = await computeCheck(pwd, password)
    await client.invoke(new Api.auth.CheckPassword({ password: check }))
    const session = client.session.save()
    localStorage.setItem(SESSION_KEY, session)
    return client
}

export async function getClient() {
    if (client && client.connected) {
        return client
    }

    const { apiId, apiHash, session } = getStoredCredentials()
    if (!apiId || !apiHash || !session) {
        throw new Error('NOT_AUTHENTICATED')
    }

    await createClient(apiId, apiHash, session)
    return client
}

export async function logout() {
    if (client) {
        try {
            await client.disconnect()
        } catch (e) {}
    }
    clearSession()
    client = null
}

export function getActiveClient() {
    return client
}
