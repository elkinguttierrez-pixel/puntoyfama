/**
 * Controlador principal de la aplicación Punto y Fama.
 * Gestiona estados de juego, entrada dual, cronómetro, historial dinámico,
 * cambio de turnos multi-usuario, alertas animadas, audio y confeti.
 */

(function () {
  'use strict';

  // Dependencias globales
  const Engine = window.PuntoYFamaEngine;
  const Sounds = window.SoundEffects;
  const Users = window.UserManager;

  if (!Engine || !Sounds || !Users) {
    console.error('Dependencias no cargadas correctamente.');
    return;
  }

  // ==========================================
  // ESTADO GLOBAL DE LA APLICACIÓN
  // ==========================================
  const state = {
    // Modo de juego: 'solo' (vs máquina) | 'duel' (2 jugadores pass & play)
    gameMode: 'solo',
    // Reglas: sin repetición (false) | con repetición (true)
    allowDuplicates: false,
    // Longitud del código (3, 4 o 5 cifras; por defecto 4)
    codeLength: 4,

    // Códigos secretos
    secretCodeSolo: '',
    secretCodeDuelP1: '',
    secretCodeDuelP2: '',

    // Duelo de 2 jugadores: 0 = Jugador 1, 1 = Jugador 2
    duelActivePlayerIndex: 0,
    duelViewingPlayerIndex: 0,
    duelPlayer1: null,
    duelPlayer2: null,

    // Historiales separados para 1 jugador o duelo
    historySolo: [],
    historyDuelP1: [],
    historyDuelP2: [],

    // Entrada actual
    currentDigits: [],
    activeSlotIndex: 0,

    // Cronómetro
    timerInterval: null,
    timerStartTime: null,
    elapsedSeconds: 0,
    isTimerRunning: false,

    // Estado de partida: 'idle' | 'playing' | 'won' | 'revealed'
    gameStatus: 'idle',

    // Registro de ganador en duelo
    duelWinner: null
  };

  // ==========================================
  // REFERENCIAS AL DOM
  // ==========================================
  const dom = {
    // Cronómetro y controles superiores
    timerDisplay: document.getElementById('timer-display'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundIconOn: document.getElementById('sound-icon-on'),
    soundIconOff: document.getElementById('sound-icon-off'),
    btnRules: document.getElementById('btn-rules'),
    btnLeaderboard: document.getElementById('btn-leaderboard'),
    btnNewGame: document.getElementById('btn-new-game'),
    btnSurrender: document.getElementById('btn-surrender'),

    // Perfil activo en barra superior
    activeUserPill: document.getElementById('active-user-pill'),
    activeUserName: document.getElementById('active-user-name'),
    activeUserAvatar: document.getElementById('active-user-avatar'),

    // Selectores de modo y reglas
    modeSoloBtn: document.getElementById('mode-solo-btn'),
    modeDuelBtn: document.getElementById('mode-duel-btn'),
    ruleClassicBtn: document.getElementById('rule-classic-btn'),
    ruleDuplicatesBtn: document.getElementById('rule-duplicates-btn'),
    lengthSelect: document.getElementById('code-length-select'),

    // Banner de duelo
    duelBanner: document.getElementById('duel-banner'),
    duelP1Card: document.getElementById('duel-p1-card'),
    duelP2Card: document.getElementById('duel-p2-card'),
    duelTurnText: document.getElementById('duel-turn-text'),

    // Ranuras de dígitos
    digitSlotsContainer: document.getElementById('digit-slots-container'),

    // Teclado en pantalla
    keypadContainer: document.getElementById('keypad-container'),
    keypadDigits: document.querySelectorAll('.keypad-digit'),
    keypadDelete: document.getElementById('keypad-delete'),
    keypadClear: document.getElementById('keypad-clear'),
    keypadSubmit: document.getElementById('keypad-submit'),

    // Contenedor de historial dinámico
    historyList: document.getElementById('history-list'),
    historyEmptyState: document.getElementById('history-empty-state'),
    historyCountBadge: document.getElementById('history-count-badge'),
    duelHistoryTabs: document.getElementById('duel-history-tabs'),
    duelTabP1: document.getElementById('duel-tab-p1'),
    duelTabP2: document.getElementById('duel-tab-p2'),
    duelTabP1Label: document.getElementById('duel-tab-p1-label'),
    duelTabP2Label: document.getElementById('duel-tab-p2-label'),
    duelTabP1Avatar: document.getElementById('duel-tab-p1-avatar'),
    duelTabP2Avatar: document.getElementById('duel-tab-p2-avatar'),

    // Alertas y Toasts
    toastContainer: document.getElementById('toast-container'),

    // Modales
    modalVictory: document.getElementById('modal-victory'),
    victoryPlayerName: document.getElementById('victory-player-name'),
    victoryPlayerAvatar: document.getElementById('victory-player-avatar'),
    victoryCodeRevealed: document.getElementById('victory-code-revealed'),
    victoryAttempts: document.getElementById('victory-attempts'),
    victoryTime: document.getElementById('victory-time'),
    victoryRecordBadge: document.getElementById('victory-record-badge'),
    btnVictoryNewGame: document.getElementById('btn-victory-new-game'),
    btnVictoryClose: document.getElementById('btn-victory-close'),

    modalRules: document.getElementById('modal-rules'),
    btnRulesClose: document.getElementById('btn-rules-close'),

    modalLeaderboard: document.getElementById('modal-leaderboard'),
    btnLeaderboardClose: document.getElementById('btn-leaderboard-close'),
    leaderboardList: document.getElementById('leaderboard-list'),
    formCreateUser: document.getElementById('form-create-user'),
    inputNewUserName: document.getElementById('input-new-user-name'),
    selectNewUserAvatar: document.getElementById('select-new-user-avatar'),
    userSelectDropdown: document.getElementById('user-select-dropdown')
  };

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  function init() {
    setupEventListeners();
    updateSoundUI();
    syncActiveUser();
    renderUserSelectDropdown();
    initNewGame();
  }

  // ==========================================
  // GESTIÓN DEL CRONÓMETRO
  // ==========================================
  function startTimer() {
    if (state.isTimerRunning) return;
    state.isTimerRunning = true;
    state.timerStartTime = Date.now() - (state.elapsedSeconds * 1000);

    state.timerInterval = setInterval(() => {
      const now = Date.now();
      state.elapsedSeconds = Math.floor((now - state.timerStartTime) / 1000);
      renderTimer();
    }, 1000);
  }

  function pauseTimer() {
    if (!state.isTimerRunning) return;
    state.isTimerRunning = false;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  function resetTimer() {
    pauseTimer();
    state.elapsedSeconds = 0;
    renderTimer();
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function renderTimer() {
    if (dom.timerDisplay) {
      dom.timerDisplay.textContent = formatTime(state.elapsedSeconds);
    }
  }

  // ==========================================
  // REINICIO Y CONFIGURACIÓN DE NUEVA PARTIDA
  // ==========================================
  function initNewGame() {
    resetTimer();
    state.gameStatus = 'idle';
    state.currentDigits = new Array(state.codeLength).fill('');
    state.activeSlotIndex = 0;
    state.historySolo = [];
    state.historyDuelP1 = [];
    state.historyDuelP2 = [];
    state.duelWinner = null;
    state.duelActivePlayerIndex = 0;

    // Obtener usuarios
    const active = Users.getActiveUser();
    const allUsers = Users.loadUsers();
    state.duelPlayer1 = active || allUsers[0];
    state.duelPlayer2 = allUsers.find(u => u.id !== state.duelPlayer1.id) || allUsers[1] || allUsers[0];

    // Generar códigos secretos
    if (state.gameMode === 'solo') {
      state.secretCodeSolo = Engine.generateSecretCode(state.codeLength, state.allowDuplicates);
      console.log('🎮 [Debug] Código Secreto Solitario:', state.secretCodeSolo);
    } else {
      state.secretCodeDuelP1 = Engine.generateSecretCode(state.codeLength, state.allowDuplicates);
      state.secretCodeDuelP2 = Engine.generateSecretCode(state.codeLength, state.allowDuplicates);
      console.log('⚔️ [Debug] Código Secreto P1:', state.secretCodeDuelP1, '| P2:', state.secretCodeDuelP2);
    }

    renderDigitSlots();
    renderKeypadState();
    renderHistory();
    updateDuelUI();

    showToast('¡Nueva partida iniciada! Descubre el código secreto.', 'info');
  }

  // ==========================================
  // RENDERIZADO DE SLOTS DE ENTRADA
  // ==========================================
  function renderDigitSlots(isRevealed = false) {
    dom.digitSlotsContainer.innerHTML = '';
    const revealed = isRevealed || state.gameStatus === 'revealed';

    for (let i = 0; i < state.codeLength; i++) {
      const slot = document.createElement('div');
      let slotClasses = 'digit-slot w-14 h-16 sm:w-16 sm:h-20 rounded-xl flex items-center justify-center text-3xl sm:text-4xl font-black font-mono tracking-wider border-2 transition-all duration-200 ';

      if (revealed) {
        slotClasses += 'border-rose-500 bg-rose-950/40 text-rose-300 animate-history-item';
      } else if (i === state.activeSlotIndex) {
        slotClasses += 'glow-input-active border-indigo-500 bg-slate-800/90 text-white';
      } else {
        slotClasses += 'border-slate-700/80 bg-slate-900/60 text-slate-200';
      }

      slot.className = slotClasses;
      slot.textContent = state.currentDigits[i] || '';
      slot.dataset.index = i;

      // Evento de clic en slot individual (solo si no se ha rendido)
      if (!revealed) {
        slot.addEventListener('click', () => {
          state.activeSlotIndex = i;
          Sounds.playKeyClick();
          renderDigitSlots();
        });
      }

      dom.digitSlotsContainer.appendChild(slot);
    }
  }

  // ==========================================
  // CONTROLADOR DE ENTRADA DUAL (TECLADO / PANTALLA)
  // ==========================================
  function handleInputDigit(digit) {
    if (state.gameStatus === 'won' || state.gameStatus === 'revealed') {
      return;
    }

    if (!state.isTimerRunning) {
      startTimer();
    }

    state.gameStatus = 'playing';

    // Validación en modo clásico: no permitir repetición si está activa la regla
    // (Permite si está reescribiendo la misma casilla)
    if (!state.allowDuplicates && state.currentDigits.includes(digit) && state.currentDigits[state.activeSlotIndex] !== digit) {
      Sounds.playError();
      highlightInvalidInput();
      showToast(`La cifra '${digit}' ya está ingresada. En Modo Clásico no se repiten cifras.`, 'warning');
      return;
    }

    // Si todas las casillas ya tienen un valor y estamos al final, sugerir presionar Enter
    if (state.activeSlotIndex === state.codeLength - 1 && state.currentDigits[state.activeSlotIndex] !== '' && state.currentDigits.every(d => d !== '')) {
      highlightInvalidInput();
      showToast('Ya ingresaste las 4 cifras. Presiona Enter para comprobar.', 'info', 2000);
      return;
    }

    Sounds.playKeyClick();

    // Guardar dígito en el slot activo
    state.currentDigits[state.activeSlotIndex] = digit;

    // Avanzar al siguiente slot si está dentro del rango
    if (state.activeSlotIndex < state.codeLength - 1) {
      state.activeSlotIndex++;
    }

    renderDigitSlots();
    renderKeypadState();
  }

  function handleDeleteDigit() {
    if (state.gameStatus === 'won' || state.gameStatus === 'revealed') return;

    Sounds.playDelete();

    // Si el slot actual tiene dígito, borrarlo
    if (state.currentDigits[state.activeSlotIndex] !== '') {
      state.currentDigits[state.activeSlotIndex] = '';
    } else if (state.activeSlotIndex > 0) {
      // Si está vacío, retroceder un slot y borrar ese
      state.activeSlotIndex--;
      state.currentDigits[state.activeSlotIndex] = '';
    }

    renderDigitSlots();
    renderKeypadState();
  }

  function handleClearDigits() {
    if (state.gameStatus === 'won' || state.gameStatus === 'revealed') return;
    Sounds.playDelete();
    state.currentDigits = new Array(state.codeLength).fill('');
    state.activeSlotIndex = 0;
    renderDigitSlots();
    renderKeypadState();
  }

  function highlightInvalidInput() {
    dom.digitSlotsContainer.classList.add('animate-shake');
    setTimeout(() => {
      dom.digitSlotsContainer.classList.remove('animate-shake');
    }, 450);
  }

  function renderKeypadState() {
    // En modo clásico, atenuar visualmente las teclas ya ingresadas
    dom.keypadDigits.forEach(btn => {
      const val = btn.dataset.value;
      if (!state.allowDuplicates && state.currentDigits.includes(val)) {
        btn.classList.add('opacity-40', 'border-slate-800');
        btn.classList.remove('border-slate-700');
      } else {
        btn.classList.remove('opacity-40', 'border-slate-800');
        btn.classList.add('border-slate-700');
      }
    });
  }

  // ==========================================
  // EVALUACIÓN DEL INTENTO
  // ==========================================
  function handleSubmitGuess() {
    if (state.gameStatus === 'won' || state.gameStatus === 'revealed') return;

    const guess = state.currentDigits.join('');

    // Validar con el motor
    const check = Engine.validateGuess(guess, state.codeLength, state.allowDuplicates);
    if (!check.valid) {
      Sounds.playError();
      highlightInvalidInput();
      showToast(check.error || 'Intento no válido.', 'error');
      return;
    }

    Sounds.playSubmit();

    // Determinar código objetivo según modo de juego
    let targetSecret = '';
    let currentHistory = null;
    let currentPlayer = null;

    if (state.gameMode === 'solo') {
      targetSecret = state.secretCodeSolo;
      currentHistory = state.historySolo;
      currentPlayer = Users.getActiveUser();
    } else {
      // En duelo: el jugador adivina su código objetivo
      if (state.duelActivePlayerIndex === 0) {
        targetSecret = state.secretCodeDuelP1;
        currentHistory = state.historyDuelP1;
        currentPlayer = state.duelPlayer1;
      } else {
        targetSecret = state.secretCodeDuelP2;
        currentHistory = state.historyDuelP2;
        currentPlayer = state.duelPlayer2;
      }
    }

    // Cálculo estricto con el motor de Punto y Fama
    const evaluation = Engine.evaluateGuess(targetSecret, guess);

    const attemptNumber = currentHistory.length + 1;
    const historyItem = {
      attemptNumber,
      guess,
      famas: evaluation.famas,
      puntos: evaluation.puntos,
      details: evaluation.details,
      timestamp: Date.now(),
      player: currentPlayer,
      timeElapsed: state.elapsedSeconds
    };

    // Agregar al inicio para orden cronológico inverso
    currentHistory.unshift(historyItem);

    // Reproducir feedback sonoro
    if (evaluation.famas > 0 && !evaluation.isVictory) {
      setTimeout(() => Sounds.playFamaNotification(), 200);
    }

    // Limpiar entrada para el siguiente intento
    state.currentDigits = new Array(state.codeLength).fill('');
    state.activeSlotIndex = 0;
    renderDigitSlots();
    renderKeypadState();

    // Verificar si ganó (4 Famas o longitud elegida)
    if (evaluation.isVictory) {
      renderHistory();
      handleVictory(currentPlayer, historyItem, targetSecret);
      return;
    }

    // Si es modo Duelo, alternar turno al rival
    if (state.gameMode === 'duel') {
      state.duelActivePlayerIndex = state.duelActivePlayerIndex === 0 ? 1 : 0;
      state.duelViewingPlayerIndex = state.duelActivePlayerIndex;
      updateDuelUI();
      renderHistory();
      const nextPlayer = state.duelActivePlayerIndex === 0 ? state.duelPlayer1 : state.duelPlayer2;
      showToast(`¡Turno de ${nextPlayer.name}! El anterior obtuvo: ${evaluation.famas} Fama(s), ${evaluation.puntos} Punto(s).`, 'info', 4000);
    } else {
      renderHistory();
      showToast(`Intento #${attemptNumber}: ${evaluation.famas} Fama(s), ${evaluation.puntos} Punto(s).`, 'info');
    }
  }

  // ==========================================
  // VICTORIA Y CELEBRACIÓN (CONFETI + FANFARRIA)
  // ==========================================
  function handleVictory(player, historyItem, secretCode) {
    pauseTimer();
    state.gameStatus = 'won';

    // Audio triunfal
    Sounds.playVictoryFanfare();

    // Lluvia de confeti
    triggerConfettiCelebration();

    // Registrar en estadísticas del usuario
    const totalAttempts = state.gameMode === 'solo'
      ? state.historySolo.length
      : (state.duelActivePlayerIndex === 0 ? state.historyDuelP1.length : state.historyDuelP2.length);

    let isNewRecord = false;
    if (player && player.id) {
      const prevBest = player.stats?.bestAttempts;
      Users.recordGameResult(player.id, {
        won: true,
        attempts: totalAttempts,
        timeSec: state.elapsedSeconds,
        famasCount: historyItem.famas,
        puntosCount: historyItem.puntos
      });

      if (prevBest === null || totalAttempts < prevBest) {
        isNewRecord = true;
      }
    }

    syncActiveUser();

    // Mostrar modal de victoria
    dom.victoryPlayerName.textContent = player ? player.name : 'Jugador';
    dom.victoryPlayerAvatar.textContent = player ? player.avatar : '👑';
    dom.victoryCodeRevealed.textContent = secretCode;
    dom.victoryAttempts.textContent = totalAttempts;
    dom.victoryTime.textContent = formatTime(state.elapsedSeconds);

    if (isNewRecord) {
      dom.victoryRecordBadge.classList.remove('hidden');
    } else {
      dom.victoryRecordBadge.classList.add('hidden');
    }

    dom.modalVictory.classList.remove('hidden');
  }

  // ==========================================
  // CONFETI NATIVO + CANVAS-CONFETTI FALLBACK
  // ==========================================
  function triggerConfettiCelebration() {
    if (typeof window.confetti === 'function') {
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 60 * (timeLeft / duration);

        window.confetti({
          particleCount,
          startVelocity: 35,
          spread: 360,
          origin: { x: Math.random() * 0.4 + 0.3, y: Math.random() * 0.4 + 0.2 },
          colors: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#ffffff']
        });
      }, 250);
    } else {
      // Fallback nativo de partículas en canvas por si no hay red
      runFallbackConfetti();
    }
  }

  function runFallbackConfetti() {
    const canvas = document.getElementById('fallback-confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#ffffff'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 4 + 3,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10
      });
    }

    let frames = 0;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      frames++;
      if (frames < 200) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(render);
  }

  // ==========================================
  // RENDERIZADO DEL HISTORIAL DINÁMICO
  // ==========================================
  function renderHistory() {
    let currentList;
    let viewingPlayer;

    if (state.gameMode === 'solo') {
      currentList = state.historySolo;
      viewingPlayer = Users.getActiveUser();
    } else {
      const isViewingP1 = state.duelViewingPlayerIndex === 0;
      currentList = isViewingP1 ? state.historyDuelP1 : state.historyDuelP2;
      viewingPlayer = isViewingP1 ? state.duelPlayer1 : state.duelPlayer2;
    }

    dom.historyList.innerHTML = '';
    dom.historyCountBadge.textContent = `${currentList.length} intentos`;

    if (currentList.length === 0) {
      dom.historyEmptyState.classList.remove('hidden');
      return;
    }

    dom.historyEmptyState.classList.add('hidden');

    // Orden cronológico inverso garantizado: el primer elemento del array es el más reciente
    currentList.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `animate-history-item p-3.5 sm:p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-lg hover:border-slate-700 transition-all ${
        index === 0 ? 'ring-1 ring-indigo-500/50 bg-slate-900' : ''
      }`;

      // Lado izquierdo: # Intento y dígitos estilizados
      const leftCol = document.createElement('div');
      leftCol.className = 'flex items-center gap-2.5 sm:gap-3';

      const attemptBadge = document.createElement('span');
      attemptBadge.className = 'text-xs font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700';
      attemptBadge.textContent = `#${item.attemptNumber}`;

      // Si es modo duelo, agregar avatar del jugador
      if (state.gameMode === 'duel' && item.player) {
        const playerBadge = document.createElement('span');
        playerBadge.className = 'text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700';
        playerBadge.title = item.player.name;
        playerBadge.textContent = item.player.avatar;
        leftCol.appendChild(playerBadge);
      }

      const digitsBox = document.createElement('div');
      digitsBox.className = 'flex items-center gap-1.5 font-mono text-xl sm:text-2xl font-black text-slate-100 tracking-wider';

      // Renderizar cada dígito en una casilla estética
      item.guess.split('').forEach((d) => {
        const dSpan = document.createElement('span');
        dSpan.className = 'w-8 h-9 sm:w-9 sm:h-10 rounded-lg flex items-center justify-center bg-slate-950/80 border border-slate-700/80 shadow-inner';
        dSpan.textContent = d;
        digitsBox.appendChild(dSpan);
      });

      leftCol.appendChild(attemptBadge);
      leftCol.appendChild(digitsBox);

      // Lado derecho: Etiquetas luminosas de Famas y Puntos
      const rightCol = document.createElement('div');
      rightCol.className = 'flex items-center gap-2 sm:gap-3 ml-auto';

      // Badge Famas (Luminoso Verde Neón)
      const famaBadge = document.createElement('div');
      famaBadge.className = `glow-fama px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono font-bold text-sm sm:text-base ${
        item.famas > 0 ? 'opacity-100' : 'opacity-35 grayscale'
      }`;
      famaBadge.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span>${item.famas}</span>
        <span class="text-xs uppercase tracking-wider">${item.famas === 1 ? 'Fama' : 'Famas'}</span>
      `;

      // Badge Puntos (Luminoso Azul Cian Neón)
      const puntoBadge = document.createElement('div');
      puntoBadge.className = `glow-punto px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-mono font-bold text-sm sm:text-base ${
        item.puntos > 0 ? 'opacity-100' : 'opacity-35 grayscale'
      }`;
      puntoBadge.innerHTML = `
        <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="8"/>
        </svg>
        <span>${item.puntos}</span>
        <span class="text-xs uppercase tracking-wider">${item.puntos === 1 ? 'Punto' : 'Puntos'}</span>
      `;

      rightCol.appendChild(famaBadge);
      rightCol.appendChild(puntoBadge);

      row.appendChild(leftCol);
      row.appendChild(rightCol);
      dom.historyList.appendChild(row);
    });
  }

  // ==========================================
  // ACTUALIZACIÓN DE INTERFAZ DE DUELO
  // ==========================================
  function updateDuelUI() {
    if (state.gameMode === 'duel') {
      dom.duelBanner.classList.remove('hidden');
      if (dom.duelHistoryTabs) dom.duelHistoryTabs.classList.remove('hidden');

      const isP1 = state.duelActivePlayerIndex === 0;

      // Card Jugador 1
      dom.duelP1Card.classList.toggle('ring-2', isP1);
      dom.duelP1Card.classList.toggle('ring-emerald-500', isP1);
      dom.duelP1Card.classList.toggle('bg-emerald-950/20', isP1);
      dom.duelP1Card.classList.toggle('opacity-50', !isP1);

      // Card Jugador 2
      dom.duelP2Card.classList.toggle('ring-2', !isP1);
      dom.duelP2Card.classList.toggle('ring-indigo-500', !isP1);
      dom.duelP2Card.classList.toggle('bg-indigo-950/20', !isP1);
      dom.duelP2Card.classList.toggle('opacity-50', isP1);

      const activeName = isP1 ? state.duelPlayer1.name : state.duelPlayer2.name;
      dom.duelTurnText.textContent = `Turno de ${activeName}`;

      // Pestañas de historial
      if (dom.duelTabP1Label && dom.duelTabP2Label) {
        dom.duelTabP1Avatar.textContent = state.duelPlayer1.avatar;
        dom.duelTabP1Label.textContent = `${state.duelPlayer1.name} (${state.historyDuelP1.length})`;
        dom.duelTabP2Avatar.textContent = state.duelPlayer2.avatar;
        dom.duelTabP2Label.textContent = `${state.duelPlayer2.name} (${state.historyDuelP2.length})`;

        const viewingP1 = state.duelViewingPlayerIndex === 0;
        dom.duelTabP1.className = viewingP1
          ? 'flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 text-white transition-all flex items-center justify-center gap-1.5 shadow-md font-bold'
          : 'flex-1 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 font-medium';
        dom.duelTabP2.className = !viewingP1
          ? 'flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 text-white transition-all flex items-center justify-center gap-1.5 shadow-md font-bold'
          : 'flex-1 py-1.5 px-2 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 font-medium';
      }
    } else {
      dom.duelBanner.classList.add('hidden');
      if (dom.duelHistoryTabs) dom.duelHistoryTabs.classList.add('hidden');
    }
  }

  // ==========================================
  // RENDIMIENTO DE USUARIOS Y RANKINGS
  // ==========================================
  function syncActiveUser() {
    const user = Users.getActiveUser();
    if (user && dom.activeUserName) {
      dom.activeUserName.textContent = user.name;
      dom.activeUserAvatar.textContent = user.avatar;
    }
  }

  function renderLeaderboard() {
    const board = Users.getLeaderboard();
    dom.leaderboardList.innerHTML = '';

    board.forEach((user, idx) => {
      const row = document.createElement('div');
      row.className = `p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 ${
        user.id === Users.getActiveUserId() ? 'ring-1 ring-indigo-500/60 bg-indigo-950/20' : ''
      }`;

      // Posición y Medalla
      let rankBadge = `<span class="w-6 text-center font-bold font-mono text-slate-500">${idx + 1}</span>`;
      if (idx === 0) rankBadge = `<span class="text-xl">🥇</span>`;
      else if (idx === 1) rankBadge = `<span class="text-xl">🥈</span>`;
      else if (idx === 2) rankBadge = `<span class="text-xl">🥉</span>`;

      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          ${rankBadge}
          <span class="text-2xl">${user.avatar}</span>
          <div class="truncate">
            <div class="font-bold text-slate-100 truncate">${user.name}</div>
            <div class="text-xs text-slate-400">Victorias: <span class="text-emerald-400 font-bold">${user.stats.won}</span> / ${user.stats.played} (${user.winRate}%)</div>
          </div>
        </div>
        <div class="flex items-center gap-4 text-right font-mono">
          <div>
            <div class="text-xs text-slate-500 uppercase">Récord</div>
            <div class="text-sm font-bold text-amber-400">${user.stats.bestAttempts ? user.stats.bestAttempts + ' int' : '-'}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500 uppercase">Mejor T.</div>
            <div class="text-sm font-bold text-cyan-400">${user.stats.bestTimeSec ? formatTime(user.stats.bestTimeSec) : '-'}</div>
          </div>
        </div>
      `;

      dom.leaderboardList.appendChild(row);
    });
  }

  function renderUserSelectDropdown() {
    const users = Users.loadUsers();
    const activeId = Users.getActiveUserId();

    if (dom.userSelectDropdown) {
      dom.userSelectDropdown.innerHTML = '';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.avatar} ${u.name}`;
        if (u.id === activeId) opt.selected = true;
        dom.userSelectDropdown.appendChild(opt);
      });
    }
  }

  // ==========================================
  // SISTEMA DE ALERTAS Y TOASTS ANIMADAS
  // ==========================================
  function showToast(message, type = 'info', duration = 3000) {
    if (!dom.toastContainer) return;

    const toast = document.createElement('div');
    const colors = {
      info: 'border-indigo-500/50 bg-slate-900/95 text-indigo-200 shadow-indigo-950/50',
      success: 'border-emerald-500/50 bg-slate-900/95 text-emerald-200 shadow-emerald-950/50',
      warning: 'border-amber-500/50 bg-slate-900/95 text-amber-200 shadow-amber-950/50',
      error: 'border-rose-500/50 bg-slate-900/95 text-rose-200 shadow-rose-950/50'
    };

    toast.className = `p-3.5 px-4 rounded-xl border backdrop-blur-md shadow-xl flex items-center gap-3 text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${
      colors[type] || colors.info
    }`;

    toast.innerHTML = `
      <span class="flex-1">${message}</span>
      <button class="text-slate-400 hover:text-white transition-colors">&times;</button>
    `;

    dom.toastContainer.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    const removeToast = () => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    };

    toast.querySelector('button').addEventListener('click', removeToast);
    setTimeout(removeToast, duration);
  }

  // ==========================================
  // GESTIÓN DE AUDIO EN LA UI
  // ==========================================
  function updateSoundUI() {
    const isMuted = Sounds.getIsMuted();
    if (dom.soundIconOn && dom.soundIconOff) {
      if (isMuted) {
        dom.soundIconOn.classList.add('hidden');
        dom.soundIconOff.classList.remove('hidden');
      } else {
        dom.soundIconOn.classList.remove('hidden');
        dom.soundIconOff.classList.add('hidden');
      }
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // 1. ENTRADA FÍSICA: Teclado de ordenador
    window.addEventListener('keydown', (e) => {
      // Ignorar si el usuario está escribiendo en un input de texto modal
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleInputDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteDigit();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitGuess();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClearDigits();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (state.activeSlotIndex > 0) {
          state.activeSlotIndex--;
          Sounds.playKeyClick();
          renderDigitSlots();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (state.activeSlotIndex < state.codeLength - 1) {
          state.activeSlotIndex++;
          Sounds.playKeyClick();
          renderDigitSlots();
        }
      }
    });

    // 2. ENTRADA VIRTUAL: Teclado táctil en pantalla
    dom.keypadDigits.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        if (navigator.vibrate) navigator.vibrate(15);
        handleInputDigit(val);
      });
    });

    if (dom.keypadDelete) {
      dom.keypadDelete.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(15);
        handleDeleteDigit();
      });
    }

    if (dom.keypadClear) {
      dom.keypadClear.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(20);
        handleClearDigits();
      });
    }

    if (dom.keypadSubmit) {
      dom.keypadSubmit.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(25);
        handleSubmitGuess();
      });
    }

    // 3. CONTROLES SUPERIORES Y BOTONES
    dom.btnNewGame.addEventListener('click', () => {
      Sounds.playKeyClick();
      initNewGame();
    });

    dom.btnSurrender.addEventListener('click', () => {
      if (state.gameStatus === 'won') return;
      Sounds.playError();
      const code = state.gameMode === 'solo' ? state.secretCodeSolo : (state.duelActivePlayerIndex === 0 ? state.secretCodeDuelP1 : state.secretCodeDuelP2);
      pauseTimer();
      state.gameStatus = 'revealed';
      // Mostrar el código directamente en las casillas
      state.currentDigits = code.split('');
      state.activeSlotIndex = -1;
      renderDigitSlots(true);
      showToast(`Partida finalizada. El código secreto era: ${code}. Presiona "Nueva Partida" para jugar otra vez.`, 'warning', 7000);
    });

    dom.soundToggleBtn.addEventListener('click', () => {
      Sounds.toggleMute();
      updateSoundUI();
      if (!Sounds.getIsMuted()) {
        Sounds.playKeyClick();
      }
    });

    // 4. CAMBIO DE MODO: Solitario vs Duelo
    function updateModeButtonsUI() {
      const isSolo = state.gameMode === 'solo';
      if (dom.modeSoloBtn && dom.modeDuelBtn) {
        if (isSolo) {
          dom.modeSoloBtn.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white transition-all font-semibold';
          dom.modeDuelBtn.className = 'px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all font-semibold';
        } else {
          dom.modeSoloBtn.className = 'px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-all font-semibold';
          dom.modeDuelBtn.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white transition-all font-semibold';
        }
      }
    }

    function updateRuleButtonsUI() {
      const allowDup = state.allowDuplicates;
      if (dom.ruleClassicBtn && dom.ruleDuplicatesBtn) {
        if (!allowDup) {
          dom.ruleClassicBtn.className = 'px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white transition-all font-semibold';
          dom.ruleDuplicatesBtn.className = 'px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all font-semibold';
        } else {
          dom.ruleClassicBtn.className = 'px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all font-semibold';
          dom.ruleDuplicatesBtn.className = 'px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white transition-all font-semibold';
        }
      }
    }

    dom.modeSoloBtn.addEventListener('click', () => {
      if (state.gameMode === 'solo') return;
      Sounds.playKeyClick();
      state.gameMode = 'solo';
      updateModeButtonsUI();
      initNewGame();
    });

    dom.modeDuelBtn.addEventListener('click', () => {
      if (state.gameMode === 'duel') return;
      Sounds.playKeyClick();
      state.gameMode = 'duel';
      updateModeButtonsUI();
      initNewGame();
    });

    // 5. REGLAS: Clásico (sin repetición) vs Con Repetición
    dom.ruleClassicBtn.addEventListener('click', () => {
      if (!state.allowDuplicates) return;
      Sounds.playKeyClick();
      state.allowDuplicates = false;
      updateRuleButtonsUI();
      initNewGame();
    });

    dom.ruleDuplicatesBtn.addEventListener('click', () => {
      if (state.allowDuplicates) return;
      Sounds.playKeyClick();
      state.allowDuplicates = true;
      updateRuleButtonsUI();
      initNewGame();
    });

    // 6. LONGITUD DE CIFRAS
    dom.lengthSelect.addEventListener('change', (e) => {
      Sounds.playKeyClick();
      state.codeLength = parseInt(e.target.value, 10) || 4;
      initNewGame();
    });

    // 7. MODALES
    dom.btnRules.addEventListener('click', () => {
      Sounds.playKeyClick();
      dom.modalRules.classList.remove('hidden');
    });

    dom.btnRulesClose.addEventListener('click', () => {
      Sounds.playKeyClick();
      dom.modalRules.classList.add('hidden');
    });

    dom.btnLeaderboard.addEventListener('click', () => {
      Sounds.playKeyClick();
      renderLeaderboard();
      renderUserSelectDropdown();
      dom.modalLeaderboard.classList.remove('hidden');
    });

    dom.btnLeaderboardClose.addEventListener('click', () => {
      Sounds.playKeyClick();
      dom.modalLeaderboard.classList.add('hidden');
    });

    dom.btnVictoryClose.addEventListener('click', () => {
      Sounds.playKeyClick();
      dom.modalVictory.classList.add('hidden');
    });

    dom.btnVictoryNewGame.addEventListener('click', () => {
      Sounds.playKeyClick();
      dom.modalVictory.classList.add('hidden');
      initNewGame();
    });

    // Cambiar usuario activo desde el modal
    dom.userSelectDropdown.addEventListener('change', (e) => {
      Sounds.playKeyClick();
      Users.setActiveUserId(e.target.value);
      syncActiveUser();
      renderLeaderboard();
      initNewGame();
    });

    // Crear nuevo usuario
    dom.formCreateUser.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = dom.inputNewUserName.value.trim();
      const avatar = dom.selectNewUserAvatar.value;
      if (!name) return;

      try {
        const newUser = Users.createUser(name, avatar);
        dom.inputNewUserName.value = '';
        Sounds.playSubmit();
        syncActiveUser();
        renderUserSelectDropdown();
        renderLeaderboard();
        showToast(`¡Usuario ${newUser.name} creado con éxito!`, 'success');
        initNewGame();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Abrir modal de perfiles al hacer clic en el pill de usuario activo
    if (dom.activeUserPill) {
      dom.activeUserPill.addEventListener('click', () => {
        Sounds.playKeyClick();
        renderLeaderboard();
        renderUserSelectDropdown();
        dom.modalLeaderboard.classList.remove('hidden');
      });
    }

    // Pestañas de historial en Modo Duelo (Alternar vista entre jugador 1 y jugador 2)
    if (dom.duelTabP1 && dom.duelTabP2) {
      dom.duelTabP1.addEventListener('click', () => {
        if (state.duelViewingPlayerIndex === 0) return;
        Sounds.playKeyClick();
        state.duelViewingPlayerIndex = 0;
        updateDuelUI();
        renderHistory();
      });

      dom.duelTabP2.addEventListener('click', () => {
        if (state.duelViewingPlayerIndex === 1) return;
        Sounds.playKeyClick();
        state.duelViewingPlayerIndex = 1;
        updateDuelUI();
        renderHistory();
      });
    }

    // Desbloqueo de AudioContext para navegadores modernos
    const unlockAudio = () => {
      Sounds.getAudioContext();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    // Cerrar modales con clic en el fondo
    [dom.modalRules, dom.modalLeaderboard, dom.modalVictory].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  // Arrancar la app al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
