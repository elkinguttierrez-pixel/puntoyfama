/**
 * Pruebas unitarias automatizadas para la lógica estricta de Punto y Fama.
 */

const engine = require('../js/gameLogic.js');
const assert = require('assert');

console.log('🧪 Iniciando pruebas unitarias de Punto y Fama...\n');

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

// ==========================================
// 1. MODO CLÁSICO (Sin cifras repetidas)
// ==========================================
test('Clásico: 4 Famas (Victoria exacta)', () => {
  const result = engine.evaluateGuess('4821', '4821');
  assert.strictEqual(result.famas, 4);
  assert.strictEqual(result.puntos, 0);
  assert.strictEqual(result.isVictory, true);
});

test('Clásico: 1 Fama, 2 Puntos (4821 vs 4198)', () => {
  // 4 en pos 0 = FAMA (1)
  // 1 en secreto pos 3, intento pos 1 = PUNTO (1)
  // 9 no está en secreto = NONE
  // 8 en secreto pos 1, intento pos 3 = PUNTO (1)
  const result = engine.evaluateGuess('4821', '4198');
  assert.strictEqual(result.famas, 1);
  assert.strictEqual(result.puntos, 2);
  assert.strictEqual(result.isVictory, false);
});

test('Clásico: 0 Famas, 4 Puntos (1234 vs 4321)', () => {
  const result = engine.evaluateGuess('1234', '4321');
  assert.strictEqual(result.famas, 0);
  assert.strictEqual(result.puntos, 4);
  assert.strictEqual(result.isVictory, false);
});

test('Clásico: 0 Famas, 0 Puntos (1234 vs 5678)', () => {
  const result = engine.evaluateGuess('1234', '5678');
  assert.strictEqual(result.famas, 0);
  assert.strictEqual(result.puntos, 0);
  assert.strictEqual(result.isVictory, false);
});

// ==========================================
// 2. MODO CON REPETICIÓN (Cifras repetidas)
// ==========================================
test('Repetición: Manejo estricto de duplicados (1123 vs 1214)', () => {
  // Secreto: 1 1 2 3
  // Intento: 1 2 1 4
  // Pos 0: 1 == 1 -> FAMA (1)
  // Restantes secreto: [1, 2, 3], Intento: [2, 1, 4]
  // 2 coincide en posición distinta -> PUNTO (1)
  // 1 coincide en posición distinta -> PUNTO (1)
  // 4 no existe en secreto -> 0
  // Resultado: 1 Fama, 2 Puntos
  const result = engine.evaluateGuess('1123', '1214');
  assert.strictEqual(result.famas, 1);
  assert.strictEqual(result.puntos, 2);
  assert.strictEqual(result.isVictory, false);
});

test('Repetición: No sobrecontar si el intento tiene más copias que el secreto (1234 vs 1111)', () => {
  // Secreto: 1 2 3 4
  // Intento: 1 1 1 1
  // Pos 0: 1 == 1 -> FAMA (1)
  // Los otros tres '1' no deben contarse como puntos porque el secreto solo tiene un '1'
  const result = engine.evaluateGuess('1234', '1111');
  assert.strictEqual(result.famas, 1);
  assert.strictEqual(result.puntos, 0);
});

test('Repetición: Secreto con múltiples copias del mismo dígito (9990 vs 0999)', () => {
  // Secreto: 9 9 9 0
  // Intento: 0 9 9 9
  // Famas: pos 1 ('9'=='9') y pos 2 ('9'=='9') -> 2 Famas
  // Resto secreto: pos 0='9', pos 3='0'
  // Resto intento: pos 0='0' (coincide con pos 3 secreto) -> PUNTO
  //                pos 3='9' (coincide con pos 0 secreto) -> PUNTO
  // Total: 2 Famas, 2 Puntos
  const result = engine.evaluateGuess('9990', '0999');
  assert.strictEqual(result.famas, 2);
  assert.strictEqual(result.puntos, 2);
});

test('Repetición: Todos iguales vs inverso (1122 vs 2211)', () => {
  const result = engine.evaluateGuess('1122', '2211');
  assert.strictEqual(result.famas, 0);
  assert.strictEqual(result.puntos, 4);
});

// ==========================================
// 3. GENERACIÓN Y VALIDACIÓN
// ==========================================
test('Generación de código sin repetición: longitud y unicidad', () => {
  for (let i = 0; i < 50; i++) {
    const code = engine.generateSecretCode(4, false);
    assert.strictEqual(code.length, 4);
    assert.strictEqual(new Set(code).size, 4);
  }
});

test('Generación de código con repetición permitida', () => {
  const code = engine.generateSecretCode(4, true);
  assert.strictEqual(code.length, 4);
  assert.match(code, /^\d{4}$/);
});

test('Validación: Longitud incorrecta', () => {
  const check = engine.validateGuess('123', 4, false);
  assert.strictEqual(check.valid, false);
  assert.match(check.error, /4 cifras/);
});

test('Validación: Caracteres no numéricos', () => {
  const check = engine.validateGuess('12a4', 4, false);
  assert.strictEqual(check.valid, false);
  assert.match(check.error, /numéricos/);
});

test('Validación: Duplicados no permitidos en modo clásico', () => {
  const check = engine.validateGuess('1224', 4, false);
  assert.strictEqual(check.valid, false);
  assert.match(check.error, /no se permiten dígitos repetidos/);
});

test('Validación: Duplicados permitidos en modo con repetición', () => {
  const check = engine.validateGuess('1224', 4, true);
  assert.strictEqual(check.valid, true);
});

console.log(`\n==========================================`);
console.log(`Resultado: ${passedTests}/${totalTests} pruebas pasadas exitosamente.`);
if (passedTests === totalTests) {
  console.log('🎉 ¡Todas las pruebas de lógica estricta fueron superadas!\n');
} else {
  console.error('💥 Algunas pruebas fallaron.');
  process.exit(1);
}
