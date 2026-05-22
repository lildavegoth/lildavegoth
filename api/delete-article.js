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

    const putFile = async (path, contentBase64, message, sha = null) => {
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

    const getFileContent = async (path) => {
        const response = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
        );
        if (!response.ok) return null;
        return response.text();
    };

    try {
        const mdPath = `pages/articles/${slug}.md`;
        const mdSha = await getFileSha(mdPath);
        if (!mdSha) {
            return res.status(404).json({ error: 'Article file not found' });
        }
        await deleteFile(mdPath, mdSha);

        const articlesPath = 'files/fetch/articles.json';
        const rawArticles = await getFileContent(articlesPath);
        if (!rawArticles) {
            return res.status(404).json({ error: 'articles.json not found' });
        }

        let articlesData = JSON.parse(rawArticles);
        if (!Array.isArray(articlesData)) {
            articlesData = [];
        }

        const filtered = articlesData.filter(entry => {
            const entrySlug = entry.link.split('slug=')[1]?.split('&')[0];
            return entrySlug !== slug;
        });

        if (filtered.length === articlesData.length) {
            return res.status(404).json({ error: 'Article not found in index' });
        }

        const updatedJson = JSON.stringify(filtered, null, 2);
        const articlesSha = await getFileSha(articlesPath);
        await putFile(
            articlesPath,
            Buffer.from(updatedJson).toString('base64'),
            `Remove article ${slug}`,
            articlesSha
        );

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};