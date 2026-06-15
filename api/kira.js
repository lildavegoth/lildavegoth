import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "stream/promises";
import { createWriteStream, statSync, unlinkSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bot = new Bot(process.env.KIRA_TOKEN);
await bot.init();

try {
    const { data: restartRow, error: restartErr } = await supabase
        .from("bot_config")
        .select("value")
        .eq("key", "restart_pending")
        .single();
    if (!restartErr && restartRow && restartRow.value) {
        const ownerChatId = restartRow.value;
        await supabase
            .from("bot_config")
            .delete()
            .eq("key", "restart_pending");
        await bot.api.sendMessage(ownerChatId, "I'm back, ready to assist you");
    }
} catch {}

const MAX_DIRECT_MB = 0;

const mirrorJobs = new Map();
const pendingRenames = new Map();
const fetchMessages = new Map();
const pendingAdminAction = new Map();
const pendingConnectAction = new Map();
const postButtons = new Map();

function pendingKey(chatId, userId) {
    return `${chatId}:${userId}`;
}

async function isUnderMaintenance() {
    try {
        const { data, error } = await supabase
            .from("bot_config")
            .select("value")
            .eq("key", "maintenance")
            .single();
        if (error || !data) return false;
        return data.value === "true";
    } catch {
        return false;
    }
}

async function setMaintenance(value) {
    try {
        await supabase
            .from("bot_config")
            .update({ value: value ? "true" : "false" })
            .eq("key", "maintenance");
    } catch {}
}

bot.use(async (ctx, next) => {
    const text = ctx.message?.text;
    const cbData = ctx.callbackQuery?.data;
    if (
        (text && (text.startsWith("/revive") || text.startsWith("/shutdown") || text.startsWith("/restart"))) ||
        (cbData && (cbData === "admin_shutdown" || cbData === "admin_revive" || cbData === "admin_restart"))
    ) {
        return next();
    }
    const maintenance = await isUnderMaintenance();
    if (maintenance) return;
    return next();
});

bot.use(async (ctx, next) => {
    if (ctx.from.id.toString() === process.env.OWNER_TELEGRAM_ID) {
        return next();
    }

    const text = ctx.message?.text;
    if (text && text.startsWith("/start")) {
        return next();
    }

    const { data, error } = await supabase
        .from("allowed_users")
        .select("telegram_id")
        .eq("telegram_id", ctx.from.id)
        .maybeSingle();

    if (error || !data) {
        return;
    }

    return next();
});

bot.use(async (ctx, next) => {
    if (ctx.from && ctx.chat) {
        const user = ctx.from;
        await supabase.from("users").upsert({
            telegram_id: user.id,
            first_name: user.first_name,
            username: user.username,
            language: user.language_code,
        });
    }
    return next();
});

bot.command("owner", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    return ctx.reply(`Hey ${ctx.from.first_name}! I'm here for you.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Users", callback_data: "admin_users" }],
                [{ text: "Grant", callback_data: "admin_grant" }, { text: "Revoke", callback_data: "admin_revoke" }],
                [{ text: "Shutdown", callback_data: "admin_shutdown" }, { text: "Revive", callback_data: "admin_revive" }],
                [{ text: "Restart", callback_data: "admin_restart" }],
            ],
        },
    });
});

bot.callbackQuery("admin_users", async (ctx) => {
    await ctx.answerCallbackQuery();
    const { data: users, error } = await supabase
        .from("users")
        .select("telegram_id, username, first_name")
        .order("telegram_id", { ascending: true });

    if (error) {
        return ctx.reply("Failed to fetch users: " + error.message);
    }

    if (!users || users.length === 0) {
        return ctx.reply("No users yet.");
    }

    const lines = users.map(
        (u) => `**${u.username || u.first_name || "Unknown"}** - \`${u.telegram_id}\``
    );
    const text = lines.join("\n");

    if (text.length <= 4000) {
        return ctx.reply(text, { parse_mode: "Markdown" });
    }

    const buffer = Buffer.from(text, "utf-8");
    return ctx.replyWithDocument(
        { source: buffer, filename: "users.md" },
        { caption: "List of users." }
    );
});

