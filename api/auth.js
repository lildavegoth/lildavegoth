import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => resolve(body))
        req.on('error', reject)
    })
}

function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') return res.status(200).end()

    const dropboxAction = req.query.dropbox_action

    if (dropboxAction) {
        const host = req.headers.host
        const clientId = '5630n4t14l8r80h'
        const redirectUri = `https://${host}/api/auth?dropbox_action=callback`

        if (dropboxAction === 'login') {
            const session = req.query.session
            if (!session) return res.status(400).end('missing session')
            const verifier = base64URLEncode(crypto.randomBytes(32))
            const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest())
            globalThis.verifiers = globalThis.verifiers || {}
            globalThis.verifiers[session] = { verifier, expires: Date.now() + 600000 }
            const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
                client_id: clientId,
                response_type: 'code',
                redirect_uri: redirectUri,
                code_challenge_method: 'S256',
                code_challenge: challenge,
                token_access_type: 'offline',
                state: session
            }).toString()
            res.writeHead(302, { Location: authUrl })
            return res.end()
        }

        if (dropboxAction === 'callback') {
            const { code, state } = req.query
            if (!code || !state) return res.status(400).end('Missing parameters.')
            globalThis.verifiers = globalThis.verifiers || {}
            const entry = globalThis.verifiers[state]
            if (!entry || Date.now() > entry.expires) return res.status(400).end('Session expired.')
            delete globalThis.verifiers[state]

            try {
                const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        grant_type: 'authorization_code',
                        client_id: clientId,
                        redirect_uri: redirectUri,
                        code_verifier: entry.verifier
                    }).toString()
                })
                const data = await tokenRes.json()
                const tokens = {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    expires_at: Date.now() + data.expires_in * 1000
                }
                globalThis.tokens = globalThis.tokens || {}
                globalThis.tokens[state] = { tokens, expires: Date.now() + 300000 }
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end('<h2>Login successful</h2><p>You can close this tab and return to the app.</p>')
            } catch (e) {
                res.status(500).end('Token exchange error')
            }
            return
        }

        if (dropboxAction === 'tokens') {
            const session = req.query.session
            if (!session) return res.status(400).json({ ready: false })
            globalThis.tokens = globalThis.tokens || {}
            const entry = globalThis.tokens[session]
            if (!entry || Date.now() > entry.expires) return res.json({ ready: false })
            delete globalThis.tokens[session]
            return res.json({ ready: true, tokens: entry.tokens })
        }

        return res.status(400).end('Invalid dropbox_action')
    }

    const ga = req.query.action
    if (ga) {
        if (ga === 'getSettings') {
            const { data, error } = await supabase
                .from('giveaway_settings')
                .select('*')
                .eq('id', 1)
                .single()
            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json({ success: true, settings: data })
        }

        if (ga === 'getParticipants') {
            const { data, error } = await supabase
                .from('giveaway_participants')
                .select('*')
                .order('joined_at', { ascending: false })
            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json({ success: true, participants: data })
        }

        if (ga === 'addParticipant') {
            const dataParam = req.query.data;
            if (!dataParam) return res.status(400).json({ error: 'Missing participant data' });
            const participant = JSON.parse(decodeURIComponent(dataParam));
            const { error } = await supabase
                .from('giveaway_participants')
                .upsert({
                    user_id: participant.id,
                    username: participant.username,
                    email: participant.email || '',
                    joined_at: participant.joinedAt,
                    timestamp: participant.timestamp
                }, { onConflict: 'user_id' });
            if (error) {
                if (error.code === '23505') {
                    return res.status(200).json({ success: false, message: 'Already joined' });
                }
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true });
        }

        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'No token' })
        const token = authHeader.split(' ')[1]
        try {
            jwt.verify(token, process.env.JWT_SECRET)
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' })
        }

        if (ga === 'updateSettings') {
            const { field, value } = req.query
            if (!field || value === undefined) return res.status(400).json({ error: 'Missing field or value' })
            const updateData = {}
            if (field === 'maxParticipants') {
                updateData.max_participants = parseInt(value, 10)
            } else {
                updateData[field] = value
            }
            const { error } = await supabase
                .from('giveaway_settings')
                .update(updateData)
                .eq('id', 1)
            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json({ success: true })
        }

        if (ga === 'clearParticipants') {
            const { error } = await supabase
                .from('giveaway_participants')
                .delete()
                .gt('id', 0)
            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json({ success: true })
        }

        return res.status(400).json({ error: 'Unknown giveaway action' })
    }

    let payload
    try {
        const body = await getRawBody(req)
        payload = JSON.parse(body)
    } catch {
        return res.status(400).json({ error: 'Invalid request body' })
    }

    const { action, username, email, password } = payload

    if (action === 'signUp') {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' })
        }
        if (!/^[a-zA-Z0-9]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters and numbers' })
        }

        const { data: existing } = await supabase
            .from('accounts')
            .select('username')
            .eq('username', username)
            .single()

        if (existing) {
            return res.status(409).json({ error: 'Username already exists' })
        }

        const id = 'USER_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9).toUpperCase()
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

        const { error } = await supabase
            .from('accounts')
            .insert({
                id,
                username,
                email: email || '',
                password_hash: passwordHash,
                admin: false,
                created_at: new Date().toISOString()
            })

        if (error) {
            return res.status(500).json({ error: 'Failed to create user' })
        }

        return res.status(200).json({ success: true })
    }

    if (action === 'signIn') {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' })
        }

        const { data: user, error: fetchError } = await supabase
            .from('accounts')
            .select('*')
            .eq('username', username)
            .single()

        if (fetchError || !user) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        const inputHash = crypto.createHash('sha256').update(password).digest('hex')
        if (user.password_hash !== inputHash) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        const token = jwt.sign(
            { sub: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        )

        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                id: user.id,
                email: user.email,
                createdAt: user.created_at,
                admin: user.admin
            },
            token
        })
    }

    if (action === 'admin-login') {
        const { password: adminPassword } = payload
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Wrong password' })
        }

        const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '30d' })
        return res.status(200).json({ token })
    }

    return res.status(400).json({ error: 'Unknown action' })
}
