import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "stream/promises";
import { createWriteStream, statSync, unlinkSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bot = new Bot(process.env.KIRA_TOKEN);
await bot.init();

const MAX_DIRECT_MB = 0;

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
    if (text && (text.startsWith("/revive") || text.startsWith("/shutdown") || text.startsWith("/restart"))) {
        return next();
    }
    const maintenance = await isUnderMaintenance();
    if (maintenance) return;
    return next();
});

bot.command("shutdown", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    await setMaintenance(true);
    return ctx.reply("Bot is now in maintenance mode.");
});

bot.command("revive", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    await setMaintenance(false);
    return ctx.reply("Bot is back online.");
});

bot.command("restart", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.OWNER_TELEGRAM_ID) return;
    if (!process.env.VERCEL_DEPLOY_HOOK) {
        return ctx.reply("Deploy hook not configured.");
    }
    await fetch(process.env.VERCEL_DEPLOY_HOOK, { method: "POST" });
    return ctx.reply("Redeploying…");
});

bot.command("start", async (ctx) => {
    const user = ctx.from;
    await supabase.from("users").upsert({
        telegram_id: user.id,
        first_name: user.first_name,
        username: user.username,
        language: user.language_code,
    });
    return ctx.reply(`Hey ${user.first_name}! I'm alive and I remember you.`);
});

bot.command("ping", (ctx) => ctx.reply("pong"));

bot.on(":photo", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const fileName = `${Date.now()}.jpg`;

    const { error } = await supabase.storage
        .from("images")
        .upload(fileName, buffer, {
            contentType: "image/jpeg",
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

bot.on(":video", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    try {
        const video = ctx.message.video;
        const fileId = video.file_id;
        const fileSize = video.file_size || 0;
        const sizeMB = fileSize / (1024 * 1024);

        if (sizeMB > MAX_DIRECT_MB) {
            await ctx.reply("Queuing your video…");
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

            if (error) return ctx.reply("Failed to queue video.");

            const { data: publicUrlData } = supabase.storage
                .from("videos")
                .getPublicUrl(fileName);
            const publicUrl = publicUrlData.publicUrl;

            const dispatchBody = {
                event_type: "compress-video",
                client_payload: {
                    chat_id: ctx.chat.id,
                    video_url: publicUrl,
                    original_name: fileName,
                },
            };

            await fetch(
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

            return ctx.reply("I’ll send the compressed video here when it’s ready.");
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
    } catch {
        return ctx.reply("Video processing error.");
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

bot.command("mirror", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const text = ctx.message.text;
    const parts = text.split(" ");

    let url = "";
    let originalFilename = null;

    if (parts.length >= 2) {
        url = parts[1];
    } else if (ctx.message.reply_to_message) {
        const reply = ctx.message.reply_to_message;
        let fileId = null;

        if (reply.document) {
            fileId = reply.document.file_id;
            originalFilename = reply.document.file_name;
        } else if (reply.video) {
            fileId = reply.video.file_id;
            originalFilename = reply.video.file_name;
        } else if (reply.audio) {
            fileId = reply.audio.file_id;
            originalFilename = reply.audio.file_name;
        } else if (reply.photo) {
            const largest = reply.photo[reply.photo.length - 1];
            fileId = largest.file_id;
            originalFilename = `photo_${fileId}.jpg`;
        } else if (reply.voice) {
            fileId = reply.voice.file_id;
            originalFilename = `voice_${fileId}.ogg`;
        } else if (reply.video_note) {
            fileId = reply.video_note.file_id;
            originalFilename = `video_note_${fileId}.mp4`;
        } else if (reply.sticker) {
            fileId = reply.sticker.file_id;
            originalFilename = `sticker_${fileId}.webp`;
        }

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

    await ctx.reply("Mirroring…");

    const dispatchBody = {
        event_type: "mirror",
        client_payload: {
            chat_id: ctx.chat.id,
            download_url: url,
            message: "Mirror request from Telegram",
            filename: originalFilename || "",
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
            return ctx.reply("Failed to start mirror: " + err);
        }
    } catch (e) {
        return ctx.reply("Error: " + e.message);
    }
});

bot.command("imagesearch", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || !reply.photo) {
        return ctx.reply("Reply to a photo with /imagesearch to search it.");
    }

    const photos = reply.photo;
    const fileId = photos[photos.length - 1].file_id;
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    const fileName = `${Date.now()}.jpg`;

    const { error } = await supabase.storage
        .from("images")
        .upload(fileName, buffer, {
            contentType: "image/jpeg",
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
            await ctx.reply("Queuing your video…");
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

            if (error) return ctx.reply("Failed to queue video.");

            const { data: publicUrlData } = supabase.storage
                .from("videos")
                .getPublicUrl(fileName);
            const publicUrl = publicUrlData.publicUrl;

            const dispatchBody = {
                event_type: "compress-video",
                client_payload: {
                    chat_id: ctx.chat.id,
                    video_url: publicUrl,
                    original_name: fileName,
                },
            };

            await fetch(
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

            return ctx.reply("I’ll send the compressed video here when it’s ready.");
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
    } catch {
        return ctx.reply("Video processing error.");
    }
});

bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) {
        return ctx.reply("No command for: " + ctx.message.text);
    }
});

export async function POST(request) {
    const body = await request.json();
    await bot.handleUpdate(body);
    return new Response("ok");
}