bot.callbackQuery("admin_grant", async (ctx) => {
    await ctx.answerCallbackQuery();
    pendingAdminAction.set(ctx.from.id, "grant");
    return ctx.reply("Send me the Telegram ID to grant access.");
});

bot.callbackQuery("admin_revoke", async (ctx) => {
    await ctx.answerCallbackQuery();
    pendingAdminAction.set(ctx.from.id, "revoke");
    return ctx.reply("Send me the Telegram ID to revoke access.");
});

bot.callbackQuery("admin_shutdown", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    await setMaintenance(true);
    await ctx.answerCallbackQuery();
    return ctx.reply("Bot is now in maintenance mode.");
});

bot.callbackQuery("admin_revive", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    await setMaintenance(false);
    await ctx.answerCallbackQuery();
    return ctx.reply("Bot is back online.");
});

bot.callbackQuery("admin_restart", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    if (!process.env.VERCEL_DEPLOY_HOOK) {
        await ctx.answerCallbackQuery();
        return ctx.reply("Deploy hook not configured.");
    }
    await supabase
        .from("bot_config")
        .upsert({ key: "restart_pending", value: ctx.chat.id.toString() });
    await fetch(process.env.VERCEL_DEPLOY_HOOK, { method: "POST" });
    await ctx.answerCallbackQuery();
    return ctx.reply("Redeploying…");
});

bot.command("connect", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    return ctx.reply("Do you want me to post to your channel or something?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Connect", callback_data: "connect_prompt" }],
                [{ text: "Channels", callback_data: "list_channels" }],
            ],
        },
    });
});

bot.callbackQuery("connect_prompt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    pendingConnectAction.set(ctx.from.id, "connect");
    return ctx.reply(
        "Send me your channel ID and add me as an admin to let me post to your channel, you can add me in 5 channels\n\nFormat: Channel Name Channel ID\nExample: Yume 1513725816"
    );
});

bot.callbackQuery("list_channels", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    const { data: channels, error } = await supabase
        .from("user_channels")
        .select("channel_name, channel_id")
        .eq("user_id", ctx.from.id)
        .order("id", { ascending: true });

    if (error) {
        return ctx.reply("Failed to fetch channels.");
    }

    if (!channels || channels.length === 0) {
        return ctx.reply("You have no connected channels.");
    }

    const lines = channels.map((c) => `**${c.channel_name}** - \`${c.channel_id}\``);
    const text = lines.join("\n");

    return ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "Revoke", callback_data: "revoke_prompt" }],
            ],
        },
    });
});

bot.callbackQuery("revoke_prompt", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    pendingConnectAction.set(ctx.from.id, "revoke");
    return ctx.reply("You want to delete access to your channel? Send me your Channel ID.");
});

bot.command("start", async (ctx) => {
    const user = ctx.from;
    await supabase.from("users").upsert({
        telegram_id: user.id,
        first_name: user.first_name,
        username: user.username,
        language: user.language_code,
    });
    return ctx.reply(
        `Hey! I'm Kira, i'll be ready to assist you if you're one of friend of my owner @lildavegoth\n\nDon't forget to check Kakoi Kiraku Home page to see more useful stuff from @lildavegoth`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Kakoi Kiraku Home", url: "https://kakoi-kiraku-home.vercel.app/" }],
                ],
            },
        }
    );
});

bot.command("ping", (ctx) => ctx.reply("pong"));

