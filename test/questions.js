// ===== QUESTION SYSTEM =====
// מציג שאלות בעת פגיעה ביריב (הפסד חיים) ובהתנגשות עם מטאור (cooldown 5 שניות)
// שאלות נטענות מ-questions.json לפי כיתה ומקצוע

import { playerProfile } from './data.js';

let questionsData = null;
let questionModalActive = false;
let onAnswerCallback = null;
let lastAsteroidQuestionTime = 0;
const ASTEROID_COOLDOWN_MS = 5000;

// ===== LOAD QUESTIONS =====
export async function loadQuestions() {
    try {
        const res = await fetch('./questions.json');
        questionsData = await res.json();
        console.log('✅ [QUESTIONS] Loaded questions.json');
    } catch (e) {
        console.error('❌ [QUESTIONS] Failed to load questions.json:', e);
        questionsData = null;
    }
}

// ===== GET RANDOM QUESTION =====
function getRandomQuestion() {
    if (!questionsData) return null;

    const subject = playerProfile.subject || 'science';
    const grade = playerProfile.grade;
    if (!grade) return null;

    const gradeStr = String(grade);
    const pool = questionsData?.subjects?.[subject]?.grades?.[gradeStr];
    if (!pool || pool.length === 0) {
        console.warn(`⚠️ [QUESTIONS] No questions for grade ${grade}, subject ${subject}`);
        return null;
    }

    return pool[Math.floor(Math.random() * pool.length)];
}

// ===== SHOW QUESTION MODAL =====
// type: 'kill' | 'asteroid'
// onAnswer(wasCorrect) - called when user answers
export function showQuestion(type, onAnswer) {
    if (questionModalActive) return false;

    const now = Date.now();
    if (type === 'asteroid') {
        if (now - lastAsteroidQuestionTime < ASTEROID_COOLDOWN_MS) return false;
    }

    const q = getRandomQuestion();
    if (!q) return false; // No question available - don't block gameplay

    if (type === 'asteroid') {
        lastAsteroidQuestionTime = now;
    }

    questionModalActive = true;
    onAnswerCallback = onAnswer;
    _renderModal(q);
    return true;
}

export function isQuestionActive() {
    return questionModalActive;
}

// ===== RENDER MODAL =====
function _renderModal(q) {
    // Remove any existing modal
    const existing = document.getElementById('question-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'question-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.88);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Orbitron', sans-serif;
    `;

    const gradeLabel = playerProfile.grade ? `כיתה ${_gradeHebrew(playerProfile.grade)}` : '';
    const subjectLabel = _subjectHebrew(playerProfile.subject);

    modal.innerHTML = `
        <div style="
            background: rgba(5,5,5,0.95);
            border: 2px solid var(--primary, #00f2ff);
            border-radius: 12px;
            padding: 24px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 0 40px rgba(0,242,255,0.3);
        ">
            <div style="font-size:0.7rem; color: rgba(255,255,255,0.5); margin-bottom:8px;">
                📚 ${subjectLabel} | ${gradeLabel}
            </div>
            <div id="q-question" style="
                font-size: 1rem;
                color: white;
                margin-bottom: 20px;
                line-height: 1.5;
                direction: rtl;
            ">${q.question}</div>
            <div id="q-options" style="display:flex; flex-direction:column; gap:10px;"></div>
            <div id="q-feedback" style="margin-top:16px; font-size:0.9rem; min-height:24px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const optionsContainer = modal.querySelector('#q-options');
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
            padding: 12px 20px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.85rem;
            background: rgba(0,242,255,0.08);
            color: white;
            border: 2px solid rgba(0,242,255,0.3);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            direction: rtl;
            text-align: right;
        `;
        btn.textContent = opt;
        btn.addEventListener('click', () => _handleAnswer(idx, q.correctIndex, modal));
        optionsContainer.appendChild(btn);
    });
}

function _handleAnswer(selectedIdx, correctIdx, modal) {
    const correct = selectedIdx === correctIdx;
    const feedback = modal.querySelector('#q-feedback');
    const buttons = modal.querySelectorAll('button');

    // Disable all buttons
    buttons.forEach((btn, i) => {
        btn.style.pointerEvents = 'none';
        if (i === correctIdx) {
            btn.style.borderColor = '#2ecc71';
            btn.style.background = 'rgba(46,204,113,0.2)';
        } else if (i === selectedIdx && !correct) {
            btn.style.borderColor = '#ff4d4d';
            btn.style.background = 'rgba(255,77,77,0.2)';
        }
    });

    if (correct) {
        feedback.style.color = '#2ecc71';
        feedback.textContent = '✅ נכון! כל הכבוד!';
    } else {
        feedback.style.color = '#ff4d4d';
        feedback.textContent = `❌ לא נכון. התשובה הנכונה: ${modal.querySelectorAll('button')[correctIdx]?.textContent || ''}`;
    }

    setTimeout(() => {
        modal.remove();
        questionModalActive = false;
        if (onAnswerCallback) {
            onAnswerCallback(correct);
            onAnswerCallback = null;
        }
    }, 1500);
}

// ===== HELPERS =====
function _gradeHebrew(grade) {
    const map = { 1:'א', 2:'ב', 3:'ג', 4:'ד', 5:'ה', 6:'ו', 7:'ז', 8:'ח', 9:'ט', 10:'י', 11:'י"א', 12:'י"ב' };
    return map[grade] || grade;
}

function _subjectHebrew(subject) {
    const map = { science: 'מדעים' };
    return map[subject] || subject;
}

export function resetAsteroidCooldown() {
    lastAsteroidQuestionTime = 0;
}
