/**
 * Servidor HTTP + WebSockets para Punto y Fama (Producción & Cloud Ready)
 * 
 * Características para despliegue en internet:
 * - Detección dinámica de dominio público / proxy inverso (Render, Railway, Fly.io, ngrok)
 * - Código QR automático generado con la URL pública correcta (accesible desde 4G/5G/Wi-Fi)
 * - Soporte para múltiples salas simultáneas (Room Codes) sin interferencias
 * - Keep-alive Heartbeat (Ping/Pong cada 25s) para prevenir desconexiones de nube
 * - Sanitización estricta de nombres y protección anti-spam
 * - Encabezados de caché optimizados (HTML fresco, estáticos cacheados)
 * - Apagado elegante (Graceful Shutdown)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');
const gameEngine = require('./js/gameLogic.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Caché en memoria para códigos QR para no recalcularlos innecesariamente
const qrCache = new Map();

/**
 * Obtiene la dirección IPv4 local (para uso en red local Wi-Fi)
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

/**
 * Determina dinámicamente la URL base pública según el entorno:
 * 1. Variable de entorno PUBLIC_URL si está definida (ej: https://mi-app.onrender.com)
 * 2. Encabezados de proxy x-forwarded-host / host de la petición entrante
 * 3. IP local para pruebas en LAN Wi-Fi
 */
function getBaseUrl(req) {
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL.replace(/\/+$/, '');
  }

  if (req && req.headers) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = forwardedHost || req.headers.host;

    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      const proto = forwardedProto || (req.socket && req.socket.encrypted ? 'https' : 'http');
      return `${proto}://${host}`;
    }
  }

  return `http://${LOCAL_IP}:${PORT}`;
}

/**
 * SALA DE JUEGO MULTIJUGADOR
 */
class MultiplayerRoom {
  constructor(roomId = 'default') {
    this.roomId = roomId;
    this.codeLength = 4;
    this.allowDuplicates = false;
    this.status = 'waiting';
    this.secretCode = '';
    this.roundNumber = 0;
    this.players = new Map();
    this.feed = [];
    this.winner = null;
    this.startTime = null;
    this.endTime = null;
    this.lastActivity = Date.now();

    // Conexiones WebSocket asociadas a esta sala
    this.hostSockets = new Set();
    this.playerSockets = new Map(); // ws -> playerId
    this.playerLastGuessTime = new Map(); // playerId -> timestamp (anti-spam)
  }

