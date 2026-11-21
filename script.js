const boardEl = document.getElementById('board');
const statusText = document.getElementById('status');
const gameModeSelect = document.getElementById('gameMode');
const boardSizeSelect = document.getElementById('boardSize');
const difficultySelect = document.getElementById('difficulty');
const player1Input = document.getElementById('player1Name');
const player2Input = document.getElementById('player2Name');
const player1SymbolSelect = document.getElementById('player1Symbol');
const labelP1 = document.getElementById('labelP1');
const labelP2 = document.getElementById('labelP2');
const soundToggleBtn = document.getElementById('soundToggle');
const themeToggleBtn = document.getElementById('themeToggle');
const moveLogEl = document.getElementById('moveLog');
const matchHistoryEl = document.getElementById('matchHistory');
const ruleHintEl = document.getElementById('ruleHint');

const STORAGE_KEYS = {
    theme: "ttt_theme_v1",
    sound: "ttt_sound_v1",
    scores: "ttt_scores_v1",
    streaks: "ttt_streaks_v1",
    history: "ttt_history_v1",
    round: "ttt_round_v1"
};

let gridSize = 3;
let board = [];
let cells = [];
let winConditions = [];
let currentSymbol = "X"; // X always starts first
let gameActive = true;
let isAiThinking = false;
let soundEnabled = true;
let moveCount = 0;
let roundNumber = 1;
let scores = { P1: 0, P2: 0, Draw: 0 };
let streaks = { P1: 0, P2: 0 };
let pastRounds = [];

// LocalStorage Helpers
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        // Ignore storage quota/private mode errors
    }
}

function loadFromStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
        return fallback;
    }
}

function applyThemeUI(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggleBtn.textContent = theme === "light" ? "Dark Mode" : "Light Mode";
}

function applySoundUI() {
    soundToggleBtn.textContent = soundEnabled ? "Sound: ON" : "Sound: OFF";
}

function renderMatchHistory() {
    if (!pastRounds.length) {
        matchHistoryEl.innerHTML = `<li class="empty-msg">No rounds played yet</li>`;
        return;
    }
    matchHistoryEl.innerHTML = "";
    pastRounds.forEach(entry => {
        const li = document.createElement('li');
        li.textContent = entry;
        matchHistoryEl.appendChild(li);
    });
}

function loadSavedPreferences() {
    const savedTheme = loadFromStorage(STORAGE_KEYS.theme, "dark");
    applyThemeUI(savedTheme === "light" ? "light" : "dark");

    soundEnabled = Boolean(loadFromStorage(STORAGE_KEYS.sound, true));
    applySoundUI();

    const savedScores = loadFromStorage(STORAGE_KEYS.scores, null);
    if (savedScores && typeof savedScores.P1 === "number") {
        scores = {
            P1: savedScores.P1,
            P2: savedScores.P2,
            Draw: savedScores.Draw
        };
    }

    const savedStreaks = loadFromStorage(STORAGE_KEYS.streaks, null);
    if (savedStreaks && typeof savedStreaks.P1 === "number") {
        streaks = {
            P1: savedStreaks.P1,
            P2: savedStreaks.P2
        };
    }

    const savedHistory = loadFromStorage(STORAGE_KEYS.history, []);
    if (Array.isArray(savedHistory)) {
        pastRounds = savedHistory;
    }

    const savedRound = Number(loadFromStorage(STORAGE_KEYS.round, 1));
    roundNumber = Number.isFinite(savedRound) && savedRound > 0 ? savedRound : 1;

    renderMatchHistory();
}

// Board Size & Winning Conditions Builder
function generateWinConditions(size) {
    const lines = [];

    for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) {
            row.push(r * size + c);
        }
        lines.push(row);
    }

    for (let c = 0; c < size; c++) {
        const col = [];
        for (let r = 0; r < size; r++) {
            col.push(r * size + c);
        }
        lines.push(col);
    }

    const diag1 = [];
    for (let i = 0; i < size; i++) {
        diag1.push(i * size + i);
    }
    lines.push(diag1);

    const diag2 = [];
    for (let i = 0; i < size; i++) {
        diag2.push(i * size + (size - 1 - i));
    }
    lines.push(diag2);

    return lines;
}

