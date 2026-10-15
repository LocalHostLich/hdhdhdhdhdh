let gameData = {};
let START_DATE, TARGET_DATE;
let currentQIndex = -1;
let sigilTutorialShown = false;
let falloutTutorialShown = false;
let invadersTutorialShown = false;
let falloutOpened = false;   // Sector I: init only on first open, so re-opening keeps progress
let sigilOpened = false;     // Sector II: init only on first open, so re-opening keeps progress
let invadersOpened = false;  // Sector III: init only on first open, so re-opening keeps progress
let falloutTries = 4;
let isFalloutLocked = false;
let currentFalloutWords = [];
let currentFalloutTarget = "";
let sigilLocked = false;
let falloutCooldownTimer = null;
let sigilCooldownTimer = null;

const COOLDOWN_SECONDS = 60;

// --- ОБЩ ТАЙМАУТ/ИЗЧАКВАНЕ ХЕЛПЪР (използва се от пъзел I и II) ---
// onTick(secondsLeft) се вика веднъж в секунда, onDone() се вика когато изчакването приключи.
function runCooldown(seconds, onTick, onDone) {
    let left = seconds;
    onTick(left);
    const timer = setInterval(() => {
        left--;
        if (left <= 0) {
            clearInterval(timer);
            onDone();
        } else {
            onTick(left);
        }
    }, 1000);
    return timer;
}

const tickAudio = document.getElementById('tick-audio');
const hoverAudio = document.getElementById('hover-audio');
const dataSound = document.getElementById('data-sound');
const bgMusic = document.getElementById('bg-music');
const grantedSound = document.getElementById('access-granted-sound');
const deniedSound = document.getElementById('access-denied-sound');
const menuChangeSound = document.getElementById('menu-change-sound');
const menuChange2Sound = document.getElementById('menu-change-2-sound');

const symbolsArray = "!@#$%^&*-=_+/?|;";
const bracketPairs = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']];
let baseHex = 0x5BA0;

window.onload = () => {
    // Start the logo + matrix rain intro
    startLogoIntro();

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            gameData = data;
            START_DATE = parseInt(fromBase64(data.settings.start_date));
            TARGET_DATE = parseInt(fromBase64(data.settings.target_date));
        })
        .catch(err => console.error(err));
};

function fromBase64(str) { try { return decodeURIComponent(escape(atob(str))); } catch (e) { return ""; } }
function toBase64(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return ""; } }

// --- ЗВУК ПРИ ПОСОЧВАНЕ ---
window.playHoverSound = function () {
    if (isFalloutLocked) return;
    hoverAudio.currentTime = 0;
    hoverAudio.volume = 0.2;
    hoverAudio.play().catch(() => { });
}

// --- ПЪРВОНАЧАЛЕН ЕКРАН И ЛОГВАНЕ ---
document.getElementById('start-overlay').addEventListener('click', function () {
    // Unlock all audio elements with a muted play+pause so later .play() calls
    // (triggered from keydown handlers etc.) are not blocked by autoplay policy
    [tickAudio, hoverAudio, dataSound, grantedSound, deniedSound, menuChangeSound, menuChange2Sound].forEach(a => {
        if (!a) return;
        const prevMuted = a.muted;
        a.muted = true;
        a.play().then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = prevMuted;
        }).catch(() => { a.muted = prevMuted; });
    });

    this.style.opacity = '0';
    setTimeout(() => {
        this.style.display = 'none';
        startLoginSequence();
    }, 500);
});

function typeText(elementId, text, speed, callback) {
    let i = 0;
    const el = document.getElementById(elementId);
    function type() {
        if (i < text.length) {
            el.innerHTML += text.charAt(i);
            tickAudio.currentTime = 0; tickAudio.play().catch(() => { });
            i++; setTimeout(type, speed);
        } else if (callback) { setTimeout(callback, 500); }
    }
    type();
}

function startLoginSequence() {
    document.getElementById('login-screen').style.display = 'flex';
    typeText('auto-username', 'root', 150, () => {
        document.getElementById('user-cursor').style.display = 'none';
        // Show password row and cursor
        document.getElementById('pass-cursor').style.display = 'inline-block';

        const passwordInput = document.getElementById('manual-password-input');
        const passDisplay = document.getElementById('pass-display');
        const errorMsg = document.getElementById('login-error-msg');

        // Enable the hidden input and focus it
        passwordInput.style.pointerEvents = 'auto';
        passwordInput.removeAttribute('style');
        passwordInput.style.position = 'absolute';
        passwordInput.style.opacity = '0';
        passwordInput.style.width = '1px';
        passwordInput.style.height = '1px';
        passwordInput.focus();

        const CORRECT_PASSWORD = 'Schrod1ngers_Cat!';
        const DEV_PASSWORD = 'root'; // ВРЕМЕННА ПАРОЛА ЗА РАЗРАБОТКА - ПРЕМАХНИ ПРЕДИ LAUNCH

        passwordInput.addEventListener('input', function () {
            // Show asterisks in the display span
            passDisplay.textContent = '*'.repeat(passwordInput.value.length);
            tickAudio.currentTime = 0;
            tickAudio.volume = 0.15;
            tickAudio.play().catch(() => { });
        });

        passwordInput.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Enter') {
                const val = passwordInput.value;

                if (val === CORRECT_PASSWORD || val === DEV_PASSWORD) {
                    grantedSound.currentTime = 0;
                    grantedSound.volume = 0.9;
                    grantedSound.play().catch(err => console.error('Access granted sound failed:', err));
                    passwordInput.disabled = true;
                    document.getElementById('pass-cursor').style.display = 'none';
                    errorMsg.style.display = 'none';
                    setTimeout(bootTerminal, 800);
                } else {
                    deniedSound.currentTime = 0;
                    deniedSound.volume = 0.9;
                    deniedSound.play().catch(err => console.error('Access denied sound failed:', err));
                    errorMsg.style.display = 'block';
                    passwordInput.value = '';
                    passDisplay.textContent = '';
                    passwordInput.focus();

                    clearTimeout(errorMsg._hideTimeout);
                    errorMsg._hideTimeout = setTimeout(() => {
                        errorMsg.style.display = 'none';
                    }, 5000);
                }
            }
        });

        // Keep focus on hidden input when clicking anywhere on login screen
        document.getElementById('login-screen').addEventListener('click', () => {
            passwordInput.focus();
        });
    });
}

function bootTerminal() {
    document.getElementById('login-screen').style.display = 'none';
    startPipOsBoot();
}

// --- PIP-OS BOOT SEQUENCE ---
function startPipOsBoot() {
    const screen = document.getElementById('pip-os-screen');
    const textEl = document.getElementById('pip-os-text');
    const headerEl = document.getElementById('pip-os-header');
    const cursorEl = document.getElementById('pip-os-cursor');
    const inner = document.getElementById('pip-os-inner');

    const osStartSound = document.getElementById('text-os-start');
    const osEndSound = document.getElementById('text-os-end');
    const thumbsUpSound = document.getElementById('thumbs-up-sound');
    const shakeSound = document.getElementById('screen-shake-sound');
    const tickAudioEl = document.getElementById('tick-audio');

    screen.style.display = 'flex';

    const headerText = '*************** ПРАВЕЦ-OS(R) В7.1.0.8 ***************';
    const bodyText =
        `

COPYRIGHT 2077 ROBCO(R)
LOADER В1.6
EXEC VERSION 64.10
64K RAM SYSTEM
38911 BYTES FREE
NO HOLOTAPE FOUND !
LOAD ROM(1): DEITRIX 505


> INITIALIZING ROBCO SYSTEM SECURE BOOT...
> MEMORY CHECK: 640K OK.
> LOADING KERNEL PROTOCOLS...
> WELCOME, ADMINISTRATOR.`;

    // Start OS sound
    osStartSound.volume = 0.7;
    osStartSound.play().catch(() => { });

    // Hide the original static cursor — render cursor after textEl instead
    cursorEl.style.display = 'none';
    const inlineCursor = document.createElement('span');
    inlineCursor.className = 'block-cursor';
    textEl.insertAdjacentElement('afterend', inlineCursor);

    let typed = '';
    let charIndex = 0;
    const CHAR_SPEED = 22;

    // Phase 1: type the big header
    function typeHeader() {
        if (charIndex < headerText.length) {
            typed += headerText[charIndex];
            headerEl.textContent = typed;
            const ch = headerText[charIndex];
            if (ch !== ' ') {
                tickAudioEl.currentTime = 0;
                tickAudioEl.volume = 0.1;
                tickAudioEl.play().catch(() => { });
            }
            charIndex++;
            setTimeout(typeHeader, CHAR_SPEED);
        } else {
            // Header done — start body
            typed = '';
            charIndex = 0;
            setTimeout(typeBody, 200);
        }
    }

    // Phase 2: type the body text
    function typeBody() {
        if (charIndex < bodyText.length) {
            const ch = bodyText[charIndex];
            typed += ch;
            textEl.textContent = typed;
            if (ch !== ' ' && ch !== '\n') {
                tickAudioEl.currentTime = 0;
                tickAudioEl.volume = 0.1;
                tickAudioEl.play().catch(() => { });
            }
            charIndex++;
            const delay = ch === '\n' ? 80 : CHAR_SPEED;
            setTimeout(typeBody, delay);
        } else {
            // Done typing — wait 1.5s then slide up
            setTimeout(() => {
                osStartSound.pause();
                osStartSound.currentTime = 0;
                osEndSound.volume = 0.7;
                osEndSound.play().catch(() => { });
                inlineCursor.style.display = 'none';
                inner.getBoundingClientRect();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        inner.classList.add('slide-up');
                    });
                });
                setTimeout(() => {
                    screen.style.display = 'none';
                    osEndSound.pause();
                    osEndSound.currentTime = 0;
                    startVaultBoySequence(thumbsUpSound, shakeSound);
                }, 900);
            }, 1500);
        }
    }

    typeHeader();
}

// --- VAULT BOY ANIMATION ---
function startVaultBoySequence(thumbsUpSound, shakeSound) {
    const vbScreen = document.getElementById('vaultboy-screen');
    const initText = document.getElementById('initiating-text');

    // Replace <img> with <canvas> for pixel-level background removal
    const oldImg = document.getElementById('vaultboy-img');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 380;
    canvas.style.filter = 'drop-shadow(0 0 12px rgba(42, 255, 0, 0.4))';
    oldImg.parentNode.replaceChild(canvas, oldImg);
    const ctx = canvas.getContext('2d');

    // Draw image on canvas and remove dark/black background pixels
    function drawFrameWithoutBg(src, callback) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                if (brightness < 30) {
                    data[i + 3] = 0;
                } else if (brightness < 60) {
                    data[i + 3] = Math.round((brightness - 30) / 30 * 255);
                }
            }
            ctx.putImageData(imageData, 0, 0);
            if (callback) callback();
        };
        img.src = src;
    }

    const frames = [
        'vaultboy1.png',
        'vaultboy2.png',
        'vaultboy3.png',
        'vaultboy4.png',
        'vaultboy5.png',
        'vaultboy6.png'
    ];

    vbScreen.style.display = 'flex';
    thumbsUpSound.volume = 0.8;
    thumbsUpSound.play().catch(() => { });

    let frame = 0;
    const FRAME_SPEED = 120;

    function showFrame() {
        drawFrameWithoutBg(frames[frame], () => {
            frame++;
            if (frame < frames.length) {
                setTimeout(showFrame, FRAME_SPEED);
            } else {
                animateInitiating();
            }
        });
    }
    showFrame();

    function animateInitiating() {
        let dots = 0;
        const dotInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            initText.textContent = 'INITIATING' + '.'.repeat(dots);
        }, 400);

        // After 3s on vault boy -> shake and enter
        setTimeout(() => {
            clearInterval(dotInterval);
            thumbsUpSound.pause();
            thumbsUpSound.currentTime = 0;

            // Shake + sound, THEN hide vault boy and show main UI
            shakeSound.volume = 0.9;
            shakeSound.play().catch(() => { });
            document.body.classList.add('shake');

            // Remove shake class after animation ends so it can replay
            document.body.addEventListener('animationend', function onShakeEnd() {
                document.body.classList.remove('shake');
                document.body.removeEventListener('animationend', onShakeEnd);
            });

            // After brief shake start, fade to main
            setTimeout(() => {
                vbScreen.style.display = 'none';
                document.getElementById('main-ui').style.display = 'flex';
                bgMusic.volume = 0.4;
                bgMusic.play().catch(() => { });
                startMainLoop();
            }, 400);
        }, 3000);
    }
}

// --- БРОЯЧ И НАВИГАЦИЯ ---
function startMainLoop() {
    updateTimerAndNav();
    setInterval(updateTimerAndNav, 1000);
}

function updateTimerAndNav() {
    const now = new Date().getTime();
    const distance = TARGET_DATE - now;

    if (distance > 0) {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = d < 10 ? "0" + d : d;
        document.getElementById('hours').innerText = h < 10 ? "0" + h : h;
        document.getElementById('minutes').innerText = m < 10 ? "0" + m : m;
        document.getElementById('seconds').innerText = s < 10 ? "0" + s : s;
    }

    const daysSinceStart = Math.floor((now - START_DATE) / (1000 * 60 * 60 * 24));
    const activeQuestions = Math.min(Math.max(daysSinceStart + 1, 0), gameData.questions.length);
    renderNav(activeQuestions);

    updateFooterDatetime();
}

function updateFooterDatetime() {
    const el = document.getElementById('footer-datetime');
    if (!el) return;
    const nowDate = new Date();
    const dd = String(nowDate.getDate()).padStart(2, '0');
    const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
    const yyyy = nowDate.getFullYear();
    const hh = String(nowDate.getHours()).padStart(2, '0');
    const min = String(nowDate.getMinutes()).padStart(2, '0');
    const ss = String(nowDate.getSeconds()).padStart(2, '0');
    el.innerText = `${dd}.${mm}.${yyyy} // ${hh}:${min}:${ss}`;
}

function renderNav(count) {
    const nav = document.getElementById('question-nav');
    if (nav.children.length !== count) {
        nav.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const circle = document.createElement('div');
            circle.className = 'nav-circle';
            circle.innerText = gameData.questions[i].id;
            circle.onclick = () => openQuestion(i);
            nav.appendChild(circle);
        }
    }
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('question-modal').style.display = 'none';
};

document.getElementById('modal-back-btn').addEventListener('click', () => {
    if (typeof window.invadersOpenModeMenu === 'function') window.invadersOpenModeMenu();
});

let musicMuted = false;
function updateMuteIcon() {
    const btn = document.getElementById('modal-mute-btn');
    btn.classList.toggle('muted', musicMuted);
    document.getElementById('modal-mute-waves').style.display = musicMuted ? 'none' : '';
    document.getElementById('modal-mute-x').style.display = musicMuted ? '' : 'none';
    btn.title = musicMuted ? 'Музика изключена — цъкни за пускане' : 'Музика включена — цъкни за спиране';
}
document.getElementById('modal-mute-btn').addEventListener('click', () => {
    musicMuted = !musicMuted;
    bgMusic.muted = musicMuted;
    if (typeof window.invadersSetMuted === 'function') window.invadersSetMuted(musicMuted);
    updateMuteIcon();
});

document.getElementById('credits-teaser').addEventListener('click', () => {
    if (typeof window.invadersPauseGame === 'function') window.invadersPauseGame();
    document.getElementById('credits-modal').style.display = 'flex';
});
document.getElementById('close-credits-modal').addEventListener('click', () => {
    document.getElementById('credits-modal').style.display = 'none';
});

// --- ОТВАРЯНЕ НА ВЪПРОСИТЕ ---
function openQuestion(index) {
    currentQIndex = index;
    const q = gameData.questions[index];

    menuChange2Sound.currentTime = 0;
    menuChange2Sound.volume = 0.7;
    menuChange2Sound.play().catch(() => { });

    document.getElementById('modal-title').innerText = `СЕКТОР ${q.id}`;
    document.getElementById('error-msg').innerText = '';
    document.getElementById('success-msg').innerText = '';

    const decodedAnswer = fromBase64(q.a);
    const isTBA = decodedAnswer.trim().toUpperCase() === 'TBA';

    document.getElementById('fallout-container').style.display = 'none';
    document.getElementById('coming-soon-container').style.display = 'none';
    document.getElementById('sigil-container').style.display = 'none';
    document.getElementById('invaders-container').style.display = 'none';
    document.getElementById('machinarium-container').style.display = 'none';
    document.getElementById('bolts-container').style.display = 'none';
    document.getElementById('invaders-help-btn').style.display = (q.type === 'invaders') ? 'block' : 'none';

    if (q.type !== 'invaders' && typeof window.invadersPauseGame === 'function') {
        window.invadersPauseGame();
    }

    const questionModalEl = document.getElementById('question-modal');

    questionModalEl.classList.remove('machinarium-modal-size');

    if (q.type === 'invaders') {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.add('invaders-modal-size');
        document.getElementById('invaders-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        if (!invadersOpened) {
            invadersOpened = true;
            // Stop any running game before the very first setup
            if (typeof invadersStopGame === 'function') invadersStopGame();
            document.getElementById('invaders-mode-panel').style.display = 'none';
            document.getElementById('invaders-tutorial-panel').style.display = 'flex';
        }
        // On re-open we deliberately do NOT stop the game or show the tutorial again —
        // the arcade screen resumes exactly where it was left.
    } else if (q.type === 'machinarium') {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        questionModalEl.classList.add('machinarium-modal-size');
        document.getElementById('machinarium-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        if (!machinariumOpened) {
            machinariumOpened = true;
            initMachinariumGame();
        }
        // On re-open we keep the panel exactly as the player left it.
        if (!machinariumTutorialShown) {
            machinariumTutorialShown = true;
            document.getElementById('machinarium-tutorial-modal').style.display = 'flex';
        }
    } else if (q.type === 'bolts') {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        questionModalEl.classList.add('machinarium-modal-size');
        document.getElementById('bolts-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        if (!boltsOpened) {
            boltsOpened = true;
            initBoltsGame();
        }
        // On re-open we keep the board exactly as the player left it.
        if (!boltsTutorialShown) {
            boltsTutorialShown = true;
            document.getElementById('bolts-tutorial-modal').style.display = 'flex';
        }
    } else if (isTBA) {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        document.getElementById('coming-soon-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
    } else if (q.type === 'sigil') {
        questionModalEl.classList.add('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        document.getElementById('sigil-container').style.display = 'flex';
        questionModalEl.style.display = 'flex';
        if (!sigilOpened) {
            sigilOpened = true;
            // Изчакваме един кадър, за да може браузърът да оразмери контейнера преди да изчислим клетките
            requestAnimationFrame(() => requestAnimationFrame(() => initSigilGame(q)));
        }
        // On re-open we keep the board exactly as the player left it.

        if (!sigilTutorialShown) {
            sigilTutorialShown = true;
            document.getElementById('sigil-tutorial-modal').style.display = 'flex';
        }
    } else {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        document.getElementById('fallout-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        if (!falloutOpened) {
            falloutOpened = true;
            initFalloutGame(q);
        }
        // On re-open we keep the current terminal state (log, tries, lockout) as-is.

        // Свързваме [?] бутона
        const falloutHelpBtn = document.getElementById('fallout-help-btn');
        if (falloutHelpBtn) {
            falloutHelpBtn.onclick = () => {
                document.getElementById('tutorial-modal').style.display = 'flex';
            };
        }

        // Показваме инструкциите автоматично при първо отваряне
        if (!falloutTutorialShown) {
            falloutTutorialShown = true;
            document.getElementById('tutorial-modal').style.display = 'flex';
        }
    }
}

// --- MACHINARIUM ПЪЗЕЛ (СЕКТОР IV) — три преплетени кръга със светлини, като сейфа в затвора ---
let machinariumOpened = false;
let machinariumTutorialShown = false;
let machinariumLevel = 0;
let machinariumColors = {};
let machinariumSolvedAll = false;
let machinariumBusy = false;
let machinariumGeo = null;
let machinariumEndless = false;
let machinariumEndlessCount = 0;

const MACH_R = 125;           // радиус на всеки кръг
const MACH_D = 125;           // d = R → 12-те светлини образуват точна триъгълна решетка (като в играта)           // разстояние между центровете на кръговете
const MACH_CX = 400, MACH_CY = 465;
const MACH_DOT_R = 21;
const MACH_ANIM_MS = 380;
// Брой произволни завъртания при разбъркване — колкото повече, толкова по-трудно
const MACHINARIUM_LEVELS = [{ scrambles: 8 }, { scrambles: 16 }, { scrambles: 28 }];
const SVG_NS = 'http://www.w3.org/2000/svg';

function mkSvg(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

// Геометрия: 3 кръга; всеки два се пресичат в 2 точки (6 общи светлини),
// а във всеки кръг има още 2 негови собствени → общо 12 светлини, по 6 на кръг.
function machinariumBuildGeometry() {
    const rc = MACH_D / Math.sqrt(3);
    const centers = [0, 1, 2].map(i => {
        const a = Math.PI / 2 + i * 2 * Math.PI / 3; // единият кръг е долу, другите два — горе
        return [MACH_CX + rc * Math.cos(a), MACH_CY + rc * Math.sin(a)];
    });
    const pts = {};
    const ringIds = [[], [], []];
    let n = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const [x1, y1] = centers[i], [x2, y2] = centers[j];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dd = Math.hypot(x2 - x1, y2 - y1);
        const h = Math.sqrt(MACH_R * MACH_R - dd * dd / 4);
        const ux = -(y2 - y1) / dd, uy = (x2 - x1) / dd;
        [1, -1].forEach(sg => {
            const id = 'S' + (n++);
            pts[id] = { id, x: mx + sg * h * ux, y: my + sg * h * uy, shared: true };
            ringIds[i].push(id); ringIds[j].push(id);
        });
    }
    for (let i = 0; i < 3; i++) {
        const [cx, cy] = centers[i];
        const angs = ringIds[i].map(id => Math.atan2(pts[id].y - cy, pts[id].x - cx)).sort((a, b) => a - b);
        let best = 0, bi = 0;
        for (let k = 0; k < 4; k++) {
            const g = ((angs[(k + 1) % 4] - angs[k]) + 2 * Math.PI) % (2 * Math.PI);
            if (g > best) { best = g; bi = k; }
        }
        [1, 2].forEach(t => {
            const a = angs[bi] + best * t / 3;
            const id = 'E' + i + t;
            pts[id] = { id, x: cx + MACH_R * Math.cos(a), y: cy + MACH_R * Math.sin(a), shared: false };
            ringIds[i].push(id);
        });
    }
    // Ред на светлините във всеки кръг по ъгъл (растящ ъгъл = по часовниковата стрелка)
    const rings = ringIds.map((ids, i) => {
        const [cx, cy] = centers[i];
        const ang = id => Math.atan2(pts[id].y - cy, pts[id].x - cx);
        const order = [...ids].sort((a, b) => ang(a) - ang(b));
        return { center: [cx, cy], order, angles: order.map(ang) };
    });
    // Целева зона = 6-те общи светлини → триъгълник 1-2-3, точно като зеления триъгълник в играта
    const target = Object.keys(pts).filter(id => pts[id].shared);
    target.forEach(id => { pts[id].inner = true; });
    return { centers, pts, rings, target };
}

function machinariumRotate(ringIdx, dir) {
    const order = machinariumGeo.rings[ringIdx].order;
    const cols = order.map(id => machinariumColors[id]);
    if (dir > 0) cols.unshift(cols.pop()); else cols.push(cols.shift());
    order.forEach((id, i) => { machinariumColors[id] = cols[i]; });
}

function machinariumIsSolved() {
    return machinariumGeo.target.every(id => machinariumColors[id] === 'green');
}

function machinariumStartLevel() {
    const msg = document.getElementById('machinarium-msg');
    msg.innerText = '';
    msg.className = '';
    const endlessBtn = document.getElementById('machinarium-endless-btn');
    if (endlessBtn) endlessBtn.style.display = 'none';
    let scrambles;
    if (machinariumEndless) {
        // Безкрайна игра: всеки път случайна трудност между лесно и най-трудно ниво
        scrambles = 8 + Math.floor(Math.random() * 29);
        document.getElementById('machinarium-level-label').innerText =
            `БЕЗКРАЙНА ИГРА · РЕШЕНИ: ${machinariumEndlessCount}`;
    } else {
        scrambles = MACHINARIUM_LEVELS[machinariumLevel].scrambles;
        document.getElementById('machinarium-level-label').innerText =
            `НИВО ${machinariumLevel + 1} / ${MACHINARIUM_LEVELS.length}`;
    }
    let guard = 0;
    do {
        // Започваме от решено състояние → разбъркването винаги е решимо
        machinariumColors = {};
        Object.keys(machinariumGeo.pts).forEach(id => {
            machinariumColors[id] = machinariumGeo.pts[id].inner ? 'green' : 'red';
        });
        let last = -1;
        for (let i = 0; i < scrambles; i++) {
            let r;
            do { r = Math.floor(Math.random() * 3); } while (r === last);
            last = r;
            machinariumRotate(r, Math.random() < 0.5 ? 1 : -1);
        }
        guard++;
    } while (machinariumIsSolved() && guard < 20);
    renderMachinariumSVG();
}

function initMachinariumGame() {
    machinariumGeo = machinariumBuildGeometry();
    machinariumLevel = 0;
    machinariumSolvedAll = false;
    machinariumBusy = false;
    machinariumEndless = false;
    machinariumEndlessCount = 0;
    machinariumStartLevel();
}

// Триъгълник със заоблени ъгли (квадратични криви във върховете)
function machRoundedTriangle(v, t) {
    const pt = (a, b) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d];
    };
    let d = '';
    for (let i = 0; i < 3; i++) {
        const prev = v[(i + 2) % 3], cur = v[i], next = v[(i + 1) % 3];
        const a = pt(cur, prev), b = pt(cur, next);
        d += `${i ? 'L' : 'M'}${a[0]},${a[1]} Q${cur[0]},${cur[1]} ${b[0]},${b[1]} `;
    }
    return d + 'Z';
}

// Многоъгълник със заоблени върхове
function machRoundedPoly(v, t) {
    const n = v.length;
    const pt = (a, b) => {
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d];
    };
    let d = '';
    for (let i = 0; i < n; i++) {
        const prev = v[(i + n - 1) % n], cur = v[i], next = v[(i + 1) % n];
        const a = pt(cur, prev), b = pt(cur, next);
        d += `${i ? 'L' : 'M'}${a[0]},${a[1]} Q${cur[0]},${cur[1]} ${b[0]},${b[1]} `;
    }
    return d + 'Z';
}

function machArcPath(cx, cy, r, a0, a1) {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} ${sweep} ${x1},${y1}`;
}

function renderMachinariumSVG() {
    const svg = document.getElementById('machinarium-svg');
    svg.innerHTML = '';
    const geo = machinariumGeo;

    // 1) Геометрия на стрелките (нужна първо, за да оразмерим плочата така, че всичко да е вътре)
    const pcx = MACH_CX, pcy = MACH_CY - 20;
    const rr = MACH_R + 50;
    const arrows = [];
    geo.centers.forEach(([cx, cy], idx) => {
        const out = Math.atan2(cy - pcy, cx - pcx);
        [-1, 1].forEach(dir => {
            const mid = out + dir * 0.62, span = 0.30;
            arrows.push({ idx, dir, cx, cy, a0: dir > 0 ? mid - span : mid + span, a1: dir > 0 ? mid + span : mid - span });
        });
    });

    // 2) Плоча: заоблен триъгълник, който автоматично обгражда всички светлини и стрелки
    const pad = [];
    Object.values(geo.pts).forEach(p => pad.push([p.x, p.y, MACH_DOT_R + 12]));
    arrows.forEach(ar => {
        for (let t = 0; t <= 6; t++) {
            const ang = ar.a0 + (ar.a1 - ar.a0) * t / 6;
            pad.push([ar.cx + rr * Math.cos(ang), ar.cy + rr * Math.sin(ang), 26]);
        }
    });
    const minY = Math.min(...pad.map(q => q[1] - q[2]));
    const maxY = Math.max(...pad.map(q => q[1] + q[2]));
    const baseY = maxY + 40;
    // Вдигаме върха на плочата, докато формата стане приятно пропорционална (като в оригинала)
    let apexY = minY - 60, slope = 0, hw = 0;
    for (let H = 60; H < 900; H += 5) {
        apexY = minY - H;
        slope = 0;
        pad.forEach(([x, y, m]) => { slope = Math.max(slope, (Math.abs(x - MACH_CX) + m + 4) / (y - apexY)); });
        hw = slope * (baseY - apexY);
        if (hw / (baseY - apexY) <= 0.66) break;
    }
    const vbX = MACH_CX - hw - 14, vbW = 2 * hw + 28;
    const vbY = apexY - 14, vbH = baseY - apexY + 28;
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    svg.appendChild(mkSvg('path', {
        d: machRoundedTriangle([[MACH_CX, apexY], [MACH_CX - hw, baseY], [MACH_CX + hw, baseY]], 80),
        class: 'machinarium-panel-bg'
    }));
    [[MACH_CX, apexY + 60], [MACH_CX - hw + 100, baseY - 32], [MACH_CX + hw - 100, baseY - 32]].forEach(([x, y]) =>
        svg.appendChild(mkSvg('circle', { cx: x, cy: y, r: 8, class: 'machinarium-rivet' })));

    // Централната зона (сечението на трите кръга)
    const defs = mkSvg('defs');
    geo.centers.forEach(([cx, cy], i) => {
        const cp = mkSvg('clipPath', { id: 'mach-clip-' + i });
        cp.appendChild(mkSvg('circle', { cx, cy, r: MACH_R }));
        defs.appendChild(cp);
    });
    svg.appendChild(defs);
    // Зоната-целта е "детелина": трите леща (сечения на по два кръга) покриват всичките 6 целеви светлини
    const zoneLayer = mkSvg('g', { class: 'machinarium-zone-layer' });
    [[0, 1], [1, 2], [0, 2]].forEach(([i, j]) => {
        const gi = mkSvg('g', { 'clip-path': `url(#mach-clip-${i})` });
        const gj = mkSvg('g', { 'clip-path': `url(#mach-clip-${j})` });
        gj.appendChild(mkSvg('rect', { x: -3000, y: -3000, width: 7000, height: 7000, class: 'machinarium-center-zone' }));
        gi.appendChild(gj);
        zoneLayer.appendChild(gi);
    });
    svg.appendChild(zoneLayer);
    svg.appendChild(mkSvg('circle', { cx: MACH_CX, cy: MACH_CY, r: 5, class: 'machinarium-center-dot' }));

    // Трите кръга (релсите)
    const trackLayer = mkSvg('g', { class: 'machinarium-tracks' });
    geo.centers.forEach(([cx, cy]) =>
        trackLayer.appendChild(mkSvg('circle', { cx, cy, r: MACH_R, class: 'machinarium-track' })));
    svg.appendChild(trackLayer);

    // Светлини
    const dotLayer = mkSvg('g', { id: 'machinarium-dots' });
    Object.values(geo.pts).forEach(p => {
        dotLayer.appendChild(mkSvg('circle', {
            cx: p.x, cy: p.y, r: MACH_DOT_R + 5, class: 'machinarium-socket', 'data-id': p.id
        }));
        dotLayer.appendChild(mkSvg('circle', {
            cx: p.x, cy: p.y, r: MACH_DOT_R, class: `machinarium-dot ${machinariumColors[p.id]}`, 'data-id': p.id
        }));
    });
    svg.appendChild(dotLayer);

    // 4) Извити стрелки
    arrows.forEach(ar => {
        const { cx, cy, a0, a1, dir, idx } = ar;
        const grp = mkSvg('g', { class: 'machinarium-arrow-group' });
        grp.appendChild(mkSvg('path', { d: machArcPath(cx, cy, rr, a0, a1), class: 'machinarium-arrow-hit' }));
        grp.appendChild(mkSvg('path', { d: machArcPath(cx, cy, rr, a0, a1), class: 'machinarium-arrow-line' }));
        const tx = cx + rr * Math.cos(a1), ty = cy + rr * Math.sin(a1);
        const tang = a1 + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        const back = tang + Math.PI;
        const hs = 14;
        const p1 = [tx + hs * Math.cos(back + 0.5), ty + hs * Math.sin(back + 0.5)];
        const p2 = [tx + hs * Math.cos(back - 0.5), ty + hs * Math.sin(back - 0.5)];
        const tip = [tx + 3 * Math.cos(tang), ty + 3 * Math.sin(tang)];
        grp.appendChild(mkSvg('polygon', { points: `${tip} ${p1} ${p2}`, class: 'machinarium-arrow-head' }));
        grp.addEventListener('click', () => machinariumUserRotate(idx, dir));
        svg.appendChild(grp);
    });
}

