// audio.js —— 使用 Web Audio API 合成中式音效（落子木声、吃子、选中、将军、胜败）
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
  }
  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; }

  // 噪声缓冲
  noiseBuffer(dur) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  // 木质落子声：短促噪声 + 低频体鸣
  clack(strong = false) {
    if (!this.enabled) return;
    this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(0.08);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = strong ? 1400 : 2200; bp.Q.value = 1.2;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(strong ? 0.5 : 0.28, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    noise.connect(bp); bp.connect(ng); ng.connect(this.master);
    noise.start(t); noise.stop(t + 0.1);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(strong ? 180 : 260, t);
    osc.frequency.exponentialRampToValueAtTime(strong ? 90 : 130, t + 0.12);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(strong ? 0.45 : 0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og); og.connect(this.master);
    osc.start(t); osc.stop(t + 0.16);
  }

  select() {
    if (!this.enabled) return;
    this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(680, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.09);
  }

  invalid() {
    if (!this.enabled) return;
    this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.22);
  }

  // 将军提示：两声升调钟鸣
  check() {
    if (!this.enabled) return;
    this.ensure(); if (!this.ctx) return;
    [0, 0.18].forEach((dt, i) => {
      const t = this.ctx.currentTime + dt;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(i ? 880 : 660, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.55);
    });
  }

  // 胜利鼓乐
  win() {
    if (!this.enabled) return;
    this.ensure(); if (!this.ctx) return;
    const seq = [0, 0.22, 0.44, 0.66];
    seq.forEach((dt, i) => {
      const t = this.ctx.currentTime + dt;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const freqs = [330, 392, 494, 660];
      o.frequency.setValueAtTime(freqs[i], t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.42);
    });
  }
}

export const audio = new AudioEngine();
