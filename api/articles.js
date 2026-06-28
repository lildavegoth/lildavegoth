import { marked } from 'marked';
import matter from 'gray-matter';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/json');

    const { slug } = req.query;
    if (!slug) {
        return res.status(400).json({ error: 'Missing slug parameter' });
    }

    const owner = 'lildavegoth';
    const repo = 'lildavegoth';
    const branch = 'homepage';
    const path = `pages/articles/${slug}.md`;

    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?t=${Date.now()}`;

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
};
