import json
import random
import time
import asyncio
import discord
from discord.ui import View, Button
from life_data import (
    get_coins, add_coins, remove_coins,
    add_item, get_inventory, get_upgrades, set_upgrade,
    remove_items_by_name
)

with open("/home/container/data/game_data.json", "r", encoding="utf-8") as f:
    DATA = json.load(f)

ADVENTURE_MAPS = DATA["ADVENTURE_MAPS"]
ADVENTURE_ENEMIES = DATA["ADVENTURE_ENEMIES"]
ADVENTURE_EQUIPMENT_SLOTS = DATA["ADVENTURE_EQUIPMENT_SLOTS"]
ADVENTURE_DROPPABLE_ITEMS = DATA["ADVENTURE_DROPPABLE_ITEMS"]

EQUIP_SLOTS = ["Weapon", "Armor", "Off-hand", "Buff", "Pet"]

active_adventure_sessions = {}

INN_CHANCE = 0.25
INN_COST = 1000


def get_today_map():
    today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7 * 3600))
    index = hash(today) % len(ADVENTURE_MAPS)
    return ADVENTURE_MAPS[index]


def get_random_enemy():
    enemy_names = list(ADVENTURE_ENEMIES.keys())
    return random.choice(enemy_names)


def get_equipped_items(user_id):
    upgrades = get_upgrades(user_id)
    equipped = {}
    for slot in EQUIP_SLOTS:
        if slot == "Off-hand":
            db_key = "equip_offhand"
        else:
            db_key = f"equip_{slot.lower()}"
        equipped[slot] = upgrades.get(db_key, None)
    return equipped


def set_equipped_item(user_id, slot, item_name):
    if slot == "Off-hand":
        db_key = "equip_offhand"
    else:
        db_key = f"equip_{slot.lower()}"
    set_upgrade(user_id, db_key, item_name)


def has_kings_ring(user_id):
    equipped = get_equipped_items(user_id)
    return equipped.get("Buff") == "King's Ring"


async def start_adventure_session(interaction):
    user_id = interaction.user.id
    if user_id in active_adventure_sessions:
        old_channel_id, old_msg_id = active_adventure_sessions[user_id]
        channel = interaction.client.get_channel(old_channel_id)
        if channel:
            try:
                old_msg = await channel.fetch_message(old_msg_id)
                await old_msg.delete()
            except (discord.NotFound, discord.Forbidden):
                pass
        del active_adventure_sessions[user_id]
    view = AdventureView(user_id)
    msg = await interaction.followup.send(view.msg, view=view)
    active_adventure_sessions[user_id] = (interaction.channel_id, msg.id)


class AdventureView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id
        upgrades = get_upgrades(user_id)
        self.health = upgrades["health"]
        self.mana = upgrades["mana"]
        self.map_name = get_today_map()
        enemy_name = get_random_enemy()
        enemy_data = ADVENTURE_ENEMIES[enemy_name]
        self.enemy_name = enemy_name
        loot = enemy_data["loot"]
        self.msg = (
            "# Adventure\n"
            "Ready to explore the new world? Don't forget to equip your best Gears!\n"
            f"* Today's map is {self.map_name}\n"
            f"* Health: {self.health}\n"
            f"* Mana: {self.mana}\n"
            "# Possible Loots →\n" +
            "\n".join(f"* {item}" for item in loot) +
            "\n\n# Warning →\n"
            "* You can only choose one items per-gears and cannot be changed if you already start Exploring, you must go back in here to change your Equipments\n"
            "* !! Some items may dropped if you lose !!"
        )

    @discord.ui.button(label="Explore", style=discord.ButtonStyle.primary, emoji="⚔️")
    async def explore_button(self, interaction: discord.Interaction, button: Button):
        equipped = get_equipped_items(self.user_id)
        weapon = equipped.get("Weapon")
        armor = equipped.get("Armor")
        offhand = equipped.get("Off-hand")
        buff = equipped.get("Buff")
        pet = equipped.get("Pet")
        view = ExploreView(self.user_id, self.enemy_name, self.map_name, weapon, armor, offhand, buff, pet, self)
        await interaction.response.edit_message(content=view.build_explore_message(), view=view)

    @discord.ui.button(label="Gear", style=discord.ButtonStyle.secondary, emoji="🛡️")
    async def gear_button(self, interaction: discord.Interaction, button: Button):
        view = GearView(self.user_id, self)
        equipped = get_equipped_items(self.user_id)
        msg_lines = [
            "# Gear",
            "* Let's Gear up and explore the world!",
            "# Equipments"
        ]
        for slot in EQUIP_SLOTS:
            item = equipped.get(slot, "None")
            msg_lines.append(f"* {slot}: {item}")
        await interaction.response.edit_message(content="\n".join(msg_lines), view=view)