// Анимирано завъртане: светлините на кръга пътуват по дъгата до съседната позиция
function machinariumUserRotate(ringIdx, dir) {
    if (machinariumBusy || machinariumSolvedAll) return;
    machinariumBusy = true;
    tickAudio.currentTime = 0; tickAudio.volume = 0.25; tickAudio.play().catch(() => { });

    const geo = machinariumGeo;
    const ring = geo.rings[ringIdx];
    const [cx, cy] = ring.center;
    const n = ring.order.length;
    const svg = document.getElementById('machinarium-svg');
    const layer = mkSvg('g', { class: 'machinarium-moving' });
    svg.appendChild(layer);

    // Скриваме статичните светлини на този кръг и рисуваме движещи се копия
    const movers = ring.order.map((id, i) => {
        svg.querySelectorAll(`[data-id="${id}"]`).forEach(el => { el.style.visibility = 'hidden'; });
        const j = (i + (dir > 0 ? 1 : n - 1)) % n;
        let a0 = ring.angles[i], a1 = ring.angles[j];
        if (dir > 0) { while (a1 <= a0) a1 += 2 * Math.PI; } else { while (a1 >= a0) a1 -= 2 * Math.PI; }
        const el = mkSvg('circle', { r: MACH_DOT_R, class: `machinarium-dot ${machinariumColors[id]}` });
        layer.appendChild(el);
        return { el, a0, a1 };
    });
    // Въртящ се "обръч" за усещане на механизъм
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    function frame(now) {
        const t = Math.min(1, (now - t0) / MACH_ANIM_MS);
        const e = ease(t);
        movers.forEach(m => {
            const a = m.a0 + (m.a1 - m.a0) * e;
            m.el.setAttribute('cx', cx + MACH_R * Math.cos(a));
            m.el.setAttribute('cy', cy + MACH_R * Math.sin(a));
        });
        if (t < 1) { requestAnimationFrame(frame); return; }
        machinariumRotate(ringIdx, dir);
        renderMachinariumSVG();
        machinariumBusy = false;
        machinariumCheckSolved();
    }
    requestAnimationFrame(frame);
}

function machinariumCheckSolved() {
    if (!machinariumIsSolved()) return;
    const msg = document.getElementById('machinarium-msg');
    if (machinariumEndless) {
        machinariumEndlessCount++;
        msg.className = 'machinarium-msg-progress';
        msg.innerText = `РЕШЕНО! РЕШЕНИ: ${machinariumEndlessCount} — СЛЕДВАЩ ПЪЗЕЛ...`;
        machinariumBusy = true;
        setTimeout(() => {
            machinariumBusy = false;
            machinariumStartLevel();
            const code = fromBase64(gameData.questions[currentQIndex].code);
            document.getElementById('machinarium-msg').innerText = `СЕКРЕТЕН КОД: ${code}`;
        }, 1200);
        return;
    }
    if (machinariumLevel < MACHINARIUM_LEVELS.length - 1) {
        const done = machinariumLevel + 1;
        msg.className = 'machinarium-msg-progress';
        msg.innerText = `НИВО ${done} ПРЕМИНАТО — ЗАРЕЖДАНЕ НА СЛЕДВАЩОТО...`;
        machinariumBusy = true; // блокира кликове по време на прехода
        setTimeout(() => {
            machinariumLevel = done;
            machinariumBusy = false;
            machinariumStartLevel();
        }, 1500);
    } else {
        machinariumSolvedAll = true;
        const q = gameData.questions[currentQIndex];
        const code = fromBase64(q.code);
        msg.className = '';
        msg.innerText = `СЕКРЕТЕН КОД: ${code}`;
        saveUnlockedCode(q.id, code);
        document.getElementById('machinarium-endless-btn').style.display = 'block';
    }
}

document.getElementById('machinarium-endless-btn').addEventListener('click', () => {
    if (!machinariumSolvedAll) return;
    machinariumSolvedAll = false;
    machinariumEndless = true;
    machinariumEndlessCount = 0;
    machinariumStartLevel();
    const code = fromBase64(gameData.questions[currentQIndex].code);
    document.getElementById('machinarium-msg').innerText = `СЕКРЕТЕН КОД: ${code}`;
});

document.getElementById('machinarium-restart-btn').addEventListener('click', () => {
    if (machinariumSolvedAll || machinariumBusy) return;
    machinariumStartLevel();
    if (machinariumEndless) {
        const code = fromBase64(gameData.questions[currentQIndex].code);
        document.getElementById('machinarium-msg').innerText = `СЕКРЕТЕН КОД: ${code}`;
    }
});
document.getElementById('machinarium-help-btn').addEventListener('click', () => {
    document.getElementById('machinarium-tutorial-modal').style.display = 'flex';
});

// --- ГАЙКИ И ВИНТОВЕ (СЕКТОР V) — 5 в редица, като играта в бара от Machinarium ---
let boltsOpened = false;
let boltsTutorialShown = false;
let boltsBoard = [];
let boltsBusy = false;
let boltsOver = false;
let boltsSolved = false;
let boltsLastPlayer = null;
let boltsLastAi = null;
let boltsWinCells = null;
let boltsAiTimer = null;
let boltsSkippedLast = false;
let boltsLevel = 0;            // 0 = гайки и винтове, 1 = стрелки
let boltsTransition = false;
let arrowsBoard = [];          // 7 слота: 'D' (надолу), 'U' (нагоре), null (празно)
let arrowsLastMoved = -1;
let arrowsDone = false;
const ARROWS_START = ['D', 'D', 'D', null, 'U', 'U', 'U'];

const BOLTS_COLS = 11, BOLTS_ROWS = 9;
const BOLTS_CELL = 62;
const BOLTS_X0 = (800 - BOLTS_COLS * BOLTS_CELL) / 2;
const BOLTS_Y0 = (660 - BOLTS_ROWS * BOLTS_CELL) / 2;
const BOLTS_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
// Тежести на прозорец от 5 клетки според броя на еднакви фигури в него
const BOLTS_WEIGHTS = [0, 1, 12, 150, 2000, 1000000];

function boltsInside(r, c) { return r >= 0 && r < BOLTS_ROWS && c >= 0 && c < BOLTS_COLS; }

function boltsNewBoard() {
    return Array.from({ length: BOLTS_ROWS }, () => Array(BOLTS_COLS).fill(0));
}

// Връща масив с клетките на печелившата редица (>=5), минаваща през (r,c), или null
function boltsWinLine(board, r, c) {
    const p = board[r][c];
    if (!p) return null;
    for (const [dr, dc] of BOLTS_DIRS) {
        const line = [[r, c]];
        for (let s = 1; ; s++) {
            const rr = r + dr * s, cc = c + dc * s;
            if (!boltsInside(rr, cc) || board[rr][cc] !== p) break;
            line.push([rr, cc]);
        }
        for (let s = 1; ; s++) {
            const rr = r - dr * s, cc = c - dc * s;
            if (!boltsInside(rr, cc) || board[rr][cc] !== p) break;
            line.push([rr, cc]);
        }
        if (line.length >= 5) return line;
    }
    return null;
}

// Оценка на позицията от гледна точка на играч `me` (по-високо = по-добре за него)
function boltsEvaluate(board, me) {
    const opp = 3 - me;
    let score = 0;
    for (let r = 0; r < BOLTS_ROWS; r++) {
        for (let c = 0; c < BOLTS_COLS; c++) {
            for (const [dr, dc] of BOLTS_DIRS) {
                const er = r + dr * 4, ec = c + dc * 4;
                if (!boltsInside(er, ec)) continue;
                let m = 0, o = 0;
                for (let k = 0; k < 5; k++) {
                    const v = board[r + dr * k][c + dc * k];
                    if (v === me) m++; else if (v === opp) o++;
                }
                if (m && o) continue;
                if (m) score += BOLTS_WEIGHTS[m];
                else if (o) score -= BOLTS_WEIGHTS[o];
            }
        }
    }
    return score;
}

function boltsCandidates(board) {
    const out = [];
    let any = false;
    for (let r = 0; r < BOLTS_ROWS; r++) {
        for (let c = 0; c < BOLTS_COLS; c++) {
            if (board[r][c]) { any = true; continue; }
            let near = false;
            for (let dr = -2; dr <= 2 && !near; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const rr = r + dr, cc = c + dc;
                    if (boltsInside(rr, cc) && board[rr][cc]) { near = true; break; }
                }
            }
            if (near) out.push([r, c]);
        }
    }
    if (!any) return [[Math.floor(BOLTS_ROWS / 2), Math.floor(BOLTS_COLS / 2)]];
    return out;
}

// Ходът на гайките (AI): печели ако може, блокира петорка, иначе търси няколко хода напред
// (алфа-бета с подрязване на кандидатите). Дълбочината е ограничена, така че
// добре подготвена двойна заплаха (напр. 4+3) все още може да го надиграе.
const BOLTS_AI_DEPTH = 2;
const BOLTS_AI_SKIP = 0.10; // шанс противникът да пропусне хода си (никога два пъти подред и никога първия ход)
const BOLTS_AI_SLIP = 0.35; // шанс за „грешка“ при всеки ход: 0 = без грешки, 0.5 = много грешки
const BOLTS_AI_BREADTH = [12, 9, 7, 6];

function boltsOrderedMoves(board, who, limit) {
    const cands = boltsCandidates(board);
    const scored = cands.map(([r, c]) => {
        board[r][c] = who;
        const v = boltsEvaluate(board, who);
        board[r][c] = 0;
        return { r, c, v };
    });
    scored.sort((a, b) => b.v - a.v);
    return scored.slice(0, limit);
}

// Стойност на позицията за AI (играч 2) след `depth` полухода, `who` е на ход
function boltsSearch(board, depth, who, alpha, beta) {
    if (depth === 0) return boltsEvaluate(board, 2);
    const moves = boltsOrderedMoves(board, who, BOLTS_AI_BREADTH[BOLTS_AI_DEPTH - depth]);
    if (!moves.length) return boltsEvaluate(board, 2);
    if (who === 2) {
        let best = -Infinity;
        for (const m of moves) {
            board[m.r][m.c] = 2;
            const v = boltsWinLine(board, m.r, m.c) ? 1e7 + depth : boltsSearch(board, depth - 1, 1, alpha, beta);
            board[m.r][m.c] = 0;
            if (v > best) best = v;
            if (best > alpha) alpha = best;
            if (alpha >= beta) break;
        }
        return best;
    }
    let best = Infinity;
    for (const m of moves) {
        board[m.r][m.c] = 1;
        const v = boltsWinLine(board, m.r, m.c) ? -1e7 - depth : boltsSearch(board, depth - 1, 2, alpha, beta);
        board[m.r][m.c] = 0;
        if (v < best) best = v;
        if (best < beta) beta = best;
        if (alpha >= beta) break;
    }
    return best;
}

function boltsPickMove(board) {
    const me = 2, opp = 1;
    const cands = boltsCandidates(board);
    if (!cands.length) return null;

    // Първи ход: на случайно място близо до центъра (не винаги в средата, като в играта)
    if (board.every(row => row.every(v => !v))) {
        const cr = Math.floor(BOLTS_ROWS / 2), cc = Math.floor(BOLTS_COLS / 2);
        return [cr + Math.floor(Math.random() * 3) - 1, cc + Math.floor(Math.random() * 5) - 2];
    }

    for (const [r, c] of cands) {
        board[r][c] = me;
        const w = boltsWinLine(board, r, c);
        board[r][c] = 0;
        if (w) return [r, c];
    }
    for (const [r, c] of cands) {
        board[r][c] = opp;
        const w = boltsWinLine(board, r, c);
        board[r][c] = 0;
        if (w) return [r, c];
    }

    const roots = boltsOrderedMoves(board, me, 14);
    const scored = [];
    for (const m of roots) {
        board[m.r][m.c] = me;
        const v = boltsSearch(board, BOLTS_AI_DEPTH - 1, opp, -Infinity, Infinity);
        board[m.r][m.c] = 0;
        scored.push({ r: m.r, c: m.c, v });
    }
    scored.sort((a, b) => b.v - a.v);
    const best = scored[0].v;
    const tol = Math.max(15, Math.abs(best) * 0.03);
    // Грешки: понякога избира случаен ход от първите 6 вместо най-добрия (по-висока стойност = по-лесна игра)
    const pool = Math.random() < BOLTS_AI_SLIP
        ? scored.slice(0, 6)
        : scored.filter(s => s.v >= best - tol).slice(0, 3);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return [pick.r, pick.c];
}

function initBoltsGame() {
    boltsSolved = false;
    boltsLevel = 0;
    boltsTransition = false;
    boltsStartGame();
}

function boltsApplyLevelUI() {
    document.getElementById('bolts-level-label').innerText = `НИВО ${boltsLevel + 1} / 3`;
    document.getElementById('bolts-header').innerText = [
        '> ПОДРЕДИ 5 ГАЙКИ В РЕДИЦА, ПРЕДИ ВИНТОВЕТЕ ДА ГО НАПРАВЯТ',
        '> РАЗМЕНИ МЕСТАТА НА СТРЕЛКИТЕ',
        '> СГЛОБИ КАРТАТА, КАТО ПЛЪЗГАШ ПЛОЧКИТЕ'
    ][boltsLevel];
    document.getElementById('bolts-restart-btn').innerText = [
        '[ НОВА ИГРА ]', '[ РЕСТАРТ НА НИВОТО ]', '[ РАЗБЪРКАЙ ОТНОВО ]'
    ][boltsLevel];
    // TEMP (тест): надписът на тестовия бутон
    const testBtn = document.getElementById('bolts-test-btn');
    if (testBtn) testBtn.innerText = `[ ТЕСТ: КЪМ НИВО ${(boltsLevel + 1) % 3 + 1} ]`;
}

function boltsSetMsg(text, cls) {
    const msg = document.getElementById('bolts-msg');
    msg.className = cls || '';
    msg.innerText = text;
}

function boltsStartGame() {
    if (boltsAiTimer) { clearTimeout(boltsAiTimer); boltsAiTimer = null; }
    boltsBoard = boltsNewBoard();
    boltsBusy = false;
    boltsOver = false;
    boltsLastPlayer = null;
    boltsLastAi = null;
    boltsWinCells = null;
    boltsSkippedLast = false;
    boltsLevel = 0;
    boltsApplyLevelUI();
    boltsSetMsg('> ТИ СИ ГАЙКИТЕ. ВИНТОВЕТЕ ЗАПОЧВАТ ПЪРВИ', 'bolts-msg-info');
    renderBoltsSVG();
    boltsAiSchedule(800);
}

function boltsHexPoints(r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
}

function boltsMakePiece(kind, x, y, isNew, isWin) {
    const g = mkSvg('g', { transform: `translate(${x},${y})` });
    const inner = mkSvg('g', {
        class: 'bolts-piece ' + (kind === 2 ? 'bolts-bolt' : 'bolts-nut') +
            (isNew ? ' bolts-new' : '') + (isWin ? ' bolts-win' : '')
    });
    if (kind === 2) {
        // Винт: шайба + глава с прорез
        inner.appendChild(mkSvg('circle', { r: 24, class: 'bolts-washer' }));
        inner.appendChild(mkSvg('circle', { r: 15, class: 'bolts-head' }));
        const rot = ((x * 7 + y * 13) % 8) * 22.5;
        inner.appendChild(mkSvg('rect', {
            x: -11, y: -2.5, width: 22, height: 5, rx: 1.5, class: 'bolts-slot',
            transform: `rotate(${rot})`
        }));
    } else {
        // Гайка: шестоъгълник с отвор
        inner.appendChild(mkSvg('polygon', { points: boltsHexPoints(25), class: 'bolts-hex' }));
        inner.appendChild(mkSvg('circle', { r: 12, class: 'bolts-hole' }));
    }
    g.appendChild(inner);
    return g;
}

// Ръжда и петна по панела (детерминирани, за да не "танцуват" при всяко прерисуване)
function boltsAddStains(svg, seed0) {
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rust = mkSvg('g', { class: 'bolts-rust' });
    for (let i = 0; i < 9; i++) {
        rust.appendChild(mkSvg('ellipse', {
            cx: 40 + rnd() * 720, cy: 30 + rnd() * 600, rx: 10 + rnd() * 18, ry: 8 + rnd() * 14, class: 'bolts-blotch'
        }));
    }
    for (let i = 0; i < 70; i++) {
        rust.appendChild(mkSvg('circle', {
            cx: 30 + rnd() * 740, cy: 24 + rnd() * 612, r: 0.8 + rnd() * 2.2, class: 'bolts-speck'
        }));
    }
    svg.appendChild(rust);
}

function renderBoltsSVG() {
    const svg = document.getElementById('bolts-svg');
    svg.innerHTML = '';
    svg.appendChild(mkSvg('rect', { x: 20, y: 14, width: 760, height: 632, rx: 14, class: 'bolts-panel-bg' }));
    boltsAddStains(svg, 21);

    [[40, 34], [760, 34], [40, 626], [760, 626]].forEach(([x, y]) =>
        svg.appendChild(mkSvg('circle', { cx: x, cy: y, r: 7, class: 'machinarium-rivet' })));

    const gridLayer = mkSvg('g', { class: 'bolts-grid' });
    for (let i = 0; i <= BOLTS_COLS; i++) {
        const x = BOLTS_X0 + i * BOLTS_CELL;
        gridLayer.appendChild(mkSvg('line', { x1: x, y1: BOLTS_Y0, x2: x, y2: BOLTS_Y0 + BOLTS_ROWS * BOLTS_CELL }));
    }
    for (let j = 0; j <= BOLTS_ROWS; j++) {
        const y = BOLTS_Y0 + j * BOLTS_CELL;
        gridLayer.appendChild(mkSvg('line', { x1: BOLTS_X0, y1: y, x2: BOLTS_X0 + BOLTS_COLS * BOLTS_CELL, y2: y }));
    }
    svg.appendChild(gridLayer);

    const winSet = new Set((boltsWinCells || []).map(([r, c]) => `${r},${c}`));
    const pieceLayer = mkSvg('g');
    const hitLayer = mkSvg('g');
    for (let r = 0; r < BOLTS_ROWS; r++) {
        for (let c = 0; c < BOLTS_COLS; c++) {
            const x = BOLTS_X0 + c * BOLTS_CELL + BOLTS_CELL / 2;
            const y = BOLTS_Y0 + r * BOLTS_CELL + BOLTS_CELL / 2;
            const v = boltsBoard[r][c];
            if (v) {
                const isNew = (boltsLastPlayer && boltsLastPlayer[0] === r && boltsLastPlayer[1] === c) ||
                    (boltsLastAi && boltsLastAi[0] === r && boltsLastAi[1] === c);
                pieceLayer.appendChild(boltsMakePiece(v, x, y, isNew, winSet.has(`${r},${c}`)));
                if (boltsLastAi && boltsLastAi[0] === r && boltsLastAi[1] === c && !boltsOver) {
                    pieceLayer.appendChild(mkSvg('circle', { cx: x, cy: y, r: 30, class: 'bolts-last-marker' }));
                }
            } else {
                const hit = mkSvg('rect', {
                    x: BOLTS_X0 + c * BOLTS_CELL + 2, y: BOLTS_Y0 + r * BOLTS_CELL + 2,
                    width: BOLTS_CELL - 4, height: BOLTS_CELL - 4, rx: 6,
                    class: 'bolts-cell-hit'
                });
                hit.addEventListener('click', () => boltsPlayerMove(r, c));
                hitLayer.appendChild(hit);
            }
        }
    }
    svg.appendChild(pieceLayer);
    svg.appendChild(hitLayer);
}

function boltsBoardFull() {
    return boltsBoard.every(row => row.every(v => v));
}

function boltsFinishWin() {
    boltsOver = true;
    boltsSetMsg('НИВО 1 ПРЕМИНАТО — ЗАРЕЖДАНЕ НА СЛЕДВАЩОТО...', 'bolts-msg-info bolts-msg-progress');
    boltsTransition = true;
    renderBoltsSVG();
    setTimeout(() => {
        boltsTransition = false;
        arrowsStart();
    }, 1800);
}

// --- НИВО 2: СТРЕЛКИ (бутоните с асансьора от Machinarium) ---
// Стрелка надолу се мести само надолу, стрелка нагоре — само нагоре:
// на съседното свободно място или като прескача една стрелка.
function arrowsTargetFor(i) {
    const p = arrowsBoard[i];
    if (!p) return -1;
    const dir = p === 'D' ? 1 : -1;
    for (const step of [1, 2]) {
        const t = i + dir * step;
        if (t < 0 || t >= arrowsBoard.length || arrowsBoard[t]) continue;
        if (step === 2 && !arrowsBoard[i + dir]) continue;
        return t;
    }
    return -1;
}

function arrowsIsSolved() {
    const b = arrowsBoard;
    return b[0] === 'U' && b[1] === 'U' && b[2] === 'U' &&
        b[4] === 'D' && b[5] === 'D' && b[6] === 'D';
}

function arrowsHasMoves() {
    return arrowsBoard.some((p, i) => arrowsTargetFor(i) !== -1);
}

function arrowsStart() {
    boltsLevel = 1;
    arrowsBoard = ARROWS_START.slice();
    arrowsLastMoved = -1;
    arrowsDone = false;
    boltsApplyLevelUI();
    boltsSetMsg('> ПРЕМЕСТИ СТРЕЛКИТЕ В ОБРАТНИЯ РЕД', 'bolts-msg-info');
    renderArrowsSVG();
}

function arrowsMove(i) {
    if (arrowsDone || boltsSolved || boltsTransition) return;
    const t = arrowsTargetFor(i);
    if (t === -1) return;
    arrowsBoard[t] = arrowsBoard[i];
    arrowsBoard[i] = null;
    arrowsLastMoved = t;
    tickAudio.currentTime = 0; tickAudio.volume = 0.5; tickAudio.play().catch(() => { });
    if (arrowsIsSolved()) {
        arrowsDone = true;
        boltsSetMsg('НИВО 2 ПРЕМИНАТО — ЗАРЕЖДАНЕ НА СЛЕДВАЩОТО...', 'bolts-msg-info bolts-msg-progress');
        boltsTransition = true;
        setTimeout(() => {
            boltsTransition = false;
            slideStart();
        }, 1800);
    } else if (!arrowsHasMoves()) {
        boltsSetMsg('> ЗАКЛЕЩЕНО — НАТИСНИ [ РЕСТАРТ НА НИВОТО ]', 'bolts-msg-lose');
    } else {
        boltsSetMsg('> ПРЕМЕСТИ СТРЕЛКИТЕ В ОБРАТНИЯ РЕД', 'bolts-msg-info');
    }
    renderArrowsSVG();
}