function getCoordLabel(index, size) {
    const row = Math.floor(index / size) + 1;
    const col = (index % size) + 1;
    return `R${row}, C${col}`;
}

function buildBoardGrid(size) {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--grid-size", size);
    boardEl.classList.toggle("board-4x4", size === 4);

    const totalCells = size * size;
    board = Array(totalCells).fill("");
    cells = [];

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("data-index", i);
        cell.addEventListener("click", handleCellClick);
        boardEl.appendChild(cell);
        cells.push(cell);
    }

    winConditions = generateWinConditions(size);
    ruleHintEl.textContent = `X always goes first. Align ${size} in a row, column, or diagonal to win.`;
}

// Web Audio API Sound Synthesizer
let audioCtx = null;

function playTone(freq, duration, type = "sine", delay = 0, gainPeak = 0.14) {
    if (!soundEnabled) return;

    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const startTime = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
}

function playMoveSound(symbol) {
    if (symbol === "X") {
        playTone(520, 0.11, "triangle", 0, 0.15);
    } else {
        playTone(390, 0.12, "sine", 0, 0.15);
    }
}

function playWinSound() {
    playTone(523.25, 0.14, "triangle", 0, 0.16);
    playTone(659.25, 0.14, "triangle", 0.12, 0.16);
    playTone(783.99, 0.28, "triangle", 0.24, 0.18);
}

function playDrawSound() {
    playTone(330, 0.16, "sawtooth", 0, 0.08);
    playTone(277.18, 0.22, "sawtooth", 0.15, 0.08);
}

function playClickSound() {
    playTone(680, 0.06, "sine", 0, 0.09);
}

// Theme & Sound Controls
function toggleTheme() {
    playClickSound();
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    applyThemeUI(nextTheme);
    saveToStorage(STORAGE_KEYS.theme, nextTheme);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    applySoundUI();
    saveToStorage(STORAGE_KEYS.sound, soundEnabled);
    if (soundEnabled) playClickSound();
}

// Player Names & Symbol Helpers
function getPlayer1Name() {
    return player1Input.value.trim() || "Player 1";
}

function getPlayer2Name() {
    if (gameModeSelect.value === "ai") return "Computer";
    return player2Input.value.trim() || "Player 2";
}

function getP1Symbol() {
    return player1SymbolSelect.value;
}

function getP2Symbol() {
    return getP1Symbol() === "X" ? "O" : "X";
}

function getNameBySymbol(symbol) {
    return symbol === getP1Symbol() ? getPlayer1Name() : getPlayer2Name();
}

function updatePlayerLabels() {
    const p1Sym = getP1Symbol();
    const p2Sym = getP2Symbol();

    labelP1.className = `score-box ${p1Sym === "X" ? "x-color" : "o-color"}`;
    labelP2.className = `score-box ${p2Sym === "X" ? "x-color" : "o-color"}`;

    labelP1.innerHTML = `
        ${getPlayer1Name()} (${p1Sym})
        <span id="scoreP1">${scores.P1}</span>
        <small class="streak-tag" id="streakP1">Streak: ${streaks.P1}</small>
    `;

    labelP2.innerHTML = `
        ${getPlayer2Name()} (${p2Sym})
        <span id="scoreP2">${scores.P2}</span>
        <small class="streak-tag" id="streakP2">Streak: ${streaks.P2}</small>
    `;

    const drawEl = document.getElementById("scoreDraw");
    if (drawEl) drawEl.textContent = scores.Draw;

    if (gameActive) {
        updateTurnStatus();
    }
}

function updateTurnStatus() {
    const activeName = getNameBySymbol(currentSymbol);
    if (gameModeSelect.value === "ai" && currentSymbol === getP2Symbol()) {
        statusText.textContent = `${activeName}'s Turn (${currentSymbol})...`;
    } else {
        statusText.textContent = `${activeName}'s Turn (${currentSymbol})`;
    }
}

