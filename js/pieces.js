// pieces.js —— 中国象棋棋子（木质圆饼 + 楷书汉字纹理）
import * as THREE from 'three';
import { CHAR } from './rules.js';

export const PIECE_H = 0.32;
export const PIECE_R = 0.44;

const texCache = new Map();

function makeTopTexture(side, type) {
  const key = side + type;
  if (texCache.has(key)) return texCache.get(key);
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2, R = S / 2 - 4;
  const isRed = side === 'r';
  const accent = isRed ? '#b8281b' : '#1c1a17';

  // 面板（象牙底，带径向渐变）
  const g = ctx.createRadialGradient(cx - 18, cy - 24, 10, cx, cy, R);
  g.addColorStop(0, '#fbf3dc');
  g.addColorStop(0.7, '#efe2c2');
  g.addColorStop(1, '#d8c298');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 木纹细线
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * S;
    ctx.strokeStyle = `rgba(120,80,40,${0.03 + Math.random() * 0.06})`;
    ctx.lineWidth = 0.4 + Math.random();
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 外圈深色边
  ctx.lineWidth = 6;
  ctx.strokeStyle = isRed ? '#7a1a10' : '#0c0a08';
  ctx.beginPath(); ctx.arc(cx, cy, R - 3, 0, Math.PI * 2); ctx.stroke();
  // 内圈双线
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.beginPath(); ctx.arc(cx, cy, R - 14, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(cx, cy, R - 20, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  // 汉字（雕刻感：先深色描边阴影，再主色）。用系统楷体，确保 傌/俥 等字带单人旁正确渲染
  // 字号加大至 180px / 256 画布，使从相机斜视角度仍清晰可读
  const ch = CHAR[side][type];
  ctx.font = `900 180px "KaiTi", "STKaiti", "楷体", "Kaiti SC", "SimSun", "宋体", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 阴影凹刻
  ctx.fillStyle = 'rgba(80,50,20,0.4)';
  ctx.fillText(ch, cx + 2, cy + 4);
  // 主色
  ctx.fillStyle = accent;
  ctx.fillText(ch, cx, cy);
  // 高光
  ctx.fillStyle = 'rgba(255,240,210,0.2)';
  ctx.fillText(ch, cx - 1, cy - 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

export function createPiece(side, type) {
  const group = new THREE.Group();
  const isRed = side === 'r';

  const topTex = makeTopTexture(side, type);

  // 侧面：红方暖红木，黑方深乌木
  const sideColor = isRed ? 0x8a3a22 : 0x2a201a;
  const sideMat = new THREE.MeshStandardMaterial({
    color: sideColor, roughness: 0.55, metalness: 0.1,
  });
  const topMat = new THREE.MeshStandardMaterial({
    map: topTex, roughness: 0.42, metalness: 0.08,
  });

  const geo = new THREE.CylinderGeometry(PIECE_R - 0.04, PIECE_R, PIECE_H, 48, 1);
  // 圆柱面组：0 侧面, 1 顶面, 2 底面；顶/底均用字纹，确保 +Y 朝上可见
  const mesh = new THREE.Mesh(geo, [sideMat, topMat, topMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // 顶面外缘金圈（凸起）
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(PIECE_R - 0.06, 0.018, 10, 48),
    new THREE.MeshStandardMaterial({ color: isRed ? 0xd4a24a : 0x9a7a3a, roughness: 0.35, metalness: 0.8 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = PIECE_H / 2 - 0.01;
  group.add(rim);

  // 圆柱顶面 UV 的 v 映射到 x 方向，故字符默认朝 +X；旋转棋子使汉字朝向己方
  group.rotation.y = isRed ? Math.PI / 2 : -Math.PI / 2;

  group.userData = { side, type, mesh, rim };
  return group;
}

// 选中光环（悬于棋子上方）
export function createSelectionRing() {
  const geo = new THREE.RingGeometry(PIECE_R + 0.06, PIECE_R + 0.18, 48);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd24a, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// 可走点标记
export function createMoveDot(capture = false) {
  if (capture) {
    const geo = new THREE.RingGeometry(PIECE_R - 0.04, PIECE_R + 0.06, 40);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4a3a, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  const geo = new THREE.CircleGeometry(0.14, 28);
  const mat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.8, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}
