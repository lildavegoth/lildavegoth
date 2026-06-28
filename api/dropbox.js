import https from 'https';
import crypto from 'crypto';

function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default async (req, res) => {
    const { action, session, code, state } = req.query;
    const host = req.headers.host;
    const clientId = '5630n4t14l8r80h';
    const redirectUri = `https://${host}/api/dropbox?action=callback`;

    if (action === 'login') {
        if (!session) return res.status(400).end('missing session');
        const verifier = base64URLEncode(crypto.randomBytes(32));
        const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest());
        globalThis.verifiers = globalThis.verifiers || {};
        globalThis.verifiers[session] = { verifier, expires: Date.now() + 600000 };
        const authUrl = 'https://www.dropbox.com/oauth2/authorize?' + new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            code_challenge_method: 'S256',
            code_challenge: challenge,
            token_access_type: 'offline',
            state: session
        }).toString();
        res.writeHead(302, { Location: authUrl });
        return res.end();
    }

    if (action === 'callback') {
        if (!code || !state) return res.status(400).end('Missing parameters.');
        globalThis.verifiers = globalThis.verifiers || {};
        const entry = globalThis.verifiers[state];
        if (!entry || Date.now() > entry.expires) return res.status(400).end('Session expired.');
        delete globalThis.verifiers[state];
        const postData = new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            client_id: clientId,
            redirect_uri: redirectUri,
            code_verifier: entry.verifier
        }).toString();
        const tokenReq = https.request({
            hostname: 'api.dropboxapi.com',
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, tokenRes => {
            let body = '';
            tokenRes.on('data', chunk => body += chunk);
            tokenRes.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const tokens = {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        expires_at: Date.now() + data.expires_in * 1000
                    };
                    globalThis.tokens = globalThis.tokens || {};
                    globalThis.tokens[state] = { tokens, expires: Date.now() + 300000 };
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h2>Login successful</h2><p>You can close this tab and return to the app.</p>');
                } catch (e) {
                    res.status(500).end('Token exchange error');
                }
            });
        });
        tokenReq.on('error', () => res.status(500).end('Request error'));
        tokenReq.write(postData);
        return tokenReq.end();
    }

    if (action === 'tokens') {
        if (!session) return res.status(400).json({ ready: false });
        globalThis.tokens = globalThis.tokens || {};
        const entry = globalThis.tokens[session];
        if (!entry || Date.now() > entry.expires) return res.json({ ready: false });
        delete globalThis.tokens[session];
        return res.json({ ready: true, tokens: entry.tokens });
    }

    res.status(400).end('Invalid action');
};
