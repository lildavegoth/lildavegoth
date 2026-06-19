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

tokenLines.forEach((token, index) => {
    const botNumber = index + 1;
    const bot = new Bot(token);
    bots[botNumber] = bot;

    bot.on("message", async (ctx) => {
        if (ctx.chat.type === "private") return;
        try {
            const { data: channels } = await supabase
                .from("user_channels")
                .select("user_id")
                .eq("channel_id", ctx.chat.id);

            if (!channels || channels.length === 0) return;

            const userIds = channels.map((c) => c.user_id);

            const { data: autoRows } = await supabase
                .from("auto_reactions")
                .select("user_id")
                .in("user_id", userIds)
                .eq("enabled", true);

            if (!autoRows || autoRows.length === 0) return;

            const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
            await ctx.api.setMessageReaction(ctx.chat.id, ctx.message.message_id, [{
                type: "emoji",
                emoji: emoji,
            }], { is_big: true });
        } catch {}
    });
});

export async function POST(request) {
    const url = new URL(request.url);
    const botNum = url.searchParams.get("bot");
    const bot = bots[botNum];
    if (!bot) {
        return new Response("bot not found", { status: 404 });
    }
    const body = await request.json();
    await bot.init().catch(() => {});
    await bot.handleUpdate(body);
    return new Response("ok");
}