function handleModeChange() {
    playClickSound();
    const isAiMode = gameModeSelect.value === "ai";
    difficultySelect.disabled = !isAiMode;
    player2Input.disabled = isAiMode;
    player2Input.value = isAiMode ? "Computer" : "Player 2";
    resetGame(false);
}

function handleBoardSizeChange() {
    playClickSound();
    gridSize = Number(boardSizeSelect.value) === 4 ? 4 : 3;
    resetGame(false);
}

function handleSymbolChange() {
    playClickSound();
    resetGame(false);
}

function handleCellClick(e) {
    const index = Number(e.target.getAttribute('data-index'));
    const aiSymbol = getP2Symbol();

    if (board[index] !== "" || !gameActive || isAiThinking) return;
    if (gameModeSelect.value === "ai" && currentSymbol === aiSymbol) return;

    makeMove(index, currentSymbol);

    if (gameActive && gameModeSelect.value === "ai" && currentSymbol === aiSymbol) {
        triggerAiTurn();
    }
}

function triggerAiTurn() {
    isAiThinking = true;
    setTimeout(() => {
        aiMove();
        isAiThinking = false;
    }, 360);
}

function makeMove(index, symbol) {
    board[index] = symbol;
    moveCount++;

    const cell = cells[index];
    cell.textContent = symbol;
    cell.classList.add('taken', symbol === "X" ? 'x-color' : 'o-color');

    addMoveToLog(moveCount, getNameBySymbol(symbol), symbol, index);
    playMoveSound(symbol);
    checkResult();
}

// Move Log & Match History Functions
function addMoveToLog(step, playerName, symbol, index) {
    if (moveLogEl.querySelector('.empty-msg')) {
        moveLogEl.innerHTML = "";
    }
    const li = document.createElement('li');
    li.textContent = `#${step} ${playerName} (${symbol}) → ${getCoordLabel(index, gridSize)}`;
    moveLogEl.prepend(li);
}

function addMatchToHistory(resultText) {
    const entry = `Round ${roundNumber} [${gridSize}x${gridSize}]: ${resultText}`;
    pastRounds.unshift(entry);
    roundNumber++;
    saveToStorage(STORAGE_KEYS.history, pastRounds);
    saveToStorage(STORAGE_KEYS.round, roundNumber);
    renderMatchHistory();
}

function clearHistory() {
    playClickSound();
    pastRounds = [];
    roundNumber = 1;
    saveToStorage(STORAGE_KEYS.history, pastRounds);
    saveToStorage(STORAGE_KEYS.round, roundNumber);
    renderMatchHistory();
}

function getWinner(currentBoard, lines = winConditions) {
    for (let condition of lines) {
        const first = currentBoard[condition[0]];
        if (first !== "" && condition.every(idx => currentBoard[idx] === first)) {
            return { winner: first, line: condition };
        }
    }
    if (!currentBoard.includes("")) {
        return { winner: "Draw", line: [] };
    }
    return null;
}

function checkResult() {
    const outcome = getWinner(board);

    if (outcome && outcome.winner !== "Draw") {
        const winnerName = getNameBySymbol(outcome.winner);
        statusText.textContent = `${winnerName} (${outcome.winner}) Wins!`;
        gameActive = false;
        outcome.line.forEach(idx => cells[idx].classList.add('win'));

        if (outcome.winner === getP1Symbol()) {
            scores.P1++;
            streaks.P1++;
            streaks.P2 = 0;
        } else {
            scores.P2++;
            streaks.P2++;
            streaks.P1 = 0;
        }

        saveToStorage(STORAGE_KEYS.scores, scores);
        saveToStorage(STORAGE_KEYS.streaks, streaks);
        updatePlayerLabels();
        addMatchToHistory(`${winnerName} won in ${moveCount} moves`);
        playWinSound();
        return;
    }

    if (outcome && outcome.winner === "Draw") {
        statusText.textContent = "It's a Draw!";
        gameActive = false;
        scores.Draw++;
        saveToStorage(STORAGE_KEYS.scores, scores);
        updatePlayerLabels();
        addMatchToHistory(`Draw (${getPlayer1Name()} vs ${getPlayer2Name()})`);
        playDrawSound();
        return;
    }

    currentSymbol = currentSymbol === "X" ? "O" : "X";
    updateTurnStatus();
}

