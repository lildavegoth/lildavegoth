import discord
from discord.ui import View, Button
import time
import random
from life_data import (
    init_db, get_coins, add_coins, remove_coins,
    add_item, get_inventory, get_inventory_count,
    clear_inventory, get_upgrades, set_upgrade,
    process_miner_machine
)

BASE_COOLDOWN = 3.0
MIN_COOLDOWN = 0.1
MAX_FISHING_LEVEL = 10
ROD_MAX_LEVEL = 5
HELPER_MAX_LEVEL = 3
PICKAXE_MAX_LEVEL = 3
MINE_MAX_LEVEL = 3

UPGRADE_COST_SKILL = 150
ROD_UPGRADE_COSTS = {2: 200, 3: 500, 4: 1000, 5: 3000}
HELPER_UNLOCK_COST = 200
HELPER_UPGRADE_COST = 100
BOAT_UNLOCK_COST = 10000
FORTUNE_CANDY_COST = 500
MINE_UNLOCK_COST = 25000
MINE_UPGRADE_COSTS = {2: 35000, 3: 50000}
PICKAXE_BUY_PRICE = 2000
PICKAXE_UPGRADE_COSTS = {2: 3000, 3: 8000}
MINER_MACHINE_PRICE = 10000
FARM_UNLOCK_COST = 450000
FARMER_HIRE_COST = 250

ROCK_SALE_PRICE = 2
ORE_SALE_PRICE_RANGE = (50, 100)
JEWEL_SALE_PRICE_RANGE = (70, 120)

SEED_TYPES = {
    "🌾 Wheat Seed": {"price": 45, "yield": "🌾 Wheat", "count": 9, "duration": 900, "sell_each": 6},
    "🥕 Carrot Seed": {"price": 63, "yield": "🥕 Carrot", "count": 9, "duration": 1200, "sell_each": 8},
    "🥔 Potato Seed": {"price": 72, "yield": "🥔 Potato", "count": 9, "duration": 2400, "sell_each": 9}
}

FISH_TYPES = {
    "🐟 Common Carp": 2,
    "🐠 Tropical Clownfish": 3,
    "🐡 Pufferfish": 4,
    "🦈 Baby Shark": 50,
    "🐙 Octopus": 25,
    "🦀 Crab": 5,
    "🐚 Shellfish": 3,
    "🦑 Squid": 4,
    "🐍 Deep Water Snake": 100,
    "🐊 Crocodile": 100,
    "🐳 Whale": 350,
    "🐋 Blue Whale": 450,
    "🐉 Sea Dragon": 500,
    "📦 Package": 0
}

ROD_LOCKED_FISH = {
    2: ["🐊 Crocodile"],
    3: ["🦈 Baby Shark", "🐙 Octopus"],
    4: ["🐳 Whale"],
    5: ["🐍 Deep Water Snake", "🐉 Sea Dragon", "🐋 Blue Whale"]
}

FISH_WEIGHTS = {
    "🐟 Common Carp": 100,
    "🐠 Tropical Clownfish": 100,
    "🐡 Pufferfish": 100,
    "🦈 Baby Shark": 20,
    "🐙 Octopus": 30,
    "🦀 Crab": 100,
    "🐚 Shellfish": 100,
    "🦑 Squid": 80,
    "🐍 Deep Water Snake": 3,
    "🐊 Crocodile": 40,
    "🐳 Whale": 10,
    "🐋 Blue Whale": 3,
    "🐉 Sea Dragon": 1,
    "📦 Package": 20
}

life_cooldowns = {}

def get_effective_cooldown(user_id):
    upgrades = get_upgrades(user_id)
    if time.time() < upgrades["fortune_candy"]:
        return 0
    reduction = 0.3 * upgrades["better_fishing"]
    return max(MIN_COOLDOWN, BASE_COOLDOWN - reduction)

def get_catch_range(user_id):
    upgrades = get_upgrades(user_id)
    if upgrades["boat"]:
        return (5, 8)
    if upgrades["helper"] >= 3:
        return (3, 5)
    if upgrades["helper"] == 2:
        return (2, 5)
    if upgrades["helper"] == 1:
        return (1, 4)
    return (1, 3)

def can_catch_fish(fish_name, rod_level, boat_owned):
    if fish_name == "📦 Package":
        return True
    for level, fishes in ROD_LOCKED_FISH.items():
        if fish_name in fishes:
            if level == 3:
                if rod_level < 3 or not boat_owned:
                    return False
            elif rod_level < level:
                return False
    return True