bot.command("cancel", async (ctx) => {
    let cancelled = false;

    const pk = pendingKey(ctx.chat.id, ctx.from.id);
    const renameJobKey = pendingRenames.get(pk);
    if (renameJobKey) {
        pendingRenames.delete(pk);
        const job = mirrorJobs.get(renameJobKey);
        if (job) {
            mirrorJobs.delete(renameJobKey);
            try { await ctx.api.deleteMessage(ctx.chat.id, job.promptMessageId); } catch {}
        }
        cancelled = true;
    }

    for (const [jobKey, job] of mirrorJobs) {
        if (job.chatId === ctx.chat.id && job.userId === ctx.from.id) {
            mirrorJobs.delete(jobKey);
            try { await ctx.api.deleteMessage(ctx.chat.id, job.promptMessageId); } catch {}
            cancelled = true;
        }
    }

    for (const [key, msgId] of fetchMessages) {
        if (key.startsWith(`${ctx.chat.id}_`)) {
            fetchMessages.delete(key);
            try { await ctx.api.deleteMessage(ctx.chat.id, msgId); } catch {}
            cancelled = true;
        }
    }

    if (pendingAdminAction.has(ctx.from.id)) {
        pendingAdminAction.delete(ctx.from.id);
        cancelled = true;
    }

    if (pendingConnectAction.has(ctx.from.id)) {
        pendingConnectAction.delete(ctx.from.id);
        cancelled = true;
    }

    if (cancelled) {
        return ctx.reply("All pending operations cancelled.");
    }
    return ctx.reply("No active operations to cancel.");
});

bot.command("mirror", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const text = ctx.message.text;
    const parts = text.split(" ");

    let url = "";

    if (parts.length >= 2) {
        url = parts[1];
    } else if (ctx.message.reply_to_message) {
        const reply = ctx.message.reply_to_message;
        let fileId = null;

        if (reply.document) fileId = reply.document.file_id;
        else if (reply.video) fileId = reply.video.file_id;
        else if (reply.audio) fileId = reply.audio.file_id;
        else if (reply.photo) fileId = reply.photo[reply.photo.length - 1].file_id;
        else if (reply.voice) fileId = reply.voice.file_id;
        else if (reply.video_note) fileId = reply.video_note.file_id;
        else if (reply.sticker) fileId = reply.sticker.file_id;

        if (fileId) {
            try {
                const file = await ctx.api.getFile(fileId);
                if (file.file_path) {
                    url = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;
                }
            } catch (e) {
                if (e.error_code === 400 && e.description && e.description.includes("file is too big")) {
                    return ctx.reply("This file is too large to be mirrored via Telegram.");
                }
                return ctx.reply("Failed to get file info.");
            }
        }
    }

    if (!url || !url.startsWith("http")) {
        return ctx.reply("Usage: /mirror <url> or reply to a file with /mirror");
    }

    let filename = "Unknown";
    let fileSize = "Unknown";

    try {
        const headRes = await fetch(url, { method: "HEAD" });
        if (headRes.ok) {
            const disposition = headRes.headers.get("content-disposition");
            if (disposition) {
                const match = disposition.match(/filename\*?=(?:UTF-8''|"")?(.+?)(?:;|$)/i);
                if (match) filename = match[1].replace(/"/g, "").trim();
            }
            if (filename === "Unknown") {
                const urlPath = new URL(url).pathname;
                filename = decodeURIComponent(urlPath.split("/").pop()) || "Unknown";
            }
            const cl = headRes.headers.get("content-length");
            if (cl) {
                const mb = parseInt(cl, 10) / (1024 * 1024);
                fileSize = mb >= 1 ? `${mb.toFixed(0)}MB` : `${(mb * 1024).toFixed(0)}KB`;
            }
        }
    } catch {}

    const jobKey = Math.random().toString(36).slice(2, 10);
    mirrorJobs.set(jobKey, {
        url,
        filename,
        fileSize,
        chatId: ctx.chat.id,
        userId: ctx.from.id,
    });

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Drive", callback_data: `mirror_dest_drive_${jobKey}` },
                    { text: "Telegram", callback_data: `mirror_dest_telegram_${jobKey}` },
                ],
            ],
        },
    };

    await ctx.reply(
        `Where do you want the file to be saved? Use Telegram if your file is less than 50MB\n\nDetails\nName: ${filename}\nSize: ${fileSize}`,
        keyboard
    );
});

