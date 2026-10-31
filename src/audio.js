/** Tiny WebAudio synth — no external assets, unlocked on the Start tap. */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? 0.2 : 0, this.ctx.currentTime, 0.02);
    }
  }

  tone({ freq = 440, endFreq = 0, type = 'sine', dur = 0.16, vol = 0.5, delay = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.25, freq = 900, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime + delay;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  click() {
    this.tone({ freq: 620, endFreq: 840, type: 'triangle', dur: 0.07, vol: 0.22 });
  }

  select() {
    this.tone({ freq: 480, endFreq: 720, type: 'sine', dur: 0.09, vol: 0.25 });
  }

  error() {
    this.tone({ freq: 190, endFreq: 120, type: 'square', dur: 0.16, vol: 0.2 });
  }

  plant() {
    this.noise({ dur: 0.22, vol: 0.28, freq: 420 });
    this.tone({ freq: 180, endFreq: 90, type: 'sine', dur: 0.22, vol: 0.25 });
  }

  water() {
    this.noise({ dur: 0.34, vol: 0.2, freq: 1500 });
    this.tone({ freq: 900, endFreq: 420, type: 'sine', dur: 0.28, vol: 0.11 });
  }

  feed() {
    this.noise({ dur: 0.3, vol: 0.18, freq: 1100 });
    this.tone({ freq: 340, endFreq: 620, type: 'triangle', dur: 0.28, vol: 0.18 });
  }

  harvest() {
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      this.tone({ freq, type: 'triangle', dur: 0.24, vol: 0.24, delay: index * 0.07 });
    });
    this.noise({ dur: 0.18, vol: 0.16, freq: 2600 });
  }

  cash() {
    this.tone({ freq: 880, type: 'sine', dur: 0.1, vol: 0.24 });
    this.tone({ freq: 1318.5, type: 'sine', dur: 0.16, vol: 0.2, delay: 0.06 });
  }

  level() {
    [392, 523.25, 659.25, 1046.5].forEach((freq, index) => {
      this.tone({ freq, type: 'triangle', dur: 0.32, vol: 0.24, delay: index * 0.09 });
    });
  }

  raid() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 720, endFreq: 460, type: 'sawtooth', dur: 0.34, vol: 0.2, delay: i * 0.38 });
    }
    this.noise({ dur: 0.7, vol: 0.18, freq: 300 });
  }

  ready() {
    this.tone({ freq: 760, endFreq: 1040, type: 'sine', dur: 0.18, vol: 0.16 });
  }
}
