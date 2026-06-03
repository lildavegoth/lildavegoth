const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    let body;
    try {
        body = await getRawBody(req);
    } catch {
        return res.status(500).json({ error: 'Failed to read request body' });
    }

    let payload;
    try {
        payload = JSON.parse(body);
    } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    const products = payload.products;
    if (!Array.isArray(products)) return res.status(400).json({ error: 'Missing products array' });

    const key = Buffer.from(process.env.PRODUCTS_KEY.padEnd(32).slice(0, 32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const jsonString = JSON.stringify(products, null, 2);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedPayload = iv.toString('hex') + ':' + encrypted;

    const owner = 'lildavegoth';
    const repo = 'lildavegoth';
    const branch = 'homepage';
    const ghToken = process.env.GH_TOKEN;
    const encPath = 'files/fetch/kiraku-store/products.json.enc';

    const getFileSha = async (path) => {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            { headers: { Authorization: `token ${ghToken}` } }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.sha;
    };

    const putFile = async (path, contentBase64, message) => {
        const sha = await getFileSha(path);
        const bodyObj = { message, content: contentBase64, branch };
        if (sha) bodyObj.sha = sha;
        await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `token ${ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyObj),
            }
        );
    };

    try {
        const encBase64 = Buffer.from(encryptedPayload, 'utf-8').toString('base64');
        await putFile(encPath, encBase64, 'Update products.json.enc');
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'GitHub commit failed' });
    }
};