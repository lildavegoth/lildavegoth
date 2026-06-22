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

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (req.method === 'OPTIONS') return res.status(200).end()

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
            const dataParam = req.query.data
            if (!dataParam) return res.status(400).json({ error: 'Missing participant data' })
            const participant = JSON.parse(decodeURIComponent(dataParam))
            const { error } = await supabase
                .from('giveaway_participants')
                .insert({
                    user_id: participant.id,
                    username: participant.username,
                    email: participant.email || '',
                    joined_at: participant.joinedAt,
                    timestamp: participant.timestamp
                })
            if (error) return res.status(500).json({ error: error.message })
            return res.status(200).json({ success: true })
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
