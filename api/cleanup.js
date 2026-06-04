import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: files, error } = await supabase.storage
        .from("images")
        .list("", {
            limit: 500,
            sortBy: { column: "created_at", order: "asc" },
        });

    if (error) return new Response("Failed to list files", { status: 500 });

    const oldFiles = files.filter(
        (f) => new Date(f.created_at) < sevenDaysAgo
    );

    if (oldFiles.length > 0) {
        const paths = oldFiles.map((f) => f.name);
        await supabase.storage.from("images").remove(paths);
    }

    return new Response(`Deleted ${oldFiles.length} old files.`);
}