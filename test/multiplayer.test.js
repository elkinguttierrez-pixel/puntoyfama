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

  guess(playerId, guessStr) {
    const player = this.players.get(playerId);
    const evalRes = gameEngine.evaluateGuess(this.secretCode, guessStr);
    const famas = evalRes.famas;
    const puntos = evalRes.puntos;

    // REGLA SOLICITADA:
    // 1 Fama = 25 puntos
    // 1 Punto = 1 punto
    const pointsGained = (famas * 25) + (puntos * 1);
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
      pointsGained,
      isWin: famas === 4
    };
    this.feed.unshift(publicItem);

    if (famas === 4) {
      this.status = 'ended';
      this.winner = player;
    }

    return {
      guess: guessStr, // Privado para el jugador
      famas,
      puntos,
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

// TEST 3: 4 Famas = 100 puntos y Victoria
test('Cálculo de puntaje: 4 Famas = 100 puntos y Victoria inmediata', () => {
  const room = new TestRoom('4821');
  room.addPlayer('p1', 'Ganador', '⚡');
  
  const res = room.guess('p1', '4821');
  assert.strictEqual(res.famas, 4);
  assert.strictEqual(res.puntos, 0);
  assert.strictEqual(res.pointsGained, 100); // 4*25
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

console.log(`\n=========================================`);
console.log(`Resumen: ${passedTests} de ${totalTests} pruebas pasadas.`);
console.log(`=========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
