/**
 * Motor de lógica estricta para el juego "Punto y Fama"
 * (Bulls and Cows / Picas y Fijas)
 * Compatible con Node.js y navegadores web.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PuntoYFamaEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Genera un código secreto aleatorio de longitud N.
   * @param {number} length - Longitud del código (por defecto 4).
   * @param {boolean} allowDuplicates - Si se permite repetir dígitos.
   * @returns {string} Código generado.
   */
  function generateSecretCode(length = 4, allowDuplicates = false) {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    if (!allowDuplicates && length > digits.length) {
      throw new Error(`No se pueden generar ${length} cifras únicas con dígitos del 0 al 9.`);
    }

    if (allowDuplicates) {
      let result = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        result += digits[randomIndex];
      }
      return result;
    } else {
      // Barajado Fisher-Yates para sin repetición
      const available = [...digits];
      let result = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * available.length);
        result += available[randomIndex];
        available.splice(randomIndex, 1);
      }
      return result;
    }
  }

  /**
   * Valida si un intento cumple las reglas de formato y modo de juego.
   * @param {string} guess - El intento ingresado.
   * @param {number} expectedLength - Longitud requerida (por defecto 4).
   * @param {boolean} allowDuplicates - Si se permiten dígitos repetidos.
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateGuess(guess, expectedLength = 4, allowDuplicates = false) {
    if (typeof guess !== 'string') {
      return { valid: false, error: 'La entrada debe ser una cadena de texto numérico.' };
    }

    const trimmed = guess.trim();

    if (trimmed.length !== expectedLength) {
      return {
        valid: false,
        error: `El número debe tener exactamente ${expectedLength} cifras (actual: ${trimmed.length}).`
      };
    }

    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, error: 'Solo se permiten caracteres numéricos (0-9).' };
    }

    if (!allowDuplicates) {
      const uniqueDigits = new Set(trimmed);
      if (uniqueDigits.size !== trimmed.length) {
        return {
          valid: false,
          error: 'En el modo clásico no se permiten dígitos repetidos.'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Calcula con rigor estricto el conteo de Famas y Puntos.
   * Fama: Dígito y posición exactos.
   * Punto: Dígito presente en posición diferente (sin sobre-contar en duplicados).
   * 
   * @param {string} secret - El código secreto objetivo.
   * @param {string} guess - El intento propuesto por el jugador.
   * @returns {{ famas: number, puntos: number, details: Array<{digit: string, status: 'fama'|'punto'|'none'}> }}
   */
  function evaluateGuess(secret, guess) {
    if (typeof secret !== 'string' || typeof guess !== 'string') {
      throw new Error('Secret y Guess deben ser cadenas de texto.');
    }

    const secArr = secret.split('');
    const gueArr = guess.split('');

    if (secArr.length !== gueArr.length) {
      throw new Error('La longitud del intento no coincide con la longitud del código secreto.');
    }

    const length = secArr.length;
    let famas = 0;
    let puntos = 0;

    // Máscaras booleanas para dígitos ya emparejados como Fama
    const secretFamaMatched = new Array(length).fill(false);
    const guessFamaMatched = new Array(length).fill(false);
    const details = new Array(length).fill(null);

    // Paso 1: Identificar todas las Famas (coincidencia de dígito y posición)
    for (let i = 0; i < length; i++) {
      if (secArr[i] === gueArr[i]) {
        famas++;
        secretFamaMatched[i] = true;
        guessFamaMatched[i] = true;
        details[i] = { digit: gueArr[i], status: 'fama', position: i };
      }
    }

    // Paso 2: Construir el pool de frecuencia de los dígitos no emparejados del secreto
    const secretUnmatchedFreq = {};
    for (let i = 0; i < length; i++) {
      if (!secretFamaMatched[i]) {
        const d = secArr[i];
        secretUnmatchedFreq[d] = (secretUnmatchedFreq[d] || 0) + 1;
      }
    }

    // Paso 3: Identificar Puntos en los dígitos no emparejados del intento
    for (let i = 0; i < length; i++) {
      if (!guessFamaMatched[i]) {
        const d = gueArr[i];
        if (secretUnmatchedFreq[d] && secretUnmatchedFreq[d] > 0) {
          puntos++;
          secretUnmatchedFreq[d]--;
          details[i] = { digit: d, status: 'punto', position: i };
        } else {
          details[i] = { digit: d, status: 'none', position: i };
        }
      }
    }

    return {
      famas,
      puntos,
      details,
      isVictory: famas === length
    };
  }

  return {
    generateSecretCode,
    validateGuess,
    evaluateGuess
  };
});
