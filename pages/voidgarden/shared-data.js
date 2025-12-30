// shared-data.js
const GAME_DATA_KEY = 'farmGameSave';

// XP formula
function calculateXPForAction(actionType) {
    const xpValues = {
        'plant': 5,
        'water': 2,
        'harvest': 1,
        'harvest_wheat': 1,
        'harvest_carrot': 3,
        'sell': 3,
        'buy': 1,
        'upgrade': 15
    };
    return xpValues[actionType] || 1;
}

// Get real game data without defaults (only data that has been explicitly saved)
function getRealGameData() {
    const saved = localStorage.getItem(GAME_DATA_KEY);
    if (!saved) {
        // Return an empty state if no save exists
        return {
            exists: false,
            message: 'No save data found',
            data: null
        };
    }
    
    try {
        const data = JSON.parse(saved);
        
        // Create a clean object with only the data that exists in the save
        const cleanData = {};
        
        // Copy all root-level properties that exist in the saved data
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                cleanData[key] = data[key];
            }
        });
        
        // Ensure critical game structures exist (even if empty)
        if (!cleanData.plots) cleanData.plots = [];
        if (!cleanData.secondFarmPlots) cleanData.secondFarmPlots = [];
        if (!cleanData.inventory) cleanData.inventory = {};
        if (!cleanData.character) cleanData.character = {};
        
        return {
            exists: true,
            message: 'Save data loaded successfully',
            data: cleanData,
            saveTimestamp: data.lastSaved || null,
            version: data.version || 'unknown'
        };
    } catch (e) {
        console.error('Error loading real game data:', e);
        return {
            exists: false,
            message: 'Error loading save data: ' + e.message,
            data: null,
            error: e
        };
    }
}

// Function to update character XP (to be called from main game)
function updateCharacterXP(actionType, quantity = 1) {
    const state = loadGameState();
    const xpGained = calculateXPForAction(actionType) * quantity;
    
    if (!state.character) {
        state.character = DEFAULT_GAME_DATA.character;
    }
    
    // Add XP
    state.character.xp += xpGained;
    state.totalActions = (state.totalActions || 0) + quantity;
    
    // Check for level up
    while (state.character.xp >= state.character.xpToNext) {
        state.character.xp -= state.character.xpToNext;
        state.character.level++;
        state.character.statPoints += 2;
        state.character.xpToNext = Math.floor(state.character.xpToNext * 2);
        
        // Increase stats
        state.character.maxHealth += 10;
        state.character.maxEnergy += 5;
        
        console.log(`🎉 Level up! New level: ${state.character.level}`);
    }
    
    saveGameState(state);
    return xpGained;
}

const DEFAULT_GAME_DATA = {
    // Main game state
    gold: 100,
    wheatSeeds: 10,
    carrotSeeds: 10,
    wheatHarvested: 0,
    carrotHarvested: 0,
    totalPlanted: 0,
    totalHarvested: 0,
    activeBoost: null,
    hasGoldenWater: false,
    secondFarmUnlocked: false,
    
    // Character XP tracking
    totalActions: 0,
    lastXPUpdate: Date.now(),
    
    // Plots arrays
    plots: Array(9).fill(null).map((_, index) => ({
        id: index,
        plant: null,
        stage: 'empty',
        plantedAt: null,
        growthStarted: null
    })),
    
    secondFarmPlots: Array(9).fill(null).map((_, index) => ({
        id: index + 9,
        plant: null,
        stage: 'empty',
        plantedAt: null,
        growthStarted: null,
        locked: true
    })),
    
    // Character Data - XP starts at 850 to match level 5
    character: {
        name: "Farmer",
        class: "Novice Farmer",
        level: 5,
        xp: 850, // Changed from 0 to 850
        xpToNext: 1000,
        achievements: {
            completed: 3,
            total: 12
        }
    },
    
    // Inventory
    inventory: {
        speedPotion: 3,
        instantGrowth: 0,
        healthPotion: 2
    },
    
    version: "1.0",
    lastSaved: Date.now()
};

// Load game data
function loadGameState() {
    const saved = localStorage.getItem(GAME_DATA_KEY);
    if (saved) {
        try {
            let data = JSON.parse(saved);
            
            // Merge with defaults to ensure all fields exist
            let mergedData = {
                ...DEFAULT_GAME_DATA,
                ...data,
                // Ensure character data has all fields
                character: { 
                    ...DEFAULT_GAME_DATA.character, 
                    ...(data.character || {}) 
                },
                // Ensure inventory has all fields
                inventory: { 
                    ...DEFAULT_GAME_DATA.inventory, 
                    ...(data.inventory || {}) 
                },
                // Ensure plots arrays exist
                plots: data.plots || DEFAULT_GAME_DATA.plots,
                secondFarmPlots: data.secondFarmPlots || DEFAULT_GAME_DATA.secondFarmPlots
            };
            
            // Ensure XP fields exist
            if (!mergedData.totalActions) mergedData.totalActions = 0;
            if (!mergedData.lastXPUpdate) mergedData.lastXPUpdate = Date.now();
            
            return mergedData;
        } catch (e) {
            console.error('Error loading game data:', e);
            return DEFAULT_GAME_DATA;
        }
    }
    return DEFAULT_GAME_DATA;
}