function renderArrowsSVG() {
    const svg = document.getElementById('bolts-svg');
    svg.innerHTML = '';
    svg.appendChild(mkSvg('rect', { x: 20, y: 14, width: 760, height: 632, rx: 14, class: 'bolts-panel-bg' }));
    [[40, 34], [760, 34], [40, 626], [760, 626]].forEach(([x, y]) =>
        svg.appendChild(mkSvg('circle', { cx: x, cy: y, r: 7, class: 'machinarium-rivet' })));

    const CX = 400, Y0 = 82, GAP = 82;
    const upPath = 'M0,-19 L17,1 L7,1 L7,18 L-7,18 L-7,1 L-17,1 Z';

    // Ръжда по панела (детерминирана, за да не "танцува" при всяко прерисуване)
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rust = mkSvg('g', { class: 'bolts-rust' });
    for (let i = 0; i < 9; i++) {
        rust.appendChild(mkSvg('ellipse', {
            cx: 40 + rnd() * 720, cy: 30 + rnd() * 600, rx: 10 + rnd() * 18, ry: 8 + rnd() * 14, class: 'bolts-blotch'
        }));
    }
    for (let i = 0; i < 70; i++) {
        rust.appendChild(mkSvg('circle', {
            cx: 30 + rnd() * 740, cy: 24 + rnd() * 612, r: 0.8 + rnd() * 2.2, class: 'bolts-speck'
        }));
    }
    svg.appendChild(rust);

    svg.appendChild(mkSvg('rect', {
        x: CX - 56, y: Y0 - 50, width: 112, height: GAP * 6 + 100, rx: 18, class: 'arrows-strip'
    }));

    // Маркер за върха на извитите стрелки в схемите
    const defs = mkSvg('defs', {});
    const marker = mkSvg('marker', {
        id: 'arrows-head', viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto'
    });
    marker.appendChild(mkSvg('path', { d: 'M1,1 L8,5 L1,9', class: 'arrows-hint-head' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Малки стрелки-подсказки от двете страни на бутоните (като на оригиналния панел)
    const smallArrow = (x, y, down) => svg.appendChild(mkSvg('path', {
        d: 'M0,-9 L8,1 L3,1 L3,9 L-3,9 L-3,1 L-8,1 Z',
        transform: `translate(${x},${y})${down ? ' rotate(180)' : ''}`, class: 'arrows-hint'
    }));
    [0, 1, 2].forEach(i => { smallArrow(CX - 86, Y0 + i * GAP, true); smallArrow(CX + 86, Y0 + i * GAP, false); });
    [4, 5, 6].forEach(i => { smallArrow(CX - 86, Y0 + i * GAP, false); smallArrow(CX + 86, Y0 + i * GAP, true); });
    [[CX - 86, '0'], [CX + 86, '1']].forEach(([x, t]) => {
        const el = mkSvg('text', { x: x - 5, y: 622, class: 'arrows-hint-digit' });
        el.textContent = t;
        svg.appendChild(el);
    });

    // Схеми вляво: как се движи стрелка (на стъпка и с прескачане)
    const sketchCircle = (x, y, kind) => {
        svg.appendChild(mkSvg('circle', { cx: x, cy: y, r: 15, class: kind ? 'arrows-sketch' : 'arrows-sketch arrows-sketch-empty' }));
        if (kind) svg.appendChild(mkSvg('path', {
            d: upPath, transform: `translate(${x},${y})${kind === 'D' ? ' rotate(180)' : ''} scale(0.5)`,
            class: kind === 'D' ? 'arrows-down' : 'arrows-up'
        }));
    };
    sketchCircle(150, 236, null); sketchCircle(150, 286, 'U');
    svg.appendChild(mkSvg('path', { d: 'M168,282 C202,272 202,252 170,242', class: 'arrows-sketch-curve', 'marker-end': 'url(#arrows-head)' }));
    sketchCircle(150, 356, null); sketchCircle(150, 406, 'D'); sketchCircle(150, 456, 'U');
    svg.appendChild(mkSvg('path', { d: 'M168,450 C232,426 232,386 170,362', class: 'arrows-sketch-curve', 'marker-end': 'url(#arrows-head)' }));

    arrowsBoard.forEach((p, i) => {
        const y = Y0 + i * GAP;
        const g = mkSvg('g', { transform: `translate(${CX},${y})` });
        g.appendChild(mkSvg('circle', { r: 38, class: p ? 'arrows-ring' : 'arrows-ring arrows-empty' }));
        if (p) {
            const inner = mkSvg('g', {
                class: 'arrows-btn bolts-piece' + (i === arrowsLastMoved ? ' bolts-new' : '') +
                    (arrowsDone ? ' bolts-win' : '')
            });
            inner.appendChild(mkSvg('circle', { r: 31, class: 'arrows-face' }));
            inner.appendChild(mkSvg('path', {
                d: upPath, class: p === 'D' ? 'arrows-glyph arrows-down' : 'arrows-glyph arrows-up',
                transform: p === 'D' ? 'rotate(180)' : ''
            }));
            g.appendChild(inner);
            if (!arrowsDone && arrowsTargetFor(i) !== -1) g.classList.add('arrows-movable');
            g.addEventListener('click', () => arrowsMove(i));
        }
        svg.appendChild(g);
    });

    const legend = [
        [520, 252, '▼ ДВИЖИ СЕ САМО НАДОЛУ', 'arrows-down-txt'],
        [520, 282, '▲ ДВИЖИ СЕ САМО НАГОРЕ', 'arrows-up-txt'],
        [520, 360, 'МЕСТИ СЕ НА 1 СТЪПКА', 'arrows-note'],
        [520, 384, 'ИЛИ ПРЕСКОЧИ ЕДНА СТРЕЛКА', 'arrows-note']
    ];
    legend.forEach(([x, y, t, cls]) => {
        const el = mkSvg('text', { x, y, class: 'arrows-legend ' + cls });
        el.textContent = t;
        svg.appendChild(el);
    });
}

// --- НИВО 3: КАРТА (плъзгащ пъзел 3×3 с рисунка с тебешир, като в Machinarium) ---
const SLIDE_ART = [["p", "M56,42 L132,42 L132,118 L62,118 L62,178 L172,178 L172,122 L242,122 L242,62 L262,62"], ["p", "M172,178 L172,252 L228,252"], ["c", 42, 42, 12], ["d", 42, 42, 3], ["p", "M266,44 L286,66 M286,44 L266,66"], ["p", "M12,84 Q24,72 36,84 T60,84 T84,84"], ["p", "M146,92 L172,58 L198,92 M160,76 L172,92 L184,76"], ["c", 232, 28, 9], ["p", "M232,12 L232,6 M232,50 L232,44 M210,28 L216,28 M248,28 L254,28 M216,14 L220,18 M244,38 L248,42 M216,42 L220,38 M248,14 L244,18"], ["p", "M18,190 L18,152 L48,152 L48,190 Z M12,152 L33,130 L54,152 M28,190 L28,172 L38,172 L38,190"], ["c", 140, 148, 10], ["c", 160, 158, 6], ["p", "M206,168 Q221,154 236,168 T266,168 T296,168 M206,186 Q221,172 236,186 T266,186 T296,186"], ["p", "M20,268 L20,210 L30,210 L30,222 L42,222 L42,210 L52,210 L52,222 L64,222 L64,210 L74,210 L74,268 Z M36,268 L36,248 Q47,234 58,248 L58,268"], ["c", 120, 236, 14], ["p", "M120,214 L120,258 M104,236 L136,236"], ["s", "M12,284 L192,284"], ["c", 252, 252, 22], ["c", 252, 252, 8], ["p", "M252,230 L252,244 M252,260 L252,274 M230,252 L244,252 M260,252 L274,252"]];
const SLIDE_TILE = 170;
const SLIDE_X0 = (800 - 3 * SLIDE_TILE) / 2;
const SLIDE_Y0 = (660 - 3 * SLIDE_TILE) / 2;
let slideBoard = [];          // slideBoard[позиция] = номер на плочката (0..7), 8 = празното място
let slideTileEls = {};
let slideDone = false;

function slideNeighbors(pos) {
    const r = Math.floor(pos / 3), c = pos % 3, out = [];
    if (r > 0) out.push(pos - 3);
    if (r < 2) out.push(pos + 3);
    if (c > 0) out.push(pos - 1);
    if (c < 2) out.push(pos + 1);
    return out;
}

function slideIsSolved() { return slideBoard.every((t, p) => t === p); }

function slideScramble() {
    let b, e, prev;
    do {
        b = [0, 1, 2, 3, 4, 5, 6, 7, 8]; e = 8; prev = -1;
        const n = 90 + Math.floor(Math.random() * 60);
        for (let i = 0; i < n; i++) {
            const nb = slideNeighbors(e).filter(p => p !== prev);
            const p = nb[Math.floor(Math.random() * nb.length)];
            b[e] = b[p]; b[p] = 8; prev = e; e = p;
        }
    } while (b.every((t, p) => t === p));
    return b;
}

function slideBuildPicture() {
    const defs = mkSvg('defs', {});
    const filter = mkSvg('filter', {
        id: 'slide-chalk', x: -10, y: -10, width: 320, height: 320, filterUnits: 'userSpaceOnUse'
    });
    filter.appendChild(mkSvg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.05', numOctaves: '2', seed: '4', result: 'n' }));
    filter.appendChild(mkSvg('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '3.5', xChannelSelector: 'R', yChannelSelector: 'G' }));
    defs.appendChild(filter);

    const pic = mkSvg('g', { id: 'slide-pic' });
    pic.appendChild(mkSvg('rect', { width: 300, height: 300, class: 'slide-metal' }));
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
        pic.appendChild(mkSvg('ellipse', {
            cx: rnd() * 300, cy: rnd() * 300, rx: 6 + rnd() * 16, ry: 5 + rnd() * 12, class: 'bolts-blotch'
        }));
    }
    for (let i = 0; i < 90; i++) {
        pic.appendChild(mkSvg('circle', { cx: rnd() * 300, cy: rnd() * 300, r: 0.5 + rnd() * 1.4, class: 'bolts-speck' }));
    }
    for (let i = 0; i < 14; i++) {
        const x = rnd() * 300, y = rnd() * 300, a = rnd() * Math.PI;
        pic.appendChild(mkSvg('line', {
            x1: x, y1: y, x2: x + Math.cos(a) * (10 + rnd() * 24), y2: y + Math.sin(a) * (10 + rnd() * 24), class: 'slide-scratch'
        }));
    }
    const chalk = mkSvg('g', { filter: 'url(#slide-chalk)', class: 'slide-chalk' });
    SLIDE_ART.forEach(e => {
        if (e[0] === 'p') chalk.appendChild(mkSvg('path', { d: e[1] }));
        else if (e[0] === 'c') chalk.appendChild(mkSvg('circle', { cx: e[1], cy: e[2], r: e[3] }));
        else if (e[0] === 'd') chalk.appendChild(mkSvg('circle', { cx: e[1], cy: e[2], r: e[3], class: 'slide-dot' }));
        else if (e[0] === 's') chalk.appendChild(mkSvg('path', { d: e[1], class: 'slide-dashed' }));
    });
    pic.appendChild(chalk);
    defs.appendChild(pic);
    return defs;
}

function slidePlace(el, pos) {
    const x = SLIDE_X0 + (pos % 3) * SLIDE_TILE, y = SLIDE_Y0 + Math.floor(pos / 3) * SLIDE_TILE;
    el.style.transform = `translate(${x}px, ${y}px)`;
}

function slideTileEl(id) {
    const cx = id % 3, cy = Math.floor(id / 3);
    const g = mkSvg('g', { class: 'slide-tile' });
    const inner = mkSvg('svg', {
        x: 0, y: 0, width: SLIDE_TILE, height: SLIDE_TILE, viewBox: `${cx * 100} ${cy * 100} 100 100`, overflow: 'hidden'
    });
    inner.appendChild(mkSvg('use', { href: '#slide-pic' }));
    g.appendChild(inner);
    g.appendChild(mkSvg('rect', { x: 1.5, y: 1.5, width: SLIDE_TILE - 3, height: SLIDE_TILE - 3, class: 'slide-border' }));
    return g;
}

function slideRefreshMovable() {
    const hole = slideBoard.indexOf(8);
    const movable = new Set(slideNeighbors(hole).map(p => slideBoard[p]));
    Object.entries(slideTileEls).forEach(([id, el]) => {
        const cls = 'slide-tile' + (slideDone ? ' slide-solved' : movable.has(+id) ? ' slide-movable' : '');
        el.setAttribute('class', cls);
    });
}

function slideStart() {
    boltsLevel = 2;
    slideDone = false;
    slideBoard = slideScramble();
    boltsApplyLevelUI();
    boltsSetMsg('> СГЛОБИ КАРТАТА — СВЪРЖИ ЛИНИИТЕ', 'bolts-msg-info');

    const svg = document.getElementById('bolts-svg');
    svg.innerHTML = '';
    svg.appendChild(mkSvg('rect', { x: 20, y: 14, width: 760, height: 632, rx: 14, class: 'bolts-panel-bg' }));
    [[40, 34], [760, 34], [40, 626], [760, 626]].forEach(([x, y]) =>
        svg.appendChild(mkSvg('circle', { cx: x, cy: y, r: 7, class: 'machinarium-rivet' })));
    svg.appendChild(slideBuildPicture());
    svg.appendChild(mkSvg('rect', {
        x: SLIDE_X0 - 14, y: SLIDE_Y0 - 14, width: 3 * SLIDE_TILE + 28, height: 3 * SLIDE_TILE + 28, rx: 12, class: 'slide-frame'
    }));
    svg.appendChild(mkSvg('rect', {
        x: SLIDE_X0, y: SLIDE_Y0, width: 3 * SLIDE_TILE, height: 3 * SLIDE_TILE, class: 'slide-well'
    }));
    slideTileEls = {};
    slideBoard.forEach((id, pos) => {
        if (id === 8) return;
        const el = slideTileEl(id);
        slidePlace(el, pos);
        el.addEventListener('click', () => slideMove(id));
        slideTileEls[id] = el;
        svg.appendChild(el);
    });
    slideRefreshMovable();
}

function slideMove(id) {
    if (slideDone || boltsSolved || boltsTransition || boltsLevel !== 2) return;
    const pos = slideBoard.indexOf(id), hole = slideBoard.indexOf(8);
    if (!slideNeighbors(hole).includes(pos)) return;
    slideBoard[hole] = id;
    slideBoard[pos] = 8;
    slidePlace(slideTileEls[id], hole);
    tickAudio.currentTime = 0; tickAudio.volume = 0.5; tickAudio.play().catch(() => { });
    if (slideIsSolved()) {
        slideDone = true;
        boltsSolved = true;
        // Последната плочка се появява и картата е цяла
        const last = slideTileEl(8);
        slidePlace(last, 8);
        last.setAttribute('class', 'slide-tile slide-reveal');
        document.getElementById('bolts-svg').appendChild(last);
        const q = gameData.questions[currentQIndex];
        const code = fromBase64(q.code);
        boltsSetMsg(`СЕКРЕТЕН КОД: ${code}`, '');
        saveUnlockedCode(q.id, code);
    }
    slideRefreshMovable();
}

function boltsPlayerMove(r, c) {
    if (boltsLevel !== 0 || boltsBusy || boltsOver || boltsSolved || boltsBoard[r][c]) return;
    boltsBoard[r][c] = 1;
    boltsLastPlayer = [r, c];
    boltsLastAi = null;
    tickAudio.currentTime = 0; tickAudio.volume = 0.5; tickAudio.play().catch(() => { });

    const w = boltsWinLine(boltsBoard, r, c);
    if (w) {
        boltsWinCells = w;
        boltsFinishWin();
        return;
    }
    if (boltsBoardFull()) {
        boltsOver = true;
        boltsSetMsg('> РАВЕНСТВО — НАТИСНИ [ НОВА ИГРА ]', 'bolts-msg-lose');
        renderBoltsSVG();
        return;
    }
    boltsBusy = true;
    boltsSetMsg('> ПРОТИВНИКЪТ МИСЛИ...', 'bolts-msg-info');
    renderBoltsSVG();
    boltsAiSchedule(550);
}

// Ходът на гайките: планира се със закъснение, за да изглежда, че противникът мисли
function boltsAiSchedule(delay) {
    boltsBusy = true;
    if (boltsAiTimer) clearTimeout(boltsAiTimer);
    boltsAiTimer = setTimeout(() => {
        boltsAiTimer = null;
        const boardEmpty = boltsBoard.every(row => row.every(v => !v));
        if (!boardEmpty && !boltsSkippedLast && Math.random() < BOLTS_AI_SKIP) {
            boltsSkippedLast = true;
            boltsLastAi = null;
            boltsLastPlayer = null;
            boltsBusy = false;
            boltsSetMsg('> ВИНТОВЕТЕ ПРОПУСНАХА ХОДА — ТВОЙ ХОД', 'bolts-msg-info');
            renderBoltsSVG();
            return;
        }
        boltsSkippedLast = false;
        if (boltsLevel !== 0 || boltsOver || boltsSolved) { boltsBusy = false; return; }
        let mv = boltsPickMove(boltsBoard);
        if (mv && boltsBoard[mv[0]][mv[1]]) {
            // защита: никога не слагай фигура върху заета клетка
            const free = [];
            for (let r = 0; r < BOLTS_ROWS; r++) for (let c = 0; c < BOLTS_COLS; c++) if (!boltsBoard[r][c]) free.push([r, c]);
            mv = free.length ? free[Math.floor(Math.random() * free.length)] : null;
        }
        if (!mv) { boltsBusy = false; return; }
        boltsBoard[mv[0]][mv[1]] = 2;
        boltsLastAi = mv;
        boltsLastPlayer = null;
        tickAudio.currentTime = 0; tickAudio.volume = 0.5; tickAudio.play().catch(() => { });
        const aw = boltsWinLine(boltsBoard, mv[0], mv[1]);
        if (aw) {
            boltsWinCells = aw;
            boltsOver = true;
            boltsBusy = false;
            boltsSetMsg('ВИНТОВЕТЕ СПЕЧЕЛИХА — НАТИСНИ [ НОВА ИГРА ]', 'bolts-msg-lose');
        } else if (boltsBoardFull()) {
            boltsOver = true;
            boltsBusy = false;
            boltsSetMsg('> РАВЕНСТВО — НАТИСНИ [ НОВА ИГРА ]', 'bolts-msg-lose');
        } else {
            boltsBusy = false;
            boltsSetMsg('> ТВОЙ ХОД', 'bolts-msg-info');
        }
        renderBoltsSVG();
    }, delay);
}

document.getElementById('bolts-restart-btn').addEventListener('click', () => {
    if (boltsSolved || boltsTransition) return;
    if (boltsLevel === 1) { arrowsStart(); return; }
    if (boltsLevel === 2) { slideStart(); return; }
    boltsStartGame();
});
// TEMP (тест): бутон за прескачане между нивата. За да го махнеш — изтрий този блок и бутона #bolts-test-btn в index.html.
document.getElementById('bolts-test-btn').addEventListener('click', () => {
    if (boltsAiTimer) { clearTimeout(boltsAiTimer); boltsAiTimer = null; }
    boltsTransition = false;
    boltsBusy = false;
    boltsSolved = false;
    arrowsDone = false;
    slideDone = false;
    if (boltsLevel === 0) { boltsOver = true; arrowsStart(); }
    else if (boltsLevel === 1) { slideStart(); }
    else { boltsStartGame(); }
});
document.getElementById('bolts-help-btn').addEventListener('click', () => {
    document.getElementById('bolts-tutorial-modal').style.display = 'flex';
});

// --- SIGIL ПЪЗЕЛ (TALOS PRINCIPLE СТИЛ) ---

// Всяко ниво е ПЛЪТНО запълнен правоъгълник (gridRows x gridCols) от tetromino-форми,
// без дупки - точно като истинските sigil пъзели от The Talos Principle.
// pieces = масив от парчета, всяко дефинирано чрез relative [row, col] клетки (норм. от 0,0).
const SIGIL_LEVELS = [
    {
        gridRows: 4,
        gridCols: 6,
        pieces: [
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 1], [0, 2], [1, 0], [1, 1]],
            [[0, 0], [0, 1], [1, 1], [1, 2]]
        ]
    },
    {
        gridRows: 6,
        gridCols: 6,
        pieces: [
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [1, 0], [1, 1], [1, 2]],
            [[0, 0], [1, 0], [1, 1], [1, 2]],
            [[0, 2], [1, 0], [1, 1], [1, 2]],
            [[0, 2], [1, 0], [1, 1], [1, 2]],
            [[0, 0], [0, 1], [1, 0], [1, 1]]
        ]
    },
    {
        gridRows: 5,
        gridCols: 8,
        pieces: [
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [0, 2], [0, 3]],
            [[0, 0], [0, 1], [1, 0], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [0, 1], [0, 2], [1, 1]],
            [[0, 0], [1, 0], [1, 1], [1, 2]],
            [[0, 2], [1, 0], [1, 1], [1, 2]],
            [[0, 2], [1, 0], [1, 1], [1, 2]]
        ]
    },
];

let sigilCellSize = 0;
let sigilTrayCellSize = 0; // По-малък размер за компактно показване в tray-а
let sigilCurrentLevel = null;
let sigilPiecesState = [];
let sigilSolved = false;

function sigilCellKey(r, c) { return `${r},${c}`; }

function rotateSigilCells(cells) {
    // Завърта 90° по часовниковата стрелка: (r, c) -> (c, -r), после нормализира
    const rotated = cells.map(([r, c]) => [c, -r]);
    const minR = Math.min(...rotated.map(([r]) => r));
    const minC = Math.min(...rotated.map(([, c]) => c));
    return rotated.map(([r, c]) => [r - minR, c - minC]);
}

function initSigilGame(q, isRestart) {
    sigilSolved = false;
    document.getElementById('success-msg').innerText = '';
    document.getElementById('error-msg').innerText = '';

    // Избираме случайно ниво (истински random, ново при всяко отваряне)
    const levelIndex = Math.floor(Math.random() * SIGIL_LEVELS.length);
    sigilCurrentLevel = SIGIL_LEVELS[levelIndex];
    sigilCurrentLevel.gridRowsActual = sigilCurrentLevel.gridRows;
    sigilCurrentLevel.gridColsActual = sigilCurrentLevel.gridCols;

    // Target е целият правоъгълник (ниво е плътно tetromino tiling, без дупки - истински Talos стил)
    const target = [];
    for (let r = 0; r < sigilCurrentLevel.gridRows; r++) {
        for (let c = 0; c < sigilCurrentLevel.gridCols; c++) target.push([r, c]);
    }
    sigilCurrentLevel.target = target;

    const board = document.getElementById('sigil-board');
    const tray = document.getElementById('sigil-tray');
    const targetSvg = document.getElementById('sigil-target-svg');
    const boardWrap = document.querySelector('.sigil-board-wrap');
    board.innerHTML = '';
    tray.innerHTML = '';

    // Нулираме предишен explicit размер, за да остави CSS (max-width + aspect-ratio) да определи наличното място
    boardWrap.style.width = '';
    boardWrap.style.height = '';

    const wrapRect = boardWrap.getBoundingClientRect();
    // Изчисляваме клетъчния размер така, че правоъгълникът да се събере в наличното пространство
    const cellByWidth = Math.floor(wrapRect.width / sigilCurrentLevel.gridCols);
    const cellByHeight = Math.floor(wrapRect.height / sigilCurrentLevel.gridRows);
    sigilCellSize = Math.max(16, Math.min(cellByWidth, cellByHeight));

    // Tray cell size е по-малък за компактно показване - фиксиран спрямо броя колони на нивото
    // така че по-голямото ниво да показва по-малки парчета (за да се наредят всичките)
    const trayEl = document.getElementById('sigil-tray');
    const trayRect = trayEl.getBoundingClientRect();
    const maxPieceCols = Math.max(...sigilCurrentLevel.pieces.map(p => Math.max(...p.map(c => c[1])) + 1));
    const piecesPerRow = Math.max(2, Math.floor(trayRect.width / (maxPieceCols * 55 + 16)));
    sigilTrayCellSize = Math.max(28, Math.min(50, Math.floor((trayRect.width - piecesPerRow * 16) / (piecesPerRow * maxPieceCols))));

    const boardPixelWidth = sigilCellSize * sigilCurrentLevel.gridCols;
    const boardPixelHeight = sigilCellSize * sigilCurrentLevel.gridRows;

    boardWrap.style.width = `${boardPixelWidth}px`;
    boardWrap.style.height = `${boardPixelHeight}px`;

    // Рисуваме лек контур на цялата дъска (помощна рамка, без detail тъй като target = цялата дъска)
    targetSvg.setAttribute('viewBox', `0 0 ${boardPixelWidth} ${boardPixelHeight}`);
    targetSvg.innerHTML = `<rect x="0" y="0" width="${boardPixelWidth}" height="${boardPixelHeight}" fill="none" stroke="rgba(42,255,0,0.3)" stroke-width="1"/>`;

    // Checkerboard фон - редуващи се два нюанса за по-лесно различаване на клетките
    for (let r = 0; r < sigilCurrentLevel.gridRows; r++) {
        for (let c = 0; c < sigilCurrentLevel.gridCols; c++) {
            const cellEl = document.createElement('div');
            const shade = (r + c) % 2 === 0 ? 'shade-a' : 'shade-b';
            cellEl.className = `sigil-board-cell ${shade}`;
            cellEl.style.left = `${c * sigilCellSize}px`;
            cellEl.style.top = `${r * sigilCellSize}px`;
            cellEl.style.width = `${sigilCellSize}px`;
            cellEl.style.height = `${sigilCellSize}px`;
            board.appendChild(cellEl);
        }
    }

    // Подготвяме парчетата, разбъркани с случайни начални завъртания и РАЗПРЪСНАТИ в tray-а (не наблъскани)
    const shuffledPieces = [...sigilCurrentLevel.pieces]
        .map((cells, originalIdx) => ({ cells, originalIdx }))
        .sort(() => 0.5 - Math.random());

    sigilPiecesState = shuffledPieces.map(({ cells, originalIdx }, idx) => {
        const randomRotations = Math.floor(Math.random() * 4);
        let rotatedCells = cells;
        for (let i = 0; i < randomRotations; i++) rotatedCells = rotateSigilCells(rotatedCells);
        return {
            id: `sigil-piece-${idx}`,
            baseCells: cells,
            cells: rotatedCells,
            row: null,
            col: null,
            placedInBoard: false,
        };
    });

    sigilPiecesState.forEach(piece => renderSigilPiece(piece, tray));

    document.getElementById('sigil-rotate-btn').onclick = () => {
        if (sigilLocked) return;
        const selected = sigilPiecesState.find(p => p.selected);
        if (!selected) return;
        selected.cells = rotateSigilCells(selected.cells);
        redrawSigilPiece(selected);
        checkSigilSolution();
    };

    const sigilRestartBtn = document.getElementById('sigil-restart-btn');
    sigilRestartBtn.onclick = () => {
        if (sigilRestartBtn.disabled) return;
        initSigilGame(q, true);
    };

    document.getElementById('sigil-reset-positions-btn').onclick = () => {
        if (sigilSolved || sigilLocked) return;
        sigilPiecesState.forEach(piece => {
            piece.placedInBoard = false;
            piece.row = null;
            piece.col = null;
            piece.selected = false;
            const el = document.getElementById(piece.id);
            if (el) {
                el.classList.remove('selected', 'invalid', 'placed-correct');
                el.style.position = 'relative';
                el.style.left = '';
                el.style.top = '';
                tray.appendChild(el);
                redrawSigilPiece(piece);
            }
        });
        document.getElementById('error-msg').innerText = '';
    };

    document.getElementById('sigil-help-btn').onclick = () => {
        document.getElementById('sigil-tutorial-modal').style.display = 'flex';
    };

    if (sigilCooldownTimer) { clearInterval(sigilCooldownTimer); sigilCooldownTimer = null; }
    if (isRestart) {
        sigilLocked = true;
        sigilRestartBtn.disabled = true;
        sigilCooldownTimer = runCooldown(COOLDOWN_SECONDS, (left) => {
            document.getElementById('error-msg').innerText = `ИЗЧАКАЙТЕ ${left}s...`;
        }, () => {
            sigilLocked = false;
            sigilRestartBtn.disabled = false;
            sigilCooldownTimer = null;
            document.getElementById('error-msg').innerText = '';
        });
    } else {
        sigilLocked = false;
        sigilRestartBtn.disabled = false;
    }
}

function renderSigilPiece(piece, container) {
    const el = document.createElement('div');
    el.className = 'sigil-piece';
    el.id = piece.id;
    container.appendChild(el);
    drawSigilPieceShape(piece, el);
    attachSigilDragHandlers(piece, el);

    el.addEventListener('mousedown', () => selectSigilPiece(piece));
    el.addEventListener('touchstart', () => selectSigilPiece(piece), { passive: true });
}

function selectSigilPiece(piece) {
    sigilPiecesState.forEach(p => p.selected = false);
    piece.selected = true;
    document.querySelectorAll('.sigil-piece').forEach(el => el.classList.remove('selected'));
    document.getElementById(piece.id).classList.add('selected');
}

function drawSigilPieceShape(piece, el) {
    el.innerHTML = '';
    const maxR = Math.max(...piece.cells.map(([r]) => r));
    const maxC = Math.max(...piece.cells.map(([, c]) => c));
    const cs = piece.placedInBoard ? sigilCellSize : sigilTrayCellSize;
    el.style.width = `${(maxC + 1) * cs}px`;
    el.style.height = `${(maxR + 1) * cs}px`;

    piece.cells.forEach(([r, c]) => {
        const cellEl = document.createElement('div');
        cellEl.className = 'sigil-piece-cell';
        cellEl.style.left = `${c * cs}px`;
        cellEl.style.top = `${r * cs}px`;
        cellEl.style.width = `${cs}px`;
        cellEl.style.height = `${cs}px`;
        el.appendChild(cellEl);
    });
}

function redrawSigilPiece(piece) {
    const el = document.getElementById(piece.id);
    if (!el) return;
    drawSigilPieceShape(piece, el);
    if (piece.placedInBoard) {
        positionSigilPieceOnBoard(piece);
    }
}

function positionSigilPieceOnBoard(piece) {
    const el = document.getElementById(piece.id);
    if (!el) return;
    el.style.position = 'absolute';
    el.style.left = `${piece.col * sigilCellSize}px`;
    el.style.top = `${piece.row * sigilCellSize}px`;
}

function attachSigilDragHandlers(piece, el) {
    let dragging = false;
    let offsetX = 0, offsetY = 0;

    function onPointerDown(clientX, clientY) {
        if (sigilLocked) return;
        dragging = true;
        selectSigilPiece(piece);
        const rect = el.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;

        // Преместваме елемента в board контейнера за свободно позициониране, ако още не е там
        const board = document.getElementById('sigil-board');
        if (el.parentElement !== board) {
            board.appendChild(el);
        }
        el.style.zIndex = 50;
    }

    function onPointerMove(clientX, clientY) {
        if (!dragging) return;
        const boardRect = document.getElementById('sigil-board').getBoundingClientRect();
        let x = clientX - boardRect.left - offsetX;
        let y = clientY - boardRect.top - offsetY;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.position = 'absolute';
    }

    function onPointerUp() {
        if (!dragging) return;
        dragging = false;
        el.style.zIndex = 1;
        snapSigilPieceToGrid(piece, el);
        checkSigilSolution();
    }

    el.addEventListener('mousedown', (e) => { e.preventDefault(); onPointerDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    el.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onPointerDown(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        onPointerMove(t.clientX, t.clientY);
    }, { passive: true });
    window.addEventListener('touchend', onPointerUp);
}

function snapSigilPieceToGrid(piece, el) {
    const boardRect = document.getElementById('sigil-board').getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const relX = elRect.left - boardRect.left;
    const relY = elRect.top - boardRect.top;

    const snappedCol = Math.round(relX / sigilCellSize);
    const snappedRow = Math.round(relY / sigilCellSize);

    const maxR = Math.max(...piece.cells.map(([r]) => r));
    const maxC = Math.max(...piece.cells.map(([, c]) => c));

    // Проверяваме дали парчето е поне частично над дъската - иначе го връщаме в tray-а
    const isOverBoard = relX > -sigilCellSize && relY > -sigilCellSize &&
        relX < boardRect.width && relY < boardRect.height;

    if (!isOverBoard) {
        piece.placedInBoard = false;
        piece.row = null;
        piece.col = null;
        document.getElementById('sigil-tray').appendChild(el);
        el.style.position = 'relative';
        el.style.left = '';
        el.style.top = '';
        redrawSigilPiece(piece);
        return;
    }

    const clampedRow = Math.max(0, Math.min(snappedRow, sigilCurrentLevel.gridRows - 1 - maxR));
    const clampedCol = Math.max(0, Math.min(snappedCol, sigilCurrentLevel.gridCols - 1 - maxC));

    // Позволяваме поставяне дори при препокриване с друго парче — checkSigilSolution()
    // ще покаже съобщение и ще маркира визуално застъпените парчета, докато не се оправят.
    piece.row = clampedRow;
    piece.col = clampedCol;
    piece.placedInBoard = true;
    redrawSigilPiece(piece);
    positionSigilPieceOnBoard(piece);
}

function checkSigilSolution() {
    if (sigilSolved) return;

    const placedPieces = sigilPiecesState.filter(p => p.placedInBoard);

    // Проверка за припокриване между парчета — запомняме кои парчета точно се застъпват
    const cellOwners = new Map(); // key -> [pieceId, ...]
    placedPieces.forEach(piece => {
        piece.cells.forEach(([r, c]) => {
            const key = sigilCellKey(piece.row + r, piece.col + c);
            if (!cellOwners.has(key)) cellOwners.set(key, []);
            cellOwners.get(key).push(piece.id);
        });
    });

    const overlappingPieceIds = new Set();
    cellOwners.forEach(ids => {
        if (ids.length > 1) ids.forEach(id => overlappingPieceIds.add(id));
    });
    const hasOverlap = overlappingPieceIds.size > 0;

    // Маркираме визуално invalid парчета при припокриване
    sigilPiecesState.forEach(piece => {
        const el = document.getElementById(piece.id);
        if (!el) return;
        el.classList.remove('placed-correct');
        el.classList.toggle('invalid', overlappingPieceIds.has(piece.id));
    });

    const errEl = document.getElementById('error-msg');
    if (hasOverlap) {
        errEl.innerText = 'ФРАГМЕНТИТЕ НЕ МОГАТ ДА СЕ ПРЕПОКРИВАТ';
        return;
    } else if (errEl.innerText === 'ФРАГМЕНТИТЕ НЕ МОГАТ ДА СЕ ПРЕПОКРИВАТ') {
        errEl.innerText = '';
    }

    // Ако всички парчета са поставени, сравняваме обединението с target силуета
    if (placedPieces.length !== sigilPiecesState.length) return;

    const targetSet = new Set(sigilCurrentLevel.target.map(([r, c]) => sigilCellKey(r, c)));
    const occupiedSet = new Set(cellOwners.keys());

    const matches = targetSet.size === occupiedSet.size &&
        [...targetSet].every(key => occupiedSet.has(key));

    if (matches) {
        sigilSolved = true;
        sigilPiecesState.forEach(piece => {
            const el = document.getElementById(piece.id);
            if (el) el.classList.add('placed-correct');
        });

        const q = gameData.questions[currentQIndex];
        const revealedCode = fromBase64(q.code);
        document.getElementById('success-msg').innerText = `СЕКРЕТЕН КОД: ${revealedCode}`;
        saveUnlockedCode(q.id, revealedCode);
    }
}

// --- FALLOUT ХАКВАНЕ ЛОГИКА ---
function initFalloutGame(q, isRestart) {
    isFalloutLocked = true;
    falloutTries = 4;
    updateAttemptsDisplay();

    if (falloutCooldownTimer) { clearInterval(falloutCooldownTimer); falloutCooldownTimer = null; }

    document.getElementById('lower-diff-btn').style.display = 'none';
    const restartBtn = document.getElementById('restart-fallout-btn');
    restartBtn.style.display = 'none';
    restartBtn.disabled = false;
    restartBtn.textContent = '[ РЕСТАРТ НА СИСТЕМАТА ]';

    const log = document.getElementById('fallout-log');
    log.innerHTML = '';

    const selection = pickBalancedWordSet(q.words, 14);
    currentFalloutWords = selection.words;
    currentFalloutTarget = selection.target;

    generateFalloutGrid(q, isRestart);
}

// --- LIKENESS ИЗЧИСЛЕНИЕ (споделено между избора на думи и проверката на отговор) ---
function computeLikeness(a, b) {
    let likeness = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i] === b[i]) likeness++;
    }
    return likeness;
}

// --- БАЛАНСИРАН ИЗБОР НА ДУМИ (КАТО ОРИГИНАЛНАТА FALLOUT ИГРА) ---
// Избира target на случаен принцип, после подбира останалите думи така,
// че да покрият разнообразен спектър от likeness стойности спрямо target-а
// (вместо чисто случаен избор, който води до непредвидима трудност).
function pickBalancedWordSet(wordPool, count) {
    const pool = [...wordPool];
    const target = pool[Math.floor(Math.random() * pool.length)];

    const wordLen = target.length;
    const others = pool.filter(w => w !== target);

    // Групираме останалите думи по likeness спрямо target-а (0..wordLen-1, без перфектно съвпадение)
    const buckets = {};
    others.forEach(w => {
        const l = computeLikeness(w, target);
        if (!buckets[l]) buckets[l] = [];
        buckets[l].push(w);
    });

    // Разбъркваме всяка кофа, за да няма предвидим ред
    Object.values(buckets).forEach(arr => arr.sort(() => 0.5 - Math.random()));

    const needed = count - 1; // -1 защото target винаги участва
    const selected = [];

    // Желано разпределение: равномерно покритие от ниско към високо сходство,
    // обикаляме нивата по ред (round-robin), за да гарантираме разнообразие
    const levels = Object.keys(buckets).map(Number).sort((a, b) => b - a); // от най-високо към най-ниско likeness
    let levelIndex = 0;
    let safetyCounter = 0;
    const maxIterations = needed * levels.length + levels.length + 10;

    while (selected.length < needed && levels.length > 0 && safetyCounter < maxIterations) {
        const level = levels[levelIndex % levels.length];
        const bucket = buckets[level];

        if (bucket && bucket.length > 0) {
            selected.push(bucket.pop());
        }

        levelIndex++;
        safetyCounter++;

        // Премахваме изчерпани нива от ротацията
        if (bucket && bucket.length === 0) {
            const idx = levels.indexOf(level);
            if (idx !== -1) levels.splice(idx, 1);
        }
    }

    // Ако пулът е по-малък от needed (напр. малко думи в data.json), допълваме каквото е останало
    if (selected.length < needed) {
        const remaining = others.filter(w => !selected.includes(w));
        selected.push(...remaining.slice(0, needed - selected.length));
    }

    const finalWords = [...selected, target].sort(() => 0.5 - Math.random());

    return { words: finalWords, target: target };
}

