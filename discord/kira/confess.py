import discord

async def post_confession(channel, title, text):
    if isinstance(channel, discord.ForumChannel):
        await channel.create_thread(
            name=title,
            content=text
        )
    else:
        await channel.send(
            f"# {title}\n{text}"
        )