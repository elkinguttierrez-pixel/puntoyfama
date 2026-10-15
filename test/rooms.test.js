/**
 * Pruebas unitarias para soporte multi-sala (Room isolation)
 */

const assert = require('assert');
const http = require('http');

console.log('🧪 Iniciando prueba de salas múltiples aisladas...\n');

// Iniciar servidor temporal para probar API
require('../server.js');

setTimeout(async () => {
  try {
    // 1. Probar que /api/info sin sala devuelve la sala por defecto
    const defaultInfo = await fetchJson('http://localhost:3000/api/info');
    assert.strictEqual(defaultInfo.roomId, 'DEFAULT');
    assert.ok(defaultInfo.playUrl.endsWith('/play'));
    assert.ok(defaultInfo.qrDataUrl.startsWith('data:image/png;base64,'));
    console.log('  ✅ PASS: Sala por defecto detectada correctamente');

    // 2. Probar que /api/info con ?room=AMIGOS genera la URL y QR específicos de esa sala
    const amigosInfo = await fetchJson('http://localhost:3000/api/info?room=AMIGOS');
    assert.strictEqual(amigosInfo.roomId, 'AMIGOS');
    assert.ok(amigosInfo.playUrl.includes('room=AMIGOS'), 'playUrl debe contener room=AMIGOS');
    assert.ok(amigosInfo.qrDataUrl.startsWith('data:image/png;base64,'));
    console.log('  ✅ PASS: Sala personalizada AMIGOS genera QR y URL aislados');

    // 3. Probar endpoint de health check
    const health = await fetchJson('http://localhost:3000/healthz');
    assert.strictEqual(health.status, 'ok');
    assert.ok(health.roomsActive >= 2);
    console.log('  ✅ PASS: Health check cloud (/healthz) funcionando');

    console.log('\n=========================================');
    console.log('🎉 ¡Pruebas de salas superadas exitosamente!');
    console.log('=========================================\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error en prueba de salas:', err);
    process.exit(1);
  }
}, 500);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}
