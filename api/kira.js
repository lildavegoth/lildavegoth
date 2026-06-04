import { Bot, webhookCallback } from "grammy";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bot = new Bot(process.env.KIRA_TOKEN);

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

bot.on("message:text", (ctx) => ctx.reply("You said: " + ctx.message.text));

export const POST = webhookCallback(bot, "cloudflare");
