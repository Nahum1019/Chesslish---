/* =====================================================
   1. ESTADO DEL JUEGO
   Variables que cambian mientras se juega.
   (Las preguntas están en questions.js, en la variable levelsData.)
   ===================================================== */
let gameState = {
    gameMode: 'ai',                                    // 'ai' = contra la IA, 'classroom' = Equipo A vs B
    currentLevelId: 1,
    levelProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },   // victorias por sector
    unlockedLevels: { 1: true, 2: false, 3: false, 4: false, 5: false }
};

let chessGame = null;            // motor de ajedrez (chess.js)
let selectedSquare = null;       // casilla de la pieza elegida
let possibleMoves = [];          // casillas a las que puede ir esa pieza
let currentLevelObj = null;      // sector actual
let questionDeck = [];           // preguntas mezcladas (sin repetir)
let activeQuestion = null;       // pregunta que se muestra ahora
let pendingMove = null;          // jugada que espera la respuesta
let whiteCaptured = [];
let blackCaptured = [];

let streak = 0;                    // aciertos seguidos
let comodines = 0;                 // comodines 50/50 disponibles
let fiftyUsedThisQuestion = false; // evita usar el 50/50 dos veces en la misma pregunta
let answering = false;             // evita responder dos veces la misma pregunta

/* =====================================================
   2. INICIO Y GUARDADO
   ===================================================== */
window.onload = function () {
    loadProgress();
    renderLevelMap();
    updateGlobalWins();
};

// Lee el progreso guardado en el navegador (localStorage)
function loadProgress() {
    const saved = localStorage.getItem('chessEnglishBilingualProgress');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameState.levelProgress = parsed.levelProgress || gameState.levelProgress;
            gameState.unlockedLevels = parsed.unlockedLevels || gameState.unlockedLevels;
        } catch (e) {
            console.error(e);
        }
    }
}

// Guarda el progreso en el navegador
function saveProgress() {
    localStorage.setItem('chessEnglishBilingualProgress', JSON.stringify({
        levelProgress: gameState.levelProgress,
        unlockedLevels: gameState.unlockedLevels
    }));
}

function updateGlobalWins() {
    let total = 0;
    for (let id in gameState.levelProgress) {
        total += gameState.levelProgress[id];
    }
    document.getElementById('globalWinsDisplay').innerText = `${total} / 25`;
}

/* =====================================================
   3. MODO DE JUEGO (IA o Aula)
   ===================================================== */
function setGameMode(mode) {
    gameState.gameMode = mode;
    const aiBtn = document.getElementById('modeAiBtn');
    const classBtn = document.getElementById('modeClassroomBtn');

    if (mode === 'ai') {
        aiBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center bg-neonBlue/20 text-neonBlue border border-neonBlue/40";
        classBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex flex-col items-center";
        document.getElementById('gameModeBadge').innerText = "VS BOT";
    } else {
        classBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center bg-neonPink/20 text-neonPink border border-neonPink/40";
        aiBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex flex-col items-center";
        document.getElementById('gameModeBadge').innerText = "A vs B";
    }
}

/* =====================================================
   4. MAPA DE SECTORES
   ===================================================== */
