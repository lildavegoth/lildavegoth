import discord
from discord import app_commands
import asyncio
import sqlite3
from datetime import datetime, timedelta, timezone

def setup_purge(bot, is_admin, ROLE_NAME, DB_PATH):
    @bot.tree.command(name="purge", description="Delete all messages in this channel")
    async def purge(interaction: discord.Interaction):
        if not is_admin(interaction):
            await interaction.response.send_message("No permission", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        while True:
            deleted = await interaction.channel.purge(limit=100, check=lambda m: not m.pinned)
            if len(deleted) < 100:
                break

        await interaction.followup.send("Channel cleaned", ephemeral=True)

    @bot.tree.command(name="purgeuser", description="Purge messages from a specific user in this channel")
    @app_commands.describe(user="The user whose messages to purge (mention or ID)")
    async def purgeuser(interaction: discord.Interaction, user: discord.User):
        if not is_admin(interaction):
            await interaction.response.send_message("No permission", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        def check(msg):
            return msg.author.id == user.id and not msg.pinned

        count = 0
        while True:
            deleted = await interaction.channel.purge(limit=100, check=check)
            count += len(deleted)
            if len(deleted) < 100:
                break

        await interaction.followup.send(f"Purged {count} messages from {user.mention}.", ephemeral=True)

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

    @bot.tree.command(name="purgealluser", description="Purge ALL messages from a user in EVERY channel")
    @app_commands.describe(user="The user to purge completely (mention or ID)", reason="Reason for purge")
    async def purgealluser(interaction: discord.Interaction, user: discord.User, reason: str = "No reason"):
        if not is_admin(interaction):
            await interaction.response.send_message("No permission", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)

        total_deleted = 0
        for channel in interaction.guild.text_channels:
            perms = channel.permissions_for(interaction.guild.me)
            if not perms.read_message_history or not perms.manage_messages:
                continue
            def check(msg):
                return msg.author.id == user.id and not msg.pinned
            try:
                while True:
                    deleted = await channel.purge(limit=100, check=check)
                    total_deleted += len(deleted)
                    if len(deleted) < 100:
                        break
            except Exception:
                pass

        await interaction.followup.send(f"Purged {total_deleted} messages from {user.mention} across the server. Reason: {reason}", ephemeral=True)

    @bot.tree.command(name="del", description="Delete a message by ID (Pure only)")
    @app_commands.describe(id="Message ID to delete")
    async def del_message(interaction: discord.Interaction, id: str):
        if not is_admin(interaction):
            await interaction.response.send_message("No permission", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        try:
            msg = await interaction.channel.fetch_message(int(id))
            await msg.delete()
            await interaction.followup.send("Message deleted.", ephemeral=True)
        except ValueError:
            await interaction.followup.send("Invalid message ID.", ephemeral=True)
        except discord.NotFound:
            await interaction.followup.send("Message not found.", ephemeral=True)
        except discord.Forbidden:
            await interaction.followup.send("I lack permission to delete that message.", ephemeral=True)

async def autopurge_loop(bot, db_path):
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
            with sqlite3.connect(db_path) as conn:
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
                        deleted = await channel.purge(limit=100, check=lambda m: not m.pinned)
                        if len(deleted) < 100:
                            break
                except:
                    pass

            def _update():
                with sqlite3.connect(db_path) as conn:
                    conn.execute(
                        "INSERT OR REPLACE INTO autopurge (channel_id, last_purge) VALUES (?, ?)",
                        (cid, today_str)
                    )
                    conn.commit()

            await asyncio.to_thread(_update)