class ExploreView(View):
    def __init__(self, user_id, enemy_name, map_name, weapon, armor, offhand, buff, pet, parent_view):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.enemy_name = enemy_name
        self.map_name = map_name
        self.weapon = weapon
        self.armor = armor
        self.offhand = offhand
        self.buff = buff
        self.pet = pet
        self.parent_view = parent_view
        self.enemy_data = ADVENTURE_ENEMIES[enemy_name]
        self.enemy_health = self.enemy_data["health"]
        self.enemies_beaten = 0

    def build_explore_message(self):
        upgrades = get_upgrades(self.user_id)
        health = upgrades["health"]
        mana = upgrades["mana"]
        gear_warning = "" if self.weapon or self.armor or self.offhand else " without a Gear!"
        return (
            f"# Explore\n"
            f"You faced with a {self.enemy_name}{gear_warning}\n"
            f"* Enemy Health: {self.enemy_health}\n"
            f"* Loot: {', '.join(self.enemy_data['loot'])}\n"
            f"* Your Health: {health}\n"
            f"* Your Mana: {mana}"
        )

    @discord.ui.button(label="Fight", style=discord.ButtonStyle.success, emoji="⚔️")
    async def fight_button(self, interaction: discord.Interaction, button: Button):
        view = BattleView(self.user_id, self.enemy_name, self.weapon, self.armor, self.offhand, self.buff, self.pet, self.parent_view, self.enemies_beaten, self)
        await interaction.response.edit_message(content=view.build_battle_message(), view=view)

    @discord.ui.button(label="Run", style=discord.ButtonStyle.danger, emoji="🏃")
    async def run_button(self, interaction: discord.Interaction, button: Button):
        if random.random() < 0.6:
            await self.maybe_inn(interaction, fled=True)
        else:
            await self.resolve_lose(interaction)

    async def resolve_lose(self, interaction):
        dropped = []
        inv = get_inventory(self.user_id)
        droppable = [item for item in inv if item in ADVENTURE_DROPPABLE_ITEMS]
        if droppable:
            item_to_drop = random.choice(droppable)
            count = random.randint(1, min(3, inv.count(item_to_drop)))
            remove_items_by_name(self.user_id, item_to_drop, count)
            dropped.append(f"{item_to_drop} x{count}")
        weapon = self.weapon
        armor = self.armor
        if weapon and random.random() < 0.3:
            set_equipped_item(self.user_id, "Weapon", None)
            dropped.append(f"{weapon} x1")
        if armor and random.random() < 0.3:
            set_equipped_item(self.user_id, "Armor", None)
            dropped.append(f"{armor} x1")
        if not dropped:
            dropped.append("Nothing")
        msg = (
            f"# Lose\n"
            f"You're lose against {self.enemy_name} and you dropped:\n" +
            "\n".join(f"* {d}" for d in dropped)
        )
        view = WinLoseContinueView(self.user_id, self.parent_view, "lose")
        await interaction.response.edit_message(content=msg, view=view)

    async def maybe_inn(self, interaction, fled=False):
        if random.random() < INN_CHANCE:
            view = InnView(self.user_id, self)
            cost_text = "1000 coins" if not has_kings_ring(self.user_id) else "free (King's Ring)"
            msg = (
                "# Village Inn\n"
                f"You found Inn, want to get rest? They asked for {cost_text} for a night, your health and mana will be restore for 10% HP and 5% MP"
            )
            await interaction.response.edit_message(content=msg, view=view)
        else:
            await self.continue_exploring(interaction)

    async def continue_exploring(self, interaction):
        next_enemy = get_random_enemy()
        self.enemy_name = next_enemy
        self.enemy_data = ADVENTURE_ENEMIES[next_enemy]
        self.enemy_health = self.enemy_data["health"]
        view = ExploreContinueView(self.user_id, self, self.enemies_beaten)
        await interaction.response.edit_message(content=view.build_message(), view=view)