def weighted_choice(available):
    total = sum(FISH_WEIGHTS[f] for f in available)
    r = random.uniform(0, total)
    upto = 0
    for f in available:
        w = FISH_WEIGHTS[f]
        if upto + w >= r:
            return f
        upto += w
    return available[-1]

def build_store_view(user_id):
    upgrades = get_upgrades(user_id)
    view = StoreView(user_id)
    helper_label = "Helper (200 coins)" if upgrades["helper"] == 0 else "Helper (Bought)"
    boat_label = "Boat (10000 coins)" if upgrades["boat"] == 0 else "Boat (Bought)"
    fortune_label = "Fortune Candy (500 coins)"
    mine_label = "Mine (25000 coins)" if upgrades["mine"] == 0 else "Mine (Bought)"
    pickaxe_label = "Pickaxe (2000 coins)" if upgrades["pickaxe"] == 0 else "Pickaxe (Bought)"
    miner_label = "Miner Machine (10000 coins)" if upgrades["miner_machine"] == 0 else "Miner Machine (Bought)"
    farm_label = "Farm (450000 coins)" if upgrades["farm"] == 0 else "Farm (Bought)"
    view.helper_button.label = helper_label
    view.boat_button.label = boat_label
    view.fortune_button.label = fortune_label
    view.mine_button.label = mine_label
    view.pickaxe_button.label = pickaxe_label
    view.miner_machine_button.label = miner_label
    view.farm_button.label = farm_label
    if upgrades["helper"] > 0:
        view.helper_button.disabled = True
    if upgrades["boat"] == 1:
        view.boat_button.disabled = True
    if upgrades["mine"] == 1:
        view.mine_button.disabled = True
    if upgrades["pickaxe"] >= 1:
        view.pickaxe_button.disabled = True
    if upgrades["miner_machine"] == 1:
        view.miner_machine_button.disabled = True
    if upgrades["farm"] == 1:
        view.farm_button.disabled = True
    if upgrades["mine"] == 0:
        view.miner_machine_button.disabled = True
    return view

def build_upgrade_view(user_id):
    upgrades = get_upgrades(user_id)
    view = UpgradeView(user_id)
    if upgrades["better_fishing"] >= MAX_FISHING_LEVEL:
        view.better_fishing_button.disabled = True
        view.better_fishing_button.label = "Better Fishing (Max)"
    if upgrades["rod"] >= ROD_MAX_LEVEL:
        view.rod_button.disabled = True
        view.rod_button.label = "Fishing Rod (Max)"
    if upgrades["helper"] == 0:
        view.helper_button.disabled = True
        view.helper_button.label = "Upgrade Helper (Need Helper)"
    elif upgrades["helper"] >= HELPER_MAX_LEVEL:
        view.helper_button.disabled = True
        view.helper_button.label = "Upgrade Helper (Max)"
    if upgrades["pickaxe"] == 0:
        view.pickaxe_button.disabled = True
        view.pickaxe_button.label = "Pickaxe (Need Pickaxe)"
    elif upgrades["pickaxe"] >= PICKAXE_MAX_LEVEL:
        view.pickaxe_button.disabled = True
        view.pickaxe_button.label = "Pickaxe (Max)"
    else:
        next_lvl = upgrades["pickaxe"] + 1
        cost = PICKAXE_UPGRADE_COSTS.get(next_lvl, 0)
        view.pickaxe_button.label = f"Pickaxe ({cost} coins)"
    if upgrades["mine"] == 0:
        view.mine_button.disabled = True
        view.mine_button.label = "Mine (Need Mine)"
    elif upgrades["mine_level"] >= MINE_MAX_LEVEL:
        view.mine_button.disabled = True
        view.mine_button.label = "Mine (Max)"
    else:
        next_lvl = upgrades["mine_level"] + 1
        cost = MINE_UPGRADE_COSTS.get(next_lvl, 0)
        view.mine_button.label = f"Mine ({cost} coins)"
    return view

def check_achievements(user_id):
    upgrades = get_upgrades(user_id)
    coins = get_coins(user_id)
    if coins >= 100000 and not upgrades["richer_than_ever"]:
        set_upgrade(user_id, "achievement_richer_than_ever", 1)
    inv = get_inventory(user_id)
    legendaries = ["🐍 Deep Water Snake", "🐉 Sea Dragon", "🐋 Blue Whale"]
    if not upgrades["legendary_fisherman"] and any(item in inv for item in legendaries):
        set_upgrade(user_id, "achievement_legendary_fisherman", 1)

