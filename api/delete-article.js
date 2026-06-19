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

    const { slug } = payload;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const owner = 'lildavegoth';
    const repo = 'lildavegoth';
    const branch = 'homepage';
    const ghToken = process.env.GH_TOKEN;

    const getFileSha = async (path) => {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            { headers: { Authorization: `token ${ghToken}` } }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data.sha;
    };

    const deleteFile = async (path, sha) => {
        await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `token ${ghToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: `Delete article ${slug}`, sha, branch }),
            }
        );
    };

    try {
        const mdPath = `pages/articles/${slug}.md`;
        const mdSha = await getFileSha(mdPath);
        if (!mdSha) {
            return res.status(404).json({ error: 'Article file not found' });
        }
        await deleteFile(mdPath, mdSha);

        const { error: supabaseError } = await supabase
            .from('articles')
            .delete()
            .eq('slug', slug);

        if (supabaseError) {
            console.error('Supabase delete failed:', supabaseError);
            return res.status(500).json({ error: 'Failed to delete from database' });
        }

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'GitHub delete or database update failed' });
    }
};