class InnView(View):
    def __init__(self, user_id, explore_view):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.explore_view = explore_view

    @discord.ui.button(label="Yes", style=discord.ButtonStyle.success, emoji="✅")
    async def yes_button(self, interaction: discord.Interaction, button: Button):
        free = has_kings_ring(self.user_id)
        if not free:
            coins = get_coins(self.user_id)
            if coins < INN_COST:
                await interaction.response.send_message("You don't have enough coins.", ephemeral=True)
                return
            remove_coins(self.user_id, INN_COST)
        upgrades = get_upgrades(self.user_id)
        health_restore = int(0.1 * 5000)
        mana_restore = int(0.05 * 500)
        new_health = upgrades["health"] + health_restore
        new_mana = upgrades["mana"] + mana_restore
        if new_health > 5000:
            new_health = 5000
        if new_mana > 500:
            new_mana = 500
        set_upgrade(self.user_id, "health", new_health)
        set_upgrade(self.user_id, "mana", new_mana)
        if free:
            msg = "# Inn Payment\nThe Inn owner let you get rest freely cause you have King's Ring"
        else:
            msg = "# Inn Payment\nYou've been paid the Inn for 1000 coins"
        view = InnRestView(self.user_id, self.explore_view)
        await interaction.response.edit_message(content=msg, view=view)

    @discord.ui.button(label="No", style=discord.ButtonStyle.danger, emoji="❌")
    async def no_button(self, interaction: discord.Interaction, button: Button):
        await self.explore_view.continue_exploring(interaction)

class InnRestView(View):
    def __init__(self, user_id, explore_view):
        super().__init__(timeout=60)
        self.user_id = user_id
        self.explore_view = explore_view

    @discord.ui.button(label="Continue", style=discord.ButtonStyle.primary, emoji="▶️")
    async def continue_button(self, interaction: discord.Interaction, button: Button):
        await self.explore_view.continue_exploring(interaction)