  broadcastToHosts(messageObj) {
    const data = JSON.stringify(messageObj);
    for (const client of this.hostSockets) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  broadcastToAll(messageObj) {
    const data = JSON.stringify(messageObj);
    for (const client of this.hostSockets) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
    for (const [client] of this.playerSockets) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  startNewRound() {
    this.lastActivity = Date.now();
    this.roundNumber++;
    this.secretCode = gameEngine.generateSecretCode(this.codeLength, this.allowDuplicates);
    this.status = 'active';
    this.winner = null;
    this.startTime = Date.now();
    this.endTime = null;
    this.feed = [];

    for (const player of this.players.values()) {
      player.roundScore = 0;
      player.attemptsCount = 0;
      player.history = [];
      player.bestAttempt = { famas: 0, puntos: 0 };
    }

    console.log(`[Sala: ${this.roomId}][Ronda #${this.roundNumber}] Código secreto: ${this.secretCode} (Duplicados: ${this.allowDuplicates})`);
  }

  resetAll() {
    this.lastActivity = Date.now();
    this.status = 'waiting';
    this.roundNumber = 0;
    this.secretCode = '';
    this.winner = null;
    this.feed = [];
    for (const player of this.players.values()) {
      player.score = 0;
      player.roundScore = 0;
      player.attemptsCount = 0;
      player.history = [];
      player.bestAttempt = { famas: 0, puntos: 0 };
    }
  }

  addOrUpdatePlayer(id, name, avatar) {
    this.lastActivity = Date.now();
    const cleanName = (name || '').replace(/<[^>]*>?/gm, '').trim().slice(0, 15) || 'Jugador';
    const cleanAvatar = (avatar || '🎯').slice(0, 4);

    if (this.players.has(id)) {
      const p = this.players.get(id);
      p.name = cleanName;
      p.avatar = cleanAvatar;
      p.isConnected = true;
      return p;
    }

    const newPlayer = {
      id,
      name: cleanName,
      avatar: cleanAvatar,
      score: 0,
      roundScore: 0,
      attemptsCount: 0,
      bestAttempt: { famas: 0, puntos: 0 },
      history: [],
      isConnected: true,
      joinedAt: Date.now()
    };
    this.players.set(id, newPlayer);
    return newPlayer;
  }

  processGuess(playerId, guess) {
    this.lastActivity = Date.now();

    // Protección anti-spam: máximo 1 intento cada 350ms por jugador
    const now = Date.now();
    const lastGuess = this.playerLastGuessTime.get(playerId) || 0;
    if (now - lastGuess < 350) {
      return { success: false, error: 'Por favor espera un instante antes de enviar otro intento.' };
    }
    this.playerLastGuessTime.set(playerId, now);

    if (this.status !== 'active') {
      return {
        success: false,
        error: this.status === 'ended'
          ? 'La ronda actual ya ha finalizado. Espera la siguiente ronda.'
          : 'La partida aún no ha comenzado. El anfitrión debe iniciarla.'
      };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Jugador no registrado en la sala.' };
    }

    const validation = gameEngine.validateGuess(guess, this.codeLength, this.allowDuplicates);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Evaluación estricta
    const evalRes = gameEngine.evaluateGuess(this.secretCode, guess);
    const famas = evalRes.famas;
    const puntos = evalRes.puntos;

    // SISTEMA DE PUNTAJE SOLICITADO:
    // 1 Fama = 25 puntos
    // 1 Punto = 1 punto
    const pointsGained = (famas * 25) + (puntos * 1);

    player.score += pointsGained;
    player.roundScore += pointsGained;
    player.attemptsCount++;

    if (famas > player.bestAttempt.famas || (famas === player.bestAttempt.famas && puntos > player.bestAttempt.puntos)) {
      player.bestAttempt = { famas, puntos };
    }

    // Registro privado para el celular del jugador (incluye sus dígitos ingresados)
    const privateAttempt = {
      attemptNumber: player.attemptsCount,
      guess: guess,
      famas,
      puntos,
      pointsGained,
      timestamp: Date.now()
    };
    player.history.unshift(privateAttempt);

    // Registro público para la pantalla central (Host / TV)
    // REGLA FUNDAMENTAL: EN PANTALLA SOLO APARECE EL RESULTADO PUNTO O FAMA (NUNCA EL NÚMERO)
    const isWin = famas === this.codeLength;
    const publicFeedEntry = {
      id: 'feed_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar,
      famas,
      puntos,
      pointsGained,
      isWin,
      timestamp: Date.now()
    };

    this.feed.unshift(publicFeedEntry);
    if (this.feed.length > 50) this.feed.pop();

    if (isWin) {
      this.status = 'ended';
      this.endTime = Date.now();
      this.winner = {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        attemptsCount: player.attemptsCount,
        durationSeconds: Math.floor((this.endTime - this.startTime) / 1000)
      };
    }

    return {
      success: true,
      guess,
      famas,
      puntos,
      pointsGained,
      totalScore: player.score,
      roundScore: player.roundScore,
      attemptsCount: player.attemptsCount,
      isWin,
      publicFeedEntry
    };
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        roundScore: p.roundScore,
        attemptsCount: p.attemptsCount,
        bestAttempt: p.bestAttempt,
        isConnected: p.isConnected
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.bestAttempt.famas !== a.bestAttempt.famas) return b.bestAttempt.famas - a.bestAttempt.famas;
        return a.attemptsCount - b.attemptsCount;
      });
  }

  getHostState(playUrl) {
    return {
      roomId: this.roomId,
      status: this.status,
      roundNumber: this.roundNumber,
      codeLength: this.codeLength,
      allowDuplicates: this.allowDuplicates,
      secretCode: this.status === 'ended' ? this.secretCode : null,
      winner: this.winner,
      leaderboard: this.getLeaderboard(),
      feed: this.feed,
      playUrl: playUrl || null,
      playersCount: this.players.size
    };
  }
}

/**
 * GESTOR MULTI-SALA (ROOM MANAGER)
 */
class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  getOrCreate(rawRoomId = 'default') {
    const roomId = (rawRoomId || 'default').toString().trim().toUpperCase().slice(0, 16) || 'DEFAULT';
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new MultiplayerRoom(roomId);
      room.startNewRound();
      this.rooms.set(roomId, room);
    }
    return room;
  }

  cleanupInactive() {
    const threshold = Date.now() - (12 * 60 * 60 * 1000); // 12 horas sin actividad
    for (const [id, room] of this.rooms.entries()) {
      if (id !== 'DEFAULT' && id !== 'default' && room.lastActivity < threshold && room.players.size === 0) {
        this.rooms.delete(id);
      }
    }
  }
}

const roomManager = new RoomManager();
// Inicializar sala principal
const defaultRoom = roomManager.getOrCreate('default');

