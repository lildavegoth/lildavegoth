import discord
from discord.ui import View, Button
from discord import app_commands
import sqlite3
import random
import time
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from life_data import add_item, add_coins, get_upgrades, set_upgrade

USERS_LEVEL_DB = "/home/container/data/users_level.db"
active_level_sessions = {}
LEVEL_UP_CHANNEL = 1502743425785794821
BUMP_CHANNEL = 1501525515947999282
PRIVATE_ROOM_CATEGORY = 1497785668615671939
FORUM_XP_CHANNELS = [1497808451966075072, 1497786098947199161, 1502146374450548928]
_bot = None

SHOP_ITEMS_POOL = [
    {"name": "Blue Whale", "price": 2600, "type": "life_pet", "life_item": "🐋 Blue Whale"},
    {"name": "Sea Dragon", "price": 7000, "type": "life_pet", "life_item": "🐉 Sea Dragon"},
    {"name": "Green Thumb", "price": 1500, "type": "life_upgrade", "upgrade_key": "green_thumb"},
    {"name": "Lucky Pickaxe", "price": 1500, "type": "life_upgrade", "upgrade_key": "lucky_pickaxe"},
    {"name": "Bonus Emblems", "price": 12000, "type": "life_emblems", "amount": 30},
    {"name": "Unlimited Watering Can", "price": 9000, "type": "life_item", "life_item": "🪣 Unlimited Watering Can"},
    {"name": "5000 Coins", "price": 2500, "type": "life_coins", "amount": 5000},
    {"name": "Special Role", "price": 5000, "type": "role_rental", "role_name": "Special"}
]

ITEM_DESCRIPTIONS = {
    "Blue Whale": "A legendary pet for Life game (Fishing).",
    "Sea Dragon": "A powerful pet for Life game (Fishing).",
    "Green Thumb": "Crops grow 20% faster (permanent upgrade).",
    "Lucky Pickaxe": "15% chance to find double ores when mining.",
    "Bonus Emblems": "Gives 30 King's Emblems instantly.",
    "Unlimited Watering Can": "Water your crops unlimited times.",
    "5000 Coins": "Adds 5000 coins to your Life game balance.",
    "Special Role": "Rent the Special role for 24 hours (5000xp). Renew for 2500xp.",
    "Private Room": "Create a private channel just for you (lasts 24h). Renewal extends by 1 day for 2500xp."
}

def get_db_connection():
    conn = sqlite3.connect(USERS_LEVEL_DB)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_level_db():
    os.makedirs("/home/container/data", exist_ok=True)
    with get_db_connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1)")
        conn.execute("CREATE TABLE IF NOT EXISTS purchases (user_id TEXT, item_name TEXT, PRIMARY KEY(user_id, item_name))")
        conn.execute("CREATE TABLE IF NOT EXISTS daily_shop (date TEXT PRIMARY KEY, items TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS private_rooms (user_id TEXT PRIMARY KEY, channel_id TEXT, expires_at REAL)")
        conn.execute("CREATE TABLE IF NOT EXISTS role_rentals (user_id TEXT PRIMARY KEY, expires_at REAL)")
        conn.execute("CREATE TABLE IF NOT EXISTS thanks_cooldowns (user_id TEXT PRIMARY KEY, last_date TEXT)")
        conn.commit()

def remove_user_from_level(user_id):
    with get_db_connection() as conn:
        conn.execute("DELETE FROM users WHERE user_id = ?", (str(user_id),))
        conn.commit()

def can_thanks_today(user_id):
    today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
    with get_db_connection() as conn:
        row = conn.execute("SELECT last_date FROM thanks_cooldowns WHERE user_id = ?", (str(user_id),)).fetchone()
        return not (row and row[0] == today)

def use_thanks(user_id):
    today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
    with get_db_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO thanks_cooldowns (user_id, last_date) VALUES (?, ?)", (str(user_id), today))
        conn.commit()

def get_user_data(user_id):
    with get_db_connection() as conn:
        row = conn.execute("SELECT xp, level, username FROM users WHERE user_id = ?", (str(user_id),)).fetchone()
    if row:
        return row[0], row[1], row[2]
    return 0, 1, None

