import { DOM, SKINS, state, resetState, setCurrentSkin, currentSkinKey, loadUnlockedSkins, isSkinUnlocked, unlockSkin, saveMaxLevel, getMaxLevel, getLeaderboard, saveScore, keyBindings, loadKeyBindings, setKeyBinding, gameRules, loadGameRules, setGameRule, deviceMode, loadDeviceMode, setDeviceMode } from './data.js';
import { updatePlayerPos, movePlayer, updateHPUI, shoot, showFloatingMessage, useVortexLaser, usePhoenixFeathers, useJokerChaos } from './systems.js';
import { handleSpawning } from './systems.js';
import { updateBullets, updateEnemyBullets, updateBurgers, updateIngredients, updateAsteroids, updateEnemies } from './updates.js';
import { initAuth, currentUser, isAuthenticated } from './auth.js';
import { initFirestoreSync } from './firestore-sync.js';

// ===== INITIALIZATION =====

console.log('🚀 [INIT] Game loading...');
initAuth(); // Initialize Firebase Auth
initFirestoreSync(); // Initialize Firestore sync
loadUnlockedSkins();
loadKeyBindings();
loadGameRules();
loadDeviceMode();
updateSkinOptions();
console.log('✅ [INIT] Game loaded successfully');

// ===== LEADERBOARD =====

function showLeaderboard() {
    console.log('🏆 [LEADERBOARD] Opening leaderboard...');
    console.log('🏆 [LEADERBOARD] Hiding main menu');
    document.getElementById('main-menu').style.display = 'none';
    console.log('🏆 [LEADERBOARD] Showing leaderboard container');
    document.getElementById('leaderboard-container').style.display = 'block';
    console.log('🏆 [LEADERBOARD] Displaying overall category');
    displayLeaderboard('overall');
    
    // Setup tab listeners
    console.log('🏆 [LEADERBOARD] Setting up tab listeners');
    const tabs = document.querySelectorAll('.lb-tab');
    console.log(`🏆 [LEADERBOARD] Found ${tabs.length} tabs`);
    tabs.forEach((tab, index) => {
        console.log(`🏆 [LEADERBOARD] Setting up tab ${index}: ${tab.dataset.tab}`);
        tab.onclick = function() {
            console.log(`👆 [TAB CLICK] User clicked tab: ${this.dataset.tab}`);
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            console.log(`👆 [TAB CLICK] Displaying leaderboard for: ${this.dataset.tab}`);
            displayLeaderboard(this.dataset.tab);
        };
    });
    console.log('✅ [LEADERBOARD] Leaderboard opened successfully');
}

