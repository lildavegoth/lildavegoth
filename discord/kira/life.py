import json
import discord
from discord.ui import View, Button
import time
import random
from life_data import (
    init_db, get_coins, add_coins, remove_coins,
    add_item, add_items_bulk, get_inventory, get_inventory_count,
    clear_inventory, get_upgrades, set_upgrade,
    process_miner_machine, remove_items_by_name,
    add_market_listing, get_market_listings_by_item,
    get_all_market_listings, remove_market_listing,
    increment_quest_progress, check_and_break_boat,
    fire_worker
)
from village import VillageView, RoyalHallsView

with open("/home/container/data/game_data.json", "r", encoding="utf-8") as f:
    DATA = json.load(f)

BASE_COOLDOWN = DATA["BASE_COOLDOWN"]
MIN_COOLDOWN = DATA["MIN_COOLDOWN"]
MAX_FISHING_LEVEL = DATA["MAX_FISHING_LEVEL"]
ROD_MAX_LEVEL = DATA["ROD_MAX_LEVEL"]
HELPER_MAX_LEVEL = DATA["HELPER_MAX_LEVEL"]
PICKAXE_MAX_LEVEL = DATA["PICKAXE_MAX_LEVEL"]
MINE_MAX_LEVEL = DATA["MINE_MAX_LEVEL"]
FARMER_MAX = DATA["FARMER_MAX"]

UPGRADE_COST_SKILL = DATA["UPGRADE_COST_SKILL"]
ROD_UPGRADE_COSTS = {int(k): v for k, v in DATA["ROD_UPGRADE_COSTS"].items()}
FISHING_HELPER_COST = DATA["FISHING_HELPER_COST"]
FISHING_HELPER_CHARGE_PER_HELPER = DATA["FISHING_HELPER_CHARGE_PER_HELPER"]
BOAT_UNLOCK_COST = DATA["BOAT_UNLOCK_COST"]
SHIP_UNLOCK_COST = DATA["SHIP_UNLOCK_COST"]
FORTUNE_CANDY_COST = DATA["FORTUNE_CANDY_COST"]
MINE_UNLOCK_COST = DATA["MINE_UNLOCK_COST"]
MINE_UPGRADE_COSTS = {int(k): v for k, v in DATA["MINE_UPGRADE_COSTS"].items()}
PICKAXE_BUY_PRICE = DATA["PICKAXE_BUY_PRICE"]
PICKAXE_UPGRADE_COSTS = {int(k): v for k, v in DATA["PICKAXE_UPGRADE_COSTS"].items()}
MINER_MACHINE_PRICE = DATA["MINER_MACHINE_PRICE"]
FARM_UNLOCK_COST = DATA["FARM_UNLOCK_COST"]
FARMER_HIRE_COST = DATA["FARMER_HIRE_COST"]
CHEF_HIRE_COST = DATA["CHEF_HIRE_COST"]
WATERING_CAN_PRICE = DATA["WATERING_CAN_PRICE"]

ROCK_SALE_PRICE = DATA["ROCK_SALE_PRICE"]
ORE_SALE_PRICE_RANGE = tuple(DATA["ORE_SALE_PRICE_RANGE"])
JEWEL_SALE_PRICE_RANGE = tuple(DATA["JEWEL_SALE_PRICE_RANGE"])
SHINY_JEWEL_SALE_PRICE_RANGE = tuple(DATA["SHINY_JEWEL_SALE_PRICE_RANGE"])

SEED_TYPES = DATA["SEED_TYPES"]
FORGED_ITEMS = {k: tuple(v) for k, v in DATA["FORGED_ITEMS"].items()}
COOKED_ITEMS = DATA["COOKED_ITEMS"]
COOKED_SELL_PRICES = DATA["COOKED_SELL_PRICES"]
CROP_ITEMS = DATA["CROP_ITEMS"]
FISH_ITEMS = ["🐟 Common Carp", "🐙 Octopus", "🦑 Squid"]

FISH_TYPES = DATA["FISH_TYPES"]
ROD_LOCKED_FISH = {int(k): v for k, v in DATA["ROD_LOCKED_FISH"].items()}
FISH_WEIGHTS = DATA["FISH_WEIGHTS"]

life_cooldowns = {}

MARKET_SELLABLE_ITEMS = DATA["MARKET_SELLABLE_ITEMS"]
EMBLEM_REWARDS = DATA["EMBLEM_REWARDS"]
ROYAL_HALL_ITEMS_LIST = DATA["ROYAL_HALL_ITEMS_LIST"]
ROYAL_HALL_PRICES = DATA["ROYAL_HALL_PRICES"]

FISHERMAN_AUTO_CATCHES = 10

HOME_TIPS = [
    "**Tip**: Better to cook Common Carp before you sell it!",
    "**Tip**: Accept Quests that feels easier for you.",
    "**Tip**: Do Fishing to get rich before Adventuring!",
]

ADVENTURE_LOOT_ITEMS = ["🦴 Bones", "💰 Coinsbag", "🏹 Bow", "🔨 Club", "📜 Scroll", "🐉 Scale", "🔥 Fire Breath"]

active_life_sessions = {}


