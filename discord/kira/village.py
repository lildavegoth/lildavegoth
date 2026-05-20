import json
import sqlite3
import discord
from discord.ui import View, Button
import time
import random
from life_data import (
    init_db, get_coins, add_coins, remove_coins,
    add_item, get_inventory, get_upgrades, set_upgrade,
    remove_items_by_name,
    add_market_listing, get_market_listings_by_item,
    get_all_market_listings, remove_market_listing,
    get_royal_hall_offers, insert_royal_hall_offers,
    generate_daily_quests, get_daily_quests,
    get_player_quests, set_player_quest_slot,
    refresh_quests_allowed, set_quest_refreshed,
    increment_quest_progress, claim_quests,
    fire_worker,
    has_purchased_royal_hall_item, add_royal_hall_purchase
)

with open("/home/container/data/game_data.json", "r", encoding="utf-8") as f:
    DATA = json.load(f)

FARMER_MAX = DATA["FARMER_MAX"]
HELPER_MAX_LEVEL = DATA["HELPER_MAX_LEVEL"]
FARMER_HIRE_COST = DATA["FARMER_HIRE_COST"]
FISHING_HELPER_COST = DATA["FISHING_HELPER_COST"]
CHEF_HIRE_COST = DATA["CHEF_HIRE_COST"]
FARM_UNLOCK_COST = DATA["FARM_UNLOCK_COST"]

MARKET_SELLABLE_ITEMS = DATA["MARKET_SELLABLE_ITEMS"]
EMBLEM_REWARDS = DATA["EMBLEM_REWARDS"]
ROYAL_HALL_ITEMS_LIST = DATA["ROYAL_HALL_ITEMS_LIST"]
ROYAL_HALL_PRICES = DATA["ROYAL_HALL_PRICES"]

FISHING_HELPER_CHARGE_PER_HELPER = DATA["FISHING_HELPER_CHARGE_PER_HELPER"]
FARMER_HIRE_CHARGE = FARMER_HIRE_COST
CHEF_CHARGE_PER_10_ITEMS = 50
FISHERMAN_HIRE_COST = 50
SECOND_FARMLAND_COST = 500000