function updateAttemptsDisplay() {
    let blocks = "";
    for (let i = 0; i < falloutTries; i++) blocks += "■ ";
    document.getElementById('fallout-attempts-blocks').innerText = blocks.trim();
}

function generateFalloutGrid(q, isRestart) {
    const charsPerRow = 12;
    const rowsPerCol = 16;
    const totalSlots = rowsPerCol * 2;

    let availableRows = Array.from({ length: totalSlots }, (_, i) => i);
    let rowAssignments = {};

    currentFalloutWords.forEach(word => {
        const randIndex = Math.floor(Math.random() * availableRows.length);
        const rowNum = availableRows.splice(randIndex, 1)[0];
        rowAssignments[rowNum] = word;
    });

    let currentHex = baseHex;
    let leftRowsArray = [];
    let rightRowsArray = [];

    for (let i = 0; i < totalSlots; i++) {
        let hexStr = "0x" + currentHex.toString(16).toUpperCase();
        currentHex += 12;
        let rowContent = "";

        if (rowAssignments[i]) {
            const word = rowAssignments[i];
            const maxPadding = charsPerRow - word.length;
            const padLeft = Math.floor(Math.random() * (maxPadding + 1));
            const padRight = maxPadding - padLeft;

            rowContent += generateClickableSymbols(padLeft);
            rowContent += `<span class="fallout-word" id="word-${word}" onmouseenter="playHoverSound()" onclick="processFalloutGuess('${word}')">${word}</span>`;
            rowContent += generateClickableSymbols(padRight);
        } else {
            rowContent += generateClickableSymbols(charsPerRow);
        }

        const finalRowHTML = `<div class="fallout-row"><span class="hex-code">${hexStr}</span><span class="fallout-text-block">${rowContent}</span></div>`;

        if (i < rowsPerCol) leftRowsArray.push(finalRowHTML);
        else rightRowsArray.push(finalRowHTML);
    }

    const leftCol = document.getElementById('fallout-grid-left');
    const rightCol = document.getElementById('fallout-grid-right');
    const log = document.getElementById('fallout-log');

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    let rowIndex = 0;
    function typeMatrixRow() {
        if (rowIndex < rowsPerCol) {
            leftCol.innerHTML += leftRowsArray[rowIndex];
            rightCol.innerHTML += rightRowsArray[rowIndex];
            tickAudio.currentTime = 0; tickAudio.play().catch(() => { });
            rowIndex++;
            setTimeout(typeMatrixRow, 25);
        } else {
            if (isRestart) {
                if (falloutCooldownTimer) clearInterval(falloutCooldownTimer);
                falloutCooldownTimer = runCooldown(COOLDOWN_SECONDS, (left) => {
                    log.innerHTML = `>SYSTEM COOLDOWN ACTIVE.<br>>ИЗЧАКАЙТЕ ${left}s...<br>`;
                }, () => {
                    isFalloutLocked = false;
                    falloutCooldownTimer = null;
                    log.innerHTML = `> <span class="block-cursor" id="log-cursor"></span>`;
                });
            } else {
                isFalloutLocked = false;
                log.innerHTML = `> <span class="block-cursor" id="log-cursor"></span>`;
            }
        }
    }
    typeMatrixRow();
}

function generateClickableSymbols(length) {
    if (length < 2) return getRandomSymbolsStr(length);

    if (Math.random() < 0.3 && length >= 3) {
        const pair = bracketPairs[Math.floor(Math.random() * bracketPairs.length)];
        const groupLen = Math.floor(Math.random() * (length - 2)) + 2;
        const beforeLen = Math.floor(Math.random() * (length - groupLen));
        const afterLen = length - groupLen - beforeLen;

        let insideContent = "";
        for (let i = 0; i < groupLen - 2; i++) insideContent += symbolsArray[Math.floor(Math.random() * symbolsArray.length)];

        let safeBracketStr = (pair[0] + insideContent + pair[1]).replace(/'/g, "\\'");

        let html = getRandomSymbolsStr(beforeLen);
        html += `<span class="bracket-group" onmouseenter="playHoverSound()" onclick="processBracket(this, '${safeBracketStr}')">${pair[0]}${insideContent}${pair[1]}</span>`;
        html += getRandomSymbolsStr(afterLen);
        return html;
    } else {
        return getRandomSymbolsStr(length);
    }
}

function getRandomSymbolsStr(length) {
    let res = "";
    for (let i = 0; i < length; i++) {
        let char = symbolsArray[Math.floor(Math.random() * symbolsArray.length)];
        let safeChar = char === "'" ? "\\'" : (char === "\\" ? "\\\\" : char);
        res += `<span class="fallout-symbol" onmouseenter="playHoverSound()" onclick="processSymbolClick('${safeChar}')">${char}</span>`;
    }
    return res;
}

// --- КЛИКВАНЕ НА СКОБИ ---
window.processBracket = function (element, rawText) {
    if (isFalloutLocked || falloutTries <= 0) return;
    if (element.classList.contains('used-bracket')) return;

    element.classList.add('used-bracket');
    const log = document.getElementById('fallout-log');
    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');

    if (Math.random() < 0.5) {
        falloutTries = 4;
        updateAttemptsDisplay();
        log.innerHTML += `>${rawText}<br>>Allowance replenished.<br>> <span class="block-cursor" id="log-cursor"></span>`;
    } else {
        let duds = currentFalloutWords.filter(w => w !== currentFalloutTarget && !document.getElementById(`word-${w}`).classList.contains('disabled'));

        if (duds.length > 0) {
            let dudToRemove = duds[Math.floor(Math.random() * duds.length)];
            let el = document.getElementById(`word-${dudToRemove}`);
            let dots = "";
            for (let i = 0; i < dudToRemove.length; i++) dots += ".";
            el.innerText = dots;
            el.classList.add('disabled');
            el.onclick = null;
            log.innerHTML += `>${rawText}<br>>Dud removed.<br>> <span class="block-cursor" id="log-cursor"></span>`;
        } else {
            log.innerHTML += `>${rawText}<br>>Error.<br>> <span class="block-cursor" id="log-cursor"></span>`;
        }
    }
    log.scrollTop = log.scrollHeight;
}

// --- КЛИКВАНЕ НА ЕДИНИЧЕН СИМВОЛ ---
window.processSymbolClick = function (char) {
    if (isFalloutLocked || falloutTries <= 0) return;
    const log = document.getElementById('fallout-log');

    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');
    log.innerHTML += `>${char}<br>>Error<br>> <span class="block-cursor" id="log-cursor"></span>`;
    log.scrollTop = log.scrollHeight;
}

// --- КЛИКВАНЕ НА ДУМА ---
window.processFalloutGuess = function (guess) {
    if (isFalloutLocked || falloutTries <= 0) return;
    const q = gameData.questions[currentQIndex];
    const target = currentFalloutTarget;
    const log = document.getElementById('fallout-log');

    log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');

    if (guess === target) {
        log.innerHTML += `>${guess}<br>>Exact match!<br>>Please wait while system<br>>is accessed.<br><span class="block-cursor" id="log-cursor"></span>`;
        const revealedCode = fromBase64(q.code);
        document.getElementById('success-msg').innerText = `СЕКРЕТЕН КОД: ${revealedCode}`;
        saveUnlockedCode(q.id, revealedCode);
        disableAllInteractables();
        document.getElementById('lower-diff-btn').style.display = 'none';
        return;
    }

    let likeness = computeLikeness(guess, target);

    falloutTries--;
    updateAttemptsDisplay();
    log.innerHTML += `>${guess}<br>>Entry denied.<br>>Likeness=${likeness}<br>> <span class="block-cursor" id="log-cursor"></span>`;
    log.scrollTop = log.scrollHeight;

    if (falloutTries === 3) {
        const restartBtn = document.getElementById('restart-fallout-btn');
        restartBtn.style.display = 'block';
        restartBtn.disabled = false;
        restartBtn.textContent = '[ РЕСТАРТ НА СИСТЕМАТА ]';
    }

    if (falloutTries === 0) {
        isFalloutLocked = true;
        log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');
        log.innerHTML += `>TERMINAL LOCKED.<br>>REINITIALIZING NEW HACK...<br>`;
        log.scrollTop = log.scrollHeight;

        disableAllInteractables();
        document.getElementById('lower-diff-btn').style.display = 'none';
        document.getElementById('restart-fallout-btn').style.display = 'none';

        if (falloutCooldownTimer) { clearInterval(falloutCooldownTimer); falloutCooldownTimer = null; }

        // Безплатен автоматичен рестарт — кратка пауза колкото да се прочете съобщението,
        // след което новият пъзел тръгва директно в своя единствен 60-секунден SYSTEM COOLDOWN.
        setTimeout(() => {
            initFalloutGame(gameData.questions[currentQIndex], true);
        }, 900);
    }
}

// --- БУТОНИ И ПОМОЩНИ ФУНКЦИИ ---
document.getElementById('lower-diff-btn').onclick = function () {
    document.getElementById('tutorial-modal').style.display = 'flex';
};

document.getElementById('restart-fallout-btn').onclick = function () {
    if (this.disabled) return;
    this.style.display = 'none';
    initFalloutGame(gameData.questions[currentQIndex], true);
};

function disableAllInteractables() {
    document.querySelectorAll('.fallout-word, .fallout-symbol, .bracket-group').forEach(el => {
        el.classList.add('disabled');
        el.onclick = null;
    });
}

// --- DATA TAB: ЗАПАЗВАНЕ И ПОКАЗВАНЕ НА ОТКЛЮЧЕНИ КОДОВЕ ---
function getUnlockedCodes() {
    try {
        return JSON.parse(localStorage.getItem('unlockedSectorCodes') || '{}');
    } catch (e) {
        return {};
    }
}

function saveUnlockedCode(sectorId, code) {
    const codes = getUnlockedCodes();
    codes[sectorId] = code;
    localStorage.setItem('unlockedSectorCodes', JSON.stringify(codes));
    renderDataTab();
}

function removeUnlockedCode(sectorId) {
    const codes = getUnlockedCodes();
    delete codes[sectorId];
    localStorage.setItem('unlockedSectorCodes', JSON.stringify(codes));
    renderDataTab();
}

function renderDataTab() {
    const list = document.getElementById('data-codes-list');
    if (!list) return;
    const codes = getUnlockedCodes();
    const entries = Object.entries(codes);

    if (entries.length === 0) {
        list.innerHTML = '<div class="data-empty">> НЯМА ОТКЛЮЧЕНИ КОДОВЕ ДОСЕГА</div>';
        return;
    }

    list.innerHTML = entries.map(([id, code]) => `
        <div class="data-code-row">
            <span class="sector-id">СЕКТОР ${id}</span>
            <span class="code-value">${code}</span>
            <span class="remove-code-btn" data-sector-id="${id}">[ X ]</span>
        </div>
    `).join('');

    list.querySelectorAll('.remove-code-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            removeUnlockedCode(btn.dataset.sectorId);
        });
    });
}

// --- PIP-BOY TOP TABS LOGIC ---
function initPipTabs() {
    const tabs = document.querySelectorAll('.pip-tab:not(.pip-tab-action)');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('active')) return;

            menuChangeSound.currentTime = 0;
            menuChangeSound.volume = 0.7;
            menuChangeSound.play().catch(() => { });

            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

            if (tab.dataset.tab === 'data') {
                renderDataTab();
            }

            if (tab.dataset.tab === 'radio') {
                window.dispatchEvent(new Event('resize'));
            }
        });
    });
}
initPipTabs();

// --- RADIO TAB: СТАНЦИИ + BROADCAST-STYLE ВЪЗПРОИЗВЕЖДАНЕ ---
const radioStationMap = {
    classical: document.getElementById('radio-classical'),
    galaxy: document.getElementById('radio-galaxy'),
    mojave: document.getElementById('radio-mojave'),
    newvegas: document.getElementById('radio-newvegas'),
    pra: document.getElementById('radio-pra'),
    diamondcity: document.getElementById('radio-diamondcity'),
    shrimp: document.getElementById('radio-shrimp'),
    wernher: document.getElementById('radio-wernher'),
    outcast: document.getElementById('radio-outcast'),
};

// Фиксирана "начална точка на излъчване" - всички клиенти изчисляват позицията
// спрямо тази точка, така че да звучи сякаш слушат един и същ непрекъснат broadcast.
const BROADCAST_EPOCH = new Date('2026-01-01T00:00:00Z').getTime();

let currentRadioStationKey = 'classical';
let isRadioPlaying = false;
let radioAudioCtx = null;
let radioAnalyser = null;
let radioSourceNodes = {};
let radioFreqData = null;

function getBroadcastStartTime(audioEl) {
    if (!audioEl.duration || isNaN(audioEl.duration)) return 0;
    const elapsedMs = Date.now() - BROADCAST_EPOCH;
    const elapsedSec = elapsedMs / 1000;
    return elapsedSec % audioEl.duration;
}

function playRadioStation(key) {
    // Спираме всички останали станции
    Object.entries(radioStationMap).forEach(([k, audioEl]) => {
        if (!audioEl) return;
        if (k !== key) {
            audioEl.pause();
        }
    });

    const audioEl = radioStationMap[key];
    if (!audioEl) return;
    currentRadioStationKey = key;
    isRadioPlaying = true;

    const startPlayback = () => {
        audioEl.currentTime = getBroadcastStartTime(audioEl);
        audioEl.loop = true;
        audioEl.volume = 0.6;
        audioEl.play().catch(() => { });
        connectRadioAnalyser(audioEl);
    };

    if (audioEl.readyState >= 1) {
        startPlayback();
    } else {
        audioEl.addEventListener('loadedmetadata', startPlayback, { once: true });
        audioEl.load();
    }
}

function stopAllRadioStations() {
    Object.values(radioStationMap).forEach(audioEl => {
        if (audioEl) audioEl.pause();
    });
    isRadioPlaying = false;
}

// --- WEB AUDIO API: АНАЛИЗАТОР ЗА РЕАКТИВНА ВЪЛНА ---
function ensureRadioAudioContext() {
    if (radioAudioCtx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    radioAudioCtx = new AudioCtx();
    radioAnalyser = radioAudioCtx.createAnalyser();
    radioAnalyser.fftSize = 256;
    radioFreqData = new Uint8Array(radioAnalyser.frequencyBinCount);
}

function connectRadioAnalyser(audioEl) {
    ensureRadioAudioContext();
    if (radioAudioCtx.state === 'suspended') {
        radioAudioCtx.resume().catch(() => { });
    }

    // Преизползваме MediaElementSource ако вече е създаден за този елемент
    if (!radioSourceNodes[audioEl.id]) {
        try {
            const source = radioAudioCtx.createMediaElementSource(audioEl);
            source.connect(radioAnalyser);
            radioAnalyser.connect(radioAudioCtx.destination);
            radioSourceNodes[audioEl.id] = source;
        } catch (e) {
            // Source вече съществува за този елемент (повторно свързване)
        }
    }
}

function initRadioStations() {
    const stations = document.querySelectorAll('.radio-station');
    stations.forEach(station => {
        station.addEventListener('click', () => {
            const key = station.dataset.station;

            tickAudio.currentTime = 0;
            tickAudio.volume = 0.3;
            tickAudio.play().catch(() => { });

            // Клик върху вече активната свиреща станция -> СПИРА (като Fallout toggle)
            if (station.classList.contains('active') && isRadioPlaying && currentRadioStationKey === key) {
                stopAllRadioStations();
                station.classList.remove('active');
                return;
            }

            stations.forEach(s => s.classList.remove('active'));
            station.classList.add('active');
            playRadioStation(key);
        });
    });
}
initRadioStations();



// --- RADIO TAB: АНИМИРАНА ВЪЛНА (CANVAS), РЕАКТИВНА НА АУДИОТО ---
function initRadioWave() {
    const canvas = document.getElementById('radio-wave-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function drawWave() {
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;
        ctx.clearRect(0, 0, w, h);

        const currentAudio = radioStationMap[currentRadioStationKey];

        // Определяме състоянието на текущата станция
        const hasError = currentAudio && currentAudio.error;
        const isStopped = !currentAudio || currentAudio.paused || hasError;

        // Грид линии (като осцилоскоп)
        ctx.strokeStyle = 'rgba(42, 255, 0, 0.15)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 20) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 20) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
        }

        // Вълна
        ctx.strokeStyle = '#2aff00';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#2aff00';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const midY = h / 2;
        const points = 80;

        if (!isStopped && radioAnalyser && radioFreqData) {
            radioAnalyser.getByteFrequencyData(radioFreqData);
        }

        const isBuffering = currentAudio && currentAudio.readyState < 3;
        const hasRealAudioData = radioAnalyser && radioFreqData && radioFreqData.some(v => v > 0);

        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            let y;

            if (isStopped) {
                // ДЕФОЛТНА FM ВЪЛНА - когато нищо не свири
                const freq1 = Math.sin((i / points) * Math.PI * 6 + phase);
                const freq2 = Math.sin((i / points) * Math.PI * 13 + phase * 1.7) * 0.4;
                const amplitude = (h / 2) * 0.75;
                y = midY + (freq1 + freq2) * amplitude * 0.5;
            } else if (isBuffering && !hasRealAudioData) {
                // Буфериращо състояние (свири, но все още няма аудио данни) -> FM статичен шум
                const noise = (Math.random() - 0.5) * 2; // -1..1
                const microJitter = Math.sin((i / points) * Math.PI * 30 + phase * 3) * 0.15;
                const amplitude = (h / 2) * 0.9;
                y = midY + (noise + microJitter) * amplitude * 0.5;
            } else if (hasRealAudioData) {
                // Реална аудио данни от плеъра (включва тихи моменти - вълната просто се успокоява)
                const dataIndex = Math.floor((i / points) * radioFreqData.length);
                const raw = radioFreqData[dataIndex] / 255; // 0..1
                const amplitude = (h / 2) * 0.85;
                const wobble = Math.sin((i / points) * Math.PI * 4 + phase) * 0.15;
                y = midY - (raw * amplitude * (0.6 + wobble)) + (Math.sin(phase + i) * 4);
                // Огледваме периодично за по-естествен "вълна нагоре-надолу" вид
                if (i % 2 === 0) y = midY + (midY - y);
            } else {
                // Тих момент в реалното аудио (напр. пауза между говор) -> спокойна почти права линия
                const calm = Math.sin((i / points) * Math.PI * 2 + phase * 0.5) * 2;
                y = midY + calm;
            }

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        phase += 0.08;
        animFrameId = requestAnimationFrame(drawWave);
    }

    drawWave();
}
initRadioWave();

// --- БОС ПОБЕДА: АУДИО ПОСЛАНИЕ С РЕАКТИВНА ВЪЛНА ---
let bossVictoryAnalyser, bossVictoryFreqData, bossVictorySource, bossVictoryAnimId;

function connectBossVictoryAnalyser(audioEl) {
    ensureRadioAudioContext();
    if (radioAudioCtx.state === 'suspended') radioAudioCtx.resume().catch(() => { });
    if (!bossVictoryAnalyser) {
        bossVictoryAnalyser = radioAudioCtx.createAnalyser();
        bossVictoryAnalyser.fftSize = 256;
        bossVictoryFreqData = new Uint8Array(bossVictoryAnalyser.frequencyBinCount);
    }
    if (!bossVictorySource) {
        try {
            bossVictorySource = radioAudioCtx.createMediaElementSource(audioEl);
            bossVictorySource.connect(bossVictoryAnalyser);
            bossVictoryAnalyser.connect(radioAudioCtx.destination);
        } catch (e) { /* вече свързан */ }
    }
}

function drawBossVictoryWave() {
    const canvas = document.getElementById('boss-victory-wave-canvas');
    if (!canvas || canvas.offsetParent === null) { bossVictoryAnimId = null; return; }
    try {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && (canvas.width !== rect.width || canvas.height !== rect.height)) {
            canvas.width = rect.width; canvas.height = rect.height;
        }
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const audio = document.getElementById('boss-victory-audio');
        const isPlaying = audio && !audio.paused && !audio.ended;

        ctx.strokeStyle = 'rgba(42, 255, 0, 0.15)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 18) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }

        ctx.strokeStyle = '#2aff00';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#2aff00';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const midY = h / 2, points = 70;
        if (isPlaying && bossVictoryAnalyser) bossVictoryAnalyser.getByteFrequencyData(bossVictoryFreqData);
        const hasData = isPlaying && bossVictoryFreqData && bossVictoryFreqData.some(v => v > 0);
        const t = Date.now() / 260;

        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            let y;
            if (hasData) {
                const idx = Math.floor((i / points) * bossVictoryFreqData.length);
                const raw = bossVictoryFreqData[idx] / 255;
                const amp = (h / 2) * 0.85;
                const wobble = Math.sin((i / points) * Math.PI * 4 + t) * 0.15;
                y = midY - (raw * amp * (0.6 + wobble));
                if (i % 2 === 0) y = midY + (midY - y);
            } else {
                const calm = Math.sin((i / points) * Math.PI * 2 + t * 0.5) * 2;
                y = midY + calm;
            }
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    } catch (e) {
        console.error('drawBossVictoryWave error:', e);
    }
    bossVictoryAnimId = requestAnimationFrame(drawBossVictoryWave);
}

function setBossVictoryPlayIcon(playing) {
    const playIcon = document.getElementById('boss-victory-play-icon');
    const pauseIcon = document.getElementById('boss-victory-pause-icon');
    if (playIcon) playIcon.style.display = playing ? 'none' : '';
    if (pauseIcon) pauseIcon.style.display = playing ? '' : 'none';
}

function showBossVictoryModal() {
    const modal = document.getElementById('boss-victory-modal');
    if (!modal) { console.error('boss-victory-modal element not found in DOM'); return; }
    modal.style.display = 'flex';
    const audio = document.getElementById('boss-victory-audio');
    setBossVictoryPlayIcon(false); // по подразбиране показваме ▶, докато не потвърдим, че звучи нещо
    if (audio) {
        try { connectBossVictoryAnalyser(audio); } catch (e) { console.warn('audio analyser failed:', e); }
        try { audio.currentTime = 0; } catch (e) { }
        const p = audio.play();
        if (p && p.catch) p.catch(err => { console.warn('boss victory audio could not autoplay:', err); setBossVictoryPlayIcon(false); });
    }
    if (bossVictoryAnimId) cancelAnimationFrame(bossVictoryAnimId);
    drawBossVictoryWave();
}

(function wireBossVictoryControls() {
    const playPauseBtn = document.getElementById('boss-victory-playpause-btn');
    const audioEl = document.getElementById('boss-victory-audio');
    const closeBtn = document.getElementById('close-boss-victory-modal');

    if (playPauseBtn) playPauseBtn.addEventListener('click', () => {
        const audio = document.getElementById('boss-victory-audio');
        if (!audio) return;
        if (audio.paused) audio.play().catch(() => setBossVictoryPlayIcon(false));
        else audio.pause();
    });
    // Иконата следва реалното състояние на аудиото — ▶ докато няма звук/грешка/пауза, ⏸ само докато реално свири
    if (audioEl) {
        audioEl.addEventListener('play', () => setBossVictoryPlayIcon(true));
        audioEl.addEventListener('playing', () => setBossVictoryPlayIcon(true));
        audioEl.addEventListener('pause', () => setBossVictoryPlayIcon(false));
        audioEl.addEventListener('ended', () => setBossVictoryPlayIcon(false));
        audioEl.addEventListener('error', () => setBossVictoryPlayIcon(false));
        audioEl.addEventListener('stalled', () => setBossVictoryPlayIcon(false));
    }
    if (closeBtn) closeBtn.addEventListener('click', () => {
        const audio = document.getElementById('boss-victory-audio');
        if (audio) audio.pause();
        const modal = document.getElementById('boss-victory-modal');
        if (modal) modal.style.display = 'none';
        if (bossVictoryAnimId) cancelAnimationFrame(bossVictoryAnimId);
        if (typeof window.invadersOpenModeMenu === 'function') window.invadersOpenModeMenu();
    });
})();

// --- LOGO + MATRIX RAIN INTRO ---
function startLogoIntro() {
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');
    const logoEl = document.getElementById('logo-text');
    const logoScreen = document.getElementById('logo-screen');
    const dataSoundEl = document.getElementById('symbols-drop');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();

    const fontSize = 16;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;,./";
    const TRAIL_LEN = 20;

    let columns, drops, trails, wave;

    function initWave1() {
        // WAVE 1: all columns start at top simultaneously — fills screen like a curtain
        columns = Math.floor(canvas.width / fontSize);
        drops = [];
        trails = [];
        wave = 1;
        for (let i = 0; i < columns; i++) {
            drops[i] = 0;   // all start at row 0 together
            trails[i] = [];
        }
    }

    function initWave2() {
        // WAVE 2: random staggered start — uneven jagged look
        wave = 2;
        for (let i = 0; i < columns; i++) {
            drops[i] = -Math.floor(Math.random() * 50);
            trails[i] = [];
        }
    }

    let rafId = null;
    let running = false;
    let lastFrameTime = 0;
    const FRAME_MS = 40; // ~25fps — smooth but not too fast for matrix effect
    const totalRows = () => Math.ceil(canvas.height / fontSize);
    let wave1Done = false;
    let wave2Transition = false;

    function drawMatrix(timestamp) {
        if (!running) return;
        rafId = requestAnimationFrame(drawMatrix);

        // Throttle to FRAME_MS so the matrix moves at controlled speed
        if (timestamp - lastFrameTime < FRAME_MS) return;
        lastFrameTime = timestamp;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = fontSize + 'px "Share Tech Mono", monospace';

        let allDone = true;

        for (let i = 0; i < columns; i++) {
            const head = drops[i];

            for (let t = 0; t < trails[i].length; t++) {
                const row = head - (trails[i].length - t);
                if (row < 0) continue;
                const y = row * fontSize;
                if (y > canvas.height) continue;
                const ratio = (t + 1) / TRAIL_LEN;
                const alpha = ratio * ratio * 0.9;
                ctx.fillStyle = 'rgba(42, 255, 0, ' + alpha + ')';
                ctx.fillText(trails[i][t], i * fontSize, y);
            }

            if (head >= 0 && head * fontSize <= canvas.height) {
                ctx.fillStyle = '#bbffbb';
                ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, head * fontSize);
                allDone = false;
            } else if (head < 0) {
                allDone = false;
            }

            drops[i]++;
            trails[i].push(chars[Math.floor(Math.random() * chars.length)]);
            if (trails[i].length > TRAIL_LEN) trails[i].shift();

            if (wave === 2 && drops[i] > totalRows() + TRAIL_LEN) {
                drops[i] = -Math.floor(Math.random() * 40);
                trails[i] = [];
            }
        }

        // Transition wave 1 -> wave 2
        if (wave === 1 && allDone && !wave2Transition) {
            wave2Transition = true;
            setTimeout(() => {
                initWave2();
            }, 150);
        }
    }

    function stopMatrix() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    // Start
    setTimeout(() => {
        dataSoundEl.loop = true;
        dataSoundEl.play().catch(() => { });
        canvas.style.opacity = '1';
        initWave1();
        running = true;
        rafId = requestAnimationFrame(drawMatrix);
    }, 100);

    // Unlock аудиото при клик/touch върху logo екрана (преди start-overlay)
    // Повечето браузъри блокират autoplay преди user interaction
    function unlockAudioOnLogoInteraction() {
        dataSoundEl.play().catch(() => { });
        logoScreen.removeEventListener('click', unlockAudioOnLogoInteraction);
        logoScreen.removeEventListener('touchstart', unlockAudioOnLogoInteraction);
    }
    logoScreen.addEventListener('click', unlockAudioOnLogoInteraction);
    logoScreen.addEventListener('touchstart', unlockAudioOnLogoInteraction);

    // Show logo after wave 1 has traversed screen
    setTimeout(() => {
        logoEl.classList.add('visible');
    }, 2800);

    // End
    setTimeout(() => {
        dataSoundEl.pause();
        dataSoundEl.currentTime = 0;
        stopMatrix();

        logoScreen.classList.add('fade-out');
        setTimeout(() => {
            logoScreen.style.display = 'none';
            document.getElementById('start-overlay').style.display = 'flex';
        }, 800);
    }, 5500);
}

// --- EASTER EGG СТАНЦИИ: SHRIMP, WERNHER'S, OUTCAST (ВСЕКИ ДЕН, РАЗЛИЧНИ ЧАСОВЕ) ---
// Детерминиран псевдо-случаен прозорец за всяка станция, изчислен от датата,
// така че всички посетители да виждат станциите по едно и също "случайно" време всеки ден.
// Денонощието е разделено на 3 равни зони (по 8 часа), по една на станция,
// за да не се застъпват прозорците им.
function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const EASTER_EGG_STATIONS = [
    { key: 'shrimp', elId: 'shrimp-station', durationHours: 3, zoneIndex: 0, seedOffset: 1 },
    { key: 'wernher', elId: 'wernher-station', durationHours: 2, zoneIndex: 1, seedOffset: 2 },
    { key: 'outcast', elId: 'outcast-station', durationHours: 1.5, zoneIndex: 2, seedOffset: 3 },
];
const EASTER_EGG_ZONE_HOURS = 8; // 24ч / 3 станции

function getEasterEggWindowForToday(config) {
    const now = new Date();
    const dayKey = `${now.getUTCFullYear()}${now.getUTCMonth()}${now.getUTCDate()}`;
    const seed = parseInt(dayKey, 10) * 7 + config.seedOffset;

    const zoneStartHour = config.zoneIndex * EASTER_EGG_ZONE_HOURS;
    const maxOffsetHours = EASTER_EGG_ZONE_HOURS - config.durationHours;
    const randomOffsetHours = seededRandom(seed) * maxOffsetHours;

    const startMs = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0
    )).getTime() + (zoneStartHour + randomOffsetHours) * 60 * 60 * 1000;

    const endMs = startMs + (config.durationHours * 60 * 60 * 1000);

    return { startMs, endMs };
}

function updateEasterEggStationsVisibility() {
    EASTER_EGG_STATIONS.forEach(config => {
        const stationEl = document.getElementById(config.elId);
        if (!stationEl) return;

        const { startMs, endMs } = getEasterEggWindowForToday(config);
        const nowMs = Date.now();
        const isVisible = nowMs >= startMs && nowMs < endMs;

        if (isVisible) {
            stationEl.style.display = 'block';
        } else {
            stationEl.style.display = 'none';
            // Ако станцията изчезне докато свири - спираме я тихо
            if (currentRadioStationKey === config.key && isRadioPlaying) {
                stopAllRadioStations();
                stationEl.classList.remove('active');
            }
        }
    });
}

updateEasterEggStationsVisibility();
setInterval(updateEasterEggStationsVisibility, 30000);


