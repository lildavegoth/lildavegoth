import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let payload;
    try {
        const body = await getRawBody(req);
        payload = JSON.parse(body);
    } catch {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const { action, username, email, password } = payload;

    if (action === 'signUp') {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const { data: existing } = await supabase
            .from('accounts')
            .select('username')
            .eq('username', username)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const id = 'USER_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

        const { error } = await supabase
            .from('accounts')
            .insert({
                id,
                username,
                email: email || '',
                password_hash: passwordHash,
                admin: false,
                created_at: new Date().toISOString(),
            });

        if (error) {
            return res.status(500).json({ error: 'Failed to create user' });
        }

        return res.status(200).json({ success: true });
    }

    if (action === 'signIn') {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const { data: user, error: fetchError } = await supabase
            .from('accounts')
            .select('*')
            .eq('username', username)
            .single();

        if (fetchError || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const inputHash = crypto.createHash('sha256').update(password).digest('hex');
        if (user.password_hash !== inputHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { sub: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                id: user.id,
                email: user.email,
                createdAt: user.created_at,
                admin: user.admin,
            },
            token,
        });
    }

    return res.status(400).json({ error: 'Unknown action' });
};