def set_user_data(user_id, xp, level, username=None):
    with get_db_connection() as conn:
        if username:
            conn.execute("INSERT OR REPLACE INTO users (user_id, xp, level, username) VALUES (?, ?, ?, ?)",
                         (str(user_id), xp, level, username))
        else:
            conn.execute("INSERT OR REPLACE INTO users (user_id, xp, level) VALUES (?, ?, ?)",
                         (str(user_id), xp, level))
        conn.commit()

def recalc_level(xp):
    level = 1
    while xp >= 250 * level and level < 60:
        xp -= 250 * level
        level += 1
    if level >= 60:
        xp = 0
    return min(level, 60), xp

def add_xp(user_id, amount, username):
    xp, level, _ = get_user_data(user_id)
    if level >= 60:
        return False, 60
    xp += amount
    new_level, new_xp = recalc_level(xp)
    leveled_up = new_level > level
    set_user_data(user_id, new_xp, new_level, username)
    return leveled_up, new_level

def has_purchased(user_id, item_name):
    with get_db_connection() as conn:
        row = conn.execute("SELECT 1 FROM purchases WHERE user_id = ? AND item_name = ?", (str(user_id), item_name)).fetchone()
    return row is not None

def mark_purchased(user_id, item_name):
    with get_db_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO purchases (user_id, item_name) VALUES (?, ?)", (str(user_id), item_name))
        conn.commit()

def get_daily_shop():
    today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
    with get_db_connection() as conn:
        row = conn.execute("SELECT items FROM daily_shop WHERE date = ?", (today,)).fetchone()
        if row:
            return json.loads(row[0])
        items = random.sample(SHOP_ITEMS_POOL, min(5, len(SHOP_ITEMS_POOL)))
        conn.execute("INSERT OR REPLACE INTO daily_shop (date, items) VALUES (?, ?)", (today, json.dumps(items)))
        conn.commit()
        return items

def get_rankings():
    with get_db_connection() as conn:
        rows = conn.execute("SELECT user_id, username, xp, level FROM users ORDER BY level DESC, xp DESC").fetchall()
    return rows

def get_private_room(user_id):
    with get_db_connection() as conn:
        row = conn.execute("SELECT channel_id, expires_at FROM private_rooms WHERE user_id = ?", (str(user_id),)).fetchone()
    return row

def set_private_room(user_id, channel_id, expires_at):
    with get_db_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO private_rooms (user_id, channel_id, expires_at) VALUES (?, ?, ?)",
                     (str(user_id), str(channel_id), expires_at))
        conn.commit()

def delete_private_room(user_id):
    with get_db_connection() as conn:
        conn.execute("DELETE FROM private_rooms WHERE user_id = ?", (str(user_id),))
        conn.commit()

def get_role_rental(user_id):
    with get_db_connection() as conn:
        row = conn.execute("SELECT expires_at FROM role_rentals WHERE user_id = ?", (str(user_id),)).fetchone()
    return row[0] if row else None

def set_role_rental(user_id, expires_at):
    with get_db_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO role_rentals (user_id, expires_at) VALUES (?, ?)", (str(user_id), expires_at))
        conn.commit()

def delete_role_rental(user_id):
    with get_db_connection() as conn:
        conn.execute("DELETE FROM role_rentals WHERE user_id = ?", (str(user_id),))
        conn.commit()

async def create_private_room(bot, interaction, owner_id):
    guild = interaction.guild
    category = guild.get_channel(PRIVATE_ROOM_CATEGORY)
    if not category:
        return None
    member = guild.get_member(owner_id)
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False),
        member: discord.PermissionOverwrite(view_channel=True, send_messages=True, read_message_history=True)
    }
    channel = await guild.create_text_channel(
        name="私人｜private-room",
        category=category,
        overwrites=overwrites
    )
    expire_time = time.time() + 86400
    set_private_room(owner_id, channel.id, expire_time)
    return channel

