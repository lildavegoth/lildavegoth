import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanBucket(bucketName) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list("", {
            limit: 500,
            sortBy: { column: "created_at", order: "asc" },
        });

    if (error) {
        return `Failed to list ${bucketName}: ${error.message}`;
    }

    const oldFiles = files.filter(
        (f) => new Date(f.created_at) < sevenDaysAgo
    );

    if (oldFiles.length > 0) {
        const paths = oldFiles.map((f) => f.name);
        await supabase.storage.from(bucketName).remove(paths);
    }

    return `${bucketName}: deleted ${oldFiles.length} files`;
}

export async function GET() {
    const results = await Promise.all([
        cleanBucket("images"),
        cleanBucket("videos"),
    ]);
    return new Response(results.join(" | "));
}