class BattleView(View):
    def __init__(self, user_id, enemy_name, weapon, armor, offhand, buff, pet, parent_view, enemies_beaten, explore_view):
        super().__init__(timeout=300)
        self.user_id = user_id
        self.enemy_name = enemy_name
        self.weapon = weapon
        self.armor = armor
        self.offhand = offhand
        self.buff = buff
        self.pet = pet
        self.parent_view = parent_view
        self.enemies_beaten = enemies_beaten
        self.explore_view = explore_view
        self.enemy_data = ADVENTURE_ENEMIES[enemy_name]
        self.enemy_health = self.enemy_data["health"]
        upgrades = get_upgrades(user_id)
        self.player_health = upgrades["health"]
        self.player_mana = upgrades["mana"]
        if self.buff == "Rainbow Tears":
            self.player_health = min(self.player_health, 7500)
            self.max_health = 7500
        else:
            self.max_health = 5000
        self.turn = "player"
        self.pet_cooldown = 0
        self.buff_turn_counter = 0
        if self.pet == "Unicorn":
            self.pet_cooldown_max = 3
            self.pet_button.label = "🦄 Heal"
            self.pet_button.emoji = "🦄"
        elif self.pet == "Armed Minions":
            self.pet_cooldown_max = 5
            self.pet_button.label = "👾 Pet Attack"
            self.pet_button.emoji = "👾"
        elif self.pet == "🐋 Blue Whale":
            self.pet_cooldown_max = 15
            self.pet_button.label = "🐋 Restore"
            self.pet_button.emoji = "🐋"
        elif self.pet in ["🐍 Deep Water Snake", "🐉 Sea Dragon"]:
            self.pet_button.label = "Passive"
            self.pet_button.disabled = True
            self.pet_cooldown_max = None
        else:
            self.pet_button.label = "No Pet"
            self.pet_button.disabled = True
            self.pet_cooldown_max = None

    def build_battle_message(self):
        return (
            f"# Battle\n"
            f"Against {self.enemy_name}\n"
            f"* Health: {self.enemy_health}\n\n"
            f"# You →\n"
            f"* Health: {self.player_health}\n"
            f"* Mana: {self.player_mana}\n"
        )

    def player_attack(self):
        base_damage = random.randint(15, 30)
        if self.weapon:
            base_damage += random.randint(8, 15)
        if self.pet == "🐉 Sea Dragon":
            base_damage *= 3
        self.enemy_health -= base_damage
        if self.pet == "🐍 Deep Water Snake" and random.random() < 0.02:
            self.enemy_health = 0

    def player_skill(self):
        if self.player_mana < 30:
            return False
        self.player_mana -= 30
        set_upgrade(self.user_id, "mana", self.player_mana)
        skill_damage = random.randint(30, 55)
        if self.weapon:
            skill_damage += random.randint(12, 20)
        if self.pet == "🐉 Sea Dragon":
            skill_damage *= 3
        self.enemy_health -= skill_damage
        if self.pet == "🐍 Deep Water Snake" and random.random() < 0.02:
            self.enemy_health = 0
        return True

    def apply_buff_effect(self):
        if self.buff == "Rainbow Tears":
            heal_amount = int(0.05 * self.max_health)
            self.player_health = min(self.max_health, self.player_health + heal_amount)
        elif self.buff == "Blue Pearl":
            self.player_mana += int(0.05 * 500)
            if self.player_mana > 500:
                self.player_mana = 500
            set_upgrade(self.user_id, "mana", self.player_mana)

    def enemy_turn(self):
        damage = random.randint(10, 25)
        if self.offhand == "Massive Shield":
            damage = int(damage * 0.5)
        if self.armor:
            damage = int(damage * 0.9)
        if self.buff == "Blue Pearl":
            damage = int(damage * 0.8)
        self.player_health -= damage

    async def check_end(self, interaction):
        if self.player_health <= 0:
            set_upgrade(self.user_id, "health", 0)
            await self.resolve_lose(interaction)
            return True
        if self.enemy_health <= 0:
            self.enemies_beaten += 1
            set_upgrade(self.user_id, "health", self.player_health)
            set_upgrade(self.user_id, "mana", self.player_mana)
            await self.resolve_win(interaction)
            return True
        return False

    async def resolve_win(self, interaction):
        loot = self.enemy_data["loot"]
        collected = []
        for item in loot:
            if item == "💰 Coinsbag":
                coins = random.randint(self.enemy_data["coins_min"], self.enemy_data["coins_max"])
                add_coins(self.user_id, coins)
                collected.append(f"💰 Coins ({coins} coins)")
            else:
                count = random.randint(1, 3)
                for _ in range(count):
                    add_item(self.user_id, item)
                collected.append(f"{item} x{count}")
        milestone_msg = ""
        if self.enemies_beaten >= 10:
            add_coins(self.user_id, 10000)
            upgrades = get_upgrades(self.user_id)
            set_upgrade(self.user_id, "emblems", upgrades["emblems"] + 50)
            milestone_msg = "\n**Milestone reached! Received 50 Emblems and 10000 coins.**\n"
            self.enemies_beaten = 0
        msg = (
            f"# Win\n"
            f"You're win against {self.enemy_name} and you collects:\n" +
            "\n".join(f"* {c}" for c in collected) +
            milestone_msg
        )
        self.explore_view.enemies_beaten = self.enemies_beaten
        view = WinContinueView(self.user_id, self.explore_view, self.parent_view)
        await interaction.response.edit_message(content=msg, view=view)

    async def resolve_lose(self, interaction):
        dropped = []
        inv = get_inventory(self.user_id)
        droppable = [item for item in inv if item in ADVENTURE_DROPPABLE_ITEMS]
        if droppable:
            item_to_drop = random.choice(droppable)
            count = random.randint(1, min(3, inv.count(item_to_drop)))
            remove_items_by_name(self.user_id, item_to_drop, count)
            dropped.append(f"{item_to_drop} x{count}")
        weapon = self.weapon
        armor = self.armor
        if weapon and random.random() < 0.3:
            set_equipped_item(self.user_id, "Weapon", None)
            dropped.append(f"{weapon} x1")
        if armor and random.random() < 0.3:
            set_equipped_item(self.user_id, "Armor", None)
            dropped.append(f"{armor} x1")
        if not dropped:
            dropped.append("Nothing")
        msg = (
            f"# Lose\n"
            f"You're lose against {self.enemy_name} and you dropped:\n" +
            "\n".join(f"* {d}" for d in dropped)
        )
        view = WinLoseContinueView(self.user_id, self.parent_view, "lose")
        await interaction.response.edit_message(content=msg, view=view)

    async def pet_heal_callback(self, interaction: discord.Interaction):
        self.pet_action()
        if await self.check_end(interaction):
            return
        self.enemy_turn()
        if await self.check_end(interaction):
            return
        self.pet_cooldown = 0
        set_upgrade(self.user_id, "health", self.player_health)
        self.update_pet_button()
        await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    async def pet_attack_callback(self, interaction: discord.Interaction):
        self.pet_action()
        if await self.check_end(interaction):
            return
        self.enemy_turn()
        if await self.check_end(interaction):
            return
        self.pet_cooldown = 0
        set_upgrade(self.user_id, "health", self.player_health)
        self.update_pet_button()
        await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    async def pet_restore_callback(self, interaction: discord.Interaction):
        self.player_health = 5000
        self.player_mana = 500
        set_upgrade(self.user_id, "mana", 500)
        if await self.check_end(interaction):
            return
        self.enemy_turn()
        if await self.check_end(interaction):
            return
        self.pet_cooldown = 0
        set_upgrade(self.user_id, "health", self.player_health)
        self.update_pet_button()
        await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    def update_pet_button(self):
        if self.pet == "Unicorn":
            remaining = max(0, self.pet_cooldown_max - self.pet_cooldown)
            self.pet_button.label = f"🦄 Heal ({remaining})" if remaining > 0 else "🦄 Heal"
            self.pet_button.disabled = (remaining > 0)
        elif self.pet == "Armed Minions":
            remaining = max(0, self.pet_cooldown_max - self.pet_cooldown)
            self.pet_button.label = f"👾 Pet Attack ({remaining})" if remaining > 0 else "👾 Pet Attack"
            self.pet_button.disabled = (remaining > 0)
        elif self.pet == "🐋 Blue Whale":
            remaining = max(0, self.pet_cooldown_max - self.pet_cooldown)
            self.pet_button.label = f"🐋 Restore ({remaining})" if remaining > 0 else "🐋 Restore"
            self.pet_button.disabled = (remaining > 0)
        elif self.pet in ["🐍 Deep Water Snake", "🐉 Sea Dragon"]:
            self.pet_button.label = "Passive"
            self.pet_button.disabled = True
        else:
            self.pet_button.label = "No Pet"
            self.pet_button.disabled = True

    def tick_turn_and_buff(self):
        self.pet_cooldown += 1
        self.buff_turn_counter += 1
        if self.buff_turn_counter >= 15:
            self.apply_buff_effect()
            self.buff_turn_counter = 0

    @discord.ui.button(label="Attack", style=discord.ButtonStyle.success, emoji="⚔️", row=0)
    async def attack_button(self, interaction: discord.Interaction, button: Button):
        self.player_attack()
        if await self.check_end(interaction):
            return
        self.enemy_turn()
        if await self.check_end(interaction):
            return
        self.tick_turn_and_buff()
        set_upgrade(self.user_id, "health", self.player_health)
        self.update_pet_button()
        await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    @discord.ui.button(label="Skill", style=discord.ButtonStyle.primary, emoji="⚡", row=0)
    async def skill_button(self, interaction: discord.Interaction, button: Button):
        if not self.player_skill():
            await interaction.response.send_message("Not enough mana.", ephemeral=True)
            return
        if await self.check_end(interaction):
            return
        self.enemy_turn()
        if await self.check_end(interaction):
            return
        self.tick_turn_and_buff()
        set_upgrade(self.user_id, "health", self.player_health)
        self.update_pet_button()
        await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    @discord.ui.button(label="No Pet", style=discord.ButtonStyle.secondary, emoji="🐾", row=1)
    async def pet_button(self, interaction: discord.Interaction, button: Button):
        if self.pet == "Unicorn":
            self.player_health += int(0.2 * 5000)
            if await self.check_end(interaction):
                return
            self.enemy_turn()
            if await self.check_end(interaction):
                return
            self.pet_cooldown = 0
            set_upgrade(self.user_id, "health", self.player_health)
            self.update_pet_button()
            await interaction.response.edit_message(content=self.build_battle_message(), view=self)
        elif self.pet == "Armed Minions":
            self.enemy_health -= 570
            if await self.check_end(interaction):
                return
            self.enemy_turn()
            if await self.check_end(interaction):
                return
            self.pet_cooldown = 0
            set_upgrade(self.user_id, "health", self.player_health)
            self.update_pet_button()
            await interaction.response.edit_message(content=self.build_battle_message(), view=self)
        elif self.pet == "🐋 Blue Whale":
            self.player_health = 5000
            self.player_mana = 500
            set_upgrade(self.user_id, "mana", 500)
            if await self.check_end(interaction):
                return
            self.enemy_turn()
            if await self.check_end(interaction):
                return
            self.pet_cooldown = 0
            set_upgrade(self.user_id, "health", self.player_health)
            self.update_pet_button()
            await interaction.response.edit_message(content=self.build_battle_message(), view=self)

    @discord.ui.button(label="Flee", style=discord.ButtonStyle.danger, emoji="🏃", row=1)
    async def flee_button(self, interaction: discord.Interaction, button: Button):
        tier = self.enemy_data.get("tier", 1)
        flee_chance = max(0.2, 1.0 - tier * 0.15)
        if random.random() < flee_chance:
            await interaction.response.edit_message(
                content="# Flee\nYou successfully fled back to the Adventure menu.",
                view=self.parent_view
            )
        else:
            self.enemy_turn()
            if await self.check_end(interaction):
                return
            set_upgrade(self.user_id, "health", self.player_health)
            self.update_pet_button()
            await interaction.response.edit_message(content=self.build_battle_message(), view=self)