function closeLeaderboard() {
    console.log('❌ [LEADERBOARD] Closing leaderboard...');
    document.getElementById('leaderboard-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    console.log('✅ [LEADERBOARD] Leaderboard closed');
}

async function displayLeaderboard(category) {
    console.log(`📊 [DISPLAY] Displaying leaderboard for category: ${category}`);
    const content = document.getElementById('leaderboard-content');
    
    if (!content) {
        console.error('❌ [DISPLAY] ERROR: leaderboard-content element not found!');
        return;
    }
    
    // Show loading message
    content.innerHTML = '<div class="lb-empty">⏳ טוען נתונים...</div>';
    
    // Try to get from cloud first
    let leaderboard = [];
    try {
        const { getLeaderboardFromCloud } = await import('./firestore-sync.js');
        const cloudLeaderboard = await getLeaderboardFromCloud(category);
        if (cloudLeaderboard && cloudLeaderboard.length > 0) {
            console.log(`✅ [DISPLAY] Got ${cloudLeaderboard.length} entries from cloud`);
            leaderboard = cloudLeaderboard;
        } else {
            // Fallback to local
            leaderboard = getLeaderboard(category);
            console.log(`📊 [DISPLAY] Using local data: ${leaderboard.length} entries`);
        }
    } catch (error) {
        console.log('⚠️ [DISPLAY] Cloud fetch failed, using local data');
        leaderboard = getLeaderboard(category);
    }
    
    console.log(`📊 [DISPLAY] Retrieved ${leaderboard.length} entries`);
    
    if (leaderboard.length === 0) {
        console.log('⚠️ [DISPLAY] No entries found, showing empty message');
        content.innerHTML = '<div class="lb-empty">אין עדיין שיאים 🎯<br>שחק כדי להגיע ללוח!</div>';
        return;
    }
    
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    console.log('📊 [DISPLAY] Generating HTML for entries...');
    const html = leaderboard.map((entry, index) => {
        console.log(`📊 [DISPLAY] Entry ${index + 1}:`, entry);
        
        // Get skin name, or use the skin key if skin doesn't exist in SKINS
        let skinName = '';
        if (entry.skin) {
            if (SKINS[entry.skin]) {
                skinName = `• ${SKINS[entry.skin].name}`;
            } else {
                skinName = `• ${entry.skin}`; // Fallback to skin key if skin doesn't exist
                console.warn(`⚠️ [DISPLAY] Unknown skin: ${entry.skin}`);
            }
        }
        
        // Get user name
        const userName = entry.userName || 'Anonymous';
        
        return `
        <div class="lb-entry rank-${index + 1}">
            <div class="lb-rank">${medals[index] || (index + 1)}</div>
            <div class="lb-info">
                <div class="lb-player-name" style="font-size: 0.9rem; font-weight: bold; color: var(--primary); margin-bottom: 3px;">
                    👤 ${userName}
                </div>
                <div class="lb-score">${entry.score.toLocaleString()} נקודות</div>
                <div class="lb-details">
                    שלב ${entry.level} ${skinName} • ${entry.date}
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    content.innerHTML = html;
    console.log('✅ [DISPLAY] Leaderboard displayed successfully');
}

// Export to window for HTML onclick
console.log('🔗 [EXPORT] Exporting functions to window object...');
window.showLeaderboard = showLeaderboard;
window.closeLeaderboard = closeLeaderboard;
console.log('✅ [EXPORT] Functions exported:', {
    showLeaderboard: typeof window.showLeaderboard,
    closeLeaderboard: typeof window.closeLeaderboard
});

// ===== SKIN SELECTION =====

function updateSkinOptions() {
    console.log('🎨 [SKINS] Updating skin options...');
    const options = document.querySelectorAll('.skin-option');
    console.log(`🎨 [SKINS] Found ${options.length} skin options`);
    
    options.forEach((option, index) => {
        const skinKey = option.dataset.skin;
        const unlockLevel = parseInt(option.dataset.unlockLevel) || 0;
        const maxLevel = getMaxLevel();
        
        console.log(`🎨 [SKINS] Processing skin ${index}: ${skinKey} (unlock level: ${unlockLevel}, max level: ${maxLevel})`);
        
        if (unlockLevel > 0 && maxLevel >= unlockLevel && !isSkinUnlocked(skinKey)) {
            console.log(`🔓 [SKINS] Auto-unlocking ${skinKey}`);
            unlockSkin(skinKey);
            option.classList.add('newly-unlocked');
            setTimeout(() => option.classList.remove('newly-unlocked'), 1000);
        }
        
        if (isSkinUnlocked(skinKey)) {
            console.log(`✅ [SKINS] ${skinKey} is unlocked, making clickable`);
            option.classList.remove('locked');
            option.onclick = () => {
                console.log(`👆 [SKIN CLICK] User clicked skin: ${skinKey}`);
                selectSkin(skinKey, option);
            };
        } else {
            console.log(`🔒 [SKINS] ${skinKey} is locked`);
            option.classList.add('locked');
            option.onclick = null;
        }
    });
    console.log('✅ [SKINS] Skin options updated');
}

function selectSkin(key, element) {
    console.log(`🎨 [SELECT] Selecting skin: ${key}`);
    if (!isSkinUnlocked(key)) {
        console.log(`🔒 [SELECT] Skin ${key} is locked! Selection blocked.`);
        return;
    }
    setCurrentSkin(key);
    document.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    console.log(`✅ [SELECT] Skin ${key} selected successfully`);
}

// Export to window for HTML onclick
window.selectSkin = selectSkin;

// ===== GAME INITIALIZATION =====

function initGame() {
    resetState();
    
    // Reset player size to normal
    DOM.player.style.transform = 'scale(1)';
    
    const skin = SKINS[currentSkinKey];
    state.currentSkinStats = {
        fireRate: skin.fireRate,
        bulletSpeed: skin.bulletSpeed,
        bulletDamage: skin.bulletDamage
    };
    
    DOM.playerSpriteContainer.innerHTML = skin.svg;
    document.documentElement.style.setProperty('--primary', skin.color);

    DOM.scoreEl.innerText = '0';
    DOM.levelEl.innerText = '1';
    updateHPUI();
    DOM.overlay.style.display = 'none';
    
    // Show/hide special ability button based on skin and reset cooldown display
    const abilityBtn = document.getElementById('special-ability-btn');
    if (currentSkinKey === 'vortex') {
        abilityBtn.style.display = 'flex';
        abilityBtn.classList.remove('cooldown');
        abilityBtn.querySelector('.ability-icon').innerText = '⚡';
        abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
    } else if (currentSkinKey === 'phoenix') {
        abilityBtn.style.display = 'flex';
        abilityBtn.classList.remove('cooldown');
        abilityBtn.querySelector('.ability-icon').innerText = '🔥';
        abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
    } else if (currentSkinKey === 'joker') {
        abilityBtn.style.display = 'flex';
        abilityBtn.classList.remove('cooldown');
        abilityBtn.querySelector('.ability-icon').innerText = '🃏';
        abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
    } else {
        abilityBtn.style.display = 'none';
    }
    
    const elementsToRemove = document.querySelectorAll('.enemy-ship, .asteroid, .bullet, .enemy-bullet, .particle, .floating-msg, .burger, .ingredient, .laser-beam');
    elementsToRemove.forEach(e => e.remove());
    
    updateSkinOptions();
    updatePlayerPos();
    requestAnimationFrame(update);
}

// Export to window for HTML onclick
window.initGame = initGame;
console.log('✅ [EXPORT] initGame exported:', typeof window.initGame);

// ===== LEVEL UP SYSTEM =====

function handleLevelUp() {
    if (state.score >= state.lastLevelScore + 1000) {
        state.lastLevelScore = Math.floor(state.score / 1000) * 1000;
        state.level++;
        DOM.levelEl.innerText = state.level;
        state.speedMult += 0.2;
        state.spawnRate = Math.max(250, state.spawnRate - 200);
        state.playerHP = state.playerMaxHP;
        updateHPUI();
        
        saveMaxLevel(state.level);
        
        let unlocked = false;
        Object.keys(SKINS).forEach(skinKey => {
            const skin = SKINS[skinKey];
            if (skin.unlockLevel === state.level && !isSkinUnlocked(skinKey)) {
                if (unlockSkin(skinKey)) {
                    unlocked = true;
                    showFloatingMessage(
                        `🎉 NEW SKIN UNLOCKED: ${skin.name.toUpperCase()}!`, 
                        DOM.wrapper.clientWidth/2 - 100, 
                        DOM.wrapper.clientHeight/2 + 50, 
                        "#ffd700"
                    );
                }
            }
        });
        
        if (unlocked) {
            updateSkinOptions();
        }
        
        showFloatingMessage("LEVEL UP! HP REFILL", DOM.wrapper.clientWidth/2 - 70, DOM.wrapper.clientHeight/2, "var(--primary)");
    }
}

// ===== MAIN UPDATE LOOP =====

function update() {
    if(!state.active) return;
    const now = Date.now();
    
    handleLevelUp();
    handleSpawning(now);
    updateAbilityCooldown(now);
    updateArrowMovement();
    
    updateBurgers();
    updateIngredients();
    updateBullets();
    updateEnemyBullets();
    updateAsteroids();
    updateEnemies(now);
    
    requestAnimationFrame(update);
}

// ===== SPECIAL ABILITY SYSTEM =====

function updateAbilityCooldown(now) {
    const abilityBtn = document.getElementById('special-ability-btn');
    if (!abilityBtn) return;
    
    // Check if chaos mode duration ended (but don't revert enemies)
    if (state.jokerAbility.active && now >= state.jokerAbility.endTime) {
        console.log('🃏 [JOKER] Chaos mode duration ended (enemies stay chaotic)');
        state.jokerAbility.active = false;
        // Don't remove chaos effect - enemies stay chaotic forever!
    }
    
    if (currentSkinKey === 'vortex') {
        if (!state.specialAbility.ready) {
            const elapsed = now - state.specialAbility.lastUsed;
            const remaining = state.specialAbility.cooldown - elapsed;
            
            if (remaining <= 0) {
                state.specialAbility.ready = true;
                abilityBtn.classList.remove('cooldown');
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
            } else {
                const percent = (remaining / state.specialAbility.cooldown) * 100;
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', `${percent}%`);
            }
        }
    } else if (currentSkinKey === 'phoenix') {
        if (!state.phoenixAbility.ready) {
            const elapsed = now - state.phoenixAbility.lastUsed;
            const remaining = state.phoenixAbility.cooldown - elapsed;
            
            if (remaining <= 0) {
                state.phoenixAbility.ready = true;
                abilityBtn.classList.remove('cooldown');
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
            } else {
                const percent = (remaining / state.phoenixAbility.cooldown) * 100;
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', `${percent}%`);
            }
        }
    } else if (currentSkinKey === 'joker') {
        if (!state.jokerAbility.ready) {
            const elapsed = now - state.jokerAbility.lastUsed;
            const remaining = state.jokerAbility.cooldown - elapsed;
            
            if (remaining <= 0) {
                state.jokerAbility.ready = true;
                abilityBtn.classList.remove('cooldown');
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', '0%');
            } else {
                const percent = (remaining / state.jokerAbility.cooldown) * 100;
                abilityBtn.querySelector('.ability-cooldown').style.setProperty('--cooldown-percent', `${percent}%`);
            }
        }
    }
}

function activateSpecialAbility() {
    if (!state.active) return;
    
    if (currentSkinKey === 'vortex') {
        if (!state.specialAbility.ready) return;
        
        useVortexLaser();
        state.specialAbility.ready = false;
        state.specialAbility.lastUsed = Date.now();
        document.getElementById('special-ability-btn').classList.add('cooldown');
    } else if (currentSkinKey === 'phoenix') {
        if (!state.phoenixAbility.ready) return;
        
        usePhoenixFeathers();
        state.phoenixAbility.ready = false;
        state.phoenixAbility.lastUsed = Date.now();
        document.getElementById('special-ability-btn').classList.add('cooldown');
    } else if (currentSkinKey === 'joker') {
        if (!state.jokerAbility.ready) return;
        
        useJokerChaos();
        state.jokerAbility.ready = false;
        state.jokerAbility.lastUsed = Date.now();
        document.getElementById('special-ability-btn').classList.add('cooldown');
    }
}

// ===== EVENT LISTENERS =====

// Mouse/Arrow control
window.addEventListener('mousemove', (e) => {
    if(!state.active || keyBindings.controlType !== 'mouse') return;
    movePlayer(e.clientX);
    
    // Track mouse position for Phoenix feathers
    const rect = DOM.wrapper.getBoundingClientRect();
    state.lastMouseX = e.clientX - rect.left;
    state.lastMouseY = e.clientY - rect.top;
});

window.addEventListener('touchmove', (e) => {
    if(!state.active) return;
    e.preventDefault();
    movePlayer(e.touches[0].clientX);
    shoot();
    
    // Track touch position for Phoenix feathers
    const rect = DOM.wrapper.getBoundingClientRect();
    state.lastMouseX = e.touches[0].clientX - rect.left;
    state.lastMouseY = e.touches[0].clientY - rect.top;
}, { passive: false });

window.addEventListener('touchstart', (e) => {
    if(!state.active) return;
    movePlayer(e.touches[0].clientX);
    shoot();
    
    // Track touch position for Phoenix feathers
    const rect = DOM.wrapper.getBoundingClientRect();
    state.lastMouseX = e.touches[0].clientX - rect.left;
    state.lastMouseY = e.touches[0].clientY - rect.top;
}, { passive: false });

// Arrow key controls
let arrowKeysPressed = { left: false, right: false, up: false, down: false, shoot: false };
let mousePressed = false;

window.addEventListener('keydown', (e) => {
    // Handle shooting key - track if it's pressed
    if (state.active && e.code === keyBindings.shoot) {
        arrowKeysPressed.shoot = true;
        shoot(); // Shoot immediately on press
    }
    
    // Handle special ability for all control types
    if (state.active && e.code === keyBindings.ability) {
        activateSpecialAbility();
    }
    
    // Handle movement keys only for arrows control type
    if (!state.active || keyBindings.controlType !== 'arrows') return;
    
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        arrowKeysPressed.left = true;
        e.preventDefault();
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        arrowKeysPressed.right = true;
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    // Track shoot key release
    if (e.code === keyBindings.shoot) {
        arrowKeysPressed.shoot = false;
    }
    
    if (keyBindings.controlType !== 'arrows') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') arrowKeysPressed.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') arrowKeysPressed.right = false;
});

// Arrow movement update
function updateArrowMovement() {
    if (!state.active) return;
    
    // Handle arrow key movement
    if (keyBindings.controlType === 'arrows') {
        const speed = 8;
        if (arrowKeysPressed.left) {
            state.playerX = Math.max(0, state.playerX - speed);
            updatePlayerPos();
        }
        if (arrowKeysPressed.right) {
            state.playerX = Math.min(DOM.wrapper.clientWidth - 50, state.playerX + speed);
            updatePlayerPos();
        }
    }
    
    // Continuous shooting when shoot key is held (works in both modes)
    if (arrowKeysPressed.shoot) {
        shoot();
    }
    
    // Continuous shooting when mouse button is held (mouse mode only)
    if (keyBindings.controlType === 'mouse' && mousePressed) {
        shoot();
    }
}

window.addEventListener('mousedown', (e) => {
    if (keyBindings.controlType === 'mouse') {
        mousePressed = true;
        shoot();
    }
});

window.addEventListener('mouseup', (e) => {
    mousePressed = false;
});

// Special ability button click
document.getElementById('special-ability-btn').addEventListener('click', activateSpecialAbility);

// Prevent context menu on right click, use it for special ability instead
window.addEventListener('contextmenu', (e) => {
    if (state.active && keyBindings.rightClickAbility) {
        e.preventDefault();
        activateSpecialAbility();
    }
});

// ===== INITIALIZATION =====

// Generate stars
console.log('⭐ [INIT] Generating stars...');
for(let i=0; i<40; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.width = '2px';
    s.style.height = '2px';
    s.style.left = Math.random()*100+'%';
    s.style.top = Math.random()*100+'%';
    s.style.animationDuration = (Math.random()*4+2)+'s';
    DOM.wrapper.appendChild(s);
}
console.log('✅ [INIT] 40 stars generated');

DOM.playerSpriteContainer.innerHTML = SKINS.classic.svg;
console.log('✅ [INIT] Player sprite set to classic skin');
console.log('🎮 [INIT] All systems ready!');

// ===== DEBUG COMMANDS =====

window.debugUnlockSkin = function(skinKey) {
    if (!SKINS[skinKey]) {
        console.error(`❌ [DEBUG] Skin "${skinKey}" does not exist!`);
        console.log('📋 [DEBUG] Available skins:', Object.keys(SKINS).join(', '));
        return false;
    }
    
    const result = unlockSkin(skinKey);
    if (result) {
        console.log(`🎉 [DEBUG] Successfully unlocked skin: ${skinKey}`);
        updateSkinOptions();
        return true;
    } else {
        console.log(`ℹ️ [DEBUG] Skin ${skinKey} was already unlocked`);
        return false;
    }
};

window.debugUnlockAllSkins = function() {
    console.log('🔓 [DEBUG] Unlocking all skins...');
    let count = 0;
    Object.keys(SKINS).forEach(skinKey => {
        const result = unlockSkin(skinKey);
        if (result) {
            count++;
        }
    });
    updateSkinOptions();
    console.log(`✅ [DEBUG] Unlocked ${count} new skins!`);
    console.log('📋 [DEBUG] All unlocked skins:', Object.keys(SKINS).join(', '));
};

window.debugListSkins = function() {
    console.log('📋 [DEBUG] === AVAILABLE SKINS ===');
    Object.keys(SKINS).forEach(key => {
        const skin = SKINS[key];
        const unlocked = isSkinUnlocked(key);
        console.log(`${unlocked ? '✅' : '🔒'} ${key} (${skin.name}) - Unlock Level: ${skin.unlockLevel}`);
    });
};

window.setLvl = function(lvlNum) {
    const level = parseInt(lvlNum);
    if (isNaN(level) || level < 1) {
        console.error('❌ [DEBUG] Invalid level! Please provide a number >= 1');
        return false;
    }
    
    if (!state.active) {
        console.error('❌ [DEBUG] Game must be active! Start a game first.');
        return false;
    }
    
    state.level = level;
    state.lastLevelScore = (level - 1) * 1000;
    state.score = state.lastLevelScore;
    DOM.levelEl.innerText = level;
    DOM.scoreEl.innerText = state.score;
    
    // Update game difficulty based on level
    state.speedMult = 1 + ((level - 1) * 0.2);
    state.spawnRate = Math.max(250, 1400 - ((level - 1) * 200));
    
    console.log(`✅ [DEBUG] Level set to ${level}`);
    console.log(`📊 [DEBUG] Score set to: ${state.score}`);
    console.log(`📊 [DEBUG] Speed multiplier: ${state.speedMult.toFixed(2)}`);
    console.log(`📊 [DEBUG] Spawn rate: ${state.spawnRate}ms`);
    
    // Save max level if higher
    saveMaxLevel(level);
    
    return true;
};


window.spawn = function(type) {
    if (!state.active) {
        console.error('❌ [DEBUG] Game must be active! Start a game first.');
        return false;
    }
    
    const validTypes = ['burger', 'asteroid', 'enemy', 'elite', 'orange', 'red'];
    const lowerType = type.toLowerCase();
    
    if (!validTypes.includes(lowerType)) {
        console.error(`❌ [DEBUG] Invalid type! Valid types: ${validTypes.join(', ')}`);
        return false;
    }
    
    const posX = Math.random() * (DOM.wrapper.clientWidth - 50);
    const el = document.createElement('div');
    
    if (lowerType === 'burger') {
        el.className = 'burger';
        el.style.left = posX + 'px'; 
        el.style.top = '-60px';
        el.innerHTML = `
            <div class="hp-bar-container"><div class="hp-bar-fill enemy-hp-fill"></div></div>
            <svg viewBox="0 0 100 100">
                <path d="M10 50 Q50 10 90 50 Z" fill="#e67e22"/>
                <rect x="10" y="50" width="80" height="10" fill="#6d4c41"/>
                <rect x="10" y="60" width="80" height="5" fill="#f1c40f"/>
                <path d="M10 65 L90 65 L80 85 L20 85 Z" fill="#e67e22"/>
            </svg>`;
        DOM.wrapper.appendChild(el);
        state.burgers.push({
            el: el, 
            hpFill: el.querySelector('.enemy-hp-fill'),
            y: -60, 
            hp: 4, 
            maxHP: 4, 
            speed: 1.2 * state.speedMult
        });
        console.log('🍔 [DEBUG] Spawned burger');
    } else if (lowerType === 'asteroid') {
        el.className = 'asteroid';
        el.style.left = posX + 'px'; 
        el.style.top = '-60px';
        el.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%;"><path d="M20 30 L40 10 L70 20 L90 50 L75 85 L30 90 L10 60 Z" fill="#333" stroke="#555" stroke-width="3"/><circle cx="40" cy="40" r="5" fill="#222"/><circle cx="60" cy="70" r="8" fill="#222"/></svg>`;
        DOM.wrapper.appendChild(el);
        state.asteroids.push({ 
            el: el, 
            y: -60, 
            speed: (Math.random() * 2.0 + 1.2) * state.speedMult, 
            rot: 0, 
            rotSpeed: Math.random() * 8 - 4 
        });
        console.log('🪨 [DEBUG] Spawned asteroid');
    } else {
        const isOrange = lowerType === 'elite' || lowerType === 'orange';
        const type = isOrange ? 'orange' : 'red';
        const maxHP = isOrange ? (Math.floor(Math.random() * 3) + 3) : (Math.floor(Math.random() * 3) + 1);
        const colorCode = isOrange ? '#ff9900' : '#ff0000';
        el.className = `enemy-ship ${type}`;
        el.style.left = posX + 'px'; 
        el.style.top = '-60px';
        el.innerHTML = `<div class="hp-bar-container"><div class="hp-bar-fill enemy-hp-fill"></div></div><svg viewBox="0 0 100 100" style="width:100%; height:100%;"><path d="M10 20 L50 90 L90 20 L50 40 Z" fill="${colorCode}" stroke="#fff" stroke-width="2"/></svg>`;
        DOM.wrapper.appendChild(el);
        state.enemies.push({ 
            el: el, 
            hpFill: el.querySelector('.enemy-hp-fill'),
            type: type, 
            y: -60, 
            hp: maxHP, 
            maxHP: maxHP,
            speed: (Math.random() * 0.8 + 0.6) * state.speedMult,
            lastShot: Date.now() + Math.random() * 500,
            fireRate: (isOrange ? 600 : 1000) / state.speedMult
        });
        console.log(`👾 [DEBUG] Spawned ${type} enemy`);
    }
    
    return true;
};

console.log('🛠️ [DEBUG] Debug commands available:');
console.log('  - debugUnlockSkin("skinName") - Unlock a specific skin');
console.log('  - debugUnlockAllSkins() - Unlock all skins');
console.log('  - debugListSkins() - Show all available skins');
console.log('  - setLvl(number) - Set current level (game must be active)');
console.log('  - spawn(type) - Spawn entity: "burger", "asteroid", "enemy", "elite"');

// ===== SETTINGS MENU =====

function showSettings() {
    console.log('⚙️ [SETTINGS] Opening settings...');
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('settings-container').style.display = 'block';
    updateSettingsDisplay();
}

function closeSettings() {
    console.log('⚙️ [SETTINGS] Closing settings...');
    document.getElementById('settings-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
}

function updateSettingsDisplay() {
    // Update device mode buttons
    const isAuto = deviceMode.isAutoDetected;
    const isMobile = deviceMode.isMobile;
    
    document.getElementById('device-auto').classList.toggle('active', isAuto);
    document.getElementById('device-mobile').classList.toggle('active', !isAuto && isMobile);
    document.getElementById('device-desktop').classList.toggle('active', !isAuto && !isMobile);
    
    // Show/hide keyboard settings based on device mode
    const keyboardSettings = [
        document.getElementById('control-settings'),
        document.getElementById('shoot-key-settings'),
        document.getElementById('ability-key-settings'),
        document.getElementById('rightclick-settings')
    ];
    
    keyboardSettings.forEach(setting => {
        if (setting) {
            if (isMobile) {
                setting.style.opacity = '0.5';
                setting.style.pointerEvents = 'none';
                setting.style.filter = 'grayscale(100%)';
            } else {
                setting.style.opacity = '1';
                setting.style.pointerEvents = 'auto';
                setting.style.filter = 'none';
            }
        }
    });
    
    // Update control type buttons
    document.getElementById('control-mouse').classList.toggle('active', keyBindings.controlType === 'mouse');
    document.getElementById('control-arrows').classList.toggle('active', keyBindings.controlType === 'arrows');
    
    // Update right-click buttons
    document.getElementById('rightclick-on').classList.toggle('active', keyBindings.rightClickAbility === true);
    document.getElementById('rightclick-off').classList.toggle('active', keyBindings.rightClickAbility === false);
    
    // Update game rules buttons
    document.getElementById('enemies-shoot-asteroids-yes').classList.toggle('active', gameRules.enemiesShootThroughAsteroids === true);
    document.getElementById('enemies-shoot-asteroids-no').classList.toggle('active', gameRules.enemiesShootThroughAsteroids === false);
    
    document.getElementById('player-shoot-asteroids-yes').classList.toggle('active', gameRules.playerShootThroughAsteroids === true);
    document.getElementById('player-shoot-asteroids-no').classList.toggle('active', gameRules.playerShootThroughAsteroids === false);
    
    // Update key displays
    document.getElementById('shoot-key-display').innerText = formatKeyName(keyBindings.shoot);
    document.getElementById('ability-key-display').innerText = formatKeyName(keyBindings.ability);
}

function formatKeyName(code) {
    if (code === 'Space') return 'Space';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    if (code.startsWith('Arrow')) return code.replace('Arrow', '') + ' Arrow';
    return code;
}

function setControl(type) {
    console.log(`⚙️ [SETTINGS] Control type set to: ${type}`);
    setKeyBinding('controlType', type);
    updateSettingsDisplay();
}

function setRightClick(enabled) {
    console.log(`⚙️ [SETTINGS] Right-click ability: ${enabled}`);
    setKeyBinding('rightClickAbility', enabled);
    updateSettingsDisplay();
}

function setGameRuleFunc(rule, value) {
    console.log(`📜 [SETTINGS] Game rule ${rule} set to: ${value}`);
    setGameRule(rule, value);
    updateSettingsDisplay();
}

function setDevice(mode) {
    console.log(`📱 [SETTINGS] Device mode set to: ${mode}`);
    
    if (mode === 'auto') {
        // Re-detect device
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSmallScreen = window.innerWidth <= 768;
        setDeviceMode(isTouchDevice && isSmallScreen, false);
    } else if (mode === 'mobile') {
        setDeviceMode(true, true);
    } else if (mode === 'desktop') {
        setDeviceMode(false, true);
    }
    
    updateSettingsDisplay();
}

let listeningForKey = null;

function changeKey(action) {
    if (listeningForKey) return;
    
    listeningForKey = action;
    const btn = event.target;
    btn.classList.add('listening');
    btn.innerText = '...לחץ על מקש';
    
    console.log(`⚙️ [SETTINGS] Listening for key for: ${action}`);
    
    const keyListener = (e) => {
        e.preventDefault();
        
        // Don't allow certain keys
        if (['Escape', 'F5', 'F11', 'F12'].includes(e.code)) {
            console.log('⚠️ [SETTINGS] Invalid key');
            return;
        }
        
        console.log(`⚙️ [SETTINGS] Key captured: ${e.code}`);
        setKeyBinding(action, e.code);
        updateSettingsDisplay();
        
        btn.classList.remove('listening');
        btn.innerText = 'שנה מקש';
        
        window.removeEventListener('keydown', keyListener);
        listeningForKey = null;
    };
    
    window.addEventListener('keydown', keyListener);
}

// Export to window
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.setControl = setControl;
window.setRightClick = setRightClick;
window.setGameRule = setGameRuleFunc;
window.setDevice = setDevice;
window.changeKey = changeKey;