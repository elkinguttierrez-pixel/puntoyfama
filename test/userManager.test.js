/**
 * Pruebas unitarias para UserManager
 */

// Mock de localStorage para Node.js
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; }
};

const userManager = require('../js/userManager.js');
const assert = require('assert');

console.log('🧪 Iniciando pruebas de UserManager...\n');

const users = userManager.loadUsers();
assert.strictEqual(users.length, 2, 'Deben existir 2 usuarios iniciales');

// Crear un nuevo usuario
const newUser = userManager.createUser('Carlos Pro', '🚀');
assert.strictEqual(newUser.name, 'Carlos Pro');
assert.strictEqual(newUser.avatar, '🚀');

// Registrar victoria
userManager.recordGameResult(newUser.id, {
  won: true,
  attempts: 5,
  timeSec: 42,
  famasCount: 4,
  puntosCount: 6
});

const activeUser = userManager.getActiveUser();
assert.strictEqual(activeUser.id, newUser.id);
assert.strictEqual(activeUser.stats.won, 1);
assert.strictEqual(activeUser.stats.bestAttempts, 5);
assert.strictEqual(activeUser.stats.bestTimeSec, 42);

// Leaderboard
const leaderboard = userManager.getLeaderboard();
assert.strictEqual(leaderboard[0].id, newUser.id, 'Carlos Pro debe ser el primero en ranking');

console.log('✅ UserManager pasó todas las pruebas con éxito!\n');
