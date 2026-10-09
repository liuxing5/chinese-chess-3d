// music.js —— 背景配乐引擎
// 全部为【原创】五声音阶（宫商角徵羽）古风循环大曲，按意境命名。
// 另提供"加载本地音频文件"入口，让用户播放自有曲目。
// 与 audio.js（音效）相互独立：音效开关不影响配乐，配乐开关也不影响音效。

// ---------- 合成工具 ----------

// ADSR 包络单音：更丰满的 attack/decay/release，支持 vibrato 和颤音
function playNote(ctx, dest, t, freq, dur, peak, type, opts, active) {
  opts = opts || {};
  const attack = opts.attack || 0.015;
  const decay = opts.decay || 0.04;
  const sustain = opts.sustain != null ? opts.sustain : peak * 0.6;
  const release = opts.release || Math.min(0.08, dur * 0.5);

  const osc = ctx.createOscillator();
  osc.type = type || 'triangle';
  osc.frequency.setValueAtTime(freq, t);

  // vibrato
  if (opts.vibrato) {
    const v = opts.vibrato;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = v.rate || 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = v.depth || 4; // cents
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t);
    const end = t + dur + 0.1;
    lfo.stop(end);
    if (active) active.push({ node: lfo, endTime: end });
  }

  // 合唱效果（轻微 detune 的第二振荡器，增加丰满度）
  let osc2 = null;
  if (opts.chorus) {
    osc2 = ctx.createOscillator();
    osc2.type = type || 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.005, t);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(sustain, t + attack + decay);
  g.gain.setValueAtTime(sustain, t + Math.max(attack + decay, dur - release));
  g.gain.linearRampToValueAtTime(0.0005, t + dur);

  osc.connect(g);
  if (osc2) osc2.connect(g);
  g.connect(dest);
  osc.start(t);
  if (osc2) osc2.start(t);
  const end = t + dur + 0.1;
  osc.stop(end);
  if (osc2) osc2.stop(end);
  if (active) {
    active.push({ node: osc, endTime: end });
    if (osc2) active.push({ node: osc2, endTime: end });
  }
}

// 柔和短音（装饰音/经过音）
function playGrace(ctx, dest, t, freq, dur, gain, active) {
  playNote(ctx, dest, t, freq, dur, gain, 'sine', { attack: 0.005, decay: 0.02, sustain: 0, release: 0.04 }, active);
}

// 持续 pad：多层长音 + 缓慢呼吸式音量变化
function playPad(ctx, dest, t, dur, freqs, gain, active) {
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * (0.8 + 0.2 * Math.sin(i * 1.5)), t + 0.6);
    g.gain.setValueAtTime(gain, t + Math.max(0.8, dur - 0.8));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t);
    const end = t + dur + 0.1;
    o.stop(end);
    if (active) active.push({ node: o, endTime: end });
  });
}

// 鼓声（低频主体 + 高频噪声皮膜感）
function playDrum(ctx, dest, t, gain, active) {
  // 低频主体
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain * 1.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.connect(g); g.connect(dest);
  o.start(t);
  o.stop(t + 0.2);
  if (active) active.push({ node: o, endTime: t + 0.22 });

  // 高频噪声（皮膜质感）
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.6, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(hp); hp.connect(ng); ng.connect(dest);
  src.start(t);
  if (active) active.push({ node: src, endTime: t + 0.08 });
}

// 轻叩（木鱼/铃鼓感）
function playTap(ctx, dest, t, gain, active) {
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(t);
  if (active) active.push({ node: src, endTime: t + 0.08 });
}

// 铃音（金属质感，三角波 + 高通）
function playBell(ctx, dest, t, freq, gain, active) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
  o.connect(hp); hp.connect(g); g.connect(dest);
  o.start(t);
  o.stop(t + 0.45);
  if (active) active.push({ node: o, endTime: t + 0.5 });
}

// ---------- 曲目 ----------
// 每首 16 小节（loopBeats * 2），旋律含变奏，多声部编排

// C 宫五声: C(宫) D(商) E(角) G(徵) A(羽)
// G 宫五声: G(宫) A(商) B(角) D(徵) E(羽)
// A 宫五声: A(宫) B(商) C#(角) E(徵) F#(羽)
// F 宫五声: F(宫) G(商) A(角) C(徵) D(羽)