async def renew_private_room(owner_id, days=1):
    row = get_private_room(owner_id)
    if not row:
        return
    channel_id, expires_at = row
    new_expires = expires_at + (days * 86400)
    set_private_room(owner_id, channel_id, new_expires)

async def delete_expired_rooms(bot):
    now = time.time()
    with get_db_connection() as conn:
        rows = conn.execute("SELECT user_id, channel_id FROM private_rooms WHERE expires_at <= ?", (now,)).fetchall()
    for user_id, channel_id in rows:
        guild = bot.get_guild(1497778776669683732)
        if guild:
            channel = guild.get_channel(int(channel_id))
            if channel:
                try:
                    await channel.delete()
                except:
                    pass
        delete_private_room(user_id)

async def delete_expired_role_rentals(bot):
    now = time.time()
    with get_db_connection() as conn:
        rows = conn.execute("SELECT user_id FROM role_rentals WHERE expires_at <= ?", (now,)).fetchall()
    for (user_id,) in rows:
        guild = bot.get_guild(1497778776669683732)
        if guild:
            member = guild.get_member(int(user_id))
            if member:
                role = discord.utils.get(guild.roles, name="Special")
                if role:
                    try:
                        await member.remove_roles(role)
                    except:
                        pass
        delete_role_rental(user_id)

async def private_room_loop():
    await _bot.wait_until_ready()
    while not _bot.is_closed():
        await asyncio.sleep(3600)
        await delete_expired_rooms(_bot)
        await delete_expired_role_rentals(_bot)

async def process_xp(message):
    if message.author.bot:
        return

    xp_gain = 15 if len(message.content) > 50 else 11

    if message.attachments:
        for att in message.attachments:
            if att.content_type:
                if att.content_type.startswith("image/"):
                    xp_gain += 20
                elif att.content_type.startswith("video/"):
                    xp_gain += 30

    parent_id = getattr(message.channel, "parent_id", None)
    if parent_id in FORUM_XP_CHANNELS:
        xp_gain += 40

    if message.channel.id == BUMP_CHANNEL and message.content.strip().lower().startswith("/bump"):
        xp_gain += 50

    username = message.author.display_name
    leveled_up, new_level = add_xp(message.author.id, xp_gain, username)

    if leveled_up and _bot:
        channel = _bot.get_channel(LEVEL_UP_CHANNEL)
        if channel:
            target = 250 * new_level
            await channel.send(
                f"# Leveled up!\n{message.author.mention} has been Leveled up to (Level {new_level}) ({target}xp)"
            )

async def on_reaction_xp(reaction, user):
    if user.bot:
        return
    message = reaction.message
    parent_id = getattr(message.channel, "parent_id", None)
    if parent_id in FORUM_XP_CHANNELS:
        add_xp(user.id, 50, user.display_name)

async def on_interaction_xp(interaction: discord.Interaction):
    if interaction.type == discord.InteractionType.application_command and interaction.user.bot is False:
        add_xp(interaction.user.id, 45, interaction.user.display_name)

async def schedule_shop_reset(bot):
    await bot.wait_until_ready()
    while not bot.is_closed():
        now = datetime.now(timezone(timedelta(hours=7)))
        target = now.replace(hour=6, minute=0, second=0, microsecond=0)
        if now >= target:
            target += timedelta(days=1)
        wait = (target - now).total_seconds()
        await asyncio.sleep(wait)

        today_str = target.strftime("%Y-%m-%d")
        items = random.sample(SHOP_ITEMS_POOL, min(5, len(SHOP_ITEMS_POOL)))
        with get_db_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO daily_shop (date, items) VALUES (?, ?)", (today_str, json.dumps(items)))
            conn.commit()

