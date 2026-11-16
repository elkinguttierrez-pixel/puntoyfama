/**
 * Prueba de Integración para el Botón de Expulsar/Sacar a todos los jugadores
 * Valida que:
 * 1. Los celulares conectados reciben la notificación 'player:kicked'
 * 2. La sala queda limpia y reiniciada en estado 'waiting' con 0 jugadores
 * 3. El anfitrión recibe el estado actualizado con 0 jugadores
 * 4. Los jugadores pueden volver a unirse desde cero para una nueva partida
 */

const { WebSocket } = require('ws');
const assert = require('assert');

// Iniciar servidor
require('../server.js');

setTimeout(async () => {
  console.log('🧪 Iniciando prueba de expulsión de todos los jugadores (kick_all_players)...\n');

  try {
    const roomId = 'TEST_KICK_E2E';

    // 1. Conectar Pantalla Central (Host)
    const hostWs = new WebSocket('ws://localhost:3000');
    let hostPlayersCount = 0;
    let lastHostState = null;

    await new Promise((resolve) => hostWs.on('open', resolve));
    hostWs.send(JSON.stringify({ type: 'host:register', roomId }));

    hostWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'host:state') {
        lastHostState = msg.data;
        hostPlayersCount = msg.data.playersCount;
      }
      if (msg.type === 'host:player_joined') {
        hostPlayersCount = msg.data.playersCount;
      }
    });

    // 2. Conectar Celular 1 (Carlos)
    const p1Ws = new WebSocket('ws://localhost:3000');
    await new Promise((resolve) => p1Ws.on('open', resolve));
    let p1Kicked = false;
    let p1JoinedAgain = false;

    p1Ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'player:kicked') {
        p1Kicked = true;
      }
      if (msg.type === 'player:joined' && p1Kicked) {
        p1JoinedAgain = true;
      }
    });

    p1Ws.send(JSON.stringify({
      type: 'player:join',
      roomId,
      playerId: 'p_carlos',
      name: 'Carlos',
      avatar: '👑'
    }));

    // 3. Conectar Celular 2 (Sofia)
    const p2Ws = new WebSocket('ws://localhost:3000');
    await new Promise((resolve) => p2Ws.on('open', resolve));
    let p2Kicked = false;

    p2Ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'player:kicked') {
        p2Kicked = true;
      }
    });

    p2Ws.send(JSON.stringify({
      type: 'player:join',
      roomId,
      playerId: 'p_sofia',
      name: 'Sofia',
      avatar: '🦊'
    }));

    // Esperar a que ambos jugadores se unan
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(hostPlayersCount, 2, 'Host debe tener 2 jugadores antes de expulsar');

    console.log('  ✅ 2 jugadores unidos a la sala:', hostPlayersCount);

    // 4. El Anfitrión presiona el botón para sacar a todos los jugadores
    hostWs.send(JSON.stringify({
      type: 'host:kick_all_players',
      roomId
    }));

    // Esperar respuesta de expulsión
    await new Promise((r) => setTimeout(r, 400));

    assert.ok(p1Kicked, 'Carlos debe haber recibido el evento player:kicked');
    assert.ok(p2Kicked, 'Sofia debe haber recibido el evento player:kicked');
    console.log('  ✅ Ambos jugadores recibieron evento player:kicked');

    assert.strictEqual(hostPlayersCount, 0, 'La sala debe quedar con 0 jugadores');
    assert.strictEqual(lastHostState.status, 'waiting', 'La sala debe quedar en espera de nueva partida');
    assert.strictEqual(lastHostState.roundNumber, 0, 'La ronda debe quedar en 0');
    console.log('  ✅ El Anfitrión recibió sala vaciada y reiniciada a esperando nueva partida');

    // 5. Un jugador se registra de nuevo para la nueva partida
    p1Ws.send(JSON.stringify({
      type: 'player:join',
      roomId,
      playerId: 'p_carlos_new',
      name: 'Carlos Reincorporado',
      avatar: '🎯'
    }));

    await new Promise((r) => setTimeout(r, 400));
    assert.ok(p1JoinedAgain, 'Carlos debe poder unirse exitosamente a la nueva partida');
    assert.strictEqual(hostPlayersCount, 1, 'Host debe reflejar el nuevo jugador');
    console.log('  ✅ Jugador reincorporado exitosamente para la nueva partida');

    console.log('\n======================================================');
    console.log('🎉 ¡Prueba de kick_all_players superada exitosamente!');
    console.log('======================================================\n');

    hostWs.close();
    p1Ws.close();
    p2Ws.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error en prueba kick_all_players:', err);
    process.exit(1);
  }
}, 500);