def get_effective_cooldown(user_id):
    upgrades = get_upgrades(user_id)
    if time.time() < upgrades["fortune_candy"]:
        return 0
    reduction = 0.3 * upgrades["better_fishing"]
    return max(MIN_COOLDOWN, BASE_COOLDOWN - reduction)


def get_catch_range(user_id):
    upgrades = get_upgrades(user_id)
    if upgrades["ship"]:
        return (10, 15)
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
    boat_label = "Boat (10000 coins)" if upgrades["boat"] == 0 else "Boat (Bought)"
    ship_label = "Ship (40000 coins)" if upgrades["ship"] == 0 else "Ship (Bought)"
    fortune_label = "Fortune Candy (500 coins)"
    mine_label = "Mine (25000 coins)" if upgrades["mine"] == 0 else "Mine (Bought)"
    pickaxe_label = "Pickaxe (2000 coins)" if upgrades["pickaxe"] == 0 else "Pickaxe (Bought)"
    miner_label = "Miner Machine (10000 coins)" if upgrades["miner_machine"] == 0 else "Miner Machine (Bought)"
    view.boat_button.label = boat_label
    view.ship_button.label = ship_label
    view.fortune_button.label = fortune_label
    view.mine_button.label = mine_label
    view.pickaxe_button.label = pickaxe_label
    view.miner_machine_button.label = miner_label
    if upgrades["boat"] == 1:
        view.boat_button.disabled = True
    elif upgrades["boat"] == 0:
        view.ship_button.disabled = True
    if upgrades["ship"] == 1:
        view.ship_button.disabled = True
    if upgrades["mine"] == 1:
        view.mine_button.disabled = True
    if upgrades["pickaxe"] >= 1:
        view.pickaxe_button.disabled = True
    if upgrades["miner_machine"] == 1:
        view.miner_machine_button.disabled = True
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
    emblems = upgrades["emblems"]
    if coins >= 100000 and upgrades["richer_than_ever"] == 0:
        set_upgrade(user_id, "achievement_richer_than_ever", 1)
        for _ in range(5):
            add_item(user_id, "🔩 Ore")
        for _ in range(10):
            add_item(user_id, "💍 Accessories")
    if emblems >= 100 and upgrades["kings_lover"] == 0:
        set_upgrade(user_id, "achievement_kings_lover", 1)
        set_upgrade(user_id, "emblems", emblems + 50)


def has_unlimited_watering_can(user_id):
    inv = get_inventory(user_id)
    return "🪣 Unlimited Watering Can" in inv


def get_harvest_speed(farmer_count):
    if farmer_count >= 3:
        return 3.0
    elif farmer_count == 2:
        return 1.5
    else:
        return 1.0


def get_effective_duration(seed_name, farmer_count):
    base = SEED_TYPES[seed_name]["duration"]
    speed = get_harvest_speed(farmer_count)
    return base / speed


