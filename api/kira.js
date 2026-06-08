import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "stream/promises";
import { createWriteStream, statSync, unlinkSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import jsQR from "jsqr";

const execFileAsync = promisify(execFile);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bot = new Bot(process.env.KIRA_TOKEN);
await bot.init();

const MAX_DIRECT_MB = 0;

const mirrorJobs = new Map();
const pendingRenames = new Map();

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

bot.command("cancel", async (ctx) => {
    const pk = pendingKey(ctx.chat.id, ctx.from.id);
    const renameJobKey = pendingRenames.get(pk);
    let cancelled = false;

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
            break;
        }
    }

    if (cancelled) {
        return ctx.reply("Mirror operation cancelled.");
    }
    return ctx.reply("No active mirror operation to cancel.");
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

    const jobKey = Math.random().toString(36).slice(2, 10);
    mirrorJobs.set(jobKey, {
        url,
        originalFilename,
        storage: null,
        promptMessageId: null,
        chatId: ctx.chat.id,
        userId: ctx.from.id,
    });

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Drive", callback_data: `storage_drive_${jobKey}` },
                    { text: "Filen", callback_data: `storage_filen_${jobKey}` },
                ],
            ],
        },
    };

    const promptMsg = await ctx.reply("Which storage do you prefer?", keyboard);
    mirrorJobs.get(jobKey).promptMessageId = promptMsg.message_id;
});

bot.callbackQuery(/^storage_(drive|filen)_(.+)$/, async (ctx) => {
    const storage = ctx.match[1];
    const jobKey = ctx.match[2];
    const job = mirrorJobs.get(jobKey);

    if (!job || job.chatId !== ctx.chat.id || job.userId !== ctx.from.id) {
        await ctx.answerCallbackQuery("This action has expired. Please /mirror again.");
        return;
    }

    await ctx.answerCallbackQuery();
    job.storage = storage;

    await ctx.api.deleteMessage(ctx.chat.id, job.promptMessageId);

    const renameKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "Yes", callback_data: `rename_yes_${jobKey}` },
                    { text: "No", callback_data: `rename_no_${jobKey}` },
                ],
            ],
        },
    };

    const renameMsg = await ctx.reply("Do you want to rename the file before mirroring?", renameKeyboard);
    job.promptMessageId = renameMsg.message_id;
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
        let filename = job.originalFilename;
        if (!filename) {
            try {
                const urlPath = new URL(job.url).pathname;
                const segments = urlPath.split('/');
                const lastSegment = segments[segments.length - 1];
                if (lastSegment && lastSegment.includes('.')) {
                    filename = decodeURIComponent(lastSegment);
                } else {
                    filename = "file";
                }
            } catch {
                filename = "file";
            }
        }
        await startMirror(ctx, job.url, filename, job.storage);
    } else {
        await ctx.editMessageText("Send the new file name:");
        pendingRenames.set(pendingKey(ctx.chat.id, ctx.from.id), jobKey);
    }
});

async function startMirror(ctx, url, filename, storage) {
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
            storage: storage,
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

bot.command("qr", async (ctx) => {
    const reply = ctx.message?.reply_to_message;
    if (!reply || !reply.photo) {
        return ctx.reply("Reply to a photo with /qr to scan it.");
    }

    const photos = reply.photo;
    const fileId = photos[photos.length - 1].file_id;
    try {
        const file = await ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.KIRA_TOKEN}/${file.file_path}`;
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const qrResult = jsQR(
            new Uint8ClampedArray(data.buffer),
            info.width,
            info.height
        );

        if (qrResult && qrResult.data) {
            return ctx.reply(`QR Code content:\n${qrResult.data}`);
        } else {
            return ctx.reply("No QR code found in the image, try to make the QR code look clearer.");
        }
    } catch {
        return ctx.reply("Failed to process the image.");
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
            await startMirror(ctx, job.url, newName, job.storage);
            return;
        }
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