class ExploreContinueView(View):
    def __init__(self, user_id, explore_view, enemies_beaten):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.explore_view = explore_view
        self.enemies_beaten = enemies_beaten

    def build_message(self):
        return self.explore_view.build_explore_message()

    @discord.ui.button(label="Continue", style=discord.ButtonStyle.primary, emoji="▶️")
    async def continue_button(self, interaction: discord.Interaction, button: Button):
        self.explore_view.enemies_beaten = self.enemies_beaten
        pet = self.explore_view.pet
        buff = self.explore_view.buff
        view = BattleView(self.user_id, self.explore_view.enemy_name, self.explore_view.weapon, self.explore_view.armor, self.explore_view.offhand, buff, pet, self.explore_view.parent_view, self.enemies_beaten, self.explore_view)
        await interaction.response.edit_message(content=view.build_battle_message(), view=view)

    @discord.ui.button(label="Back", style=discord.ButtonStyle.secondary, emoji="↩️", row=1)
    async def back_button(self, interaction: discord.Interaction, button: Button):
        upgrades = get_upgrades(self.user_id)
        self.explore_view.parent_view.health = upgrades["health"]
        self.explore_view.parent_view.mana = upgrades["mana"]
        await interaction.response.edit_message(content=self.explore_view.parent_view.msg, view=self.explore_view.parent_view)


