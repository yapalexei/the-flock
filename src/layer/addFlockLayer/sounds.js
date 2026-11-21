import rebLaser from './assets/reb-laser.mp3';
import tieFire from './assets/tie-fire-1.mp3';
import explosionLarge from './assets/explosion-large-2.mp3';
import engineLoop from './assets/engine-wash-2-loop.mp3';
import missileFire from './assets/missile-fire.mp3';

/**
 * There can be hundreds of enemies firing and exploding at once, and stacking that many
 * copies of one sample is both loud and expensive. Mitigations, per sound:
 *  - `maxVoices`: hard cap on simultaneous playbacks; extra requests are dropped.
 *  - `maxDuration`: long samples are cut short with a fade so voices free up quickly.
 *  - `detune`: random pitch spread, so identical samples don't sum into one loud, phase-locked blast.
 * Callers pass a `volume` (distance falloff) and play nearest events first.
 * Everything goes through one compressor so the sum can't clip.
 */
const SOUNDS = {
  playerFire: { url: rebLaser, gain: 0.3, maxVoices: 6 },
  torpedoFire: { url: missileFire, gain: 0.4, maxVoices: 4 },
  enemyFire: { url: tieFire, gain: 0.25, maxVoices: 4, maxDuration: 0.6, detune: 0.08 },
  explosion: { url: explosionLarge, gain: 0.5, maxVoices: 3, detune: 0.06 },
  // Looped sounds are driven with `setLoop`, not `play`.
  engine: { url: engineLoop, gain: 0.3, loop: true, fadeIn: 0.5, fadeOut: 0.7 },
};

const FADE_SECONDS = 0.1;

export default function createSounds() {
  let ctx = null;
  let master = null;
  let loading = null;
  const buffers = {};
  const voices = {};
  const loops = {};

  const load = () => {
    if (loading) return loading;
    loading = Promise.all(Object.entries(SOUNDS).map(async ([name, { url }]) => {
      const response = await fetch(url);
      buffers[name] = await ctx.decodeAudioData(await response.arrayBuffer());
      voices[name] = 0;
    })).catch((error) => {
      console.warn('sounds failed to load', error);
    });
    return loading;
  };

  /**
   * Call from a user gesture path (the "Start!" click): browsers keep the audio context
   * suspended until then. Safe to call repeatedly.
   */
  function unlock() {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
      master = ctx.createDynamicsCompressor();
      master.connect(ctx.destination);
      load();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  /**
   * `volume` is 0-1 on top of the sound's own gain. `priority` ignores the voice cap
   * (the player's own sounds must never be dropped for the sake of background noise).
   * Returns whether the sound was started.
   */
  function play(name, { volume = 1, priority = false } = {}) {
    const config = SOUNDS[name];
    if (!ctx || ctx.state !== 'running' || !buffers[name] || volume <= 0) return false;
    if (!priority && voices[name] >= config.maxVoices) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffers[name];
    if (config.detune) source.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * config.detune;

    const gain = ctx.createGain();
    const level = config.gain * volume;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(level, now);
    let duration = source.buffer.duration / source.playbackRate.value;
    if (config.maxDuration && config.maxDuration < duration) {
      duration = config.maxDuration;
      gain.gain.setValueAtTime(level, now + duration - FADE_SECONDS);
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }

    source.connect(gain);
    gain.connect(master);
    voices[name] += 1;
    source.onended = () => {
      voices[name] -= 1;
      source.disconnect();
      gain.disconnect();
    };
    source.start(now, 0, duration * source.playbackRate.value);
    return true;
  }

  /**
   * Starts or stops a looping sound with a fade. Cheap to call every frame with the same value.
   * The source is stopped once faded out, so a silent loop costs nothing; turning it back
   * on mid-fade ramps up from the current level instead of restarting.
   */
  function setLoop(name, active) {
    const config = SOUNDS[name];
    let loop = loops[name];
    if (!ctx || ctx.state !== 'running' || !buffers[name]) return;
    if (loop ? loop.active === active : !active) return;

    const now = ctx.currentTime;
    if (!loop) {
      const source = ctx.createBufferSource();
      source.buffer = buffers[name];
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(master);
      source.start(now);
      loop = { source, gain, active: false, stopTimer: null };
      loops[name] = loop;
    }

    loop.active = active;
    clearTimeout(loop.stopTimer);
    const param = loop.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    if (active) {
      param.linearRampToValueAtTime(config.gain, now + config.fadeIn);
    } else {
      param.linearRampToValueAtTime(0, now + config.fadeOut);
      loop.stopTimer = setTimeout(() => {
        loop.source.stop();
        loop.source.disconnect();
        loop.gain.disconnect();
        delete loops[name];
      }, config.fadeOut * 1000 + 50);
    }
  }

  return { unlock, play, setLoop };
}
