import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const action = req.query.action;

    if (action === "poll" && req.method === "GET") {
        const code = req.query.code;
        if (!code) return res.status(400).json({ error: "Missing code" });

        const { data, error } = await supabase
            .from("login_codes")
            .select("*")
            .eq("code", code)
            .single();

        if (error || !data) {
            return res.status(404).json({ found: false });
        }

        await supabase.from("login_codes").delete().eq("code", code);

        const token = jwt.sign(
            { userId: data.user_id, username: data.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return res.json({ found: true, token });
    }

    if (action === "media" && req.method === "GET") {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const token = authHeader.split(" ")[1];
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }

        const channelId = process.env.CHANNEL_ID;
        const limit = parseInt(req.query.limit) || 50;
        const page = parseInt(req.query.cursor) || 0;
        const from = page * limit;
        const to = from + limit - 1;

        const { data: items, error } = await supabase
            .from("gallery_media")
            .select("*")
            .eq("channel_id", channelId)
            .order("date", { ascending: false })
            .range(from, to);

        if (error) return res.status(500).json({ error: "Database error" });

        const nextCursor = items.length === limit ? page + 1 : null;
        const cleanItems = items.map(item => ({
            id: item.message_id,
            file_id: item.file_id,
            file_unique_id: item.file_unique_id,
            type: item.type,
            mime_type: item.mime_type,
            caption: item.caption,
            date: item.date,
        }));

        return res.json({ items: cleanItems, nextCursor });
    }

    if (action === "file" && req.method === "GET") {
        const fileId = req.query.file_id;
        if (!fileId) return res.status(400).json({ error: "Missing file_id" });

        const fileUrl = `https://api.telegram.org/bot${process.env.KIRA_TOKEN}/getFile?file_id=${fileId}`;
        const tgResp = await fetch(fileUrl);
        const tgData = await tgResp.json();
        if (!tgData.ok) return res.status(404).end();

        const filePath = tgData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${filePath}`;
        const fileResp = await fetch(downloadUrl);
        res.setHeader("Content-Type", fileResp.headers.get("content-type") || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        fileResp.body.pipe(res);
        return;
    }

    return res.status(404).json({ error: "Not found" });
}