class WinLoseContinueView(View):
    def __init__(self, user_id, parent_view, result_type):
        super().__init__(timeout=60)
        self.user_id = user_id
        self.parent_view = parent_view
        self.result_type = result_type

    @discord.ui.button(label="Continue", style=discord.ButtonStyle.primary, emoji="▶️")
    async def continue_button(self, interaction: discord.Interaction, button: Button):
        self.parent_view.map_name = get_today_map()
        enemy_name = get_random_enemy()
        self.parent_view.enemy_name = enemy_name
        upgrades = get_upgrades(self.user_id)
        self.parent_view.health = upgrades["health"]
        self.parent_view.mana = upgrades["mana"]
        self.parent_view.msg = (
            "# Adventure\n"
            "Ready to explore the new world? Don't forget to equip your best Gears!\n"
            f"* Today's map is {self.parent_view.map_name}\n"
            f"* Health: {self.parent_view.health}\n"
            f"* Mana: {self.parent_view.mana}\n"
            "# Possible Loots →\n" +
            "\n".join(f"* {item}" for item in ADVENTURE_ENEMIES[enemy_name]["loot"]) +
            "\n\n# Warning →\n"
            "* You can only choose one items per-gears and cannot be changed if you already start Exploring, you must go back in here to change your Equipments\n"
            "* !! Some items may dropped if you lose !!"
        )
        await interaction.response.edit_message(content=self.parent_view.msg, view=self.parent_view)

    @discord.ui.button(label="Back", style=discord.ButtonStyle.secondary, emoji="↩️", row=1)
    async def back_button(self, interaction: discord.Interaction, button: Button):
        upgrades = get_upgrades(self.user_id)
        self.parent_view.health = upgrades["health"]
        self.parent_view.mana = upgrades["mana"]
        await interaction.response.edit_message(content=self.parent_view.msg, view=self.parent_view)

