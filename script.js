const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const gameModeSelect = document.getElementById('gameMode');
const difficultySelect = document.getElementById('difficulty');
const player1Input = document.getElementById('player1Name');
const player2Input = document.getElementById('player2Name');
const player1SymbolSelect = document.getElementById('player1Symbol');
const labelP1 = document.getElementById('labelP1');
const labelP2 = document.getElementById('labelP2');
const scoreDrawEl = document.getElementById('scoreDraw');
const soundToggleBtn = document.getElementById('soundToggle');
const themeToggleBtn = document.getElementById('themeToggle');
const moveLogEl = document.getElementById('moveLog');
const matchHistoryEl = document.getElementById('matchHistory');

let board = ["", "", "", "", "", "", "", "", ""];
let currentSymbol = "X"; // X always starts first
let gameActive = true;
let isAiThinking = false;
let soundEnabled = true;
let moveCount = 0;
let roundNumber = 1;
let scores = { P1: 0, P2: 0, Draw: 0 };

const cellCoords = [
    "R1, C1", "R1, C2", "R1, C3",
    "R2, C1", "R2, C2", "R2, C3",
    "R3, C1", "R3, C2", "R3, C3"
];

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
    const html = document.documentElement;
    const isLight = html.getAttribute("data-theme") === "light";
    const nextTheme = isLight ? "dark" : "light";

    html.setAttribute("data-theme", nextTheme);
    themeToggleBtn.textContent = nextTheme === "light" ? "Dark Mode" : "Light Mode";
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? "Sound: ON" : "Sound: OFF";
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

    labelP1.innerHTML = `${getPlayer1Name()} (${p1Sym}) <span id="scoreP1">${scores.P1}</span>`;
    labelP2.innerHTML = `${getPlayer2Name()} (${p2Sym}) <span id="scoreP2">${scores.P2}</span>`;
    scoreDrawEl.textContent = scores.Draw;

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

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

cells.forEach(cell => cell.addEventListener('click', handleCellClick));

function handleModeChange() {
    playClickSound();
    const isAiMode = gameModeSelect.value === "ai";
    difficultySelect.disabled = !isAiMode;
    player2Input.disabled = isAiMode;
    player2Input.value = isAiMode ? "Computer" : "Player 2";
    resetGame(true);
}

function handleSymbolChange() {
    playClickSound();
    resetGame(true);
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
    }, 380);
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
    li.textContent = `#${step} ${playerName} (${symbol}) → ${cellCoords[index]}`;
    moveLogEl.prepend(li);
}

function addMatchToHistory(resultText) {
    if (matchHistoryEl.querySelector('.empty-msg')) {
        matchHistoryEl.innerHTML = "";
    }
    const li = document.createElement('li');
    li.textContent = `Round ${roundNumber}: ${resultText}`;
    matchHistoryEl.prepend(li);
    roundNumber++;
}

function clearHistory() {
    playClickSound();
    matchHistoryEl.innerHTML = `<li class="empty-msg">No rounds played yet</li>`;
    roundNumber = 1;
}

function getWinner(currentBoard) {
    for (let condition of winConditions) {
        const [a, b, c] = condition;
        if (
            currentBoard[a] !== "" &&
            currentBoard[a] === currentBoard[b] &&
            currentBoard[a] === currentBoard[c]
        ) {
            return { winner: currentBoard[a], line: condition };
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
        } else {
            scores.P2++;
        }
        updatePlayerLabels();
        addMatchToHistory(`${winnerName} won in ${moveCount} moves`);
        playWinSound();
        return;
    }

    if (outcome && outcome.winner === "Draw") {
        statusText.textContent = "It's a Draw!";
        gameActive = false;
        scores.Draw++;
        updatePlayerLabels();
        addMatchToHistory(`Draw (${getPlayer1Name()} vs ${getPlayer2Name()})`);
        playDrawSound();
        return;
    }

    currentSymbol = currentSymbol === "X" ? "O" : "X";
    updateTurnStatus();
}

// AI Logic (Easy vs Hard Minimax)
function aiMove() {
    if (!gameActive) return;

    const aiSymbol = getP2Symbol();
    const humanSymbol = getP1Symbol();

    const emptyIndices = board
        .map((val, idx) => (val === "" ? idx : null))
        .filter(val => val !== null);

    if (emptyIndices.length === 0) return;

    if (difficultySelect.value === "easy") {
        const randomMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(randomMove, aiSymbol);
        return;
    }

    // Hard AI using Minimax
    let bestScore = -Infinity;
    let bestMove = emptyIndices[0];

    for (let idx of emptyIndices) {
        board[idx] = aiSymbol;
        const score = minimax(board, 0, false, aiSymbol, humanSymbol);
        board[idx] = "";

        if (score > bestScore) {
            bestScore = score;
            bestMove = idx;
        }
    }

    makeMove(bestMove, aiSymbol);
}

function minimax(tempBoard, depth, isMaximizing, aiSymbol, humanSymbol) {
    const result = getWinner(tempBoard);
    if (result) {
        if (result.winner === aiSymbol) return 10 - depth;
        if (result.winner === humanSymbol) return depth - 10;
        return 0;
    }

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = aiSymbol;
                bestScore = Math.max(bestScore, minimax(tempBoard, depth + 1, false, aiSymbol, humanSymbol));
                tempBoard[i] = "";
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (tempBoard[i] === "") {
                tempBoard[i] = humanSymbol;
                bestScore = Math.min(bestScore, minimax(tempBoard, depth + 1, true, aiSymbol, humanSymbol));
                tempBoard[i] = "";
            }
        }
        return bestScore;
    }
}

function resetGame(resetScores) {
    if (!resetScores) playClickSound();

    board = ["", "", "", "", "", "", "", "", ""];
    currentSymbol = "X";
    gameActive = true;
    isAiThinking = false;
    moveCount = 0;
    moveLogEl.innerHTML = `<li class="empty-msg">No moves yet</li>`;

    cells.forEach(cell => {
        cell.textContent = "";
        cell.className = "cell";
    });

    if (resetScores) {
        scores = { P1: 0, P2: 0, Draw: 0 };
    }

    updatePlayerLabels();

    // If playing vs AI and Player 1 chose O, AI (X) makes the first move
    if (gameModeSelect.value === "ai" && getP1Symbol() === "O") {
        triggerAiTurn();
    }
}

// Initialize labels on load
updatePlayerLabels();