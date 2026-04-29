import discord
from discord import app_commands
from discord.ui import View, Select, Button
from life import life_command
import aiohttp
from bs4 import BeautifulSoup
import asyncio
import time
import urllib.parse
import os
import sqlite3
import base64
import hashlib
import re
from datetime import datetime, timedelta, timezone

try:
    from cryptography.fernet import Fernet
    HAS_FERNET = True
except ImportError:
    HAS_FERNET = False

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

WELCOME_CHANNEL_ID = 0
WELCOME_MESSAGE = "Welcome {user.mention} to the server!"
FILTER_CHANNEL_ID = 1497778778087362614
ROLE_NAME = "Pure"
AUTO_REACT_CHANNELS = [1497786098947199161, 1497808451966075072]
AUTO_REACT_EMOJIS = ["kk_like", "kk_love"]
IMAGE_SEARCH_CHANNEL_ID = 1498380257882013919
image_search_cooldowns = {}
afk_users = {}
KEY_FILE = "encryption.key"

def load_or_create_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "rb") as f:
            return f.read()
    if HAS_FERNET:
        key = Fernet.generate_key()
    else:
        key = base64.urlsafe_b64encode(os.urandom(32))
    with open(KEY_FILE, "wb") as f:
        f.write(key)
    return key

encryption_key = os.getenv("ENCRYPTION_KEY")
if encryption_key:
    encryption_key = encryption_key.encode()
else:
    encryption_key = load_or_create_key()

if HAS_FERNET:
    cipher = Fernet(encryption_key)
