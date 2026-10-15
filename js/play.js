/**
 * Controlador de Cliente Móvil para Celulares (Punto y Fama)
 * Optimizado para entrada táctil con pulgar, vibración háptica y retroalimentación inmediata.
 */

(function () {
  'use strict';

  // Almacenamiento local
  const STORAGE_KEY = 'punto_y_fama_mobile_user';
  let savedProfile = null;
  try {
    savedProfile = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {}

  const urlParams = new URLSearchParams(window.location.search);
  let currentRoomId = (urlParams.get('room') || 'default').toUpperCase().slice(0, 16);

  // Variables de Estado
  let ws = null;
  let playerId = savedProfile?.id || ('p_' + Math.random().toString(36).substr(2, 9));
  let playerName = savedProfile?.name || '';
  let playerAvatar = savedProfile?.avatar || '👑';
  let currentDigits = [];
  let isRoundActive = false;
  let allowDuplicates = false;
  let attemptsInRound = 0;

  // Elementos DOM
  const viewJoin = document.getElementById('view-join');
  const viewGame = document.getElementById('view-game');
  const formJoin = document.getElementById('form-join');
  const inputPlayerName = document.getElementById('input-player-name');
  const avatarGrid = document.getElementById('avatar-grid');

  const playerRoomLabel = document.getElementById('player-room-label');
  const btnPlayerChangeRoom = document.getElementById('btn-player-change-room');
  const playerGameRoomBadge = document.getElementById('player-game-room-badge');

  const playerAvatarBadge = document.getElementById('player-avatar-badge');
  const playerNameLabel = document.getElementById('player-name-label');
  const playerScoreBadge = document.getElementById('player-score-badge');
  const playerRankBadge = document.getElementById('player-rank-badge');
  const roundStatusBadge = document.getElementById('round-status-badge');

  function updatePlayerRoomUI() {
    const isDefault = currentRoomId === 'DEFAULT' || currentRoomId === 'default';
    if (playerRoomLabel) {
      playerRoomLabel.textContent = isDefault ? 'PRINCIPAL' : currentRoomId;
    }
    if (playerGameRoomBadge) {
      playerGameRoomBadge.textContent = isDefault ? 'Sala: Principal' : `Sala: ${currentRoomId}`;
    }
  }
  updatePlayerRoomUI();

  if (btnPlayerChangeRoom) {
    btnPlayerChangeRoom.onclick = () => {
      const isDefault = currentRoomId === 'DEFAULT' || currentRoomId === 'default';
      const input = prompt(
        'Escribe el código de sala privada a la que deseas unirte (ej: AMIGOS):\nO déjalo vacío para unirte a la Principal:',
        isDefault ? '' : currentRoomId
      );
      if (input !== null) {
        const clean = input.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
        if (clean && clean !== 'DEFAULT') {
          window.location.search = `?room=${encodeURIComponent(clean)}`;
        } else {
          window.location.search = '';
        }
      }
    };
  }

  const mobileDigitSlots = document.querySelectorAll('#mobile-digit-slots [data-slot]');
  const lastResultBox = document.getElementById('last-result-box');
  const myHistoryList = document.getElementById('my-history-list');
  const myAttemptsCount = document.getElementById('my-attempts-count');

  const btnKeypadDel = document.getElementById('btn-keypad-del');
  const btnKeypadSend = document.getElementById('btn-keypad-send');
  const keypadDigitBtns = document.querySelectorAll('.keypad-digit');

  const btnToggleLeaderboard = document.getElementById('btn-toggle-leaderboard');
  const drawerLeaderboard = document.getElementById('drawer-leaderboard');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const drawerRankingList = document.getElementById('drawer-ranking-list');
  const toastContainer = document.getElementById('toast-container');

  // Inicializar UI de Registro
  if (savedProfile) {
    if (inputPlayerName) inputPlayerName.value = savedProfile.name || '';
    playerAvatar = savedProfile.avatar || '👑';
    selectAvatarInGrid(playerAvatar);
  }

  function selectAvatarInGrid(av) {
    if (!avatarGrid) return;
    const btns = avatarGrid.querySelectorAll('.avatar-option');
    btns.forEach(b => {
      if (b.dataset.avatar === av) {
        b.className = 'avatar-option p-2.5 rounded-xl bg-slate-800/80 border-2 border-emerald-500 text-2xl transition-all scale-105';
      } else {
        b.className = 'avatar-option p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-2xl transition-all';
      }
    });
  }

  if (avatarGrid) {
    avatarGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.avatar-option');
      if (btn) {
        playerAvatar = btn.dataset.avatar;
        selectAvatarInGrid(playerAvatar);
        vibrate(10);
      }
    });
  }

  function vibrate(ms = 15) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const colorClasses = {
      info: 'border-indigo-500/50 bg-slate-900/95 text-indigo-300',
      success: 'border-emerald-500/50 bg-slate-900/95 text-emerald-300',
      warning: 'border-amber-500/50 bg-slate-900/95 text-amber-300',
      error: 'border-rose-500/50 bg-slate-900/95 text-rose-300'
    }[type] || 'border-slate-700 bg-slate-900 text-slate-200';

    toast.className = `p-3 rounded-2xl border ${colorClasses} shadow-2xl backdrop-blur-md text-xs font-semibold flex items-center justify-between gap-3 animate-history-item pointer-events-auto`;
    toast.innerHTML = `<span>${message}</span><button class="text-slate-400 hover:text-white">&times;</button>`;

    toast.querySelector('button').onclick = () => toast.remove();
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 3500);
  }

  // Actualizar casillas de las 4 cifras en la pantalla
  function updateSlotsDisplay() {
    mobileDigitSlots.forEach((slot, idx) => {
      const val = currentDigits[idx];
      if (val !== undefined) {
        slot.textContent = val;
        slot.classList.add('border-emerald-500', 'text-emerald-400');
        slot.classList.remove('border-slate-700', 'text-white');
      } else {
        slot.textContent = '';
        slot.classList.remove('border-emerald-500', 'text-emerald-400');
        slot.classList.add('border-slate-700', 'text-white');
      }
    });

    // En modo sin duplicados, atenuar teclas ya usadas
    if (!allowDuplicates) {
      keypadDigitBtns.forEach(btn => {
        const val = btn.dataset.val;
        if (currentDigits.includes(val)) {
          btn.classList.add('opacity-30', 'pointer-events-none');
        } else {
          btn.classList.remove('opacity-30', 'pointer-events-none');
        }
      });
    }
  }

  function appendDigit(d) {
    if (currentDigits.length >= 4) return;
    if (!allowDuplicates && currentDigits.includes(d)) {
      vibrate([20, 50, 20]);
      showToast('No se permiten dígitos repetidos', 'warning');
      return;
    }
    currentDigits.push(d);
    vibrate(15);
    if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playKeyClick();
    updateSlotsDisplay();
  }

  function deleteLastDigit() {
    if (currentDigits.length > 0) {
      currentDigits.pop();
      vibrate(15);
      if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playDeleteKey();
      updateSlotsDisplay();
    }
  }

  function clearDigits() {
    currentDigits = [];
    updateSlotsDisplay();
  }

  // Enviar Intento al Servidor
  function sendGuess() {
    if (currentDigits.length !== 4) {
      vibrate([30, 80, 30]);
      showToast('Debes ingresar las 4 cifras completas', 'warning');
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('Conectando con el servidor...', 'warning');
      return;
    }

    const guessStr = currentDigits.join('');
    ws.send(JSON.stringify({
      type: 'player:guess',
      roomId: currentRoomId,
      playerId: playerId,
      guess: guessStr
    }));

    vibrate(25);
  }

  // Renderizar intento personal en la lista de deducción
  function prependMyAttempt(guess, famas, puntos, pointsGained) {
    if (!myHistoryList) return;
    if (attemptsInRound === 1) {
      myHistoryList.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono animate-history-item';

    item.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-slate-500 font-bold">#${attemptsInRound}</span>
        <span class="font-bold text-white tracking-widest text-sm bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700">${guess}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-emerald-400 font-bold">👑 ${famas}F</span>
        <span class="text-cyan-300 font-bold">⚡ ${puntos}P</span>
        <span class="text-slate-400 text-[11px] font-bold">+${pointsGained}pts</span>
      </div>
    `;

    myHistoryList.prepend(item);
  }

  // Conectar WebSocket
  function connectWebSocket() {
    const isFile = location.protocol === 'file:' || !location.host;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isFile ? 'localhost:3000' : location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Error al inicializar WebSocket:', err);
      showToast('No se pudo conectar al servidor.', 'error');
      return;
    }

    ws.onopen = () => {
      console.log('✅ Celular conectado al servidor');
      if (playerName) {
        ws.send(JSON.stringify({
          type: 'player:join',
          roomId: currentRoomId,
          playerId,
          name: playerName,
          avatar: playerAvatar
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;

        if (type === 'player:joined') {
          if (data.roomId) {
            currentRoomId = data.roomId;
            updatePlayerRoomUI();
          }
          isRoundActive = data.roomStatus === 'active';
          allowDuplicates = data.allowDuplicates;
          if (roundStatusBadge) {
            roundStatusBadge.textContent = isRoundActive ? `Ronda #${data.roundNumber} Activa` : 'Esperando ronda...';
          }
          if (viewJoin) viewJoin.classList.add('hidden');
          if (viewGame) viewGame.classList.remove('hidden');

          if (playerAvatarBadge) playerAvatarBadge.textContent = data.player.avatar;
          if (playerNameLabel) playerNameLabel.textContent = data.player.name;
          if (playerScoreBadge) playerScoreBadge.textContent = `${data.player.score} pts`;

          updateLeaderboardRank(data.leaderboard);
        }

        if (type === 'player:guess_error') {
          vibrate([40, 100, 40]);
          if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playError();
          showToast(data.error, 'error');
        }

        if (type === 'player:guess_result') {
          attemptsInRound++;
          if (myAttemptsCount) myAttemptsCount.textContent = `${attemptsInRound} intento${attemptsInRound > 1 ? 's' : ''}`;

          if (playerScoreBadge) playerScoreBadge.textContent = `${data.totalScore} pts`;

          // Actualizar recuadro de último resultado
          if (lastResultBox) {
            lastResultBox.innerHTML = `
              <div class="flex flex-col items-center gap-1 animate-history-item w-full">
                <div class="flex items-center justify-between w-full text-xs">
                  <span class="text-slate-400 font-mono">Tu intento: <strong class="text-white text-sm tracking-wider">${data.guess}</strong></span>
                  <span class="font-mono font-bold text-emerald-400">+${data.pointsGained} pts</span>
                </div>
                <div class="flex items-center gap-3 mt-0.5">
                  <span class="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1">👑 ${data.famas} Fama${data.famas !== 1 ? 's' : ''} (+${data.famas * 25} pts)</span>
                  <span class="text-xs font-bold font-mono text-cyan-300 flex items-center gap-1">⚡ ${data.puntos} Punto${data.puntos !== 1 ? 's' : ''} (+${data.puntos * 1} pt)</span>
                </div>
              </div>
            `;
          }

          prependMyAttempt(data.guess, data.famas, data.puntos, data.pointsGained);

          if (data.isWin) {
            vibrate([100, 50, 100, 50, 200]);
            if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playVictoryFanfare();
            showToast('🎉 ¡FELICITACIONES! ¡HAS DESCUBIERTO EL CÓDIGO!', 'success');
          } else if (data.famas > 0) {
            if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playFamaSound();
          } else if (data.puntos > 0) {
            if (window.PuntoYFamaAudio) window.PuntoYFamaAudio.playPuntoSound();
          }

          clearDigits();
        }

        if (type === 'round:started') {
          isRoundActive = true;
          allowDuplicates = data.allowDuplicates;
          attemptsInRound = 0;
          if (myAttemptsCount) myAttemptsCount.textContent = '0 intentos';
          if (myHistoryList) myHistoryList.innerHTML = '<span class="text-center text-slate-500 text-xs py-4">Tus intentos aparecerán aquí.</span>';
          if (lastResultBox) lastResultBox.innerHTML = '<span class="text-xs text-slate-500 font-mono">Ingresa un número de 4 cifras y presiona Enviar</span>';
          if (roundStatusBadge) roundStatusBadge.textContent = `Ronda #${data.roundNumber} Activa`;
          clearDigits();
          showToast(`¡Comenzó la Ronda #${data.roundNumber}!`, 'info');
        }

        if (type === 'round:winner') {
          isRoundActive = false;
          if (roundStatusBadge) roundStatusBadge.textContent = 'Ronda Finalizada';
          const isMe = data.winner.id === playerId;
          if (isMe) {
            showToast('🏆 ¡ERES EL GANADOR DE LA RONDA!', 'success');
          } else {
            showToast(`🏆 ¡${data.winner.name} descifró el código secreto (${data.secretCode})!`, 'info');
          }
          updateLeaderboardRank(data.leaderboard);
        }

        if (type === 'leaderboard:update') {
          updateLeaderboardRank(data.leaderboard);
        }

      } catch (err) {
        console.error('Error procesando WS en móvil:', err);
      }
    };

    ws.onclose = () => {
      console.warn('Conexión perdida. Reconectando...');
      setTimeout(connectWebSocket, 2000);
    };
  }

  function updateLeaderboardRank(leaderboard) {
    if (!leaderboard) return;
    const myIndex = leaderboard.findIndex(p => p.id === playerId);
    if (myIndex !== -1) {
      const medals = ['🥇', '🥈', '🥉'];
      const rankText = myIndex < 3 ? `${medals[myIndex]} #${myIndex + 1}` : `#${myIndex + 1}`;
      if (playerRankBadge) playerRankBadge.textContent = rankText;
    }

    if (drawerRankingList) {
      drawerRankingList.innerHTML = leaderboard.map((p, idx) => {
        const isCurrent = p.id === playerId;
        return `
          <div class="p-2.5 rounded-xl ${isCurrent ? 'bg-emerald-950/40 border border-emerald-500/50' : 'bg-slate-950 border border-slate-800'} flex items-center justify-between text-xs font-mono">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-400 w-5">#${idx + 1}</span>
              <span class="text-lg">${p.avatar}</span>
              <span class="font-bold ${isCurrent ? 'text-emerald-300' : 'text-slate-200'} truncate max-w-[120px]">${p.name} ${isCurrent ? '(Tú)' : ''}</span>
            </div>
            <span class="font-bold text-emerald-400">${p.score} pts</span>
          </div>
        `;
      }).join('');
    }
  }

  // Eventos de Formulario de Registro
  if (formJoin) {
    formJoin.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputPlayerName.value.trim();
      if (!val) return;

      playerName = val;
      const profile = { id: playerId, name: playerName, avatar: playerAvatar };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'player:join',
          playerId,
          name: playerName,
          avatar: playerAvatar
        }));
      }
    });
  }

  // Eventos del Teclado Numérico Táctil
  keypadDigitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      appendDigit(btn.dataset.val);
    });
  });

  if (btnKeypadDel) {
    btnKeypadDel.addEventListener('click', deleteLastDigit);
  }

  if (btnKeypadSend) {
    btnKeypadSend.addEventListener('click', sendGuess);
  }

  // Drawer de Clasificación
  if (btnToggleLeaderboard) {
    btnToggleLeaderboard.onclick = () => {
      drawerLeaderboard.classList.remove('hidden');
    };
  }

  if (btnCloseDrawer) {
    btnCloseDrawer.onclick = () => {
      drawerLeaderboard.classList.add('hidden');
    };
  }

  if (drawerLeaderboard) {
    drawerLeaderboard.onclick = (e) => {
      if (e.target === drawerLeaderboard) {
        drawerLeaderboard.classList.add('hidden');
      }
    };
  }

  // Teclado físico para dispositivos móviles con teclado o pruebas en navegador
  window.addEventListener('keydown', (e) => {
    if (viewGame.classList.contains('hidden')) return;
    if (e.key >= '0' && e.key <= '9') {
      appendDigit(e.key);
    } else if (e.key === 'Backspace') {
      deleteLastDigit();
    } else if (e.key === 'Enter') {
      sendGuess();
    }
  });

  // Inicialización
  connectWebSocket();

})();
