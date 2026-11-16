/**
 * Pruebas automatizadas para la sala multijugador y el sistema de puntaje:
 * 1 Fama = 25 puntos
 * 1 Punto = 1 punto
 * Ocultamiento estricto del código en el feed público de pantalla
 */

const assert = require('assert');
const gameEngine = require('../js/gameLogic.js');

console.log('🧪 Iniciando pruebas de sala multijugador y puntaje...\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Detalle: ${err.message}`);
  }
}

// Simulador de Sala
class TestRoom {
  constructor(secretCode) {
    this.secretCode = secretCode;
    this.status = 'active';
    this.roundNumber = 1;
    this.maxRounds = 3;
    this.isMatchOver = false;
    this.matchWinner = null;
    this.players = new Map();
    this.feed = [];
    this.winner = null;
  }

  addPlayer(id, name, avatar) {
    this.players.set(id, {
      id,
      name,
      avatar,
      score: 0,
      attemptsCount: 0,
      bestAttempt: { famas: 0, puntos: 0 }
    });
  }

  startNewRound(newSecret) {
    this.roundNumber++;
    this.secretCode = newSecret;
    this.status = 'active';
    this.winner = null;
    this.feed = [];
    for (const player of this.players.values()) {
      player.attemptsCount = 0;
      player.bestAttempt = { famas: 0, puntos: 0 };
    }
  }

  guess(playerId, guessStr) {
    const player = this.players.get(playerId);
    const evalRes = gameEngine.evaluateGuess(this.secretCode, guessStr);
    const famas = evalRes.famas;
    const puntos = evalRes.puntos;
    const isWin = famas === 4;

    // REGLA SOLICITADA:
    // 1 Fama = 25 puntos
    // 1 Punto = 1 punto
    // Al ganar con 4 Famas = +300 puntos extras de bonificación
    const winBonus = isWin ? 300 : 0;
    const pointsGained = (famas * 25) + (puntos * 1) + winBonus;
    player.score += pointsGained;
    player.attemptsCount++;

    if (famas > player.bestAttempt.famas || (famas === player.bestAttempt.famas && puntos > player.bestAttempt.puntos)) {
      player.bestAttempt = { famas, puntos };
    }

    // FEED PÚBLICO: SOLO RESULTADO PUNTO O FAMA (SIN EL NÚMERO DE 4 CIFRAS)
    const publicItem = {
      playerId: player.id,
      playerName: player.name,
      famas,
      puntos,
      winBonus,
      pointsGained,
      isWin
    };
    this.feed.unshift(publicItem);

    if (isWin) {
      this.status = 'ended';
      this.winner = player;

      if (this.roundNumber >= this.maxRounds) {
        this.isMatchOver = true;
        this.matchWinner = this.getLeaderboard()[0];
      }
    }

    return {
      guess: guessStr, // Privado para el jugador
      famas,
      puntos,
      winBonus,
      pointsGained,
      publicItem
    };
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => b.score - a.score);
  }
}

// TEST 1: Puntaje exacto (1 Fama = 25 pts, 1 Punto = 1 pt)
test('Cálculo de puntaje: 1 Fama y 2 Puntos = 27 puntos', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Carlos', '👑');
  
  // Intento: 4198 -> 4 es Fama (1), 1 y 8 son Puntos (2)
  const res = room.guess('p1', '4198');
  assert.strictEqual(res.famas, 1);
  assert.strictEqual(res.puntos, 2);
  assert.strictEqual(res.pointsGained, 27); // 1*25 + 2*1
  assert.strictEqual(room.players.get('p1').score, 27);
});

// TEST 2: Solo Puntos
test('Cálculo de puntaje: 0 Famas y 3 Puntos = 3 puntos', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Ana', '🦊');
  
  // Intento: 8210 -> 8, 2, 1 son Puntos (3), 0 no está
  const res = room.guess('p1', '8210');
  assert.strictEqual(res.famas, 0);
  assert.strictEqual(res.puntos, 3);
  assert.strictEqual(res.pointsGained, 3);
  assert.strictEqual(room.players.get('p1').score, 3);
});

// TEST 3: 4 Famas = 400 puntos (100 base + 300 extras) y Victoria
test('Cálculo de puntaje: ganar con 4 Famas da 300 puntos extras (Total: 400 pts)', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Ganador', '⚡');
  
  const res = room.guess('p1', '4821');
  assert.strictEqual(res.famas, 4);
  assert.strictEqual(res.puntos, 0);
  assert.strictEqual(res.winBonus, 300);
  assert.strictEqual(res.pointsGained, 400); // 4*25 + 300
  assert.strictEqual(room.status, 'ended');
  assert.strictEqual(room.winner.name, 'Ganador');
});

// TEST 4: Feed público NO contiene las 4 cifras del intento
test('Privacidad en pantalla: el feed público SOLO tiene fama y puntos, NUNCA el número', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Sofia', '🚀');
  
  room.guess('p1', '1234');
  const feedItem = room.feed[0];
  
  assert.strictEqual(feedItem.guess, undefined);
  assert.strictEqual(feedItem.playerName, 'Sofia');
  assert.ok('famas' in feedItem);
  assert.ok('puntos' in feedItem);
  assert.ok('pointsGained' in feedItem);
});