class MainLifeView(View):
    def __init__(self, guild=None):
        super().__init__(timeout=None)
        
        self.add_item(Button(label="Game Wiki", style=discord.ButtonStyle.url, url="https://github.com/lildavegoth/lildavegoth/blob/homepage/discord/kira/life-game-wiki.md"))

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

        fishermen = upgrades["fisherman_hired"]
        catch_cycles = FISHERMAN_AUTO_CATCHES if fishermen else 1

        total_caught = []
        total_worth = 0
        helper_total_payment = 0
        fisherman_payment_msg = ""

        if fishermen:
            fish_count = upgrades["fisherman_fishing_count"] + 1
            if fish_count >= 5:
                coins = get_coins(user_id)
                if coins < 50:
                    await interaction.response.send_message(
                        "You need 50 coins to pay your Fisherman.", ephemeral=True
                    )
                    return
                remove_coins(user_id, 50)
                set_upgrade(user_id, "fisherman_fishing_count", 0)
                fisherman_payment_msg = "Paid Fisherman 50 coins"
            else:
                set_upgrade(user_id, "fisherman_fishing_count", fish_count)

        for _ in range(catch_cycles):
            helpers = upgrades["helper"]
            if helpers > 0:
                fishing_count = upgrades["fishing_helper_count"] + 1
                if fishing_count >= 5:
                    charge = helpers * FISHING_HELPER_CHARGE_PER_HELPER
                    coins = get_coins(user_id)
                    if coins < charge:
                        await interaction.response.send_message(
                            f"You need {charge} coins to pay your {helpers} Fishing Helper(s).", ephemeral=True
                        )
                        return
                    remove_coins(user_id, charge)
                    helper_total_payment += charge
                    set_upgrade(user_id, "fishing_helper_count", 0)
                else:
                    set_upgrade(user_id, "fishing_helper_count", fishing_count)

            rod_level = upgrades["rod"]
            boat_owned = upgrades["boat"] == 1 or upgrades["ship"] == 1
            catch_min, catch_max = get_catch_range(user_id)
            num_fish = random.randint(catch_min, catch_max)
            caught = []
            worth = 0
            for _ in range(num_fish):
                available = [f for f in FISH_TYPES if can_catch_fish(f, rod_level, boat_owned)]
                selected = weighted_choice(available)
                if selected == "📦 Package":
                    coins_earned = random.randint(5, 15)
                    add_coins(user_id, coins_earned)
                    caught.append("📦 Package")
                    worth += coins_earned
                else:
                    value = FISH_TYPES[selected]
                    add_item(user_id, selected)
                    caught.append(selected)
                    worth += value
                    if selected in ["🐍 Deep Water Snake", "🐉 Sea Dragon", "🐋 Blue Whale"] and upgrades["legendary_fisherman"] == 0:
                        set_upgrade(user_id, "achievement_legendary_fisherman", 1)
                        add_coins(user_id, 5000)
                        for _ in range(5):
                            add_item(user_id, "💍 Accessories")
                    if selected == "🐟 Common Carp":
                        increment_quest_progress(user_id, "catch_common_carp", 1)
                    elif selected == "🦑 Squid":
                        increment_quest_progress(user_id, "catch_squid", 1)
                    elif selected == "🐡 Pufferfish":
                        increment_quest_progress(user_id, "catch_pufferfish", 1)
                    elif selected == "🐠 Tropical Clownfish":
                        increment_quest_progress(user_id, "catch_tropical_clownfish", 1)
                    elif selected == "🐙 Octopus":
                        increment_quest_progress(user_id, "catch_octopus", 1)
                    elif selected == "🦀 Crab":
                        increment_quest_progress(user_id, "catch_crab", 1)
            total_caught.extend(caught)
            total_worth += worth

        durability_loss = check_and_break_boat(user_id)
        if not fortune_active:
            life_cooldowns[user_id] = now + cooldown
        check_achievements(user_id)

        caught_counts = {}
        for f in total_caught:
            caught_counts[f] = caught_counts.get(f, 0) + 1
        lines = [f"{interaction.user.mention}", "# Caught"]
        lines.extend(f"* {item} ({count})" for item, count in caught_counts.items())
        if helper_total_payment > 0:
            lines.append(f"Paid Fishing Helper(s) {helper_total_payment} coins")
        if fisherman_payment_msg:
            lines.append(fisherman_payment_msg)
        if durability_loss:
            lines.append(f"Your {durability_loss} broke!")
        lines.append(f"**Total worth: {total_worth} coins**")
        content = "\n".join(lines)
        await interaction.response.edit_message(content=content, view=self)

    @discord.ui.button(label="Mine", style=discord.ButtonStyle.primary, emoji="⛏️")
    async def mine_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer()
        user_id = interaction.user.id
        mm_result = process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)

        mm_text = ""
        if upgrades["miner_machine"]:
            now = time.time()
            if mm_result:
                rocks, ores, jewels, shiny_jewels = mm_result
                items = []
                if rocks: items.append(f"{rocks} Rocks")
                if ores: items.append(f"{ores} Ores")
                if jewels: items.append(f"{jewels} Jewels")
                if shiny_jewels: items.append(f"{shiny_jewels} Shiny Jewels")
                if items:
                    mm_text = "# Miner Machine →\n* Mined Items: " + ", ".join(items) + "\n* Running for 1 hour from now"
                else:
                    mm_text = "# Miner Machine →\n* Miner Machine is running"
            else:
                remaining = upgrades["miner_machine_next"] - now
                if remaining > 0:
                    mins = int(remaining // 60)
                    secs = int(remaining % 60)
                    mm_text = f"# Miner Machine →\n* Miner Machine are resting and ready to start again for {mins}m {secs}s"
                else:
                    mm_text = "# Miner Machine →\n* Miner Machine are resting and ready to start again for 0s"
        else:
            mm_text = ""

        if upgrades["mine"] == 0 or upgrades["pickaxe"] == 0:
            msg = "You need to unlock the Mine and buy a Pickaxe from the Store first.\n" + mm_text
            await interaction.followup.send(msg, ephemeral=True)
            return

        pick_lvl = upgrades["pickaxe"]
        mine_lvl = upgrades["mine_level"]
        items = []
        rock_count = 0
        ore_count = 0
        jewel_count = 0
        shiny_count = 0
        if pick_lvl == 1:
            rock_count = random.randint(3, 8)
            items = ["🪨 Rock"] * rock_count
        elif pick_lvl == 2:
            rock_count = random.randint(7, 12)
            items = ["🪨 Rock"] * rock_count
            if random.random() < 0.3:
                ore_count += 1
                items.append("🔩 Ore")
        else:
            rock_count = random.randint(10, 16)
            items = ["🪨 Rock"] * rock_count
            if random.random() < 0.5:
                ore_count += 1
                items.append("🔩 Ore")
            if random.random() < 0.25:
                jewel_count += 1
                items.append("💎 Jewel")
        if mine_lvl >= 2:
            extra_ores = random.randint(1, 3)
            ore_count += extra_ores
            for _ in range(extra_ores):
                items.append("🔩 Ore")
        if mine_lvl >= 3:
            extra_ores = random.randint(3, 6)
            ore_count += extra_ores
            for _ in range(extra_ores):
                items.append("🔩 Ore")
            extra_jewels = random.randint(1, 2)
            jewel_count += extra_jewels
            for _ in range(extra_jewels):
                items.append("💎 Jewel")
            if pick_lvl >= 3 and random.random() < 0.05:
                shiny_count = random.randint(1, 2)
                for _ in range(shiny_count):
                    items.append("💠 Shiny Jewel")
        for item in items:
            add_item(user_id, item)
        increment_quest_progress(user_id, "mine_rocks", rock_count)
        increment_quest_progress(user_id, "mine_ores", ore_count)
        results = {}
        for item in items:
            results[item] = results.get(item, 0) + 1
        result_lines = [f"* {item} x{count}" for item, count in results.items()]
        content = f"{interaction.user.mention}\n# Mined\n" + "\n".join(result_lines)
        if mm_text:
            content += "\n" + mm_text
        await interaction.edit_original_response(content=content)

    @discord.ui.button(label="Farm", style=discord.ButtonStyle.primary, emoji="🌾")
    async def farm_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)
        if not upgrades["farm"]:
            await interaction.followup.send("You need to buy a Farmland from the Village first.", ephemeral=True)
            return
        now = time.time()
        planted_seed = upgrades["planted_seed"]
        planted_at = upgrades["planted_at"]
        farmer_count = upgrades["farmer_count"]
        if planted_seed and planted_at:
            seed_info = SEED_TYPES.get(planted_seed)
            if seed_info:
                effective_duration = get_effective_duration(planted_seed, farmer_count)
                elapsed = now - planted_at
                if elapsed >= effective_duration:
                    status = f"{seed_info['yield']} are ready to harvest"
                    ready = True
                else:
                    remaining = effective_duration - elapsed
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

    @discord.ui.button(label="Adventure", style=discord.ButtonStyle.primary, emoji="⚔️")
    async def adventure_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer()
        from adventure import start_adventure_session
        await start_adventure_session(interaction)

    @discord.ui.button(label="Village", style=discord.ButtonStyle.primary, emoji="🏘️")
    async def village_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)
        view = VillageView(user_id, upgrades)
        msg = (
            "# Village\n"
            "Hey there! Welcome to the Village! Do you need something?\n\n"
            "# Informations →\n"
            "If you hire a workers, you'll needs to pay them equals to the hire price everytime you do Fishing, Farming and Cooking"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Cook & Bakery", style=discord.ButtonStyle.secondary, emoji="🍞")
    async def cook_bakery_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        upgrades = get_upgrades(user_id)
        inv = get_inventory(user_id)
        wheat_count = inv.count("🌾 Wheat")
        carrot_count = inv.count("🥕 Carrot")
        potato_count = inv.count("🥔 Potato")
        carp_count = inv.count("🐟 Common Carp")
        view = CookBakeryView(user_id, upgrades.get("chef", 0))
        msg = (
            "# Cook & Bakery\n"
            "Turn raw ingredients into delicious meals\n"
            f"* Wheat: {wheat_count}\n"
            f"* Carrot: {carrot_count}\n"
            f"* Potato: {potato_count}\n"
            f"* Common Carp: {carp_count}"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Market", style=discord.ButtonStyle.secondary, emoji="🏪")
    async def market_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        coins = get_coins(user_id)
        view = MarketView()
        msg = f"# Market\nIn here, you can upgrades your Skills, Sell items, Buy Buffs and else\n\n**Your coins: {coins}**"
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Inventory", style=discord.ButtonStyle.secondary, emoji="🎒")
    async def inventory_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        process_miner_machine(user_id)
        check_achievements(user_id)
        coins = get_coins(user_id)
        upgrades = get_upgrades(user_id)
        emblems = upgrades["emblems"]
        inv = get_inventory(user_id)
        fish_counts = {}
        crop_counts = {}
        forged_counts = {}
        cooked_counts = {}
        unsellable_counts = {}
        loot_counts = {}
        legendary_fish = ["🐉 Sea Dragon", "🐍 Deep Water Snake", "🐋 Blue Whale"]
        for item in inv:
            if item in FISH_TYPES and item not in legendary_fish:
                fish_counts[item] = fish_counts.get(item, 0) + 1
            elif item in legendary_fish:
                unsellable_counts[item] = unsellable_counts.get(item, 0) + 1
            elif item in ADVENTURE_LOOT_ITEMS:
                loot_counts[item] = loot_counts.get(item, 0) + 1
            elif item in CROP_ITEMS:
                crop_counts[item] = crop_counts.get(item, 0) + 1
            elif item in FORGED_ITEMS:
                forged_counts[item] = forged_counts.get(item, 0) + 1
            elif item in COOKED_SELL_PRICES:
                cooked_counts[item] = cooked_counts.get(item, 0) + 1
            elif item in ["🪨 Rock", "🔩 Ore", "💎 Jewel", "💠 Shiny Jewel"]:
                unsellable_counts[item] = unsellable_counts.get(item, 0) + 1
        lines = [
            "# Stuff",
            f"* Coins: {coins}",
            f"* Emblems: {emblems}",
            f"* Fish: {sum(fish_counts.values())}",
            f"* Crops: {sum(crop_counts.values())}",
            f"* Forged: {sum(forged_counts.values())}",
            f"* Cooked: {sum(cooked_counts.values())}",
            "",
            "# Inventory →"
        ]
        total_worth = 0
        for fish_name, count in fish_counts.items():
            value = FISH_TYPES[fish_name]
            total_worth += value * count
            lines.append(f"* {fish_name} ({count})")
        for crop_name, count in crop_counts.items():
            value = SEED_TYPES.get(crop_name, {}).get("sell_each", 0)
            total_worth += value * count
            lines.append(f"* {crop_name} ({count})")
        for forged_name, count in forged_counts.items():
            lines.append(f"* {forged_name} ({count})")
        for cooked_name, count in cooked_counts.items():
            value = COOKED_SELL_PRICES[cooked_name]
            total_worth += value * count
            lines.append(f"* {cooked_name} ({count})")
        if loot_counts:
            lines.append("")
            lines.append("# Loots →")
            for item, count in loot_counts.items():
                lines.append(f"* {item} ({count})")
        lines.append("")
        lines.append("# Unsellable →")
        for item, count in unsellable_counts.items():
            note = ""
            if item == "💠 Shiny Jewel":
                note = " | Can only be sell in Village Market"
            elif item in legendary_fish:
                note = " | Can only be sell in Village Market"
            lines.append(f"* {item} ({count}){note}")
        lines.append(f"\n**Total worth: {total_worth} coins**")
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
        if upgrades["kings_lover"]:
            lines.append("* 👑 The King's Favorites - Collected 100 King's Emblems")
        else:
            lines.append("* 🔒 The King's Favorites - Collect 100 King's Emblems")
        await interaction.followup.send("\n".join(lines), ephemeral=True)

    @discord.ui.button(label="Choices", style=discord.ButtonStyle.secondary, emoji="⚙️")
    async def choices_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = interaction.user.id
        upgrades = get_upgrades(user_id)
        view = ChoicesView(user_id, upgrades)
        boat_status = "Active (Boat)" if upgrades["boat"] else "Not owned"
        ship_status = "Active (Ship)" if upgrades["ship"] else "Not owned"
        miner_status = "Active" if upgrades["miner_machine_active"] and upgrades["miner_machine"] else "Inactive"
        msg = (
            "# Choices\n"
            "All options will be available here to Activate or Inactivate it\n"
            f"* Boat or Ship: {boat_status if not upgrades['ship'] else ship_status}\n"
            f"* Miner Machine: {miner_status}"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)


class MarketView(View):
    def __init__(self):
        super().__init__(timeout=120)

    @discord.ui.button(label="Sell", style=discord.ButtonStyle.success, emoji="💰")
    async def sell_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        view = SellView(user_id)
        total_worth = 0
        inv = get_inventory(user_id)
        for item in inv:
            if item in FISH_TYPES:
                total_worth += FISH_TYPES[item]
            elif item in CROP_ITEMS:
                total_worth += SEED_TYPES.get(item, {}).get("sell_each", 0)
            elif item in FORGED_ITEMS:
                low, high = FORGED_ITEMS[item]
                total_worth += random.randint(low, high)
            elif item in COOKED_SELL_PRICES:
                total_worth += COOKED_SELL_PRICES[item]
            elif item in ["🪨 Rock", "🔩 Ore", "💎 Jewel", "💠 Shiny Jewel"]:
                continue
        msg = f"# Sell Items\nSell your items by your own choices\n\n**Sell all items worth: {total_worth} coins**"
        await interaction.response.send_message(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Store", style=discord.ButtonStyle.primary, emoji="🛒")
    async def store_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        coins = get_coins(user_id)
        view = build_store_view(user_id)
        msg = (
            "# Store\n"
            "You can buy stuff to unlock more Quality of Life\n\n"
            "# Informations →\n"
            "* Boat: Increase the possibility to catch more fish around 5-8 per-catch\n"
            "* Ship: Even bigger boat for 10-15 fish\n"
            "* Fortune Candy: Ignore the cooldown of fishing for 3 minutes\n"
            "* Mine: Unlock the ability to mine rocks, ores and jewels\n"
            "* Pickaxe: Required to mine; upgradeable for better yields\n"
            "* Miner Machine: Automatically gives rocks/ores/jewels every hour\n\n"
            f"**Your coins: {coins}**"
        )
        await interaction.response.send_message(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Farm Shop", style=discord.ButtonStyle.secondary, emoji="🌱")
    async def farm_shop_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        view = FarmShopView(user_id)
        msg = "# Farm Shop\nBuys everything your farm needs"
        await interaction.response.send_message(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Upgrades", style=discord.ButtonStyle.secondary, emoji="⬆️")
    async def upgrades_button(self, interaction: discord.Interaction, button: Button):
        user_id = interaction.user.id
        upgrades = get_upgrades(user_id)
        coins = get_coins(user_id)
        lines = [
            "# Upgrades",
            "Upgrades your stuff for better experience and easy money",
            "",
            "# Informations →",
            "* Better Fishing: Reduce cooldown of catch fishes",
            "* Fishing Rod: Increase chance to get rare fishes",
            "* Pickaxe: Upgrade to get more rocks and better ores/jewels",
            "* Mine: Upgrade mine to get more ores and jewels",
            "",
            "# Levels →",
            f"* Better Fishing: level {upgrades['better_fishing']}",
            f"* Fishing Rod: level {upgrades['rod']}",
            f"* Mine: {'Level ' + str(upgrades['mine_level']) if upgrades['mine'] else 'Locked'}",
            f"* Pickaxe: level {upgrades['pickaxe']}",
            "",
            f"**Your coins: {coins}**"
        ]
        view = build_upgrade_view(user_id)
        await interaction.response.send_message("\n".join(lines), view=view, ephemeral=True)


class SellView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    def get_category_items(self, category):
        user_id = self.user_id
        inv = get_inventory(user_id)
        unsellable_fish = ["🐉 Sea Dragon", "🐍 Deep Water Snake", "🐋 Blue Whale"]
        if category == "All":
            return [item for item in inv if item not in ["🪨 Rock", "🔩 Ore", "💎 Jewel", "💠 Shiny Jewel"] + unsellable_fish]
        elif category == "Fish":
            return [item for item in inv if item in FISH_TYPES and item not in unsellable_fish]
        elif category == "Farm":
            return [item for item in inv if item in CROP_ITEMS]
        elif category == "Forged":
            return [item for item in inv if item in FORGED_ITEMS]
        elif category == "Cooked":
            return [item for item in inv if item in COOKED_SELL_PRICES]

    def calculate_total(self, items):
        total = 0
        for item in items:
            if item in FISH_TYPES:
                total += FISH_TYPES[item]
            elif item in CROP_ITEMS:
                total += SEED_TYPES.get(item, {}).get("sell_each", 0)
            elif item in FORGED_ITEMS:
                low, high = FORGED_ITEMS[item]
                total += random.randint(low, high)
            elif item in COOKED_SELL_PRICES:
                total += COOKED_SELL_PRICES[item]
        return total

    def sell_items(self, items_list):
        user_id = self.user_id
        if not items_list:
            return 0
        totals = {}
        for item in items_list:
            totals[item] = totals.get(item, 0) + 1
        for item_name, cnt in totals.items():
            remove_items_by_name(user_id, item_name, cnt)
        return self.calculate_total(items_list)

    @discord.ui.button(label="All", style=discord.ButtonStyle.primary, emoji="💰")
    async def sell_all_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        items = self.get_category_items("All")
        if not items:
            await interaction.followup.send("No sellable items.", ephemeral=True)
            return
        total = self.sell_items(items)
        add_coins(user_id, total)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Sold all items for {total} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Fish", style=discord.ButtonStyle.secondary, emoji="🎣")
    async def sell_fish_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        items = self.get_category_items("Fish")
        fish_count = len(items)
        if not items:
            await interaction.followup.send("No fish to sell.", ephemeral=True)
            return
        total = self.sell_items(items)
        add_coins(user_id, total)
        increment_quest_progress(user_id, "sell_fish", fish_count)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Sold fish for {total} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Farm", style=discord.ButtonStyle.success, emoji="🌾")
    async def sell_farm_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        items = self.get_category_items("Farm")
        if not items:
            await interaction.followup.send("No farm items to sell.", ephemeral=True)
            return
        total = self.sell_items(items)
        add_coins(user_id, total)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Sold farm items for {total} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Forged", style=discord.ButtonStyle.secondary, emoji="🛠️")
    async def sell_forged_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        items = self.get_category_items("Forged")
        if not items:
            await interaction.followup.send("No forged items to sell.", ephemeral=True)
            return
        total = self.sell_items(items)
        add_coins(user_id, total)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Sold forged items for {total} coins.\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Cooked", style=discord.ButtonStyle.primary, emoji="🍞")
    async def sell_cooked_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        items = self.get_category_items("Cooked")
        if not items:
            await interaction.followup.send("No cooked items to sell.", ephemeral=True)
            return
        total = self.sell_items(items)
        add_coins(user_id, total)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Sold cooked items for {total} coins.\n**Your coins: {coins}**", ephemeral=True)


class StoreView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

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

    @discord.ui.button(label="Ship (40000 coins)", style=discord.ButtonStyle.primary, emoji="🚢", custom_id="store_ship")
    async def ship_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["boat"] == 0:
            await interaction.response.send_message("You must buy a Boat first.", ephemeral=True)
            return
        if upgrades["ship"] == 1:
            await interaction.response.send_message("You already own a Ship.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < SHIP_UNLOCK_COST:
            await interaction.response.send_message(f"Need {SHIP_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, SHIP_UNLOCK_COST)
        set_upgrade(user_id, "ship_owned", 1)
        await interaction.response.defer()
        view = build_store_view(user_id)
        await interaction.edit_original_response(view=view)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Ship purchased! You can now catch 10-15 fish.\n**Your coins: {coins}**", ephemeral=True)

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
        increment_quest_progress(user_id, "buy_fortune_candy", 1)
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


class CookBakeryView(View):
    def __init__(self, user_id, chef_owned):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.chef_owned = chef_owned

    async def process_cooking(self, interaction, result_name):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        recipe = COOKED_ITEMS[result_name]
        inv = get_inventory(user_id)
        ing = recipe["ingredient"]
        needed = recipe["amount"]
        max_batch = inv.count(ing) // needed
        if max_batch == 0:
            await interaction.followup.send(f"You need at least {needed} {ing}.", ephemeral=True)
            return

        total_cost = 0
        if self.chef_owned:
            count = max_batch
            upgrades = get_upgrades(user_id)
            current_cook_count = upgrades["chef_cook_count"]
            new_total = current_cook_count + count
            payments_due = new_total // 10
            total_cost = payments_due * 50
            if total_cost > 0:
                coins = get_coins(user_id)
                if coins < total_cost:
                    await interaction.followup.send(
                        f"You need {total_cost} coins to pay the Chef for {count} items.",
                        ephemeral=True
                    )
                    return
                remove_coins(user_id, total_cost)
            set_upgrade(user_id, "chef_cook_count", new_total % 10)
        else:
            count = 1

        remove_items_by_name(user_id, ing, count * needed)
        add_items_bulk(user_id, result_name, count)
        if result_name == "🍞 Bread":
            increment_quest_progress(user_id, "bake_bread", count)
        elif result_name == "🥔 Boiled Potato":
            increment_quest_progress(user_id, "cook_boiled_potato", count)

        payment_info = f"\nChef paid for {total_cost} coins" if total_cost > 0 else ""
        await interaction.followup.send(
            f"Cooked {count}x {result_name}.{payment_info}",
            ephemeral=True
        )

    @discord.ui.button(label="Bread (3 Wheat)", style=discord.ButtonStyle.primary, emoji="🍞")
    async def bread_button(self, interaction: discord.Interaction, button: Button):
        await self.process_cooking(interaction, "🍞 Bread")

    @discord.ui.button(label="Carrot Soup (4 Carrot)", style=discord.ButtonStyle.secondary, emoji="🍲")
    async def carrot_soup_button(self, interaction: discord.Interaction, button: Button):
        await self.process_cooking(interaction, "🍲 Carrot Soup")

    @discord.ui.button(label="Boiled Potato (2 Potato)", style=discord.ButtonStyle.success, emoji="🥔")
    async def boiled_potato_button(self, interaction: discord.Interaction, button: Button):
        await self.process_cooking(interaction, "🥔 Boiled Potato")

    @discord.ui.button(label="Fried Carp (1 Common Carp)", style=discord.ButtonStyle.primary, emoji="🐟")
    async def fried_carp_button(self, interaction: discord.Interaction, button: Button):
        await self.process_cooking(interaction, "🐟 Fried Carp")


class FarmView(View):
    def __init__(self, user_id, ready_to_harvest):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.ready_to_harvest = ready_to_harvest
        self.harvest_button.disabled = not ready_to_harvest
        inv = get_inventory(user_id)
        self.watering_can_count = inv.count("🪣 Watering Can")
        self.has_unlimited_can = has_unlimited_watering_can(user_id)
        if (self.watering_can_count > 0 or self.has_unlimited_can) and not ready_to_harvest:
            self.add_item(Button(label="Use Watering Can", style=discord.ButtonStyle.primary, emoji="🪣", custom_id="use_watering_can"))

    @discord.ui.button(label="Plant", style=discord.ButtonStyle.primary, emoji="🌱")
    async def plant_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        seeds = [item for item in inv if item in SEED_TYPES]
        if not seeds:
            await interaction.response.send_message("You don't have any seeds. Buy some from the Farm Shop.", ephemeral=True)
            return
        seed_types = list(set(seeds))
        view = SeedSelectView(user_id, seed_types)
        await interaction.response.send_message("Select a seed to plant:", view=view, ephemeral=True)

    @discord.ui.button(label="Harvest", style=discord.ButtonStyle.success, emoji="🌾")
    async def harvest_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["farmer_count"] == 0:
            await interaction.response.send_message("You need a Farmer to harvest. Hire from the Village.", ephemeral=True)
            return
        planted_seed = upgrades["planted_seed"]
        if not planted_seed or not self.ready_to_harvest:
            await interaction.response.send_message("Nothing ready to harvest.", ephemeral=True)
            return
        farmer_count = upgrades["farmer_count"]
        if farmer_count > 0:
            harvest_count = upgrades["farmer_harvest_count"] + 1
            if harvest_count >= 3:
                farmer_cost = FARMER_HIRE_COST
                coins = get_coins(user_id)
                if coins < farmer_cost:
                    await interaction.response.send_message(f"Need {farmer_cost} coins to pay the Farmer.", ephemeral=True)
                    return
                remove_coins(user_id, farmer_cost)
                set_upgrade(user_id, "farmer_harvest_count", 0)
            else:
                set_upgrade(user_id, "farmer_harvest_count", harvest_count)
        seed_info = SEED_TYPES.get(planted_seed)
        if not seed_info:
            await interaction.response.send_message("Error: unknown crop.", ephemeral=True)
            return
        yield_item = seed_info["yield"]
        num_yield = seed_info["count"]
        for _ in range(num_yield):
            add_item(user_id, yield_item)
        if planted_seed == "🌾 Wheat Seed":
            increment_quest_progress(user_id, "harvest_wheat", num_yield)
        set_upgrade(user_id, "planted_seed", None)
        set_upgrade(user_id, "planted_at", None)
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Harvested {num_yield} {yield_item}!\n**Your coins: {coins}**", ephemeral=True)

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.data.get("custom_id") == "use_watering_can":
            await self.use_watering_can(interaction)
            return True
        return True

    async def use_watering_can(self, interaction: discord.Interaction):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        planted_seed = upgrades["planted_seed"]
        if not planted_seed:
            await interaction.response.send_message("Nothing planted.", ephemeral=True)
            return
        inv = get_inventory(user_id)
        if not has_unlimited_watering_can(user_id) and "🪣 Watering Can" not in inv:
            await interaction.response.send_message("You don't have a Watering Can.", ephemeral=True)
            return
        if has_unlimited_watering_can(user_id):
            pass
        else:
            remove_items_by_name(user_id, "🪣 Watering Can", 1)
        current_at = upgrades["planted_at"]
        new_at = min(current_at + 60, time.time())
        set_upgrade(user_id, "planted_at", new_at)
        await interaction.response.defer()
        self.watering_can_count = get_inventory(user_id).count("🪣 Watering Can")
        self.has_unlimited_can = has_unlimited_watering_can(user_id)
        if self.watering_can_count == 0 and not self.has_unlimited_can:
            for child in self.children:
                if child.custom_id == "use_watering_can":
                    self.remove_item(child)
        await interaction.followup.send("Watering Can used! Skipped 1 minute.", ephemeral=True)


class SeedSelectView(View):
    def __init__(self, user_id, seeds):
        super().__init__(timeout=60)
        self.user_id = user_id
        for seed in seeds:
            self.add_item(SeedButton(user_id, seed))


class SeedButton(Button):
    def __init__(self, user_id, seed):
        label = f"{seed} ({SEED_TYPES[seed]['price']} coins)"
        super().__init__(label=label, style=discord.ButtonStyle.primary)
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
        farmer_count = upgrades["farmer_count"]
        effective_duration = get_effective_duration(seed, farmer_count)
        mins = int(effective_duration // 60)
        await interaction.response.send_message(f"{seed} planted! It will be ready in {mins} minutes with your {farmer_count} farmer(s).", ephemeral=True)


class ChoicesView(View):
    def __init__(self, user_id, upgrades):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.upgrades = upgrades

    @discord.ui.button(label="Boat or Ship", style=discord.ButtonStyle.primary)
    async def boat_ship_toggle(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["ship"]:
            set_upgrade(user_id, "ship_owned", 0)
            set_upgrade(user_id, "boat_owned", 1)
            await interaction.response.send_message("Switched to Boat.", ephemeral=True)
        elif upgrades["boat"]:
            set_upgrade(user_id, "boat_owned", 0)
            if upgrades["ship"] == 0:
                set_upgrade(user_id, "ship_owned", 1)
            await interaction.response.send_message("Switched to Ship.", ephemeral=True)
        else:
            await interaction.response.send_message("You don't own any vehicle.", ephemeral=True)

    @discord.ui.button(label="Miner Machine", style=discord.ButtonStyle.secondary)
    async def miner_machine_toggle(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if not upgrades["miner_machine"]:
            await interaction.response.send_message("You don't own a Miner Machine.", ephemeral=True)
            return
        new_state = 1 if not upgrades["miner_machine_active"] else 0
        set_upgrade(user_id, "miner_machine_active", new_state)
        state_text = "Active" if new_state else "Inactive"
        await interaction.response.send_message(f"Miner Machine is now {state_text}.", ephemeral=True)


class FarmShopView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Watering Can (5000 coins)", style=discord.ButtonStyle.primary, emoji="🪣")
    async def watering_can_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        coins = get_coins(user_id)
        if coins < WATERING_CAN_PRICE:
            await interaction.response.send_message(f"Need {WATERING_CAN_PRICE} coins.", ephemeral=True)
            return
        remove_coins(user_id, WATERING_CAN_PRICE)
        add_item(user_id, "🪣 Watering Can")
        coins = get_coins(user_id)
        await interaction.response.send_message(f"Watering Can bought!\n**Your coins: {coins}**", ephemeral=True)

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
        await interaction.response.send_message(f"Bought 9 Wheat Seeds!\n**Your coins: {coins}**", ephemeral=True)

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
        await interaction.response.send_message(f"Bought 9 Carrot Seeds!\n**Your coins: {coins}**", ephemeral=True)

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
        await interaction.response.send_message(f"Bought 9 Potato Seeds!\n**Your coins: {coins}**", ephemeral=True)


async def life_command(interaction: discord.Interaction):
    init_db()
    user_id = interaction.user.id

    if user_id in active_life_sessions:
        old_channel_id, old_msg_id = active_life_sessions[user_id]
        channel = interaction.client.get_channel(old_channel_id)
        if channel:
            try:
                old_msg = await channel.fetch_message(old_msg_id)
                await old_msg.delete()
            except (discord.NotFound, discord.Forbidden):
                pass
        del active_life_sessions[user_id]

    await interaction.response.defer(ephemeral=False)
    view = MainLifeView(guild=interaction.guild)
    tip = random.choice(HOME_TIPS)
    content = (
        "# Home\n"
        "Choose an activity to begin your adventure\n\n"
        "🎣 **Fishing**: Cast your line and see what bites.\n"
        "⛏️ **Mining**: Dig deep for valuable ores and gems.\n"
        "🌾 **Farming**: Tend your crops and harvest rewards.\n\n"
    ) + tip
    msg = await interaction.followup.send(content, view=view)
    active_life_sessions[user_id] = (interaction.channel_id, msg.id)