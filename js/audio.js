/** Lightweight synth SFX — no assets required */

let ctx;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'square', gain = 0.04, slide = 0) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

function noise(dur, gain = 0.05) {
  const c = ac();
  const bufferSize = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

export const SFX = {
  unlock() { ac(); },
  fire(heavy = false) {
    if (heavy) {
      tone(90, 0.18, 'sawtooth', 0.07, -50);
      noise(0.12, 0.08);
    } else {
      tone(220, 0.05, 'square', 0.035, -80);
      noise(0.04, 0.03);
    }
  },
  hit() { tone(160, 0.06, 'triangle', 0.04); },
  kill() {
    tone(420, 0.08, 'square', 0.04);
    tone(280, 0.14, 'sawtooth', 0.035, -120);
  },
  buy() { tone(520, 0.07, 'triangle', 0.04); tone(780, 0.1, 'triangle', 0.03); },
  plant() { tone(180, 0.2, 'sine', 0.05); tone(240, 0.25, 'sine', 0.04); },
  bombBeep() { tone(880, 0.05, 'square', 0.03); },
  roundWin() {
    tone(330, 0.12, 'triangle', 0.05);
    setTimeout(() => tone(440, 0.12, 'triangle', 0.05), 100);
    setTimeout(() => tone(550, 0.2, 'triangle', 0.05), 200);
  },
  roundLoss() {
    tone(220, 0.15, 'sawtooth', 0.04, -80);
    setTimeout(() => tone(140, 0.25, 'sawtooth', 0.04, -40), 120);
  },
  ui() { tone(640, 0.04, 'triangle', 0.025); },
  crateStart() {
    tone(180, 0.15, 'sawtooth', 0.04);
    let i = 0;
    const tick = () => {
      if (i++ > 18) return;
      tone(400 + Math.random() * 200, 0.04, 'square', 0.02);
      setTimeout(tick, 180);
    };
    tick();
  },
  crateLand(rarity) {
    const bright = ['covert', 'extraordinary', 'classified'].includes(rarity);
    tone(bright ? 660 : 320, 0.12, 'triangle', 0.06);
    tone(bright ? 880 : 420, 0.2, 'triangle', 0.05);
    if (bright) noise(0.2, 0.06);
  },
};