class MainLifeView(View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="Fish", style=discord.ButtonStyle.primary, emoji="🎣")
    async def fish_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        now = time.time()
        upgrades = get_upgrades(user_id)
        cooldown = get_effective_cooldown(user_id)
        fortune_active = now < upgrades["fortune_candy"]
        if not fortune_active and user_id in life_cooldowns and now < life_cooldowns[user_id]:
            remaining = life_cooldowns[user_id] - now
            await interaction.response.send_message(
                f"Please wait {remaining:.1f}s before fishing again.", ephemeral=True
            )
            return

        rod_level = upgrades["rod"]
        boat_owned = upgrades["boat"] == 1
        catch_min, catch_max = get_catch_range(user_id)
        num_fish = random.randint(catch_min, catch_max)
        caught = []
        total_worth = 0
        for _ in range(num_fish):
            available = [f for f in FISH_TYPES if can_catch_fish(f, rod_level, boat_owned)]
            selected = weighted_choice(available)
            if selected == "📦 Package":
                coins_earned = random.randint(5, 15)
                add_coins(user_id, coins_earned)
                caught.append("📦 Package")
                total_worth += coins_earned
            else:
                value = FISH_TYPES[selected]
                add_item(user_id, selected)
                caught.append(selected)
                total_worth += value
        if not fortune_active:
            life_cooldowns[user_id] = now + cooldown
        check_achievements(user_id)
        lines = [f"{interaction.user.mention}", "# Caught"] + [f"* {f}" for f in caught] + [f"**Total worth: {total_worth} coins**"]
        content = "\n".join(lines)
        await interaction.response.edit_message(content=content, view=self)

    @discord.ui.button(label="Mine", style=discord.ButtonStyle.primary, emoji="⛏️")
    async def mine_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)
        if upgrades["mine"] == 0 or upgrades["pickaxe"] == 0:
            await interaction.response.send_message("You need to unlock the Mine and buy a Pickaxe from the Store first.", ephemeral=True)
            return
        pick_lvl = upgrades["pickaxe"]
        mine_lvl = upgrades["mine_level"]
        if pick_lvl == 1:
            rock_count = random.randint(3, 8)
            items = ["🪨 Rock"] * rock_count
            ore_count = 0
            jewel_count = 0
        elif pick_lvl == 2:
            rock_count = random.randint(7, 12)
            items = ["🪨 Rock"] * rock_count
            ore_count = 1 if random.random() < 0.3 else 0
            jewel_count = 0
        else:
            rock_count = random.randint(10, 16)
            items = ["🪨 Rock"] * rock_count
            ore_count = 1 if random.random() < 0.5 else 0
            jewel_count = 1 if random.random() < 0.25 else 0
        if mine_lvl >= 2:
            ore_count += random.randint(1, 3)
        if mine_lvl >= 3:
            ore_count += random.randint(3, 6)
            jewel_count += random.randint(1, 2)
        for _ in range(ore_count):
            items.append("🔩 Ore")
        for _ in range(jewel_count):
            items.append("💎 Jewel")
        for item in items:
            add_item(user_id, item)
        results = {}
        for item in items:
            results[item] = results.get(item, 0) + 1
        result_lines = [f"* {item} x{count}" for item, count in results.items()]
        content = f"{interaction.user.mention}\n# Mined\n" + "\n".join(result_lines)
        await interaction.response.edit_message(content=content, view=self)

    @discord.ui.button(label="Farm", style=discord.ButtonStyle.primary, emoji="🌾")
    async def farm_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)
        if not upgrades["farm"]:
            await interaction.followup.send("You need to buy a Farm from the Store first.", ephemeral=True)
            return
        now = time.time()
        planted_seed = upgrades["planted_seed"]
        planted_at = upgrades["planted_at"]
        if planted_seed and planted_at:
            seed_info = SEED_TYPES.get(planted_seed)
            if seed_info:
                elapsed = now - planted_at
                duration = seed_info["duration"]
                if elapsed >= duration:
                    status = f"{seed_info['yield']} are ready to harvest"
                    ready = True
                else:
                    remaining = duration - elapsed
                    mins = int(remaining // 60)
                    secs = int(remaining % 60)
                    status = f"{seed_info['yield']} growing... {mins}m {secs}s left"
                    ready = False
            else:
                status = "Unknown planted seed"
                ready = False
        else:
            status = "What you want to plant? I'm ready to work"
            ready = False
        view = FarmView(user_id, ready)
        msg = f"# Farm\n{status}"
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Village", style=discord.ButtonStyle.primary, emoji="🏘️")
    async def village_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        view = VillageView(user_id)
        msg = "# Village\nHey there! Why are you here? Do you need something?"
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Blacksmith", style=discord.ButtonStyle.secondary, emoji="🛠️")
    async def blacksmith_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        view = BlacksmithView(user_id)
        msg = (
            "# Blacksmith\n"
            "Here you can forge various kinds of goods that can be resold on the Market\n\n"
            f"**Materials: {ore_count} ores**"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Market", style=discord.ButtonStyle.secondary, emoji="🏪")
    async def market_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        inv = get_inventory(user_id)
        total_worth = 0
        for item in inv:
            if item in FISH_TYPES:
                total_worth += FISH_TYPES[item]
            elif item == "🪨 Rock":
                total_worth += ROCK_SALE_PRICE
            elif item == "🔩 Ore":
                total_worth += random.randint(*ORE_SALE_PRICE_RANGE)
            elif item == "💎 Jewel":
                total_worth += random.randint(*JEWEL_SALE_PRICE_RANGE)
        coins = get_coins(user_id)
        view = MarketView()
        msg = f"# Market Menu\nIn here, you can upgrades your Skills, Helper, Boat, Sell Fishes, Buy Buffs and else\n\n**Sell items worth: {total_worth} coins**\n**Your coins: {coins}**"
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Inventory", style=discord.ButtonStyle.secondary, emoji="🎒")
    async def inventory_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        coins = get_coins(user_id)
        inv = get_inventory(user_id)
        fish_counts = {}
        rock_count = 0
        ore_count = 0
        jewel_count = 0
        for item in inv:
            if item in FISH_TYPES:
                fish_counts[item] = fish_counts.get(item, 0) + 1
            elif item == "🪨 Rock":
                rock_count += 1
            elif item == "🔩 Ore":
                ore_count += 1
            elif item == "💎 Jewel":
                jewel_count += 1
        lines = [
            "# Stuff",
            f"* Coins: {coins}",
            f"* Fish: {sum(fish_counts.values())}",
            f"* Rocks: {rock_count}",
            f"* Ores: {ore_count}",
            f"* Jewels: {jewel_count}",
            "",
            "# Inventory →"
        ]
        total_worth = 0
        for fish_name, count in fish_counts.items():
            value = FISH_TYPES[fish_name]
            total_worth += value * count
            lines.append(f"* {fish_name} ({count})")
        if rock_count:
            lines.append(f"* 🪨 Rock ({rock_count})")
        if ore_count:
            lines.append(f"* 🔩 Ore ({ore_count})")
        if jewel_count:
            lines.append(f"* 💎 Jewel ({jewel_count})")
        lines.append(f"**Total worth: {total_worth} coins**")
        content = "\n".join(lines)
        await interaction.followup.send(content, ephemeral=True)

    @discord.ui.button(label="Achievements", style=discord.ButtonStyle.secondary, emoji="🏆")
    async def achievements_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        upgrades = get_upgrades(user_id)
        lines = ["# Achievements", "Everything you achieved will be available in here", ""]
        if upgrades["legendary_fisherman"]:
            lines.append("* 🎣 Legendary Fisherman - Caught your first legendary fish")
        else:
            lines.append("* 🔒 Legendary Fisherman - Catch a legendary fish (Deep Water Snake, Sea Dragon, Blue Whale)")
        if upgrades["richer_than_ever"]:
            lines.append("* 💰 Richer Than Ever - Accumulated 100,000 coins")
        else:
            lines.append("* 🔒 Richer Than Ever - Collect 100,000 coins")
        await interaction.followup.send("\n".join(lines), ephemeral=True)

    @discord.ui.button(label="Settings", style=discord.ButtonStyle.secondary, emoji="⚙️")
    async def settings_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        upgrades = get_upgrades(user_id)
        miner_active = upgrades["miner_machine_active"] == 1
        state_text = "Active" if miner_active else "Inactive"
        view = SettingsView(user_id, miner_active)
        msg = f"# Settings Menu\nAll options will be available here to Activate or Inactivate it\n* Miner Machine: {state_text}"
        await interaction.followup.send(msg, view=view, ephemeral=True)

class MarketView(View):
    def __init__(self):
        super().__init__(timeout=120)

    @discord.ui.button(label="Sell", style=discord.ButtonStyle.success, emoji="💰")
    async def sell_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        inv = get_inventory(user_id)
        if not inv:
            await interaction.response.send_message("Your inventory is empty.", ephemeral=True)
            return
        total = 0
        for item in inv:
            if item in FISH_TYPES:
                total += FISH_TYPES[item]
            elif item == "🪨 Rock":
                total += ROCK_SALE_PRICE
            elif item == "🔩 Ore":
                total += random.randint(*ORE_SALE_PRICE_RANGE)
            elif item == "💎 Jewel":
                total += random.randint(*JEWEL_SALE_PRICE_RANGE)
        clear_inventory(user_id)
        add_coins(user_id, total)
        coins = get_coins(user_id)
        check_achievements(user_id)
        await interaction.response.send_message(f"Sold everything for {total} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Store", style=discord.ButtonStyle.primary, emoji="🛒")
    async def store_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        coins = get_coins(user_id)
        view = build_store_view(user_id)
        msg = (
            "# Store Menu\n"
            "You can buy stuff to unlock more Quality of Life\n\n"
            "# Informations →\n"
            "* Helper: Increase the possibility to catch more fish around 1-5 per-catch\n"
            "* Boat: Increase the possibility to catch more fish around 5-8 per-catch\n"
            "* Fortune Candy: Ignore the cooldown of fishing for 3 minutes\n"
            "* Mine: Unlock the ability to mine rocks, ores and jewels\n"
            "* Pickaxe: Required to mine; upgradeable for better yields\n"
            "* Miner Machine: Automatically gives rocks/ores/jewels every hour\n"
            "* Farm: Unlock the Farm to grow and harvest crops\n\n"
            f"**Your coins: {coins}**"
        )
        await interaction.response.send_message(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Garden Shop", style=discord.ButtonStyle.secondary, emoji="🌱")
    async def garden_shop_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        view = GardenShopView(user_id)
        msg = "# Garden Shop\nBuys everything your garden needs"
        await interaction.response.send_message(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Upgrades", style=discord.ButtonStyle.secondary, emoji="⬆️")
    async def upgrades_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        upgrades = get_upgrades(user_id)
        coins = get_coins(user_id)
        lines = [
            "# Upgrade Menu",
            "Upgrades your stuff for better experience and easy money",
            "",
            "# Informations →",
            "* Better Fishing: Reduce cooldown of catch fishes",
            "* Fishing Rod: Increase chance to get rare fishes",
            "* Helper: aincrease the possibility to catch more fish around 1-5 per-catch",
            "* Pickaxe: Upgrade to get more rocks and better ores/jewels",
            "* Mine: Upgrade mine to get more ores and jewels",
            "",
            "# Levels →",
            f"* Better Fishing: level {upgrades['better_fishing']}",
            f"* Fishing Rod: level {upgrades['rod']}",
            f"* Helper: {'Level ' + str(upgrades['helper']) if upgrades['helper'] > 0 else 'Not owned'}",
            f"* Boat: {'Owned' if upgrades['boat'] else 'Not owned'}",
            f"* Mine: {'Level ' + str(upgrades['mine_level']) if upgrades['mine'] else 'Locked'}",
            f"* Pickaxe: level {upgrades['pickaxe']}",
            "",
            f"**Your coins: {coins}**"
        ]
        view = build_upgrade_view(user_id)
        await interaction.response.send_message("\n".join(lines), view=view, ephemeral=True)

class StoreView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Helper (200 coins)", style=discord.ButtonStyle.secondary, emoji="🙋", custom_id="store_helper")
    async def helper_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["helper"] > 0:
            await interaction.response.send_message("You already own a Helper.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < HELPER_UNLOCK_COST:
            await interaction.response.send_message(f"Need {HELPER_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, HELPER_UNLOCK_COST)
        set_upgrade(user_id, "helper_level", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Helper purchased!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Boat (10000 coins)", style=discord.ButtonStyle.primary, emoji="🚤", custom_id="store_boat")
    async def boat_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["boat"] == 1:
            await interaction.response.send_message("You already own a Boat.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < BOAT_UNLOCK_COST:
            await interaction.response.send_message(f"Need {BOAT_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, BOAT_UNLOCK_COST)
        set_upgrade(user_id, "boat_owned", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Boat purchased!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Fortune Candy (500 coins)", style=discord.ButtonStyle.success, emoji="🍭", custom_id="store_fortune")
    async def fortune_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        coins = get_coins(user_id)
        if coins < FORTUNE_CANDY_COST:
            await interaction.response.send_message(f"Need {FORTUNE_CANDY_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FORTUNE_CANDY_COST)
        expiry = time.time() + 180
        set_upgrade(user_id, "fortune_candy_until", expiry)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Fortune Candy activated! 3 minutes of no fishing cooldown.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Mine (25000 coins)", style=discord.ButtonStyle.primary, emoji="⛏️", custom_id="store_mine")
    async def mine_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["mine"] == 1:
            await interaction.response.send_message("You already own a Mine.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < MINE_UNLOCK_COST:
            await interaction.response.send_message(f"Need {MINE_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, MINE_UNLOCK_COST)
        set_upgrade(user_id, "mine_owned", 1)
        set_upgrade(user_id, "mine_level", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Mine unlocked! Now buy a Pickaxe.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Pickaxe (2000 coins)", style=discord.ButtonStyle.secondary, emoji="🔨", custom_id="store_pickaxe")
    async def pickaxe_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["pickaxe"] >= 1:
            await interaction.response.send_message("You already own a Pickaxe.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < PICKAXE_BUY_PRICE:
            await interaction.response.send_message(f"Need {PICKAXE_BUY_PRICE} coins.", ephemeral=True)
            return
        remove_coins(user_id, PICKAXE_BUY_PRICE)
        set_upgrade(user_id, "pickaxe_level", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Pickaxe purchased! Now you can mine.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Miner Machine (10000 coins)", style=discord.ButtonStyle.secondary, emoji="⚙️", custom_id="store_miner_machine")
    async def miner_machine_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["mine"] == 0:
            await interaction.response.send_message("You need to unlock the Mine first.", ephemeral=True)
            return
        if upgrades["miner_machine"] == 1:
            await interaction.response.send_message("You already own a Miner Machine.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < MINER_MACHINE_PRICE:
            await interaction.response.send_message(f"Need {MINER_MACHINE_PRICE} coins.", ephemeral=True)
            return
        remove_coins(user_id, MINER_MACHINE_PRICE)
        set_upgrade(user_id, "miner_machine_owned", 1)
        set_upgrade(user_id, "miner_machine_next", time.time() + 3600)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Miner Machine bought! It will start generating items every hour.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Farm (450000 coins)", style=discord.ButtonStyle.success, emoji="🌾", custom_id="store_farm")
    async def farm_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["farm"] == 1:
            await interaction.response.send_message("You already own a Farm.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FARM_UNLOCK_COST:
            await interaction.response.send_message(f"Need {FARM_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FARM_UNLOCK_COST)
        set_upgrade(user_id, "farm_owned", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Farm purchased! Now you can plant seeds.\n**Your coins: {coins}**", ephemeral=True)

class UpgradeView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Better Fishing (150 coins)", style=discord.ButtonStyle.success, emoji="⚡")
    async def better_fishing_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["better_fishing"] >= MAX_FISHING_LEVEL:
            await interaction.response.send_message("Already max level.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < UPGRADE_COST_SKILL:
            await interaction.response.send_message(f"Need {UPGRADE_COST_SKILL} coins.", ephemeral=True)
            return
        remove_coins(user_id, UPGRADE_COST_SKILL)
        new_level = upgrades["better_fishing"] + 1
        set_upgrade(user_id, "better_skill_level", new_level)
        cooldown = get_effective_cooldown(user_id)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Better Fishing upgraded to level {new_level}. Cooldown now {cooldown}s.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Fishing Rod", style=discord.ButtonStyle.primary, emoji="🎣")
    async def rod_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        current_lvl = upgrades["rod"]
        if current_lvl >= ROD_MAX_LEVEL:
            await interaction.response.send_message("Fishing Rod is already max level.", ephemeral=True)
            return
        next_lvl = current_lvl + 1
        cost = ROD_UPGRADE_COSTS.get(next_lvl, 999999)
        coins = get_coins(user_id)
        if coins < cost:
            await interaction.response.send_message(f"Need {cost} coins to upgrade to level {next_lvl}.", ephemeral=True)
            return
        remove_coins(user_id, cost)
        set_upgrade(user_id, "rod_level", next_lvl)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Fishing Rod upgraded to level {next_lvl}.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Upgrade Helper (100 coins)", style=discord.ButtonStyle.secondary, emoji="🙋")
    async def helper_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["helper"] == 0:
            await interaction.response.send_message("You must buy a Helper first.", ephemeral=True)
            return
        if upgrades["helper"] >= HELPER_MAX_LEVEL:
            await interaction.response.send_message("Helper is already max level.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < HELPER_UPGRADE_COST:
            await interaction.response.send_message(f"Need {HELPER_UPGRADE_COST} coins.", ephemeral=True)
            return
        new_level = upgrades["helper"] + 1
        remove_coins(user_id, HELPER_UPGRADE_COST)
        set_upgrade(user_id, "helper_level", new_level)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Helper upgraded to level {new_level}!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Pickaxe", style=discord.ButtonStyle.secondary, emoji="🔨")
    async def pickaxe_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["pickaxe"] == 0:
            await interaction.response.send_message("You must buy a Pickaxe first.", ephemeral=True)
            return
        if upgrades["pickaxe"] >= PICKAXE_MAX_LEVEL:
            await interaction.response.send_message("Pickaxe is already max level.", ephemeral=True)
            return
        next_lvl = upgrades["pickaxe"] + 1
        cost = PICKAXE_UPGRADE_COSTS.get(next_lvl, 999999)
        coins = get_coins(user_id)
        if coins < cost:
            await interaction.response.send_message(f"Need {cost} coins to upgrade Pickaxe to level {next_lvl}.", ephemeral=True)
            return
        remove_coins(user_id, cost)
        set_upgrade(user_id, "pickaxe_level", next_lvl)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Pickaxe upgraded to level {next_lvl}!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Mine", style=discord.ButtonStyle.primary, emoji="⛏️")
    async def mine_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["mine"] == 0:
            await interaction.response.send_message("You must unlock the Mine first.", ephemeral=True)
            return
        if upgrades["mine_level"] >= MINE_MAX_LEVEL:
            await interaction.response.send_message("Mine is already max level.", ephemeral=True)
            return
        next_lvl = upgrades["mine_level"] + 1
        cost = MINE_UPGRADE_COSTS.get(next_lvl, 999999)
        coins = get_coins(user_id)
        if coins < cost:
            await interaction.response.send_message(f"Need {cost} coins to upgrade Mine to level {next_lvl}.", ephemeral=True)
            return
        remove_coins(user_id, cost)
        set_upgrade(user_id, "mine_level", next_lvl)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Mine upgraded to level {next_lvl}!\n**Your coins: {coins}**", ephemeral=True)

class BlacksmithView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Accessories (40 ores)", style=discord.ButtonStyle.primary, emoji="💍")
    async def accessories_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        if ore_count < 40:
            await interaction.response.send_message(f"You need 40 ores (have {ore_count}).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 40)
        coins_earned = random.randint(30, 50)
        add_coins(user_id, coins_earned)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Accessories forged! You sold for {coins_earned} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Sword (30 ores)", style=discord.ButtonStyle.secondary, emoji="⚔️")
    async def sword_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        if ore_count < 30:
            await interaction.response.send_message(f"You need 30 ores (have {ore_count}).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 30)
        coins_earned = random.randint(20, 40)
        add_coins(user_id, coins_earned)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Sword forged! You sold for {coins_earned} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Armor (35 ores)", style=discord.ButtonStyle.success, emoji="🛡️")
    async def armor_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        if ore_count < 35:
            await interaction.response.send_message(f"You need 35 ores (have {ore_count}).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 35)
        coins_earned = random.randint(25, 45)
        add_coins(user_id, coins_earned)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Armor forged! You sold for {coins_earned} coins.\n**Your coins: {coins}**", ephemeral=True)

def remove_items_by_name(user_id, item_name, count):
    import sqlite3
    with sqlite3.connect("tokens.db") as conn:
        conn.execute("DELETE FROM life_inventory WHERE id IN (SELECT id FROM life_inventory WHERE user_id = ? AND item_name = ? LIMIT ?)", (str(user_id), item_name, count))
        conn.commit()

class FarmView(View):
    def __init__(self, user_id, ready_to_harvest):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.ready_to_harvest = ready_to_harvest
        self.harvest_button.disabled = not ready_to_harvest

    @discord.ui.button(label="Plant", style=discord.ButtonStyle.primary, emoji="🌱")
    async def plant_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        seeds = [item for item in inv if item in SEED_TYPES]
        if not seeds:
            await interaction.response.send_message("You don't have any seeds. Buy some from the Garden Shop.", ephemeral=True)
            return
        seed_types = list(set(seeds))
        view = SeedSelectView(user_id, seed_types)
        await interaction.response.send_message("Select a seed to plant:", view=view, ephemeral=True)

    @discord.ui.button(label="Harvest", style=discord.ButtonStyle.success, emoji="🌾")
    async def harvest_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        planted_seed = upgrades["planted_seed"]
        if not planted_seed or not self.ready_to_harvest:
            await interaction.response.send_message("Nothing ready to harvest.", ephemeral=True)
            return
        seed_info = SEED_TYPES[planted_seed]
        yield_item = seed_info["yield"]
        num_yield = seed_info["count"]
        for _ in range(num_yield):
            add_item(user_id, yield_item)
        set_upgrade(user_id, "planted_seed", None)
        set_upgrade(user_id, "planted_at", None)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Harvested {num_yield} {yield_item}!\n**Your coins: {coins}**", ephemeral=True)

class SeedSelectView(View):
    def __init__(self, user_id, seeds):
        super().__init__(timeout=60)
        self.user_id = user_id
        for seed in seeds:
            self.add_item(SeedButton(user_id, seed))

class SeedButton(Button):
    def __init__(self, user_id, seed):
        label = f"{seed} ({SEED_TYPES[seed]['price']} coins)"
        super().__init__(label=label, style=discord.ButtonStyle.primary, emoji=seed)
        self.user_id = user_id
        self.seed = seed

    async def callback(self, interaction: discord.Interaction):
        user_id = self.user_id
        seed = self.seed
        upgrades = get_upgrades(user_id)
        if upgrades["planted_seed"]:
            await interaction.response.send_message("You already have something planted. Harvest first.", ephemeral=True)
            return
        inv = get_inventory(user_id)
        if seed not in inv:
            await interaction.response.send_message("You don't have that seed.", ephemeral=True)
            return
        remove_items_by_name(user_id, seed, 1)
        set_upgrade(user_id, "planted_seed", seed)
        set_upgrade(user_id, "planted_at", time.time())
        seed_info = SEED_TYPES[seed]
        duration = seed_info["duration"]
        mins = duration // 60
        await interaction.response.send_message(f"{seed} planted! It will be ready in {mins} minutes. Don't forget to harvest.", ephemeral=True)

class VillageView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Hire Farmer (250 coins)", style=discord.ButtonStyle.primary, emoji="👨‍🌾")
    async def hire_farmer_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["farmer"]:
            await interaction.response.send_message("You already have a Farmer.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FARMER_HIRE_COST:
            await interaction.response.send_message(f"Need {FARMER_HIRE_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FARMER_HIRE_COST)
        set_upgrade(user_id, "farmer_hired", 1)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Farmer hired! They'll help with harvests.\n**Your coins: {coins}**", ephemeral=True)

class GardenShopView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Wheat (45 coins)", style=discord.ButtonStyle.primary, emoji="🌾")
    async def wheat_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        coins = get_coins(user_id)
        if coins < 45:
            await interaction.response.send_message("Need 45 coins.", ephemeral=True)
            return
        remove_coins(user_id, 45)
        for _ in range(9):
            add_item(user_id, "🌾 Wheat Seed")
        coins = get_coins(user_id)
        await interaction.response.send_message("Bought 9 Wheat Seeds!\n**Your coins: " + str(coins) + "**", ephemeral=True)

    @discord.ui.button(label="Carrot (63 coins)", style=discord.ButtonStyle.primary, emoji="🥕")
    async def carrot_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        coins = get_coins(user_id)
        if coins < 63:
            await interaction.response.send_message("Need 63 coins.", ephemeral=True)
            return
        remove_coins(user_id, 63)
        for _ in range(9):
            add_item(user_id, "🥕 Carrot Seed")
        coins = get_coins(user_id)
        await interaction.response.send_message("Bought 9 Carrot Seeds!\n**Your coins: " + str(coins) + "**", ephemeral=True)

    @discord.ui.button(label="Potato (72 coins)", style=discord.ButtonStyle.primary, emoji="🥔")
    async def potato_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        coins = get_coins(user_id)
        if coins < 72:
            await interaction.response.send_message("Need 72 coins.", ephemeral=True)
            return
        remove_coins(user_id, 72)
        for _ in range(9):
            add_item(user_id, "🥔 Potato Seed")
        coins = get_coins(user_id)
        await interaction.response.send_message("Bought 9 Potato Seeds!\n**Your coins: " + str(coins) + "**", ephemeral=True)

class SettingsView(View):
    def __init__(self, user_id, current_state):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.current_state = current_state

    @discord.ui.button(label="Miner Machine", style=discord.ButtonStyle.secondary, emoji="⚙️")
    async def toggle_miner_machine(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        new_state = 1 if not self.current_state else 0
        set_upgrade(user_id, "miner_machine_active", new_state)
        state_text = "Active" if new_state else "Inactive"
        msg = f"# Settings Menu\nAll options will be available here to Activate or Inactivate it\n* Miner Machine: {state_text}"
        view = SettingsView(user_id, bool(new_state))
        await interaction.response.edit_message(content=msg, view=view)

async def life_command(interaction: discord.Interaction):
    init_db()
    view = MainLifeView()
    content = (
        "# Home\n"
        "Choose an activity to begin your adventure\n\n"
        "🎣 **Fishing**: Cast your line and see what bites.\n"
        "⛏️ **Mining**: Dig deep for valuable ores and gems.\n"
        "🌾 **Farming**: Tend your crops and harvest rewards."
    )
    await interaction.response.send_message(content, view=view)