import { DOM, state, INGREDIENT_TYPES } from './data.js';

// ===== PLAYER SYSTEMS =====

export function updatePlayerPos() {
    DOM.player.style.left = state.playerX + 'px';
}

export function updateHPUI() {
    const percent = (Math.max(0, state.playerHP) / state.playerMaxHP) * 100;
    DOM.playerHpFill.style.width = percent + '%';
    DOM.playerHpFill.style.background = percent < 30 ? 'var(--danger)' : 'var(--health)';
    
    // Update top HP bar
    if (DOM.topHpBar) {
        DOM.topHpBar.style.width = percent + '%';
        DOM.topHpBar.style.background = percent < 30 ? 'var(--danger)' : 'var(--health)';
    }
    
    // Update HP text
    if (DOM.hpText) {
        DOM.hpText.innerText = `${Math.max(0, Math.round(state.playerHP))}/${state.playerMaxHP}`;
    }
}

export function movePlayer(clientX) {
    const rect = DOM.wrapper.getBoundingClientRect();
    let x = clientX - rect.left - 25;
    state.playerX = Math.max(0, Math.min(x, DOM.wrapper.clientWidth - 50));
    updatePlayerPos();
}

export function damagePlayer(amount) {
    state.playerHP -= amount;
    console.log(`💥 [DAMAGE] -${amount} HP | Now: ${state.playerHP}/${state.playerMaxHP}`);
    
    // Check if player should lose weight
    if (state.isPlayerFat && state.playerHP < state.playerMaxHP - 1) {
        state.isPlayerFat = false;
        state.burgersEatenAtFullHP = 0;
        DOM.player.style.transform = 'scale(1)';
        console.log('🏃 [FAT] Weight lost! Back to normal');
        showFloatingMessage("WEIGHT LOST!", state.playerX, DOM.wrapper.clientHeight - 120, "#00ff00");
    }
    
    updateHPUI();
    const flash = document.createElement('div');
    flash.className = 'damage-flash';
    DOM.wrapper.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
    
    if(state.playerHP <= 0) {
        console.log('💀 [GAME OVER] Final Score:', state.score, 'Level:', state.level);
        state.active = false;
        
        import('./data.js').then(module => {
            // Get username from auth module
            import('./auth.js').then(authModule => {
                const userName = authModule.currentUser?.displayName || 'Anonymous';
                module.saveScore(module.currentSkinKey, state.score, state.level, userName);
                console.log(`✅ [GAME OVER] Score saved for user: ${userName}`);
            });
        }).catch(err => {
            console.error('❌ [GAME OVER] Save error:', err);
        });
        
        DOM.overlay.style.display = 'flex';
        document.getElementById('title').innerText = "Game Over";
        document.getElementById('sub-title').innerHTML = `הספינה שלך הושמדה!<br>ניקוד סופי: ${state.score}<br>שלב: ${state.level}`;
        document.getElementById('leaderboard-container').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    }
}

export function healPlayer(percent) {
    const amount = state.playerMaxHP * (percent / 100);
    state.playerHP = Math.min(state.playerMaxHP, state.playerHP + amount);
    console.log(`💚 [HEAL] +${percent}% | Now: ${state.playerHP}/${state.playerMaxHP}`);
    updateHPUI();
    showFloatingMessage(`REPAIR +${percent}%`, state.playerX, DOM.wrapper.clientHeight - 100, "var(--health)");
}

// ===== SHOOTING SYSTEMS =====

export function shoot() {
    if(!state.active) return;
    const now = Date.now();
    const adjustedCooldown = state.shotCooldown / state.currentSkinStats.fireRate;
    if (now - state.lastShot < adjustedCooldown) return;
    state.lastShot = now;

    const b = document.createElement('div');
    b.className = 'bullet';
    b.style.left = (state.playerX + 23) + 'px';
    b.style.bottom = '80px';
    
    if (state.currentSkinStats.bulletDamage >= 3.0) {
        b.style.width = '8px';
        b.style.height = '25px';
        b.style.background = 'linear-gradient(to top, #ff4500, #ffa500, #ffff00)';
        b.style.boxShadow = '0 0 25px #ff4500, 0 0 15px #ffa500, 0 0 8px #ffff00';
        b.style.borderRadius = '50% 50% 40% 40%';
        b.dataset.isFire = 'true';
    } else if (state.currentSkinStats.bulletDamage > 1.5) {
        b.style.width = '6px';
        b.style.height = '20px';
        b.style.boxShadow = '0 0 20px var(--primary), 0 0 10px #fff';
    } else if (state.currentSkinStats.bulletDamage > 1.0) {
        b.style.width = '5px';
        b.style.height = '18px';
        b.style.boxShadow = '0 0 15px var(--primary)';
    }
    
    DOM.wrapper.appendChild(b);
    state.bullets.push({ 
        el: b, 
        y: 80,
        damage: state.currentSkinStats.bulletDamage
    });
}

