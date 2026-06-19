import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const REACT_EMOJIS = ["👍","🔥","👌","😢","❤️","👏","😱","😭"];

const bots = {};

const tokensEnv = process.env.REACTION_BOT_TOKENS || "";
const tokenLines = tokensEnv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

await Promise.all(
    tokenLines.map(async (token, index) => {
        const bot = new Bot(token);
        await bot.init();
        const botNumber = index + 1;
        bots[botNumber] = bot;

        const react = async (ctx) => {
            try {
                const msg = ctx.message || ctx.channelPost;
                if (!msg) return;
                if (ctx.chat?.type === "private") return;

                const chatId = ctx.chat.id.toString();
                const shortId = chatId.startsWith("-100") ? chatId.slice(4) : chatId;

                const { data: channels } = await supabase
                    .from("user_channels")
                    .select("user_id")
                    .or(`channel_id.eq.${chatId},channel_id.eq.${shortId}`);

                if (!channels || channels.length === 0) return;

                const userIds = channels.map((c) => c.user_id);

                const { data: autoRows } = await supabase
                    .from("auto_reactions")
                    .select("user_id")
                    .in("user_id", userIds)
                    .eq("enabled", true);

                if (!autoRows || autoRows.length === 0) return;

                const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
                await ctx.api.setMessageReaction(ctx.chat.id, msg.message_id, [{
                    type: "emoji",
                    emoji: emoji,
                }], { is_big: true });
            } catch {}
        };

        bot.on("message", react);
        bot.on("channel_post", react);
    })
);

export async function POST(request) {
    const url = new URL(request.url);
    const botNum = url.searchParams.get("bot");
    const bot = bots[botNum];
    if (!bot) return new Response("bot not found", { status: 404 });
    const body = await request.json();
    await bot.handleUpdate(body);
    return new Response("ok");
}