// Save game data
function saveGameState(state) {
    if (!state) {
        console.error('Cannot save: no game state provided');
        return;
    }
    
    // Update timestamp
    state.lastSaved = Date.now();
    
    // Ensure character exists
    if (!state.character) {
        state.character = DEFAULT_GAME_DATA.character;
    }
    
    // Ensure inventory exists
    if (!state.inventory) {
        state.inventory = DEFAULT_GAME_DATA.inventory;
    }
    
    // Ensure XP fields exist
    if (!state.totalActions) state.totalActions = 0;
    if (!state.lastXPUpdate) state.lastXPUpdate = Date.now();
    
    // Save to localStorage
    localStorage.setItem(GAME_DATA_KEY, JSON.stringify(state));
    console.log('Game saved at', new Date().toLocaleTimeString());
}

// Get current game state
function getGameState() {
    return loadGameState();
}

// Update game state
function updateGameState(updates) {
    const currentState = loadGameState();
    const updatedState = {
        ...currentState,
        ...updates,
        // Handle nested updates
        character: { ...currentState.character, ...(updates.character || {}) },
        inventory: { ...currentState.inventory, ...(updates.inventory || {}) }
    };
    
    saveGameState(updatedState);
    return updatedState;
}

// Add XP to character (legacy function - use updateCharacterXP for XP with actions)
function addCharacterXP(amount) {
    const state = loadGameState();
    
    if (!state.character) {
        state.character = DEFAULT_GAME_DATA.character;
    }
    
    // Add XP
    state.character.xp += amount;
    
    // Level up if enough XP
    while (state.character.xp >= state.character.xpToNext) {
        state.character.xp -= state.character.xpToNext;
        state.character.level++;
        state.character.statPoints += 2;
        state.character.xpToNext = Math.floor(state.character.xpToNext * 1.5);
        
        console.log(`🎉 Level up! New level: ${state.character.level}`);
    }
    
    saveGameState(state);
    return state;
}

// Add gold
function addGold(amount) {
    const state = loadGameState();
    state.gold += amount;
    saveGameState(state);
    return state.gold;
}

// Deduct gold
function deductGold(amount) {
    const state = loadGameState();
    if (state.gold >= amount) {
        state.gold -= amount;
        saveGameState(state);
        return true;
    }
    return false;
}

// Add seeds
function addSeeds(type, amount = 1) {
    const state = loadGameState();
    if (type === 'wheat') {
        state.wheatSeeds += amount;
    } else if (type === 'carrot') {
        state.carrotSeeds += amount;
    }
    saveGameState(state);
    return state;
}

// Remove seeds
function removeSeeds(type, amount = 1) {
    const state = loadGameState();
    let success = false;
    
    if (type === 'wheat' && state.wheatSeeds >= amount) {
        state.wheatSeeds -= amount;
        success = true;
    } else if (type === 'carrot' && state.carrotSeeds >= amount) {
        state.carrotSeeds -= amount;
        success = true;
    }
    
    if (success) {
        saveGameState(state);
    }
    return success;
}

// Add to harvested count
function addHarvested(type, amount = 1) {
    const state = loadGameState();
    if (type === 'wheat') {
        state.wheatHarvested += amount;
        // Add XP for harvesting wheat (1 XP per wheat)
        updateCharacterXP('harvest_wheat', amount);
    } else if (type === 'carrot') {
        state.carrotHarvested += amount;
        // Add XP for harvesting carrot (3 XP per carrot)
        updateCharacterXP('harvest_carrot', amount);
    }
    
    state.totalHarvested += amount;
    saveGameState(state);
    return state;
}
    
// Add inventory item
function addInventoryItem(item, amount = 1) {
    const state = loadGameState();
    if (!state.inventory[item]) {
        state.inventory[item] = 0;
    }
    state.inventory[item] += amount;
    saveGameState(state);
    return state.inventory[item];
}

// Remove inventory item
function removeInventoryItem(item, amount = 1) {
    const state = loadGameState();
    if (state.inventory[item] >= amount) {
        state.inventory[item] -= amount;
        saveGameState(state);
        return true;
    }
    return false;
}

// Get inventory count
function getInventoryCount(item) {
    const state = loadGameState();
    return state.inventory[item] || 0;
}

// Function to sync auto-harvest purchase
function syncAutoHarvestPurchase() {
    const saved = localStorage.getItem('farmGameSave');
    if (saved) {
        const data = JSON.parse(saved);
        if (data.autoHarvest && data.autoHarvest.purchased) {
            if (window.gameState) {
                window.gameState.autoHarvest = data.autoHarvest;
            }
        }
    }
}

// Run sync on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', syncAutoHarvestPurchase);
}

// Export to global scope
window.sharedGameState = loadGameState();
window.sharedLoadGameState = loadGameState;
window.sharedSaveGameState = saveGameState;
window.getGameState = getGameState;
window.getRealGameData = getRealGameData; 
window.sharedAddCharacterXP = addCharacterXP;
window.sharedUpdateCharacterXP = updateCharacterXP;
window.sharedCalculateXPForAction = calculateXPForAction;
window.addGold = addGold;
window.deductGold = deductGold;
window.addSeeds = addSeeds;
window.removeSeeds = removeSeeds;
window.addHarvested = addHarvested;
window.addInventoryItem = addInventoryItem;
window.removeInventoryItem = removeInventoryItem;
window.getInventoryCount = getInventoryCount;
window.gameState = window.gameState || {};


console.log('shared-data.js loaded successfully');