// Limpieza periódica de salas inactivas cada 30 minutos
setInterval(() => roomManager.cleanupInactive(), 30 * 60 * 1000);

/**
 * SERVIDOR HTTP ESTÁTICO Y API REST
 */
const server = http.createServer(async (req, res) => {
  // Manejo de CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const hostHeader = req.headers.host || 'localhost';
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${hostHeader}`);
  } catch (e) {
    parsedUrl = { pathname: req.url.split('?')[0], searchParams: new URLSearchParams() };
  }

  let safeUrl = parsedUrl.pathname;

  // Rutas amigables
  if (safeUrl === '/' || safeUrl === '') {
    safeUrl = '/index.html';
  } else if (safeUrl === '/play') {
    safeUrl = '/play.html';
  } else if (safeUrl === '/host') {
    safeUrl = '/host.html';
  }

  // Health check para plataformas cloud (Render, Railway, Fly.io, etc.)
  if (safeUrl === '/healthz' || safeUrl === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), roomsActive: roomManager.rooms.size }));
    return;
  }

  // API para obtener información dinámica y código QR de sala
  if (safeUrl === '/api/info') {
    try {
      const rawRoomId = parsedUrl.searchParams.get('room') || 'default';
      const room = roomManager.getOrCreate(rawRoomId);

      const baseUrl = getBaseUrl(req);
      const isCustomRoom = room.roomId !== 'DEFAULT' && room.roomId !== 'default';
      const playUrl = isCustomRoom
        ? `${baseUrl}/play?room=${encodeURIComponent(room.roomId)}`
        : `${baseUrl}/play`;

      // Obtener o generar QR en caché
      let qrDataUrl = qrCache.get(playUrl);
      if (!qrDataUrl) {
        qrDataUrl = await QRCode.toDataURL(playUrl, {
          margin: 1,
          width: 320,
          color: {
            dark: '#10b981', // Verde esmeralda neón
            light: '#020617'  // Fondo Slate 950
          }
        });
        qrCache.set(playUrl, qrDataUrl);
        // Limitar tamaño de caché
        if (qrCache.size > 100) qrCache.clear();
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        roomId: room.roomId,
        baseUrl: baseUrl,
        playUrl: playUrl,
        qrDataUrl: qrDataUrl,
        roomStatus: room.status,
        roundNumber: room.roundNumber,
        playersCount: room.players.size,
        allowDuplicates: room.allowDuplicates
      }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  const filePath = path.join(BASE_DIR, safeUrl);

  // Prevenir Directory Traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Prohibido');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Recurso no encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Encabezados de caché optimizados para producción
    const cacheHeader = ext === '.html'
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=86400';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheHeader
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  });
});

/**
 * SERVIDOR WEBSOCKETS EN TIEMPO REAL
 */
const wss = new WebSocketServer({ server });

// Heartbeat activo para evitar que hosts cloud corten conexiones inactivas
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  });
}, 25000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  let boundRoom = defaultRoom;
  let boundPlayerId = null;
  let isHost = false;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const type = data.type;
      const targetRoomId = data.roomId || boundRoom.roomId || 'default';
      const room = roomManager.getOrCreate(targetRoomId);
      boundRoom = room;

      // ------------------------------------
      // EVENTOS DEL ANFITRIÓN (PANTALLA / TV)
      // ------------------------------------
      if (type === 'host:register') {
        isHost = true;
        room.hostSockets.add(ws);
        ws.send(JSON.stringify({
          type: 'host:state',
          data: room.getHostState()
        }));
        return;
      }

      if (type === 'host:start_round') {
        room.startNewRound();
        room.broadcastToAll({
          type: 'round:started',
          data: {
            roomId: room.roomId,
            roundNumber: room.roundNumber,
            codeLength: room.codeLength,
            allowDuplicates: room.allowDuplicates
          }
        });
        room.broadcastToHosts({
          type: 'host:state',
          data: room.getHostState()
        });
        return;
      }

      if (type === 'host:reset_all') {
        room.resetAll();
        room.broadcastToAll({
          type: 'game:reset',
          data: room.getHostState()
        });
        return;
      }

      if (type === 'host:toggle_duplicates') {
        room.allowDuplicates = !room.allowDuplicates;
        room.broadcastToHosts({
          type: 'host:state',
          data: room.getHostState()
        });
        return;
      }

      if (type === 'host:reveal_code') {
        ws.send(JSON.stringify({
          type: 'host:secret_code_peek',
          data: { secretCode: room.secretCode }
        }));
        return;
      }

      // ------------------------------------
      // EVENTOS DE LOS JUGADORES (CELULARES)
      // ------------------------------------
      if (type === 'player:join') {
        const { playerId, name, avatar } = data;
        const id = playerId || ('p_' + Math.random().toString(36).substr(2, 9));
        boundPlayerId = id;
        room.playerSockets.set(ws, id);

        const player = room.addOrUpdatePlayer(id, name, avatar);

        // Confirmar unión al celular
        ws.send(JSON.stringify({
          type: 'player:joined',
          data: {
            roomId: room.roomId,
            player,
            roomStatus: room.status,
            roundNumber: room.roundNumber,
            allowDuplicates: room.allowDuplicates,
            leaderboard: room.getLeaderboard()
          }
        }));

        // Notificar al Host de esta sala
        room.broadcastToHosts({
          type: 'host:player_joined',
          data: {
            player,
            leaderboard: room.getLeaderboard(),
            playersCount: room.players.size
          }
        });
        return;
      }

      if (type === 'player:guess') {
        const { playerId, guess } = data;
        const effectiveId = playerId || boundPlayerId;
        const result = room.processGuess(effectiveId, guess);

        if (!result.success) {
          ws.send(JSON.stringify({
            type: 'player:guess_error',
            data: { error: result.error }
          }));
          return;
        }

        // Respuesta privada al celular (con sus dígitos y desglose)
        ws.send(JSON.stringify({
          type: 'player:guess_result',
          data: {
            guess: result.guess,
            famas: result.famas,
            puntos: result.puntos,
            pointsGained: result.pointsGained,
            totalScore: result.totalScore,
            roundScore: result.roundScore,
            attemptsCount: result.attemptsCount,
            isWin: result.isWin
          }
        }));

        // Emisión pública al Host de esta sala (SOLO FAMAS/PUNTOS - NUNCA EL NÚMERO)
        room.broadcastToHosts({
          type: 'host:new_guess_feed',
          data: {
            feedEntry: result.publicFeedEntry,
            leaderboard: room.getLeaderboard()
          }
        });

        // Actualizar clasificación en todos los clientes de esta sala
        room.broadcastToAll({
          type: 'leaderboard:update',
          data: {
            leaderboard: room.getLeaderboard()
          }
        });

        // Victoria
        if (result.isWin) {
          room.broadcastToAll({
            type: 'round:winner',
            data: {
              winner: room.winner,
              secretCode: room.secretCode,
              leaderboard: room.getLeaderboard()
            }
          });
        }
        return;
      }

    } catch (err) {
      console.error('[WebSocket Error]', err);
    }
  });

  ws.on('close', () => {
    if (isHost && boundRoom) {
      boundRoom.hostSockets.delete(ws);
    }
    if (boundPlayerId && boundRoom) {
      const p = boundRoom.players.get(boundPlayerId);
      if (p) {
        p.isConnected = false;
        boundRoom.broadcastToHosts({
          type: 'host:player_disconnected',
          data: { playerId: boundPlayerId, leaderboard: boundRoom.getLeaderboard() }
        });
      }
      boundRoom.playerSockets.delete(ws);
    }
  });
});

// Inicializar la sala principal
defaultRoom.startNewRound();

server.listen(PORT, '0.0.0.0', () => {
  const publicUrlEnv = process.env.PUBLIC_URL ? ` (Public URL: ${process.env.PUBLIC_URL})` : '';
  console.log(`\n======================================================`);
  console.log(`🎯 PUNTO Y FAMA — MULTIJUGADOR EN VIVO (CLOUD & LOCAL READY)`);
  console.log(`======================================================`);
  console.log(`🖥️  Pantalla Principal (Host / TV): http://localhost:${PORT}/host`);
  console.log(`📲  Acceso Móvil LAN:               http://${LOCAL_IP}:${PORT}/play${publicUrlEnv}`);
  console.log(`🌐  Red Local IP:                   ${LOCAL_IP}`);
  console.log(`⚙️  Reglas de Puntaje:              1 Fama = 25 pts | 1 Punto = 1 pt`);
  console.log(`🔒  Privacidad en Pantalla:         Solo resultados Fama/Punto (Sin dígitos)`);
  console.log(`🚀  Salas Dinámicas:                Soportadas (?room=SALA)`);
  console.log(`======================================================\n`);
});

// Manejo de apagado elegante en entornos cloud
function gracefulShutdown(signal) {
  console.log(`\nRecibida señal ${signal}. Cerrando servidor limpiamente...`);
  clearInterval(heartbeatInterval);
  wss.close(() => {
    server.close(() => {
      console.log('Servidor finalizado con éxito.');
      process.exit(0);
    });
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
