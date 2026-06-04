import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bot = new Bot(process.env.KIRA_TOKEN);
await bot.init();

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

  if (error) {
    return ctx.reply("Failed to upload image.");
  }

  const { data: publicUrlData } = supabase.storage
    .from("images")
    .getPublicUrl(fileName);

  const imageUrl = publicUrlData.publicUrl;
  const encodedUrl = encodeURIComponent(imageUrl);

  const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${encodedUrl}`;
  const yandexUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodedUrl}`;
  const startpageUrl = `https://www.startpage.com/do/dsearch?query=${encodedUrl}&cat=images`;

  return ctx.reply("🔍 Search this image:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Google Lens", url: googleLensUrl }],
        [{ text: "Yandex", url: yandexUrl }],
        [{ text: "Startpage", url: startpageUrl }],
      ],
    },
  });
});

bot.on("message:text", (ctx) => ctx.reply("You said: " + ctx.message.text));

export async function POST(request) {
  const body = await request.json();
  await bot.handleUpdate(body);
  return new Response("ok");
}