const TRACKS = [
  {
    id: 'dajiang', name: '大江东去', desc: '原创·雄浑古风',
    tempo: 76, loopBeats: 16,
    perform(ctx, dest, t0, active) {
      const b = 60 / this.tempo;
      const N = this.loopBeats;

      // 主旋（C 宫五声，16 小节：呈-承-转-合）
      // 呈：雄浑开阔
      const melA = [
        [261.63, 0], [293.66, 0.75], [329.63, 1.5], [392.00, 2.25],
        [440.00, 3.5], [392.00, 4.25], [329.63, 5], [293.66, 5.75],
        [261.63, 7],
      ];
      // 承：渐入佳境
      const melB = [
        [261.63, 8], [329.63, 8.75], [392.00, 9.5], [440.00, 10.25],
        [523.25, 11], [440.00, 11.75], [392.00, 12.5], [329.63, 13.25],
        [293.66, 14], [261.63, 15],
      ];
      const mel = melA.concat(melB);
      mel.forEach(([f, s]) => {
        const dur = b * 0.9;
        playNote(ctx, dest, t0 + s * b, f, dur, 0.18, 'triangle',
          { vibrato: { rate: 4.5, depth: 3 }, chorus: true, release: 0.25 }, active);
      });

      // 副旋（高八度，sine，装饰性）
      const counter = [
        [523.25, 3.75], [0, 6],
        [587.33, 11.5], [0, 14.5],
      ];
      counter.forEach(([f, s]) => {
        if (f === 0) return;
        playNote(ctx, dest, t0 + s * b, f, b * 0.6, 0.07, 'sine',
          { vibrato: { rate: 6, depth: 5 }, attack: 0.01, release: 0.15 }, active);
      });

      // 低音（C2/G2/A2/F2 轮换，增强走向感）
      const bass = [
        [65.41, 0], [98.00, 2], [110.00, 4], [87.31, 6],
        [65.41, 8], [98.00, 10], [110.00, 12], [87.31, 14],
      ];
      bass.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 1.8, 0.16, 'sine',
          { attack: 0.02, decay: 0.08, sustain: 0.1, release: 0.4 }, active);
      });

      // 低音经过音
      [ [130.81, 1], [146.83, 3], [164.81, 5], [130.81, 7],
        [130.81, 9], [146.83, 11], [164.81, 13], [130.81, 15]
      ].forEach(([f, s]) => {
        if (f) playGrace(ctx, dest, t0 + s * b, f, b * 0.3, 0.06, active);
      });

      // Pad：C 宫三音 + 属音
      playPad(ctx, dest, t0, N * b, [130.81, 196.00, 261.63], 0.04, active);

      // 鼓点：每 4 拍一个重鼓 + 轻叩
      for (let i = 0; i < N; i++) {
        if (i % 4 === 0) playDrum(ctx, dest, t0 + i * b, 0.06, active);
        if (i % 2 === 1) playTap(ctx, dest, t0 + i * b, 0.04, active);
      }
    },
  },

  {
    id: 'jianying', name: '剑影江湖', desc: '原创·紧凑古风',
    tempo: 112, loopBeats: 16,
    perform(ctx, dest, t0, active) {
      const b = 60 / this.tempo;
      const N = this.loopBeats;

      // 主旋（G 宫五声，紧凑跳跃）
      const melA = [
        [392.00, 0], [440.00, 0.5], [493.88, 1], [523.25, 1.5],
        [587.33, 2.5], [523.25, 3], [493.88, 3.5], [440.00, 4],
        [392.00, 5], [349.23, 5.5], [329.63, 6.5], [392.00, 7.5],
      ];
      const melB = [
        [440.00, 8], [493.88, 8.5], [587.33, 9], [523.25, 9.5],
        [493.88, 10.5], [440.00, 11], [392.00, 11.5], [349.23, 12],
        [329.63, 13], [293.66, 13.5], [329.63, 14.5], [392.00, 15],
      ];
      const mel = melA.concat(melB);
      mel.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 0.45, 0.16, 'triangle',
          { vibrato: { rate: 6, depth: 4 }, chorus: true, attack: 0.008, release: 0.12 }, active);
      });

      // 副旋（高八度，切分点缀）
      [
        [783.99, 2], [0, 7],
        [880.00, 10.5], [0, 14],
      ].forEach(([f, s]) => {
        if (f === 0) return;
        playNote(ctx, dest, t0 + s * b, f, b * 0.3, 0.06, 'sine',
          { vibrato: { rate: 7, depth: 6 }, attack: 0.005, release: 0.08 }, active);
      });

      // 低音（G2/D3/C3/A3 轮换）
      const bass = [
        [98.00, 0], [146.83, 2], [130.81, 4], [110.00, 6],
        [98.00, 8], [146.83, 10], [130.81, 12], [110.00, 14],
      ];
      bass.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 0.9, 0.14, 'sine',
          { attack: 0.01, decay: 0.05, sustain: 0.08, release: 0.15 }, active);
        playGrace(ctx, dest, t0 + s * b + b * 0.75, f * 2, b * 0.2, 0.05, active);
      });

      // Pad：G 宫
      playPad(ctx, dest, t0, N * b, [196.00, 293.66, 392.00], 0.03, active);

      // 鼓点：每拍轻叩 + 重鼓
      for (let i = 0; i < N; i++) {
        playTap(ctx, dest, t0 + i * b, 0.05, active);
        if (i % 4 === 0) playDrum(ctx, dest, t0 + i * b, 0.07, active);
      }
    },
  },

  {
    id: 'gaixia', name: '垓下月', desc: '原创·凄清古风',
    tempo: 66, loopBeats: 16,
    perform(ctx, dest, t0, active) {
      const b = 60 / this.tempo;
      const N = this.loopBeats;

      // 主旋（A 宫五声，缓慢悠远，大时值）
      const melA = [
        [220.00, 0], [246.94, 1.5], [293.66, 3], [329.63, 4.5],
        [369.99, 6], [329.63, 7.25],
      ];
      const melB = [
        [293.66, 8], [246.94, 9.5], [220.00, 11], [196.00, 12.5],
        [220.00, 14], [329.63, 15.25],
      ];
      const mel = melA.concat(melB);
      mel.forEach(([f, s], i) => {
        const dur = b * (i < 4 ? 1.3 : 1.0);
        playNote(ctx, dest, t0 + s * b, f, dur, 0.15, 'triangle',
          { vibrato: { rate: 3.5, depth: 5 }, chorus: true, attack: 0.03, release: 0.35 }, active);
      });

      // 副旋（空灵八度，稀疏点缀）
      [
        [440.00, 2], [0, 5],
        [493.88, 6.25], [0, 9],
        [440.00, 10.5], [0, 13],
        [392.00, 14.5],
      ].forEach(([f, s]) => {
        if (f === 0) return;
        playNote(ctx, dest, t0 + s * b, f, b * 0.8, 0.05, 'sine',
          { vibrato: { rate: 5, depth: 8 }, attack: 0.02, release: 0.3 }, active);
      });

      // 低音（A2/E3 轮换，深沉悠远）
      const bass = [
        [110.00, 0], [164.81, 4], [110.00, 8], [164.81, 12],
      ];
      bass.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 3.5, 0.13, 'sine',
          { attack: 0.08, decay: 0.15, sustain: 0.08, release: 0.6 }, active);
      });

      // 经过音
      [ [146.83, 2], [130.81, 6], [146.83, 10], [130.81, 14] ].forEach(([f, s]) => {
        if (f) playGrace(ctx, dest, t0 + s * b, f, b * 0.4, 0.04, active);
      });

      // Pad：A 宫 + 空灵泛音
      playPad(ctx, dest, t0, N * b, [110.00, 220.00, 329.63], 0.045, active);

      // 稀疏鼓点 + 铃音
      for (let i = 0; i < N; i++) {
        if (i % 8 === 0) playDrum(ctx, dest, t0 + i * b, 0.05, active);
        if (i % 4 === 2) playBell(ctx, dest, t0 + i * b, 880.00, 0.04, active);
        if (i % 2 === 1) playTap(ctx, dest, t0 + i * b, 0.025, active);
      }
    },
  },

  {
    id: 'kaixuan', name: '凯旋', desc: '原创·欢快古风',
    tempo: 128, loopBeats: 16,
    perform(ctx, dest, t0, active) {
      const b = 60 / this.tempo;
      const N = this.loopBeats;

      // 主旋（F 宫五声，明亮昂扬，十六分音符跳跃）
      const melA = [
        [261.63, 0], [349.23, 0.5], [440.00, 1], [523.25, 1.5],
        [587.33, 2], [523.25, 2.5], [440.00, 3], [349.23, 3.5],
        [261.63, 4.5], [349.23, 5], [440.00, 5.5], [523.25, 6],
        [440.00, 7], [349.23, 7.5],
      ];
      const melB = [
        [261.63, 8], [329.63, 8.5], [392.00, 9], [493.88, 9.5],
        [587.33, 10], [523.25, 10.5], [440.00, 11], [349.23, 11.5],
        [261.63, 12.5], [220.00, 13], [261.63, 13.5], [349.23, 14],
        [440.00, 15],
      ];
      const mel = melA.concat(melB);
      mel.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 0.42, 0.17, 'triangle',
          { vibrato: { rate: 7, depth: 4 }, chorus: true, attack: 0.006, release: 0.1 }, active);
      });

      // 高八度回声（切分）
      [
        [783.99, 1.75], [659.25, 3.75],
        [698.46, 9.75], [659.25, 11.75],
      ].forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 0.25, 0.07, 'sine',
          { vibrato: { rate: 8, depth: 5 }, attack: 0.005, release: 0.06 }, active);
      });

      // 低音（F2/C3/F2/C3/G2/D3 走向）
      const bass = [
        [87.31, 0], [130.81, 2], [87.31, 4], [130.81, 6],
        [98.00, 8], [146.83, 10], [87.31, 12], [130.81, 14],
      ];
      bass.forEach(([f, s]) => {
        playNote(ctx, dest, t0 + s * b, f, b * 0.8, 0.15, 'sine',
          { attack: 0.008, decay: 0.04, sustain: 0.1, release: 0.12 }, active);
        playGrace(ctx, dest, t0 + s * b + b * 0.5, f * 2, b * 0.18, 0.05, active);
      });

      // Pad：F 宫
      playPad(ctx, dest, t0, N * b, [174.61, 261.63, 349.23], 0.025, active);

      // 鼓点：每拍重鼓 + 反拍轻叩 + 铃音
      for (let i = 0; i < N; i++) {
        playDrum(ctx, dest, t0 + i * b, 0.06, active);
        if (i % 2 === 0) playTap(ctx, dest, t0 + i * b + b * 0.5, 0.04, active);
        if (i % 4 === 1) playBell(ctx, dest, t0 + i * b, 880.00, 0.05, active);
      }
    },
  },
];