export function enemyShoot(en) {
    if (!state.active) return;
    
    const eb = document.createElement('div');
    eb.className = 'enemy-bullet';
    if (en.type === 'orange') eb.style.background = 'var(--elite)';
    
    const enLeft = parseFloat(en.el.style.left) + 20;
    const enTop = en.y + 40;
    
    let targetX, targetY;
    
    // Chaotic enemies always target normal enemies
    if (en.isChaotic) {
        // Target any normal enemy regardless of position
        const normalEnemies = state.enemies.filter(e => !e.isChaotic && e.el !== en.el);
        if (normalEnemies.length > 0) {
            const targetEnemy = normalEnemies[Math.floor(Math.random() * normalEnemies.length)];
            targetX = parseFloat(targetEnemy.el.style.left) + 25;
            targetY = targetEnemy.y + 25;
            eb.dataset.chaoticShot = "true";
            eb.style.background = '#00f2ff';
            eb.style.boxShadow = '0 0 10px #00f2ff';
            console.log(`🃏 [CHAOTIC] Enemy at Y=${en.y.toFixed(0)} shooting at normal enemy at Y=${targetEnemy.y.toFixed(0)}`);
        } else {
            // No normal enemies, don't shoot
            console.log(`🃏 [CHAOTIC] Enemy at Y=${en.y.toFixed(0)} has no normal enemies to target`);
            return;
        }
    } else if (Math.random() < 0.05 && state.enemies.length > 1) {
        // 5% chance to friendly fire (only for normal enemies)
        const otherEnemies = state.enemies.filter(e => e.el !== en.el);
        const targetEnemy = otherEnemies[Math.floor(Math.random() * otherEnemies.length)];
        targetX = parseFloat(targetEnemy.el.style.left) + 25;
        targetY = targetEnemy.y + 25;
        eb.dataset.friendlyFire = "true";
    } else {
        // Normal shot at player
        targetX = state.playerX + 25;
        targetY = DOM.wrapper.clientHeight - 55;
    }
    
    const dx = targetX - enLeft;
    const dy = targetY - enTop;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    const speed = (en.type === 'orange' ? 7 : 5.5) * state.speedMult;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    eb.style.left = enLeft + 'px';
    eb.style.top = enTop + 'px';
    eb.style.transform = `rotate(${angle - 90}deg)`;
    
    DOM.wrapper.appendChild(eb);
    state.enemyBullets.push({ 
        el: eb, 
        x: enLeft, 
        y: enTop, 
        vx: vx, 
        vy: vy, 
        friendly: !!eb.dataset.friendlyFire,
        chaotic: !!eb.dataset.chaoticShot,
        shooterId: en.el
    });
}

// ===== VISUAL EFFECTS =====

export function createExplosion(x, y, color) {
    for(let i=0; i<15; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.background = color;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        DOM.wrapper.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 60 + 10;
        p.animate([
            { opacity: 1 }, 
            { transform: `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`, opacity: 0 }
        ], 500).onfinish = () => p.remove();
    }
}

export function showFloatingMessage(text, x, y, color) {
    const msg = document.createElement('div');
    msg.className = 'floating-msg';
    msg.innerText = text;
    msg.style.left = x + 'px';
    msg.style.top = y + 'px';
    msg.style.color = color || 'white';
    DOM.wrapper.appendChild(msg);
    setTimeout(() => msg.remove(), 1000);
}

// ===== SPECIAL ABILITIES =====

