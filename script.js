let gameData = {};
let START_DATE, TARGET_DATE;
let currentQIndex = -1;
let sigilTutorialShown = false;
let falloutTutorialShown = false;
let falloutTries = 4;
let isFalloutLocked = false;
let currentFalloutWords = [];
let currentFalloutTarget = "";

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

    const questionModalEl = document.getElementById('question-modal');

    if (q.type === 'invaders') {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.add('invaders-modal-size');
        document.getElementById('invaders-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        // Stop any running game
        if (typeof invadersStopGame === 'function') invadersStopGame();
        // Show tutorial modal on first open (or always, like Sector I)
        document.getElementById('invaders-tutorial-modal').style.display = 'flex';
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
        // Изчакваме един кадър, за да може браузърът да оразмери контейнера преди да изчислим клетките
        requestAnimationFrame(() => requestAnimationFrame(() => initSigilGame(q)));

        if (!sigilTutorialShown) {
            sigilTutorialShown = true;
            document.getElementById('sigil-tutorial-modal').style.display = 'flex';
        }
    } else {
        questionModalEl.classList.remove('sigil-modal-size');
        questionModalEl.classList.remove('invaders-modal-size');
        document.getElementById('fallout-container').style.display = 'block';
        questionModalEl.style.display = 'flex';
        initFalloutGame(q);

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

function initSigilGame(q) {
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
        const selected = sigilPiecesState.find(p => p.selected);
        if (!selected) return;
        selected.cells = rotateSigilCells(selected.cells);
        redrawSigilPiece(selected);
        checkSigilSolution();
    };

    document.getElementById('sigil-restart-btn').onclick = () => initSigilGame(q);

    document.getElementById('sigil-reset-positions-btn').onclick = () => {
        if (sigilSolved) return;
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

    // Проверяваме дали новата позиция се застъпва с друго ВЕЧЕ поставено парче
    const occupiedByOthers = new Set();
    sigilPiecesState.forEach(other => {
        if (other === piece || !other.placedInBoard) return;
        other.cells.forEach(([r, c]) => {
            occupiedByOthers.add(sigilCellKey(other.row + r, other.col + c));
        });
    });

    const wouldOverlap = piece.cells.some(([r, c]) =>
        occupiedByOthers.has(sigilCellKey(clampedRow + r, clampedCol + c))
    );

    if (wouldOverlap) {
        // Отказваме поставянето - връщаме парчето в tray-а, ако нямаше предишна валидна позиция,
        // или го оставяме на старото му място ако вече беше поставено някъде валидно
        if (piece.placedInBoard && piece.row !== null && piece.col !== null) {
            positionSigilPieceOnBoard(piece);
        } else {
            piece.placedInBoard = false;
            piece.row = null;
            piece.col = null;
            document.getElementById('sigil-tray').appendChild(el);
            el.style.position = 'relative';
            el.style.left = '';
            el.style.top = '';
            redrawSigilPiece(piece);
        }
        document.getElementById('error-msg').innerText = 'ФРАГМЕНТИТЕ НЕ МОГАТ ДА СЕ ПРЕПОКРИВАТ';
        setTimeout(() => {
            const errEl = document.getElementById('error-msg');
            if (errEl.innerText === 'ФРАГМЕНТИТЕ НЕ МОГАТ ДА СЕ ПРЕПОКРИВАТ') errEl.innerText = '';
        }, 2000);
        return;
    }

    piece.row = clampedRow;
    piece.col = clampedCol;
    piece.placedInBoard = true;
    redrawSigilPiece(piece);
    positionSigilPieceOnBoard(piece);
}

function checkSigilSolution() {
    if (sigilSolved) return;

    const placedPieces = sigilPiecesState.filter(p => p.placedInBoard);

    // Проверка за припокриване между парчета
    const occupied = new Map();
    let hasOverlap = false;
    placedPieces.forEach(piece => {
        piece.cells.forEach(([r, c]) => {
            const key = sigilCellKey(piece.row + r, piece.col + c);
            if (occupied.has(key)) hasOverlap = true;
            occupied.set(key, piece.id);
        });
    });

    // Маркираме визуално invalid парчета при припокриване
    sigilPiecesState.forEach(piece => {
        const el = document.getElementById(piece.id);
        if (!el) return;
        el.classList.remove('invalid', 'placed-correct');
    });

    if (hasOverlap) {
        document.getElementById('error-msg').innerText = '';
        return;
    }

    // Ако всички парчета са поставени, сравняваме обединението с target силуета
    if (placedPieces.length !== sigilPiecesState.length) return;

    const targetSet = new Set(sigilCurrentLevel.target.map(([r, c]) => sigilCellKey(r, c)));
    const occupiedSet = new Set(occupied.keys());

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
        grantedSound.currentTime = 0;
        grantedSound.volume = 0.9;
        grantedSound.play().catch(() => { });
        document.getElementById('success-msg').innerText = `СЕКРЕТЕН КОД: ${revealedCode}`;
        saveUnlockedCode(q.id, revealedCode);
    }
}

// --- FALLOUT ХАКВАНЕ ЛОГИКА ---
function initFalloutGame(q) {
    isFalloutLocked = true;
    falloutTries = 4;
    updateAttemptsDisplay();

    document.getElementById('lower-diff-btn').style.display = 'none';
    document.getElementById('restart-fallout-btn').style.display = 'none';

    const log = document.getElementById('fallout-log');
    log.innerHTML = '';

    const selection = pickBalancedWordSet(q.words, 14);
    currentFalloutWords = selection.words;
    currentFalloutTarget = selection.target;

    generateFalloutGrid(q);
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

function generateFalloutGrid(q) {
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
            isFalloutLocked = false;
            log.innerHTML = `> <span class="block-cursor" id="log-cursor"></span>`;
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
        document.getElementById('lower-diff-btn').style.display = 'block';
    }

    if (falloutTries === 0) {
        isFalloutLocked = true;
        log.innerHTML = log.innerHTML.replace('<span class="block-cursor" id="log-cursor"></span>', '');
        log.innerHTML += `>TERMINAL LOCKED.<br>>PRESS RESTART TO INITIALIZE NEW HACK.<br>`;
        log.scrollTop = log.scrollHeight;

        disableAllInteractables();
        document.getElementById('lower-diff-btn').style.display = 'none';
        document.getElementById('restart-fallout-btn').style.display = 'block';
    }
}

// --- БУТОНИ И ПОМОЩНИ ФУНКЦИИ ---
document.getElementById('lower-diff-btn').onclick = function () {
    document.getElementById('tutorial-modal').style.display = 'flex';
};

document.getElementById('restart-fallout-btn').onclick = function () {
    this.style.display = 'none';
    initFalloutGame(gameData.questions[currentQIndex]);
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
    const tabs = document.querySelectorAll('.pip-tab');
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

    const canvas = document.getElementById('invaders-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

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
    const WIN_SCORE = 3000;

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
            return { x: sx, y: sy, blocks };
        });
    }

    function spawnBoss(W) {
        return {
            x: W / 2 - 60, y: 28,
            w: 120, h: 62,
            hp: 50, maxHp: 50,
            dir: 1, speed: 0.8,
            phase: 1,
            attackTimer: 0, attackInterval: 80,
            beamActive: false, beamTimer: 0,
            spreadTimer: 0, spreadInterval: 220,
        };
    }

    // ── INIT ───────────────────────────────────────────────────
    function initState(mode) {
        resizeCanvas();
        const W = canvas.width, H = canvas.height;
        gameMode = mode || 'normal';
        const isBoss = gameMode === 'boss';

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
            keys: {},
            mobileLeft: false, mobileRight: false, mobileFire: false,
            shootCooldown: 0,
            ufoActive: false, ufoX: 0, ufoY: 30, ufoDir: 1,
            ufoTimer: 0, ufoInterval: 700, ufoSpeedPx: 1.4,
            cherries: [], cherryTimer: 0, cherryInterval: 210,
            boss: isBoss ? spawnBoss(W) : null,
            popups: [],
            waveCount: 0,   // how many times aliens respawned
            codeGiven: false,
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
        const color = angry ? '#ff2200' : '#ff8800';
        ctx.fillStyle = color;
        ctx.shadowBlur = 14; ctx.shadowColor = color;
        const mirror = Math.floor(Date.now() / 280) % 2 === 1;
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
                const sc = mirror ? cols - 1 - c : c;
                if (sp[r][sc]) ctx.fillRect(boss.x + c * pw, boss.y + r * ph, pw - 0.5, ph - 0.5);
            }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.fillRect(boss.x + 24, boss.y + 11, 9, 9);
        ctx.fillRect(boss.x + boss.w - 33, boss.y + 11, 9, 9);
        ctx.fillStyle = '#000';
        ctx.fillRect(boss.x + 26, boss.y + 13, 5, 5);
        ctx.fillRect(boss.x + boss.w - 31, boss.y + 13, 5, 5);
    }

    function drawPlayer(p, inv) {
        if (inv > 0 && Math.floor(inv / 4) % 2 === 0) return;
        ctx.fillStyle = GREEN; ctx.shadowBlur = 10; ctx.shadowColor = GREEN;
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
        const bw = s.W - 40, bh = 11, bx = 20, by = s.H - 20;
        ctx.fillStyle = '#300'; ctx.fillRect(bx, by, bw, bh);
        const pct = Math.max(0, boss.hp / boss.maxHp);
        const barColor = pct > 0.5 ? RED : '#ff8800';
        ctx.fillStyle = barColor; ctx.shadowBlur = 8; ctx.shadowColor = barColor;
        ctx.fillRect(bx, by, Math.round(bw * pct), bh);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = RED; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = RED; ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS HP', s.W / 2, by - 3);
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
        else if (s.mode === 'boss') { modeLabel = 'БОС'; modeColor = RED; }
        else { modeLabel = 'НОРМАЛЕН'; modeColor = GREEN; }
        ctx.fillStyle = modeColor;
        ctx.textAlign = 'right';
        ctx.fillText(modeLabel, s.W - 8, row1);

        // Row 2 — secondary info
        ctx.font = `${fs - 2}px "Share Tech Mono", monospace`;
        ctx.fillStyle = DIM;

        if (s.mode !== 'boss') {
            const wave = Math.min((s.waveCount || 0) + 1, 3);
            ctx.textAlign = 'left';
            ctx.fillText(`Ниво ${wave} от 3`, 8, row2);
            ctx.textAlign = 'right';
            ctx.fillText(`Цел: ${WIN_SCORE}`, s.W - 8, row2);
        }

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
        ctx.fillRect(0, s.H - (s.mode === 'boss' ? 24 : 28), s.W, 1);

        s.shelters.forEach(sh => drawShelter(sh));
        s.aliens.forEach(a => { if (a.alive) drawAlienSprite(a.type, a.x, a.y, 30, 22, a.frame); });

        if (s.boss) {
            drawBossSprite(s.boss);
            if (s.boss.beamActive) {
                const bx = s.boss.x + s.boss.w / 2 - 9;
                ctx.fillStyle = `rgba(255,50,50,${0.12 + 0.08 * Math.sin(Date.now() / 45)})`;
                ctx.fillRect(bx, s.boss.y + s.boss.h, 18, s.H);
            }
            drawBossBar(s);
        }

        if (s.ufoActive) {
            ctx.fillStyle = RED; ctx.shadowBlur = 8; ctx.shadowColor = RED;
            ctx.beginPath(); ctx.ellipse(s.ufoX + 18, s.ufoY + 5, 10, 6, 0, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(s.ufoX + 18, s.ufoY + 10, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            for (let i = 0; i < 3; i++) ctx.fillRect(s.ufoX + 6 + i * 10, s.ufoY + 7, 4, 4);
        }

        s.cherries.forEach(c => drawCherry(c));
        drawPlayer(s.player, s.playerInvincible);

        s.bullets.forEach(b => {
            ctx.fillStyle = GREEN; ctx.shadowBlur = 7; ctx.shadowColor = GREEN;
            ctx.fillRect(b.x, b.y, 3, 12); ctx.shadowBlur = 0;
        });
        s.bombs.forEach(b => {
            const col = b.spread ? YELLOW : RED;
            ctx.fillStyle = col; ctx.shadowBlur = 4; ctx.shadowColor = col;
            ctx.fillRect(b.x, b.y, b.spread ? 4 : 3, b.spread ? 10 : 8);
            ctx.shadowBlur = 0;
        });

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
            drawOverlay(RED, 'КРАЙ НА ИГРАТА', `ТОЧКИ: ${s.score}`, hardcoreEverUnlocked ? 'Избери режим с бутоните по-долу' : '[ SPACE — РЕСТАРТ ]');
        } else if (s.won) {
            if (s.mode === 'boss') {
                drawBossWin(s);
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
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center';
        ctx.fillStyle = color; ctx.font = `bold 26px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = color;
        ctx.fillText(title, s.W / 2, s.H / 2 - 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `14px "Share Tech Mono", monospace`;
        ctx.fillText(sub, s.W / 2, s.H / 2);
        ctx.fillStyle = DIM; ctx.font = `11px "Share Tech Mono", monospace`;
        ctx.fillText(hint, s.W / 2, s.H / 2 + 22);
        ctx.textAlign = 'left';
    }

    function drawNormalWin(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center';

        ctx.fillStyle = GREEN; ctx.font = `bold 26px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = GREEN;
        ctx.fillText('ПОБЕДА!', s.W / 2, s.H / 2 - 60);
        ctx.shadowBlur = 0;

        ctx.fillStyle = GREEN; ctx.font = `14px "Share Tech Mono", monospace`;
        ctx.fillText(`ТОЧКИ: ${s.score}`, s.W / 2, s.H / 2 - 32);

        // Code box
        ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
        ctx.strokeRect(s.W / 2 - 90, s.H / 2 - 22, 180, 30);
        ctx.fillStyle = GREEN; ctx.font = `bold 20px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 10; ctx.shadowColor = GREEN;
        ctx.fillText('КОД:  P', s.W / 2, s.H / 2 - 2);
        ctx.shadowBlur = 0;

        // Hardcore unlock notice
        ctx.fillStyle = YELLOW; ctx.font = `bold 13px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 8; ctx.shadowColor = YELLOW;
        ctx.fillText('★ ТРУДЕН РЕЖИМ ОТКЛЮЧЕН ★', s.W / 2, s.H / 2 + 26);
        ctx.shadowBlur = 0;

        ctx.fillStyle = DIM; ctx.font = `11px "Share Tech Mono", monospace`;
        ctx.fillText('Избери режим с бутоните по-долу', s.W / 2, s.H / 2 + 46);
        ctx.textAlign = 'left';
    }

    function drawBossWin(s) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, s.W, s.H);
        ctx.textAlign = 'center';
        ctx.fillStyle = RED; ctx.font = `bold 26px "Share Tech Mono", monospace`;
        ctx.shadowBlur = 14; ctx.shadowColor = RED;
        ctx.fillText('БОС ПОБЕДЕН!', s.W / 2, s.H / 2 - 30);
        ctx.shadowBlur = 0;
        ctx.fillStyle = GREEN; ctx.font = `14px "Share Tech Mono", monospace`;
        ctx.fillText(`ТОЧКИ: ${s.score}`, s.W / 2, s.H / 2);
        ctx.fillStyle = DIM; ctx.font = `11px "Share Tech Mono", monospace`;
        ctx.fillText('Избери режим с бутоните по-долу', s.W / 2, s.H / 2 + 24);
        ctx.textAlign = 'left';
    }

    // ── UPDATE ─────────────────────────────────────────────────
    function addPopup(x, y, text, color, size) {
        state.popups.push({ x, y, text, color: color || 'rgb(57,255,20)', size: size || 13, life: 55, maxLife: 55 });
    }

    function rect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function update(s) {
        if (s.over || s.won || gamePaused) return;

        const p = s.player;
        const spd = 3.2;
        if ((s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A'] || s.mobileLeft) && p.x > 0) p.x -= spd;
        if ((s.keys['ArrowRight'] || s.keys['d'] || s.keys['D'] || s.mobileRight) && p.x + p.w < s.W) p.x += spd;

        if (s.shootCooldown > 0) s.shootCooldown--;
        const wantFire = s.keys[' '] || s.keys['ArrowUp'] || s.keys['w'] || s.keys['W'] || s.mobileFire;
        if (wantFire && s.shootCooldown === 0 && s.bullets.length < 3) {
            s.bullets.push({ x: p.x + p.w / 2 - 1.5, y: p.y });
            s.shootCooldown = 15;
        }

        s.bullets = s.bullets.filter(b => { b.y -= 7; return b.y > -12; });

        if (s.mode === 'boss') updateBoss(s);
        else updateAliens(s);

        updateBombs(s);
        updateUFO(s);
        if (s.mode === 'hardcore') updateCherries(s);
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
                s.aliens = spawnAliens(s.W, s.H);
                s.alienSpeed = Math.min(s.alienSpeed + 0.06, 1.0);
                s.alienBombInterval = Math.max(38, s.alienBombInterval - 5);
                addPopup(s.W / 2, s.H / 2 - 30, 'НОВА ВЪЛНА!', 'rgb(57,255,20)', 16);
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

        // Win condition
        if (s.score >= WIN_SCORE && !s.over) {
            s.won = true;
            hardcoreEverUnlocked = true;
        }
    }

    function updateBoss(s) {
        const boss = s.boss;
        if (!boss || boss.hp <= 0) return;

        boss.x += boss.dir * boss.speed;
        if (boss.x <= 0) { boss.x = 0; boss.dir = 1; }
        if (boss.x + boss.w >= s.W) { boss.x = s.W - boss.w; boss.dir = -1; }

        if (boss.hp < boss.maxHp / 2 && boss.phase === 1) {
            boss.phase = 2; boss.speed = 1.5; boss.attackInterval = 52;
            addPopup(s.W / 2, s.H / 2, 'ФАЗА 2!', 'rgb(255,68,68)', 20);
        }

        boss.attackTimer++;
        if (boss.attackTimer >= boss.attackInterval) {
            boss.attackTimer = 0;
            const count = boss.phase === 2 ? 3 : 1;
            for (let i = 0; i < count; i++) {
                s.bombs.push({ x: boss.x + (boss.w / (count + 1)) * (i + 1), y: boss.y + boss.h, spread: false });
            }
        }

        if (boss.phase === 2) {
            boss.beamTimer = (boss.beamTimer || 0) + 1;
            if (boss.beamTimer >= 170) { boss.beamActive = !boss.beamActive; boss.beamTimer = 0; }

            boss.spreadTimer = (boss.spreadTimer || 0) + 1;
            if (boss.spreadTimer >= boss.spreadInterval) {
                boss.spreadTimer = 0;
                for (let i = -2; i <= 2; i++)
                    s.bombs.push({ x: boss.x + boss.w / 2 + i * 14, y: boss.y + boss.h, spread: true, dx: i * 1.3 });
                addPopup(boss.x + boss.w / 2, boss.y - 8, 'SPREAD!', 'rgb(255,136,0)', 13);
            }

            if (boss.beamActive && s.playerInvincible === 0) {
                const bx = boss.x + boss.w / 2 - 9;
                if (rect(s.player.x, s.player.y, s.player.w, s.player.h, bx, boss.y + boss.h, 18, s.H)) {
                    s.lives--; s.flashTimer = 20; s.playerInvincible = 80;
                    if (s.lives <= 0) s.over = true;
                }
            }
        } else {
            boss.beamActive = false;
        }

        if (boss.hp <= 0) { s.won = true; }
    }

    function updateBombs(s) {
        s.bombs = s.bombs.filter(b => {
            b.y += 4;
            if (b.dx) b.x += b.dx;
            return b.y < s.H && b.x > -10 && b.x < s.W + 10;
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

    function updateCherries(s) {
        s.cherryTimer++;
        if (s.cherryTimer >= s.cherryInterval && s.cherries.length < 3) {
            s.cherryTimer = 0;
            s.cherries.push({ x: 20 + Math.random() * (s.W - 40), y: 28, speed: 1.2 + Math.random() });
        }
        s.cherries = s.cherries.filter(c => { c.y += c.speed; return c.y < s.H + 20; });
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
                    const pts = a.type === 0 ? 30 : a.type === 1 ? 20 : 10;
                    s.score += pts;
                    addPopup(a.x + 15, a.y, `+${pts}`, 'rgb(57,255,20)', 11);
                    s.alienMoveInterval = Math.max(10, s.alienMoveInterval - 0.4);
                    hit = true; break;
                }
            }
            if (hit) continue;

            // vs boss
            if (s.boss && s.boss.hp > 0 && rect(b.x, b.y, 3, 12, s.boss.x, s.boss.y, s.boss.w, s.boss.h)) {
                s.boss.hp--; s.bullets.splice(bi, 1); s.score += 5; hit = true;
            }
            if (hit) continue;

            // vs UFO
            if (s.ufoActive && rect(b.x, b.y, 3, 12, s.ufoX, s.ufoY, 36, 18)) {
                s.ufoActive = false; s.bullets.splice(bi, 1); s.score += 100;
                addPopup(s.ufoX + 18, s.ufoY, '+100', 'rgb(255,68,68)', 14); hit = true;
            }
            if (hit) continue;

            // vs shelters
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
        for (let bi = s.bombs.length - 1; bi >= 0; bi--) {
            const b = s.bombs[bi];
            let hit = false;
            for (const sh of s.shelters) {
                for (let bki = sh.blocks.length - 1; bki >= 0; bki--) {
                    const blk = sh.blocks[bki];
                    const bx2 = sh.x + blk.bc * 6, by2 = sh.y + blk.br * 7;
                    if (rect(b.x, b.y, 4, 10, bx2, by2, 5, 6)) {
                        blk.hp--; if (blk.hp <= 0) sh.blocks.splice(bki, 1);
                        s.bombs.splice(bi, 1); hit = true; break;
                    }
                }
                if (hit) break;
            }
        }

        // Bombs vs player
        if (s.playerInvincible > 0) { s.playerInvincible--; }
        else {
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

        // Cherries vs player
        for (let ci = s.cherries.length - 1; ci >= 0; ci--) {
            const c = s.cherries[ci];
            if (rect(c.x - 10, c.y - 6, 20, 12, p.x, p.y, p.w, p.h)) {
                s.cherries.splice(ci, 1);
                if (s.lives < 4) { s.lives++; addPopup(c.x, c.y, '+1 ЖИВОТ ♥', 'rgb(255,136,204)', 13); }
                else { s.score += 50; addPopup(c.x, c.y, '+50 БОНУС', 'rgb(255,136,204)', 13); }
            }
        }
    }

    // ── GAME LOOP ──────────────────────────────────────────────
    function gameLoop() {
        if (!gameRunning) return;
        update(state);
        draw(state);

        if (state.over || state.won) {
            // Show restart buttons
            const rb = document.getElementById('invaders-restart-btns');
            if (rb && rb.style.display !== 'flex') {
                rb.style.display = 'flex';
                // ТРУДЕН and БОС only visible if unlocked
                document.getElementById('inv-restart-hard').style.display = hardcoreEverUnlocked ? '' : 'none';
                document.getElementById('inv-restart-boss').style.display = hardcoreEverUnlocked ? '' : 'none';
            }

            // Keyboard shortcuts
            if (state.keys[' ']) {
                restartGame('normal');
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
    }

    function startGame(mode) {
        if (!canvas || !ctx) return;
        document.getElementById('invaders-tutorial-modal').style.display = 'none';
        const gameArea = document.getElementById('invaders-game-area');
        gameArea.style.display = 'flex';
        const rb = document.getElementById('invaders-restart-btns');
        if (rb) rb.style.display = 'none';
        state = initState(mode || 'normal');
        gameRunning = true; gamePaused = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        requestAnimationFrame(gameLoop);
    }

    function stopGame() {
        gameRunning = false; gamePaused = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        document.getElementById('invaders-game-area').style.display = 'none';
        const rb = document.getElementById('invaders-restart-btns');
        if (rb) rb.style.display = 'none';
        state = null;
    }

    window.invadersStopGame = stopGame;

    // HTML restart buttons
    document.getElementById('inv-restart-normal').addEventListener('click', () => restartGame('normal'));
    document.getElementById('inv-restart-hard').addEventListener('click', () => restartGame('hardcore'));
    document.getElementById('inv-restart-boss').addEventListener('click', () => restartGame('boss'));

    document.getElementById('invaders-start-btn').addEventListener('click', () => {
        if (hardcoreEverUnlocked) {
            const body = document.querySelector('#invaders-tutorial-modal .modal-content');
            body.innerHTML = `
                <h3 style="color:var(--doom-green);text-shadow:var(--doom-glow);border-bottom:1px dashed var(--doom-green);padding-bottom:10px;text-align:center;">
                    > ИЗБЕРИ РЕЖИМ</h3>
                <div style="text-align:center;margin-top:28px;display:flex;flex-direction:column;gap:14px;align-items:center;">
                    <button id="inv-btn-normal"   style="width:220px;">[ НОРМАЛЕН ]</button>
                    <button id="inv-btn-hardcore" style="width:220px;background:#ffee44;color:#000;">[ ТРУДЕН ]</button>
                    <button id="inv-btn-boss"     style="width:220px;background:#ff4444;color:#000;">[ БОС ФАЙТ ]</button>
                </div>`;
            ['inv-btn-normal', 'inv-btn-hardcore', 'inv-btn-boss'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                Object.assign(el.style, { fontFamily: "'Oswald',sans-serif", fontSize: '1.1rem', fontWeight: 'bold', padding: '10px 20px', border: 'none', cursor: 'pointer', transition: '0.3s' });
            });
            document.getElementById('inv-btn-normal').addEventListener('click', () => startGame('normal'));
            document.getElementById('inv-btn-hardcore').addEventListener('click', () => startGame('hardcore'));
            document.getElementById('inv-btn-boss').addEventListener('click', () => startGame('boss'));
        } else {
            startGame('normal');
        }
    });

    document.getElementById('close-modal').addEventListener('click', () => { if (gameRunning) stopGame(); });

    document.addEventListener('keydown', e => {
        if (!gameRunning) return;
        if (e.key === 'p' || e.key === 'P') { gamePaused = !gamePaused; return; }
        if (e.key === 'Escape') { gamePaused = true; return; }
        if (state) state.keys[e.key] = true;
    });
    document.addEventListener('keyup', e => { if (state) state.keys[e.key] = false; });

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
    bindMobile('inv-fire-btn', () => { if (state) state.mobileFire = true; }, () => { if (state) state.mobileFire = false; });
})();