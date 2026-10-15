/**
 * Controlador de la Pantalla Central del Anfitrión (Host / TV)
 * Gestiona WebSockets, Tablero en tiempo real, Feed de resultados y Efectos.
 */

(function () {
  'use strict';

  // Elementos DOM
  const qrCodeImg = document.getElementById('qr-code-img');
  const joinUrlText = document.getElementById('join-url-text');
  const playersCountBadge = document.getElementById('players-count-badge');
  const roundNumberText = document.getElementById('round-number-text');
  const roundStatusPill = document.getElementById('round-status-pill');
  const hostSecretSlots = document.getElementById('host-secret-slots');
  const labelDuplicates = document.getElementById('label-duplicates');

  const podiumContainer = document.getElementById('podium-container');
  const leaderboardTable = document.getElementById('leaderboard-table');
  const leaderboardEmptyState = document.getElementById('leaderboard-empty-state');

  const liveFeedList = document.getElementById('live-feed-list');
  const feedEmptyState = document.getElementById('feed-empty-state');
  const feedCounterBadge = document.getElementById('feed-counter-badge');

  const modalRoundWinner = document.getElementById('modal-round-winner');
  const winnerModalAvatar = document.getElementById('winner-modal-avatar');
  const winnerModalName = document.getElementById('winner-modal-name');
  const winnerModalSecret = document.getElementById('winner-modal-secret');
  const winnerModalAttempts = document.getElementById('winner-modal-attempts');
  const winnerModalScore = document.getElementById('winner-modal-score');

  const btnNewRound = document.getElementById('btn-new-round');
  const btnToggleDuplicates = document.getElementById('btn-toggle-duplicates');
  const btnResetGame = document.getElementById('btn-reset-game');
  const btnPeekCode = document.getElementById('btn-peek-code');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const btnModalNextRound = document.getElementById('btn-modal-next-round');
  const btnModalClose = document.getElementById('btn-modal-close');
  const toastContainer = document.getElementById('toast-container');
  const hostRoomBadge = document.getElementById('host-room-badge');
  const btnChangeRoom = document.getElementById('btn-change-room');

  const urlParams = new URLSearchParams(window.location.search);
  let currentRoomId = (urlParams.get('room') || 'default').toUpperCase().slice(0, 16);

  let ws = null;
  let feedCount = 0;
  let codeIsPeeked = false;
  let currentSecretCode = null;

  function updateRoomBadge() {
    if (hostRoomBadge) {
      hostRoomBadge.textContent = (currentRoomId === 'DEFAULT' || currentRoomId === 'default')
        ? 'SALA: PRINCIPAL'
        : `SALA: ${currentRoomId}`;
    }
  }

  // Cargar información de la sala y Código QR
  async function loadRoomInfo() {
    try {
      const isFile = location.protocol === 'file:' || !location.host;
      const apiBase = isFile ? 'http://localhost:3000' : '';
      const roomQuery = currentRoomId && currentRoomId !== 'DEFAULT' && currentRoomId !== 'default'
        ? `?room=${encodeURIComponent(currentRoomId)}`
        : '';

      const res = await fetch(`${apiBase}/api/info${roomQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (data.qrDataUrl && qrCodeImg) {
          qrCodeImg.src = data.qrDataUrl;
        }
        if (data.playUrl && joinUrlText) {
          joinUrlText.textContent = data.playUrl;
        }
        if (data.roomId) {
          currentRoomId = data.roomId;
          updateRoomBadge();
        }
      }
    } catch (err) {
      console.warn('No se pudo cargar /api/info:', err);
    }
  }

  // Notificaciones Toast flotantes
  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const colorClasses = {
      info: 'border-indigo-500/50 bg-slate-900/90 text-indigo-300',
      success: 'border-emerald-500/50 bg-slate-900/90 text-emerald-300',
      warning: 'border-amber-500/50 bg-slate-900/90 text-amber-300',
      error: 'border-rose-500/50 bg-slate-900/90 text-rose-300'
    }[type] || 'border-slate-700 bg-slate-900 text-slate-200';

    toast.className = `p-3 rounded-xl border ${colorClasses} shadow-xl backdrop-blur-md text-xs font-semibold flex items-center justify-between gap-3 animate-history-item pointer-events-auto`;
    toast.innerHTML = `<span>${message}</span><button class="text-slate-400 hover:text-white">&times;</button>`;

    toast.querySelector('button').onclick = () => toast.remove();
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4000);
  }

  // Lluvia de Confeti al Descubrir el Código
  function launchVictoryConfetti() {
    if (typeof confetti === 'function') {
      const duration = 4000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
      }, 250);
    }
  }

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  // Renderizar Podio y Lista de Jugadores
  function renderLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) {
      if (leaderboardEmptyState) leaderboardEmptyState.classList.remove('hidden');
      if (podiumContainer) podiumContainer.innerHTML = '';
      if (leaderboardTable) leaderboardTable.innerHTML = '';
      if (playersCountBadge) playersCountBadge.textContent = '0';
      return;
    }

    if (leaderboardEmptyState) leaderboardEmptyState.classList.add('hidden');
    if (playersCountBadge) playersCountBadge.textContent = leaderboard.length;

    // Renderizar Podio Top 3
    const top3 = leaderboard.slice(0, 3);
    const podiumMedals = ['🥇', '🥈', '🥉'];
    const podiumStyles = [
      'border-amber-400/60 bg-amber-950/20 text-amber-300 shadow-amber-500/20', // 1º Oro
      'border-slate-300/60 bg-slate-800/30 text-slate-200 shadow-slate-400/20', // 2º Plata
      'border-amber-700/60 bg-amber-950/20 text-amber-600 shadow-amber-700/20'  // 3º Bronce
    ];

    if (podiumContainer) {
      podiumContainer.innerHTML = top3.map((player, idx) => `
        <div class="p-3 rounded-2xl border ${podiumStyles[idx]} glow-card flex flex-col items-center text-center transition-all">
          <span class="text-2xl mb-1">${podiumMedals[idx]}</span>
          <div class="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-xl mb-1">
            ${player.avatar}
          </div>
          <span class="text-xs font-black text-white truncate max-w-[90px] block">${escapeHtml(player.name)}</span>
          <span class="font-mono text-sm font-black text-emerald-400 mt-1">${player.score} <span class="text-[10px] text-slate-400">pts</span></span>
          <span class="text-[10px] text-slate-400 font-mono mt-0.5">${player.attemptsCount} intentos</span>
        </div>
      `).join('');
    }

    // Renderizar Tabla Completa
    if (leaderboardTable) {
      leaderboardTable.innerHTML = leaderboard.map((player, idx) => {
        const medalOrRank = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const isOffline = player.isConnected === false;

        return `
          <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3 ${isOffline ? 'opacity-60' : ''}">
            
            <!-- Posición, Avatar y Nombre -->
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs font-black text-slate-400 w-6 text-center">${medalOrRank}</span>
              <div class="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0">
                ${player.avatar}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-white truncate max-w-[140px] sm:max-w-[180px]">${escapeHtml(player.name)}</span>
                  ${isOffline ? '<span class="text-[10px] font-mono text-rose-400 bg-rose-950/30 px-1.5 py-0.5 rounded">desconectado</span>' : ''}
                </div>
                <div class="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>${player.attemptsCount} intentos</span>
                  <span>•</span>
                  <span>Mejor: <strong class="text-emerald-400">${player.bestAttempt.famas}F</strong> <strong class="text-cyan-300">${player.bestAttempt.puntos}P</strong></span>
                </div>
              </div>
            </div>

            <!-- Puntaje Destacado -->
            <div class="text-right">
              <span class="font-mono text-lg font-black text-emerald-400">${player.score}</span>
              <span class="text-[10px] text-slate-400 font-mono block uppercase">Puntos</span>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  // Renderizar Entrada en el Feed de Resultados (SOLO FAMAS Y PUNTOS - SIN DÍGITOS)
  function prependFeedEntry(entry) {
    if (!liveFeedList) return;
    if (feedEmptyState) feedEmptyState.classList.add('hidden');

    feedCount++;
    if (feedCounterBadge) feedCounterBadge.textContent = `${feedCount} recibidos`;

    const card = document.createElement('div');
    card.className = 'p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 animate-history-item flex items-center justify-between gap-3 shadow-md';

    const isWin = entry.isWin;
    if (isWin) {
      card.classList.add('border-emerald-500/80', 'glow-fama');
    }

    const timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Insignias de resultado
    let resultBadgesHtml = '';
    if (entry.famas > 0) {
      resultBadgesHtml += `
        <span class="px-2.5 py-1 rounded-xl font-mono text-xs font-extrabold glow-fama flex items-center gap-1.5">
          <span>👑</span> ${entry.famas} Fama${entry.famas > 1 ? 's' : ''} (+${entry.famas * 25} pts)
        </span>
      `;
    }
    if (entry.puntos > 0) {
      resultBadgesHtml += `
        <span class="px-2.5 py-1 rounded-xl font-mono text-xs font-extrabold glow-punto flex items-center gap-1.5">
          <span>⚡</span> ${entry.puntos} Punto${entry.puntos > 1 ? 's' : ''} (+${entry.puntos * 1} pt${entry.puntos > 1 ? 's' : ''})
        </span>
      `;
    }
    if (entry.famas === 0 && entry.puntos === 0) {
      resultBadgesHtml += `
        <span class="px-2 py-0.5 rounded-lg font-mono text-xs text-slate-400 bg-slate-900 border border-slate-800">
          0 Famas, 0 Puntos (+0 pts)
        </span>
      `;
    }

    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg flex-shrink-0">
          ${entry.playerAvatar}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs sm:text-sm font-bold text-slate-200">${escapeHtml(entry.playerName)}</span>
            <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 mt-1">
            ${resultBadgesHtml}
          </div>
        </div>
      </div>

      <div class="text-right flex-shrink-0">
        <span class="font-mono text-xs font-black ${entry.pointsGained > 0 ? 'text-emerald-400' : 'text-slate-500'}">
          +${entry.pointsGained} pts
        </span>
        ${isWin ? '<span class="block text-[9px] font-mono text-amber-300 font-bold uppercase animate-pulse">¡Ganador!</span>' : ''}
      </div>
    `;

    liveFeedList.prepend(card);

    // Sonido
    if (window.PuntoYFamaAudio) {
      if (isWin) {
        window.PuntoYFamaAudio.playVictoryFanfare();
      } else if (entry.famas > 0) {
        window.PuntoYFamaAudio.playFamaSound();
      } else if (entry.puntos > 0) {
        window.PuntoYFamaAudio.playPuntoSound();
      } else {
        window.PuntoYFamaAudio.playKeyClick();
      }
    }
  }

  // Actualizar slots del código secreto en cabecera
  function renderSecretSlots(code, revealed = false) {
    if (!hostSecretSlots) return;
    if (revealed && code) {
      hostSecretSlots.innerHTML = code.split('').map(char => `
        <span class="w-7 h-9 rounded-lg bg-emerald-950/80 border border-emerald-500 flex items-center justify-center text-white font-black animate-history-item">${char}</span>
      `).join('');
    } else {
      hostSecretSlots.innerHTML = `
        <span class="w-7 h-9 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center">?</span>
        <span class="w-7 h-9 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center">?</span>
        <span class="w-7 h-9 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center">?</span>
        <span class="w-7 h-9 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center">?</span>
      `;
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // CONEXIÓN WEBSOCKETS
  function connectWebSocket() {
    const isFile = location.protocol === 'file:' || !location.host;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = isFile ? 'localhost:3000' : location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('Error al inicializar WebSocket:', err);
      showToast('No se pudo conectar al servidor. Asegúrate de iniciar "node server.js"', 'error');
      return;
    }

    ws.onopen = () => {
      console.log('✅ Host conectado al servidor WebSocket');
      ws.send(JSON.stringify({
        type: 'host:register',
        roomId: currentRoomId
      }));
      showToast((currentRoomId === 'DEFAULT' || currentRoomId === 'default') ? 'Conectado a la sala principal' : `Conectado a la Sala: ${currentRoomId}`, 'success');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, data } = msg;

        if (type === 'host:state') {
          if (data.roomId) {
            currentRoomId = data.roomId;
            updateRoomBadge();
          }
          if (roundNumberText) roundNumberText.textContent = `RONDA #${data.roundNumber} EN CURSO`;
          if (labelDuplicates) labelDuplicates.textContent = data.allowDuplicates ? 'Con Repetición' : 'Sin Repetir';
          currentSecretCode = data.secretCode;
          renderLeaderboard(data.leaderboard);
          if (data.feed && data.feed.length > 0) {
            liveFeedList.innerHTML = '';
            feedCount = 0;
            data.feed.slice().reverse().forEach(entry => prependFeedEntry(entry));
          }
        }

        if (type === 'round:started') {
          if (roundNumberText) roundNumberText.textContent = `RONDA #${data.roundNumber} EN CURSO`;
          if (modalRoundWinner) modalRoundWinner.classList.add('hidden');
          codeIsPeeked = false;
          currentSecretCode = null;
          renderSecretSlots(null, false);
          if (liveFeedList) liveFeedList.innerHTML = '';
          if (feedEmptyState) feedEmptyState.classList.remove('hidden');
          feedCount = 0;
          if (feedCounterBadge) feedCounterBadge.textContent = '0 recibidos';
          showToast(`¡Comenzó la Ronda #${data.roundNumber}!`, 'info');
        }

        if (type === 'host:player_joined') {
          showToast(`👤 ${data.player.avatar} ${data.player.name} se unió a la sala`, 'info');
          renderLeaderboard(data.leaderboard);
        }

        if (type === 'host:player_disconnected') {
          renderLeaderboard(data.leaderboard);
        }

        if (type === 'host:new_guess_feed') {
          prependFeedEntry(data.feedEntry);
          renderLeaderboard(data.leaderboard);
        }

        if (type === 'leaderboard:update') {
          renderLeaderboard(data.leaderboard);
        }

        if (type === 'round:winner') {
          currentSecretCode = data.secretCode;
          renderSecretSlots(data.secretCode, true);
          renderLeaderboard(data.leaderboard);

          if (modalRoundWinner) {
            winnerModalAvatar.textContent = data.winner.avatar;
            winnerModalName.textContent = data.winner.name;
            winnerModalSecret.textContent = data.secretCode;
            winnerModalAttempts.textContent = data.winner.attemptsCount;
            winnerModalScore.textContent = `${data.winner.score} pts`;
            modalRoundWinner.classList.remove('hidden');
          }

          launchVictoryConfetti();
          if (window.PuntoYFamaAudio) {
            window.PuntoYFamaAudio.playVictoryFanfare();
          }
          showToast(`🏆 ¡${data.winner.name} descifró las 4 cifras!`, 'success');
        }

        if (type === 'host:secret_code_peek') {
          currentSecretCode = data.secretCode;
          codeIsPeeked = !codeIsPeeked;
          renderSecretSlots(data.secretCode, codeIsPeeked);
          showToast(codeIsPeeked ? `Código secreto: ${data.secretCode}` : 'Código oculto', 'info');
        }

        if (type === 'game:reset') {
          location.reload();
        }

      } catch (err) {
        console.error('Error procesando mensaje WS:', err);
      }
    };

    ws.onclose = () => {
      console.warn('⚠️ Conexión WS perdida. Reintentando en 2 segundos...');
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error('WS Error:', err);
    };
  }

  // Event Listeners de Botones
  if (btnNewRound) {
    btnNewRound.onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'host:start_round', roomId: currentRoomId }));
      }
    };
  }

  if (btnModalNextRound) {
    btnModalNextRound.onclick = () => {
      if (modalRoundWinner) modalRoundWinner.classList.add('hidden');
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'host:start_round', roomId: currentRoomId }));
      }
    };
  }

  if (btnModalClose) {
    btnModalClose.onclick = () => {
      if (modalRoundWinner) modalRoundWinner.classList.add('hidden');
    };
  }

  if (btnToggleDuplicates) {
    btnToggleDuplicates.onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'host:toggle_duplicates', roomId: currentRoomId }));
      }
    };
  }

  if (btnResetGame) {
    btnResetGame.onclick = () => {
      if (confirm('¿Estás seguro de que deseas reiniciar todos los puntajes y la partida?')) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'host:reset_all', roomId: currentRoomId }));
        }
      }
    };
  }

  if (btnPeekCode) {
    btnPeekCode.onclick = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'host:reveal_code', roomId: currentRoomId }));
      }
    };
  }

  if (btnChangeRoom) {
    btnChangeRoom.onclick = () => {
      const isDefault = currentRoomId === 'DEFAULT' || currentRoomId === 'default';
      const input = prompt(
        'Escribe el código o nombre para tu sala privada (ej: AMIGOS, FAMILIA):\nO déjalo vacío para volver a la Sala Principal:',
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

  if (btnFullscreen) {
    btnFullscreen.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  if (btnSoundToggle) {
    btnSoundToggle.onclick = () => {
      if (window.PuntoYFamaAudio) {
        const isMuted = window.PuntoYFamaAudio.toggleMute();
        btnSoundToggle.textContent = isMuted ? '🔇' : '🔊';
      }
    };
  }

  // Inicialización
  loadRoomInfo();
  connectWebSocket();

})();
