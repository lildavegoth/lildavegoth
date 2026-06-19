import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

export default async function handler(req, res) {
    const { method } = req;

    if (method === 'GET') {
        const { type } = req.query;
        if (!type || !['products', 'owned'].includes(type)) {
            return res.status(400).json({ error: 'Use ?type=products or ?type=owned' });
        }

        try {
            const key = Buffer.from(process.env.PRODUCTS_KEY.padEnd(32).slice(0, 32), 'utf8');
            const encPath = `files/fetch/kiraku-store/${type}.json.enc`;
            const fullPath = path.join(process.cwd(), encPath);
            const encData = fs.readFileSync(fullPath, 'utf8');
            const [ivHex, cipherHex] = encData.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
            return res.status(200).send(decrypted);
        } catch (err) {
            return res.status(500).json({ error: 'Decryption failed' });
        }
    }

    if (method === 'POST') {
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
        return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