bot.callbackQuery(/^mirror_dest_(drive|telegram)_(.+)$/, async (ctx) => {
    const destination = ctx.match[1];
    const jobKey = ctx.match[2];
    const job = mirrorJobs.get(jobKey);

    if (!job || job.chatId !== ctx.chat.id || job.userId !== ctx.from.id) {
        await ctx.answerCallbackQuery("This action has expired. Please /mirror again.");
        return;
    }

    job.destination = destination;
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Yes", callback_data: `rename_yes_${jobKey}` },
                    { text: "No", callback_data: `rename_no_${jobKey}` },
                ],
            ],
        },
    };

    const promptMsg = await ctx.reply("Do you want to rename the file before mirroring?", keyboard);
    job.promptMessageId = promptMsg.message_id;
});

bot.callbackQuery(/^rename_(yes|no)_(.+)$/, async (ctx) => {
    const choice = ctx.match[1];
    const jobKey = ctx.match[2];
    const job = mirrorJobs.get(jobKey);

    if (!job || job.chatId !== ctx.chat.id || job.userId !== ctx.from.id) {
        await ctx.answerCallbackQuery("This action has expired. Please /mirror again.");
        return;
    }

    await ctx.answerCallbackQuery();

    if (choice === "no") {
        mirrorJobs.delete(jobKey);
        await ctx.api.deleteMessage(ctx.chat.id, job.promptMessageId);
        let filename = job.filename;
        if (filename === "Unknown") {
            try {
                const urlPath = new URL(job.url).pathname;
                filename = decodeURIComponent(urlPath.split("/").pop()) || "file";
            } catch {
                filename = "file";
            }
        }
        await startMirror(ctx, job.url, filename, job.destination);
    } else {
        await ctx.editMessageText("Send the new file name:");
        pendingRenames.set(pendingKey(ctx.chat.id, ctx.from.id), jobKey);
    }
});

async function startMirror(ctx, url, filename, destination) {
    const sentMsg = await ctx.reply("Mirroring…");

    let jobLabel = filename.replace(/\.[^/.]+$/, "");
    if (jobLabel.length > 50) jobLabel = jobLabel.substring(0, 50);

    const dispatchBody = {
        event_type: "mirror",
        client_payload: {
            chat_id: ctx.chat.id,
            message_id: sentMsg.message_id,
            download_url: url,
            filename: filename,
            job_label: jobLabel,
            destination: destination,
        },
    };

    try {
        const res = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${process.env.GITHUB_PAT}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dispatchBody),
            }
        );
        if (!res.ok) {
            const err = await res.text();
            await ctx.api.editMessageText(ctx.chat.id, sentMsg.message_id, "Mirror failed: " + err);
        }
    } catch (e) {
        await ctx.api.editMessageText(ctx.chat.id, sentMsg.message_id, "Mirror error: " + e.message);
    }
}

bot.command("download", async (ctx) => {
    const text = ctx.message.text;
    const parts = text.split(" ");
    if (parts.length < 2) {
        return ctx.reply("Usage: /download <url>");
    }
    const url = parts[1];
    if (!url.startsWith("http")) {
        return ctx.reply("Invalid URL.");
    }

    const fetchingMsg = await ctx.reply("Let me fetch the media first.");
    const jobKey = `${ctx.chat.id}_${Date.now()}`;
    fetchMessages.set(jobKey, fetchingMsg.message_id);

    const dispatchBody = {
        event_type: "fetch-media-info",
        client_payload: {
            chat_id: ctx.chat.id,
            url: url,
            job_key: jobKey,
            fetching_message_id: fetchingMsg.message_id,
        },
    };

    try {
        const res = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${process.env.GITHUB_PAT}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dispatchBody),
            }
        );
        if (!res.ok) {
            await ctx.api.deleteMessage(ctx.chat.id, fetchingMsg.message_id);
            return ctx.reply("Failed to start media fetch.");
        }
    } catch (e) {
        await ctx.api.deleteMessage(ctx.chat.id, fetchingMsg.message_id);
        return ctx.reply("Dispatch error: " + e.message);
    }
});

