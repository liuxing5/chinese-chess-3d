// animations.js —— 棋子移动 / 吃子动画
import * as THREE from 'three';

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeInCubic = t => t * t * t;

export class Animator {
  constructor() {
    this.tweens = [];
  }
  add(tween) { this.tweens.push(tween); return tween; }
  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.duration);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  }
  get busy() { return this.tweens.length > 0; }
}

// 走子：弧线移动 + 起落
export function animateMove(animator, piece, from, to, onDone) {
  const lift = 0.75;
  const duration = 0.5;
  // 起始姿态
  const startRot = piece.rotation.y;
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  const spin = Math.min(0.6, dist * 0.12); // 距离越远转得略多
  animator.add({
    t: 0, duration, onDone,
    fn: (k) => {
      const e = easeInOutCubic(k);
      piece.position.x = THREE.MathUtils.lerp(from.x, to.x, e);
      piece.position.z = THREE.MathUtils.lerp(from.z, to.z, e);
      // 抛物线起落
      const arc = Math.sin(Math.PI * e);
      piece.position.y = to.y + arc * lift; // to.y 为落点高度
      piece.rotation.y = startRot + spin * Math.sin(Math.PI * e);
    },
  });
}

// 吃子：翻倒、下陷、淡出
export function animateCapture(animator, piece, onDone) {
  const duration = 0.55;
  const mats = [];
  piece.traverse(o => { if (o.isMesh) { o.material.transparent = true; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.transparent = true; mats.push(m); }); } });
  const startY = piece.position.y;
  animator.add({
    t: 0, duration, onDone: () => { onDone && onDone(); },
    fn: (k) => {
      const e = easeInCubic(k);
      piece.rotation.z = e * Math.PI * 0.5;     // 翻倒
      piece.rotation.x = e * 0.3;
      piece.position.y = startY - e * 0.4;       // 下陷
      const s = 1 - 0.15 * e;
      piece.scale.setScalar(s);
      mats.forEach(m => { m.opacity = 1 - e; });
    },
  });
}

// 落子回弹（轻微）
export function animateLand(animator, piece, onDone) {
  const duration = 0.18;
  const baseY = piece.position.y;
  animator.add({
    t: 0, duration, onDone,
    fn: (k) => {
      const e = easeOutCubic(k);
      const squash = Math.sin(Math.PI * k) * 0.06;
      piece.scale.set(1 + squash, 1 - squash, 1 + squash);
      piece.position.y = baseY + Math.sin(Math.PI * k) * 0.0;
      if (k >= 1) piece.scale.set(1, 1, 1);
    },
  });
}
