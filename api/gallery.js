import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const action = req.query.action;

    if (action === "auth" && req.method === "POST") {
        try {
            const { code, redirect_uri } = req.body;
            if (!code || !redirect_uri) {
                return res.status(400).json({ error: "Missing code or redirect_uri" });
            }

            if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
                return res.status(500).json({ error: "Server misconfiguration: missing CLIENT_ID or CLIENT_SECRET" });
            }
            if (!process.env.KIRA_TOKEN) {
                return res.status(500).json({ error: "Server misconfiguration: missing KIRA_TOKEN" });
            }
            if (!process.env.CHANNEL_ID) {
                return res.status(500).json({ error: "Server misconfiguration: missing CHANNEL_ID" });
            }
            if (!process.env.JWT_SECRET) {
                return res.status(500).json({ error: "Server misconfiguration: missing JWT_SECRET" });
            }

            const tokenUrl = "https://oauth.telegram.org/auth/token";
            const bodyParams = new URLSearchParams();
            bodyParams.append("grant_type", "authorization_code");
            bodyParams.append("client_id", process.env.CLIENT_ID);
            bodyParams.append("client_secret", process.env.CLIENT_SECRET);
            bodyParams.append("code", code);
            bodyParams.append("redirect_uri", redirect_uri);

            let tokenResp;
            try {
                tokenResp = await fetch(tokenUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: bodyParams.toString(),
                });
            } catch (e) {
                return res.status(502).json({ error: "Failed to contact Telegram OAuth server" });
            }

            let tokenData;
            try {
                tokenData = await tokenResp.json();
            } catch (e) {
                return res.status(502).json({ error: "Telegram OAuth returned non-JSON response" });
            }

            if (!tokenData.id_token) {
                return res.status(403).json({
                    error: "Invalid code or token exchange failed",
                    details: tokenData.error_description || "no details"
                });
            }

            const idTokenParts = tokenData.id_token.split(".");
            if (idTokenParts.length !== 3) {
                return res.status(502).json({ error: "Invalid id_token structure" });
            }

            let payload;
            try {
                payload = JSON.parse(Buffer.from(idTokenParts[1], "base64").toString("utf8"));
            } catch (e) {
                return res.status(502).json({ error: "Failed to decode id_token payload" });
            }

            const userId = payload.sub;

            const memberUrl = `https://api.telegram.org/bot${process.env.KIRA_TOKEN}/getChatMember?chat_id=${process.env.CHANNEL_ID}&user_id=${userId}`;
            let memberResp;
            try {
                memberResp = await fetch(memberUrl);
            } catch (e) {
                return res.status(502).json({ error: "Failed to contact Telegram Bot API" });
            }

            let memberData;
            try {
                memberData = await memberResp.json();
            } catch (e) {
                return res.status(502).json({ error: "Telegram Bot API returned non-JSON response" });
            }

            if (!memberData.ok || ["left", "kicked"].includes(memberData.result?.status)) {
                return res.status(403).json({ error: "Not a member", details: memberData.description || "" });
            }

            const token = jwt.sign(
                { userId, username: payload.username || "" },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );
            return res.json({ token });
        } catch (err) {
            return res.status(500).json({ error: "Unexpected server error: " + err.message });
        }
    }

    if (action === "media" && req.method === "GET") {
        try {
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

            if (error) {
                return res.status(500).json({ error: "Database error: " + error.message });
            }

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
        } catch (err) {
            return res.status(500).json({ error: "Unexpected server error: " + err.message });
        }
    }

    if (action === "file" && req.method === "GET") {
        try {
            const fileId = req.query.file_id;
            if (!fileId) {
                return res.status(400).json({ error: "Missing file_id" });
            }
            if (!process.env.KIRA_TOKEN) {
                return res.status(500).json({ error: "Server misconfiguration: missing KIRA_TOKEN" });
            }

            const fileUrl = `https://api.telegram.org/bot${process.env.KIRA_TOKEN}/getFile?file_id=${fileId}`;
            const tgResp = await fetch(fileUrl);
            const tgData = await tgResp.json();
            if (!tgData.ok) {
                return res.status(404).end();
            }
            const filePath = tgData.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${filePath}`;
            const fileResp = await fetch(downloadUrl);
            res.setHeader("Content-Type", fileResp.headers.get("content-type") || "application/octet-stream");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            fileResp.body.pipe(res);
        } catch (err) {
            return res.status(500).json({ error: "Unexpected server error: " + err.message });
        }
        return;
    }

    return res.status(404).json({ error: "Not found" });
}