export function usePhoenixFeathers() {
    console.log('🔥 [PHOENIX] Activating feathers!');
    
    const playerCenterX = state.playerX + 25;
    const playerY = DOM.wrapper.clientHeight - 90;
    
    const targetX = state.lastMouseX || playerCenterX;
    const targetY = state.lastMouseY || playerY - 100;
    
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const feather = document.createElement('div');
            feather.className = 'phoenix-feather';
            feather.style.left = playerCenterX + 'px';
            feather.style.bottom = '90px';
            feather.innerHTML = `<svg viewBox="0 0 20 40" style="width:100%; height:100%;">
                <path d="M10 0 L15 15 L10 40 L5 15 Z" fill="#ff6b35" />
                <path d="M10 5 L12 12 L10 20 L8 12 Z" fill="#ffd700" />
            </svg>`;
            DOM.wrapper.appendChild(feather);
            
            const spread = (i - 1) * 15;
            const angle = Math.atan2(targetY - playerY, targetX - playerCenterX) + (spread * Math.PI / 180);
            
            state.bullets.push({
                el: feather,
                y: 90,
                isFeather: true,
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                damage: 5.0
            });
        }, i * 100);
    }
    
    showFloatingMessage('PHOENIX FEATHERS!', playerCenterX - 60, playerY - 50, '#ff6b35');
    console.log('✅ [PHOENIX] 3 Feathers launched');
}

export function useVortexLaser() {
    console.log('⚡ [VORTEX] Activating laser!');
    const playerCenterX = state.playerX + 25;
    const playerY = DOM.wrapper.clientHeight - 90;
    
    const numBeams = 12;
    for (let i = 0; i < numBeams; i++) {
        const angle = (i / numBeams) * 360;
        const laser = document.createElement('div');
        laser.className = 'laser-beam';
        laser.style.left = playerCenterX + 'px';
        laser.style.bottom = '90px';
        laser.style.transform = `rotate(${angle}deg)`;
        DOM.wrapper.appendChild(laser);
        setTimeout(() => laser.remove(), 300);
    }
    
    let killCount = 0;
    
    // Kill enemies and GIVE POINTS
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const en = state.enemies[i];
        const isElite = en.type === 'orange';
        const points = isElite ? 150 : 50;
        state.score += points; // ✅ ADD POINTS
        const eRect = en.el.getBoundingClientRect();
        createExplosion(eRect.left + 25, eRect.top + 25, isElite ? 'var(--elite)' : 'var(--danger)');
        en.el.remove();
        state.enemies.splice(i, 1);
        killCount++;
    }
    
    // Kill asteroids (no points for asteroids)
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
        const ast = state.asteroids[i];
        const aRect = ast.el.getBoundingClientRect();
        createExplosion(aRect.left + 25, aRect.top + 25, 'var(--stone)');
        ast.el.remove();
        state.asteroids.splice(i, 1);
        killCount++;
    }
    
    // Destroy enemy bullets
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const eb = state.enemyBullets[i];
        createExplosion(eb.x, eb.y, '#ff0000');
        eb.el.remove();
        state.enemyBullets.splice(i, 1);
    }
    
    DOM.scoreEl.innerText = state.score; // Update score display
    
    if (killCount > 0) {
        showFloatingMessage(`VORTEX LASER: ${killCount} KILLS!`, playerCenterX - 80, playerY - 50, 'var(--primary)');
    }
    
    console.log(`✅ [VORTEX] Killed: ${killCount}, Score: ${state.score}`);
}