bot.callbackQuery(/^dl_fmt_(.+)_(.+)$/, async (ctx) => {
    const formatId = ctx.match[1];
    const url = ctx.match[2];
    await ctx.answerCallbackQuery();
    try {
        await ctx.deleteMessage();
    } catch {}

    const progressMsg = await ctx.reply("Downloading…");

    const dispatchBody = {
        event_type: "download-media",
        client_payload: {
            chat_id: ctx.chat.id,
            url: url,
            format_id: formatId,
            progress_message_id: progressMsg.message_id,
        },
    };

    try {
        const res = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${process.env.GITHUB_PAT}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dispatchBody),
            }
        );
        if (!res.ok) {
            await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, "Download failed: dispatch error.");
        }
    } catch (e) {
        await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, "Download error: " + e.message);
    }
});

bot.callbackQuery(/^imgbuf_(enhance|restore)_(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const shortKey = ctx.match[2];

    const { data: row, error: fetchErr } = await supabase
        .from("temp_file_ids")
        .select("file_id")
        .eq("key", shortKey)
        .single();

    if (fetchErr || !row) {
        await ctx.answerCallbackQuery("This action has expired. Please use /imagebuff again.");
        return;
    }

    const fileId = row.file_id;
    await supabase.from("temp_file_ids").delete().eq("key", shortKey);
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup(undefined);

    try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const fileName = `${action}_${Date.now()}.jpg`;

        const { error } = await supabase.storage
            .from("images")
            .upload(fileName, buffer, {
                contentType: "image/jpeg",
                upsert: true,
            });

        if (error) {
            await ctx.editMessageText("Failed to upload image.");
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from("images")
            .getPublicUrl(fileName);
        const imageUrl = publicUrlData.publicUrl;

        const eventType = action === "enhance" ? "enhance-image" : "restore-image";

        const dispatchBody = {
            event_type: eventType,
            client_payload: {
                chat_id: ctx.chat.id,
                image_url: imageUrl,
                original_name: fileName,
                progress_message_id: ctx.callbackQuery.message.message_id,
            },
        };

        const dispatchRes = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${process.env.GITHUB_PAT}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dispatchBody),
            }
        );

        if (!dispatchRes.ok) {
            await ctx.editMessageText("Dispatch failed: " + (await dispatchRes.text()));
            return;
        }

        await ctx.editMessageText("Processing image, please wait…");
    } catch (e) {
        await ctx.editMessageText("Error: " + e.message);
    }
});

bot.command("post", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const reply = ctx.message?.reply_to_message;
    if (!reply) {
        return ctx.reply("Reply to a message with /post to create a post.");
    }

    const originalText = reply.text || reply.caption || "";
    const lines = originalText.split("\n");
    const buttonLines = [];
    const contentLines = [];

    for (const line of lines) {
        if (line.match(/\[.+\]\(buttonurl:\/\/.+\)/)) {
            buttonLines.push(line);
        } else {
            contentLines.push(line);
        }
    }

    const buttons = buttonLines.slice(0, 3).map((line) => {
        const match = line.match(/\[(.+)\]\(buttonurl:\/\/(.+)\)/);
        if (match) {
            return { text: match[1], url: "https://" + match[2] };
        }
        return null;
    }).filter(Boolean);

    const { data: channels, error } = await supabase
        .from("user_channels")
        .select("channel_id, channel_name")
        .eq("user_id", ctx.from.id)
        .order("id", { ascending: true });

    if (error || !channels || channels.length === 0) {
        return ctx.reply("You have no connected channels. Use /connect to add one.");
    }

    const postKey = Math.random().toString(36).slice(2, 10);
    postButtons.set(postKey, buttons);

    const cleanText = contentLines.join("\n").trim();

    let fileId = null;
    let mediaType = "text";

    if (reply.photo) {
        mediaType = "photo";
        fileId = reply.photo[reply.photo.length - 1].file_id;
    } else if (reply.video) {
        mediaType = "video";
        fileId = reply.video.file_id;
    } else if (reply.document) {
        mediaType = "document";
        fileId = reply.document.file_id;
    } else if (reply.audio) {
        mediaType = "audio";
        fileId = reply.audio.file_id;
    } else if (reply.voice) {
        mediaType = "voice";
        fileId = reply.voice.file_id;
    }

    const channelButtons = channels.map((c) => [{
        text: c.channel_name || c.channel_id,
        callback_data: `post_to_channel_${c.channel_id}_${postKey}`,
    }]);

    postButtons.set(postKey + "_media", { type: mediaType, fileId, cleanText, chatId: reply.chat.id, messageId: reply.message_id });

    const previewText = cleanText || (reply.photo ? "[Photo]" : reply.video ? "[Video]" : reply.document ? "[Document]" : reply.audio ? "[Audio]" : reply.voice ? "[Voice]" : "[Message]");

    return ctx.reply(previewText, {
        reply_markup: {
            inline_keyboard: channelButtons,
        },
    });
});

