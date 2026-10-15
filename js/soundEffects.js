/**
 * Sintetizador de efectos de sonido usando Web Audio API.
 * 100% nativo, sin dependencias externas, con soporte para silenciar y persistencia.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const instance = factory();
    root.SoundEffects = instance;
    root.PuntoYFamaAudio = instance;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let audioCtx = null;
  let isMuted = false;

  // Cargar preferencia guardada
  try {
    const saved = localStorage.getItem('punto_fama_muted');
    if (saved !== null) {
      isMuted = JSON.parse(saved);
    }
  } catch (e) {
    // Si localStorage no está disponible
  }

  function getAudioContext() {
    if (!audioCtx && (typeof window !== 'undefined' || typeof self !== 'undefined')) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function toggleMute() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('punto_fama_muted', JSON.stringify(isMuted));
    } catch (e) {}
    return isMuted;
  }

  function setMuted(state) {
    isMuted = Boolean(state);
    try {
      localStorage.setItem('punto_fama_muted', JSON.stringify(isMuted));
    } catch (e) {}
  }

  function getIsMuted() {
    return isMuted;
  }

  /**
   * Tono básico con envolvente ADSR suave.
   */
  function playTone(freq, type = 'sine', duration = 0.08, gainLevel = 0.15) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainLevel, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (err) {
      // Ignorar fallas si el navegador bloquea audio antes del primer clic
    }
  }

  // Sonido de clic de tecla / número ingresado
  function playKeyClick() {
    playTone(620, 'sine', 0.04, 0.08);
  }

  // Sonido al borrar un dígito
  function playDelete() {
    playTone(330, 'triangle', 0.06, 0.1);
  }

  // Sonido de alerta / error (número repetido o incompleto)
  function playError() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }

  // Sonido al enviar intento (evaluación)
  function playSubmit() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  // Sonido al registrar Fama en el intento
  function playFamaNotification() {
    playTone(880, 'sine', 0.12, 0.15);
  }

  // Sonido al registrar Punto en el intento (Tono suave y limpio)
  function playPuntoSound() {
    playTone(587.33, 'sine', 0.09, 0.12);
  }

  // Fanfarria triunfal de Victoria al obtener 4 Famas
  function playVictoryFanfare() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Arpegio triunfal estilo arcade: C5, E5, G5, B5, C6 (con acordes finales)
      const notes = [
        { f: 523.25, time: 0.00, dur: 0.12 }, // Do5
        { f: 659.25, time: 0.12, dur: 0.12 }, // Mi5
        { f: 783.99, time: 0.24, dur: 0.12 }, // Sol5
        { f: 1046.50, time: 0.36, dur: 0.25 }, // Do6
        { f: 1318.51, time: 0.55, dur: 0.45 }, // Mi6
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, now + note.time);

        const startTime = now + note.time;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + note.dur);
      });
    } catch (e) {}
  }

  return {
    getAudioContext,
    toggleMute,
    setMuted,
    getIsMuted,
    playKeyClick,
    playDelete,
    playDeleteKey: playDelete,
    playError,
    playSubmit,
    playFamaNotification,
    playFamaSound: playFamaNotification,
    playPuntoSound,
    playVictoryFanfare
  };
});