export function useJokerChaos() {
    console.log('🃏 [JOKER] Activating CHAOS MODE!');
    const playerCenterX = state.playerX + 25;
    const playerY = DOM.wrapper.clientHeight - 90;
    
    // Set chaos mode active for 10 seconds
    state.jokerAbility.active = true;
    state.jokerAbility.endTime = Date.now() + 10000;
    
    // Convert all existing enemies to chaos and GIVE 75% POINTS
    let convertedCount = 0;
    let pointsGained = 0;
    for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (!en.isChaotic) {
            en.isChaotic = true;
            en.hitsByChaos = {}; // Track hits by other chaotic enemies
            en.el.style.filter = 'hue-rotate(180deg) brightness(1.3)';
            en.el.style.border = '2px solid #00f2ff';
            // Add delay before chaotic can shoot to avoid immediate collision
            en.lastShot = Date.now() + 1000; // 1 second delay before first shot
            
            // ✅ GIVE 75% OF POINTS
            const isElite = en.type === 'orange';
            const fullPoints = isElite ? 150 : 50;
            const partialPoints = Math.floor(fullPoints * 0.75); // 75%
            state.score += partialPoints;
            pointsGained += partialPoints;
            
            convertedCount++;
        }
    }
    
    // Update score display
    DOM.scoreEl.innerText = state.score;
    
    // Visual effect - chaos wave
    const chaosWave = document.createElement('div');
    chaosWave.style.position = 'absolute';
    chaosWave.style.left = playerCenterX + 'px';
    chaosWave.style.bottom = '90px';
    chaosWave.style.width = '40px';
    chaosWave.style.height = '40px';
    chaosWave.style.borderRadius = '50%';
    chaosWave.style.background = 'radial-gradient(circle, rgba(0,242,255,0.8), transparent)';
    chaosWave.style.boxShadow = '0 0 30px #00f2ff';
    chaosWave.style.pointerEvents = 'none';
    chaosWave.style.zIndex = '100';
    DOM.wrapper.appendChild(chaosWave);
    
    chaosWave.animate([
        { transform: 'translate(-50%, 50%) scale(1)', opacity: 1 },
        { transform: 'translate(-50%, 50%) scale(20)', opacity: 0 }
    ], {
        duration: 1000,
        easing: 'ease-out'
    }).onfinish = () => chaosWave.remove();
    
    showFloatingMessage(`CHAOS! +${pointsGained} PTS`, playerCenterX - 90, playerY - 50, '#00f2ff');
    console.log(`✅ [JOKER] ${convertedCount} enemies turned chaotic, +${pointsGained} points, Total: ${state.score}`);
}

// ===== SPAWNING SYSTEMS =====

export function spawnIngredients(x, y) {
    INGREDIENT_TYPES.forEach(type => {
        const ing = document.createElement('div');
        ing.className = 'ingredient';
        ing.style.left = x + 'px';
        ing.style.top = y + 'px';
        ing.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${type.color}"/></svg>`;
        DOM.wrapper.appendChild(ing);
        state.ingredients.push({
            el: ing,
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 2
        });
    });
}

export function handleSpawning(now) {
    if(now - state.lastSpawn > state.spawnRate) {
        const posX = Math.random() * (DOM.wrapper.clientWidth - 50);
        const el = document.createElement('div');
        const spawnRoll = Math.random();
        
        if (spawnRoll < 0.1) {
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
        } else if (spawnRoll < 0.5) {
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
        } else {
            const orangeChance = Math.min(0.8, 0.25 + (state.level * 0.05));
            const isOrange = Math.random() < orangeChance; 
            const type = isOrange ? 'orange' : 'red';
            const maxHP = isOrange ? (Math.floor(Math.random() * 3) + 3) : (Math.floor(Math.random() * 3) + 1);
            const colorCode = isOrange ? '#ff9900' : '#ff0000';
            el.className = `enemy-ship ${type}`;
            el.style.left = posX + 'px'; 
            el.style.top = '-60px';
            el.innerHTML = `<div class="hp-bar-container"><div class="hp-bar-fill enemy-hp-fill"></div></div><svg viewBox="0 0 100 100" style="width:100%; height:100%;"><path d="M10 20 L50 90 L90 20 L50 40 Z" fill="${colorCode}" stroke="#fff" stroke-width="2"/></svg>`;
            DOM.wrapper.appendChild(el);
            
            // Check if chaos mode is active
            const isChaotic = state.jokerAbility && state.jokerAbility.active;
            if (isChaotic) {
                el.style.filter = 'hue-rotate(180deg) brightness(1.3)';
                el.style.border = '2px solid #00f2ff';
            }
            
            state.enemies.push({ 
                el: el, 
                hpFill: el.querySelector('.enemy-hp-fill'),
                type: type, 
                y: -60, 
                hp: maxHP, 
                maxHP: maxHP,
                speed: (Math.random() * 0.8 + 0.6) * state.speedMult,
                lastShot: now + Math.random() * 500,
                fireRate: (isOrange ? 600 : 1000) / state.speedMult,
                isChaotic: isChaotic,
                hitsByChaos: isChaotic ? {} : undefined
            });
        }
        state.lastSpawn = now;
    }
}