bot.callbackQuery(/^post_to_channel_(.+)_(.+)$/, async (ctx) => {
    let channelId = ctx.match[1];
    const postKey = ctx.match[2];

    if (!channelId.startsWith("-100")) {
        channelId = "-100" + channelId;
    }

    const buttons = postButtons.get(postKey) || [];
    const mediaData = postButtons.get(postKey + "_media") || {};
    postButtons.delete(postKey);
    postButtons.delete(postKey + "_media");

    const replyMarkup = buttons.length > 0
        ? { inline_keyboard: [buttons] }
        : undefined;

    const { type, fileId, cleanText, chatId, messageId } = mediaData;

    try {
        if (type === "text") {
            await ctx.api.sendMessage(channelId, cleanText, { reply_markup: replyMarkup });
        } else if (fileId) {
            await ctx.api.copyMessage(channelId, chatId, messageId, { reply_markup: replyMarkup, caption: cleanText || undefined });
        } else {
            await ctx.api.sendMessage(channelId, cleanText, { reply_markup: replyMarkup });
        }
        await ctx.answerCallbackQuery("Posted!");
        await ctx.deleteMessage();
    } catch (e) {
        await ctx.answerCallbackQuery("Failed to post. Make sure I'm admin in the channel.");
    }
});

bot.command("imagesearch", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || (!reply.photo && !reply.sticker)) {
        return ctx.reply("Reply to a photo or sticker with /imagesearch to search it.");
    }

    let fileId, fileExt, contentType;

    if (reply.photo) {
        const photos = reply.photo;
        fileId = photos[photos.length - 1].file_id;
        fileExt = "jpg";
        contentType = "image/jpeg";
    } else {
        fileId = reply.sticker.file_id;
        fileExt = "webp";
        contentType = "image/webp";
    }

    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
        .from("images")
        .upload(fileName, buffer, {
            contentType: contentType,
            upsert: true,
        });

    if (error) return ctx.reply("Failed to upload image.");

    const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;
    const encodedUrl = encodeURIComponent(imageUrl);

    const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodedUrl}`;
    const yandexUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodedUrl}`;

    return ctx.reply("🔍 Search this image:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Google Lens", url: googleLensUrl }],
                [{ text: "Yandex", url: yandexUrl }],
            ],
        },
    });
});

bot.command("imagebuff", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || !reply.photo) {
        return ctx.reply("Reply to a photo with /imagebuff to enhance or restore it.");
    }

    const photos = reply.photo;
    const fileId = photos[photos.length - 1].file_id;

    const shortKey = Math.random().toString(36).slice(2, 8);
    await supabase.from("temp_file_ids").insert({ key: shortKey, file_id: fileId });

    return ctx.reply("What do you want to do with this image?", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Enhance", callback_data: `imgbuf_enhance_${shortKey}` },
                    { text: "Restore", callback_data: `imgbuf_restore_${shortKey}` },
                ],
            ],
        },
    });
});

