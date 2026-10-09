// board.js —— 中国象棋棋盘（楚河汉界、九宫、兵炮位标记）
import * as THREE from 'three';

export const SPACING = 1.0;
export const HALF_W = 4;   // 列方向半宽（col 0..8 -> x -4..4）
export const HALF_H = 4.5; // 行方向半长（row 0..9 -> z +4.5..-4.5）
export const MARGIN = 1.2;
export const BOARD_W = (HALF_W * 2) + MARGIN * 2;   // 10.4
export const BOARD_H = (HALF_H * 2) + MARGIN * 2;   // 11.4
export const TOP_Y = 0.26; // 棋盘表面 y

// 棋盘坐标 -> 世界坐标（棋子落在交叉点）
export function boardToWorld(r, c) {
  return new THREE.Vector3((c - HALF_W) * SPACING, TOP_Y, (HALF_H - r) * SPACING);
}

// 棋盘坐标 -> 纹理画布像素（与 PlaneGeometry 旋转 -90° 后的 UV 对齐）
function boardToPx(r, c, w, h) {
  const x = ((c - HALF_W) + BOARD_W / 2) / BOARD_W * w;
  const y = ((BOARD_H / 2) + (HALF_H - r)) / BOARD_H * h;
  return [x, y];
}

function makeBoardCanvas() {
  const w = 1040, h = 1140;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // 木质底色 + 纹理
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0, '#c89a5a');
  baseGrad.addColorStop(0.5, '#b8864a');
  baseGrad.addColorStop(1, '#a87436');
  ctx.fillStyle = baseGrad; ctx.fillRect(0, 0, w, h);
  // 木纹
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(90,55,20,${0.03 + Math.random() * 0.08})`;
    ctx.lineWidth = 0.4 + Math.random() * 1.6;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 4);
    ctx.stroke();
  }
  // 边框
  ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 6;
  const inset = MARGIN / BOARD_W * w * 0.7;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  // 网格线
  const lineW = 2.4;
  ctx.strokeStyle = 'rgba(40,20,8,0.85)';
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';

  // 横线（10 条，全宽）
  for (let r = 0; r <= 9; r++) {
    const [x0, y0] = boardToPx(r, 0, w, h);
    const [x1, y1] = boardToPx(r, 8, w, h);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // 竖线（左右两条全高，中间在河处断开）
  for (let cI = 0; cI <= 8; cI++) {
    const [x0, y0] = boardToPx(0, cI, w, h);
    if (cI === 0 || cI === 8) {
      const [, y1] = boardToPx(9, cI, w, h);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.stroke();
    } else {
      const [, ym1] = boardToPx(4, cI, w, h);
      const [, ym2] = boardToPx(5, cI, w, h);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, ym1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, ym2); ctx.lineTo(x0, boardToPx(9, cI, w, h)[1]); ctx.stroke();
    }
  }

  // 九宫斜线
  const drawDiag = (r1, c1, r2, c2) => {
    const [x1, y1] = boardToPx(r1, c1, w, h);
    const [x2, y2] = boardToPx(r2, c2, w, h);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  drawDiag(0, 3, 2, 5); drawDiag(0, 5, 2, 3);
  drawDiag(7, 3, 9, 5); drawDiag(7, 5, 9, 3);

  // 兵炮位标记（角括号）
  const markPts = [
    [2, 1], [2, 7], [7, 1], [7, 7],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  ];
  ctx.strokeStyle = 'rgba(40,20,8,0.85)'; ctx.lineWidth = 2.6;
  const gap = 6, len = 14;
  markPts.forEach(([r, cC]) => {
    const [cx, cy] = boardToPx(r, cC, w, h);
    const dirs = [];
    if (cC > 0) dirs.push([-1, -1], [-1, 1]);
    if (cC < 8) dirs.push([1, -1], [1, 1]);
    dirs.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx * gap, cy + dy * gap);
      ctx.lineTo(cx + dx * (gap + len), cy + dy * gap);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + dx * gap, cy + dy * gap);
      ctx.lineTo(cx + dx * gap, cy + dy * (gap + len));
      ctx.stroke();
    });
  });

  // 楚河漢界
  ctx.fillStyle = 'rgba(40,20,8,0.78)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fontReady = document.fonts && document.fonts.check('40px "Ma Shan Zheng"');
  const ff = fontReady ? '"Ma Shan Zheng", ' : '';
  ctx.font = `${ff}84px "Noto Serif SC", serif`;
  const [, ry1] = boardToPx(4, 0, w, h);
  const [, ry2] = boardToPx(5, 8, w, h);
  const midY = (ry1 + ry2) / 2;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillText('楚  河', boardToPx(4, 2, w, h)[0], midY);
  ctx.fillText('漢  界', boardToPx(5, 6, w, h)[0], midY);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createBoard() {
  const group = new THREE.Group();

  // 棋盘本体（木质厚板，六面同木纹）
  const woodTex = makeWoodSideTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72, metalness: 0.05 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, 0.5, BOARD_H), woodMat);
  board.position.y = 0;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // 棋盘网格/楚河汉界/九宫（独立平面，保证与棋子坐标对齐）
  const topTex = makeBoardCanvas();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_W, BOARD_H),
    new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.5, metalness: 0.05 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.252;
  plane.receiveShadow = true;
  group.add(plane);

  // 金边四条
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a24a, roughness: 0.35, metalness: 0.8 });
  const t = 0.05;
  const mk = (w_, h_, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w_, 0.08, h_), goldMat);
    m.position.set(x, 0.27, z); group.add(m);
  };
  mk(BOARD_W + 0.2, t, 0, BOARD_H / 2 + 0.06);
  mk(BOARD_W + 0.2, t, 0, -BOARD_H / 2 - 0.06);
  mk(t, BOARD_H + 0.2, BOARD_W / 2 + 0.06, 0);
  mk(t, BOARD_H + 0.2, -BOARD_W / 2 - 0.06, 0);

  return group;
}

function makeWoodSideTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a4a1c'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = `rgba(50,28,10,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}
