const jwt = require('jsonwebtoken');
const busboy = require('busboy');

const OWNER = 'lildavegoth';
const REPO = 'lildavegoth';
const BRANCH = 'homepage';
const IMAGES_PATH = 'pages/articles/images';

async function getFileSha(filePath) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`;
    const res = await fetch(url, {
        headers: { Authorization: `token ${process.env.GH_TOKEN}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha;
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

    if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Must be multipart/form-data' });
    }

    const bb = busboy({ headers: req.headers });

    let fileBuffer = null;
    let fileName = '';
    let fileError = '';

    bb.on('file', (fieldname, file, info) => {
        if (fieldname !== 'image') {
            file.resume();
            fileError = 'Wrong field name';
            return;
        }
        if (!info.filename.toLowerCase().endsWith('.webp')) {
            file.resume();
            fileError = 'Only .webp files allowed';
            return;
        }
        fileName = info.filename;
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
            fileBuffer = Buffer.concat(chunks);
        });
    });

    bb.on('field', () => {});
    bb.on('error', () => {
        res.status(500).json({ error: 'Upload error' });
    });

    bb.on('finish', async () => {
        if (fileError) {
            return res.status(400).json({ error: fileError });
        }
        if (!fileBuffer) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const filePath = `${IMAGES_PATH}/${fileName}`;
        const contentBase64 = fileBuffer.toString('base64');

        try {
            const sha = await getFileSha(filePath);
            const body = {
                message: `Upload image ${fileName}`,
                content: contentBase64,
                branch: BRANCH,
            };
            if (sha) body.sha = sha;

            await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    Authorization: `token ${process.env.GH_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            res.status(200).json({ success: true, filename: fileName });
        } catch (err) {
            res.status(500).json({ error: 'Failed to upload image' });
        }
    });

    req.pipe(bb);
};