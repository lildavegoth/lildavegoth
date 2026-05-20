import discord
from discord import app_commands
from discord.ui import View, Select, Button
from life import life_command
from weather import get_weather_report
from confess import post_confession
from purge import setup_purge
from level import setup_level, process_xp, schedule_shop_reset, private_room_loop, on_reaction_xp, on_interaction_xp
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
import sys
import subprocess
import shutil

LOG_FILE = "/home/container/console.log"

class LogWriter:
    def __init__(self, original, filename):
        self.original = original
        self.file = open(filename, "a", encoding="utf-8")

    def write(self, text):
        self.original.write(text)
        self.file.write(text)
        self.file.flush()

    def flush(self):
        self.original.flush()
        self.file.flush()

sys.stdout = LogWriter(sys.stdout, LOG_FILE)
sys.stderr = LogWriter(sys.stderr, LOG_FILE)

try:
    from cryptography.fernet import Fernet
    HAS_FERNET = True
except ImportError:
    HAS_FERNET = False

intents = discord.Intents.default()
intents.members = True
intents.message_content = True

ALLOWED_GUILD_ID = 1497778776669683732
WELCOME_CHANNEL_ID = 1500043387611385956
FILTER_CHANNEL_ID = 1497778778087362614
ROLE_NAME = "Pure"
AUTO_REACT_CHANNELS = [1497786098947199161, 1497808451966075072]
AUTO_REACT_EMOJIS = ["kk_like", "kk_love"]
IMAGE_SEARCH_CHANNEL_ID = 1498380257882013919
CONFESS_CHANNEL_ID = 1502146374450548928
LEVEL_DB_PATH = "/home/container/data/users_level.db"
afk_users = {}
KEY_FILE = "encryption.key"

DATA_DIR = "/home/container/data"
TOKEN_DB_PATH = f"{DATA_DIR}/tokens.db"
DB_PATH = f"{DATA_DIR}/data.db"
BANNED_MD_PATH = f"{DATA_DIR}/banned.md"
BANNED_LIST_CHANNEL = 1497790005395849337

WELCOME_MESSAGE_TEMPLATE = (
    "# Welcome!\n\n"
    "{user.mention} You are finally here, on **Kakoi Kiraku** server! Grab your coffee, relax, explore and stay for a while.\n\n"
    "# Don't →\n"
    "**Don't** forget to read Rules and Select your Roles\n\n"
    "# Take Note →\n"
    "Confused? Go to [基拉｜kira](https://discord.com/channels/1497778776669683732/1502192351529930793) for more information."
)

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

