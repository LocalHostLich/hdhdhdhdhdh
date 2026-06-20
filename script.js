let gameData = {};
let START_DATE, TARGET_DATE;
let currentQIndex = -1;
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

    if (isTBA) {
        document.getElementById('fallout-container').style.display = 'none';
        document.getElementById('coming-soon-container').style.display = 'block';
    } else {
        document.getElementById('coming-soon-container').style.display = 'none';
        document.getElementById('fallout-container').style.display = 'block';
        initFalloutGame(q);
    }

    document.getElementById('question-modal').style.display = 'flex';
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