function renderLevelMap() {
    const container = document.getElementById('levelCardsContainer');
    container.innerHTML = '';

    levelsData.forEach(lvl => {
        const isUnlocked = gameState.unlockedLevels[lvl.id];
        const wins = gameState.levelProgress[lvl.id] || 0;
        const pct = (wins / 5) * 100;

        const card = document.createElement('div');
        card.className = `bg-panelBg border ${isUnlocked ? 'border-slate-700 hover:border-neonBlue cursor-pointer' : 'border-slate-800 opacity-50 cursor-not-allowed'} rounded-2xl p-4 shadow-xl transition-all relative overflow-hidden group`;

        if (isUnlocked) {
            card.onclick = () => startLevel(lvl.id);
        }

        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-orbitron font-bold border ${lvl.badgeColor}">
                    LEVEL ${lvl.id}
                </span>
                ${isUnlocked ?
                    `<span class="text-[10px] font-bold text-neonGreen"><i class="fa-solid fa-unlock mr-1"></i> UNLOCKED / DESBLOQUEADO</span>` :
                    `<span class="text-[10px] font-bold text-slate-500"><i class="fa-solid fa-lock mr-1"></i> LOCKED / BLOQUEADO</span>`
                }
            </div>
            <h3 class="font-orbitron font-bold text-base text-white group-hover:text-neonBlue transition">${lvl.title}</h3>
            <span class="sub-es text-neonGold mb-2 font-semibold">${lvl.titleEs}</span>
            <p class="text-[11px] text-slate-400 mb-3">${lvl.subtitle}</p>

            <div>
                <div class="flex justify-between text-[11px] text-slate-400 mb-1 font-semibold">
                    <span>WINS / VICTORIAS</span>
                    <span class="text-white">${wins} / 5</span>
                </div>
                <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div class="h-full bg-gradient-to-r from-neonPurple to-neonBlue transition-all duration-300" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Cambia entre el mapa de sectores y la partida
function switchView(viewName) {
    const mapSec = document.getElementById('mapView');
    const arenaSec = document.getElementById('arenaView');

    if (viewName === 'map') {
        arenaSec.classList.add('hidden');
        mapSec.classList.remove('hidden');
        renderLevelMap();
        updateGlobalWins();
    } else {
        mapSec.classList.add('hidden');
        arenaSec.classList.remove('hidden');
    }
}

/* =====================================================
   5. INICIAR PARTIDA
   ===================================================== */
function startLevel(levelId) {
    gameState.currentLevelId = levelId;
    currentLevelObj = levelsData.find(l => l.id === levelId);

    questionDeck = [...currentLevelObj.questions];
    fisherYatesShuffle(questionDeck);

    document.getElementById('currentLevelBadge').innerText = `LEVEL ${levelId}`;
    document.getElementById('levelRuleDescription').innerText = `${currentLevelObj.title}: ${currentLevelObj.subtitle}`;
    document.getElementById('levelRuleSub').innerText = `${currentLevelObj.titleEs}: ${currentLevelObj.subtitleEs}`;

    updateMatchProgressUI();

    // Reinicia el tablero y los datos de la partida
    chessGame = new Chess();
    selectedSquare = null;
    possibleMoves = [];
    whiteCaptured = [];
    blackCaptured = [];
    streak = 0;
    comodines = 0;
    answering = false;
    updateCapturedUI();
    updateStreakUI();
    document.getElementById('moveLog').innerHTML = '';

    switchView('arena');
    updateTurnUI();
    renderChessboard();
}

function updateMatchProgressUI() {
    const wins = gameState.levelProgress[gameState.currentLevelId] || 0;
    document.getElementById('matchWinCounter').innerText = `${wins} / 5 Wins`;
    document.getElementById('matchProgressBar').style.width = `${(wins / 5) * 100}%`;
}

// Mezcla un arreglo al azar (algoritmo Fisher-Yates)
function fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/* =====================================================
   6. TABLERO
   ===================================================== */
const pieceSymbols = {
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

// Dibuja las 64 casillas según el estado actual del ajedrez
function renderChessboard() {
    const boardEl = document.getElementById('chessboard');
    boardEl.innerHTML = '';

    const boardState = chessGame.board();                 // matriz 8x8 con las piezas
    const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rankNames = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            // Colores alternados: si la suma de fila y columna es par, casilla clara
            const squareColor = (r + c) % 2 === 0 ? 'light' : 'dark';
            const coord = fileNames[c] + rankNames[r];   // por ejemplo "e2"

            const squareDiv = document.createElement('div');
            squareDiv.className = `square ${squareColor}`;
            squareDiv.dataset.square = coord;

            if (selectedSquare === coord) squareDiv.classList.add('selected');
            if (possibleMoves.includes(coord)) squareDiv.classList.add('highlight');

            const piece = boardState[r][c];
            if (piece) {
                const pieceSpan = document.createElement('span');
                pieceSpan.className = 'chess-piece';
                pieceSpan.style.color = piece.color === 'w' ? '#ffffff' : '#38bdf8';
                pieceSpan.innerText = pieceSymbols[piece.type];
                squareDiv.appendChild(pieceSpan);
            }

            squareDiv.onclick = () => handleSquareClick(coord);
            boardEl.appendChild(squareDiv);
        }
    }
}

// Se ejecuta cada vez que tocan una casilla
function handleSquareClick(coord) {
    const currentTurn = chessGame.turn();                 // 'w' o 'b'

    // En modo IA, el jugador solo mueve las blancas
    if (gameState.gameMode === 'ai' && currentTurn !== 'w') return;

    const piece = chessGame.get(coord);                   // pieza en esa casilla (o null)

    if (selectedSquare === null) {
        // Caso 1: no hay pieza elegida -> elegir una pieza propia
        if (piece && piece.color === currentTurn) {
            selectPiece(coord);
        }
    } else {
        if (selectedSquare === coord) {
            // Caso 2: tocar la misma pieza -> cancelar selección
            clearSelection();
        } else if (piece && piece.color === currentTurn) {
            // Caso 3: tocar otra pieza propia -> cambiar selección
            selectPiece(coord);
        } else if (possibleMoves.includes(coord)) {
            // Caso 4: casilla válida -> preguntar antes de mover
            const move = { from: selectedSquare, to: coord, promotion: 'q' };
            clearSelection();
            triggerTacticalQuestion(move);
        } else {
            // Caso 5: casilla no válida -> cancelar selección
            clearSelection();
        }
    }
}

// Marca una pieza y calcula a dónde puede moverse
function selectPiece(coord) {
    selectedSquare = coord;
    possibleMoves = chessGame.moves({ square: coord, verbose: true }).map(m => m.to);
    renderChessboard();
}

function clearSelection() {
    selectedSquare = null;
    possibleMoves = [];
    renderChessboard();
}

/* =====================================================
   7. PREGUNTA, TRADUCCIÓN Y RESPUESTA
   ===================================================== */

// Separa "Yellow (Amarillo)" en { en: "Yellow", es: "Amarillo" }
function splitOption(opt) {
    const i = opt.indexOf(' (');
    if (i === -1) return { en: opt, es: '' };
    return { en: opt.slice(0, i), es: opt.slice(i + 2, -1) };
}

// Abre el modal con una pregunta (de opciones o de escribir)
function triggerTacticalQuestion(moveObj) {
    pendingMove = moveObj;
    answering = false;

    // Si se acabaron las preguntas, la baraja se vuelve a mezclar
    if (questionDeck.length === 0) {
        questionDeck = [...currentLevelObj.questions];
        fisherYatesShuffle(questionDeck);
    }
    activeQuestion = questionDeck.pop();

    document.getElementById('modalCategoryBadge').innerText = `${currentLevelObj.title} / ${currentLevelObj.titleEs}`;
    document.getElementById('questionText').innerText = activeQuestion.q;

    // Traducción oculta al inicio
    const qSub = document.getElementById('questionSpanishSub');
    qSub.innerText = `💡 ${activeQuestion.qEs}`;
    qSub.classList.add('hidden');
    document.getElementById('toggleTranslateBtn').innerHTML = '💡 Ver traducción';

    // Limpia lo anterior
    const optionsContainer = document.getElementById('optionsContainer');
    const writeArea = document.getElementById('writeArea');
    const fiftyBtn = document.getElementById('fiftyBtn');
    const feedbackBox = document.getElementById('feedbackBox');
    optionsContainer.innerHTML = '';
    feedbackBox.classList.add('hidden');
    feedbackBox.className = 'hidden p-3 rounded-xl text-xs font-bold text-center mb-1';

    if (activeQuestion.mode === 'write') {
        // PREGUNTA DE ESCRIBIR: se muestra la caja de texto y se oculta el 50/50
        optionsContainer.classList.add('hidden');
        fiftyBtn.classList.add('hidden');
        writeArea.classList.remove('hidden');

        const input = document.getElementById('writeInput');
        input.value = '';
        input.disabled = false;
        document.getElementById('writeSubmitBtn').disabled = false;
        setTimeout(() => input.focus(), 100);

    } else {
        // PREGUNTA DE OPCIONES: se crean los botones
        writeArea.classList.add('hidden');
        optionsContainer.classList.remove('hidden');
        fiftyBtn.classList.remove('hidden');

        const shuffledOpts = [...activeQuestion.options];
        fisherYatesShuffle(shuffledOpts);

        shuffledOpts.forEach(opt => {
            const parts = splitOption(opt);

            const btn = document.createElement('button');
            btn.dataset.opt = opt;   // guarda la opción completa (lo usa el 50/50)
            btn.className = 'w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-neonBlue hover:bg-neonBlue/10 text-slate-200 text-xs font-semibold transition flex items-center justify-between group';
            btn.innerHTML = `
                <span>
                    ${parts.en}
                    ${parts.es ? `<span class="es-part hidden text-neonGold font-normal ml-1">(${parts.es})</span>` : ''}
                </span>
                <i class="fa-regular fa-circle text-slate-500 group-hover:text-neonBlue"></i>`;
            btn.onclick = () => selectOption(opt, btn);
            optionsContainer.appendChild(btn);
        });

        fiftyUsedThisQuestion = false;
        updateFiftyButton();
    }

    document.getElementById('questionModal').classList.remove('hidden');
}

// Muestra u oculta la traducción de la pregunta y de las opciones
function toggleTranslation() {
    const qSub = document.getElementById('questionSpanishSub');
    const btn = document.getElementById('toggleTranslateBtn');
    const estaVisible = !qSub.classList.contains('hidden');

    qSub.classList.toggle('hidden', estaVisible);
    document.querySelectorAll('#optionsContainer .es-part').forEach(el => {
        el.classList.toggle('hidden', estaVisible);
    });

    btn.innerHTML = estaVisible ? '💡 Ver traducción' : '🙈 Ocultar traducción';
}

// Al tocar una opción se responde al instante (no hay botón de confirmar)
function selectOption(optText, btnEl) {
    if (answering) return;     // evita doble clic
    answering = true;

    // Bloquea todas las opciones
    Array.from(document.getElementById('optionsContainer').children).forEach(b => b.disabled = true);

    if (optText === activeQuestion.answer) {
        handleCorrect(btnEl);
    } else {
        handleWrong(btnEl);
    }
}

// ACIERTO: la racha sube y la jugada se ejecuta
function handleCorrect(btnEl) {
    if (btnEl) btnEl.classList.add('opt-correct');

    streak++;
    let bonus = '';
    if (streak % 3 === 0) {
        comodines++;
        bonus = ' 🎯 +1 Comodín 50/50!';
    }
    updateStreakUI();

    showFeedback(
        'bg-emerald-950/80 text-neonGreen border border-emerald-800',
        `<i class="fa-solid fa-check-circle mr-1"></i> CORRECT / ¡CORRECTO!${bonus}`,
        'Executing move on board... / Ejecutando movimiento...',
        'text-emerald-300'
    );

    setTimeout(() => {
        document.getElementById('questionModal').classList.add('hidden');
        executeMove(pendingMove);
    }, 900);
}

// ERROR: la racha se reinicia, se muestra la respuesta y pierde el turno
function handleWrong(btnEl) {
    if (btnEl) btnEl.classList.add('opt-wrong');

    // Marca la respuesta correcta en verde para que el niño la vea
    Array.from(document.getElementById('optionsContainer').children).forEach(b => {
        if (b.dataset.opt === activeQuestion.answer) b.classList.add('opt-correct');
    });

    streak = 0;
    updateStreakUI();

    showFeedback(
        'bg-red-950/80 text-red-400 border border-red-800',
        `<i class="fa-solid fa-xmark-circle mr-1"></i> INCORRECT / ¡INCORRECTO!`,
        `Correct answer: <strong>${activeQuestion.answer}</strong>. You lose your turn! / ¡Pierdes el turno!`,
        'text-red-300'
    );

    setTimeout(() => {
        document.getElementById('questionModal').classList.add('hidden');
        pendingMove = null;
        passTurn();
    }, 1800);
}

// Escribe el mensaje de acierto o error en la caja de retroalimentación
function showFeedback(classes, titleHtml, subText, subClass) {
    const box = document.getElementById('feedbackBox');
    box.className = `p-3 rounded-xl text-xs font-bold text-center mb-1 ${classes}`;
    box.innerHTML = `
        <div>${titleHtml}</div>
        <span class="sub-es ${subClass} font-normal">${subText}</span>
    `;
}

// Pronuncia la pregunta en inglés
function speakCurrentQuestion() {
    if ('speechSynthesis' in window && activeQuestion) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(activeQuestion.q);
        utterance.lang = 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
    }
}

// Quita mayúsculas, espacios extra y signos, para comparar mejor
function normalizeText(s) {
    return s.toLowerCase().trim().replace(/[.,!?¡¿]/g, '').replace(/\s+/g, ' ');
}

// Revisa lo que escribió el niño en las preguntas de escribir
function submitWritten() {
    if (answering) return;

    const input = document.getElementById('writeInput');
    if (!input.value.trim()) return;   // no envía si está vacío

    answering = true;
    input.disabled = true;
    document.getElementById('writeSubmitBtn').disabled = true;

    const typed = normalizeText(input.value);
    const accepted = [activeQuestion.answer, ...(activeQuestion.accept || [])].map(normalizeText);

    if (accepted.includes(typed)) {
        handleCorrect(null);   // acierto: se mueve la pieza
    } else {
        handleWrong(null);     // error: pierde el turno
    }
}

/* =====================================================
   8. EJECUTAR JUGADA Y TURNO DE LA IA
   ===================================================== */

// Ejecuta la jugada elegida después de una respuesta correcta
function executeMove(moveObj) {
    // Si la casilla destino tenía una pieza, se captura
    const targetPiece = chessGame.get(moveObj.to);
    if (targetPiece) {
        if (chessGame.turn() === 'w') {
            whiteCaptured.push(pieceSymbols[targetPiece.type]);
        } else {
            blackCaptured.push(pieceSymbols[targetPiece.type]);
        }
        updateCapturedUI();
    }

    const doneMove = chessGame.move(moveObj);   // chess.js valida y mueve
    logMove(doneMove);
    renderChessboard();

    if (chessGame.in_checkmate()) {
        const winner = chessGame.turn() === 'w' ? 'Black / Negras' : 'White / Blancas';
        handleMatchOver(chessGame.turn() === 'b', `CHECKMATE! ${winner} won the game!`);
        return;
    }
    if (chessGame.in_draw()) {
        handleMatchOver(false, "DRAW / EMPATE: Game ended in a draw.");
        return;
    }

    updateTurnUI();

    // En modo IA, después de tu jugada juega la IA
    if (gameState.gameMode === 'ai' && chessGame.turn() === 'b') {
        setTimeout(makeAIMove, 750);
    }
}

// Pasa el turno sin mover piezas (cuando el jugador falla)
function passTurn() {
    selectedSquare = null;
    possibleMoves = [];

    // FEN: texto que describe el tablero y de quién es el turno.
    // Cambiamos solo el turno (posición 2) y quitamos la captura al paso (posición 4).
    const parts = chessGame.fen().split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    chessGame.load(parts.join(' '));

    renderChessboard();
    updateTurnUI();

    // En modo IA, si ahora le toca a la IA, ella juega sola
    if (gameState.gameMode === 'ai' && chessGame.turn() === 'b') {
        setTimeout(makeAIMove, 750);
    }
}

// Jugada de la IA (en sectores altos prefiere capturar)
function makeAIMove() {
    if (chessGame.game_over()) return;

    const moves = chessGame.moves({ verbose: true });
    if (moves.length === 0) return;

    // Valor de cada pieza (para decidir si una captura conviene)
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

    let bestMove = null;
    let bestScore = -Infinity;

    moves.forEach(m => {
        // Pequeño azar para que la IA no siempre juegue igual
        let score = Math.random() * 0.5;

        // Capturar suma puntos según el valor de la pieza comida
        if (m.captured) score += values[m.captured] * 10;

        // Probamos la jugada para revisar qué pasa después
        chessGame.move(m);

        if (chessGame.in_checkmate()) score += 1000;   // jaque mate: prioridad máxima

        // Si el rival puede comer la pieza en su nueva casilla, se resta puntos
        const rivalMoves = chessGame.moves({ verbose: true });
        if (rivalMoves.some(r => r.to === m.to)) {
            score -= values[m.piece] * 5;
        }

        chessGame.undo();   // deshace la prueba para no alterar el tablero

        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
    });

    // Ejecuta la mejor jugada encontrada
    const targetPiece = chessGame.get(bestMove.to);
    if (targetPiece) {
        blackCaptured.push(pieceSymbols[targetPiece.type]);
        updateCapturedUI();
    }

    const doneAI = chessGame.move(bestMove);
    logMove(doneAI);
    renderChessboard();

    if (chessGame.in_checkmate()) {
        handleMatchOver(false, "CHECKMATE! The AI defeated you. / La IA ganó la partida.");
        return;
    }

    updateTurnUI();
}

function updateTurnUI() {
    const turn = chessGame.turn();
    const titleEl = document.getElementById('turnTitle');
    const subEl = document.getElementById('turnSubTitle');
    const dotEl = document.getElementById('turnIndicatorDot');

    if (turn === 'w') {
        titleEl.innerText = "WHITE'S TURN";
        subEl.innerText = "Turno de las Blancas (Equipo A)";
        dotEl.className = "w-3 h-3 rounded-full bg-neonGreen animate-pulse";
    } else {
        titleEl.innerText = "BLACK'S TURN";
        subEl.innerText = gameState.gameMode === 'ai' ? "Turno de la IA" : "Turno de las Negras (Equipo B)";
        dotEl.className = "w-3 h-3 rounded-full bg-neonBlue animate-pulse";
    }
}

function updateCapturedUI() {
    document.getElementById('whiteCapturedText').innerText = `Captured by White: ${whiteCaptured.join(' ') || 'None'}`;
    document.getElementById('blackCapturedText').innerText = `Captured by Black: ${blackCaptured.join(' ') || 'None'}`;
}

/* =====================================================
   9. BITÁCORA BILINGÜE DE JUGADAS
   ===================================================== */
const pieceNameEN = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
const pieceNameES = { p: 'el peón', r: 'la torre', n: 'el caballo', b: 'el alfil', q: 'la dama', k: 'el rey' };
const pieceObjES  = { p: 'al peón', r: 'a la torre', n: 'al caballo', b: 'al alfil', q: 'a la dama', k: 'al rey' };

// Escribe la jugada en inglés y español, y la pronuncia
function logMove(move) {
    if (!move) return;

    const sideEN = move.color === 'w' ? 'White' : 'Black';
    const sideES = move.color === 'w' ? 'Blancas' : 'Negras';
    let en, es;

    if (move.flags.includes('k') || move.flags.includes('q')) {
        en = `${sideEN} castles.`;
        es = `Enroque de las ${sideES}.`;
    } else if (move.captured) {
        en = `${sideEN}'s ${pieceNameEN[move.piece]} takes ${pieceNameEN[move.captured]} on ${move.to}.`;
        es = `${pieceNameES[move.piece]} de las ${sideES} captura ${pieceObjES[move.captured]} en ${move.to}.`;
    } else {
        en = `${sideEN}'s ${pieceNameEN[move.piece]} moves to ${move.to}.`;
        es = `${pieceNameES[move.piece]} de las ${sideES} se mueve a ${move.to}.`;
    }

    if (move.san.includes('#')) {
        en += ' Checkmate!';
        es += ' ¡Jaque mate!';
    } else if (move.san.includes('+')) {
        en += ' Check!';
        es += ' ¡Jaque!';
    }

    const log = document.getElementById('moveLog');
    const li = document.createElement('li');
    li.className = 'bg-slate-900/80 border border-slate-800 rounded-lg p-2';
    li.innerHTML = `<span class="block text-white font-semibold">${en}</span>
                    <span class="sub-es text-[10px]">${es}</span>`;
    log.prepend(li);

    // Guarda solo las últimas 10 jugadas
    while (log.children.length > 10) {
        log.removeChild(log.lastChild);
    }

    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(en);
        u.lang = 'en-US';
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
    }
}

