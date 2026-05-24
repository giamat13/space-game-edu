// ===== FIRESTORE SYNC SYSTEM =====
// סנכרון ציונים ומקסימום רמה בין מכשירים
// משתמש ב-Firestore לשמירה בענן + Cookies למטמון מקומי

import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

// ===== USE EXISTING FIREBASE APP =====
// We use the existing Firebase app initialized in auth.js
let db, auth;

function initializeFirestoreSync() {
    try {
        const app = getApp(); // Get the default app initialized in auth.js
        db = getFirestore(app);
        auth = getAuth(app);
        console.log('✅ [FIRESTORE] Connected to existing Firebase app');
        return true;
    } catch (error) {
        console.error('❌ [FIRESTORE] Error connecting to Firebase:', error);
        return false;
    }
}

// ===== HELPER FUNCTIONS =====
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) {
            return c.substring(nameEQ.length, c.length);
        }
    }
    return null;
}

// ===== SYNC UNLOCKED SKINS =====
export async function syncUnlockedSkins() {
    if (!auth) {
        console.error('❌ [SYNC] Auth not initialized');
        return JSON.parse(getCookie('unlockedSkins') || '["classic", "interceptor", "tanker"]');
    }

    const user = auth.currentUser;
    if (!user) {
        console.log('⚠️ [SYNC] Not logged in, using local skins only');
        return JSON.parse(getCookie('unlockedSkins') || '["classic", "interceptor", "tanker"]');
    }

    try {
        console.log('🔄 [SYNC] Syncing unlocked skins...');
        
        // קריאה מ-Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const cloudSkins = userDoc.data().unlockedSkins || ['classic', 'interceptor', 'tanker'];
            const localSkins = JSON.parse(getCookie('unlockedSkins') || '["classic", "interceptor", "tanker"]');
            
            // מיזוג - כל סקין שקיים באחד מהמקורות
            const mergedSkins = [...new Set([...cloudSkins, ...localSkins])];
            
            // עדכון בענן וב-Cookies
            await setDoc(doc(db, 'users', user.uid), {
                unlockedSkins: mergedSkins,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            setCookie('unlockedSkins', JSON.stringify(mergedSkins));
            console.log('✅ [SYNC] Skins synced:', mergedSkins);
            return mergedSkins;
        } else {
            // אין מסמך - צור חדש
            const localSkins = JSON.parse(getCookie('unlockedSkins') || '["classic", "interceptor", "tanker"]');
            await setDoc(doc(db, 'users', user.uid), {
                unlockedSkins: localSkins,
                lastUpdated: serverTimestamp()
            });
            console.log('✅ [SYNC] Created new user document');
            return localSkins;
        }
    } catch (error) {
        console.error('❌ [SYNC] Error syncing skins:', error);
        return JSON.parse(getCookie('unlockedSkins') || '["classic", "interceptor", "tanker"]');
    }
}

// ===== SYNC MAX LEVEL =====
export async function syncMaxLevel() {
    if (!auth) {
        console.error('❌ [SYNC] Auth not initialized');
        return parseInt(getCookie('maxLevel') || '1');
    }

    const user = auth.currentUser;
    if (!user) {
        console.log('⚠️ [SYNC] Not logged in, using local max level only');
        return parseInt(getCookie('maxLevel') || '1');
    }

    try {
        console.log('🔄 [SYNC] Syncing max level...');
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const cloudMaxLevel = userDoc.data().maxLevel || 1;
            const localMaxLevel = parseInt(getCookie('maxLevel') || '1');
            
            // השתמש בגבוה מבין השניים
            const maxLevel = Math.max(cloudMaxLevel, localMaxLevel);
            
            // עדכון בענן וב-Cookies
            await setDoc(doc(db, 'users', user.uid), {
                maxLevel: maxLevel,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            setCookie('maxLevel', maxLevel.toString());
            console.log('✅ [SYNC] Max level synced:', maxLevel);
            return maxLevel;
        } else {
            const localMaxLevel = parseInt(getCookie('maxLevel') || '1');
            await setDoc(doc(db, 'users', user.uid), {
                maxLevel: localMaxLevel,
                lastUpdated: serverTimestamp()
            });
            return localMaxLevel;
        }
    } catch (error) {
        console.error('❌ [SYNC] Error syncing max level:', error);
        return parseInt(getCookie('maxLevel') || '1');
    }
}

// ===== SAVE SCORE TO FIRESTORE =====
export async function saveScoreToCloud(skinKey, score, level, userName) {
    if (!auth || !db) {
        console.error('❌ [CLOUD] Firebase not initialized');
        return false;
    }

    const user = auth.currentUser;
    if (!user) {
        console.log('⚠️ [CLOUD] Not logged in, saving locally only');
        return false;
    }

    try {
        console.log(`☁️ [CLOUD] Saving score: ${score} pts, Level ${level}, Skin: ${skinKey}`);
        
        // שמירה ב-collection הספציפי לסקין
        const scoreData = {
            userId: user.uid,
            userName: userName || user.displayName || user.email?.split('@')[0] || 'Anonymous',
            email: user.email,
            score: score,
            level: level,
            skin: skinKey,
            timestamp: serverTimestamp(),
            date: new Date().toLocaleDateString('he-IL')
        };
        
        // שמירה ב-leaderboard הכללי
        await addDoc(collection(db, 'leaderboard'), scoreData);
        
        // שמירה ב-leaderboard לפי סקין
        await addDoc(collection(db, `scores/${skinKey}/entries`), scoreData);
        
        // עדכון סטטיסטיקות משתמש
        const userStatsRef = doc(db, 'userStats', user.uid);
        const userStats = await getDoc(userStatsRef);
        
        if (userStats.exists()) {
            const currentBest = userStats.data().bestScore || 0;
            if (score > currentBest) {
                await updateDoc(userStatsRef, {
                    bestScore: score,
                    bestLevel: level,
                    bestSkin: skinKey,
                    totalGames: (userStats.data().totalGames || 0) + 1,
                    lastPlayed: serverTimestamp()
                });
            } else {
                await updateDoc(userStatsRef, {
                    totalGames: (userStats.data().totalGames || 0) + 1,
                    lastPlayed: serverTimestamp()
                });
            }
        } else {
            await setDoc(userStatsRef, {
                bestScore: score,
                bestLevel: level,
                bestSkin: skinKey,
                totalGames: 1,
                lastPlayed: serverTimestamp()
            });
        }
        
        console.log('✅ [CLOUD] Score saved successfully');
        return true;
    } catch (error) {
        console.error('❌ [CLOUD] Error saving score:', error);
        return false;
    }
}

// ===== GET LEADERBOARD FROM FIRESTORE =====
export async function getLeaderboardFromCloud(skinKey = 'overall') {
    if (!db) {
        console.error('❌ [CLOUD] Firestore not initialized');
        return [];
    }

    try {
        console.log(`🏆 [CLOUD] Fetching ${skinKey} leaderboard...`);
        
        let q;
        if (skinKey === 'overall') {
            q = query(
                collection(db, 'leaderboard'),
                orderBy('score', 'desc'),
                limit(10)
            );
        } else {
            q = query(
                collection(db, `scores/${skinKey}/entries`),
                orderBy('score', 'desc'),
                limit(10)
            );
        }
        
        const querySnapshot = await getDocs(q);
        const scores = [];
        
        querySnapshot.forEach((doc) => {
            scores.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ [CLOUD] Fetched ${scores.length} scores`);
        return scores;
    } catch (error) {
        console.error('❌ [CLOUD] Error fetching leaderboard:', error);
        return [];
    }
}

// ===== GET USER'S PERSONAL BEST =====
export async function getUserPersonalBest() {
    if (!auth || !db) {
        console.error('❌ [CLOUD] Firebase not initialized');
        return null;
    }

    const user = auth.currentUser;
    if (!user) return null;

    try {
        const userStatsRef = doc(db, 'userStats', user.uid);
        const userStats = await getDoc(userStatsRef);
        
        if (userStats.exists()) {
            return userStats.data();
        }
        return null;
    } catch (error) {
        console.error('❌ [CLOUD] Error fetching personal best:', error);
        return null;
    }
}

// ===== UNLOCK SKIN IN CLOUD =====
export async function unlockSkinInCloud(skinKey) {
    if (!auth || !db) {
        console.error('❌ [CLOUD] Firebase not initialized');
        return false;
    }

    const user = auth.currentUser;
    if (!user) {
        console.log('⚠️ [CLOUD] Not logged in, unlocking locally only');
        return false;
    }

    try {
        console.log(`🔓 [CLOUD] Unlocking skin: ${skinKey}`);
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let currentSkins = ['classic', 'interceptor', 'tanker'];
        
        if (userDoc.exists()) {
            currentSkins = userDoc.data().unlockedSkins || currentSkins;
        }
        
        if (!currentSkins.includes(skinKey)) {
            currentSkins.push(skinKey);
            
            await setDoc(doc(db, 'users', user.uid), {
                unlockedSkins: currentSkins,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            
            console.log('✅ [CLOUD] Skin unlocked in cloud');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ [CLOUD] Error unlocking skin:', error);
        return false;
    }
}

// ===== SYNC ALL DATA =====
export async function syncAllData() {
    if (!auth) {
        console.error('❌ [SYNC] Auth not initialized');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        console.log('⚠️ [SYNC] Not logged in, skipping cloud sync');
        return;
    }

    console.log('🔄 [SYNC] Starting full sync...');
    
    try {
        await Promise.all([
            syncUnlockedSkins(),
            syncMaxLevel()
        ]);
        console.log('✅ [SYNC] Full sync complete');
    } catch (error) {
        console.error('❌ [SYNC] Error during full sync:', error);
    }
}

// ===== AUTO-SYNC ON AUTH CHANGE =====
export function initFirestoreSync() {
    console.log('🔄 [FIRESTORE] Initializing sync system...');
    
    // Initialize Firestore connection first
    const initialized = initializeFirestoreSync();
    
    if (!initialized || !auth) {
        console.error('❌ [FIRESTORE] Failed to initialize - auth not available');
        return;
    }
    
    // Then set up auth listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('✅ [FIRESTORE] User logged in, syncing data...');
            await syncAllData();
        } else {
            console.log('❌ [FIRESTORE] User logged out');
        }
    });
}

// ===== EXPORTS =====
export { db, auth };