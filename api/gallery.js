import crypto from "crypto";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/gallery\/?/, "");

    if (path === "auth" && req.method === "POST") {
        const { hash, ...data } = req.body;
        const secret = crypto
            .createHash("sha256")
            .update(process.env.KIRA_TOKEN)
            .digest();
        const checkString = Object.keys(data)
            .sort()
            .map((k) => `${k}=${data[k]}`)
            .join("\n");
        const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
        if (hmac !== hash) {
            res.status(403).json({ error: "Invalid hash" });
            return;
        }
        const userId = data.id;
        const chatId = process.env.CHANNEL_ID;
        const memberUrl = `https://api.telegram.org/bot${process.env.KIRA_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
        const memberResp = await fetch(memberUrl);
        const memberData = await memberResp.json();
        if (!memberData.ok || ["left", "kicked"].includes(memberData.result?.status)) {
            res.status(403).json({ error: "Not a member" });
            return;
        }
        const token = jwt.sign(
            { userId, username: data.username || "" },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.json({ token });
        return;
    }

    if (path === "media" && req.method === "GET") {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const token = authHeader.split(" ")[1];
        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        const channelId = process.env.CHANNEL_ID;
        const listKey = "media:" + channelId + ":list";
        const hashKey = "media:" + channelId;
        const limit = parseInt(req.query.limit) || 50;
        const cursor = parseInt(req.query.cursor) || 0;
        const ids = await kv.zrange(listKey, cursor, cursor + limit - 1, { rev: true });
        const items = [];
        for (const id of ids) {
            const raw = await kv.hget(hashKey, id);
            if (raw) items.push(JSON.parse(raw));
        }
        const nextCursor = ids.length === limit ? cursor + limit : null;
        res.json({ items, nextCursor });
        return;
    }

    const fileMatch = path.match(/^file\/(.+)$/);
    if (fileMatch && req.method === "GET") {
        const fileId = fileMatch[1];
        const fileUrl = `https://api.telegram.org/bot${process.env.KIRA_TOKEN}/getFile?file_id=${fileId}`;
        const tgResp = await fetch(fileUrl);
        const tgData = await tgResp.json();
        if (!tgData.ok) {
            res.status(404).end();
            return;
        }
        const filePath = tgData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${filePath}`;
        const fileResp = await fetch(downloadUrl);
        res.setHeader("Content-Type", fileResp.headers.get("content-type") || "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        fileResp.body.pipe(res);
        return;
    }

    res.status(404).json({ error: "Not found" });
}
