import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const articles = JSON.parse(fs.readFileSync('./articles.json', 'utf8'));
const flat = Array.isArray(articles) ? articles : (articles.allArticles || []);

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

    if (error) {
        console.error(`Failed for ${slug}:`, error);
    } else {
        console.log(`Imported ${slug}`);
    }
}