else:
    derived_key = hashlib.sha256(encryption_key).digest()
    def encrypt(plaintext: str) -> str:
        plain_bytes = plaintext.encode()
        encrypted_bytes = bytes([a ^ b for a, b in zip(plain_bytes, derived_key * (len(plain_bytes) // len(derived_key) + 1))])
        return base64.urlsafe_b64encode(encrypted_bytes).decode()

    def decrypt(ciphertext: str) -> str:
        encrypted_bytes = base64.urlsafe_b64decode(ciphertext.encode())
        plain_bytes = bytes([a ^ b for a, b in zip(encrypted_bytes, derived_key * (len(encrypted_bytes) // len(derived_key) + 1))])
        return plain_bytes.decode()

    class CipherFallback:
        def encrypt(self, data):
            return encrypt(data.decode()).encode()
        def decrypt(self, data):
            return decrypt(data.decode()).encode()
    cipher = CipherFallback()

DB_PATH = "tokens.db"

def setup_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS tokens (user_id TEXT PRIMARY KEY, encrypted_token TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, remind_at REAL, message TEXT, repeat_interval TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS autopurge (channel_id TEXT PRIMARY KEY, last_purge TEXT)")

async def store_token(user_id, plain_token):
    encrypted = cipher.encrypt(plain_token.encode()).decode()
    def _store():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT OR REPLACE INTO tokens (user_id, encrypted_token) VALUES (?, ?)", (str(user_id), encrypted))
            conn.commit()
    await asyncio.to_thread(_store)

async def get_token(user_id):
    def _get():
        with sqlite3.connect(DB_PATH) as conn:
            row = conn.execute("SELECT encrypted_token FROM tokens WHERE user_id = ?", (str(user_id),)).fetchone()
        return row
    row = await asyncio.to_thread(_get)
    if row:
        return cipher.decrypt(row[0].encode()).decode()
    return None

async def delete_token(user_id):
    def _delete():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM tokens WHERE user_id = ?", (str(user_id),))
            conn.commit()
    await asyncio.to_thread(_delete)

def parse_time(text):
    match = re.match(r"(\d+)\s*(s|m|h|d|w)", text.lower())
    if not match:
        return None
    amount = int(match.group(1))
    unit = match.group(2)
    if unit == "s":
        return amount
    elif unit == "m":
        return amount * 60
    elif unit == "h":
        return amount * 3600
    elif unit == "d":
        return amount * 86400
    elif unit == "w":
        return amount * 604800
    return None

async def reminder_loop():
    await bot.wait_until_ready()
    while not bot.is_closed():
        now = time.time()
        def _query():
            with sqlite3.connect(DB_PATH) as conn:
                return conn.execute("SELECT id, user_id, remind_at, message FROM reminders WHERE remind_at <= ?", (now,)).fetchall()
        rows = await asyncio.to_thread(_query)
        for row in rows:
            id, uid, remind_at, message = row
            user = bot.get_user(int(uid)) or await bot.fetch_user(int(uid))
            if user:
                try:
                    await user.send(f"Reminder: {message}")
                except:
                    pass
            def _delete():
                with sqlite3.connect(DB_PATH) as conn:
                    conn.execute("DELETE FROM reminders WHERE id = ?", (id,))
                    conn.commit()
            await asyncio.to_thread(_delete)
        await asyncio.sleep(30)

class MyClient(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        guild = discord.Object(id=1497778776669683732)
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)
    
bot = MyClient()

def is_admin(interaction: discord.Interaction):
    return (
        interaction.user.guild_permissions.administrator or
        any(role.name == ROLE_NAME for role in interaction.user.roles)
    )

class RoleButton(Button):
    def __init__(self, role: discord.Role, emoji: str):
        super().__init__(label=role.name, emoji=emoji, style=discord.ButtonStyle.secondary)
        self.role = role

    async def callback(self, interaction: discord.Interaction):
        if self.role in interaction.user.roles:
            await interaction.user.remove_roles(self.role)
            msg = f"Removed {self.role.name}"
        else:
            await interaction.user.add_roles(self.role)
            msg = f"Added {self.role.name}"
    
        if interaction.response.is_done():
            await interaction.followup.send(msg, ephemeral=True)
        else:
            await interaction.response.send_message(msg, ephemeral=True)

class RoleView(View):
    def __init__(self, roles, emojis):
        super().__init__(timeout=300)
        for role, emoji in zip(roles, emojis):
            self.add_item(RoleButton(role, emoji))

class SearchView(View):
    def __init__(self, site, query, all_results):
        super().__init__(timeout=120)
        self.site = site
        self.query = query
        self.all_results = all_results
        self.current_page = 0
        self.per_page = 5

    def get_page_results(self):
        start = self.current_page * self.per_page
        end = start + self.per_page
        return self.all_results[start:end]

    def build_content(self):
        page_results = self.get_page_results()
        lines = [f"**Search on {self.site.upper()}: {self.query}**\n"]
        for idx, (title, link) in enumerate(page_results, 1):
            lines.append(f"{idx}. {title}: {link}")
        total_pages = max(1, -(-len(self.all_results) // self.per_page))
        lines.append(f"\nPage {self.current_page + 1}/{total_pages}")
        return "\n".join(lines)

    def update_buttons(self):
        self.previous_button.disabled = self.current_page == 0
        self.next_button.disabled = (self.current_page + 1) * self.per_page >= len(self.all_results)

    async def update_message(self, interaction):
        self.update_buttons()
        await interaction.response.edit_message(content=self.build_content(), view=self)

    @discord.ui.button(label="Previous", style=discord.ButtonStyle.secondary, custom_id="prev")
    async def previous_button(self, interaction: discord.Interaction, button: Button):
        self.current_page -= 1
        await self.update_message(interaction)

    @discord.ui.button(label="Next", style=discord.ButtonStyle.secondary, custom_id="next")
    async def next_button(self, interaction: discord.Interaction, button: Button):
        self.current_page += 1
        await self.update_message(interaction)

@bot.tree.command(name="setwelcome", description="Setup welcome system")
@app_commands.describe(channel="Channel", message="Message (use {user.mention})")
async def setwelcome(interaction: discord.Interaction, channel: discord.TextChannel, message: str):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    global WELCOME_CHANNEL_ID, WELCOME_MESSAGE
    WELCOME_CHANNEL_ID = channel.id
    WELCOME_MESSAGE = message
    await interaction.response.send_message("Welcome system updated")

@bot.tree.command(name="testwelcome", description="Test welcome message")
@app_commands.describe(user="User to test")
async def testwelcome(interaction: discord.Interaction, user: discord.Member):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    if WELCOME_CHANNEL_ID == 0:
        await interaction.response.send_message("Welcome not set", ephemeral=True)
        return
    channel = interaction.guild.get_channel(WELCOME_CHANNEL_ID)
    msg = WELCOME_MESSAGE.replace("{user.mention}", user.mention)
    embed = discord.Embed(description=msg)
    embed.set_image(url="https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/images/discord/welcome.webp")
    await channel.send(embed=embed)
    await interaction.response.send_message("Test sent", ephemeral=True)

@bot.event
async def on_member_join(member):
    channel_id = WELCOME_CHANNEL_ID if WELCOME_CHANNEL_ID != 0 else FILTER_CHANNEL_ID
    channel = member.guild.get_channel(channel_id)
    if channel:
        msg = WELCOME_MESSAGE.replace("{user.mention}", member.mention)
        embed = discord.Embed(description=msg)
        embed.set_image(url="https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/images/discord/welcome.webp")
        await channel.send(embed=embed)

@bot.event
async def on_message(message):
    if message.channel.id == FILTER_CHANNEL_ID:
        if "glad you're here" in message.content.lower():
            await message.delete()
            return

    if message.author.bot:
        return
    
    if message.author.id in afk_users:
        del afk_users[message.author.id]
        await message.channel.send(f"Welcome back {message.author.mention}! Your AFK status has been removed.")

    for mention in message.mentions:
        if mention.id in afk_users and mention.id != message.author.id:
            await message.channel.send(f"{mention.display_name} is AFK: {afk_users[mention.id]}")
    
    parent = getattr(message.channel, "parent_id", None)
    if parent in [1497786098947199161, 1497808451966075072]:
        asyncio.create_task(add_reactions_async(message))

    if message.channel.id == IMAGE_SEARCH_CHANNEL_ID and message.attachments:
        for attachment in message.attachments:
            if attachment.content_type and attachment.content_type.startswith("image/"):
                await handle_image_search(message, attachment)
                break

async def add_reactions_async(message):
    for name in ["kk_like", "kk_love"]:
        emoji = discord.utils.get(message.guild.emojis, name=name)
        if emoji:
            try:
                await message.add_reaction(emoji)
            except:
                pass

@bot.tree.command(name="purge", description="Delete all messages in this channel")
async def purge(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    while True:
        deleted = await interaction.channel.purge(limit=100)
        if len(deleted) < 100:
            break

    await interaction.followup.send("Channel cleaned", ephemeral=True)

@bot.tree.command(name="autopurge", description="Enable auto daily purge for a channel")
@app_commands.describe(channel="Channel to purge daily")
async def autopurge(interaction: discord.Interaction, channel: discord.TextChannel):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    def _store():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT OR REPLACE INTO autopurge (channel_id, last_purge) VALUES (?, ?)", (str(channel.id), None))
            conn.commit()
    await asyncio.to_thread(_store)
    await interaction.response.send_message(f"Auto-purge enabled for {channel.mention} at 06:00 daily.", ephemeral=True)

@bot.tree.command(name="purgecancel", description="Cancel auto‑purge for a channel")
@app_commands.describe(channel="Channel to remove from auto‑purge")
async def purgecancel(interaction: discord.Interaction, channel: discord.TextChannel):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    def _delete():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM autopurge WHERE channel_id = ?", (str(channel.id),))
            conn.commit()
    await asyncio.to_thread(_delete)
    await interaction.response.send_message(f"Auto‑purge cancelled for {channel.mention}.", ephemeral=True)

async def autopurge_loop():
    await bot.wait_until_ready()
    while not bot.is_closed():
        now = datetime.now(timezone(timedelta(hours=7)))

        target = now.replace(hour=6, minute=0, second=0, microsecond=0)

        if now >= target:
            target += timedelta(days=1)

        wait_seconds = (target - now).total_seconds()
        await asyncio.sleep(wait_seconds)

        today_str = target.strftime("%Y-%m-%d")

        def _get_channels():
            with sqlite3.connect(DB_PATH) as conn:
                return conn.execute(
                    "SELECT channel_id FROM autopurge WHERE last_purge != ? OR last_purge IS NULL",
                    (today_str,)
                ).fetchall()

        rows = await asyncio.to_thread(_get_channels)

        for (cid,) in rows:
            channel = bot.get_channel(int(cid))
            if channel:
                try:
                    while True:
                        deleted = await channel.purge(limit=100)
                        if len(deleted) < 100:
                            break
                except:
                    pass

            def _update():
                with sqlite3.connect(DB_PATH) as conn:
                    conn.execute(
                        "INSERT OR REPLACE INTO autopurge (channel_id, last_purge) VALUES (?, ?)",
                        (cid, today_str)
                    )
                    conn.commit()

            await asyncio.to_thread(_update)

@bot.tree.command(name="avatar", description="Show avatar")
@app_commands.describe(user="User ID or Mention (@name)")
async def avatar(interaction: discord.Interaction, user: discord.User = None):
    user = user or interaction.user
    await interaction.response.send_message(user.display_avatar.url, ephemeral=True)

@bot.tree.command(name="setuproles", description="Setup role buttons")
@app_commands.describe(channel="Channel", message="Message", roles="Roles", emojis="Emojis")
async def setuproles(interaction: discord.Interaction, channel: discord.TextChannel, message: str, roles: str, emojis: str):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    role_list = []
    for r in roles.split():
        r = r.replace("<@&", "").replace(">", "")
        role = interaction.guild.get_role(int(r))
        if role:
            role_list.append(role)

    emoji_list = emojis.split()

    if len(role_list) != len(emoji_list):
        await interaction.followup.send("Roles and emojis must match", ephemeral=True)
        return

    view = RoleView(role_list, emoji_list)
    await channel.send(message, view=view)

    await interaction.followup.send("Role buttons created", ephemeral=True)

async def fetch_html(url):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Referer": "https://www.startpage.com/",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.get(url) as r:
            return await r.text()

async def fetch_og_data(url):
    try:
        html = await fetch_html(url)
        soup = BeautifulSoup(html, "html.parser")
        title = (
            (soup.find("meta", property="og:title") or {}).get("content") or
            (soup.find("title") or {}).string or
            ""
        ).strip()
        description = (
            (soup.find("meta", property="og:description") or {}).get("content") or
            (soup.find("meta", attrs={"name": "description"}) or {}).get("content") or
            ""
        ).strip()
        image = (
            (soup.find("meta", property="og:image") or {}).get("content") or
            ""
        ).strip()
        return title, description, image
    except:
        return "", "", ""

async def search_mal(query):
    url = f"https://myanimelist.net/anime.php?q={query}"
    html = await fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    results = []
    for item in soup.select(".js-categories-seasonal a.hoverinfo_trigger")[:15]:
        title = item.text.strip()
        link = item.get("href")
        results.append((title, link))
    return results

async def search_sp(query):
    url = f"https://www.startpage.com/do/search?q={query}"
    html = await fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")

    results = []
    for item in soup.select("a.result-link")[:15]:
        title = item.text.strip()
        link = item.get("href")
        results.append((title, link))
    return results

@bot.tree.command(name="search", description="Search MAL or StartPage")
@app_commands.describe(site="mal or sp", query="Search name")
async def search(interaction: discord.Interaction, site: str, query: str):
    await interaction.response.defer()

    if site.lower() == "mal":
        results = await search_mal(query)
    elif site.lower() == "sp":
        results = await search_sp(query)
    else:
        await interaction.followup.send("Use mal or sp")
        return

    if not results:
        await interaction.followup.send("No results found")
        return

    view = SearchView(site.lower(), query, results)
    await interaction.followup.send(view.build_content(), view=view)

async def handle_image_search(message, attachment):
    user_id = message.author.id
    now = time.time()
    if any(role.name == "Pure" for role in message.author.roles):
        pass
    elif user_id in image_search_cooldowns and now < image_search_cooldowns[user_id]:
        await message.channel.send(f"Hey, {message.author.mention}. You must wait for 1 hour to be able to do search again")
        return

    encoded = urllib.parse.quote(attachment.url)

    view = View(timeout=60)
    view.add_item(Button(label="Google", url=f"https://www.google.com/searchbyimage?safe=off&sbisrc=tg&image_url={encoded}", style=discord.ButtonStyle.url))
    view.add_item(Button(label="SauceNAO", url=f"https://saucenao.com/search.php?url={encoded}", style=discord.ButtonStyle.url))
    view.add_item(Button(label="Bing", url=f"https://www.bing.com/images/search?q=imgurl:{encoded}&view=detailv2&iss=sbi", style=discord.ButtonStyle.url))
    view.add_item(Button(label="Yandex", url=f"https://yandex.com/images/search?url={encoded}&rpt=imageview", style=discord.ButtonStyle.url))

    image_search_cooldowns[user_id] = now + 3600
    await message.channel.send(f"Here's the results of your Image {message.author.mention}", view=view)

@bot.tree.command(name="setkey", description="Set your OpenRouter API key")
@app_commands.describe(token="Your OpenRouter key")
async def setkey(interaction: discord.Interaction, token: str):
    await store_token(interaction.user.id, token)
    await interaction.response.send_message("Your API key has been saved securely.", ephemeral=True)

@bot.tree.command(name="delkey", description="Delete your saved API key")
async def delkey(interaction: discord.Interaction):
    await delete_token(interaction.user.id)
    await interaction.response.send_message("Your API key has been deleted.", ephemeral=True)

@bot.tree.command(name="kira", description="Ask Kira AI")
@app_commands.describe(text="Your message")
async def kira(interaction: discord.Interaction, text: str):
    await interaction.response.defer()
    token = await get_token(interaction.user.id)
    if not token:
        view = View()
        view.add_item(Button(label="Create Key", url="https://openrouter.ai/workspaces/default/keys?", style=discord.ButtonStyle.url))
        await interaction.followup.send("You're not set the token key yet, let's create one and add it by send /setkey command after create.", view=view)
        return

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://discord.com",
        "X-Title": "Discord Bot"
    }
    payload = {
        "model": "openrouter/free",
        "messages": [{"role": "user", "content": text}],
        "max_tokens": 800,
        "temperature": 0.7
    }

    async def fetch_reply():
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                data = await resp.json()
                return resp.status, data

    try:
        status, data = await asyncio.wait_for(fetch_reply(), timeout=600)
    except asyncio.TimeoutError:
        await interaction.followup.send(f"{interaction.user.mention}: {text}\nI'm sorry, i've been taking too long for answering, can you try to repeat it again?")
        return
    except Exception as e:
        await interaction.followup.send(f"{interaction.user.mention}: {text}\nRequest failed: {str(e)}")
        return

    if status != 200:
        error_msg = data.get("error", {}).get("message", f"API error {status}")
        await interaction.followup.send(f"{interaction.user.mention}: {text}\nError: {error_msg}")
        return

    reply = data["choices"][0]["message"]["content"]
    full_message = f"{interaction.user.mention}: {text}\n\n{reply}"

    if len(full_message) <= 2000:
        await interaction.followup.send(full_message)
    else:
        await interaction.followup.send(f"{interaction.user.mention}: {text}")
        chunk_size = 1900
        for i in range(0, len(reply), chunk_size):
            await interaction.followup.send(reply[i:i+chunk_size])

@bot.tree.command(name="showpin", description="Show all pinned messages in this channel")
async def showpin(interaction: discord.Interaction):
    pins = []
    async for msg in interaction.channel.pins():
        pins.append(msg)

    if not pins:
        await interaction.response.send_message("No pinned messages")
        return

    lines = ["# Pinned Message"]
    for msg in pins:
        content = msg.content.strip()
        if not content:
            text = "Message"
        else:
            first_line = content.split("\n")[0].strip()
            first_sentence = first_line.split(",")[0].strip()
            text = first_sentence if first_sentence else first_line[:80]

        escaped_text = text.replace("\\", "\\\\").replace("*", "\\*").replace("_", "\\_").replace("~", "\\~").replace("[", "\\[").replace("]", "\\]").replace(">", "\\>").replace("`", "\\`")
        link = f"https://discord.com/channels/{interaction.guild_id}/{interaction.channel_id}/{msg.id}"
        lines.append(f"* [{escaped_text}]({link})")

    await interaction.response.send_message("\n".join(lines))

@bot.tree.command(name="jumptotop", description="Jump to the first message in this channel")
async def jumptotop(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    async for msg in interaction.channel.history(limit=1, oldest_first=True):
        link = f"https://discord.com/channels/{interaction.guild_id}/{interaction.channel_id}/{msg.id}"
        await interaction.followup.send(f"[Click to jump to top]({link})", ephemeral=True)
        return
    await interaction.followup.send("No messages found", ephemeral=True)

@bot.tree.command(name="lock", description="Lock the channel for @everyone")
async def lock(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=False)
    await interaction.response.send_message("Channel locked.")

@bot.tree.command(name="unlock", description="Unlock the channel for @everyone")
async def unlock(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=None)
    await interaction.response.send_message("Channel unlocked.")

@bot.tree.command(name="remindme", description="Set a reminder")
@app_commands.describe(duration="e.g., 30m, 1h, 2d", message="What to remind")
async def remindme(interaction: discord.Interaction, duration: str, message: str):
    seconds = parse_time(duration)
    if seconds is None:
        await interaction.response.send_message("Invalid time format. Use like: 30m, 1h, 2d, 1w", ephemeral=True)
        return
    remind_at = time.time() + seconds
    def _store():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("INSERT INTO reminders (user_id, remind_at, message, repeat_interval) VALUES (?, ?, ?, ?)",
                         (str(interaction.user.id), remind_at, message, "none"))
            conn.commit()
    await asyncio.to_thread(_store)
    await interaction.response.send_message(f"Reminder set for {duration} from now.", ephemeral=True)

@bot.tree.command(name="remindclear", description="Clear all your reminders")
async def remindclear(interaction: discord.Interaction):
    def _clear():
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM reminders WHERE user_id = ?", (str(interaction.user.id),))
            conn.commit()
    await asyncio.to_thread(_clear)
    await interaction.response.send_message("All your reminders have been cleared.", ephemeral=True)

@bot.tree.command(name="afk", description="Set your AFK status")
@app_commands.describe(reason="Reason for being away")
async def afk(interaction: discord.Interaction, reason: str = "AFK"):
    afk_users[interaction.user.id] = reason
    await interaction.response.send_message(f"You are now AFK: {reason}", ephemeral=True)

@bot.tree.command(name="afkclear", description="Clear your AFK status")
async def afkclear(interaction: discord.Interaction):
    if interaction.user.id in afk_users:
        del afk_users[interaction.user.id]
        await interaction.response.send_message("Your AFK status has been cleared.", ephemeral=True)
    else:
        await interaction.response.send_message("You were not AFK.", ephemeral=True)

bot.tree.command(name="life", description="Live your life!")(life_command)

@bot.event
async def on_ready():
    setup_db()
    bot.loop.create_task(reminder_loop())
    bot.loop.create_task(autopurge_loop())
    print(f"Logged in as {bot.user}")

import os
bot.run(os.getenv("DISCORD_TOKEN"))