class WinContinueView(View):
    def __init__(self, user_id, explore_view, parent_view):
        super().__init__(timeout=60)
        self.user_id = user_id
        self.explore_view = explore_view
        self.parent_view = parent_view

    @discord.ui.button(label="Continue", style=discord.ButtonStyle.primary, emoji="▶️")
    async def continue_button(self, interaction: discord.Interaction, button: Button):
        await self.explore_view.maybe_inn(interaction)

    @discord.ui.button(label="Back", style=discord.ButtonStyle.secondary, emoji="↩️")
    async def back_button(self, interaction: discord.Interaction, button: Button):
        upgrades = get_upgrades(self.user_id)
        self.parent_view.health = upgrades["health"]
        self.parent_view.mana = upgrades["mana"]
        await interaction.response.edit_message(content=self.parent_view.msg, view=self.parent_view)

class GearView(View):
    def __init__(self, user_id, parent_view):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.parent_view = parent_view
        equipped = get_equipped_items(user_id)
        for slot in EQUIP_SLOTS:
            label = f"{slot} ({equipped.get(slot, 'None')})"
            btn = Button(label=label, style=discord.ButtonStyle.secondary)
            btn.callback = self.make_slot_callback(slot)
            self.add_item(btn)

    def make_slot_callback(self, slot):
        async def callback(interaction: discord.Interaction):
            view = EquipSelectView(self.user_id, slot, self, self.parent_view)
            inv = get_inventory(self.user_id)
            allowed = ADVENTURE_EQUIPMENT_SLOTS.get(slot, [])
            available = [item for item in inv if item in allowed]
            if not available:
                await interaction.response.send_message("No items available for this slot.", ephemeral=True)
                return
            msg_lines = ["# Items"]
            for item in set(available):
                count = available.count(item)
                msg_lines.append(f"* {item} ({count})")
            await interaction.response.edit_message(content="\n".join(msg_lines), view=view)
        return callback


class EquipSelectView(View):
    def __init__(self, user_id, slot, gear_view, parent_view):
        super().__init__(timeout=60)
        self.user_id = user_id
        self.slot = slot
        self.gear_view = gear_view
        self.parent_view = parent_view
        allowed = ADVENTURE_EQUIPMENT_SLOTS.get(slot, [])
        inv = get_inventory(user_id)
        available = list(set(item for item in inv if item in allowed))
        for item in available:
            btn = Button(label=item, style=discord.ButtonStyle.primary)
            btn.callback = self.make_select_callback(item)
            self.add_item(btn)

    def make_select_callback(self, item):
        async def callback(interaction: discord.Interaction):
            set_equipped_item(self.user_id, self.slot, item)
            equipped = get_equipped_items(self.user_id)
            msg_lines = [
                "# Gear",
                "* Let's Gear up and explore the world!",
                "# Equipments"
            ]
            for s in EQUIP_SLOTS:
                eq = equipped.get(s, "None")
                msg_lines.append(f"* {s}: {eq}")
            await interaction.response.edit_message(content="\n".join(msg_lines), view=self.gear_view)
        return callback


async def adventure_command(interaction: discord.Interaction):
    user_id = interaction.user.id
    view = AdventureView(user_id)
    await interaction.response.send_message(view.msg, view=view)