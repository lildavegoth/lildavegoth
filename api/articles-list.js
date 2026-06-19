import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
};