/* =====================================================
   10. RACHA Y COMODÍN 50/50
   ===================================================== */
function updateStreakUI() {
    document.getElementById('streakText').innerText = `🔥 Racha: ${streak} · 🎯 Comodines: ${comodines}`;
}

function updateFiftyButton() {
    const btn = document.getElementById('fiftyBtn');
    btn.disabled = comodines === 0 || fiftyUsedThisQuestion;
    btn.innerHTML = `🎯 Comodín 50/50 (${comodines})`;
}

// Quita 2 opciones incorrectas
function useFifty() {
    if (comodines === 0 || fiftyUsedThisQuestion || answering) return;

    comodines--;
    fiftyUsedThisQuestion = true;

    const wrongButtons = Array.from(document.querySelectorAll('#optionsContainer button'))
        .filter(b => b.dataset.opt !== activeQuestion.answer && !b.disabled);

    fisherYatesShuffle(wrongButtons);

    wrongButtons.slice(0, 2).forEach(b => {
        b.disabled = true;
        b.classList.add('opacity-20', 'line-through');
    });

    updateStreakUI();
    updateFiftyButton();
}

/* =====================================================
   11. FIN DE PARTIDA Y PROGRESO
   ===================================================== */
function handleMatchOver(isWin, msg) {
    const modal = document.getElementById('resultModal');
    const iconEl = document.getElementById('resultIcon');
    const titleEl = document.getElementById('resultTitle');
    const subEl = document.getElementById('resultSub');
    const msgEl = document.getElementById('resultMessage');
    const primaryBtn = document.getElementById('resultPrimaryBtn');

    if (isWin) {
        iconEl.className = 'w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-3xl shadow-lg bg-neonGreen/20 text-neonGreen border border-neonGreen/40';
        titleEl.innerText = "TACTICAL VICTORY!";
        subEl.innerText = "¡VICTORIA TÁCTICA!";
        msgEl.innerText = msg;

        if (gameState.levelProgress[gameState.currentLevelId] < 5) {
            gameState.levelProgress[gameState.currentLevelId]++;

            // Al ganar 5 partidas se desbloquea el siguiente sector
            if (gameState.levelProgress[gameState.currentLevelId] === 5 && gameState.currentLevelId < 5) {
                gameState.unlockedLevels[gameState.currentLevelId + 1] = true;
                msgEl.innerText += ` 🎉 Sector ${gameState.currentLevelId + 1} UNLOCKED / DESBLOQUEADO!`;
            }
            saveProgress();
        }

        primaryBtn.innerHTML = `<span>NEXT MATCH</span><span class="sub-es text-[9px] text-white/90">Siguiente Partida</span>`;
    } else {
        iconEl.className = 'w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-3xl shadow-lg bg-red-950/50 text-red-400 border border-red-800';
        titleEl.innerText = "DEFEAT / DERROTA";
        subEl.innerText = "Fin de la partida";
        msgEl.innerText = msg;

        primaryBtn.innerHTML = `<span>TRY AGAIN</span><span class="sub-es text-[9px] text-white/90">Reintentar</span>`;
    }

    modal.classList.remove('hidden');
}