def setup_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(TOKEN_DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS tokens (user_id TEXT PRIMARY KEY, encrypted_token TEXT)")
        conn.commit()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, remind_at REAL, message TEXT, repeat_interval TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS autopurge (channel_id TEXT PRIMARY KEY, last_purge TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS cache_purge_config (id INTEGER PRIMARY KEY, enabled INTEGER DEFAULT 0, next_purge REAL)")
        conn.execute("CREATE TABLE IF NOT EXISTS banned_users (user_id TEXT PRIMARY KEY, username TEXT, reason TEXT, banned_at TEXT)")
        conn.commit()

def get_cache_purge_config():
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT enabled, next_purge FROM cache_purge_config WHERE id = 1").fetchone()
    if row:
        return row[0], row[1]
    return 0, 0

def set_cache_purge_config(enabled, next_purge):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT OR REPLACE INTO cache_purge_config (id, enabled, next_purge) VALUES (1, ?, ?)", (enabled, next_purge))
        conn.commit()

async def store_token(user_id, plain_token):
    encrypted = cipher.encrypt(plain_token.encode()).decode()
    def _store():
        with sqlite3.connect(TOKEN_DB_PATH) as conn:
            conn.execute("INSERT OR REPLACE INTO tokens (user_id, encrypted_token) VALUES (?, ?)", (str(user_id), encrypted))
            conn.commit()
    await asyncio.to_thread(_store)

async def get_token(user_id):
    def _get():
        with sqlite3.connect(TOKEN_DB_PATH) as conn:
            row = conn.execute("SELECT encrypted_token FROM tokens WHERE user_id = ?", (str(user_id),)).fetchone()
        return row
    row = await asyncio.to_thread(_get)
    if row:
        return cipher.decrypt(row[0].encode()).decode()
    return None

async def delete_token(user_id):
    def _delete():
        with sqlite3.connect(TOKEN_DB_PATH) as conn:
            conn.execute("DELETE FROM tokens WHERE user_id = ?", (str(user_id),))
            conn.commit()
    await asyncio.to_thread(_delete)

async def cache_purge_loop():
    await bot.wait_until_ready()
    while not bot.is_closed():
        enabled, next_purge = get_cache_purge_config()
        if enabled and time.time() >= next_purge:
            dirs_to_remove = ["/home/container/__pycache__", "/home/container/.cache"]
            for d in dirs_to_remove:
                if os.path.exists(d):
                    try:
                        shutil.rmtree(d, ignore_errors=True)
                    except:
                        pass
            set_cache_purge_config(1, time.time() + 604800)
        await asyncio.sleep(3600)

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

def format_duration(seconds):
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s" if secs else f"{mins}m"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m" if mins else f"{hours}h"

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
        guild = discord.Object(id=ALLOWED_GUILD_ID)
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.guild_id != ALLOWED_GUILD_ID:
            await interaction.response.send_message(
                "Kira will only works in Kakoi 気楽 server. [Join](https://discord.gg/tPbndvrRDd) to use it.",
                ephemeral=True
            )
            return False
        return True

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

class AniSearchView(SearchView):
    def __init__(self, query, all_results):
        super().__init__("ani", query, all_results)
        self.per_page = 1

    def build_content(self):
        page_results = self.get_page_results()
        if not page_results:
            return "No results found."
        item = page_results[0]
        total_pages = max(1, len(self.all_results))
        desc = f"**Score:** {item['score']} | **Episodes:** {item['episodes']}\n{item['synopsis']}"
        embed = discord.Embed(title=item["title"], url=item["link"], description=desc, color=0x2F6F8B)
        embed.set_thumbnail(url=item["cover"])
        embed.set_footer(text=f"Page {self.current_page + 1}/{total_pages}")
        return embed

    async def update_message(self, interaction):
        self.update_buttons()
        await interaction.response.edit_message(embed=self.build_content(), view=self)

@bot.tree.command(name="welcome", description="Welcome message")
@app_commands.describe(user="Manual test and welcoming new joined user")
async def welcome(interaction: discord.Interaction, user: discord.Member):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission", ephemeral=True)
        return
    if WELCOME_CHANNEL_ID == 0:
        await interaction.response.send_message("Welcome channel not set", ephemeral=True)
        return
    channel = interaction.guild.get_channel(WELCOME_CHANNEL_ID)
    msg = WELCOME_MESSAGE_TEMPLATE.replace("{user.mention}", user.mention)
    embed = discord.Embed(description=msg)
    embed.set_image(url="https://raw.githubusercontent.com/lildavegoth/lildavegoth/refs/heads/homepage/images/discord/welcome.webp")
    await channel.send(embed=embed)
    await interaction.response.send_message("Welcome message sent", ephemeral=True)

@bot.event
async def on_member_join(member):
    channel_id = WELCOME_CHANNEL_ID if WELCOME_CHANNEL_ID != 0 else FILTER_CHANNEL_ID
    channel = member.guild.get_channel(channel_id)
    if channel:
        msg = WELCOME_MESSAGE_TEMPLATE.replace("{user.mention}", member.mention)
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

    await process_xp(message)

    if message.author.id in afk_users:
        afk_info = afk_users.pop(message.author.id)
        duration_seconds = time.time() - afk_info["time"]
        duration_str = format_duration(duration_seconds)
        await message.channel.send(
            f"Welcome back {message.author.mention}! You were away for {duration_str}. Your AFK status has been removed."
        )

    for mention in message.mentions:
        if mention.id in afk_users and mention.id != message.author.id:
            afk_info = afk_users[mention.id]
            duration_seconds = time.time() - afk_info["time"]
            duration_str = format_duration(duration_seconds)
            await message.channel.send(
                f"{mention.display_name} is AFK ({duration_str}): {afk_info['reason']}"
            )

    parent = getattr(message.channel, "parent_id", None)
    if parent in [1497786098947199161, 1497808451966075072]:
        asyncio.create_task(add_reactions_async(message))

    if message.channel.id == IMAGE_SEARCH_CHANNEL_ID and message.attachments:
        for attachment in message.attachments:
            if attachment.content_type and attachment.content_type.startswith("image/"):
                await handle_image_search(message, attachment)
                break

@bot.event
async def on_reaction_add(reaction, user):
    await on_reaction_xp(reaction, user)

@bot.event
async def on_interaction(interaction: discord.Interaction):
    await on_interaction_xp(interaction)

@bot.event
async def on_member_remove(member):
    from level import remove_user_from_level
    if not member.bot:
        remove_user_from_level(member.id)

async def add_reactions_async(message):
    for name in ["kk_like", "kk_love"]:
        emoji = discord.utils.get(message.guild.emojis, name=name)
        if emoji:
            try:
                await message.add_reaction(emoji)
            except:
                pass

def record_ban(user_id, username, reason):
    now_str = datetime.now(timezone(timedelta(hours=7))).strftime("%Y-%m-%d %H:%M")
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT OR REPLACE INTO banned_users (user_id, username, reason, banned_at) VALUES (?, ?, ?, ?)",
                     (str(user_id), username, reason, now_str))
        conn.commit()

def generate_banned_md():
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT user_id, username, reason, banned_at FROM banned_users ORDER BY banned_at DESC").fetchall()
    lines = ["# Banned Users", ""]
    for uid, uname, reason, ban_time in rows:
        lines.append(f"* **{uname}** (<@{uid}>) — {reason} (banned {ban_time})")
    return "\n".join(lines)

async def update_banned_list_channel():
    content = generate_banned_md()
    with open(BANNED_MD_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    channel = bot.get_channel(BANNED_LIST_CHANNEL)
    if not channel:
        return
    async for msg in channel.history(limit=50):
        if msg.author == bot.user and msg.content.startswith("# Banned Users"):
            await msg.delete()
    await channel.send(content)

@bot.event
async def on_member_ban(guild, user):
    record_ban(user.id, user.name, "No reason (manual ban)")
    await update_banned_list_channel()

@bot.tree.command(name="ban", description="Ban a member with optional reason and message purge (Pure only)")
@app_commands.describe(user="Member to ban", reason="Reason for ban", purge="Purge their messages in this channel? (yes/no)")
@app_commands.choices(purge=[app_commands.Choice(name="Yes", value="yes"), app_commands.Choice(name="No", value="no")])
async def ban_command(interaction: discord.Interaction, user: discord.Member, reason: str = "No reason provided", purge: str = "no"):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return
    if user.top_role >= interaction.user.top_role and interaction.user != interaction.guild.owner:
        await interaction.response.send_message("You can't ban this member.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    if purge == "yes":
        def check(msg):
            return msg.author == user and not msg.pinned
        try:
            while True:
                deleted = await interaction.channel.purge(limit=100, check=check)
                if len(deleted) < 100:
                    break
        except Exception:
            pass
    await interaction.guild.ban(user, reason=reason)
    record_ban(user.id, user.name, reason)
    await update_banned_list_channel()
    await interaction.followup.send(f"Banned {user.mention} for: {reason}", ephemeral=True)

@bot.tree.command(name="banlist", description="Update the banned users list in the logs channel (Pure only)")
async def banlist_command(interaction: discord.Interaction):
    if not is_admin(interaction):
        await interaction.response.send_message("No permission.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    await update_banned_list_channel()
    await interaction.followup.send("Banned users list has been updated.", ephemeral=True)

@bot.tree.command(name="avatar", description="Show avatar and profile info")
@app_commands.describe(user="User to inspect")
async def avatar(interaction: discord.Interaction, user: discord.User = None):
    await interaction.response.defer(ephemeral=True)
    target = user or interaction.user
    fetched = await bot.fetch_user(target.id)
    banner_url = fetched.banner.url if fetched.banner else None
    created = target.created_at.strftime("%Y-%m-%d %H:%M UTC")
    member = interaction.guild.get_member(target.id) if interaction.guild else None
    joined = member.joined_at.strftime("%Y-%m-%d %H:%M UTC") if member and member.joined_at else "Not in server"

    avatar_url = target.display_avatar.url

    embed = discord.Embed(title=f"{target.display_name}'s Profile", color=target.accent_color or 0x5865F2)
    embed.set_image(url=avatar_url)
    embed.add_field(name="Account Created", value=created, inline=False)
    embed.add_field(name="Joined Server", value=joined, inline=False)

    if banner_url:
        view = View()
        view.add_item(Button(label="Banner", url=banner_url, style=discord.ButtonStyle.link))
        await interaction.followup.send(embed=embed, view=view, ephemeral=True)
    else:
        await interaction.followup.send(embed=embed, ephemeral=True)

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

async def search_ani(query):
    url = "https://graphql.anilist.co"
    query_gql = """
    query ($search: String) {
        Page(perPage: 15) {
            media(search: $search, type: ANIME) {
                id
                title { romaji english }
                siteUrl
                coverImage { large }
                episodes
                averageScore
                description
            }
        }
    }
    """
    variables = {"search": query}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json={"query": query_gql, "variables": variables}, headers=headers) as resp:
            data = await resp.json()
    results = []
    for media in data["data"]["Page"]["media"]:
        title = media["title"]["english"] or media["title"]["romaji"]
        link = media["siteUrl"]
        cover = media["coverImage"]["large"]
        episodes = media["episodes"] if media["episodes"] else "?"
        score = media["averageScore"] if media["averageScore"] else "N/A"
        synopsis = (media["description"] or "No synopsis")[:300].replace("<br>", "\n").replace("<i>", "").replace("</i>", "")
        results.append({
            "title": title, "link": link, "cover": cover,
            "episodes": episodes, "score": score, "synopsis": synopsis
        })
    return results

@bot.tree.command(name="search", description="Search MAL, StartPage or AniList")
@app_commands.describe(site="mal, sp or ani", query="Search name")
async def search(interaction: discord.Interaction, site: str, query: str):
    await interaction.response.defer()

    if site.lower() == "mal":
        results = await search_mal(query)
        view = SearchView(site.lower(), query, results)
    elif site.lower() == "sp":
        results = await search_sp(query)
        view = SearchView(site.lower(), query, results)
    elif site.lower() == "ani":
        results = await search_ani(query)
        view = AniSearchView(query, results)
    else:
        await interaction.followup.send("Use mal, sp, or ani")
        return

    if not results:
        await interaction.followup.send("No results found")
        return

    if isinstance(view, AniSearchView):
        await interaction.followup.send(embed=view.build_content(), view=view)
    else:
        await interaction.followup.send(view.build_content(), view=view)

async def handle_image_search(message, attachment):
    encoded = urllib.parse.quote(attachment.url)

    view = View(timeout=60)
    view.add_item(Button(label="Google", url=f"https://www.google.com/searchbyimage?safe=off&sbisrc=tg&image_url={encoded}", style=discord.ButtonStyle.url))
    view.add_item(Button(label="SauceNAO", url=f"https://saucenao.com/search.php?url={encoded}", style=discord.ButtonStyle.url))
    view.add_item(Button(label="Bing", url=f"https://www.bing.com/images/search?q=imgurl:{encoded}&view=detailv2&iss=sbi", style=discord.ButtonStyle.url))
    view.add_item(Button(label="Yandex", url=f"https://yandex.com/images/search?url={encoded}&rpt=imageview", style=discord.ButtonStyle.url))

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

LANG_CODE_MAP = {
    "afrikaans": "af", "albanian": "sq", "amharic": "am", "arabic": "ar",
    "armenian": "hy", "azerbaijani": "az", "basque": "eu", "belarusian": "be",
    "bengali": "bn", "bosnian": "bs", "bulgarian": "bg", "catalan": "ca",
    "cebuano": "ceb", "chichewa": "ny", "chinese": "zh", "corsican": "co",
    "croatian": "hr", "czech": "cs", "danish": "da", "dutch": "nl",
    "english": "en", "esperanto": "eo", "estonian": "et", "filipino": "tl",
    "finnish": "fi", "french": "fr", "frisian": "fy", "galician": "gl",
    "georgian": "ka", "german": "de", "greek": "el", "gujarati": "gu",
    "haitian creole": "ht", "hausa": "ha", "hawaiian": "haw", "hebrew": "iw",
    "hindi": "hi", "hmong": "hmn", "hungarian": "hu", "icelandic": "is",
    "igbo": "ig", "indonesian": "id", "irish": "ga", "italian": "it",
    "japanese": "ja", "javanese": "jv", "kannada": "kn", "kazakh": "kk",
    "khmer": "km", "korean": "ko", "kurdish": "ku", "kyrgyz": "ky",
    "lao": "lo", "latin": "la", "latvian": "lv", "lithuanian": "lt",
    "luxembourgish": "lb", "macedonian": "mk", "malagasy": "mg", "malay": "ms",
    "malayalam": "ml", "maltese": "mt", "maori": "mi", "marathi": "mr",
    "mongolian": "mn", "myanmar": "my", "nepali": "ne", "norwegian": "no",
    "pashto": "ps", "persian": "fa", "polish": "pl", "portuguese": "pt",
    "punjabi": "pa", "romanian": "ro", "russian": "ru", "samoan": "sm",
    "scots gaelic": "gd", "serbian": "sr", "sesotho": "st", "shona": "sn",
    "sindhi": "sd", "sinhala": "si", "slovak": "sk", "slovenian": "sl",
    "somali": "so", "spanish": "es", "sundanese": "su", "swahili": "sw",
    "swedish": "sv", "tajik": "tg", "tamil": "ta", "telugu": "te",
    "thai": "th", "turkish": "tr", "ukrainian": "uk", "urdu": "ur",
    "uzbek": "uz", "vietnamese": "vi", "welsh": "cy", "xhosa": "xh",
    "yiddish": "yi", "yoruba": "yo", "zulu": "zu"
}

VALID_LANG_CODES = set(LANG_CODE_MAP.values())

def get_language_code(name):
    name_lower = name.lower().strip()
    if name_lower in VALID_LANG_CODES:
        return name_lower
    return LANG_CODE_MAP.get(name_lower)

@bot.tree.command(name="translate", description="Translate any messages into any language")
@app_commands.describe(
    text="Text to translate",
    target="Target language (e.g., English, Indonesian, Japanese)"
)
async def translate(interaction: discord.Interaction, text: str, target: str):
    await interaction.response.defer(ephemeral=True)

    target_code = get_language_code(target)
    if target_code is None:
        await interaction.followup.send(
            f"Unknown language '{target}'. Please use an English name (e.g., Indonesian) or a language code (e.g., id).",
            ephemeral=True
        )
        return

    encoded_text = urllib.parse.quote(text)
    api_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target_code}&dt=t&q={encoded_text}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(api_url) as resp:
                data = await resp.json()
    except Exception as e:
        await interaction.followup.send(f"Translation request failed: {e}", ephemeral=True)
        return

    try:
        translated = "".join([part[0] for part in data[0] if part[0] is not None])
    except (IndexError, TypeError):
        await interaction.followup.send("Could not translate the text. Please try again later.", ephemeral=True)
        return

    if not translated.strip():
        await interaction.followup.send("No translation could be produced.", ephemeral=True)
        return

    await interaction.followup.send(
        f"# {target.capitalize()} Translated →\n{translated}",
        ephemeral=True
    )

@bot.tree.command(name="weather", description="Get today and tomorrow's weather forecast")
@app_commands.describe(city="City name")
async def weather(interaction: discord.Interaction, city: str):
    await interaction.response.defer()
    try:
        report = await get_weather_report(city)
    except Exception as e:
        await interaction.followup.send(f"Could not fetch weather for {city}. Error: {e}")
        return
    if report is None:
        await interaction.followup.send(f"City '{city}' not found.")
        return
    await interaction.followup.send(report)

@bot.tree.command(name="pip", description="Install, uninstall, upgrade a package, or purge caches (owner only)")
@app_commands.describe(type="install, uninstall, upgrade, or purge", package="Package name (use 'all' for purge)", auto="Enable/disable weekly cache purge")
@app_commands.choices(auto=[app_commands.Choice(name="Yes", value="yes"), app_commands.Choice(name="No", value="no")])
async def pip_command(interaction: discord.Interaction, type: str, package: str, auto: str = None):
    if interaction.user.id != 260185360246505473:
        await interaction.response.send_message("No permission.", ephemeral=True)
        return
    if type not in ("install", "uninstall", "upgrade", "purge"):
        await interaction.response.send_message("Type must be 'install', 'uninstall', 'upgrade', or 'purge'.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)

    if type == "purge" and package == "all":
        if auto is not None:
            if auto == "yes":
                set_cache_purge_config(1, time.time() + 604800)
                await interaction.followup.send("Weekly cache purge enabled. First automatic purge in 7 days.", ephemeral=True)
            else:
                set_cache_purge_config(0, 0)
                await interaction.followup.send("Weekly cache purge disabled.", ephemeral=True)
            return

        dirs_to_remove = ["/home/container/__pycache__", "/home/container/.cache"]
        results = []
        for d in dirs_to_remove:
            if os.path.exists(d):
                try:
                    shutil.rmtree(d, ignore_errors=True)
                    results.append(f"Removed: {d}")
                except Exception as e:
                    results.append(f"Failed to remove {d}: {e}")
            else:
                results.append(f"Not found: {d}")
        output = "\n".join(results)
        await interaction.followup.send(f"```\n{output[:1900]}\n```", ephemeral=True)
        return

    if type == "install":
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            capture_output=True, text=True
        )
    elif type == "uninstall":
        result = subprocess.run(
            [sys.executable, "-m", "pip", "uninstall", "-y", package],
            capture_output=True, text=True
        )
    else:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", package],
            capture_output=True, text=True
        )
    output = result.stdout + result.stderr
    await interaction.followup.send(f"```\n{output[:1900]}\n```", ephemeral=True)

@bot.tree.command(name="confess", description="Share an anonymous confession")
@app_commands.describe(
    title="Title of your confession",
    text="Your confession text"
)

async def confess(interaction: discord.Interaction, title: str, text: str):
    await interaction.response.defer(ephemeral=True)
    channel = interaction.guild.get_channel(CONFESS_CHANNEL_ID)
    if not channel:
        await interaction.followup.send("Confess forum not configured.", ephemeral=True)
        return
    try:
        await post_confession(channel, title, text)
    except Exception as e:
        await interaction.followup.send(f"Failed to post confession: {e}", ephemeral=True)
        return
    await interaction.followup.send("Your confession has been posted anonymously.", ephemeral=True)

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
    afk_users[interaction.user.id] = {"reason": reason, "time": time.time()}
    await interaction.response.send_message(f"You are now AFK: {reason}", ephemeral=True)

@bot.tree.command(name="afkclear", description="Clear your AFK status")
async def afkclear(interaction: discord.Interaction):
    if interaction.user.id in afk_users:
        del afk_users[interaction.user.id]
        await interaction.response.send_message("Your AFK status has been cleared.", ephemeral=True)
    else:
        await interaction.response.send_message("You were not AFK.", ephemeral=True)

bot.tree.command(name="life", description="Live a new life in Text-based game!")(life_command)

setup_purge(bot, is_admin, ROLE_NAME, DB_PATH)
setup_level(bot, is_admin, LEVEL_DB_PATH)

@bot.tree.command(name="log", description="Get the bot console log")
async def log_command(interaction: discord.Interaction):
    if interaction.user.id != 260185360246505473:
        await interaction.response.send_message("No permission.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    if not os.path.exists(LOG_FILE):
        await interaction.followup.send("No log file found.", ephemeral=True)
        return
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        f.seek(0, 2)
        size = f.tell()
        if size > 1900:
            f.seek(size - 1900)
        else:
            f.seek(0)
        content = f.read()
    await interaction.followup.send(f"```\n{content}\n```", ephemeral=True)

@bot.event
async def on_ready():
    setup_db()
    bot.loop.create_task(reminder_loop())
    from purge import autopurge_loop
    bot.loop.create_task(autopurge_loop(bot, DB_PATH))
    from level import schedule_shop_reset
    bot.loop.create_task(schedule_shop_reset(bot))
    bot.loop.create_task(cache_purge_loop())
    from level import private_room_loop
    bot.loop.create_task(private_room_loop())
    print(f"Logged in as {bot.user}")

import os
from dotenv import load_dotenv
load_dotenv()
bot.run(os.getenv("DISCORD_TOKEN"))