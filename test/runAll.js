/**
 * Ejecutor unificado de todas las suites de prueba.
 */

const { execSync } = require('child_process');

const testFiles = [
  'test/gameLogic.test.js',
  'test/userManager.test.js',
  'test/multiplayer.test.js',
  'test/e2e_multiplayer.test.js',
  'test/rooms.test.js'
];

console.log('======================================================');
console.log('🚀 EJECUTANDO SUITE COMPLETA DE PRUEBAS DE PUNTO Y FAMA');
console.log('======================================================\n');

let allPassed = true;

for (const file of testFiles) {
  try {
    console.log(`▶ Ejecutando ${file}...`);
    execSync(`node ${file}`, { stdio: 'inherit' });
    console.log(`\n✔ ${file} finalizado con éxito.\n`);
  } catch (err) {
    console.error(`\n✖ Falló la prueba en ${file}`);
    allPassed = false;
    process.exit(1);
  }
}

if (allPassed) {
  console.log('======================================================');
  console.log('🎉 ¡TODAS LAS SUITES DE PRUEBA PASARON EXITOSAMENTE!');
  console.log('======================================================');
}
