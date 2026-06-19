import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Use POST to run migration' });
    }

    try {
        const response = await fetch(
            'https://raw.githubusercontent.com/lildavegoth/lildavegoth/homepage/files/fetch/articles.json'
        );
        const articles = await response.json();
        const flat = Array.isArray(articles) ? articles : (articles.allArticles || []);

        const results = [];
        for (const article of flat) {
            const slug = article.link?.split('slug=')[1]?.split('&')[0];
            if (!slug) continue;

            const { error } = await supabase
                .from('articles')
                .upsert({
                    slug,
                    title: article.name,
                    date: article.date || '',
                    image: article.image || '',
                    description: article.description || '',
                    categories: article.categories || '',
                    badge: article.badge || null,
                    number: article.number || null,
                    hidden: article.hidden || false,
                    submission: article.submission || false,
                    author: article.author || 'lildavegoth',
                    profile: article.profile || 'https://t.me/lildavegoth',
                    read_time: article.readTime || null,
                }, { onConflict: 'slug' });

            results.push({ slug, success: !error, error: error?.message || null });
        }

        res.status(200).json({ results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