// ===================== SPACE INVADERS v3 =====================
(function () {
    let gameRunning = false;
    let gamePaused = false;
    let animFrame = null;

    // Persistent unlock — survives between plays in same session
    let hardcoreEverUnlocked = false;
    let invadersEverStarted = false;

    const canvas = document.getElementById('invaders-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    // ── AUDIO ──────────────────────────────────────────────────
    const sfxPew = document.getElementById('inv-pew');
    const sfxFood = document.getElementById('inv-food');
    const bgNormal = document.getElementById('inv-normal-theme');
    const bgHard = document.getElementById('inv-hard-theme');
    const bgBoss1 = document.getElementById('inv-boss-theme-1');
    const bgBoss2 = document.getElementById('inv-boss-theme-2');

    let currentBg = null;
    let bossPhaseMusic = 1;

    // ── КАПАЧКИ (валута) + СКИНОВЕ НА КОРАБА — пази се между сесиите ──
    const SHIP_SKINS = [
        { id: 'green', label: 'КЛАСИЧЕСКИ', color: '#39FF14', price: 0 },
        { id: 'red', label: 'ЧЕРВЕН', color: '#ff2a2a', price: 1000 },
        { id: 'blue', label: 'СИН', color: '#2ab4ff', price: 1000 },
        { id: 'purple', label: 'ЛИЛАВ', color: '#c837ff', price: 1000 },
        { id: 'gold', label: 'ЗЛАТЕН', color: '#ffd42a', price: 1000 },
    ];

    function getCaps() {
        const n = parseInt(localStorage.getItem('argCaps') || '0', 10);
        return Number.isFinite(n) ? n : 0;
    }
    function addCaps(n) {
        const total = Math.max(0, getCaps() + n);
        localStorage.setItem('argCaps', String(total));
        updateCapsCounterUI();
        if (total >= 666) unlockAchievement('beast_caps');
        return total;
    }
    function spendCaps(n) {
        const total = getCaps();
        if (total < n) return false;
        localStorage.setItem('argCaps', String(total - n));
        updateCapsCounterUI();
        return true;
    }
    function getOwnedSkins() {
        try {
            const arr = JSON.parse(localStorage.getItem('argOwnedSkins') || '["green"]');
            return Array.isArray(arr) && arr.length ? arr : ['green'];
        } catch (e) { return ['green']; }
    }
    function saveOwnedSkins(arr) { localStorage.setItem('argOwnedSkins', JSON.stringify(arr)); }
    function ownsSkin(id) { return getOwnedSkins().includes(id); }

    let equippedSkinId = localStorage.getItem('argShipSkin') || 'green';
    function getSkinColor(id) {
        const skin = SHIP_SKINS.find(s => s.id === id) || SHIP_SKINS[0];
        return skin.color;
    }
    function equipSkin(id) {
        equippedSkinId = id;
        localStorage.setItem('argShipSkin', id);
    }

    function updateCapsCounterUI() {
        const el = document.getElementById('inv-caps-count');
        if (el) el.textContent = String(getCaps());
    }
    updateCapsCounterUI();

    // ── ПОСТИЖЕНИЯ ────────────────────────────────────────────────
    const ACHIEVEMENTS = [
        { id: 'fruit_master', label: '🍒 ПЛОДОВА САЛАТА', desc: 'Събери всеки вид обикновен плод поне веднъж' },
        { id: 'cap_collector', label: '🧢 КАПАЧКА ИЛИ ШАПКА?', desc: 'Вземи капачка от играта за първи път' },
        { id: 'nuka_fan', label: '🥤 СТУДЕНА NUKA-COLA', desc: 'Вземи Nuka-Cola за първи път' },
        { id: 'star_power', label: '⭐ РОКЗВЕЗДА', desc: 'Хвани дъгова звезда за първи път' },
        { id: 'normal_clear', label: '🎮 ТЕПЪРВА ЗАПОЧВАМЕ', desc: 'Победа в нормален режим' },
        { id: 'hard_clear', label: '🎮 КОРАВ ДО МОЗЪКА НА КОСТИТЕ', desc: 'Победа в труден режим' },
        { id: 'boss_clear', label: '🎮 КРАЯТ?', desc: 'Победи шефчето' },
        { id: 'new_skin', label: '🎨 НОВА ВИЗИЯ', desc: 'Купи нов скин за кораба' },
        { id: 'beast_caps', label: '😈 ЧИСЛОТО НА ЗВЯРА', desc: 'Събери 666 капачки' },
        { id: 'nuke_finisher', label: '☢️ ЕТО ЧЕ ИЗГРЯВА СЛЪНЦЕТО', desc: 'Изваждаме големите оръжия' },
        { id: 'seafood_gifts', label: '🍤 МОРСКИ ДАРОВЕ', desc: 'Скаридите винаги те наблюдават', rare: true },
        { id: 'smart_book', label: '📖 ЗНАНИЕТО Е СИЛА', desc: 'Намери книгата и повиши интелигентността си', rare: true },
        { id: 'all_achievements', label: '🏆 КОЛЕКЦИОНЕР', desc: 'Отключи всички постижения' },
    ];
    // Индекси от FRUITS, които се броят за общото постижение "ПЛОДОВА САЛАТА" (без капачка/nuka/звезда/скарида — те са отделни)
    const FRUIT_GROUP_INDICES = [0, 1, 2, 3, 4, 7, 8];

    function getUnlockedAchievements() {
        try {
            const arr = JSON.parse(localStorage.getItem('argAchievements') || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function hasAchievement(id) { return getUnlockedAchievements().includes(id); }
    function unlockAchievement(id) {
        const arr = getUnlockedAchievements();
        if (arr.includes(id)) return false;
        arr.push(id);
        localStorage.setItem('argAchievements', JSON.stringify(arr));
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) showAchievementToast(def);
        // Мета-постижение "КОЛЕКЦИОНЕР": отключва се, когато всички други са отключени
        if (id !== 'all_achievements') {
            const others = ACHIEVEMENTS.filter(a => a.id !== 'all_achievements').map(a => a.id);
            if (others.every(oid => arr.includes(oid))) unlockAchievement('all_achievements');
        }
        return true;
    }

    // ── КНИГА ЗА ИНТЕЛИГЕНТНОСТ (отключва хакването на шефчето) ──
    function hasIntelligenceBook() {
        return localStorage.getItem('argIntelligenceBook') === 'true';
    }
    function grantIntelligenceBook() {
        if (hasIntelligenceBook()) return;
        localStorage.setItem('argIntelligenceBook', 'true');
    }

    function getCollectedFruitIndices() {
        try {
            const arr = JSON.parse(localStorage.getItem('argCollectedFruits') || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function markFruitCollected(idx) {
        if (idx === 5) { unlockAchievement('cap_collector'); return; }
        if (idx === 6) { unlockAchievement('nuka_fan'); return; }
        if (idx === 9) { unlockAchievement('star_power'); return; }
        if (idx === SHRIMP_IDX) { unlockAchievement('seafood_gifts'); return; }
        if (idx === BOOK_IDX) { grantIntelligenceBook(); unlockAchievement('smart_book'); return; }
        if (!FRUIT_GROUP_INDICES.includes(idx)) return;
        const arr = getCollectedFruitIndices();
        if (!arr.includes(idx)) {
            arr.push(idx);
            localStorage.setItem('argCollectedFruits', JSON.stringify(arr));
        }
        if (FRUIT_GROUP_INDICES.every(i => arr.includes(i))) unlockAchievement('fruit_master');
    }

    let achToastTimer = null;
    function showAchievementToast(def) {
        let toast = document.getElementById('inv-achievement-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'inv-achievement-toast';
            toast.className = 'inv-achievement-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<div class="inv-ach-toast-title">★ ПОСТИЖЕНИЕ ОТКЛЮЧЕНО</div><div class="inv-ach-toast-name">${def.label}</div>`;
        toast.classList.add('show');
        if (achToastTimer) clearTimeout(achToastTimer);
        achToastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    }

    function renderAchievements() {
        const list = document.getElementById('achievements-list');
        const countEl = document.getElementById('achievements-count');
        if (!list) return;
        const unlocked = getUnlockedAchievements();
        if (countEl) countEl.textContent = `${unlocked.length} / ${ACHIEVEMENTS.length} отключени`;
        list.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const isUnlocked = unlocked.includes(a.id);
            const row = document.createElement('div');
            row.className = 'achievement-row' + (isUnlocked ? '' : ' locked') + (a.rare ? ' rare-rgb' : '');
            row.innerHTML = `
                <svg class="achievement-icon" viewBox="0 0 24 24">
                    <path d="M12 1.5 L14.9 8.7 L22.8 9.4 L16.8 14.6 L18.7 22.3 L12 18 L5.3 22.3 L7.2 14.6 L1.2 9.4 L9.1 8.7 Z" fill="currentColor" />
                </svg>
                <div class="achievement-text">
                    <div class="achievement-name">${a.label}</div>
                    <div class="achievement-desc">${isUnlocked ? a.desc : '???'}</div>
                </div>`;
            list.appendChild(row);
        });
    }

    function playBg(audio) {
        if (currentBg === audio) return;
        if (currentBg) { currentBg.pause(); currentBg.currentTime = 0; }
        currentBg = audio;
        if (audio) { audio.volume = (audio === bgHard) ? 0.26 : 0.45; audio.play().catch(() => { }); }
    }

    function stopBg() {
        if (currentBg) { currentBg.pause(); currentBg.currentTime = 0; currentBg = null; }
    }

    // Музиката трябва да свири само докато реално играеш — не на пауза,
    // не извън играта, не на друг пъзел и не на екрана победа/загуба.
    function updateBgPlayback() {
        if (!currentBg) return;
        const shouldPlay = gameRunning && !gamePaused && state && !state.over && !state.won;
        if (shouldPlay) {
            if (currentBg.paused) currentBg.play().catch(() => { });
        } else {
            if (!currentBg.paused) currentBg.pause();
        }
    }

    let pewQueued = false;
    function playPew() {
        if (!sfxPew) return;
        if (sfxPew.paused || sfxPew.ended) {
            sfxPew.currentTime = 0;
            sfxPew.volume = 0.35;
            sfxPew.play().catch(() => { });
        } else {
            // Вече свири — опашка от най-много 1 звук, изчаква текущия да свърши
            pewQueued = true;
        }
    }
    if (sfxPew) {
        sfxPew.addEventListener('ended', () => {
            if (pewQueued) {
                pewQueued = false;
                sfxPew.currentTime = 0;
                sfxPew.volume = 0.35;
                sfxPew.play().catch(() => { });
            }
        });
    }

    function playFood() {
        if (!sfxFood) return;
        sfxFood.currentTime = 0;
        sfxFood.volume = 0.7;
        sfxFood.play().catch(() => { });
    }

    function selectBgForMode(mode, bossPhase) {
        if (mode === 'boss') {
            return bossPhase === 2 ? bgBoss2 : bgBoss1;
        } else if (mode === 'hardcore') {
            return bgHard;
        }
        return bgNormal;
    }

    function resizeCanvas() {
        if (!canvas) return;
        const modal = document.getElementById('question-modal');
        const padding = 60; // modal padding both sides
        const maxW = Math.min((modal ? modal.clientWidth : 640) - padding, 640);
        const w = Math.max(maxW, 320);
        canvas.width = w;
        canvas.height = Math.round(w * 0.82);
    }

    const GREEN = '#39FF14';
    const DIM = '#1a6e0a';
    const RED = '#ff4444';
    const YELLOW = '#ffee44';

    const ALIEN_SPRITES = [
        [[0, 1, 0, 1, 0], [1, 1, 1, 1, 1], [1, 0, 1, 0, 1], [0, 1, 1, 1, 0], [0, 1, 0, 1, 0]],
        [[0, 0, 1, 0, 0], [0, 1, 1, 1, 0], [1, 1, 0, 1, 1], [1, 0, 1, 0, 1], [1, 1, 0, 1, 1]],
        [[1, 0, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 1, 1, 0], [0, 1, 0, 1, 0], [1, 0, 0, 0, 1]],
    ];

    const BOSS_SPRITE = [
        [0, 0, 1, 0, 0, 0, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 0, 1, 1, 1, 0, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 0, 1, 0, 1, 0, 1, 0],
        [1, 0, 1, 0, 0, 0, 1, 0, 1],
    ];

    let state = null;
    let gameMode = 'normal';
    const WIN_SCORE = 1000;

    // ── SPAWN HELPERS ──────────────────────────────────────────
    function spawnAliens(W, H) {
        const ROWS = 5, COLS = 9;
        const AW = 32, AH = 25, PADX = 14, PADY = 10;
        const startX = (W - COLS * (AW + PADX)) / 2 + 4;
        const startY = 58;
        const aliens = [];
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                aliens.push({
                    r, c,
                    x: startX + c * (AW + PADX),
                    y: startY + r * (AH + PADY),
                    alive: true,
                    type: r === 0 ? 0 : r <= 2 ? 1 : 2,
                    frame: 0
                });
        return aliens;
    }

    function spawnShelters(W, H) {
        const count = 4, sy = H - 82;
        const spacing = W / (count + 1);
        return Array.from({ length: count }, (_, i) => {
            const sx = Math.round(spacing * (i + 1) - 18);
            const blocks = [];
            for (let br = 0; br < 3; br++)
                for (let bc = 0; bc < 6; bc++) {
                    if (br === 2 && (bc === 2 || bc === 3)) continue;
                    blocks.push({ br, bc, hp: 3 });
                }
            return { x: sx, y: sy, origX: sx, origY: sy, blocks };
        });
    }

    function spawnBoss(W) {
        return {
            x: W / 2 - 60, y: 28,
            w: 120, h: 62,
            hp: 260, maxHp: 260,
            dir: 1, speed: 0.7, vDir: 1,
            phase: 1,
            attackTimer: 0, attackInterval: 100,
            cherryDroppedAt: [224, 188, 152, 115, 80, 43], // drop loot at these HP thresholds
            lastCherryHp: 260,
            isDashing: false, dashFrames: 0, dashDir: 1,
            // ── Планировчик за специални атаки (само една активна наведнъж) ──
            telegraphType: null, telegraphTimer: 0,
            specialCooldown: 110,
            minionTimer: 200,
        };
    }

    // ── INIT ───────────────────────────────────────────────────
    function initState(mode) {
        resizeCanvas();
        const W = canvas.width, H = canvas.height;
        gameMode = mode || 'normal';
        const isBoss = gameMode === 'boss';
        setPhase3MobileControls(false, false);

        return {
            W, H,
            mode: gameMode,
            player: { x: W / 2 - 18, y: H - 46, w: 36, h: 14 },
            aliens: isBoss ? [] : spawnAliens(W, H),
            bullets: [], bombs: [],
            shelters: spawnShelters(W, H),
            alienDir: 1,
            alienSpeed: gameMode === 'hardcore' ? 0.52 : 0.38,
            alienDropY: 14,
            alienMoveTimer: 0,
            alienMoveInterval: gameMode === 'hardcore' ? 44 : 54,
            alienBombTimer: 0,
            alienBombInterval: gameMode === 'hardcore' ? 68 : 90,
            score: 0,
            lives: 3,
            over: false, won: false,
            flashTimer: 0, playerInvincible: 0,
            tripleShot: 0, rainbowTimer: 0,
            keys: {},
            mobileLeft: false, mobileRight: false, mobileFire: false,
            mobileUp: false, mobileDown: false,
            shootCooldown: 0,
            phase3: null, // състояние на новата фаза-3 "кутия" (Undertale-стил)
            idleTimer: 0,       // frames without horizontal movement
            idlePushDir: 0,     // -1 or 1 when being pushed
            idlePushTimer: 0,
            ufoActive: false, ufoX: 0, ufoY: 30, ufoDir: 1,
            ufoTimer: 0, ufoInterval: 700, ufoSpeedPx: 1.4,
            cherries: [], cherryTimer: 0, cherryInterval: 210,
            boss: isBoss ? spawnBoss(W) : null,
            minions: [],
            popups: [],
            waveCount: 0,   // how many times aliens respawned
            codeGiven: false,
            miniNuke: null, hasMiniNuke: false, nukeInFlight: false,
            explodeTimer: 0, explodeX: 0, explodeY: 0,
        };
    }

    // ── DRAW ───────────────────────────────────────────────────
    function drawAlienSprite(type, x, y, w, h, frame) {
        const sp = ALIEN_SPRITES[type];
        const rows = sp.length, cols = sp[0].length;
        const pw = w / cols, ph = h / rows;
        const mirror = frame % 2 === 1;
        ctx.fillStyle = GREEN;
        ctx.shadowBlur = 5; ctx.shadowColor = GREEN;
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
                const sc = mirror ? cols - 1 - c : c;
                if (sp[r][sc]) ctx.fillRect(x + c * pw, y + r * ph, pw - 0.5, ph - 0.5);
            }
        ctx.shadowBlur = 0;
    }

    function drawBossSprite(boss) {
        const sp = BOSS_SPRITE;
        const rows = sp.length, cols = sp[0].length;
        const pw = boss.w / cols, ph = boss.h / rows;
        const angry = boss.hp < boss.maxHp / 2;
        let color;
        if (boss.phase >= 4) color = '#ff00ff';
        else if (boss.phase >= 3) color = '#ff4400';
        else if (boss.phase >= 2) color = '#ff6600';
        else color = '#ff8800';
        ctx.fillStyle = color;
        ctx.shadowBlur = 14; ctx.shadowColor = color;
        const mirror = Math.floor(Date.now() / 280) % 2 === 1;
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
                const sc = mirror ? cols - 1 - c : c;
                if (sp[r][sc]) ctx.fillRect(boss.x + c * pw, boss.y + r * ph, pw - 0.5, ph - 0.5);
            }
        ctx.shadowBlur = 0;
        if (boss.asleep) {
            // ── Заспал: очите приливат в различни цветове, Zzzz се носи над него ──
            const hue = (Date.now() / 8) % 360;
            ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${hue},100%,60%)`;
            ctx.fillStyle = `hsl(${hue},100%,55%)`;
            ctx.fillRect(boss.x + 24, boss.y + 14, 9, 3);
            ctx.fillRect(boss.x + boss.w - 33, boss.y + 14, 9, 3);
            ctx.shadowBlur = 0;
            const bob = Math.sin(Date.now() / 260) * 4;
            ctx.fillStyle = `hsl(${(hue + 60) % 360},100%,65%)`;
            ctx.font = 'bold 16px "Share Tech Mono", monospace';
            ctx.fillText('Z z Z z', boss.x + boss.w + 6, boss.y + 10 + bob);
        } else {
            const telegraphing = !!boss.telegraphType;
            const eyePulse = telegraphing ? (0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 85))) : 1;
            if (telegraphing) { ctx.shadowBlur = 12; ctx.shadowColor = '#ff2020'; ctx.fillStyle = `rgba(255,30,30,${eyePulse})`; }
            else { ctx.fillStyle = '#fff'; }
            ctx.fillRect(boss.x + 24, boss.y + 11, 9, 9);
            ctx.fillRect(boss.x + boss.w - 33, boss.y + 11, 9, 9);
            ctx.shadowBlur = 0;
            ctx.fillStyle = telegraphing ? '#330000' : '#000';
            ctx.fillRect(boss.x + 26, boss.y + 13, 5, 5);
            ctx.fillRect(boss.x + boss.w - 31, boss.y + 13, 5, 5);
        }
    }

    // ── Fallout-style mini nuke pickup ──────────────────────────
    function drawMiniNuke(m) {
        const x = m.x, y = m.y;
        ctx.save();
        ctx.shadowBlur = 10; ctx.shadowColor = '#ffee44';
        ctx.fillStyle = '#7a7a4a';
        ctx.beginPath(); ctx.ellipse(x, y, 9, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 9, y - 4, 18, 5);
        ctx.fillStyle = '#ffee44';
        ctx.beginPath(); ctx.arc(x, y - 4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.moveTo(x - 9, y + 10); ctx.lineTo(x - 15, y + 17); ctx.lineTo(x - 5, y + 13); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 9, y + 10); ctx.lineTo(x + 15, y + 17); ctx.lineTo(x + 5, y + 13); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ── Анимация на взрива, когато mini nuke-ът довърши шефчето ──
    function drawBossExplosion(x, y, timer) {
        const total = 70;
        const t = total - timer;
        const p1 = Math.min(1, t / 30);
        const radius = 10 + p1 * 150;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,240,150,${Math.max(0, 1 - p1)})`;
        ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,120,40,${Math.max(0, 0.8 - p1)})`;
        ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (t < 10) {
            ctx.fillStyle = `rgba(255,255,255,${1 - t / 10})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }

    function drawPlayer(p, inv, rainbow) {
        if (rainbow > 0) {
            const hue = (Date.now() / 4) % 360;
            ctx.fillStyle = `hsl(${hue},100%,55%)`;
            ctx.shadowBlur = 14; ctx.shadowColor = `hsl(${hue},100%,60%)`;
        } else {
            if (inv > 0 && Math.floor(inv / 4) % 2 === 0) return;
            const col = getSkinColor(equippedSkinId);
            ctx.fillStyle = col; ctx.shadowBlur = 10; ctx.shadowColor = col;
        }
        ctx.fillRect(p.x + 7, p.y + 5, p.w - 14, p.h - 5);
        ctx.fillRect(p.x + p.w / 2 - 4, p.y, 8, 7);
        ctx.fillRect(p.x, p.y + p.h - 5, 12, 5);
        ctx.fillRect(p.x + p.w - 12, p.y + p.h - 5, 12, 5);
        ctx.shadowBlur = 0;
    }

    function drawCherry(c) {
        ctx.shadowBlur = 8; ctx.shadowColor = '#ff4488';
        ctx.fillStyle = '#cc2244';
        ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(c.x + 9, c.y + 1, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#228833'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 6);
        ctx.quadraticCurveTo(c.x + 4, c.y - 16, c.x + 9, c.y - 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    function drawShelter(sh) {
        sh.blocks.forEach(b => {
            ctx.fillStyle = `rgba(57,255,20,${b.hp / 3})`;
            ctx.shadowBlur = 2; ctx.shadowColor = GREEN;
            ctx.fillRect(sh.x + b.bc * 6, sh.y + b.br * 7, 5, 6);
        });
        ctx.shadowBlur = 0;
    }

    function drawBossBar(s) {
        const boss = s.boss;
        // Bar sits just under the boss sprite, near the top — well away from
        // the player's flight zone at the bottom of the screen.
        const bh = 14, bw = s.W - 60, bx = 30;
        const labelY = boss.y + boss.h + 22;   // label row, below the boss sprite
        const by = labelY + 8;                 // bar row
        const pct = Math.max(0, boss.hp / boss.maxHp);

        // Phase colour
        let barColor;
        if (boss.phase >= 4) barColor = '#ff00ff';
        else if (boss.phase >= 3) barColor = '#ff8800';
        else if (boss.phase >= 2) barColor = '#ff4400';
        else barColor = RED;

        // Dark separator line above the whole boss-bar zone
        ctx.fillStyle = '#111';
        ctx.fillRect(0, labelY - 6, s.W, 1);

        // Label
        ctx.shadowBlur = 6; ctx.shadowColor = barColor;
        ctx.fillStyle = barColor;
        ctx.font = `bold 11px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('ЖИВОТ НА ШЕФЧЕТО', s.W / 2, labelY);
        ctx.shadowBlur = 0;

        // Bar background
        ctx.fillStyle = '#220000';
        ctx.fillRect(bx, by, bw, bh);

        // Bar fill
        ctx.fillStyle = barColor;
        ctx.shadowBlur = 10; ctx.shadowColor = barColor;
        ctx.fillRect(bx, by, Math.round(bw * pct), bh);
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = barColor; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bw, bh);

        // HP numbers inside bar
        ctx.fillStyle = '#fff';
        ctx.font = `bold 11px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${boss.hp} / ${boss.maxHp}`, s.W / 2, by + 11);

        // Phase pip indicators
        const phases = 4;
        const pipW = 18, pipH = 6, pipGap = 6;
        const totalPips = phases * pipW + (phases - 1) * pipGap;
        let px = bx + bw - totalPips - 4;
        for (let i = 0; i < phases; i++) {
            ctx.fillStyle = (boss.phase > i) ? barColor : '#440000';
            ctx.fillRect(px, by + bh - pipH - 2, pipW, pipH);
            px += pipW + pipGap;
        }

        ctx.textAlign = 'left';
    }

    function drawHUD(s) {
        const fs = Math.max(13, Math.round(s.W / 38));
        const row1 = fs + 7;
        const row2 = row1 + fs + 1;

        ctx.shadowBlur = 0;

        // Row 1 — main stats
        ctx.font = `bold ${fs}px "Share Tech Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.fillStyle = GREEN;
        ctx.fillText(`ТОЧКИ: ${s.score}`, 8, row1);

        const livesStr = '■ '.repeat(Math.max(0, s.lives)).trim();
        ctx.textAlign = 'center';
        ctx.fillStyle = GREEN;
        ctx.fillText(`ЖИВОТИ: ${livesStr}`, s.W / 2, row1);

        let modeLabel, modeColor;
        if (s.mode === 'hardcore') { modeLabel = 'ТРУДЕН'; modeColor = YELLOW; }
        else if (s.mode === 'boss') { modeLabel = 'ШЕФЧЕТО'; modeColor = RED; }
        else { modeLabel = 'НОРМАЛЕН'; modeColor = GREEN; }
        ctx.fillStyle = modeColor;
        ctx.textAlign = 'right';
        ctx.fillText(modeLabel, s.W - 8, row1);

        // Row 2 — secondary info
        ctx.font = `${fs - 1}px "Share Tech Mono", monospace`;
        ctx.fillStyle = DIM;

        if (s.mode === 'hardcore' || s.mode === 'boss') {
            const maxWaves = s.mode === 'hardcore' ? 10 : 3;
            const wave = Math.min((s.waveCount || 0) + 1, maxWaves);
            ctx.textAlign = 'left';
            ctx.fillText(`Ниво ${wave} от ${maxWaves}`, 8, row2);
        }

        if (s.mode !== 'boss') {
            ctx.textAlign = 'right';
            // Normal mode shows target, hardcore shows nothing (score accumulates)
            if (s.mode === 'normal') {
                ctx.fillText(`Цел: ${WIN_SCORE}`, s.W - 8, row2);
            }
        }

        // Row 3 — капачки (валута)
        const row3 = row2 + fs;
        ctx.font = `${fs - 2}px "Share Tech Mono", monospace`;
        ctx.fillStyle = '#ffcc33';
        ctx.textAlign = 'left';
        ctx.fillText(`☢ ${getCaps()} капачки`, 8, row3);

        ctx.textAlign = 'left';
    }


    function draw(s) {
        ctx.clearRect(0, 0, s.W, s.H);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s.W, s.H);

        // Subtle scanlines
        for (let y = 0; y < s.H; y += 4) {
            ctx.fillStyle = 'rgba(0,0,0,0.07)';
            ctx.fillRect(0, y, s.W, 2);
        }

        drawHUD(s);

        ctx.fillStyle = DIM;
        ctx.fillRect(0, s.H - 28, s.W, 1);

        const inBox = s.mode === 'boss' && s.boss && s.boss.phase === 3 && s.boss.hp > 0;

        if (!inBox) s.shelters.forEach(sh => drawShelter(sh));
        s.aliens.forEach(a => { if (a.alive) drawAlienSprite(a.type, a.x, a.y, 30, 22, a.frame); });
        if (s.minions) s.minions.forEach(m => { if (m.alive) drawAlienSprite(2, m.x, m.y, 22, 16, m.frame); });

        if (s.boss) {
            if (s.boss.exploding) {
                drawBossExplosion(s.explodeX, s.explodeY, s.explodeTimer);
            } else {
                // рисуваме и докато спи на 0 hp — чакаме nuke-а да го довърши
                drawBossSprite(s.boss);
                drawBossBar(s);
            }
        }

        if (s.ufoActive && !inBox) {
            ctx.fillStyle = RED; ctx.shadowBlur = 8; ctx.shadowColor = RED;
            ctx.beginPath(); ctx.ellipse(s.ufoX + 18, s.ufoY + 5, 10, 6, 0, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(s.ufoX + 18, s.ufoY + 10, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            for (let i = 0; i < 3; i++) ctx.fillRect(s.ufoX + 6 + i * 10, s.ufoY + 7, 4, 4);
        }

        if (!inBox) s.cherries.forEach(c => drawFruit(c));
        if (s.miniNuke) drawMiniNuke(s.miniNuke);

        if (inBox) {
            drawPhase3(s);
        } else {
            drawPlayer(s.player, s.playerInvincible, s.rainbowTimer);
            s.bullets.forEach(b => {
                if (b.nuke) { drawMiniNuke({ x: b.x + 4, y: b.y + 8 }); return; }
                ctx.fillStyle = GREEN; ctx.shadowBlur = 7; ctx.shadowColor = GREEN;
                ctx.fillRect(b.x, b.y, 3, 12); ctx.shadowBlur = 0;
            });
            s.bombs.forEach(b => {
                const col = b.spread ? YELLOW : RED;
                ctx.fillStyle = col; ctx.shadowBlur = 4; ctx.shadowColor = col;
                ctx.fillRect(b.x, b.y, b.spread ? 4 : 3, b.spread ? 10 : 8);
                ctx.shadowBlur = 0;
            });
        }

        if (s.flashTimer > 0) {
            ctx.fillStyle = `rgba(255,68,68,${s.flashTimer / 20 * 0.3})`;
            ctx.fillRect(0, 0, s.W, s.H);
        }

        // Popups
        s.popups = s.popups.filter(p => {
            p.life--;
            const alpha = p.life / p.maxLife;
            ctx.font = `bold ${p.size}px "Share Tech Mono", monospace`;
            ctx.fillStyle = p.color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
            ctx.textAlign = 'center';
            ctx.shadowBlur = 6; ctx.shadowColor = p.color;
            ctx.fillText(p.text, p.x, p.y - (p.maxLife - p.life) * 0.5);
            ctx.shadowBlur = 0; ctx.textAlign = 'left';
            return p.life > 0;
        });

        // Overlays
        if (s.over) {
            drawOverlay(RED, 'КРАЙ НА ИГРАТА', `ТОЧКИ: ${s.score}`, hardcoreEverUnlocked ? '[ SPACE — РЕСТАРТ ] или избери режим по-долу' : '[ SPACE — РЕСТАРТ ]');
        } else if (s.won) {
            if (s.mode === 'boss') {
                drawBossWin(s);
            } else if (s.mode === 'hardcore') {
                drawHardcoreWin(s);
            } else {
                drawNormalWin(s);
            }
        } else if (gamePaused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, s.W, s.H);
            ctx.fillStyle = GREEN; ctx.font = `bold 22px "Share Tech Mono", monospace`;
            ctx.textAlign = 'center'; ctx.shadowBlur = 10; ctx.shadowColor = GREEN;
            ctx.fillText('// ПАУЗА //', s.W / 2, s.H / 2);
            ctx.shadowBlur = 0; ctx.textAlign = 'left';
        }
    }

    function drawOverlay(color, title, sub, hint) {
        const s = state;
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.shadowBlur = 0; ctx.textAlign = 'center';
        ctx.fillStyle = color; ctx.font = `bold 30px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = color;
        ctx.fillText(title, s.W / 2, s.H / 2 - 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `16px "Share Tech Mono", monospace`;
        ctx.fillText(sub, s.W / 2, s.H / 2 + 4);
        ctx.fillStyle = GREEN; ctx.font = `bold 13px "Share Tech Mono", monospace`;
        ctx.fillText(hint, s.W / 2, s.H / 2 + 30);
        ctx.textAlign = 'left';
    }















    function drawNormalWin(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center'; ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `bold 30px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = GREEN;
        ctx.fillText('ПОБЕДА!', s.W / 2, s.H / 2 - 68);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `16px "Share Tech Mono", monospace`;
        ctx.fillText(`ТОЧКИ: ${s.score}`, s.W / 2, s.H / 2 - 38);
        ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
        ctx.strokeRect(s.W / 2 - 100, s.H / 2 - 28, 200, 34);
        ctx.fillStyle = GREEN; ctx.font = `bold 22px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 10; ctx.shadowColor = GREEN;
        ctx.fillText('КОД:  P', s.W / 2, s.H / 2 - 5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = YELLOW; ctx.font = `bold 15px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 8; ctx.shadowColor = YELLOW;
        ctx.fillText('★ ТРУДЕН РЕЖИМ ОТКЛЮЧЕН ★', s.W / 2, s.H / 2 + 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `bold 13px "Share Tech Mono", monospace`;
        ctx.fillText('[ SPACE — РЕСТАРТ ]  или избери режим по-долу', s.W / 2, s.H / 2 + 54);
        ctx.textAlign = 'left';
    }

    function drawHardcoreWin(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center'; ctx.shadowBlur = 0;
        ctx.fillStyle = YELLOW; ctx.font = `bold 28px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = YELLOW;
        ctx.fillText('10 ВЪЛНИ ПРЕЖИВЕНИ!', s.W / 2, s.H / 2 - 64);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `16px "Share Tech Mono", monospace`;
        ctx.fillText(`ТОЧКИ: ${s.score}`, s.W / 2, s.H / 2 - 36);

        if (window.bossEverUnlocked) {
            ctx.fillStyle = RED; ctx.font = `bold 16px "Share Tech Mono", monospace`;
            ctx.shadowBlur = 10; ctx.shadowColor = RED;
            ctx.fillText('★ РЕЖИМ ШЕФЧЕТО ОТКЛЮЧЕН ★', s.W / 2, s.H / 2 - 8);
            ctx.shadowBlur = 0;
            ctx.fillStyle = GREEN; ctx.font = `bold 13px "Share Tech Mono", monospace`;
            ctx.fillText('[ SPACE — РЕСТАРТ ]  или избери режим по-долу', s.W / 2, s.H / 2 + 22);
        } else {
            ctx.fillStyle = RED; ctx.font = `bold 14px "Share Tech Mono", monospace`;
            ctx.shadowBlur = 10; ctx.shadowColor = RED;
            ctx.fillText('★ КОД ЗА ШЕФЧЕТО ОТКРИТ ★', s.W / 2, s.H / 2 - 8);
            ctx.shadowBlur = 0;
            ctx.fillStyle = YELLOW; ctx.font = `bold 15px "Share Tech Mono", monospace`;
            ctx.shadowBlur = 8; ctx.shadowColor = YELLOW;
            ctx.fillText('↑ ↑ ↓ ↓ ← → ← → B A ENTER', s.W / 2, s.H / 2 + 16);
            ctx.shadowBlur = 0;
            ctx.fillStyle = GREEN; ctx.font = `bold 12px "Share Tech Mono", monospace`;
            ctx.fillText('[ SPACE — РЕСТАРТ ]  или избери режим по-долу', s.W / 2, s.H / 2 + 42);
        }
        ctx.textAlign = 'left';
    }

    function drawBossWin(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;

        ctx.fillStyle = RED; ctx.font = `bold 30px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = RED;
        ctx.fillText('ШЕФЧЕТО Е ПОБЕДЕНО!', s.W / 2, s.H / 2 - 36);
        ctx.shadowBlur = 0;

        ctx.fillStyle = GREEN; ctx.font = `16px "Share Tech Mono", monospace`;
        ctx.fillText(`ТОЧКИ: ${s.score}`, s.W / 2, s.H / 2 - 4);

        ctx.fillStyle = GREEN; ctx.font = `bold 13px "Share Tech Mono", monospace`;
        ctx.fillText('[ SPACE — РЕСТАРТ ]  или избери режим по-долу', s.W / 2, s.H / 2 + 26);
        ctx.textAlign = 'left';
    }

    // ── UPDATE ─────────────────────────────────────────────────
    function addPopup(x, y, text, color, size) {
        state.popups.push({ x, y, text, color: color || 'rgb(57,255,20)', size: size || 13, life: 55, maxLife: 55 });
    }

    function rect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    // Would the player's ship, at position (x,y), overlap a still-standing shelter block?
    function playerHitsShelter(s, x, y, w, h) {
        for (const sh of s.shelters) {
            for (const blk of sh.blocks) {
                const bx2 = sh.x + blk.bc * 6, by2 = sh.y + blk.br * 7;
                if (rect(x, y, w, h, bx2, by2, 5, 6)) return true;
            }
        }
        return false;
    }

    function update(s) {
        if (s.over || s.won || gamePaused) return;

        const p = s.player;
        const spd = 3.2;
        const vertPhase = s.mode === 'boss' && s.boss && s.boss.phase === 3;
        const leftKey = s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A'] || s.mobileLeft;
        const rightKey = s.keys['ArrowRight'] || s.keys['d'] || s.keys['D'] || s.mobileRight;

        if (vertPhase) {
            // ── Фаза 3 (ново): свободно движение в кутията, докато отбягваме атака ──
            if (s.phase3 && s.phase3.stage === 'attack') {
                const upKey = s.keys['ArrowUp'] || s.keys['w'] || s.keys['W'] || s.mobileUp;
                const downKey = s.keys['ArrowDown'] || s.keys['s'] || s.keys['S'] || s.mobileDown;
                const spd3 = 2.6;
                const box = s.phase3.box;
                let nx = p.x, ny = p.y;
                if (leftKey) nx -= spd3;
                if (rightKey) nx += spd3;
                if (upKey) ny -= spd3;
                if (downKey) ny += spd3;
                p.x = Math.max(box.x + 4, Math.min(box.x + box.w - p.w - 4, nx));
                p.y = Math.max(box.y + 4, Math.min(box.y + box.h - p.h - 4, ny));
            }
            s.idleTimer = 0; s.idlePushDir = 0; s.idlePushTimer = 0;
        } else {
            if (leftKey && p.x > 0) {
                const nx = p.x - spd;
                if (!playerHitsShelter(s, nx, p.y, p.w, p.h)) p.x = nx;
            }
            if (rightKey && p.x + p.w < s.W) {
                const nx = p.x + spd;
                if (!playerHitsShelter(s, nx, p.y, p.w, p.h)) p.x = nx;
            }

            // Anti-idle: push after 8 seconds (480 frames) of no horizontal movement
            if (leftKey || rightKey) {
                s.idleTimer = 0;
                s.idlePushDir = 0;
                s.idlePushTimer = 0;
            } else {
                s.idleTimer++;
                if (s.idleTimer >= 480 && s.idlePushDir === 0) {
                    // Pick random direction away from edge
                    s.idlePushDir = p.x < s.W / 2 ? 1 : -1;
                    s.idlePushTimer = 90; // push for 1.5s
                    addPopup(p.x + p.w / 2, p.y - 18, '⚠ РУХАЙ!', 'rgb(255,238,68)', 13);
                }
            }
            if (s.idlePushDir !== 0 && s.idlePushTimer > 0) {
                const idleNx = p.x + s.idlePushDir * 2.2;
                if (!playerHitsShelter(s, idleNx, p.y, p.w, p.h)) p.x = idleNx;
                p.x = Math.max(0, Math.min(s.W - p.w, p.x));
                s.idlePushTimer--;
                if (s.idlePushTimer <= 0) {
                    s.idlePushDir = 0;
                    s.idleTimer = 0;
                }
            }
        }

        if (s.shootCooldown > 0) s.shootCooldown--;
        const wantFire = s.keys['ArrowUp'] || s.keys['w'] || s.keys['W'] || s.mobileFire;
        const bulletCap = s.tripleShot > 0 ? 6 : 2;
        if (vertPhase) {
            // Фаза 3 (ново): няма ръчна стрелба тук — "огънят" се ползва само
            // за заключване на индикатора за щета (виж updatePhase3Wheel)
        } else if (wantFire && s.shootCooldown === 0 && !s.nukeInFlight && (s.hasMiniNuke || s.bullets.length < bulletCap)) {
            if (s.hasMiniNuke) {
                // Решаващият изстрел — mini nuke-ът лети бавно напред и разбива шефчето;
                // спираме всякаква друга стрелба, докато лети, за да се синхронизира със звука
                s.hasMiniNuke = false;
                s.nukeInFlight = true;
                s.bullets.push({ x: p.x + p.w / 2 - 4, y: p.y - 10, dy: -1.5, nuke: true });
                const nukeSfx = document.getElementById('inv-nuke-sfx');
                if (nukeSfx) { try { nukeSfx.currentTime = 0; nukeSfx.volume = 0.85; nukeSfx.play().catch(() => { }); } catch (e) { } }
            } else if (s.tripleShot > 0) {
                s.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y, dx: 0 });
                s.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y, dx: -2.4 });
                s.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y, dx: 2.4 });
            } else {
                s.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y });
            }
            s.shootCooldown = 28;
        }

        s.bullets = s.bullets.filter(b => {
            b.y += (b.dy !== undefined ? b.dy : -7);
            if (b.dx) b.x += b.dx;
            return b.y > -12 && b.y < s.H + 12 && b.x > -20 && b.x < s.W + 20;
        });

        if (s.tripleShot > 0) s.tripleShot--;
        if (s.rainbowTimer > 0) s.rainbowTimer--;

        if (s.mode === 'boss') { updateBoss(s); updateMinions(s); }
        else updateAliens(s);

        updateBombs(s);
        updateUFO(s);
        updateFruits(s);
        if (s.mode === 'boss') updateMiniNuke(s);
        checkCollisions(s);

        if (s.flashTimer > 0) s.flashTimer--;
    }

    function updateAliens(s) {
        s.alienMoveTimer++;
        if (s.alienMoveTimer >= s.alienMoveInterval) {
            s.alienMoveTimer = 0;
            const alive = s.aliens.filter(a => a.alive);
            if (alive.length === 0) {
                s.waveCount++;

                // ── HARDCORE: win after 10 waves, разкрива кода за Шефчето ──
                if (s.mode === 'hardcore' && s.waveCount >= 10) {
                    s.won = true;
                    if (!window.hardcoreCodeGiven) {
                        window.hardcoreCodeGiven = true;
                        const q = gameData.questions[currentQIndex];
                        if (q) {
                            const revealedCode = fromBase64(q.code);
                            saveUnlockedCode(q.id, revealedCode);
                        }
                    }
                    return;
                }

                s.aliens = spawnAliens(s.W, s.H);
                s.alienSpeed = Math.min(s.alienSpeed + 0.06, 1.0);
                s.alienBombInterval = Math.max(38, s.alienBombInterval - 5);
                const maxWaves = s.mode === 'hardcore' ? 10 : 3;
                const wave = Math.min(s.waveCount + 1, maxWaves);
                addPopup(s.W / 2, s.H / 2 - 30, `ВЪЛНА ${wave} / ${maxWaves}!`, 'rgb(57,255,20)', 16);

                // Fruits ONLY after wave clear in hardcore — normal mode only gets the rare shrimp
                if (s.mode === 'hardcore') {
                    spawnWaveFruits(s);
                    if (s.waveCount === 2) addPopup(s.W / 2, s.H / 2 + 14, 'КИВИ ОТКЛЮЧЕНО', 'rgb(68,204,68)', 12);
                    if (s.waveCount === 4) addPopup(s.W / 2, s.H / 2 + 14, 'АНАНАС + ЯГОДА', 'rgb(255,238,68)', 12);
                    if (s.waveCount === 6) addPopup(s.W / 2, s.H / 2 + 14, 'ДИНЯ ОТКЛЮЧЕНА!', 'rgb(68,255,102)', 13);
                } else if (s.mode === 'normal') {
                    maybeSpawnShrimp(s);
                    maybeSpawnBook(s);
                }
                return;
            }
            const minX = Math.min(...alive.map(a => a.x));
            const maxX = Math.max(...alive.map(a => a.x + 30));
            let drop = false;
            if (s.alienDir === 1 && maxX >= s.W - 4) { s.alienDir = -1; drop = true; }
            else if (s.alienDir === -1 && minX <= 4) { s.alienDir = 1; drop = true; }
            s.aliens.forEach(a => {
                if (!a.alive) return;
                if (drop) a.y += s.alienDropY;
                else a.x += s.alienDir * (s.alienSpeed * s.alienMoveInterval);
                a.frame++;
            });
            if (Math.max(...alive.map(a => a.y + 22)) >= s.player.y) {
                s.lives = 0; s.over = true;
            }
        }

        s.alienBombTimer++;
        if (s.alienBombTimer >= s.alienBombInterval) {
            s.alienBombTimer = 0;
            const cols = [...new Set(s.aliens.filter(a => a.alive).map(a => a.c))];
            if (cols.length > 0) {
                const rc = cols[Math.floor(Math.random() * cols.length)];
                const shooters = s.aliens.filter(a => a.alive && a.c === rc);
                if (shooters.length > 0) {
                    const sh = shooters.reduce((p, c) => c.r > p.r ? c : p);
                    s.bombs.push({ x: sh.x + 14, y: sh.y + 22, spread: false });
                }
            }
        }

        // Win — NORMAL mode only (3000 pts)
        if (s.mode === 'normal' && s.score >= WIN_SCORE && !s.over) {
            s.won = true;
            hardcoreEverUnlocked = true;
            const q = gameData.questions[currentQIndex];
            if (q) {
                const revealedCode = fromBase64(q.code);
                saveUnlockedCode(q.id, revealedCode);
            }
        }
    }

    // Връща слоя (играч/бос/платформи) в нормалната хоризонтална подредба
    // след като фаза 3 (вертикалната фаза) приключи.
    function resetAfterVerticalPhase(s) {
        const p = s.player;
        p.x = s.W / 2 - p.w / 2;
        p.y = s.H - 46;
        if (s.boss) { s.boss.y = 28; s.boss.vDir = 1; }
        s.shelters.forEach(sh => { sh.x = sh.origX; sh.y = sh.origY; });
        s.phase3 = null;
        setPhase3MobileControls(false, false);
    }

    // ══════════════════════════════════════════════════════════
    // ФАЗА 3 (ново): "кутия" в средата на арената, Undertale-стил —
    // ставаме бит, който се редува между 1 и 0, отбягваме атаки на
    // шефчето, а между отделните атаки се цели точност за щета.
    // ══════════════════════════════════════════════════════════
    const PHASE3_ATTACK_COUNT = 5;
    const PHASE4_HP_START = 3; // Фаза 4 е само толкова удара, преди шефчето да заспи

    function createPhase3Box(s) {
        const boxW = Math.min(230, s.W - 70);
        const boxH = Math.max(110, s.H - 210);
        return {
            x: Math.round(s.W / 2 - boxW / 2),
            y: Math.round(s.H - boxH - 46),
            w: boxW, h: boxH,
        };
    }

    function initPhase3(s) {
        s.phase3 = {
            box: createPhase3Box(s),
            stage: 'intro',
            attackIndex: 0,
            timer: 0,
            introDuration: 120,
            duration: 600,
            spawnTimer: 0,
            bullets: [],
            chaser: null,
            spiralAngle: 0,
            bitFrame: 0,
            wheel: null,
        };
        startPhase3Intro(s, s.phase3, 120, true);
    }

    // Кратко "затишие" преди стрелбите — играчът е спуснат в средата на кутията,
    // а шефчето се разтриса ядосано, преди да започне следващата поредица атаки.
    function startPhase3Intro(s, p3, duration, showAngryText) {
        p3.stage = 'intro';
        p3.timer = 0;
        p3.introDuration = duration;
        p3.spawnTimer = 0;
        p3.bullets = [];
        p3.wheel = null;
        const box = p3.box;
        s.player.x = box.x + box.w / 2 - s.player.w / 2;
        s.player.y = box.y + box.h / 2 - s.player.h / 2;
        setPhase3MobileControls(false, false);
        if (showAngryText && s.boss) {
            addPopup(s.boss.x + s.boss.w / 2, s.boss.y - 10, 'ШЕФЧЕТО СЕ ЯДОСВА...', 'rgb(255,68,68)', 14);
        }
    }

    function startPhase3Attack(s, p3) {
        p3.stage = 'attack';
        p3.timer = 0;
        p3.spawnTimer = 20;
        p3.bullets = [];
        p3.heals = [];
        p3.healTimer = 220 + Math.random() * 150;
        p3.wheel = null;
        const box = p3.box;
        s.player.x = box.x + box.w / 2 - s.player.w / 2;
        s.player.y = box.y + box.h / 2 - s.player.h / 2;
        p3.chaser = p3.attackIndex === 2 ? { x: box.x + 20, y: box.y + 20 } : null;
        setPhase3MobileControls(true, false);
    }

    function startPhase3Wheel(s, p3, boss) {
        p3.stage = 'wheel';
        p3.wheel = { pos: 0, dir: 1, speed: 0.022, locked: false, lockTimer: 0, dmg: 0, prevFire: false };
        setPhase3MobileControls(false, true);
    }

    // Показва/скрива мобилните ▲/▼ бутони (докато отбягваме) и преименува
    // копчето за стрелба на "УДАРИ", докато въртим индикатора за щета.
    function setPhase3MobileControls(showVertical, wheelMode) {
        const up = document.getElementById('inv-up-btn');
        const down = document.getElementById('inv-down-btn');
        const fire = document.getElementById('inv-fire-btn');
        if (up) up.style.display = showVertical ? 'inline-block' : 'none';
        if (down) down.style.display = showVertical ? 'inline-block' : 'none';
        if (fire) fire.textContent = wheelMode ? '💥 УДАРИ' : '▲ FIRE';
    }

    // ── Хилка: спавва се на случаен принцип от произволна посока в кутията,
    // максимум 2 едновременно, дава +1 живот при прибиране ──
    function spawnPhase3Heal(s, p3) {
        if (!p3.heals) p3.heals = [];
        if (p3.heals.length >= 2) return;
        const box = p3.box;
        const edge = Math.floor(Math.random() * 4);
        const speed = 0.85;
        const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        let x, y;
        if (edge === 0) { x = box.x + Math.random() * box.w; y = box.y; }
        else if (edge === 1) { x = box.x + box.w; y = box.y + Math.random() * box.h; }
        else if (edge === 2) { x = box.x + Math.random() * box.w; y = box.y + box.h; }
        else { x = box.x; y = box.y + Math.random() * box.h; }
        const ang = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.6;
        p3.heals.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 300 });
    }

    function updatePhase3Heals(s, p3) {
        if (!p3.heals) p3.heals = [];
        if (p3.healTimer === undefined) p3.healTimer = 260;
        p3.healTimer--;
        if (p3.healTimer <= 0) {
            if (p3.heals.length < 2) spawnPhase3Heal(s, p3);
            p3.healTimer = 320 + Math.random() * 220;
        }
        const box = p3.box, p = s.player;
        p3.heals = p3.heals.filter(h => {
            h.x += h.vx; h.y += h.vy; h.life--;
            if (rect(h.x - 7, h.y - 7, 14, 14, p.x, p.y, p.w, p.h)) {
                s.lives = Math.min(200, s.lives + 1);
                addPopup(p.x + p.w / 2, p.y - 14, '+1 ЖИВОТ', 'rgb(80,255,120)', 12);
                return false;
            }
            return h.life > 0 && h.x > box.x - 20 && h.x < box.x + box.w + 20 && h.y > box.y - 20 && h.y < box.y + box.h + 20;
        });
    }

    function updatePhase3(s, boss) {
        const p3 = s.phase3;
        if (!p3) return;
        p3.bitFrame++;

        if (p3.stage === 'intro') {
            p3.timer++;
            if (p3.timer >= p3.introDuration) startPhase3Attack(s, p3);
        } else if (p3.stage === 'attack') {
            p3.timer++;
            if (p3.attackIndex === 0) runPhase3AttackConverge(s, p3);
            else if (p3.attackIndex === 1) runPhase3AttackRows(s, p3);
            else if (p3.attackIndex === 2) runPhase3AttackChase(s, p3);
            else if (p3.attackIndex === 3) runPhase3AttackVolley(s, p3);
            else runPhase3AttackSpiral(s, p3);

            updatePhase3Heals(s, p3);
            checkPhase3Hits(s, p3);

            if (boss.hp <= 0) return;
            if (p3.timer >= p3.duration) startPhase3Wheel(s, p3, boss);
        } else if (p3.stage === 'wheel') {
            updatePhase3Wheel(s, p3, boss);
        }
    }

    function checkPhase3Hits(s, p3) {
        const p = s.player;
        if (s.playerInvincible > 0) { s.playerInvincible--; return; }

        for (let i = p3.bullets.length - 1; i >= 0; i--) {
            const b = p3.bullets[i];
            const r = b.r || 3;
            if (rect(b.x - r, b.y - r, r * 2, r * 2, p.x, p.y, p.w, p.h)) {
                p3.bullets.splice(i, 1);
                phase3PlayerHit(s, p);
                return;
            }
        }
        if (p3.chaser) {
            const ch = p3.chaser;
            if (rect(ch.x - 7, ch.y - 7, 14, 14, p.x, p.y, p.w, p.h)) {
                phase3PlayerHit(s, p);
                ch.x = p3.box.x + p3.box.w - 22; ch.y = p3.box.y + 18;
            }
        }
    }

    function phase3PlayerHit(s, p) {
        s.lives--; s.flashTimer = 20; s.playerInvincible = 75;
        addPopup(p.x + p.w / 2, p.y - 12, '-1 ЖИВОТ', 'rgb(255,68,68)', 12);
        if (s.lives <= 0) s.over = true;
    }

    // ── Атака 1: снаряди се стичат навътре от ръбовете на кутията ──
    function runPhase3AttackConverge(s, p3) {
        p3.spawnTimer--;
        if (p3.spawnTimer <= 0) {
            p3.spawnTimer = 38;
            const box = p3.box;
            const edge = Math.floor(Math.random() * 4);
            const speed = 1.05;
            const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
            let x, y;
            if (edge === 0) { x = box.x + Math.random() * box.w; y = box.y; }
            else if (edge === 1) { x = box.x + box.w; y = box.y + Math.random() * box.h; }
            else if (edge === 2) { x = box.x + Math.random() * box.w; y = box.y + box.h; }
            else { x = box.x; y = box.y + Math.random() * box.h; }
            const ang = Math.atan2(cy - y, cx - x) + (Math.random() - 0.5) * 0.5;
            p3.bullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 3 });
        }
        const box = p3.box;
        p3.bullets = p3.bullets.filter(b => {
            b.x += b.vx; b.y += b.vy;
            return b.x > box.x - 16 && b.x < box.x + box.w + 16 && b.y > box.y - 16 && b.y < box.y + box.h + 16;
        });
    }

    // ── Атака 2: редици снаряди преминават хоризонтално, с една свободна редица ──
    function runPhase3AttackRows(s, p3) {
        p3.spawnTimer--;
        if (p3.spawnTimer <= 0) {
            p3.spawnTimer = 78;
            const box = p3.box;
            const rows = 4;
            const rowH = box.h / rows;
            const safeRow = Math.floor(Math.random() * rows);
            const fromLeft = Math.random() < 0.5;
            // По-труден вариант: редиците леко се клатят нагоре/надолу, докато летят,
            // за да не може да се стои неподвижно на едно "безопасно" ниво
            const hard = Math.random() < 0.5;
            const wobbleAmp = hard ? rowH * 0.4 : 0;
            for (let r = 0; r < rows; r++) {
                if (r === safeRow) continue;
                const baseY = box.y + rowH * r + rowH / 2;
                p3.bullets.push({
                    x: fromLeft ? box.x - 12 : box.x + box.w + 12, y: baseY, baseY,
                    vx: fromLeft ? 1.2 : -1.2, vy: 0, r: 3,
                    wobbleAmp, wobbleFreq: 0.045 + Math.random() * 0.02, wobblePhase: Math.random() * Math.PI * 2,
                });
            }
        }
        const box = p3.box;
        p3.bullets = p3.bullets.filter(b => {
            b.x += b.vx;
            if (b.wobbleAmp) {
                b.wobblePhase += b.wobbleFreq;
                b.y = b.baseY + Math.sin(b.wobblePhase) * b.wobbleAmp;
            }
            return b.x > box.x - 20 && b.x < box.x + box.w + 20;
        });
    }

    // ── Атака 3: бягане — бавен преследвач + разпръснати снарядчета ──
    function runPhase3AttackChase(s, p3) {
        const box = p3.box, p = s.player;
        if (!p3.chaser) p3.chaser = { x: box.x + 20, y: box.y + 20 };
        const ch = p3.chaser;
        const dx = (p.x + p.w / 2) - ch.x, dy = (p.y + p.h / 2) - ch.y;
        const d = Math.hypot(dx, dy) || 1;
        ch.x += dx / d * 0.62; ch.y += dy / d * 0.62;

        p3.spawnTimer--;
        if (p3.spawnTimer <= 0) {
            p3.spawnTimer = 30;
            const ang = Math.random() * Math.PI * 2;
            p3.bullets.push({ x: ch.x, y: ch.y, vx: Math.cos(ang) * 1.0, vy: Math.sin(ang) * 1.0, r: 2.5 });
        }
        p3.bullets = p3.bullets.filter(b => {
            b.x += b.vx; b.y += b.vy;
            return b.x > box.x - 14 && b.x < box.x + box.w + 14 && b.y > box.y - 14 && b.y < box.y + box.h + 14;
        });
    }

    // ── Атака 4 (заимствана от фаза 2): стена от снаряди отгоре с процеп за преминаване ──
    function runPhase3AttackVolley(s, p3) {
        p3.spawnTimer--;
        if (p3.spawnTimer <= 0) {
            p3.spawnTimer = 100;
            const box = p3.box;
            const cols = 6;
            const gapWidth = 2;
            const gapStart = Math.floor(Math.random() * (cols - gapWidth));
            const slotW = box.w / cols;
            // По-труден вариант: цялата стена (и процепът в нея) се клати наляво/надясно,
            // докато пада — за да не може просто да се застане неподвижно под процепа
            const hard = Math.random() < 0.5;
            const wobbleAmp = hard ? slotW * 0.55 : 0;
            const wobbleFreq = 0.05 + Math.random() * 0.02;
            const wobblePhase0 = Math.random() * Math.PI * 2;
            for (let i = 0; i < cols; i++) {
                if (i >= gapStart && i < gapStart + gapWidth) continue;
                const baseX = box.x + slotW * i + slotW / 2;
                p3.bullets.push({
                    x: baseX, baseX, y: box.y - 10, vx: 0, vy: 1.0, r: 3,
                    wobbleAmp, wobbleFreq, wobblePhase: wobblePhase0,
                });
            }
        }
        const box = p3.box;
        p3.bullets = p3.bullets.filter(b => {
            if (b.wobbleAmp) {
                b.wobblePhase += b.wobbleFreq;
                b.x = b.baseX + Math.sin(b.wobblePhase) * b.wobbleAmp;
            }
            b.y += b.vy;
            return b.y < box.y + box.h + 16;
        });
    }

    // ── Атака 5 (заимствана от фаза 4): спираловиден откос от горния край на кутията ──
    // ── Атака 5 (заимствана от фаза 4): шефчето обикаля около кутията и стреля спираловидно навътре ──
    function runPhase3AttackSpiral(s, p3) {
        p3.spiralAngle = (p3.spiralAngle || 0) + 0.045;
        p3.spawnTimer--;
        if (p3.spawnTimer <= 0) {
            p3.spawnTimer = 46;
            const box = p3.box;
            const boss = s.boss;
            const cx = boss ? boss.x + boss.w / 2 : box.x + box.w / 2;
            const cy = boss ? boss.y + boss.h - 6 : box.y + 12;
            const targetX = box.x + box.w / 2, targetY = box.y + box.h / 2;
            const baseAng = Math.atan2(targetY - cy, targetX - cx);
            const count = 5;
            for (let i = 0; i < count; i++) {
                const spread = (i - (count - 1) / 2) * 0.32;
                const shotAng = baseAng + spread + Math.sin(p3.spiralAngle) * 0.5;
                p3.bullets.push({ x: cx, y: cy, vx: Math.cos(shotAng) * 0.95, vy: Math.sin(shotAng) * 0.95, r: 2.5 });
            }
        }
        const box = p3.box;
        p3.bullets = p3.bullets.filter(b => {
            b.x += b.vx; b.y += b.vy;
            return b.x > box.x - 50 && b.x < box.x + box.w + 50 && b.y > box.y - 50 && b.y < box.y + box.h + 50;
        });
    }

    // ── Между атаките: индикатор за точност — колкото по-близо до центъра, толкова повече щета ──
    function updatePhase3Wheel(s, p3, boss) {
        const w = p3.wheel;
        if (!w.locked) {
            w.pos += w.dir * w.speed;
            if (w.pos >= 1) { w.pos = 1; w.dir = -1; }
            if (w.pos <= -1) { w.pos = -1; w.dir = 1; }
            const wantFire = s.keys[' '] || s.keys['Spacebar'] || s.mobileFire;
            const edge = wantFire && !w.prevFire;
            w.prevFire = wantFire;
            if (edge) {
                w.locked = true;
                w.lockTimer = 55;
                const dist = Math.abs(w.pos);
                const dmg = dist < 0.12 ? 22 : dist < 0.35 ? 14 : dist < 0.65 ? 8 : 3;
                w.dmg = dmg;
                boss.hp = Math.max(PHASE4_HP_START, boss.hp - dmg);
                addPopup(s.W / 2, p3.box.y - 12, `-${dmg} ЩЕТА!`, dmg >= 22 ? 'rgb(255,238,68)' : 'rgb(255,136,0)', 16);
            }
        } else {
            w.lockTimer--;
            if (w.lockTimer <= 0 && boss.hp > 0) {
                p3.attackIndex = (p3.attackIndex + 1) % PHASE3_ATTACK_COUNT;
                startPhase3Intro(s, p3, 55, false);
            }
        }
    }

    function drawPhase3(s) {
        const p3 = s.phase3;
        if (!p3) return;
        const box = p3.box;

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.shadowBlur = 6; ctx.shadowColor = '#ffffff';
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.shadowBlur = 0;

        p3.bullets.forEach(b => {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 5; ctx.shadowColor = '#ffffff';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r || 3, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        });

        if (p3.stage === 'attack' && p3.chaser) {
            ctx.fillStyle = '#ff66ff';
            ctx.shadowBlur = 8; ctx.shadowColor = '#ff66ff';
            ctx.beginPath(); ctx.arc(p3.chaser.x, p3.chaser.y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        if (p3.heals) p3.heals.forEach(h => {
            const pulse = 1 + Math.sin(Date.now() / 130) * 0.15;
            ctx.fillStyle = 'rgb(80,255,120)';
            ctx.shadowBlur = 9; ctx.shadowColor = 'rgb(80,255,120)';
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.scale(pulse, pulse);
            ctx.fillRect(-6, -1.5, 12, 3);
            ctx.fillRect(-1.5, -6, 3, 12);
            ctx.restore();
            ctx.shadowBlur = 0;
        });

        if (p3.stage === 'wheel') {
            drawPhase3Wheel(s, p3);
        } else {
            const p = s.player;
            const bitChar = Math.floor(p3.bitFrame / 16) % 2 === 0 ? '1' : '0';
            ctx.fillStyle = RED;
            ctx.shadowBlur = 8; ctx.shadowColor = RED;
            ctx.font = 'bold 16px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bitChar, p.x + p.w / 2, p.y + p.h);
            ctx.shadowBlur = 0; ctx.textAlign = 'left';
        }

        ctx.fillStyle = DIM; ctx.font = '11px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        const caption = p3.stage === 'intro' ? 'ПРИГОТВИ СЕ...' : '◀▲▼▶ ОТБЯГВАЙ';
        ctx.fillText(caption, box.x + box.w / 2, box.y - 8);
        ctx.textAlign = 'left';
    }

    function drawPhase3Wheel(s, p3) {
        const w = p3.wheel;
        const box = p3.box;
        const barY = box.y + box.h / 2;
        const barX = box.x + 14, barW = box.w - 28, barH = 22;
        const zones = [
            { frac: 1.0, color: '#ff4444' },
            { frac: 0.65, color: '#ffee44' },
            { frac: 0.35, color: '#88ff44' },
            { frac: 0.12, color: '#39FF14' },
        ];
        zones.forEach(z => {
            const zw = barW * z.frac;
            ctx.fillStyle = z.color;
            ctx.fillRect(barX + barW / 2 - zw / 2, barY - barH / 2, zw, barH);
        });
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY - barH / 2, barW, barH);

        const needleX = barX + barW / 2 + w.pos * (barW / 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 6; ctx.shadowColor = '#ffffff';
        ctx.fillRect(needleX - 1.5, barY - barH / 2 - 6, 3, barH + 12);
        ctx.shadowBlur = 0;

        ctx.fillStyle = GREEN; ctx.font = 'bold 12px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(w.locked ? `ЩЕТА: ${w.dmg}` : 'НАТИСНИ ▲ / FIRE!', box.x + box.w / 2, barY + barH + 16);
        ctx.textAlign = 'left';
    }

    function updateBoss(s) {
        const boss = s.boss;
        if (!boss) return;

        // ── Победа: ако вече чакаме анимацията на mini nuke взрива, изчакваме я тук ──
        if (boss.exploding) {
            if (s.explodeTimer > 0) { s.explodeTimer--; return; }
            if (!s.won) {
                s.won = true;
                if (!s.codeGiven) {
                    s.codeGiven = true;
                    const q = gameData.questions[currentQIndex];
                    if (q) {
                        const revealedCode = fromBase64(q.code);
                        saveUnlockedCode(q.id, revealedCode);
                    }
                }
            }
            return;
        }

        // ── Шефчето стигна точно 0 живот във Фаза 4 — вместо да умира веднага,
        // заспива по средата и пуска mini nuke-а, с който да го довършим ──
        if (boss.phase === 4 && boss.hp <= 0 && !boss.asleep) {
            boss.hp = 0;
            boss.asleep = true;
            boss.isDashing = false;
            boss.telegraphType = null;
            boss.x = s.W / 2 - boss.w / 2;
            boss.y = 36;
            s.minions = [];
            addPopup(s.W / 2, s.H / 2 - 20, '★ ШЕФЧЕТО ЗАСПА! ★', 'rgb(255,0,255)', 20);
            if (!s.miniNuke && !s.hasMiniNuke) {
                s.miniNuke = {
                    x: Math.max(30, Math.min(s.W - 30, s.player.x + s.player.w / 2)),
                    y: 30, speed: 1.3,
                };
            }
            return;
        }

        if (boss.hp <= 0) return; // предпазна мярка — вече заспал, чакаме nuke-а

        const vertPhase = boss.phase === 3;

        // ── Плячка на всеки ~25 HP загубени: всичко може да падне, звездата е рядка ──
        const threshold = boss.cherryDroppedAt.find(t => boss.hp <= t && t < boss.lastCherryHp);
        if (threshold !== undefined) {
            boss.lastCherryHp = threshold;
            for (let i = 0; i < 2; i++) {
                const idx = pickBossLootIndex();
                s.cherries.push({
                    x: boss.x + 20 + Math.random() * (boss.w - 40),
                    y: boss.y + boss.h + 5,
                    speed: 1.3 + Math.random() * 0.5,
                    fruitIdx: idx,
                    def: FRUITS[idx],
                });
            }
            addPopup(boss.x + boss.w / 2, boss.y + boss.h + 20, '♥ ПЛЯЧКА!', 'rgb(255,100,150)', 13);
        }

        // ── Phase transitions: 2 при 75%, 3 при 50% (сега поглъща по-голямата част
        // от старата фаза 4), а фаза 4 стартира едва на PHASE4_HP_START живот —
        // само толкова удара остават, преди шефчето да заспи ──
        const pct = boss.hp / boss.maxHp;
        if (boss.hp <= PHASE4_HP_START && boss.phase < 4) {
            const leavingVertical = boss.phase === 3;
            boss.hp = PHASE4_HP_START; // гарантираме точно фиксиран брой удари, дори wheel-ът да е презадал щета
            boss.phase = 4; boss.speed = 2.4; boss.attackInterval = 60;
            if (leavingVertical) resetAfterVerticalPhase(s);
            addPopup(s.W / 2, s.H / 2 - 10, '★ ФАЗА 4! ★', 'rgb(255,0,255)', 22);
        } else if (pct <= 0.50 && boss.phase < 3) {
            boss.phase = 3; boss.speed = 1.7; boss.attackInterval = 75;
            initPhase3(s);
            addPopup(s.W / 2, s.H / 2, 'ФАЗА 3!', 'rgb(255,136,0)', 20);
        } else if (pct <= 0.75 && boss.phase < 2) {
            boss.phase = 2; boss.speed = 1.1; boss.attackInterval = 90;
            addPopup(s.W / 2, s.H / 2, 'ФАЗА 2!', 'rgb(255,68,68)', 20);
        }

        if (vertPhase) {
            // ── Фаза 3 (ново): шефчето стои по средата над кутията; докато се "ядосва"
            // (intro стадий) се разтриса по-силно, при атаката с спиралата обикаля около
            // кутията, иначе леко се поклаща ──
            const p3 = s.phase3;
            const angry = p3 && p3.stage === 'intro';
            const orbiting = p3 && p3.stage === 'attack' && p3.attackIndex === 4;
            if (orbiting) {
                const box = p3.box;
                const ang = p3.spiralAngle || 0;
                const rx = Math.min(box.w / 2 + 55, s.W / 2 - boss.w * 0.3);
                const topLimit = 14, botLimit = Math.max(topLimit, box.y - boss.h - 10);
                boss.x = (box.x + box.w / 2) + Math.cos(ang * 2.2) * rx - boss.w / 2;
                boss.y = topLimit + (Math.sin(ang * 2.2) * 0.5 + 0.5) * (botLimit - topLimit);
                boss.x = Math.max(-boss.w * 0.3, Math.min(s.W - boss.w * 0.7, boss.x));
            } else {
                boss.x = s.W / 2 - boss.w / 2 + (angry ? Math.sin(Date.now() / 45) * 5 : 0);
                boss.y = 22 + (angry ? Math.abs(Math.sin(Date.now() / 70)) * 6 : Math.sin(Date.now() / 500) * 4);
            }
            updatePhase3(s, boss);
        } else if (!boss.asleep) {
            // ── Фаза 4+: платформите се движат странично за динамично прикритие ──
            if (boss.phase >= 3) {
                s.shelters.forEach((sh, i) => {
                    const drift = Math.sin(Date.now() / 900 + i * 1.7) * 34;
                    sh.x = Math.max(6, Math.min(s.W - 42, sh.origX + drift));
                });
            }

            // ── Движение (спира по време на dash, който се управлява от scheduler-а) ──
            if (boss.isDashing) {
                boss.x += boss.dashDir * 6;
                boss.dashFrames--;
                if (boss.dashFrames <= 0 || boss.x <= 0 || boss.x + boss.w >= s.W) {
                    boss.isDashing = false;
                    boss.dir = boss.dashDir * -1;
                    boss.x = Math.max(0, Math.min(s.W - boss.w, boss.x));
                }
            } else {
                boss.x += boss.dir * boss.speed;
                if (boss.x <= 0) { boss.x = 0; boss.dir = 1; }
                if (boss.x + boss.w >= s.W) { boss.x = s.W - boss.w; boss.dir = -1; }
            }
        }

        // ── Фаза 4: боса спаунва миниони, които да подпомагат атаката му (не и докато спи; не и в кутията на фаза 3) ──
        if (boss.phase >= 4 && !boss.asleep) {
            boss.minionTimer--;
            if (boss.minionTimer <= 0 && s.minions.filter(m => m.alive).length < 2) {
                boss.minionTimer = 420;
                const fromLeft = Math.random() < 0.5;
                s.minions.push({
                    x: fromLeft ? -20 : s.W + 20, y: 60 + Math.random() * 40,
                    vx: fromLeft ? 1.4 : -1.4, alive: true, hp: 1,
                    shootTimer: 60 + Math.random() * 60, frame: 0,
                });
            }
        }

        // ── Базова единична атака (леко филър, спира докато шефчето спи; не и в кутията на фаза 3 — там атаките са отделни) ──
        if (!boss.asleep && !vertPhase) {
            boss.attackTimer++;
            if (boss.attackTimer >= boss.attackInterval) {
                boss.attackTimer = 0;
                s.bombs.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h, spread: false });
            }
        }

        // ── Планировчик за специални атаки: САМО ЕДНА активна наведнъж (пауза по време на фаза 3 и докато спи) ──
        if (boss.phase >= 2 && !vertPhase && !boss.asleep) {
            if (boss.telegraphType) {
                boss.telegraphTimer--;
                if (boss.telegraphTimer <= 0) {
                    executeSpecialAttack(s, boss, boss.telegraphType);
                    boss.telegraphType = null;
                    boss.specialCooldown = boss.phase >= 4 ? 85 : boss.phase >= 3 ? 110 : 140;
                }
            } else if (boss.specialCooldown > 0) {
                boss.specialCooldown--;
            } else {
                const pool = boss.phase >= 4 ? ['volley', 'dash', 'spiral'] : ['volley'];
                const choice = pool[Math.floor(Math.random() * pool.length)];
                boss.telegraphType = choice;
                boss.telegraphTimer = choice === 'dash' ? 26 : choice === 'spiral' ? 32 : 46;
                const warnText = { dash: 'ВНИМАНИЕ: ДЕШ!', spiral: '★ ВНИМАНИЕ: СПИРАЛА! ★' }[choice];
                if (warnText) addPopup(boss.x + boss.w / 2, boss.y + boss.h + 8, warnText, 'rgb(255,255,255)', 12);
            }
        }
    }

    // ── Изпълнение на специалните атаки (телеграфирани, само по една) ──
    function executeSpecialAttack(s, boss, type) {
        if (type === 'volley') {
            const count = boss.phase >= 4 ? 8 : boss.phase >= 3 ? 7 : 6;
            const gapWidth = 2; // брой позиции, оставени свободни за минаване
            const gapStart = Math.floor(Math.random() * (count - gapWidth));
            const slot = s.W / (count + 1);
            for (let i = 0; i < count; i++) {
                if (i >= gapStart && i < gapStart + gapWidth) continue; // проходим процеп
                s.bombs.push({ x: slot * (i + 1), y: 34, spread: true, dy: 3.4 });
            }
        } else if (type === 'dash') {
            boss.isDashing = true;
            boss.dashDir = boss.dir;
            boss.dashFrames = boss.phase >= 4 ? 32 : 26;
        } else if (type === 'spiral') {
            const count = 6;
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI / (count - 1)) * i - Math.PI / 2 + 0.15;
                s.bombs.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h, spread: true, dx: Math.cos(angle) * 2.3, dy: Math.sin(angle) * 2.3 + 1.2 });
            }
            addPopup(boss.x + boss.w / 2, boss.y - 8, '★ СПИРАЛА! ★', 'rgb(255,0,255)', 13);
        }
    }

    function updateMinions(s) {
        if (!s.minions.length) return;
        s.minions.forEach(m => {
            if (!m.alive) return;
            m.x += m.vx;
            m.frame = Math.floor(Date.now() / 200) % 2;
            m.shootTimer--;
            if (m.shootTimer <= 0) {
                m.shootTimer = 90 + Math.random() * 70;
                s.bombs.push({ x: m.x + 11, y: m.y + 18, spread: false, dy: 3 });
            }
            if (m.x < -40 || m.x > s.W + 40) m.alive = false;
        });
        s.minions = s.minions.filter(m => m.alive);
    }

    function updateBombs(s) {
        s.bombs = s.bombs.filter(b => {
            b.y += (b.dy !== undefined ? b.dy : 4);
            if (b.dx) b.x += b.dx;
            return b.y < s.H && b.y > -20 && b.x > -20 && b.x < s.W + 20;
        });
    }

    function updateUFO(s) {
        s.ufoTimer++;
        if (!s.ufoActive && s.ufoTimer >= s.ufoInterval) {
            s.ufoActive = true; s.ufoTimer = 0;
            s.ufoDir = Math.random() > 0.5 ? 1 : -1;
            s.ufoX = s.ufoDir === 1 ? -40 : s.W + 4; s.ufoY = 30;
        }
        if (s.ufoActive) {
            s.ufoX += s.ufoDir * s.ufoSpeedPx;
            if (s.ufoX > s.W + 50 || s.ufoX < -50) s.ufoActive = false;
        }
    }

    // ── FRUIT SYSTEM (Hardcore 10 waves) ──────────────────────
    // fruit types: cherry, pineapple, kiwi, strawberry, watermelon
    // each wave unlocks more fruit types and they fall less often
    const FRUITS = [
        { type: 'cherry', color: '#cc2244', glow: '#ff4488', pts: 0, life: 1, label: '+1 ЖИВОТ ♥' },
        { type: 'pineapple', color: '#ddaa00', glow: '#ffdd44', pts: 30, life: 0, label: '+30' },
        { type: 'kiwi', color: '#228833', glow: '#44cc44', pts: 20, life: 0, label: '+20' },
        { type: 'strawberry', color: '#dd2222', glow: '#ff6666', pts: 25, life: 0, label: '+25' },
        { type: 'watermelon', color: '#118833', glow: '#44ff66', pts: 0, life: 2, label: '+2 ЖИВОТИ ♥♥', rare: true },
        { type: 'cap', color: '#cccccc', glow: '#ffffff', pts: 15, life: 0, label: '+15' },
        { type: 'nuka', color: '#1155cc', glow: '#55aaff', pts: 40, life: 0, label: '+40' },
        { type: 'apple', color: '#dd3333', glow: '#ff7777', pts: 10, life: 0, label: '+10' },
        { type: 'orange', color: '#ff8800', glow: '#ffbb55', pts: 5, life: 0, label: '+5' },
        { type: 'star', color: '#ff2266', glow: '#ffffff', pts: 0, life: 0, label: '★ ДЪГА! ★', rare: true, power: 'rainbow' },
        { type: 'shrimp', color: '#ff9977', glow: '#ffe3cc', pts: 100, life: 0, label: '🍤 СКАРИДА!', rare: true },
        { type: 'book', color: '#8855ff', glow: '#cc99ff', pts: 50, life: 0, label: '📖 КНИГА ЗА ИНТЕЛИГЕНТНОСТ!', rare: true, power: 'intelligence' },
    ];
    const SHRIMP_IDX = 10;
    const BOOK_IDX = 11;

    // Which fruits are available per wave (1-indexed)
    function getFruitPoolForWave(wave) {
        if (wave <= 2) return [0, 5, 7, 8];                    // cherries + bottle caps + apple + orange
        if (wave <= 4) return [0, 2, 5, 7, 8];                 // + kiwi
        if (wave <= 6) return [0, 1, 2, 3, 5, 7, 8];           // + pineapple + strawberry
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];                  // all, including rare watermелон + Nuka-Cola + ЗВЕЗДА
    }

    // Избира случаен тип плячка за шефчето — всичко може да падне,
    // но дъговата звезда (и динята) остават рядкост, а скаридата е почти невъзможна.
    function pickBossLootIndex() {
        const pool = getFruitPoolForWave(10); // всички възможни видове
        if (!hasIntelligenceBook() && Math.random() < 0.01) return BOOK_IDX; // книга — 1%, само докато не е намерена
        if (Math.random() < 0.01) return SHRIMP_IDX; // скарида — 1%, важи и в трите режима
        const roll = Math.random();
        if (roll < 0.06) return 9;               // дъгова звезда — най-рядка
        if (roll < 0.06 + 0.14) return 4;        // диня — рядка
        const common = pool.filter(x => x !== 4 && x !== 9);
        return common[Math.floor(Math.random() * common.length)];
    }

    // Нормалният режим няма собствена система за дропове — само скаридата
    // може да падне там, с 1% шанс след всяка изчистена вълна.
    function maybeSpawnShrimp(s) {
        if (Math.random() >= 0.01) return;
        s.cherries.push({
            x: 20 + Math.random() * (s.W - 40),
            y: -20,
            speed: 1.4,
            fruitIdx: SHRIMP_IDX,
            def: FRUITS[SHRIMP_IDX],
        });
    }

    // Книгата за интелигентност — същият рядък шанс (1%) като скаридата,
    // но спира да пада веднъж вече намерена.
    function maybeSpawnBook(s) {
        if (hasIntelligenceBook()) return;
        if (Math.random() >= 0.01) return;
        s.cherries.push({
            x: 20 + Math.random() * (s.W - 40),
            y: -20,
            speed: 1.4,
            fruitIdx: BOOK_IDX,
            def: FRUITS[BOOK_IDX],
        });
    }

    // Spawn a batch of fruits right after a wave is cleared
    function spawnWaveFruits(s) {
        const wave = Math.min(s.waveCount, 10);
        const pool = getFruitPoolForWave(wave);
        // Spawn 2-4 fruits depending on wave
        const count = 2 + Math.min(Math.floor(wave / 3), 2);
        for (let i = 0; i < count; i++) {
            let idx;
            if (!hasIntelligenceBook() && Math.random() < 0.01) {
                idx = BOOK_IDX; // книга — 1%, само докато не е намерена
            } else if (Math.random() < 0.01) {
                idx = SHRIMP_IDX; // скарида — 1%, важи и в трите режима
            } else {
                const rareRoll = Math.random();
                if (pool.includes(9) && rareRoll < 0.09) {
                    idx = 9; // дъгова звезда — най-рядка
                } else if (pool.includes(4) && rareRoll < 0.09 + 0.18) {
                    idx = 4; // диня
                } else {
                    const nonRare = pool.filter(x => x !== 4 && x !== 9);
                    idx = nonRare[Math.floor(Math.random() * nonRare.length)];
                }
            }
            const def = FRUITS[idx];
            // Stagger their fall starts
            s.cherries.push({
                x: 20 + Math.random() * (s.W - 40),
                y: 28 + i * 18,
                speed: 1.0 + Math.random() * 0.7,
                fruitIdx: idx,
                def,
            });
        }
    }

    function updateFruits(s) {
        // Only move existing fruits — no continuous spawning, only after wave
        s.cherries = s.cherries.filter(c => { c.y += c.speed; return c.y < s.H + 24; });
    }

    // Mini nuke-ът пада бавно и заляга близо до реда на играча, чакайки да бъде взет
    // Mini nuke-ът пада бавно и заляга точно на нивото на играча, чакайки да бъде взет
    function updateMiniNuke(s) {
        if (!s.miniNuke) return;
        const restY = s.player.y - 4;
        if (s.miniNuke.y < restY) s.miniNuke.y += s.miniNuke.speed;
        else s.miniNuke.y = restY;
    }

    // Извиква се, когато nuke-изстрелът удари заспалото шефче — финален взрив
    function triggerBossExplosion(s) {
        if (!s.boss) return;
        s.boss.hp = 0;
        s.boss.exploding = true;
        s.explodeTimer = 70;
        s.explodeX = s.boss.x + s.boss.w / 2;
        s.explodeY = s.boss.y + s.boss.h / 2;
        s.score += 500;
        s.flashTimer = 20;
        unlockAchievement('nuke_finisher');
    }

    function drawFruit(c) {
        const def = c.def || FRUITS[0];
        const t = c.fruitIdx || 0;
        const x = c.x, y = c.y;
        ctx.shadowBlur = 8; ctx.shadowColor = def.glow;

        if (t === 0) { // cherry
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + 9, y + 1, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#228833'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + 4, y - 16, x + 9, y - 7); ctx.stroke();
        } else if (t === 1) { // pineapple
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.ellipse(x, y, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#228833';
            ctx.fillRect(x - 3, y - 12, 2, 7);
            ctx.fillRect(x, y - 14, 2, 8);
            ctx.fillRect(x + 2, y - 12, 2, 7);
        } else if (t === 2) { // kiwi
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffcc';
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        } else if (t === 3) { // strawberry
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.moveTo(x, y + 8);
            ctx.quadraticCurveTo(x - 8, y, x - 5, y - 6);
            ctx.quadraticCurveTo(x, y - 10, x + 5, y - 6);
            ctx.quadraticCurveTo(x + 8, y, x, y + 8);
            ctx.fill();
            ctx.fillStyle = '#ffcccc';
            for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 3 - 0.5, y - 2, 1.5, 1.5);
        } else if (t === 4) { // watermelon
            ctx.fillStyle = '#118833';
            ctx.beginPath(); ctx.ellipse(x, y, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff4455';
            ctx.beginPath(); ctx.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 4 - 1, y, 2, 3);
        } else if (t === 5) { // капачка (bottle cap) — малко "топче" с назъбен ръб
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const ang = (Math.PI / 4) * i;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(ang) * 5, y + Math.sin(ang) * 5);
                ctx.lineTo(x + Math.cos(ang) * 7, y + Math.sin(ang) * 7);
                ctx.stroke();
            }
            ctx.fillStyle = '#666';
            ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (t === 6) { // Nuka-Cola бутилка
            ctx.fillStyle = def.color;
            ctx.fillRect(x - 4, y - 2, 8, 11);
            ctx.beginPath(); ctx.moveTo(x - 4, y - 2); ctx.lineTo(x - 2, y - 9);
            ctx.lineTo(x + 2, y - 9); ctx.lineTo(x + 4, y - 2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 2, y - 8, 4, 2);
            ctx.fillStyle = '#88ccff';
            ctx.fillRect(x - 3, y + 1, 6, 3);
        } else if (t === 7) { // ябълка
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath(); ctx.ellipse(x - 2, y - 2, 2, 3, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#663311'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 1, y - 12); ctx.stroke();
            ctx.fillStyle = '#339933';
            ctx.beginPath(); ctx.ellipse(x + 3, y - 10, 3, 1.6, 0.6, 0, Math.PI * 2); ctx.fill();
        } else if (t === 8) { // портокал
            ctx.fillStyle = def.color;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#cc6600'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.stroke();
            ctx.fillStyle = '#339933';
            ctx.fillRect(x - 1, y - 9, 2, 3);
        } else if (t === 9) { // дъгова звезда (power-up)
            const hue = (Date.now() / 6) % 360;
            ctx.save();
            ctx.translate(x, y);
            ctx.shadowBlur = 14; ctx.shadowColor = `hsl(${hue},100%,60%)`;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const outerAng = -Math.PI / 2 + i * (Math.PI * 2 / 5);
                const innerAng = outerAng + Math.PI / 5;
                const ox = Math.cos(outerAng) * 10, oy = Math.sin(outerAng) * 10;
                const ix = Math.cos(innerAng) * 4.2, iy = Math.sin(innerAng) * 4.2;
                if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            const grad = ctx.createLinearGradient(-10, -10, 10, 10);
            for (let g = 0; g <= 6; g++) grad.addColorStop(g / 6, `hsl(${(hue + g * 60) % 360},100%,60%)`);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        } else if (t === 10) { // скарида — супер рядка (1%), падa и в трите режима
            ctx.save();
            ctx.translate(x, y);
            ctx.shadowBlur = 12; ctx.shadowColor = def.glow;
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.moveTo(-8, 2);
            ctx.quadraticCurveTo(-6, -8, 2, -7);
            ctx.quadraticCurveTo(9, -6, 8, 1);
            ctx.quadraticCurveTo(6, 6, -2, 6);
            ctx.quadraticCurveTo(-7, 6, -8, 2);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffccaa';
            ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(13, -3); ctx.lineTo(13, 5); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.arc(-5, -3, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = def.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-14, -7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(-15, -2); ctx.stroke();
            ctx.restore();
        } else if (t === 11) { // книга за интелигентност — рядка (1%), отключва хакването на шефчето
            ctx.save();
            ctx.translate(x, y);
            ctx.shadowBlur = 12; ctx.shadowColor = def.glow;
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.moveTo(-8, -6); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#aa77ff';
            ctx.beginPath();
            ctx.moveTo(8, -6); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath(); ctx.moveTo(1.5, i * 3); ctx.lineTo(6.5, i * 3 - 1); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-1.5, i * 3); ctx.lineTo(-6.5, i * 3 - 1); ctx.stroke();
            }
            ctx.restore();
        }
        ctx.shadowBlur = 0;
    }

    function checkCollisions(s) {
        const p = s.player;

        for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
            const b = s.bullets[bi];
            let hit = false;

            // vs aliens
            for (let ai = s.aliens.length - 1; ai >= 0; ai--) {
                const a = s.aliens[ai];
                if (!a.alive) continue;
                if (rect(b.x, b.y, 3, 12, a.x, a.y, 30, 22)) {
                    a.alive = false; s.bullets.splice(bi, 1);
                    playPew();
                    const pts = a.type === 0 ? 30 : a.type === 1 ? 20 : 10;
                    s.score += pts;
                    addPopup(a.x + 15, a.y, `+${pts}`, 'rgb(57,255,20)', 11);
                    s.alienMoveInterval = Math.max(10, s.alienMoveInterval - 0.4);
                    hit = true; break;
                }
            }
            if (hit) continue;

            // vs miниони (фаза 3+ помощници на шефчето)
            if (s.minions) {
                for (let mi = s.minions.length - 1; mi >= 0; mi--) {
                    const m = s.minions[mi];
                    if (!m.alive) continue;
                    if (rect(b.x, b.y, 3, 12, m.x, m.y, 22, 16)) {
                        m.alive = false; s.bullets.splice(bi, 1);
                        playPew();
                        s.score += 15;
                        addPopup(m.x + 11, m.y, '+15', 'rgb(255,136,0)', 11);
                        hit = true; break;
                    }
                }
            }
            if (hit) continue;

            // vs boss (nuke-ът може да го уцели дори докато спи на 0 hp — само explosion-а го маха от играта)
            if (s.boss && !s.boss.exploding && rect(b.x, b.y, b.nuke ? 8 : 3, b.nuke ? 16 : 12, s.boss.x, s.boss.y, s.boss.w, s.boss.h)) {
                if (b.nuke) {
                    s.bullets.splice(bi, 1);
                    triggerBossExplosion(s);
                    hit = true;
                } else if (!s.boss.asleep) {
                    s.boss.hp--; s.bullets.splice(bi, 1); s.score += 5; hit = true;
                }
            }
            if (hit) continue;

            // vs UFO
            if (s.ufoActive && rect(b.x, b.y, 3, 12, s.ufoX, s.ufoY, 36, 18)) {
                s.ufoActive = false; s.bullets.splice(bi, 1); s.score += 100;
                addPopup(s.ufoX + 18, s.ufoY, '+100', 'rgb(255,68,68)', 14); hit = true;
            }
            if (hit) continue;

            // vs shelters — player bullets also damage them (важи и на нивото с Шефчето —
            // прикритието вече може да се чупи и от нас, не само от бомбите му)
            for (const sh of s.shelters) {
                for (let bki = sh.blocks.length - 1; bki >= 0; bki--) {
                    const blk = sh.blocks[bki];
                    const bx2 = sh.x + blk.bc * 6, by2 = sh.y + blk.br * 7;
                    if (rect(b.x, b.y, 3, 12, bx2, by2, 5, 6)) {
                        blk.hp--; if (blk.hp <= 0) sh.blocks.splice(bki, 1);
                        s.bullets.splice(bi, 1); hit = true; break;
                    }
                }
                if (hit) break;
            }
        }

        // Bombs vs shelters
        // На нивото с Шефчето подплатяваме хитбокса на всеки блок с няколко пиксела —
        // за да не може бомба да се промъкне през ръба на прикритието, докато се крием под него
        for (let bi = s.bombs.length - 1; bi >= 0; bi--) {
            const b = s.bombs[bi];
            let hit = false;
            const pad = s.mode === 'boss' ? 2.5 : 0;
            for (const sh of s.shelters) {
                for (let bki = sh.blocks.length - 1; bki >= 0; bki--) {
                    const blk = sh.blocks[bki];
                    const bx2 = sh.x + blk.bc * 6 - pad, by2 = sh.y + blk.br * 7 - pad;
                    if (rect(b.x, b.y, 4, 10, bx2, by2, 5 + pad * 2, 6 + pad * 2)) {
                        blk.hp--; if (blk.hp <= 0) sh.blocks.splice(bki, 1);
                        s.bombs.splice(bi, 1); hit = true; break;
                    }
                }
                if (hit) break;
            }
        }

        // Bombs vs player
        const finalStandImmortal = s.mode === 'boss' && s.boss && s.boss.phase === 4 && !s.boss.asleep && s.lives === 1;
        if (s.playerInvincible > 0) { s.playerInvincible--; }
        else if (!finalStandImmortal) {
            for (let bi = s.bombs.length - 1; bi >= 0; bi--) {
                const b = s.bombs[bi];
                if (rect(b.x, b.y, 4, 10, p.x, p.y, p.w, p.h)) {
                    s.bombs.splice(bi, 1); s.lives--; s.flashTimer = 20; s.playerInvincible = 90;
                    addPopup(p.x + 18, p.y - 10, '-1 ЖИВОТ', 'rgb(255,68,68)', 12);
                    if (s.lives <= 0) s.over = true;
                    break;
                }
            }
        }

        // Mini nuke vs player (Фаза 4 финал — вземаме го за решаващия изстрел)
        if (s.miniNuke && rect(s.miniNuke.x - 12, s.miniNuke.y - 14, 24, 28, p.x, p.y, p.w, p.h)) {
            s.miniNuke = null;
            s.hasMiniNuke = true;
            playFood();
            addPopup(p.x + p.w / 2, p.y - 16, '☢ MINI NUKE ГОТОВ!', 'rgb(255,238,68)', 13);
        }

        // Fruits vs player (hardcore)
        for (let ci = s.cherries.length - 1; ci >= 0; ci--) {
            const c = s.cherries[ci];
            if (rect(c.x - 12, c.y - 8, 24, 16, p.x, p.y, p.w, p.h)) {
                s.cherries.splice(ci, 1);
                playFood();
                markFruitCollected(c.fruitIdx !== undefined ? c.fruitIdx : 0);
                const def = c.def || FRUITS[0];
                if (def.life > 0) {
                    const added = Math.min(def.life, 4 - s.lives);
                    if (added > 0) {
                        s.lives += added;
                        addPopup(c.x, c.y, def.label, 'rgb(255,136,204)', 13);
                    } else {
                        // Already at max lives — give bonus points
                        s.score += 50;
                        addPopup(c.x, c.y, '+50 БОНУС', 'rgb(255,136,204)', 13);
                    }
                } else if (def.power === 'rainbow') {
                    s.tripleShot = 900;               // 15 сек. тройна стрелба
                    s.playerInvincible = Math.max(s.playerInvincible, 900); // 15 сек. безсмъртие
                    s.rainbowTimer = 900;              // играчът преливa в цветове
                    addPopup(c.x, c.y - 8, def.label, 'rgb(255,64,200)', 14);
                } else {
                    s.score += def.pts;
                    addPopup(c.x, c.y, def.label, 'rgb(255,238,68)', 12);
                }
            }
        }
    }

    // ── GAME LOOP ──────────────────────────────────────────────
    function gameLoop() {
        if (!gameRunning) return;
        update(state);
        draw(state);
        updateBgPlayback();

        if (state.over || state.won) {
            const rb = document.getElementById('invaders-restart-btns');
            if (rb && rb.style.display !== 'flex') {
                rb.style.display = 'flex';
                document.getElementById('inv-restart-hard').style.display = hardcoreEverUnlocked ? '' : 'none';
                updateBossButtonUI();
                const earnedCaps = Math.floor(state.score / 25);
                if (earnedCaps > 0) {
                    addCaps(earnedCaps);
                    addPopup(state.W / 2, state.H / 2 + 40, `+${earnedCaps} ☢ КАПАЧКИ`, 'rgb(255,204,51)', 14);
                }
                if (state.won) {
                    if (state.mode === 'normal') unlockAchievement('normal_clear');
                    else if (state.mode === 'hardcore') unlockAchievement('hard_clear');
                    else if (state.mode === 'boss') unlockAchievement('boss_clear');
                }
                if (state.won && state.mode === 'boss') {
                    try {
                        if (typeof showBossVictoryModal === 'function') showBossVictoryModal();
                    } catch (e) {
                        console.error('boss-victory modal failed:', e);
                        const m = document.getElementById('boss-victory-modal');
                        if (m) m.style.display = 'flex';
                    }
                }
            }
            // Space рестартира същия режим
            if (state.keys[' ']) {
                restartGame(gameMode);
                state.keys[' '] = false;
            } else if ((state.keys['h'] || state.keys['H']) && hardcoreEverUnlocked) {
                restartGame('hardcore');
                state.keys['h'] = state.keys['H'] = false;
            }
        } else {
            const rb = document.getElementById('invaders-restart-btns');
            if (rb) rb.style.display = 'none';
        }

        animFrame = requestAnimationFrame(gameLoop);
    }

    // ── START / STOP ───────────────────────────────────────────
    function restartGame(mode) {
        const rb = document.getElementById('invaders-restart-btns');
        if (rb) rb.style.display = 'none';
        state = initState(mode || 'normal');
        playBg(selectBgForMode(state.mode, 1));
        setPhase3MobileControls(false, false);
    }

    function startGame(mode) {
        if (!canvas || !ctx) return;
        invadersEverStarted = true;
        document.getElementById('invaders-tutorial-panel').style.display = 'none';
        document.getElementById('invaders-mode-panel').style.display = 'none';
        const gameArea = document.getElementById('invaders-game-area');
        gameArea.style.display = 'flex';
        const rb = document.getElementById('invaders-restart-btns');
        if (rb) rb.style.display = 'none';
        state = initState(mode || 'normal');
        gameRunning = true; gamePaused = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        playBg(selectBgForMode(state.mode, 1));
        setPhase3MobileControls(false, false);
        requestAnimationFrame(gameLoop);
    }

    function stopGame() {
        gameRunning = false; gamePaused = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        stopBg();
        document.getElementById('invaders-game-area').style.display = 'none';
        const rb = document.getElementById('invaders-restart-btns');
        if (rb) rb.style.display = 'none';
        if (typeof closeCodeEntry === 'function') closeCodeEntry();
        state = null;
    }

    window.invadersStopGame = stopGame;
    window.invadersPauseGame = function () { if (gameRunning) gamePaused = true; };
    window.invadersSetMuted = function (muted) {
        [bgNormal, bgHard, bgBoss1, bgBoss2].forEach(a => { if (a) a.muted = muted; });
    };

    // HTML restart buttons
    document.getElementById('inv-restart-normal').addEventListener('click', () => restartGame('normal'));
    document.getElementById('inv-restart-hard').addEventListener('click', () => restartGame('hardcore'));
    document.getElementById('inv-restart-boss').addEventListener('click', () => {
        if (window.bossEverUnlocked) restartGame('boss');
    });
    document.getElementById('inv-code-key-btn').addEventListener('click', () => {
        if (hardcoreEverUnlocked && !window.bossEverUnlocked) openCodeEntry();
    });
    document.getElementById('invaders-help-btn').addEventListener('click', () => {
        if (gameRunning) gamePaused = true;
        document.getElementById('invaders-mode-panel').style.display = 'none';
        document.getElementById('invaders-game-area').style.display = 'none';
        document.getElementById('invaders-start-btn').style.display = invadersEverStarted ? 'none' : '';
        document.getElementById('invaders-tutorial-close-btn').style.display = invadersEverStarted ? '' : 'none';
        document.getElementById('invaders-tutorial-panel').style.display = 'flex';
    });
    document.getElementById('invaders-tutorial-close-btn').addEventListener('click', () => {
        document.getElementById('invaders-tutorial-panel').style.display = 'none';
        if (state) {
            document.getElementById('invaders-game-area').style.display = 'flex';
        } else if (invadersEverStarted) {
            updateBossButtonUI();
            document.getElementById('invaders-mode-panel').style.display = 'flex';
        }
    });

    function updateBossButtonUI() {
        const bossUnlocked = !!window.bossEverUnlocked;
        updateCapsCounterUI();

        // Копчета над canvas-а (при победа)
        const bossBtn = document.getElementById('inv-restart-boss');
        bossBtn.style.display = hardcoreEverUnlocked ? '' : 'none';
        bossBtn.disabled = !bossUnlocked;
        bossBtn.title = bossUnlocked ? 'Шефчето' : 'Заключено';
        document.getElementById('inv-boss-btn-face').style.display = bossUnlocked ? '' : 'none';
        document.getElementById('inv-boss-btn-lock').style.display = bossUnlocked ? 'none' : '';
        document.getElementById('inv-code-key-btn').style.display = (hardcoreEverUnlocked && !bossUnlocked) ? '' : 'none';
        document.getElementById('inv-restart-hard').style.display = hardcoreEverUnlocked ? '' : 'none';

        // Огледални копчета в менюто за избор на режим
        const modeBossBtn = document.getElementById('mode-boss-btn');
        modeBossBtn.style.display = hardcoreEverUnlocked ? '' : 'none';
        modeBossBtn.disabled = !bossUnlocked;
        modeBossBtn.title = bossUnlocked ? 'Шефчето' : 'Заключено';
        document.getElementById('mode-boss-btn-face').style.display = bossUnlocked ? '' : 'none';
        document.getElementById('mode-boss-btn-lock').style.display = bossUnlocked ? 'none' : '';
        document.getElementById('mode-code-key-btn').style.display = (hardcoreEverUnlocked && !bossUnlocked) ? '' : 'none';
        document.getElementById('mode-hard-btn').style.display = hardcoreEverUnlocked ? '' : 'none';
    }

    // ── МЕНЮ ЗА ИЗБОР НА РЕЖИМ (отваря се от "← назад" в хедъра) ──
    function openModeMenu() {
        stopGame();
        document.getElementById('invaders-tutorial-panel').style.display = 'none';
        updateBossButtonUI();
        document.getElementById('invaders-mode-panel').style.display = 'flex';
    }
    window.invadersOpenModeMenu = openModeMenu;

    document.getElementById('mode-normal-btn').addEventListener('click', () => {
        document.getElementById('invaders-mode-panel').style.display = 'none';
        startGame('normal');
    });
    document.getElementById('mode-hard-btn').addEventListener('click', () => {
        if (!hardcoreEverUnlocked) return;
        document.getElementById('invaders-mode-panel').style.display = 'none';
        startGame('hardcore');
    });
    document.getElementById('mode-boss-btn').addEventListener('click', () => {
        if (!window.bossEverUnlocked) return;
        document.getElementById('invaders-mode-panel').style.display = 'none';
        startGame('boss');
    });
    document.getElementById('mode-code-key-btn').addEventListener('click', () => {
        if (hardcoreEverUnlocked && !window.bossEverUnlocked) {
            document.getElementById('invaders-mode-panel').style.display = 'none';
            openCodeEntry();
        }
    });

    // ── МАГАЗИН ЗА СКИНОВЕ НА КОРАБА ─────────────────────────────
    let skinShopBrowseIdx = Math.max(0, SHIP_SKINS.findIndex(s => s.id === equippedSkinId));

    function renderSkinShop() {
        const skin = SHIP_SKINS[skinShopBrowseIdx];
        const preview = document.getElementById('skin-preview-svg');
        if (preview) preview.style.color = skin.color;
        const nameLabel = document.getElementById('skin-name-label');
        if (nameLabel) nameLabel.textContent = skin.label;

        const capsLabel = document.getElementById('skin-shop-caps-count');
        if (capsLabel) capsLabel.textContent = String(getCaps());

        const owned = ownsSkin(skin.id);
        const canAfford = getCaps() >= skin.price;
        const buyBtn = document.getElementById('skin-buy-btn');
        const buyLabel = document.getElementById('skin-buy-label');

        buyBtn.classList.remove('skin-shop-btn-owned', 'skin-shop-btn-locked');
        if (owned) {
            buyBtn.disabled = true;
            buyBtn.classList.add('skin-shop-btn-owned');
            buyLabel.textContent = 'Купено';
        } else {
            buyBtn.disabled = !canAfford;
            if (!canAfford) buyBtn.classList.add('skin-shop-btn-locked');
            buyLabel.textContent = `${skin.price} капачки за да се отключи`;
        }

        const useBtn = document.getElementById('skin-use-btn');
        const useLabel = document.getElementById('skin-use-label');
        const useLock = document.getElementById('skin-use-lock');
        if (!owned) {
            useBtn.disabled = true;
            useLabel.style.display = 'none';
            useLock.style.display = '';
        } else {
            useBtn.disabled = equippedSkinId === skin.id;
            useLabel.style.display = '';
            useLock.style.display = 'none';
            useLabel.textContent = (equippedSkinId === skin.id) ? 'Използван' : 'Използвай';
        }
    }

    function openSkinShop() {
        skinShopBrowseIdx = Math.max(0, SHIP_SKINS.findIndex(s => s.id === equippedSkinId));
        renderSkinShop();
        document.getElementById('skin-shop-modal').style.display = 'flex';
    }

    document.getElementById('mode-skin-btn').addEventListener('click', openSkinShop);
    document.getElementById('close-skin-shop-modal').addEventListener('click', () => {
        document.getElementById('skin-shop-modal').style.display = 'none';
    });
    document.getElementById('mode-achievements-btn').addEventListener('click', () => {
        renderAchievements();
        document.getElementById('achievements-modal').style.display = 'flex';
    });
    document.getElementById('close-achievements-modal').addEventListener('click', () => {
        document.getElementById('achievements-modal').style.display = 'none';
    });
    document.getElementById('skin-prev-btn').addEventListener('click', () => {
        skinShopBrowseIdx = (skinShopBrowseIdx - 1 + SHIP_SKINS.length) % SHIP_SKINS.length;
        renderSkinShop();
    });
    document.getElementById('skin-next-btn').addEventListener('click', () => {
        skinShopBrowseIdx = (skinShopBrowseIdx + 1) % SHIP_SKINS.length;
        renderSkinShop();
    });
    document.getElementById('skin-buy-btn').addEventListener('click', () => {
        const skin = SHIP_SKINS[skinShopBrowseIdx];
        if (ownsSkin(skin.id)) return;
        if (!spendCaps(skin.price)) return;
        const owned = getOwnedSkins();
        owned.push(skin.id);
        saveOwnedSkins(owned);
        unlockAchievement('new_skin');
        renderSkinShop();
    });
    document.getElementById('skin-use-btn').addEventListener('click', () => {
        const skin = SHIP_SKINS[skinShopBrowseIdx];
        if (!ownsSkin(skin.id)) return;
        equipSkin(skin.id);
        renderSkinShop();
    });

    // ── НУЛИРАНЕ НА ПРОГРЕСА (от инструкциите на аркадния модул) ──
    const RESET_ACTIONS = {
        full: {
            title: 'НУЛИРАЙ ЦЕЛИЯ ПРОЦЕС',
            removes: [
                'Всички събрани капачки (☢)',
                'Всички закупени скинове и избрания скин (връщане към класическия)',
                'Всички отключени постижения',
                'Книгата за интелигентност (хакването на шефчето се заключва отново)',
                'Прогреса на трудност (ТРУДЕН режим и шефчето се заключват отново)',
            ],
        },
        caps: {
            title: 'НУЛИРАЙ БРОЙ КАПАЧКИ',
            removes: ['Всички събрани капачки (☢) — броячът се връща на 0'],
        },
        skins: {
            title: 'НУЛИРАЙ ОТКЛЮЧЕНИТЕ СКИНОВЕ',
            removes: ['Всички закупени скинове освен класическия', 'Избраният в момента скин се връща на класическия'],
        },
        difficulty: {
            title: 'НУЛИРАЙ ПРОГРЕСА НА ТРУДНОСТ',
            removes: ['Отключването на ТРУДЕН режим', 'Отключването на боя с шефчето', 'Текущата активна игра — връщаш се в менюто за избор на режим'],
        },
        achievements: {
            title: 'НУЛИРАЙ ПОСТИЖЕНИЯТА',
            removes: ['Всички отключени постижения — все едно нямаш нито едно отключено'],
        },
    };
    let pendingReset = null;

    function resetDifficultyProgress() {
        hardcoreEverUnlocked = false;
        window.bossEverUnlocked = false;
        openModeMenu();
    }

    function performReset(type) {
        switch (type) {
            case 'full':
                localStorage.removeItem('argCaps');
                localStorage.removeItem('argOwnedSkins');
                localStorage.removeItem('argShipSkin');
                localStorage.removeItem('argAchievements');
                localStorage.removeItem('argCollectedFruits');
                localStorage.removeItem('argIntelligenceBook');
                equippedSkinId = 'green';
                resetDifficultyProgress();
                break;
            case 'caps':
                localStorage.removeItem('argCaps');
                break;
            case 'skins':
                localStorage.removeItem('argOwnedSkins');
                localStorage.removeItem('argShipSkin');
                equippedSkinId = 'green';
                break;
            case 'difficulty':
                resetDifficultyProgress();
                break;
            case 'achievements':
                localStorage.removeItem('argAchievements');
                break;
        }
        updateCapsCounterUI();
        updateBossButtonUI();
        updateIntelligenceUI();
        renderAchievements();
        if (document.getElementById('skin-shop-modal').style.display === 'flex') {
            skinShopBrowseIdx = Math.max(0, SHIP_SKINS.findIndex(s => s.id === equippedSkinId));
            renderSkinShop();
        }
    }

    function showResetList() {
        pendingReset = null;
        document.getElementById('reset-options-list').style.display = 'flex';
        document.getElementById('reset-confirm-box').style.display = 'none';
    }

    function openResetModal() {
        showResetList();
        document.getElementById('reset-options-modal').style.display = 'flex';
    }

    document.getElementById('inv-reset-open-btn').addEventListener('click', openResetModal);
    document.getElementById('close-reset-options-modal').addEventListener('click', () => {
        document.getElementById('reset-options-modal').style.display = 'none';
    });

    document.querySelectorAll('.reset-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.reset;
            const action = RESET_ACTIONS[type];
            if (!action) return;
            pendingReset = type;
            document.getElementById('reset-confirm-title').textContent = action.title;
            document.getElementById('reset-confirm-removes').innerHTML =
                action.removes.map(r => `<li>${r}</li>`).join('');
            document.getElementById('reset-options-list').style.display = 'none';
            document.getElementById('reset-confirm-box').style.display = 'flex';
        });
    });

    document.getElementById('reset-confirm-no').addEventListener('click', showResetList);
    document.getElementById('reset-confirm-yes').addEventListener('click', () => {
        if (!pendingReset) return;
        performReset(pendingReset);
        document.getElementById('reset-options-modal').style.display = 'none';
        pendingReset = null;
    });

    // ── ПАРОЛА ЗА ШЕФЧЕТО: пишеща клавиатура + алтернативно хакване ──
    // По подразбиране паролата е класическата Konami последователност
    // (▲▲▼▼◄►◄►BA), въведена през стрелките + буквите B/A на клавиатурата.
    // Хакването разкрива алтернативна дума-парола, валидна веднага след пробива.
    const KONAMI_STR = '▲▲▼▼◄►◄►BA';
    const BOSS_TYPED_CODE = 'OVERSEER'; // алтернативната парола (лесно за смяна)
    const ARROW_MAP = { up: '▲', down: '▼', left: '◄', right: '►' };
    let typedCode = '';
    let codeEntryOpen = false;

    function updateTypedDisplay() {
        document.getElementById('inv-typed-display').textContent = typedCode;
    }

    function typeLetter(letter) {
        if (typedCode.length >= 14) return;
        typedCode += letter;
        updateTypedDisplay();
        document.getElementById('inv-code-msg').textContent = '';
    }

    function typeArrow(symbol) {
        if (typedCode.length >= 14) return;
        typedCode += symbol;
        updateTypedDisplay();
        document.getElementById('inv-code-msg').textContent = '';
    }

    function typeDelete() {
        typedCode = typedCode.slice(0, -1);
        updateTypedDisplay();
    }

    function submitTypedCode() {
        if (typedCode.length === 0) return;
        if (typedCode === KONAMI_STR || typedCode.toUpperCase() === BOSS_TYPED_CODE) {
            window.bossEverUnlocked = true;
            document.getElementById('inv-code-msg').style.color = 'var(--doom-green)';
            document.getElementById('inv-code-msg').textContent = 'ДОСТЪП ОТКЛЮЧЕН!';
            updateBossButtonUI();
            setTimeout(closeCodeEntry, 900);
        } else {
            document.getElementById('inv-code-msg').style.color = 'var(--error-red)';
            document.getElementById('inv-code-msg').textContent = 'ГРЕШЕН КОД';
            typedCode = '';
            updateTypedDisplay();
        }
    }

    document.querySelectorAll('.inv-kb-key').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.letter) typeLetter(btn.dataset.letter);
            else if (btn.dataset.action === 'del') typeDelete();
            else if (btn.dataset.action === 'enter') submitTypedCode();
            else if (ARROW_MAP[btn.dataset.action]) typeArrow(ARROW_MAP[btn.dataset.action]);
        });
    });

    function updateIntelligenceUI() {
        const note = document.getElementById('inv-intelligence-note');
        const hackBtn = document.getElementById('inv-hack-btn');
        const owned = hasIntelligenceBook();
        if (note) note.style.display = owned ? 'block' : 'none';
        if (hackBtn) {
            hackBtn.classList.toggle('inv-hack-btn-locked', !owned);
            hackBtn.title = owned ? 'Опит за хакване' : 'Ниска интелигентност — нужна е книга';
        }
    }

    function openCodeEntry() {
        codeEntryOpen = true;
        if (gameRunning) gamePaused = true;
        document.getElementById('invaders-game-area').style.display = 'flex';
        document.getElementById('inv-code-msg').textContent = '';
        typedCode = '';
        updateTypedDisplay();
        document.getElementById('inv-hack-overlay').style.display = 'none';
        updateIntelligenceUI();
        document.getElementById('inv-code-entry').style.display = 'flex';
    }

    function closeCodeEntry() {
        const wasOpen = codeEntryOpen;
        codeEntryOpen = false;
        document.getElementById('inv-code-entry').style.display = 'none';
        if (wasOpen && !state) {
            document.getElementById('invaders-game-area').style.display = 'none';
            updateBossButtonUI();
            document.getElementById('invaders-mode-panel').style.display = 'flex';
        }
    }

    document.getElementById('inv-code-close').addEventListener('click', closeCodeEntry);

    document.addEventListener('keydown', (e) => {
        if (!codeEntryOpen) return;
        if (document.getElementById('inv-hack-overlay').style.display === 'flex') return;
        if (e.key === 'Enter') {
            e.preventDefault();
            submitTypedCode();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            typeDelete();
            return;
        }
        const arrowKeyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        if (arrowKeyMap[e.key]) {
            e.preventDefault();
            typeArrow(ARROW_MAP[arrowKeyMap[e.key]]);
            return;
        }
        if (/^[a-zA-Z]$/.test(e.key)) {
            e.preventDefault();
            typeLetter(e.key.toUpperCase());
        }
    });

    // ── ХАКВАНЕ: алтернативен път до паролата (терминал в стил Сектор I) ──
    let invHackTries = 4;
    let invHackLocked = false;
    let invHackWords = [];
    let invHackTarget = '';

    function updateHackAttemptsUI() {
        let blocks = "";
        for (let i = 0; i < invHackTries; i++) blocks += "■ ";
        document.getElementById('inv-hack-attempts-blocks').innerText = blocks.trim();
    }

    function invGetRandomSymbolsStr(length) {
        let res = "";
        for (let i = 0; i < length; i++) {
            const char = symbolsArray[Math.floor(Math.random() * symbolsArray.length)];
            const span = document.createElement('span');
            span.className = 'fallout-symbol';
            span.textContent = char;
            span.addEventListener('click', () => invProcessSymbolClick(char));
            res += span.outerHTML;
        }
        return res;
    }

    function invGenerateClickableSymbols(length) {
        if (length < 2) return invGetRandomSymbolsStr(length);

        if (Math.random() < 0.3 && length >= 3) {
            const pair = bracketPairs[Math.floor(Math.random() * bracketPairs.length)];
            const groupLen = Math.floor(Math.random() * (length - 2)) + 2;
            const beforeLen = Math.floor(Math.random() * (length - groupLen));
            const afterLen = length - groupLen - beforeLen;

            let insideContent = "";
            for (let i = 0; i < groupLen - 2; i++) insideContent += symbolsArray[Math.floor(Math.random() * symbolsArray.length)];

            const rawText = pair[0] + insideContent + pair[1];
            const span = document.createElement('span');
            span.className = 'bracket-group';
            span.textContent = rawText;
            span.addEventListener('click', () => invProcessBracket(span, rawText));

            let html = invGetRandomSymbolsStr(beforeLen);
            html += span.outerHTML;
            html += invGetRandomSymbolsStr(afterLen);
            return html;
        }
        return invGetRandomSymbolsStr(length);
    }

    function invAppendLog(html) {
        const log = document.getElementById('inv-hack-log');
        log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="inv-hack-log-cursor"></span>', '');
        log.innerHTML += html + `> <span class="block-cursor" id="inv-hack-log-cursor"></span>`;
        log.scrollTop = log.scrollHeight;
    }

    window.invProcessBracket = function (element, rawText) {
        if (invHackLocked || invHackTries <= 0) return;
        if (element.classList.contains('used-bracket')) return;
        element.classList.add('used-bracket');

        if (Math.random() < 0.5) {
            invHackTries = 4;
            updateHackAttemptsUI();
            invAppendLog(`>${rawText}<br>>Allowance replenished.<br>`);
        } else {
            const duds = invHackWords.filter(w => w !== invHackTarget && !document.getElementById(`inv-hack-word-${w}`).classList.contains('disabled'));
            if (duds.length > 0) {
                const dudToRemove = duds[Math.floor(Math.random() * duds.length)];
                const el = document.getElementById(`inv-hack-word-${dudToRemove}`);
                el.innerText = ".".repeat(dudToRemove.length);
                el.classList.add('disabled');
                invAppendLog(`>${rawText}<br>>Dud removed.<br>`);
            } else {
                invAppendLog(`>${rawText}<br>>Error.<br>`);
            }
        }
    };

    window.invProcessSymbolClick = function (char) {
        if (invHackLocked || invHackTries <= 0) return;
        invAppendLog(`>${char}<br>>Error<br>`);
    };

    window.invProcessWordGuess = function (word) {
        if (invHackLocked || invHackTries <= 0) return;
        const el = document.getElementById(`inv-hack-word-${word}`);
        if (el.classList.contains('disabled')) return;

        if (word === invHackTarget) {
            invHackLocked = true;
            document.querySelectorAll('#inv-hack-grid .fallout-word').forEach(w => w.classList.add('disabled'));
            invAppendLog(`>${word}<br>>Access Granted.<br>>ПАРОЛА: ${BOSS_TYPED_CODE}<br>`);
            setTimeout(() => {
                document.getElementById('inv-hack-overlay').style.display = 'none';
                typedCode = BOSS_TYPED_CODE;
                updateTypedDisplay();
                document.getElementById('inv-code-msg').textContent = '';
            }, 2200);
        } else {
            el.classList.add('disabled');
            invHackTries--;
            updateHackAttemptsUI();
            const likeness = computeLikeness(word, invHackTarget);
            invAppendLog(`>${word}<br>>Entry denied.<br>>Likeness=${likeness}<br>`);
            if (invHackTries <= 0) {
                invHackLocked = true;
                document.querySelectorAll('#inv-hack-grid .fallout-word').forEach(w => w.classList.add('disabled'));
                invAppendLog(`>SYSTEM LOCKED.<br>>REINITIALIZING NEW HACK...<br>`);
                setTimeout(() => { openHackGame(); }, 1800);
            }
        }
    };

    function openHackGame() {
        invHackTries = 4;
        invHackLocked = false;
        updateHackAttemptsUI();

        const wordPool = (gameData.questions[0] && gameData.questions[0].words) || [];
        if (wordPool.length < 6) return;
        const selection = pickBalancedWordSet(wordPool, 6);
        invHackWords = selection.words;
        invHackTarget = selection.target;

        const wordLen = invHackTarget.length;
        const charsPerRow = wordLen + 4;
        const rows = 8;
        let rowAssignments = {};
        let availableRows = Array.from({ length: rows }, (_, i) => i);
        invHackWords.forEach(word => {
            const idx = Math.floor(Math.random() * availableRows.length);
            const rowNum = availableRows.splice(idx, 1)[0];
            rowAssignments[rowNum] = word;
        });

        let hex = 0x4A10;
        let rowsHTML = '';
        for (let i = 0; i < rows; i++) {
            const hexStr = "0x" + hex.toString(16).toUpperCase();
            hex += 12;
            let rowContent = "";
            if (rowAssignments[i]) {
                const word = rowAssignments[i];
                const maxPadding = charsPerRow - word.length;
                const padLeft = Math.floor(Math.random() * (maxPadding + 1));
                const padRight = maxPadding - padLeft;
                rowContent += invGenerateClickableSymbols(padLeft);
                rowContent += `<span class="fallout-word" id="inv-hack-word-${word}" onclick="invProcessWordGuess('${word}')">${word}</span>`;
                rowContent += invGenerateClickableSymbols(padRight);
            } else {
                rowContent += invGenerateClickableSymbols(charsPerRow);
            }
            rowsHTML += `<div class="fallout-row"><span class="hex-code">${hexStr}</span><span class="fallout-text-block">${rowContent}</span></div>`;
        }

        document.getElementById('inv-hack-grid').innerHTML = rowsHTML;
        document.getElementById('inv-hack-log').innerHTML = `>ROBCO TERMLINK v3.2<br>>ENTER PASSWORD<br>> <span class="block-cursor" id="inv-hack-log-cursor"></span>`;
        document.getElementById('inv-hack-overlay').style.display = 'flex';
    }

    document.getElementById('inv-hack-btn').addEventListener('click', () => {
        if (!hasIntelligenceBook()) {
            document.getElementById('inv-code-msg').style.color = 'var(--error-red)';
            document.getElementById('inv-code-msg').textContent = 'НИСКО НИВО НА ИНТЕЛИГЕНТНОСТ. НАМЕРИ КНИГА, ЗА ДА ХАКНЕШ.';
            return;
        }
        openHackGame();
    });
    document.getElementById('inv-hack-close').addEventListener('click', () => {
        document.getElementById('inv-hack-overlay').style.display = 'none';
    });


    document.getElementById('invaders-start-btn').addEventListener('click', () => {
        startGame('normal');
    });

    document.getElementById('close-modal').addEventListener('click', () => { if (gameRunning) gamePaused = true; });

    document.addEventListener('keydown', e => {
        if (!gameRunning) return;
        if (e.key === 'p' || e.key === 'P') { gamePaused = !gamePaused; return; }
        if (e.key === 'Escape') { gamePaused = true; return; }
        if (e.key === ' ') e.preventDefault(); // да не скролва страницата, докато играем
        if (state) state.keys[e.key] = true;
    });
    document.addEventListener('keyup', e => {
        if (state) state.keys[e.key] = false;
    });

    function bindMobile(id, dn, up) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('touchstart', e => { e.preventDefault(); dn(); }, { passive: false });
        el.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false });
        el.addEventListener('mousedown', dn);
        el.addEventListener('mouseup', up);
    }
    bindMobile('inv-left-btn', () => { if (state) state.mobileLeft = true; }, () => { if (state) state.mobileLeft = false; });
    bindMobile('inv-right-btn', () => { if (state) state.mobileRight = true; }, () => { if (state) state.mobileRight = false; });
    bindMobile('inv-up-btn', () => { if (state) state.mobileUp = true; }, () => { if (state) state.mobileUp = false; });
    bindMobile('inv-down-btn', () => { if (state) state.mobileDown = true; }, () => { if (state) state.mobileDown = false; });
    bindMobile('inv-fire-btn', () => { if (state) state.mobileFire = true; }, () => { if (state) state.mobileFire = false; });
})();