// Botón de resultados: vuelve a jugar el mismo sector
function nextMatchAction() {
    closeResultModal();
    startLevel(gameState.currentLevelId);
}

function closeResultModal() {
    document.getElementById('resultModal').classList.add('hidden');
}

function closeResultModalToMap() {
    document.getElementById('resultModal').classList.add('hidden');
    switchView('map');
}

/* =====================================================
   12. BOTONES GENERALES
   ===================================================== */
function restartMatch() {
    if (confirm("Restart this match? / ¿Reiniciar esta partida?")) {
        startLevel(gameState.currentLevelId);
    }
}

function surrenderMatch() {
    if (confirm("Surrender match? / ¿Rendirse de la partida?")) {
        handleMatchOver(false, "You surrendered the match. / Te has rendido.");
    }
}

function resetProgressConfirm() {
    if (confirm("Reset all game progress? / ¿Reiniciar todo el progreso de juego?")) {
        localStorage.removeItem('chessEnglishBilingualProgress');
        gameState.levelProgress = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        gameState.unlockedLevels = { 1: true, 2: false, 3: false, 4: false, 5: false };
        renderLevelMap();
        updateGlobalWins();
    }
}

function openRulesModal() {
    document.getElementById('rulesModal').classList.remove('hidden');
}

function closeRulesModal() {
    document.getElementById('rulesModal').classList.add('hidden');
}