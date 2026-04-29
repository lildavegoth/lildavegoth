import sqlite3
import time
import random

DB_PATH = "tokens.db"

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS life_coins (user_id TEXT PRIMARY KEY, coins INTEGER DEFAULT 0)")
        conn.execute("CREATE TABLE IF NOT EXISTS life_inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, fish_name TEXT)")
        conn.execute("CREATE TABLE IF NOT EXISTS life_upgrades (user_id TEXT PRIMARY KEY, better_skill_level INTEGER DEFAULT 0, rod_level INTEGER DEFAULT 0, helper_level INTEGER DEFAULT 0, boat_owned INTEGER DEFAULT 0, fortune_candy_until REAL DEFAULT 0, mine_owned INTEGER DEFAULT 0, pickaxe_level INTEGER DEFAULT 0, mine_level INTEGER DEFAULT 0, miner_machine_owned INTEGER DEFAULT 0, miner_machine_next REAL DEFAULT 0, miner_machine_active INTEGER DEFAULT 1, farm_owned INTEGER DEFAULT 0, farmer_hired INTEGER DEFAULT 0, planted_seed TEXT, planted_at REAL, achievement_legendary_fisherman INTEGER DEFAULT 0, achievement_richer_than_ever INTEGER DEFAULT 0)")

        inventory_cols = [row[1] for row in conn.execute("PRAGMA table_info(life_inventory)").fetchall()]
        if "item_name" not in inventory_cols:
            conn.execute("ALTER TABLE life_inventory ADD COLUMN item_name TEXT")
            conn.execute("UPDATE life_inventory SET item_name = fish_name WHERE item_name IS NULL AND fish_name IS NOT NULL")

        upgrades_cols = [row[1] for row in conn.execute("PRAGMA table_info(life_upgrades)").fetchall()]
        for col, default in [
            ("rod_level", "INTEGER DEFAULT 0"),
            ("helper_level", "INTEGER DEFAULT 0"),
            ("boat_owned", "INTEGER DEFAULT 0"),
            ("fortune_candy_until", "REAL DEFAULT 0"),
            ("mine_owned", "INTEGER DEFAULT 0"),
            ("pickaxe_level", "INTEGER DEFAULT 0"),
            ("mine_level", "INTEGER DEFAULT 0"),
            ("miner_machine_owned", "INTEGER DEFAULT 0"),
            ("miner_machine_next", "REAL DEFAULT 0"),
            ("miner_machine_active", "INTEGER DEFAULT 1"),
            ("farm_owned", "INTEGER DEFAULT 0"),
            ("farmer_hired", "INTEGER DEFAULT 0"),
            ("planted_seed", "TEXT"),
            ("planted_at", "REAL"),
            ("achievement_legendary_fisherman", "INTEGER DEFAULT 0"),
            ("achievement_richer_than_ever", "INTEGER DEFAULT 0")
        ]:
            if col not in upgrades_cols:
                conn.execute(f"ALTER TABLE life_upgrades ADD COLUMN {col} {default}")
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

def get_upgrades(user_id):
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT better_skill_level, rod_level, helper_level, boat_owned, fortune_candy_until, mine_owned, pickaxe_level, mine_level, miner_machine_owned, miner_machine_next, miner_machine_active, farm_owned, farmer_hired, planted_seed, planted_at, achievement_legendary_fisherman, achievement_richer_than_ever FROM life_upgrades WHERE user_id = ?", (str(user_id),)).fetchone()
    if row:
        return {
            "better_fishing": row[0],
            "rod": row[1],
            "helper": row[2],
            "boat": row[3],
            "fortune_candy": row[4],
            "mine": row[5],
            "pickaxe": row[6],
            "mine_level": row[7],
            "miner_machine": row[8],
            "miner_machine_next": row[9],
            "miner_machine_active": row[10],
            "farm": row[11],
            "farmer": row[12],
            "planted_seed": row[13],
            "planted_at": row[14],
            "legendary_fisherman": row[15],
            "richer_than_ever": row[16]
        }
    return {
        "better_fishing": 0,
        "rod": 0,
        "helper": 0,
        "boat": 0,
        "fortune_candy": 0,
        "mine": 0,
        "pickaxe": 0,
        "mine_level": 0,
        "miner_machine": 0,
        "miner_machine_next": 0,
        "miner_machine_active": 1,
        "farm": 0,
        "farmer": 0,
        "planted_seed": None,
        "planted_at": None,
        "legendary_fisherman": 0,
        "richer_than_ever": 0
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
    if random.random() < 0.15:
        ores += random.randint(1, 2)
    if random.random() < 0.05:
        jewel += 1
    for _ in range(rocks):
        add_item(user_id, "🪨 Rock")
    for _ in range(ores):
        add_item(user_id, "🔩 Ore")
    for _ in range(jewel):
        add_item(user_id, "💎 Jewel")
    next_time = now + 3600
    set_upgrade(user_id, "miner_machine_next", next_time)
    return rocks, ores, jewel