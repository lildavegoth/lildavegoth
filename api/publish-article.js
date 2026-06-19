import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

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

    const { slug, title, author, profile, date, image, description, categories, content, badge, number, hidden, submission } = payload;
    if (!slug || !content) return res.status(400).json({ error: 'Missing fields' });

    const owner = 'lildavegoth';
    const repo = 'lildavegoth';
    const branch = 'homepage';
    const ghToken = process.env.GH_TOKEN;

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

    const mdPath = `pages/articles/${slug}.md`;
    const mdBase64 = Buffer.from(fileContent).toString('base64');

    const getFileSha = async (path) => {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            { headers: { Authorization: `token ${ghToken}` } }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.sha;
    };

    const putFile = async (path, contentBase64, message, sha = null) => {
        const bodyObj = { message, content: contentBase64, branch };
        if (sha) bodyObj.sha = sha;
        else {
            const currentSha = await getFileSha(path);
            if (currentSha) bodyObj.sha = currentSha;
        }
        const putRes = await fetch(
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
            console.error('Supabase upsert failed:', supabaseError);
            return res.status(500).json({ error: 'Failed to update database' });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'GitHub commit or database update failed' });
    }
};.