// --- ПАРТИ РЕЖИМ: ASCII танц + музика, докато прозорецът е отворен ---
(function partyMode() {
    // Две прости пози: ръце нагоре и крака встрани / ръце надолу и крака заедно
    const FRAMES = [
        [
            ' \\(^o^)/ ',
            '  \\_|_/  ',
            '    |    ',
            '   / \\   ',
            '  /   \\  '
        ],
        [
            ' _(^o^)_ ',
            '  /_|_\\  ',
            '    |    ',
            '   | |   ',
            '   | |   '
        ]
    ];
    const FRAME_MS = 215;          // ~2 кадъра на удар; подкрепи според темпото на твоя файл
    const btn = document.getElementById('party-btn');
    const overlay = document.getElementById('party-overlay');
    const art = document.getElementById('party-art');
    const msg = document.getElementById('party-msg');
    const audio = document.getElementById('party-audio');
    let timer = null, tick = 0, resume = [];

    function draw() {
        const f = FRAMES[tick % FRAMES.length];
        art.textContent = f.map(row => [row, row, row].join('      ')).join('\n');
        tick++;
    }

    function showMsg(t) { msg.textContent = t; }

    function open() {
        menuChangeSound.currentTime = 0;
        menuChangeSound.volume = 0.7;
        menuChangeSound.play().catch(() => { });
        // пауза на останалата музика и запомняне какво е свирело
        resume = Array.from(document.querySelectorAll('audio')).filter(a => a !== audio && !a.paused && !a.ended);
        resume.forEach(a => a.pause());
        overlay.style.display = 'flex';
        showMsg('');
        tick = 0; draw();
        timer = setInterval(draw, FRAME_MS);
        audio.currentTime = 0;
        audio.volume = 0.8;
        audio.play().catch(() => {
            showMsg('Не мога да пусна музиката. Провери, че файлът Audio files/caramelldansen.mp3 съществува.');
        });
    }

    function close() {
        clearInterval(timer); timer = null;
        audio.pause();
        audio.currentTime = 0;
        overlay.style.display = 'none';
        resume.forEach(a => a.play().catch(() => { }));
        resume = [];
    }

    audio.addEventListener('error', () => showMsg('Липсва файлът Audio files/caramelldansen.mp3 — сложи го в папката на сайта.'));
    btn.addEventListener('click', open);
    document.getElementById('party-close-btn').addEventListener('click', close);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') close();
    });
})();