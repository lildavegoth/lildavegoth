import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default function handler(req, res) {
    try {
        const key = Buffer.from(process.env.PRODUCTS_KEY.padEnd(32).slice(0, 32), 'utf8');
        const encPath = path.join(process.cwd(), 'files', 'fetch', 'kiraku-store', 'products.json.enc');
        const encData = fs.readFileSync(encPath, 'utf8');
        const [ivHex, cipherHex] = encData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        res.status(200).send(decrypted);
    } catch (err) {
        res.status(500).json({ error: 'Decryption failed' });
    }
}