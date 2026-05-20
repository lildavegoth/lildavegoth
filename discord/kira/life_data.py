import sqlite3
import time
import random
import json
import os

DB_PATH = "/home/container/data/life.db"

with open("/home/container/data/game_data.json", "r", encoding="utf-8") as f:
    _GAME_DATA = json.load(f)

FISH_TYPES = _GAME_DATA["FISH_TYPES"]

def init_db():
    os.makedirs("/home/container/data", exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS life_coins (user_id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0)")
        conn.execute("CREATE TABLE IF NOT EXISTS life_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, fish_name TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS life_upgrades (user_id TEXT PRIMARY KEY, better_skill_level INTEGER DEFAULT 0, rod_level INTEGER DEFAULT 1, helper_level INTEGER DEFAULT 0, boat_owned INTEGER DEFAULT 0, ship_owned INTEGER DEFAULT 0, fortune_candy_until REAL DEFAULT 0, mine_owned INTEGER DEFAULT 0, pickaxe_level INTEGER DEFAULT 1, mine_level INTEGER DEFAULT 0, miner_machine_owned INTEGER DEFAULT 0, miner_machine_next REAL DEFAULT 0, miner_machine_active INTEGER DEFAULT 1, farm_owned INTEGER DEFAULT 0, farmer_count INTEGER DEFAULT 0, chef_owned INTEGER DEFAULT 0, chef_cook_count INTEGER DEFAULT 0, farmer_harvest_count INTEGER DEFAULT 0, fishing_helper_count INTEGER DEFAULT 0, emblems INTEGER DEFAULT 0, planted_seed TEXT, planted_at REAL, achievement_legendary_fisherman INTEGER DEFAULT 0, achievement_richer_than_ever INTEGER DEFAULT 0, achievement_kings_lover INTEGER DEFAULT 0, boat_durability INTEGER DEFAULT 0, ship_durability INTEGER DEFAULT 0, fisherman_hired INTEGER DEFAULT 0, fisherman_fishing_count INTEGER DEFAULT 0, farm2_owned INTEGER DEFAULT 0, equip_weapon TEXT, equip_armor TEXT, equip_offhand TEXT, equip_buff TEXT, equip_pet TEXT, health INTEGER DEFAULT 5000, mana INTEGER DEFAULT 500)")
        conn.execute("CREATE TABLE IF NOT EXISTS village_market (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT, item_name TEXT, price INTEGER)")
        conn.execute("CREATE TABLE IF NOT EXISTS royal_hall (date TEXT, item_name TEXT, price INTEGER)")
        conn.execute("CREATE TABLE IF NOT EXISTS daily_quests (date TEXT, quest_index INTEGER, quest_name TEXT, goal INTEGER, reward_type TEXT, reward_amount INTEGER, reward_item TEXT, requirement TEXT, quest_type TEXT, PRIMARY KEY(date, quest_index))")
        conn.execute("CREATE TABLE IF NOT EXISTS player_quests (user_id TEXT, date TEXT, q1 INTEGER, q2 INTEGER, q3 INTEGER, p1 INTEGER DEFAULT 0, p2 INTEGER DEFAULT 0, p3 INTEGER DEFAULT 0, claimed INTEGER DEFAULT 0, refreshed INTEGER DEFAULT 0, PRIMARY KEY(user_id, date))")
        conn.execute("CREATE TABLE IF NOT EXISTS royal_hall_purchases (user_id TEXT, item_name TEXT, PRIMARY KEY(user_id, item_name))")

        inventory_cols = [row[1] for row in conn.execute("PRAGMA table_info(life_inventory)").fetchall()]
        if "item_name" not in inventory_cols:
            conn.execute("ALTER TABLE life_inventory ADD COLUMN item_name TEXT")
            conn.execute("UPDATE life_inventory SET item_name = fish_name WHERE item_name IS NULL AND fish_name IS NOT NULL")

        upgrades_cols = [row[1] for row in conn.execute("PRAGMA table_info(life_upgrades)").fetchall()]
        for col, default in [
            ("rod_level", "INTEGER DEFAULT 1"),
            ("helper_level", "INTEGER DEFAULT 0"),
            ("boat_owned", "INTEGER DEFAULT 0"),
            ("ship_owned", "INTEGER DEFAULT 0"),
            ("fortune_candy_until", "REAL DEFAULT 0"),
            ("mine_owned", "INTEGER DEFAULT 0"),
            ("pickaxe_level", "INTEGER DEFAULT 1"),
            ("mine_level", "INTEGER DEFAULT 0"),
            ("miner_machine_owned", "INTEGER DEFAULT 0"),
            ("miner_machine_next", "REAL DEFAULT 0"),
            ("miner_machine_active", "INTEGER DEFAULT 1"),
            ("farm_owned", "INTEGER DEFAULT 0"),
            ("farmer_count", "INTEGER DEFAULT 0"),
            ("chef_owned", "INTEGER DEFAULT 0"),
            ("chef_cook_count", "INTEGER DEFAULT 0"),
            ("farmer_harvest_count", "INTEGER DEFAULT 0"),
            ("fishing_helper_count", "INTEGER DEFAULT 0"),
            ("emblems", "INTEGER DEFAULT 0"),
            ("planted_seed", "TEXT"),
            ("planted_at", "REAL"),
            ("achievement_legendary_fisherman", "INTEGER DEFAULT 0"),
            ("achievement_richer_than_ever", "INTEGER DEFAULT 0"),
            ("achievement_kings_lover", "INTEGER DEFAULT 0"),
            ("boat_durability", "INTEGER DEFAULT 0"),
            ("ship_durability", "INTEGER DEFAULT 0"),
            ("fisherman_hired", "INTEGER DEFAULT 0"),
            ("fisherman_fishing_count", "INTEGER DEFAULT 0"),
            ("farm2_owned", "INTEGER DEFAULT 0"),
            ("equip_weapon", "TEXT"),
            ("equip_armor", "TEXT"),
            ("equip_offhand", "TEXT"),
            ("equip_buff", "TEXT"),
            ("equip_pet", "TEXT"),
            ("health", "INTEGER DEFAULT 5000"),
            ("mana", "INTEGER DEFAULT 500"),
            ("green_thumb", "INTEGER DEFAULT 0"),
            ("lucky_pickaxe", "INTEGER DEFAULT 0"),
        ]:
            if col not in upgrades_cols:
                conn.execute(f"ALTER TABLE life_upgrades ADD COLUMN {col} {default}")

        if "equip_offhand" in upgrades_cols and "equip_off-hand" in upgrades_cols:
            conn.execute("ALTER TABLE life_upgrades DROP COLUMN \"equip_off-hand\"")

        player_cols = [row[1] for row in conn.execute("PRAGMA table_info(player_quests)").fetchall()]
        if "refreshed" not in player_cols:
            conn.execute("ALTER TABLE player_quests ADD COLUMN refreshed INTEGER DEFAULT 0")

        conn.execute("UPDATE life_upgrades SET rod_level = 1 WHERE rod_level = 0")
        conn.execute("UPDATE life_upgrades SET pickaxe_level = 1 WHERE pickaxe_level = 0")
        conn.execute("UPDATE life_upgrades SET mine_level = 1 WHERE mine_owned = 1 AND mine_level = 0")
        conn.commit()

def get_coins(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT coins FROM life_coins WHERE user_id = ?", (str(user_id),)).fetchone()
    return row[0] if row else 0

def add_coins(user_id, amount):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO life_coins (user_id, coins) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET coins = coins + ?", (str(user_id), amount, amount))
        conn.commit()

def remove_coins(user_id, amount):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE life_coins SET coins = coins - ? WHERE user_id = ?", (amount, str(user_id)))
        conn.commit()

def add_item(user_id, item_name):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO life_inventory (user_id, item_name) VALUES (?, ?)", (str(user_id), item_name))
        conn.commit()

def add_items_bulk(user_id, item_name, count):
    with sqlite3.connect(DB_PATH) as conn:
        conn.executemany(
            "INSERT INTO life_inventory (user_id, item_name) VALUES (?, ?)",
            [(str(user_id), item_name)] * count
        )
        conn.commit()

def get_inventory(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT item_name FROM life_inventory WHERE user_id = ?", (str(user_id),)).fetchall()
    return [row[0] for row in rows]

def get_inventory_count(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT COUNT(*) FROM life_inventory WHERE user_id = ?", (str(user_id),)).fetchone()
    return row[0] if row else 0

def clear_inventory(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM life_inventory WHERE user_id = ?", (str(user_id),))
        conn.commit()

def remove_items_by_name(user_id, item_name, count):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM life_inventory WHERE id IN (SELECT id FROM life_inventory WHERE user_id = ? AND item_name = ? LIMIT ?)", (str(user_id), item_name, count))
        conn.commit()

def get_upgrades(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT better_skill_level, rod_level, helper_level, boat_owned, ship_owned, fortune_candy_until, mine_owned, pickaxe_level, mine_level, miner_machine_owned, miner_machine_next, miner_machine_active, farm_owned, farmer_count, chef_owned, chef_cook_count, farmer_harvest_count, fishing_helper_count, emblems, planted_seed, planted_at, achievement_legendary_fisherman, achievement_richer_than_ever, achievement_kings_lover, boat_durability, ship_durability, fisherman_hired, fisherman_fishing_count, farm2_owned, equip_weapon, equip_armor, equip_offhand, equip_buff, equip_pet, health, mana FROM life_upgrades WHERE user_id = ?", (str(user_id),)).fetchone()
    keys = [
        "better_fishing", "rod", "helper", "boat", "ship",
        "fortune_candy", "mine", "pickaxe", "mine_level",
        "miner_machine", "miner_machine_next", "miner_machine_active",
        "farm", "farmer_count", "chef", "chef_cook_count",
        "farmer_harvest_count", "fishing_helper_count", "emblems",
        "planted_seed", "planted_at",
        "legendary_fisherman", "richer_than_ever", "kings_lover",
        "boat_durability", "ship_durability", "fisherman_hired",
        "fisherman_fishing_count", "farm2_owned",
        "equip_weapon", "equip_armor", "equip_offhand", "equip_buff", "equip_pet",
        "health", "mana"
    ]
    if row:
        return {key: val for key, val in zip(keys, row)}
    return {
        "better_fishing": 0, "rod": 1, "helper": 0,
        "boat": 0, "ship": 0, "fortune_candy": 0,
        "mine": 0, "pickaxe": 1, "mine_level": 0,
        "miner_machine": 0, "miner_machine_next": 0,
        "miner_machine_active": 1, "farm": 0,
        "farmer_count": 0, "chef": 0, "chef_cook_count": 0,
        "farmer_harvest_count": 0, "fishing_helper_count": 0,
        "emblems": 0,
        "planted_seed": None, "planted_at": None,
        "legendary_fisherman": 0, "richer_than_ever": 0, "kings_lover": 0,
        "boat_durability": 0, "ship_durability": 0,
        "fisherman_hired": 0, "fisherman_fishing_count": 0, "farm2_owned": 0,
        "equip_weapon": None, "equip_armor": None,
        "equip_offhand": None, "equip_buff": None, "equip_pet": None,
        "health": 5000, "mana": 500
    }

def set_upgrade(user_id, field, value):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(f"INSERT INTO life_upgrades (user_id, {field}) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET {field} = ?", (str(user_id), value, value))
        conn.commit()

def process_miner_machine(user_id):
    upgrades = get_upgrades(user_id)
    if not upgrades["miner_machine"] or not upgrades["miner_machine_active"]:
        return
    now = time.time()
    if now < upgrades["miner_machine_next"]:
        return
    rocks = random.randint(1, 5)
    ores = 0
    jewel = 0
    shiny_jewel = 0
    if random.random() < 0.15:
        ores += random.randint(1, 2)
    if random.random() < 0.05:
        jewel += 1
    if upgrades["mine_level"] >= 3 and upgrades["pickaxe"] >= 3 and random.random() < 0.02:
        shiny_jewel += random.randint(1, 2)
    for _ in range(rocks):
        add_item(user_id, "🪨 Rock")
    for _ in range(ores):
        add_item(user_id, "🔩 Ore")
    for _ in range(jewel):
        add_item(user_id, "💎 Jewel")
    for _ in range(shiny_jewel):
        add_item(user_id, "💠 Shiny Jewel")
    next_time = now + 3600
    set_upgrade(user_id, "miner_machine_next", next_time)
    return rocks, ores, jewel, shiny_jewel

def add_market_listing(seller_id, item_name, price):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO village_market (seller_id, item_name, price) VALUES (?, ?, ?)", (str(seller_id), item_name, price))
        conn.commit()

def get_market_listings_by_item(item_name):
    with sqlite3.connect(DB_PATH) as conn:
        return conn.execute("SELECT id, seller_id, item_name, price FROM village_market WHERE item_name = ? ORDER BY price ASC", (item_name,)).fetchall()

def get_all_market_listings():
    with sqlite3.connect(DB_PATH) as conn:
        return conn.execute("SELECT id, seller_id, item_name, price FROM village_market ORDER BY id DESC").fetchall()

def remove_market_listing(listing_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM village_market WHERE id = ?", (listing_id,))
        conn.commit()

def get_royal_hall_offers(date_str):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT item_name, price FROM royal_hall WHERE date = ?", (date_str,)).fetchall()
    return rows

def insert_royal_hall_offers(date_str, offers):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM royal_hall WHERE date = ?", (date_str,))
        for item_name, price in offers:
            conn.execute("INSERT INTO royal_hall (date, item_name, price) VALUES (?, ?, ?)", (date_str, item_name, price))
        conn.commit()

def has_purchased_royal_hall_item(user_id, item_name):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT 1 FROM royal_hall_purchases WHERE user_id = ? AND item_name = ?", (str(user_id), item_name)).fetchone()
        return row is not None

def add_royal_hall_purchase(user_id, item_name):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT OR IGNORE INTO royal_hall_purchases (user_id, item_name) VALUES (?, ?)", (str(user_id), item_name))
        conn.commit()

def generate_daily_quests(date_str):
    with sqlite3.connect(DB_PATH) as conn:
        existing = conn.execute("SELECT COUNT(*) FROM daily_quests WHERE date = ?", (date_str,)).fetchone()[0]
        if existing > 0:
            return
        ALL_QUESTS = [
            ("Harvest 9 Wheat", 9, "item", 18, "🌾 Wheat Seed", "farm", "harvest_wheat"),
            ("Mine 50 Rocks", 50, "coins", 500, None, "mine", "mine_rocks"),
            ("Catch 10 Common Carp", 10, "coins", 25, None, None, "catch_common_carp"),
            ("Catch 5 Squid", 5, "coins", 25, None, None, "catch_squid"),
            ("Catch 3 Tropical Clownfish", 3, "coins", 30, None, None, "catch_tropical_clownfish"),
            ("Catch 2 Pufferfish", 2, "coins", 35, None, None, "catch_pufferfish"),
            ("Catch 1 Octopus", 1, "coins", 50, None, None, "catch_octopus"),
            ("Catch 2 Crab", 2, "coins", 20, None, None, "catch_crab"),
            ("Sell 100 Fishes", 100, "emblems", 2, None, None, "sell_fish"),
            ("Mine 5 Ores", 5, "coins", 50, None, "mine", "mine_ores"),
            ("Buy Fortune Candy once", 1, "coins", 550, None, None, "buy_fortune_candy"),
            ("Forge Weapons once", 1, "emblems", 1, None, "mine", "forge_weapons"),
            ("Bake 50 Breads", 50, "coins", 2800, None, "farm", "bake_bread"),
            ("Cook 10 Boiled Potato", 10, "coins", 1000, None, "farm", "cook_boiled_potato"),
        ]
        regular = [q for q in ALL_QUESTS if q[2] != "emblems"]
        emblem = [q for q in ALL_QUESTS if q[2] == "emblems"]
        chosen = random.sample(regular, 4)
        if emblem and random.random() < 0.4:
            chosen.append(random.choice(emblem))
        else:
            chosen.append(random.choice(regular))
        for i, quest in enumerate(chosen):
            conn.execute("INSERT INTO daily_quests (date, quest_index, quest_name, goal, reward_type, reward_amount, reward_item, requirement, quest_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                         (date_str, i, quest[0], quest[1], quest[2], quest[3], quest[4], quest[5], quest[6]))
        conn.commit()

def get_daily_quests(date_str):
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT quest_index, quest_name, goal, reward_type, reward_amount, reward_item, requirement, quest_type FROM daily_quests WHERE date = ? ORDER BY quest_index", (date_str,)).fetchall()
    return rows

def get_player_quests(user_id, date_str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT q1, q2, q3, p1, p2, p3, claimed, refreshed FROM player_quests WHERE user_id = ? AND date = ?", (str(user_id), date_str)).fetchone()
    if row:
        return {"q1": row[0], "q2": row[1], "q3": row[2], "p1": row[3], "p2": row[4], "p3": row[5], "claimed": row[6], "refreshed": row[7]}
    return {"q1": None, "q2": None, "q3": None, "p1": 0, "p2": 0, "p3": 0, "claimed": 0, "refreshed": 0}

def set_player_quest_slot(user_id, date_str, slot, quest_index):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO player_quests (user_id, date, q1, q2, q3, p1, p2, p3, claimed, refreshed) VALUES (?, ?, NULL, NULL, NULL, 0, 0, 0, 0, 0) ON CONFLICT(user_id, date) DO NOTHING", (str(user_id), date_str))
        column = f"q{slot}"
        conn.execute(f"UPDATE player_quests SET {column} = ?, p{slot} = 0 WHERE user_id = ? AND date = ?", (quest_index, str(user_id), date_str))
        conn.commit()

def refresh_quests_allowed(user_id, date_str):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT refreshed FROM player_quests WHERE user_id = ? AND date = ?", (str(user_id), date_str)).fetchone()
        return row is None or row[0] == 0

def set_quest_refreshed(user_id, date_str):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO player_quests (user_id, date, q1, q2, q3, p1, p2, p3, claimed, refreshed) VALUES (?, ?, NULL, NULL, NULL, 0, 0, 0, 0, 1) ON CONFLICT(user_id, date) DO UPDATE SET refreshed = 1", (str(user_id), date_str))
        conn.commit()

def increment_quest_progress(user_id, quest_type, amount=1):
    date_str = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7*3600))
    with sqlite3.connect(DB_PATH) as conn:
        pq = conn.execute("SELECT q1, q2, q3, p1, p2, p3, claimed FROM player_quests WHERE user_id = ? AND date = ?", (str(user_id), date_str)).fetchone()
        if not pq or pq[6]:
            return
        for slot, idx in enumerate([pq[0], pq[1], pq[2]], start=1):
            if idx is None:
                continue
            quest = conn.execute("SELECT quest_type FROM daily_quests WHERE date = ? AND quest_index = ?", (date_str, idx)).fetchone()
            if quest and quest[0] == quest_type:
                new_progress = pq[slot+2] + amount
                conn.execute(f"UPDATE player_quests SET p{slot} = ? WHERE user_id = ? AND date = ?", (new_progress, str(user_id), date_str))
                conn.commit()

def claim_quests(user_id, date_str):
    inv = get_inventory(user_id)
    fish_counts = {item: inv.count(item) for item in FISH_TYPES}
    rock_count = inv.count("🪨 Rock")
    ore_count = inv.count("🔩 Ore")
    wheat_count = inv.count("🌾 Wheat")
    with sqlite3.connect(DB_PATH) as conn:
        pq = conn.execute("SELECT q1, q2, q3, p1, p2, p3, claimed FROM player_quests WHERE user_id = ? AND date = ?", (str(user_id), date_str)).fetchone()
        if not pq or pq[6]:
            return None
        rewards = []
        for slot, idx in enumerate([pq[0], pq[1], pq[2]], start=1):
            if idx is None:
                continue
            quest = conn.execute("SELECT quest_name, goal, reward_type, reward_amount, reward_item, quest_type FROM daily_quests WHERE date = ? AND quest_index = ?", (date_str, idx)).fetchone()
            if not quest:
                continue
            quest_type = quest[5]
            if quest_type == "harvest_wheat":
                progress = wheat_count
            elif quest_type == "mine_rocks":
                progress = rock_count
            elif quest_type == "mine_ores":
                progress = ore_count
            elif quest_type.startswith("catch_"):
                fish_name = {
                    "catch_common_carp": "🐟 Common Carp",
                    "catch_squid": "🦑 Squid",
                    "catch_tropical_clownfish": "🐠 Tropical Clownfish",
                    "catch_pufferfish": "🐡 Pufferfish",
                    "catch_octopus": "🐙 Octopus",
                    "catch_crab": "🦀 Crab",
                }.get(quest_type, "")
                progress = fish_counts.get(fish_name, 0)
            else:
                progress = pq[slot+2]
            if progress >= quest[1]:
                rewards.append((quest[2], quest[3], quest[4]))
        if rewards:
            conn.execute("UPDATE player_quests SET claimed = 1 WHERE user_id = ? AND date = ?", (str(user_id), date_str))
            conn.commit()
        return rewards

def check_and_break_boat(user_id):
    upgrades = get_upgrades(user_id)
    if upgrades["boat"]:
        upgrades["boat_durability"] += 1
        set_upgrade(user_id, "boat_durability", upgrades["boat_durability"])
        if upgrades["boat_durability"] >= random.randint(30, 50):
            set_upgrade(user_id, "boat_owned", 0)
            set_upgrade(user_id, "boat_durability", 0)
            return "boat"
    if upgrades["ship"]:
        upgrades["ship_durability"] += 1
        set_upgrade(user_id, "ship_durability", upgrades["ship_durability"])
        if upgrades["ship_durability"] >= random.randint(60, 80):
            set_upgrade(user_id, "ship_owned", 0)
            set_upgrade(user_id, "ship_durability", 0)
            return "ship"
    return None

def fire_worker(user_id, worker_type):
    field_map = {
        "fishing_helper": "helper_level",
        "farmer": "farmer_count",
        "chef": "chef_owned",
        "fisherman": "fisherman_hired"
    }
    field = field_map.get(worker_type)
    if field:
        set_upgrade(user_id, field, 0)