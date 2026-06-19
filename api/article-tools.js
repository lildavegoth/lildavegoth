import jwt from 'jsonwebtoken';
import busboy from 'busboy';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OWNER = 'lildavegoth';
const REPO = 'lildavegoth';
const BRANCH = 'homepage';
const IMAGES_PATH = 'pages/articles/images';
const ARTICLES_PATH = 'pages/articles';

async function getFileSha(filePath) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`;
    const res = await fetch(url, {
        headers: { Authorization: `token ${process.env.GH_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha;
}

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action;
    if (!action) return res.status(400).json({ error: 'Missing action parameter' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (action === 'upload-image') {
        if (
            !req.headers['content-type'] ||
            !req.headers['content-type'].includes('multipart/form-data')
        ) {
            return res.status(400).json({ error: 'Must be multipart/form-data' });
        }

        const bb = busboy({ headers: req.headers });
        let fileBuffer = null;
        let fileName = '';
        let fileError = '';
        let customName = '';

        bb.on('file', (fieldname, file, info) => {
            if (fieldname !== 'image') {
                file.resume();
                fileError = 'Wrong field name';
                return;
            }
            const originalName = info.filename;
            fileName = customName || originalName;
            if (!fileName.toLowerCase().endsWith('.webp')) {
                fileName += '.webp';
            }
            const chunks = [];
            file.on('data', chunk => chunks.push(chunk));
            file.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });

        bb.on('field', (fieldname, val) => {
            if (fieldname === 'customName') {
                customName = val.trim();
            }
        });
        bb.on('error', () => {
            if (!res.headersSent) res.status(500).json({ error: 'Upload error' });
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
        return;
    }

    if (action === 'publish') {
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

        const { slug, title, author, profile, date, image, description, categories, content, badge, number, hidden, submission } = payload;
        if (!slug || !content) return res.status(400).json({ error: 'Missing slug or content' });

        let hiddenLine = hidden ? '\nhidden: true' : '';
        let submissionLine = submission ? '\nsubmission: true' : '';
        let fileContent = `---
title: "${title}"
date: "${date}"
image: "${image}"
author: "${author || 'lildavegoth'}"
profile: "${profile || 'https://t.me/lildavegoth'}"
description: "${description}"
categories: "${categories}"${hiddenLine}${submissionLine}
---
${content}`;

        const mdPath = `${ARTICLES_PATH}/${slug}.md`;
        const mdBase64 = Buffer.from(fileContent).toString('base64');

        const putFile = async (path, contentBase64, message) => {
            const sha = await getFileSha(path);
            const bodyObj = { message, content: contentBase64, branch: BRANCH };
            if (sha) bodyObj.sha = sha;
            const putRes = await fetch(
                `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `token ${process.env.GH_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(bodyObj),
                }
            );
            if (!putRes.ok) {
                const errorData = await putRes.json();
                throw new Error(`PUT failed: ${putRes.status} ${JSON.stringify(errorData)}`);
            }
        };

        try {
            await putFile(mdPath, mdBase64, `Update article ${title}`);

            const { error: supabaseError } = await supabase
                .from('articles')
                .upsert({
                    slug,
                    title,
                    date: date || null,
                    image: image || null,
                    description: description || null,
                    categories: categories || null,
                    badge: badge || null,
                    number: number ? parseInt(number, 10) : null,
                    hidden: hidden ? true : false,
                    submission: submission ? true : false,
                    author: author || 'lildavegoth',
                    profile: profile || 'https://t.me/lildavegoth',
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'slug' });

            if (supabaseError) {
                return res.status(500).json({ error: 'Failed to update database' });
            }

            res.status(200).json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'GitHub commit or database update failed' });
        }
        return;
    }

    if (action === 'delete') {
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

        const { slug } = payload;
        if (!slug) return res.status(400).json({ error: 'Missing slug' });

        const mdPath = `${ARTICLES_PATH}/${slug}.md`;

        try {
            const sha = await getFileSha(mdPath);
            if (!sha) {
                return res.status(404).json({ error: 'Article file not found' });
            }

            await fetch(
                `https://api.github.com/repos/${OWNER}/${REPO}/contents/${mdPath}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `token ${process.env.GH_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: `Delete article ${slug}`, sha, branch: BRANCH }),
                }
            );

            const { error: supabaseError } = await supabase
                .from('articles')
                .delete()
                .eq('slug', slug);

            if (supabaseError) {
                return res.status(500).json({ error: 'Failed to delete from database' });
            }

            res.status(200).json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'GitHub delete or database update failed' });
        }
        return;
    }

    return res.status(400).json({ error: 'Invalid action' });
}