// ---------- 引擎 ----------

class MusicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.playing = false;
    this.currentId = null;
    this.tracks = TRACKS;
    this._tick = null;
    this._nextLoopTime = 0;
    this._active = [];
    this._fileBuffer = null;
    this._fileSource = null;
    this._fileName = '';
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.32 : 0;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0.32 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setTrack(id) {
    if (this.currentId === id && this.playing) return;
    this._stopScheduler();
    this._stopFile();
    this.currentId = id;
    if (!id) { this.playing = false; return; }
    this.play();
  }

  play() {
    this.ensure();
    if (!this.ctx || !this.currentId) return;
    this.resume();
    if (this.currentId === 'file') {
      if (!this._fileBuffer) return;
      this._stopFile();
      this._playFile();
      this.playing = true;
      return;
    }
    this.playing = true;
    this._nextLoopTime = this.ctx.currentTime + 0.06;
    if (this._tick) clearInterval(this._tick);
    this._tick = setInterval(() => this._scheduleAhead(), 25);
  }

  pause() {
    this.playing = false;
    this._stopScheduler();
    this._stopFile();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  _scheduleAhead() {
    if (!this.ctx) return;
    const track = this.tracks.find(t => t.id === this.currentId);
    if (!track) return;
    const beat = 60 / track.tempo;
    while (this._nextLoopTime < this.ctx.currentTime + 0.4) {
      track.perform(this.ctx, this.master, this._nextLoopTime, this._active);
      this._nextLoopTime += track.loopBeats * beat;
    }
    const now = this.ctx.currentTime;
    this._active = this._active.filter(a => a.endTime > now);
  }

  _stopScheduler() {
    if (this._tick) clearInterval(this._tick);
    this._tick = null;
    const now = this.ctx ? this.ctx.currentTime : 0;
    this._active.forEach(a => {
      try { a.node.stop(now + 0.03); } catch (e) { /* 节点已结束或未启动 */ }
    });
    this._active = [];
  }

  async loadFile(file) {
    this.ensure();
    if (!this.ctx) throw new Error('音频上下文不可用');
    const ab = await file.arrayBuffer();
    this._fileBuffer = await this.ctx.decodeAudioData(ab);
    this._fileName = file.name;
    this.currentId = 'file';
    this._stopScheduler();
    this._stopFile();
    this.play();
    return this._fileName;
  }

  _playFile() {
    if (!this._fileBuffer || !this.ctx) return;
    this._stopFile();
    const src = this.ctx.createBufferSource();
    src.buffer = this._fileBuffer;
    src.loop = true;
    src.connect(this.master);
    src.start();
    this._fileSource = src;
  }

  _stopFile() {
    if (this._fileSource) {
      try { this._fileSource.stop(); } catch (e) { /* 已停止 */ }
      this._fileSource = null;
    }
  }
}

export const music = new MusicEngine();
export { TRACKS };