def setup_level(bot, is_admin, DB_PATH):
    global _bot
    _bot = bot
    init_level_db()

    @bot.tree.command(name="thanks", description="Give 450xp to someone once a day")
    @app_commands.describe(user="User to thank")
    async def thanks_command(interaction: discord.Interaction, user: discord.Member):
        giver_id = interaction.user.id
        if not can_thanks_today(giver_id):
            await interaction.response.send_message("You already gave thanks today. Try again tomorrow.", ephemeral=True)
            return
        use_thanks(giver_id)
        _, new_level = add_xp(user.id, 450, user.display_name)
        msg = await interaction.channel.send(f"# Congrats\n{user.mention} has given you 450xp in gratitude")
        await interaction.response.send_message(f"Thanks given to {user.mention}!", ephemeral=True)
        await asyncio.sleep(900)
        try:
            await msg.delete()
        except:
            pass

    class ShopView(View):
        def __init__(self, user_id, items, parent_view):
            super().__init__(timeout=120)
            self.user_id = user_id
            self.parent_view = parent_view
            for item in items:
                btn = Button(label=f"{item['name']} ({item['price']}xp)", style=discord.ButtonStyle.primary)
                btn.callback = self.make_buy_callback(item)
                self.add_item(btn)
            row = get_private_room(user_id)
            if row:
                btn = Button(label="Renew Room (2500xp)", style=discord.ButtonStyle.success)
                btn.callback = self.renew_callback
                self.add_item(btn)
            else:
                btn = Button(label="Private Room (5000xp)", style=discord.ButtonStyle.primary)
                btn.callback = self.buy_room_callback
                self.add_item(btn)
            role_rental = get_role_rental(user_id)
            if role_rental:
                btn = Button(label="Renew Role (2500xp)", style=discord.ButtonStyle.success)
                btn.callback = self.renew_role_callback
                self.add_item(btn)
            back_btn = Button(label="Back", style=discord.ButtonStyle.secondary)
            back_btn.callback = self.back_callback
            self.add_item(back_btn)

        def make_buy_callback(self, item):
            async def callback(interaction: discord.Interaction):
                user_id = str(interaction.user.id)
                if item['type'] == 'role_rental':
                    if get_role_rental(user_id):
                        await interaction.response.send_message("You already have the Special Role active.", ephemeral=True)
                        return
                    xp, level, _ = get_user_data(user_id)
                    if xp < item['price']:
                        await interaction.response.send_message(f"Not enough XP. You need {item['price']}xp, but you have {xp}xp.", ephemeral=True)
                        return
                    new_xp = xp - item['price']
                    new_level, remaining_xp = recalc_level(new_xp)
                    set_user_data(user_id, remaining_xp, new_level)
                    guild = interaction.guild
                    role = discord.utils.get(guild.roles, name=item['role_name'])
                    if role:
                        await interaction.user.add_roles(role)
                        set_role_rental(user_id, time.time() + 86400)
                        await interaction.response.send_message(f"You bought {item['name']} for 24 hours! Use /level shop to renew.", ephemeral=True)
                    else:
                        await interaction.response.send_message(f"Role '{item['role_name']}' not found. Contact admin.", ephemeral=True)
                        set_user_data(user_id, xp, level)
                    if new_level < level:
                        await interaction.followup.send(f"Your level dropped to {new_level} due to XP purchase.", ephemeral=True)
                    return

                if has_purchased(user_id, item['name']):
                    await interaction.response.send_message("You already own this item.", ephemeral=True)
                    return
                xp, level, _ = get_user_data(user_id)
                if xp < item['price']:
                    await interaction.response.send_message(f"Not enough XP. You need {item['price']}xp, but you have {xp}xp.", ephemeral=True)
                    return
                new_xp = xp - item['price']
                new_level, remaining_xp = recalc_level(new_xp)
                set_user_data(user_id, remaining_xp, new_level)
                mark_purchased(user_id, item['name'])
                if item['type'] == 'life_pet':
                    add_item(user_id, item['life_item'])
                    await interaction.response.send_message(f"You bought {item['name']}! Added to your Life inventory.", ephemeral=True)
                elif item['type'] == 'life_item':
                    add_item(user_id, item['life_item'])
                    await interaction.response.send_message(f"You bought {item['name']}! Added to your Life inventory.", ephemeral=True)
                elif item['type'] == 'life_coins':
                    add_coins(user_id, item['amount'])
                    await interaction.response.send_message(f"You bought {item['name']}! {item['amount']} coins added.", ephemeral=True)
                elif item['type'] == 'life_emblems':
                    upgrades = get_upgrades(user_id)
                    current = upgrades.get("emblems", 0)
                    set_upgrade(user_id, "emblems", current + item['amount'])
                    await interaction.response.send_message(f"You bought {item['name']}! {item['amount']} King's Emblems added.", ephemeral=True)
                elif item['type'] == 'life_upgrade':
                    upgrades = get_upgrades(user_id)
                    key = item.get("upgrade_key")
                    if key:
                        set_upgrade(user_id, key, True)
                        await interaction.response.send_message(f"You bought {item['name']}! Upgrade activated.", ephemeral=True)
                    else:
                        await interaction.response.send_message("Invalid upgrade item.", ephemeral=True)
                if new_level < level:
                    await interaction.followup.send(f"Your level dropped to {new_level} due to XP purchase.", ephemeral=True)
            return callback

        async def buy_room_callback(self, interaction: discord.Interaction):
            user_id = str(interaction.user.id)
            xp, level, _ = get_user_data(user_id)
            if get_private_room(user_id):
                await interaction.response.send_message("You already have a Private Room.", ephemeral=True)
                return
            if xp < 5000:
                await interaction.response.send_message("Not enough XP. You need 5000xp.", ephemeral=True)
                return
            new_xp = xp - 5000
            new_level, remaining_xp = recalc_level(new_xp)
            set_user_data(user_id, remaining_xp, new_level)
            channel = await create_private_room(_bot, interaction, int(user_id))
            if channel:
                await interaction.response.send_message(f"Your Private Room {channel.mention} has been created! It will expire in 24 hours.", ephemeral=True)
                if new_level < level:
                    await interaction.followup.send(f"Your level dropped to {new_level} due to XP purchase.", ephemeral=True)
            else:
                set_user_data(user_id, xp, level)
                await interaction.response.send_message("Failed to create Private Room. XP refunded.", ephemeral=True)

        async def renew_callback(self, interaction: discord.Interaction):
            user_id = str(interaction.user.id)
            row = get_private_room(user_id)
            if not row:
                await interaction.response.send_message("You don't have a Private Room.", ephemeral=True)
                return
            xp, level, _ = get_user_data(user_id)
            if xp < 2500:
                await interaction.response.send_message("Not enough XP. You need 2500xp.", ephemeral=True)
                return
            new_xp = xp - 2500
            new_level, remaining_xp = recalc_level(new_xp)
            set_user_data(user_id, remaining_xp, new_level)
            await renew_private_room(user_id, 1)
            expires = row[1] + 86400
            hours_left = int((expires - time.time()) / 3600)
            await interaction.response.send_message(f"Room renewal successful! Expiration extended by 24 hours. (~{hours_left}h left)", ephemeral=True)
            if new_level < level:
                await interaction.followup.send(f"Your level dropped to {new_level} due to XP purchase.", ephemeral=True)

        async def renew_role_callback(self, interaction: discord.Interaction):
            user_id = str(interaction.user.id)
            rental = get_role_rental(user_id)
            if not rental:
                await interaction.response.send_message("You don't have the Special Role active.", ephemeral=True)
                return
            xp, level, _ = get_user_data(user_id)
            if xp < 2500:
                await interaction.response.send_message("Not enough XP. You need 2500xp.", ephemeral=True)
                return
            new_xp = xp - 2500
            new_level, remaining_xp = recalc_level(new_xp)
            set_user_data(user_id, remaining_xp, new_level)
            new_expire = max(time.time(), rental) + 86400
            set_role_rental(user_id, new_expire)
            hours_left = int((new_expire - time.time()) / 3600)
            await interaction.response.send_message(f"Special Role renewed! Expiration extended to ~{hours_left}h from now.", ephemeral=True)
            if new_level < level:
                await interaction.followup.send(f"Your level dropped to {new_level} due to XP purchase.", ephemeral=True)

        async def back_callback(self, interaction: discord.Interaction):
            await interaction.response.edit_message(content=self.parent_view.build_content(), view=self.parent_view)

    class LevelView(View):
        def __init__(self, user_id, xp, level, rankings, page=0):
            super().__init__(timeout=120)
            self.user_id = user_id
            self.xp = xp
            self.level = level
            self.rankings = rankings
            self.page = page
            self.per_page = 5
            self.update_buttons()

        def get_page_rankings(self):
            start = self.page * self.per_page
            end = start + self.per_page
            return self.rankings[start:end]

        def update_buttons(self):
            self.clear_items()
            shop_btn = Button(label="Shop", style=discord.ButtonStyle.primary, emoji="🛒")
            shop_btn.callback = self.shop_callback
            self.add_item(shop_btn)

            if self.page > 0:
                prev_btn = Button(label="Previous", style=discord.ButtonStyle.secondary, emoji="⬅️")
                prev_btn.callback = self.prev_callback
                self.add_item(prev_btn)

            if (self.page + 1) * self.per_page < len(self.rankings):
                next_btn = Button(label="Next", style=discord.ButtonStyle.secondary, emoji="➡️")
                next_btn.callback = self.next_callback
                self.add_item(next_btn)

        async def shop_callback(self, interaction: discord.Interaction):
            items = get_daily_shop()
            view = ShopView(self.user_id, items, self)
            msg_lines = [
                "# Level Shop",
                "Buys everything using your Xp for Life game and more!",
                "",
                "# Items"
            ]
            for item in items:
                msg_lines.append(f"* {item['name']} ({item['price']}xp)")
            private_row = get_private_room(self.user_id)
            if private_row:
                msg_lines.append("* Private Room Renewal (2500xp)")
            else:
                msg_lines.append("* Private Room (5000xp)")
            role_rental = get_role_rental(self.user_id)
            if role_rental:
                msg_lines.append("* Renew Role (2500xp)")
            else:
                msg_lines.append("* Special Role (5000xp)")
            msg_lines.append("")
            msg_lines.append("# Descriptions")
            for item in items:
                desc = ITEM_DESCRIPTIONS.get(item['name'], "")
                if desc:
                    msg_lines.append(f"* {item['name']} is {desc}")
            msg_lines.append("* Private Room is Create a private channel just for you (lasts 24h). Renewal extends by 1 day for 2500xp.")
            msg = "\n".join(msg_lines)
            await interaction.response.edit_message(content=msg, view=view)

        async def prev_callback(self, interaction: discord.Interaction):
            self.page -= 1
            self.update_buttons()
            await interaction.response.edit_message(content=self.build_content(), view=self)

        async def next_callback(self, interaction: discord.Interaction):
            self.page += 1
            self.update_buttons()
            await interaction.response.edit_message(content=self.build_content(), view=self)

        def build_content(self):
            target = 250 * self.level
            lines = [
                f"# Level {self.level}",
                f"**{self.xp}xp — {target}xp**",
                "",
                "# Ranks →"
            ]
            for uid, uname, uxp, ulvl in self.get_page_rankings():
                name = uname or f"<@{uid}>"
                lines.append(f"* {name} (Level {ulvl})")
            return "\n".join(lines)

    @bot.tree.command(name="level", description="Check your level and the server ranks")
    async def level_command(interaction: discord.Interaction):
        user_id = interaction.user.id
        if user_id in active_level_sessions:
            old_channel_id, old_msg_id = active_level_sessions[user_id]
            channel = interaction.client.get_channel(old_channel_id)
            if channel:
                try:
                    old_msg = await channel.fetch_message(old_msg_id)
                    await old_msg.delete()
                except (discord.NotFound, discord.Forbidden):
                    pass
            del active_level_sessions[user_id]
        xp, level, username = get_user_data(user_id)
        if username is None:
            username = interaction.user.display_name
            set_user_data(user_id, xp, level, username)
        rankings = get_rankings()
        view = LevelView(user_id, xp, level, rankings)
        await interaction.response.send_message(view.build_content(), view=view)
        message = await interaction.original_response()
        active_level_sessions[user_id] = (interaction.channel_id, message.id)