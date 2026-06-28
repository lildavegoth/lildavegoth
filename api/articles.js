import jwt from 'jsonwebtoken';
import busboy from 'busboy';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import matter from 'gray-matter';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OWNER = 'lildavegoth';
const REPO = 'lildavegoth';
const BRANCH = 'homepage';
const IMAGES_PATH = 'pages/articles/images';
const ARTICLES_PATH = 'pages/articles';

async function notifyOwner(text) {
    try {
        await fetch(`https://api.telegram.org/bot${process.env.KIRA_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.OWNER_TELEGRAM_ID,
                text: text
            })
        });
    } catch {}
}

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

    if (action) {
        const authHeader = req.headers.authorization;

        if (action === 'get-comments') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            const { slug } = req.query;
            if (!slug) return res.status(400).json({ error: 'Missing slug' });
            const { data, error } = await supabase
                .from('comments')
                .select('id, article_slug, user_id, username, body, created_at, parent_id')
                .eq('article_slug', slug)
                .order('created_at', { ascending: true });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        if (!authHeader) return res.status(401).json({ error: 'No token' });
        const token = authHeader.split(' ')[1];

        if (action === 'upload-image') {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
            } catch (e) {
                return res.status(401).json({ error: 'Invalid token' });
            }

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

        if (action === 'post-comment') {
            let decoded;
            try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

            let body;
            try { body = await getRawBody(req); } catch { return res.status(500).json({ error: 'Failed to read body' }); }
            let payload;
            try { payload = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

            const { article_slug, body: commentBody, parent_id } = payload;
            if (!article_slug || !commentBody) return res.status(400).json({ error: 'Missing fields' });

            const { error } = await supabase.from('comments').insert({
                article_slug, user_id: decoded.sub, username: decoded.username,
                body: commentBody, parent_id: parent_id || null
            });
            if (error) return res.status(500).json({ error: error.message });

            fetch(`https://api.telegram.org/bot${process.env.KIRA_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.OWNER_TELEGRAM_ID,
                    text: `New comment on ${article_slug}\nby ${decoded.username}: ${commentBody}\nRead: https://kakoi-kiraku-home.vercel.app/pages/articles/article-page.html?slug=${article_slug}`
                })
            }).catch(()=>{});

            return res.status(200).json({ success: true });
        }
        
        if (action === 'edit-comment') {
            let decoded;
            try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

            let body;
            try { body = await getRawBody(req); } catch { return res.status(500).json({ error: 'Failed to read body' }); }
            let payload;
            try { payload = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

            const { id, body: newBody } = payload;
            if (!id || !newBody) return res.status(400).json({ error: 'Missing fields' });

            const { data: comment, error: fetchError } = await supabase.from('comments').select('user_id').eq('id', id).single();
            if (fetchError || !comment) return res.status(404).json({ error: 'Comment not found' });
            if (comment.user_id !== decoded.sub) return res.status(403).json({ error: 'Not your comment' });

            const { error } = await supabase.from('comments').update({ body: newBody }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });

            fetch(`https://api.telegram.org/bot${process.env.KIRA_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.OWNER_TELEGRAM_ID,
                    text: `Comment #${id} edited by ${decoded.username}: ${newBody}`
                })
            }).catch(()=>{});

            return res.status(200).json({ success: true });
        }

        if (action === 'delete-comment') {
            let decoded;
            try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'Invalid token' }); }

            let body;
            try { body = await getRawBody(req); } catch { return res.status(500).json({ error: 'Failed to read body' }); }
            let payload;
            try { payload = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

            const { id } = payload;
            if (!id) return res.status(400).json({ error: 'Missing comment id' });

            const { data: comment, error: fetchError } = await supabase.from('comments').select('user_id').eq('id', id).single();
            if (fetchError || !comment) return res.status(404).json({ error: 'Comment not found' });
            if (comment.user_id !== decoded.sub) return res.status(403).json({ error: 'Not your comment' });

            const { error } = await supabase.from('comments').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });

            fetch(`https://api.telegram.org/bot${process.env.KIRA_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: process.env.OWNER_TELEGRAM_ID,
                    text: `Comment #${id} deleted by ${decoded.username}`
                })
            }).catch(()=>{});

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    const { slug } = req.query;

    if (slug) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Content-Type', 'application/json');

        const path = `pages/articles/${slug}.md`;
        const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}?t=${Date.now()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                return res.status(404).json({ error: 'Article not found' });
            }

            const fileContent = await response.text();
            const { data: frontmatter, content } = matter(fileContent);
            const htmlContent = marked(content);

            let finalHtml = htmlContent;
            try {
                finalHtml = htmlContent.replace(
                    /(<img[^>]+src=["'])((?!https?:\/\/)[^"']+)(["'])/gi,
                    (match, prefix, src, suffix) => {
                        const separator = src.includes('?') ? '&' : '?';
                        return `${prefix}${src}${separator}t=${Date.now()}${suffix}`;
                    }
                );
            } catch (e) {}

            res.status(200).json({
                title: frontmatter.title || 'Untitled',
                date: frontmatter.date || null,
                image: frontmatter.image || '/images/default.jpg',
                author: frontmatter.author || 'lildavegoth',
                profile: frontmatter.profile || 'https://t.me/lildavegoth',
                submission: frontmatter.submission === true || frontmatter.submission === 'true',
                html: finalHtml,
                wordCount: content.split(/\s+/).filter(w => /^[a-zA-Z0-9.,]+$/.test(w)).length,
            });
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;

        const articles = data.map(article => ({
            name: article.title,
            date: article.date,
            image: article.image,
            description: article.description,
            categories: article.categories,
            link: `article-page.html?slug=${article.slug}`,
            badge: article.badge || undefined,
            number: article.number || undefined,
            hidden: article.hidden || undefined,
            submission: article.submission || undefined,
            author: article.author,
            profile: article.profile,
            readTime: article.read_time || undefined,
        }));

        res.status(200).json(articles);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
}