class VillageView(View):
    def __init__(self, user_id, upgrades):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.upgrades = upgrades
        self.buy_farmland_button.disabled = upgrades["farm"] == 1
        self.buy_second_farmland_button.disabled = (upgrades["farm"] == 0 or upgrades["farm2_owned"] == 1)
        self.repair_button.disabled = (upgrades["boat"] == 1 or upgrades["ship"] == 1)

    @discord.ui.button(label="Buy Farmland (450000 coins)", style=discord.ButtonStyle.success, emoji="🌾")
    async def buy_farmland_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        if self.upgrades["farm"] == 1:
            await interaction.response.send_message("You already own a Farmland.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FARM_UNLOCK_COST:
            await interaction.response.send_message(f"Need {FARM_UNLOCK_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FARM_UNLOCK_COST)
        set_upgrade(user_id, "farm_owned", 1)
        self.upgrades["farm"] = 1
        self.buy_farmland_button.disabled = True
        self.buy_second_farmland_button.disabled = False
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Farmland purchased!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Buy Second Farmland (500000 coins)", style=discord.ButtonStyle.success, emoji="🏞️")
    async def buy_second_farmland_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        if self.upgrades["farm"] == 0:
            await interaction.response.send_message("You need to buy the first Farmland first.", ephemeral=True)
            return
        if self.upgrades["farm2_owned"] == 1:
            await interaction.response.send_message("You already own the Second Farmland.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < SECOND_FARMLAND_COST:
            await interaction.response.send_message(f"Need {SECOND_FARMLAND_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, SECOND_FARMLAND_COST)
        set_upgrade(user_id, "farm2_owned", 1)
        self.upgrades["farm2_owned"] = 1
        self.buy_second_farmland_button.disabled = True
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Second Farmland purchased!\n**Your coins: {coins}**", ephemeral=True)

    @discord.ui.button(label="Repair Boat", style=discord.ButtonStyle.secondary, emoji="🔧")
    async def repair_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        upgrades = get_upgrades(user_id)
        if upgrades["boat"] == 1 or upgrades["ship"] == 1:
            await interaction.response.send_message("Your vehicle is not broken.", ephemeral=True)
            return
        set_upgrade(user_id, "boat_owned", 1)
        set_upgrade(user_id, "boat_durability", 0)
        self.upgrades["boat"] = 1
        self.upgrades["boat_durability"] = 0
        self.repair_button.disabled = True
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        await interaction.followup.send("Boat repaired!", ephemeral=True)

    @discord.ui.button(label="Blacksmith", style=discord.ButtonStyle.secondary, emoji="🛠️")
    async def blacksmith_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        jewel_count = sum(1 for item in inv if item == "💎 Jewel")
        view = BlacksmithView(user_id)
        msg = (
            "# Blacksmith\n"
            "Here you can forge various kinds of goods that can be resold on the Market\n\n"
            f"**Materials: {ore_count} ores, {jewel_count} jewels**"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Hire", style=discord.ButtonStyle.secondary, emoji="🤝")
    async def hire_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        upgrades = self.upgrades
        view = HireView(user_id, upgrades)
        msg = (
            "# Hire\n"
            "Hire staff and helper to help you for quality of life\n"
            "# Informations →\n"
            f"* Fishing Helper will get paid every 5 fishing trips for {FISHING_HELPER_CHARGE_PER_HELPER} coins each. If you have 3 Helpers, you need to pay 3 of them.\n"
            f"* Chef will get paid every 10 items cooked (50 coins).\n"
            f"* Farmer will get paid every 3 harvests for {FARMER_HIRE_COST} coins each.\n"
            f"* Fisherman will automatically fish 10 times for you when you click Fish."
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Quests", style=discord.ButtonStyle.primary, emoji="📜")
    async def quests_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
        generate_daily_quests(today)
        quests = get_daily_quests(today)
        upgrades = get_upgrades(user_id)
        pq = get_player_quests(user_id, today)
        can_refresh = refresh_quests_allowed(user_id, today) and not pq["claimed"] and pq["q1"] is None and pq["q2"] is None and pq["q3"] is None
        view = QuestsView(user_id, today, quests, pq, upgrades, can_refresh)
        msg = "# Quests\nHey there! Ready to complete quests today?\n"
        for i, q in enumerate(quests):
            note = ""
            if q[6] == "farm" and not upgrades["farm"]:
                note = "\n    * You need to unlock Farmland first"
            elif q[6] == "mine" and not upgrades["mine"]:
                note = "\n    * You need to unlock Mine first"
            msg += f"{i+1}. {q[1]} ({q[3]} {q[2]}){note}\n"
        msg += "\n# Informations\nYou can only accept 3 quests per-day so choose wisely. Don't forget to collects your rewards if they already completed!"
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Village Market", style=discord.ButtonStyle.secondary, emoji="🏷️")
    async def village_market_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        view = VillageMarketView(user_id)
        msg = (
            "# Village Market\n"
            "Sell your Legendary items and get the King's Emblem\n"
            "# Sellable →\n"
            "* Sea Dragon\n"
            "* Deep Water Snake\n"
            "* Blue Whale\n"
            "* Shiny Jewel"
        )
        await interaction.followup.send(msg, view=view, ephemeral=True)

    @discord.ui.button(label="Royal Halls", style=discord.ButtonStyle.primary, emoji="🏰")
    async def royal_halls_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
        offers = get_royal_hall_offers(today)
        if not offers:
            items = random.sample(ROYAL_HALL_ITEMS_LIST, 3)
            offers = [(item, ROYAL_HALL_PRICES[item]) for item in items]
            insert_royal_hall_offers(today, offers)
        lines = [
            "# Royal Halls",
            f"What do you need my son? How much Emblems did you collect already?",
            ""
        ]
        for item_name, price in offers:
            lines.append(f"* {item_name} ({price} Emblems)")
        lines.append("")
        lines.append("# Informations →")
        lines.append("All the items will be available randomly everyday")
        upgrades = get_upgrades(user_id)
        emblems = upgrades["emblems"]
        lines.append(f"\n**Your Emblems: {emblems}**")
        view = RoyalHallsView(user_id, offers)
        await interaction.followup.send("\n".join(lines), view=view, ephemeral=True)


class HireView(View):
    def __init__(self, user_id, upgrades):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.upgrades = upgrades
        self.build_buttons()

    def build_buttons(self):
        self.clear_items()
        u = self.upgrades

        if u["farmer_count"] < FARMER_MAX:
            btn = Button(label="Hire Farmer (30 coins)", style=discord.ButtonStyle.primary, emoji="👨‍🌾")
            btn.callback = self.hire_farmer
            self.add_item(btn)
        else:
            self.add_item(Button(label="Hire Farmer (Max)", disabled=True, style=discord.ButtonStyle.secondary, emoji="👨‍🌾"))
        if u["farmer_count"] > 0:
            fire_btn = Button(label="Fire Farmer", style=discord.ButtonStyle.danger, emoji="🔥")
            fire_btn.callback = self.make_fire_callback("farmer")
            self.add_item(fire_btn)

        if u["helper"] < HELPER_MAX_LEVEL:
            btn = Button(label="Hire Fishing Helper (25 coins)", style=discord.ButtonStyle.secondary, emoji="🙋")
            btn.callback = self.hire_fishing_helper
            self.add_item(btn)
        else:
            self.add_item(Button(label="Hire Fishing Helper (Max)", disabled=True, style=discord.ButtonStyle.secondary, emoji="🙋"))
        if u["helper"] > 0:
            fire_btn = Button(label="Fire Fishing Helper", style=discord.ButtonStyle.danger, emoji="🔥")
            fire_btn.callback = self.make_fire_callback("fishing_helper")
            self.add_item(fire_btn)

        if u["chef"] == 0:
            btn = Button(label="Hire Chef (30 coins)", style=discord.ButtonStyle.primary, emoji="👨‍🍳")
            btn.callback = self.hire_chef
            self.add_item(btn)
        else:
            self.add_item(Button(label="Hire Chef (Hired)", disabled=True, style=discord.ButtonStyle.secondary, emoji="👨‍🍳"))
        if u["chef"] == 1:
            fire_btn = Button(label="Fire Chef", style=discord.ButtonStyle.danger, emoji="🔥")
            fire_btn.callback = self.make_fire_callback("chef")
            self.add_item(fire_btn)

        if u["fisherman_hired"] == 0:
            btn = Button(label="Hire Fisherman (50 coins)", style=discord.ButtonStyle.primary, emoji="🎣")
            btn.callback = self.hire_fisherman
            self.add_item(btn)
        else:
            self.add_item(Button(label="Hire Fisherman (Hired)", disabled=True, style=discord.ButtonStyle.secondary, emoji="🎣"))
        if u["fisherman_hired"] == 1:
            fire_btn = Button(label="Fire Fisherman", style=discord.ButtonStyle.danger, emoji="🔥")
            fire_btn.callback = self.make_fire_callback("fisherman")
            self.add_item(fire_btn)

    async def hire_farmer(self, interaction: discord.Interaction):
        user_id = self.user_id
        if self.upgrades["farmer_count"] >= FARMER_MAX:
            await interaction.response.send_message("You already have the maximum number of farmers.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FARMER_HIRE_COST:
            await interaction.response.send_message(f"Need {FARMER_HIRE_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FARMER_HIRE_COST)
        new_count = self.upgrades["farmer_count"] + 1
        set_upgrade(user_id, "farmer_count", new_count)
        self.upgrades["farmer_count"] = new_count
        self.build_buttons()
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Farmer hired! You now have {new_count} farmer(s).\n**Your coins: {coins}**", ephemeral=True)

    async def hire_fishing_helper(self, interaction: discord.Interaction):
        user_id = self.user_id
        if self.upgrades["helper"] >= HELPER_MAX_LEVEL:
            await interaction.response.send_message("You already have the maximum number of Fishing Helpers.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FISHING_HELPER_COST:
            await interaction.response.send_message(f"Need {FISHING_HELPER_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FISHING_HELPER_COST)
        new_level = self.upgrades["helper"] + 1
        set_upgrade(user_id, "helper_level", new_level)
        self.upgrades["helper"] = new_level
        self.build_buttons()
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Fishing Helper hired! You now have {new_level}.\n**Your coins: {coins}**", ephemeral=True)

    async def hire_chef(self, interaction: discord.Interaction):
        user_id = self.user_id
        if self.upgrades["chef"] == 1:
            await interaction.response.send_message("You already hired a Chef.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < CHEF_HIRE_COST:
            await interaction.response.send_message(f"Need {CHEF_HIRE_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, CHEF_HIRE_COST)
        set_upgrade(user_id, "chef_owned", 1)
        self.upgrades["chef"] = 1
        self.build_buttons()
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Chef hired! They will automatically cook all materials at once.\n**Your coins: {coins}**", ephemeral=True)

    async def hire_fisherman(self, interaction: discord.Interaction):
        user_id = self.user_id
        if self.upgrades["fisherman_hired"] == 1:
            await interaction.response.send_message("You already hired a Fisherman.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < FISHERMAN_HIRE_COST:
            await interaction.response.send_message(f"Need {FISHERMAN_HIRE_COST} coins.", ephemeral=True)
            return
        remove_coins(user_id, FISHERMAN_HIRE_COST)
        set_upgrade(user_id, "fisherman_hired", 1)
        self.upgrades["fisherman_hired"] = 1
        self.build_buttons()
        await interaction.response.defer()
        await interaction.edit_original_response(view=self)
        coins = get_coins(user_id)
        await interaction.followup.send(f"Fisherman hired! He will automatically fish for you.\n**Your coins: {coins}**", ephemeral=True)

    def make_fire_callback(self, worker_type):
        async def fire(interaction: discord.Interaction):
            user_id = self.user_id
            fire_worker(user_id, worker_type)
            self.upgrades = get_upgrades(user_id)
            self.build_buttons()
            await interaction.response.defer()
            await interaction.edit_original_response(view=self)
            await interaction.followup.send(f"{worker_type.replace('_', ' ').title()} has been fired.", ephemeral=True)
        return fire


class QuestsView(View):
    def __init__(self, user_id, date_str, quests, pq, upgrades, can_refresh):
        super().__init__(timeout=300)
        self.user_id = user_id
        self.date_str = date_str
        self.quests = quests
        self.pq = pq
        self.upgrades = upgrades
        self.can_refresh = can_refresh
        self.selected_count = sum(1 for i in [pq["q1"], pq["q2"], pq["q3"]] if i is not None)
        self.claimed = pq["claimed"]
        self.build_buttons()

    def build_buttons(self):
        inv = get_inventory(self.user_id)
        fish_counts = {item: inv.count(item) for item in ["🐟 Common Carp", "🦑 Squid", "🐡 Pufferfish", "🐠 Tropical Clownfish", "🐙 Octopus", "🦀 Crab"]}
        rock_count = inv.count("🪨 Rock")
        ore_count = inv.count("🔩 Ore")
        wheat_count = inv.count("🌾 Wheat")
        for slot, idx in enumerate([self.pq["q1"], self.pq["q2"], self.pq["q3"]], start=1):
            if idx is not None:
                q = self.quests[idx]
                q_type = q[7]
                if q_type == "harvest_wheat":
                    self.pq[f"p{slot}"] = wheat_count
                elif q_type == "mine_rocks":
                    self.pq[f"p{slot}"] = rock_count
                elif q_type == "mine_ores":
                    self.pq[f"p{slot}"] = ore_count
                elif q_type and q_type.startswith("catch_"):
                    fish_map = {
                        "catch_common_carp": "🐟 Common Carp",
                        "catch_squid": "🦑 Squid",
                        "catch_pufferfish": "🐡 Pufferfish",
                        "catch_tropical_clownfish": "🐠 Tropical Clownfish",
                        "catch_octopus": "🐙 Octopus",
                        "catch_crab": "🦀 Crab",
                    }
                    fish_name = fish_map.get(q_type, "")
                    self.pq[f"p{slot}"] = fish_counts.get(fish_name, 0)
        self.clear_items()
        if not self.claimed and self.selected_count < 3:
            for i, q in enumerate(self.quests):
                quest_index = q[0]
                already_selected = quest_index in [self.pq["q1"], self.pq["q2"], self.pq["q3"]]
                if already_selected:
                    btn = Button(label=f"Quest {i+1}: Selected", disabled=True, style=discord.ButtonStyle.success)
                else:
                    eligible = True
                    if q[6] == "farm" and not self.upgrades["farm"]:
                        eligible = False
                    elif q[6] == "mine" and not self.upgrades["mine"]:
                        eligible = False
                    if eligible:
                        btn = Button(label=f"Quest {i+1}: Select", style=discord.ButtonStyle.primary)
                        btn.callback = self.make_select_callback(quest_index)
                    else:
                        btn = Button(label=f"Quest {i+1}: Locked", disabled=True, style=discord.ButtonStyle.secondary)
                self.add_item(btn)
            if self.can_refresh:
                refresh_btn = Button(label="Refresh", style=discord.ButtonStyle.danger, emoji="🔄")
                refresh_btn.callback = self.refresh_callback
                self.add_item(refresh_btn)
        else:
            for i, q in enumerate(self.quests):
                quest_index = q[0]
                slot = None
                if self.pq["q1"] == quest_index: slot = 1
                elif self.pq["q2"] == quest_index: slot = 2
                elif self.pq["q3"] == quest_index: slot = 3
                if slot:
                    progress = self.pq[f"p{slot}"]
                    goal = q[2]
                    btn = Button(label=f"Quest {i+1}: {progress}/{goal}", disabled=True, style=discord.ButtonStyle.secondary)
                else:
                    btn = Button(label=f"Quest {i+1}: Not selected", disabled=True, style=discord.ButtonStyle.secondary)
                self.add_item(btn)
            if not self.claimed:
                claim_btn = Button(label="Claim Rewards", style=discord.ButtonStyle.success, emoji="🎁")
                claim_btn.callback = self.claim_callback
                self.add_item(claim_btn)

    def make_select_callback(self, quest_index):
        async def callback(interaction: discord.Interaction):
            user_id = self.user_id
            date_str = self.date_str
            selected_count = sum(1 for i in [self.pq["q1"], self.pq["q2"], self.pq["q3"]] if i is not None)
            if selected_count >= 3:
                await interaction.response.send_message("You already selected 3 quests.", ephemeral=True)
                return
            slot = None
            if self.pq["q1"] is None: slot = 1
            elif self.pq["q2"] is None: slot = 2
            elif self.pq["q3"] is None: slot = 3
            if slot is None:
                await interaction.response.send_message("Quests full.", ephemeral=True)
                return
            set_player_quest_slot(user_id, date_str, slot, quest_index)
            self.pq = get_player_quests(user_id, date_str)
            self.selected_count = sum(1 for i in [self.pq["q1"], self.pq["q2"], self.pq["q3"]] if i is not None)
            self.can_refresh = False
            self.build_buttons()
            await interaction.response.edit_message(view=self)
        return callback

    async def refresh_callback(self, interaction: discord.Interaction):
        user_id = self.user_id
        date_str = self.date_str
        if not refresh_quests_allowed(user_id, date_str):
            await interaction.response.send_message("You can only refresh once per day.", ephemeral=True)
            return
        generate_daily_quests(date_str)
        set_quest_refreshed(user_id, date_str)
        generate_daily_quests(date_str)
        self.quests = get_daily_quests(date_str)
        self.pq = get_player_quests(user_id, date_str)
        self.can_refresh = False
        self.selected_count = 0
        self.claimed = self.pq["claimed"]
        self.build_buttons()
        await interaction.response.edit_message(view=self)

    async def claim_callback(self, interaction: discord.Interaction):
        user_id = self.user_id
        date_str = self.date_str
        rewards = claim_quests(user_id, date_str)
        if not rewards:
            await interaction.response.send_message("No rewards to claim or quests not completed.", ephemeral=True)
            return
        for rtype, amount, item in rewards:
            if rtype == "coins":
                add_coins(user_id, amount)
            elif rtype == "emblems":
                upgrades = get_upgrades(user_id)
                set_upgrade(user_id, "emblems", upgrades["emblems"] + amount)
            elif rtype == "item" and item:
                for _ in range(amount):
                    add_item(user_id, item)
        self.pq = get_player_quests(user_id, date_str)
        self.claimed = True
        self.build_buttons()
        await interaction.response.edit_message(view=self)
        await interaction.followup.send("Rewards claimed!", ephemeral=True)


class VillageMarketView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Sell", style=discord.ButtonStyle.success, emoji="💰")
    async def sell_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        user_id = self.user_id
        inv = get_inventory(user_id)
        sellable = [item for item in inv if item in MARKET_SELLABLE_ITEMS]
        if not sellable:
            await interaction.followup.send("You have no legendary items to sell.", ephemeral=True)
            return
        view = SelectSellItemView(user_id, list(set(sellable)))
        await interaction.followup.send("Select an item to sell:", view=view, ephemeral=True)

    @discord.ui.button(label="Buy", style=discord.ButtonStyle.primary, emoji="🛒")
    async def buy_button(self, interaction: discord.Interaction, button: Button):
        await interaction.response.defer(ephemeral=True)
        all_listings = get_all_market_listings()
        if not all_listings:
            await interaction.followup.send("The Village Market is empty.", ephemeral=True)
            return
        view = PaginatedListingsView(self.user_id, all_listings)
        await interaction.followup.send(view.build_content(), view=view, ephemeral=True)


class SelectSellItemView(View):
    def __init__(self, user_id, items):
        super().__init__(timeout=60)
        self.user_id = user_id
        for item in items:
            self.add_item(SellItemButton(user_id, item))


class SellItemButton(Button):
    def __init__(self, user_id, item):
        super().__init__(label=item, style=discord.ButtonStyle.secondary)
        self.user_id = user_id
        self.item = item

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        view = PriceSetterView(self.user_id, self.item)
        await interaction.followup.send(view.build_content(), view=view, ephemeral=True)


class PriceSetterView(View):
    def __init__(self, user_id, item):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.item = item
        default_min = 1800000 if item == "🐉 Sea Dragon" else 400000 if item == "🐍 Deep Water Snake" else 300000 if item == "🐋 Blue Whale" else 400000
        self.price = default_min
        self.price_label = Button(label=f"{self.price} coins", disabled=True, style=discord.ButtonStyle.primary)

    def build_content(self):
        return f"Setting price for {self.item}\n* {self.price} coins"

    @discord.ui.button(label="+ 100,000", style=discord.ButtonStyle.success, emoji="⬆️")
    async def increase_button(self, interaction: discord.Interaction, button: Button):
        self.price += 100000
        self.price_label.label = f"{self.price} coins"
        await interaction.response.edit_message(content=self.build_content(), view=self)

    @discord.ui.button(label="- 100,000", style=discord.ButtonStyle.danger, emoji="⬇️")
    async def decrease_button(self, interaction: discord.Interaction, button: Button):
        self.price = max(0, self.price - 100000)
        self.price_label.label = f"{self.price} coins"
        await interaction.response.edit_message(content=self.build_content(), view=self)

    @discord.ui.button(label="Confirm", style=discord.ButtonStyle.primary, emoji="✅")
    async def confirm_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        item = self.item
        inv = get_inventory(user_id)
        if item not in inv:
            await interaction.response.send_message("You no longer own that item.", ephemeral=True)
            return
        remove_items_by_name(user_id, item, 1)
        add_market_listing(user_id, item, self.price)
        emb_amt = EMBLEM_REWARDS.get(item, 0)
        if emb_amt:
            upgrades = get_upgrades(user_id)
            set_upgrade(user_id, "emblems", upgrades["emblems"] + emb_amt)
        await interaction.response.send_message(f"Listed {item} for {self.price} coins. Received {emb_amt} King's Emblems.", ephemeral=True)
        self.stop()


class PaginatedListingsView(View):
    def __init__(self, user_id, listings):
        super().__init__(timeout=120)
        self.user_id = user_id
        self.listings = listings
        self.current_page = 0
        self.per_page = 10
        self.build_page()

    def get_page_listings(self):
        start = self.current_page * self.per_page
        end = start + self.per_page
        return self.listings[start:end]

    def build_content(self):
        total_pages = max(1, -(-len(self.listings) // self.per_page))
        msg = f"# Village Market Listings\nClick a listing to buy it:\nPage {self.current_page + 1}/{total_pages}\n"
        for lid, seller_id, item_name, price in self.get_page_listings():
            msg += f"* {item_name} — {price} coins (seller: <@{seller_id}>)\n"
        return msg

    def build_page(self):
        self.clear_items()
        page_listings = self.get_page_listings()
        for lid, seller_id, item_name, price in page_listings:
            label = f"{item_name} | {price} coins"
            self.add_item(ListingButton(self.user_id, lid, label))
        total_pages = max(1, -(-len(self.listings) // self.per_page))
        prev_btn = Button(label="Previous", style=discord.ButtonStyle.secondary, disabled=self.current_page == 0)
        prev_btn.callback = self.prev_callback
        next_btn = Button(label="Next", style=discord.ButtonStyle.secondary, disabled=self.current_page >= total_pages - 1)
        next_btn.callback = self.next_callback
        self.add_item(prev_btn)
        self.add_item(next_btn)

    async def prev_callback(self, interaction: discord.Interaction):
        self.current_page -= 1
        self.build_page()
        await interaction.response.edit_message(content=self.build_content(), view=self)

    async def next_callback(self, interaction: discord.Interaction):
        self.current_page += 1
        self.build_page()
        await interaction.response.edit_message(content=self.build_content(), view=self)

    async def update_after_purchase(self, interaction):
        all_listings = get_all_market_listings()
        if not all_listings:
            await interaction.response.edit_message(content="The Village Market is empty.", view=None)
            return
        self.listings = all_listings
        if self.current_page > 0 and self.current_page * self.per_page >= len(all_listings):
            self.current_page -= 1
        self.build_page()
        await interaction.response.edit_message(content=self.build_content(), view=self)


class ListingButton(Button):
    def __init__(self, user_id, listing_id, label):
        super().__init__(label=label, style=discord.ButtonStyle.primary)
        self.user_id = user_id
        self.listing_id = listing_id

    async def callback(self, interaction: discord.Interaction):
        user_id = self.user_id
        lid = self.listing_id
        conn = sqlite3.connect("life.db")
        row = conn.execute("SELECT id, seller_id, item_name, price FROM village_market WHERE id = ?", (lid,)).fetchone()
        conn.close()
        if not row:
            await interaction.response.send_message("This listing no longer exists.", ephemeral=True)
            return
        lid, seller_id, item_name, price = row
        if user_id == seller_id:
            await interaction.response.send_message("You can't buy your own listing.", ephemeral=True)
            return
        coins = get_coins(user_id)
        if coins < price:
            await interaction.response.send_message(f"You need {price} coins.", ephemeral=True)
            return
        remove_coins(user_id, price)
        add_coins(seller_id, price)
        add_item(user_id, item_name)
        remove_market_listing(lid)
        await interaction.response.send_message(f"You bought {item_name} for {price} coins.", ephemeral=True)
        for child in self.view.children:
            if isinstance(child, PaginatedListingsView) or hasattr(self.view, 'update_after_purchase'):
                await self.view.update_after_purchase(interaction)
                return


class RoyalHallsView(View):
    def __init__(self, user_id, offers):
        super().__init__(timeout=120)
        self.user_id = user_id
        for item_name, price in offers:
            already_owned = has_purchased_royal_hall_item(user_id, item_name)
            if already_owned:
                label = f"{item_name} (Owned)"
                btn = RoyalHallItemButton(user_id, item_name, price, disabled=True, label=label)
            else:
                label = f"{item_name} ({price} Emblems)"
                btn = RoyalHallItemButton(user_id, item_name, price, disabled=False, label=label)
            self.add_item(btn)


class RoyalHallItemButton(Button):
    def __init__(self, user_id, item_name, price, disabled=False, label=None):
        super().__init__(style=discord.ButtonStyle.success, emoji="🛡️", disabled=disabled)
        self.user_id = user_id
        self.item_name = item_name
        self.price = price
        if label:
            self.label = label

    async def callback(self, interaction: discord.Interaction):
        user_id = self.user_id
        if has_purchased_royal_hall_item(user_id, self.item_name):
            await interaction.response.send_message("You already own this item.", ephemeral=True)
            return
        upgrades = get_upgrades(user_id)
        if upgrades["emblems"] < self.price:
            await interaction.response.send_message(f"You need {self.price} King's Emblems.", ephemeral=True)
            return
        set_upgrade(user_id, "emblems", upgrades["emblems"] - self.price)
        add_item(user_id, self.item_name)
        add_royal_hall_purchase(user_id, self.item_name)
        await interaction.response.send_message(f"You received {self.item_name}.", ephemeral=True)


class BlacksmithView(View):
    def __init__(self, user_id):
        super().__init__(timeout=120)
        self.user_id = user_id

    @discord.ui.button(label="Accessories (40 ores + 2 jewels)", style=discord.ButtonStyle.primary, emoji="💍")
    async def accessories_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        jewel_count = sum(1 for item in inv if item == "💎 Jewel")
        if ore_count < 40 or jewel_count < 2:
            await interaction.response.send_message(f"Need 40 ores and 2 jewels (have {ore_count} ores, {jewel_count} jewels).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 40)
        remove_items_by_name(user_id, "💎 Jewel", 2)
        add_item(user_id, "💍 Accessories")
        await interaction.response.send_message("Accessories forged and added to your inventory.", ephemeral=True)

    @discord.ui.button(label="Iron Sword (30 ores)", style=discord.ButtonStyle.secondary, emoji="⚔️")
    async def iron_sword_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        if ore_count < 30:
            await interaction.response.send_message(f"Need 30 ores (have {ore_count}).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 30)
        add_item(user_id, "⚔️ Iron Sword")
        increment_quest_progress(user_id, "forge_weapons", 1)
        await interaction.response.send_message("Iron Sword forged and added to your inventory.", ephemeral=True)

    @discord.ui.button(label="Iron Armor (35 ores)", style=discord.ButtonStyle.success, emoji="🛡️")
    async def iron_armor_button(self, interaction: discord.Interaction, button: Button):
        user_id = self.user_id
        inv = get_inventory(user_id)
        ore_count = sum(1 for item in inv if item == "🔩 Ore")
        if ore_count < 35:
            await interaction.response.send_message(f"Need 35 ores (have {ore_count}).", ephemeral=True)
            return
        remove_items_by_name(user_id, "🔩 Ore", 35)
        add_item(user_id, "🛡️ Iron Armor")
        await interaction.response.send_message("Iron Armor forged and added to your inventory.", ephemeral=True)