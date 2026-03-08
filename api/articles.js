const { marked } = require('marked');
const matter = require('gray-matter');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { slug } = req.query;
  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  const owner = 'lildavegoth';
  const repo = 'lildavegoth';
  const branch = 'honepage';
  const path = `pages/articles/${slug}.md`;

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const fileContent = await response.text();

    const { data: frontmatter, content } = matter(fileContent);
    const htmlContent = marked(content);

    res.status(200).json({
      title: frontmatter.title || 'Untitled',
      date: frontmatter.date || null,
      image: frontmatter.image || '/images/default.jpg',
      html: htmlContent,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
    });
  } catch (error) {
    console.error('Article fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