// AI Tactical & Difficulty Helpers
function findImmediateMove(tempBoard, symbol, emptyIndices) {
    for (let idx of emptyIndices) {
        tempBoard[idx] = symbol;
        const result = getWinner(tempBoard);
        tempBoard[idx] = "";
        if (result && result.winner === symbol) {
            return idx;
        }
    }
    return null;
}

function scoreBoardHeuristic(tempBoard, aiSymbol, humanSymbol) {
    let score = 0;
    for (let line of winConditions) {
        let aiCount = 0;
        let humanCount = 0;
        for (let idx of line) {
            if (tempBoard[idx] === aiSymbol) aiCount++;
            else if (tempBoard[idx] === humanSymbol) humanCount++;
        }
        if (aiCount > 0 && humanCount === 0) {
            score += Math.pow(10, aiCount);
        } else if (humanCount > 0 && aiCount === 0) {
            score -= Math.pow(12, humanCount);
        }
    }
    return score;
}

function aiMove() {
    if (!gameActive) return;

    const aiSymbol = getP2Symbol();
    const humanSymbol = getP1Symbol();
    const level = difficultySelect.value;

    const emptyIndices = board
        .map((val, idx) => (val === "" ? idx : null))
        .filter(val => val !== null);

    if (emptyIndices.length === 0) return;

    if (level === "easy") {
        const randomMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(randomMove, aiSymbol);
        return;
    }

    if (level === "medium") {
        const winMove = findImmediateMove(board, aiSymbol, emptyIndices);
        if (winMove !== null) {
            makeMove(winMove, aiSymbol);
            return;
        }

        const blockMove = findImmediateMove(board, humanSymbol, emptyIndices);
        if (blockMove !== null) {
            makeMove(blockMove, aiSymbol);
            return;
        }

        const randomMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(randomMove, aiSymbol);
        return;
    }

    const maxDepth = gridSize === 3 ? Infinity : 4;
    let bestScore = -Infinity;
    let bestMove = emptyIndices[0];

    for (let idx of emptyIndices) {
        board[idx] = aiSymbol;
        const score = minimax(board, 0, false, aiSymbol, humanSymbol, maxDepth);
        board[idx] = "";

        if (score > bestScore) {
            bestScore = score;
            bestMove = idx;
        }
    }

    makeMove(bestMove, aiSymbol);
}

function minimax(tempBoard, depth, isMaximizing, aiSymbol, humanSymbol, maxDepth) {
    const result = getWinner(tempBoard);
    if (result) {
        if (result.winner === aiSymbol) return 100 - depth;
        if (result.winner === humanSymbol) return depth - 10;
        return 0;
    }

    if (depth >= maxDepth) {
        return scoreBoardHeuristic(tempBoard, aiSymbol, humanSymbol);
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < tempBoard.length; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = aiSymbol;
                bestScore = Math.max(bestScore, minimax(tempBoard, depth + 1, false, aiSymbol, humanSymbol, maxDepth));
                tempBoard[i] = "";
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < tempBoard.length; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = humanSymbol;
                bestScore = Math.min(bestScore, minimax(tempBoard, depth + 1, true, aiSymbol, humanSymbol, maxDepth));
                tempBoard[i] = "";
            }
        }
        return bestScore;
    }
}

function resetGame(resetScores) {
    playClickSound();

    buildBoardGrid(gridSize);
    currentSymbol = "X";
    gameActive = true;
    isAiThinking = false;
    moveCount = 0;
    moveLogEl.innerHTML = `<li class="empty-msg">No moves yet</li>`;

    if (resetScores) {
        scores = { P1: 0, P2: 0, Draw: 0 };
        streaks = { P1: 0, P2: 0 };
        saveToStorage(STORAGE_KEYS.scores, scores);
        saveToStorage(STORAGE_KEYS.streaks, streaks);
    }

    updatePlayerLabels();

    if (gameModeSelect.value === "ai" && getP1Symbol() === "O") {
        triggerAiTurn();
    }
}

// Initialize on load
loadSavedPreferences();
buildBoardGrid(gridSize);
updatePlayerLabels();