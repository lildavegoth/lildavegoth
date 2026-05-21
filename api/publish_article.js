const jwt = require('jsonwebtoken');

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

    const { slug, title, date, image, description, categories, content } = req.body;
    if (!slug || !content) return res.status(400).json({ error: 'Missing fields' });

    const owner = 'lildavegoth';
    const repo = 'lildavegoth';
    const branch = 'homepage';
    const ghToken = process.env.GH_TOKEN;

    const fileContent = `---
title: "${title}"
date: "${date}"
image: "${image}"
description: "${description}"
categories: "${categories}"
---

${content}`;

    const mdPath = `pages/articles/${slug}.md`;
    const mdBase64 = Buffer.from(fileContent).toString('base64');

    const putFile = async (path, contentBase64, message) => {
        const sha = await getFileSha(path);
        const body = { message, content: contentBase64, branch };
        if (sha) body.sha = sha;
        await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${ghToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    };

    const getFileSha = async (path) => {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
            headers: { Authorization: `token ${ghToken}` }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.sha;
    };

    const getFileContent = async (path) => {
        const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
        if (!response.ok) return null;
        return response.text();
    };

    try {
        await putFile(mdPath, mdBase64, `Update article ${slug}`);

        const articlesPath = 'files/fetch/articles.json';
        let articlesData = JSON.parse(await getFileContent(articlesPath) || '{"featured":[],"highlight":[],"allArticles":[]}');

        const newEntry = {
            name: title,
            categories: categories,
            image: image,
            link: `article-page.html?slug=${slug}`,
            description: description
        };

        let found = false;
        articlesData.allArticles = articlesData.allArticles.map(entry => {
            if (entry.link && entry.link.includes(`slug=${slug}`)) {
                found = true;
                return newEntry;
            }
            return entry;
        });
        if (!found) {
            articlesData.allArticles.push(newEntry);
        }

        const updatedJson = JSON.stringify(articlesData, null, 2);
        await putFile(articlesPath, Buffer.from(updatedJson).toString('base64'), `Update articles.json for ${slug}`);

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'GitHub commit failed' });
    }
};