bot.command("videoreduce", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || !reply.video) {
        return ctx.reply("Reply to a video with /videoreduce to compress it.");
    }

    try {
        const video = reply.video;
        const fileId = video.file_id;
        const fileSize = video.file_size || 0;
        const sizeMB = fileSize / (1024 * 1024);

        if (sizeMB > MAX_DIRECT_MB) {
            const queuingMsg = await ctx.reply("Queuing your video…");
            const file = await ctx.api.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;
            const response = await fetch(fileUrl);
            const buffer = await response.arrayBuffer();
            const fileName = `raw_${Date.now()}.mp4`;

            const { error } = await supabase.storage
                .from("videos")
                .upload(fileName, buffer, {
                    contentType: "video/mp4",
                    upsert: true,
                });

            if (error) {
                await ctx.api.deleteMessage(ctx.chat.id, queuingMsg.message_id);
                return ctx.reply("Failed to queue video: " + error.message);
            }

            const { data: publicUrlData } = supabase.storage
                .from("videos")
                .getPublicUrl(fileName);
            const publicUrl = publicUrlData.publicUrl;

            const progressMsg = await ctx.reply("I’ll send the compressed video here when it’s ready.");
            await ctx.api.deleteMessage(ctx.chat.id, queuingMsg.message_id);

            const dispatchBody = {
                event_type: "compress-video",
                client_payload: {
                    chat_id: ctx.chat.id,
                    video_url: publicUrl,
                    original_name: fileName,
                    progress_message_id: progressMsg.message_id,
                },
            };

            const dispatchRes = await fetch(
                `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `token ${process.env.GITHUB_PAT}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(dispatchBody),
                }
            );

            if (!dispatchRes.ok) {
                const errText = await dispatchRes.text();
                await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, "Dispatch failed: " + errText);
            }
            return;
        }

        if (!ffmpegPath) return ctx.reply("Video compression unavailable.");

        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;

        const inputPath = `/tmp/input_${Date.now()}.mp4`;
        const outputPath = `/tmp/output_${Date.now()}.mp4`;

        const res = await fetch(fileUrl);
        const writeStream = createWriteStream(inputPath);
        await pipeline(res.body, writeStream);

        await execFileAsync(ffmpegPath, [
            "-y",
            "-i", inputPath,
            "-s", "1280x720",
            "-c:v", "libx264",
            "-crf", "28",
            "-filter:v", "fps=fps=60",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "48000",
            "-preset", "ultrafast",
            "-movflags", "faststart",
            outputPath
        ]);

        const outputSize = statSync(outputPath).size;
        if (outputSize < 100) {
            unlinkSync(inputPath);
            unlinkSync(outputPath);
            return ctx.reply("Compression failed. Try a different video.");
        }

        const { error } = await supabase.storage
            .from("images")
            .upload(`compressed_${Date.now()}.mp4`, outputPath, {
                contentType: "video/mp4",
                upsert: true,
            });

        unlinkSync(inputPath);
        unlinkSync(outputPath);

        if (error) return ctx.reply("Failed to upload compressed video.");

        const { data: publicUrlData } = supabase.storage
            .from("images")
            .getPublicUrl(`compressed_${Date.now()}.mp4`);

        return ctx.replyWithVideo(publicUrlData.publicUrl, {
            caption: "Here’s your compressed video.",
        });
    } catch (e) {
        return ctx.reply("Video processing error: " + (e.message || "unknown"));
    }
});

bot.command("videocapture", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || !reply.video) {
        return ctx.reply("Reply to a video with /videocapture to extract frames.");
    }

    const video = reply.video;
    const fileId = video.file_id;

    const captureMsg = await ctx.reply("Capturing frames…");
    try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;

        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        const fileName = `capture_${Date.now()}.mp4`;

        const { error } = await supabase.storage
            .from("videos")
            .upload(fileName, buffer, {
                contentType: "video/mp4",
                upsert: true,
            });

        if (error) {
            await ctx.api.deleteMessage(ctx.chat.id, captureMsg.message_id);
            return ctx.reply("Failed to queue video capture: " + error.message);
        }

        const { data: publicUrlData } = supabase.storage
            .from("videos")
            .getPublicUrl(fileName);
        const publicUrl = publicUrlData.publicUrl;

        const progressMsg = await ctx.reply("I’ll send the 10 frames here once they’re ready.");
        await ctx.api.deleteMessage(ctx.chat.id, captureMsg.message_id);

        const dispatchBody = {
            event_type: "capture-frames",
            client_payload: {
                chat_id: ctx.chat.id,
                video_url: publicUrl,
                original_name: fileName,
                progress_message_id: progressMsg.message_id,
            },
        };

        const dispatchRes = await fetch(
            `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
            {
                method: "POST",
                headers: {
                    Authorization: `token ${process.env.GITHUB_PAT}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(dispatchBody),
            }
        );

        if (!dispatchRes.ok) {
            const errText = await dispatchRes.text();
            await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, "Dispatch failed: " + errText);
        }
        return;
    } catch (e) {
        await ctx.api.deleteMessage(ctx.chat.id, captureMsg.message_id);
        return ctx.reply("Failed to start frame capture: " + (e.message || "unknown"));
    }
});

