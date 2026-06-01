import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default async function handler(req, res) {
    try {
        const key = Buffer.from(process.env.PRODUCTS_KEY.padEnd(32).slice(0, 32), 'utf8');

        const prodEncPath = path.join(process.cwd(), 'files', 'fetch', 'kiraku-store', 'products.json.enc');
        const prodEnc = fs.readFileSync(prodEncPath, 'utf8');
        const [prodIvHex, prodCipher] = prodEnc.split(':');
        const prodIv = Buffer.from(prodIvHex, 'hex');
        const prodDecipher = crypto.createDecipheriv('aes-256-cbc', key, prodIv);
        let productsJson = prodDecipher.update(prodCipher, 'hex', 'utf8');
        productsJson += prodDecipher.final('utf8');

        const ownedEncPath = path.join(process.cwd(), 'files', 'fetch', 'kiraku-store', 'owned.json.enc');
        const ownedEnc = fs.readFileSync(ownedEncPath, 'utf8');
        const [ownedIvHex, ownedCipher] = ownedEnc.split(':');
        const ownedIv = Buffer.from(ownedIvHex, 'hex');
        const ownedDecipher = crypto.createDecipheriv('aes-256-cbc', key, ownedIv);
        let ownedJson = ownedDecipher.update(ownedCipher, 'hex', 'utf8');
        ownedJson += ownedDecipher.final('utf8');

        const htmlPath = path.join(process.cwd(), 'pages', 'kiraku-store.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        const injected = `
<script>
window.__PRODUCTS_DATA__ = ${productsJson};
window.__OWNED_DATA__ = ${ownedJson};
</script>
</body>`;
        html = html.replace('</body>', injected);

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        res.status(200).send(html);
    } catch (err) {
        res.status(500).send('Page generation failed');
    }
}
