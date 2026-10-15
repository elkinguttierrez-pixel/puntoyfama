/**
 * Prueba de Integración Extremo a Extremo (E2E) con WebSockets
 * Valida la comunicación simultánea entre Host (Pantalla) y múltiples Celulares
 */

const { WebSocket } = require('ws');
const assert = require('assert');

// Iniciar servidor
require('../server.js');

setTimeout(async () => {
  console.log('🧪 Iniciando prueba E2E de WebSockets (Host + 2 Celulares)...\n');

  try {
    // 1. Conectar Pantalla Central (Host)
    const hostWs = new WebSocket('ws://localhost:3000');
    let hostStateReceived = false;
    let hostFeedReceived = false;
    let winnerAnnounced = false;

    await new Promise((resolve) => hostWs.on('open', resolve));
    hostWs.send(JSON.stringify({ type: 'host:register' }));

    hostWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'host:state') {
        hostStateReceived = true;
      }
      if (msg.type === 'host:new_guess_feed') {
        hostFeedReceived = true;
        // VALIDAR PRIVACIDAD: En pantalla no debe venir el número de 4 cifras
        assert.strictEqual(msg.data.feedEntry.guess, undefined, 'El feed público no debe contener los dígitos ingresados');
        assert.ok('famas' in msg.data.feedEntry, 'El feed debe contener famas');
        assert.ok('puntos' in msg.data.feedEntry, 'El feed debe contener puntos');
      }
      if (msg.type === 'round:winner') {
        winnerAnnounced = true;
      }
    });

    // 2. Conectar Celular 1 (Carlos)
    const p1Ws = new WebSocket('ws://localhost:3000');
    await new Promise((resolve) => p1Ws.on('open', resolve));
    p1Ws.send(JSON.stringify({
      type: 'player:join',
      playerId: 'player_carlos',
      name: 'Carlos',
      avatar: '👑'
    }));

    // 3. Conectar Celular 2 (Sofia)
    const p2Ws = new WebSocket('ws://localhost:3000');
    await new Promise((resolve) => p2Ws.on('open', resolve));
    p2Ws.send(JSON.stringify({
      type: 'player:join',
      playerId: 'player_sofia',
      name: 'Sofia',
      avatar: '🦊'
    }));

    // Esperar registro
    await new Promise((r) => setTimeout(r, 400));

    // 4. Carlos envía un intento desde su celular
    p1Ws.send(JSON.stringify({
      type: 'player:guess',
      playerId: 'player_carlos',
      guess: '1234'
    }));

    // Esperar respuesta de Carlos
    const p1Result = await new Promise((resolve) => {
      p1Ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'player:guess_result') {
          resolve(msg.data);
        }
      });
    });

    console.log('  ✅ Carlos recibió resultado privado en su celular:', p1Result);
    assert.strictEqual(p1Result.guess, '1234');
    assert.strictEqual(p1Result.pointsGained, (p1Result.famas * 25) + (p1Result.puntos * 1));

    // 5. Sofia envía un intento desde su celular
    p2Ws.send(JSON.stringify({
      type: 'player:guess',
      playerId: 'player_sofia',
      guess: '5678'
    }));

    const p2Result = await new Promise((resolve) => {
      p2Ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'player:guess_result') {
          resolve(msg.data);
        }
      });
    });

    console.log('  ✅ Sofia recibió resultado privado en su celular:', p2Result);
    assert.strictEqual(p2Result.guess, '5678');
    assert.strictEqual(p2Result.pointsGained, (p2Result.famas * 25) + (p2Result.puntos * 1));

    await new Promise((r) => setTimeout(r, 500));

    assert.ok(hostStateReceived, 'Host recibió estado inicial');
    assert.ok(hostFeedReceived, 'Host recibió feed de resultados');

    console.log('\n======================================================');
    console.log('🎉 ¡Prueba de integración E2E superada exitosamente!');
    console.log('======================================================\n');

    hostWs.close();
    p1Ws.close();
    p2Ws.close();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error en prueba E2E:', err);
    process.exit(1);
  }
}, 600);