bot.on(":pinned_message", async (ctx) => {
    try {
        await ctx.deleteMessage();
    } catch {}
});

bot.on(":new_chat_members", async (ctx) => {
    try {
        await ctx.deleteMessage();
    } catch {}
});

bot.on(":left_chat_member", async (ctx) => {
    try {
        await ctx.deleteMessage();
    } catch {}
});

bot.on("message:text", async (ctx) => {
    const pk = pendingKey(ctx.chat.id, ctx.from.id);
    const jobKey = pendingRenames.get(pk);
    if (jobKey) {
        pendingRenames.delete(pk);
        const job = mirrorJobs.get(jobKey);
        if (job) {
            mirrorJobs.delete(jobKey);
            const newName = ctx.message.text.trim();
            await ctx.api.deleteMessage(ctx.chat.id, job.promptMessageId);
            await startMirror(ctx, job.url, newName, job.destination);
            return;
        }
    }

    if (pendingConnectAction.has(ctx.from.id)) {
        const action = pendingConnectAction.get(ctx.from.id);
        pendingConnectAction.delete(ctx.from.id);
        const input = ctx.message.text.trim();
        if (action === "connect") {
            const parts = input.split(/\s+/);
            if (parts.length < 2) {
                return ctx.reply("Invalid format. Use: Channel Name Channel ID");
            }
            const channelId = parts.pop();
            const channelName = parts.join(" ");

            const { count, error: countErr } = await supabase
                .from("user_channels")
                .select("*", { count: "exact", head: true })
                .eq("user_id", ctx.from.id);

            if (!countErr && count >= 5) {
                return ctx.reply("You already have 5 channels connected. Revoke one first.");
            }

            const { error } = await supabase.from("user_channels").insert({
                user_id: ctx.from.id,
                channel_id: channelId,
                channel_name: channelName,
            });

            if (error) {
                return ctx.reply("Failed to add channel. It may already be connected.");
            }
            return ctx.reply(`Channel "${channelName}" connected.`);
        } else if (action === "revoke") {
            const channelId = input;
            const { error } = await supabase
                .from("user_channels")
                .delete()
                .eq("user_id", ctx.from.id)
                .eq("channel_id", channelId);

            if (error) {
                return ctx.reply("Failed to revoke channel. Make sure the ID is correct.");
            }
            return ctx.reply("Channel revoked.");
        }
        return;
    }

    if (pendingAdminAction.has(ctx.from.id)) {
        const action = pendingAdminAction.get(ctx.from.id);
        pendingAdminAction.delete(ctx.from.id);
        const input = ctx.message.text.trim();
        const targetId = parseInt(input, 10);
        if (isNaN(targetId)) {
            return ctx.reply("Invalid Telegram ID.");
        }
        if (action === "grant") {
            const { error } = await supabase.from("allowed_users").upsert({ telegram_id: targetId });
            if (error) {
                return ctx.reply("Failed to grant access: " + error.message);
            }
            return ctx.reply(`Access granted to ${targetId}.`);
        } else if (action === "revoke") {
            const { error } = await supabase.from("allowed_users").delete().eq("telegram_id", targetId);
            if (error) {
                return ctx.reply("Failed to revoke access: " + error.message);
            }
            return ctx.reply(`Access revoked for ${targetId}.`);
        }
        return;
    }

    if (ctx.message.text.startsWith("/")) {
        return ctx.reply("No command for: " + ctx.message.text);
    }
});

export async function POST(request) {
    const body = await request.json();
    await bot.handleUpdate(body);
    return new Response("ok");
}
