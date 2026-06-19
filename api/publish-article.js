const jwt = require('jsonwebtoken');

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

    const getArticlesJsonAndSha = async () => {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/files/fetch/articles.json?ref=${branch}`;
        const response = await fetch(url, {
            headers: { Authorization: `token ${ghToken}` }
        });
        if (!response.ok) return { content: '[]', sha: null };
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return { content, sha: data.sha };
    };

    try {
        await putFile(mdPath, mdBase64, `Update article ${title}`);

        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            const { content: articlesContent, sha: articlesSha } = await getArticlesJsonAndSha();
            let articlesData = JSON.parse(articlesContent || '[]');
            if (!Array.isArray(articlesData)) articlesData = [];

            const newEntry = {
                name: title,
                categories: categories,
                image: image,
                link: `article-page.html?slug=${slug}`,
                description: description,
                date: date,
            };
            if (hidden) newEntry.hidden = true;
            if (submission) newEntry.submission = true;
            if (badge) {
                newEntry.badge = badge;
                if (badge === 'highlight' && number) {
                    newEntry.number = parseInt(number, 10);
                }
            }

            let found = false;
            articlesData = articlesData.map(entry => {
                if (entry.link && entry.link.includes(`slug=${slug}`)) {
                    found = true;
                    return Object.assign({}, entry, newEntry);
                }
                return entry;
            });
            if (!found) {
                articlesData.push(newEntry);
            }

            const updatedJson = JSON.stringify(articlesData, null, 2);
            try {
                await putFile(
                    'files/fetch/articles.json',
                    Buffer.from(updatedJson).toString('base64'),
                    `Update articles.json for ${title}`,
                    articlesSha
                );
                break;
            } catch (err) {
                if (i === maxRetries - 1) throw err;
                await new Promise(r => setTimeout(r, 500));
            }
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'GitHub commit failed' });
    }
};