// TEST 5: Tablero clasifica jugadores por puntaje
test('Tablero clasifica jugadores correctamente según puntaje acumulado', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Jugador Bajo', '🦁');
  room.addPlayer('p2', 'Jugador Alto', '👑');
  
  // p1 saca 1 punto (1 pt)
  room.guess('p1', '1999'); // 1 punto
  // p2 saca 2 famas (50 pts)
  room.guess('p2', '4899'); // 2 famas

  const lb = room.getLeaderboard();
  assert.strictEqual(lb[0].name, 'Jugador Alto');
  assert.strictEqual(lb[0].score, 50);
  assert.strictEqual(lb[1].name, 'Jugador Bajo');
  assert.strictEqual(lb[1].score, 1);
});

// TEST 6: Toda partida tiene 3 juegos y gana el jugador con más puntos
test('Toda partida tiene 3 juegos y gana el jugador con más puntos acumulados', () => {
  const room = new TestRoom('1234');
  room.addPlayer('p1', 'Jugador Consistente', '👑');
  room.addPlayer('p2', 'Jugador Rápido', '⚡');

  // JUEGO 1:
  // p1 adivina 2 famas y 1 punto = 51 pts
  room.guess('p1', '1256'); // 2F, 0P -> 50 pts
  // p2 descifra el código: 4 famas -> 400 pts (+300 extras)
  room.guess('p2', '1234'); // 4F -> 400 pts
  assert.strictEqual(room.roundNumber, 1);
  assert.strictEqual(room.isMatchOver, false);

  // JUEGO 2:
  room.startNewRound('5678');
  assert.strictEqual(room.roundNumber, 2);
  // p1 descifra el código: 4 famas -> 400 pts. Total acumulado p1: 50 + 400 = 450 pts
  room.guess('p1', '5678');
  assert.strictEqual(room.players.get('p1').score, 450);
  assert.strictEqual(room.isMatchOver, false);

  // JUEGO 3:
  room.startNewRound('9012');
  assert.strictEqual(room.roundNumber, 3);
  // p1 suma 3 famas = 75 pts. Total acumulado p1: 450 + 75 = 525 pts
  room.guess('p1', '9015');
  // p2 descifra el código: 4 famas -> 400 pts. Total acumulado p2: 400 + 400 = 800 pts
  room.guess('p2', '9012');
  assert.strictEqual(room.players.get('p2').score, 800);

  // Al finalizar el juego 3, la partida termina
  assert.strictEqual(room.isMatchOver, true);
  // Y gana el jugador con más puntos en la partida
  assert.strictEqual(room.matchWinner.name, 'Jugador Rápido');
  assert.strictEqual(room.matchWinner.score, 800);
});

// TEST 7: Expulsión de todos los jugadores al finalizar la partida para iniciar una nueva
test('kickAllPlayers: saca a todos los jugadores, notifica a los sockets y reinicia la sala', () => {
  const { MultiplayerRoom } = require('../server.js');
  const room = new MultiplayerRoom('TEST_KICK');
  room.startNewRound();
  
  // Agregar jugadores
  room.addOrUpdatePlayer('p1', 'Jugador 1', '👑');
  room.addOrUpdatePlayer('p2', 'Jugador 2', '🦊');
  
  // Simular sockets
  const sentMessagesP1 = [];
  const sentMessagesP2 = [];
  const mockWs1 = { readyState: 1, send: (data) => sentMessagesP1.push(JSON.parse(data)) };
  const mockWs2 = { readyState: 1, send: (data) => sentMessagesP2.push(JSON.parse(data)) };
  room.playerSockets.set(mockWs1, 'p1');
  room.playerSockets.set(mockWs2, 'p2');
  
  assert.strictEqual(room.players.size, 2);
  assert.strictEqual(room.playerSockets.size, 2);
  
  // Simular fin de partida de 3 juegos
  room.roundNumber = 3;
  room.isMatchOver = true;
  
  // Ejecutar expulsión
  room.kickAllPlayers('Partida terminada por el anfitrión');
  
  // Validar que la sala quedó completamente vacía y reiniciada
  assert.strictEqual(room.players.size, 0, 'Todos los jugadores deben ser eliminados');
  assert.strictEqual(room.playerSockets.size, 0, 'Todos los sockets deben ser desvinculados');
  assert.strictEqual(room.status, 'waiting', 'La sala debe quedar en estado de espera');
  assert.strictEqual(room.roundNumber, 0, 'El número de rondas debe reiniciar a 0');
  assert.strictEqual(room.isMatchOver, false, 'isMatchOver debe ser false para la nueva partida');
  assert.strictEqual(room.matchWinner, null, 'El ganador debe ser nulo');
  
  // Validar mensajes enviados a los celulares
  assert.strictEqual(sentMessagesP1.length, 1);
  assert.strictEqual(sentMessagesP1[0].type, 'player:kicked');
  assert.strictEqual(sentMessagesP2.length, 1);
  assert.strictEqual(sentMessagesP2[0].type, 'player:kicked');
});

console.log(`\n=========================================`);
console.log(`Resumen: ${passedTests} de ${totalTests} pruebas pasadas.`);
console.log(`=========================================\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
