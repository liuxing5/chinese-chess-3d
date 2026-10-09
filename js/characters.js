// characters.js —— 楚汉人物立体棋子（低多边形人偶 + 木座 + 名号牌）
import * as THREE from 'three';
import { CHAR } from './rules.js';
import { PIECE_H } from './pieces.js';

const PED_R = 0.36;
const PED_TOP = 0.08; // 底座顶面 local y（人物脚底落于此）

// ---- 材质 ----
function std(color, rough = 0.55, metal = 0.15) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
const COLORS = {
  r: { armor: 0xb8281b, armorDark: 0x7a1a10, robe: 0x931a10, trim: 0xd4a24a, cape: 0x8a160e, flag: 0xc43a2a },
  b: { armor: 0x2a2520, armorDark: 0x141210, robe: 0x1c1a17, trim: 0x9a8a6a, cape: 0x100f0d, flag: 0x22201c },
};
const SKIN = 0xe8c39e;
const STEEL = 0x9aa0a6;
const WOOD = 0x6b4a2a;
const GOLD = 0xd4a24a;

// ---- 名号牌纹理（朝向己方，便于辨认棋子）----
const plaqueCache = new Map();
function plaqueTex(side, type) {
  const k = side + type;
  if (plaqueCache.has(k)) return plaqueCache.get(k);
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#3a2a1a'); g.addColorStop(1, '#221610');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = side === 'r' ? '#d4a24a' : '#9a8a6a';
  x.lineWidth = 6; x.strokeRect(6, 6, S - 12, S - 12);
  x.font = '900 80px "KaiTi","STKaiti","楷体",serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillText(CHAR[side][type], 66, 68);
  x.fillStyle = side === 'r' ? '#ecc878' : '#dcdcdc'; x.fillText(CHAR[side][type], 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plaqueCache.set(k, t);
  return t;
}

// ---- 底座 ----
function buildPedestal(side) {
  const g = new THREE.Group();
  const C = COLORS[side];
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(PED_R - 0.02, PED_R, 0.24, 32),
    std(C.armorDark, 0.7, 0.1)
  );
  cyl.position.y = -0.04; // 底 -0.16 / 顶 +0.08
  cyl.receiveShadow = true; cyl.castShadow = true;
  g.add(cyl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(PED_R - 0.04, 0.02, 8, 32), std(C.trim, 0.4, 0.85));
  rim.rotation.x = Math.PI / 2; rim.position.y = PED_TOP - 0.004;
  g.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(PED_R + 0.02, PED_R + 0.03, 0.04, 32), std(C.trim, 0.5, 0.6));
  base.position.y = -0.14; base.receiveShadow = true;
  g.add(base);
  return g;
}

// ---- 名号牌（置于底座背面，朝向己方）----
function buildPlaque(side, type) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshStandardMaterial({ map: plaqueTex(side, type), roughness: 0.6, metalness: 0.05 })
  );
  m.position.set(0, -0.02, -(PED_R + 0.002));
  m.rotation.y = Math.PI; // 朝 -Z（己方）
  return m;
}

// ---- 通用肢体 ----
function addPart(group, geo, x, y, z, mat, rx = 0, ry = 0, rz = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = false;
  group.add(m);
  return m;
}

// 胡须
function addBeard(group, y, color) {
  addPart(group, new THREE.ConeGeometry(0.055, 0.16, 10), 0, y, 0.07, std(color, 0.8), Math.PI, 0, 0);
}

// 披风（覆盖背面）
function addCape(group, color) {
  const cape = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.19, 0.52, 18, 1, true, Math.PI, Math.PI),
    std(color, 0.75, 0.05)
  );
  cape.position.set(0, 0.66, -0.02);
  cape.castShadow = true;
  group.add(cape);
}

// ---- 武器（握把在 y=0，整体向上延伸，便于挂在手部）----
function buildSword() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.07), std(STEEL, 0.3, 0.7));
  blade.position.y = 0.22; g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), std(GOLD, 0.4, 0.8));
  guard.position.y = 0.01; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), std(WOOD, 0.6));
  hilt.position.y = -0.05; g.add(hilt);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), std(GOLD, 0.4, 0.8));
  pommel.position.y = -0.1; g.add(pommel);
  return g;
}
function buildLance() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.0, 10), std(WOOD, 0.6));
  shaft.position.y = 0.5; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), std(STEEL, 0.3, 0.7));
  tip.position.y = 1.08; g.add(tip);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 10), std(0xb8281b, 0.8));
  tassel.position.y = 0.12; g.add(tassel);
  return g;
}
function buildHalberd() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 10), std(WOOD, 0.6));
  shaft.position.y = 0.475; g.add(shaft);
  // 戈头：竖刀 + 横援
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.16), std(STEEL, 0.3, 0.7));
  blade.position.y = 0.95; g.add(blade);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), std(STEEL, 0.3, 0.7));
  horn.rotation.z = -Math.PI / 2; horn.position.set(0.1, 0.92, 0); g.add(horn);
  return g;
}
function buildCrossbow() {
  const g = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.42), std(WOOD, 0.6));
  g.add(stock);
  const bowL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), std(WOOD, 0.55));
  bowL.rotation.z = Math.PI / 2; bowL.position.set(0, 0.04, 0.16); g.add(bowL);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.34, 6), std(0xdddddd, 0.9));
  string.rotation.z = Math.PI / 2; string.position.set(0, -0.01, 0.16); g.add(string);
  return g;
}
function buildSpear() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 8), std(WOOD, 0.6));
  shaft.position.y = 0.425; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), std(STEEL, 0.3, 0.7));
  tip.position.y = 0.91; g.add(tip);
  return g;
}
function buildFan() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), std(WOOD, 0.6));
  handle.position.y = -0.05; g.add(handle);
  const fan = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 16, Math.PI * 0.15, Math.PI * 0.7),
    std(0xeae0c8, 0.7)
  );
  fan.material.side = THREE.DoubleSide;
  fan.position.set(0, 0.07, 0.01); g.add(fan);
  // 羽毛纹
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 0.2 + i * Math.PI * 0.13;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 4), std(0xb9a98a, 0.9));
    line.rotation.z = a - Math.PI / 2;
    line.position.set(Math.cos(a) * 0.075, 0.07 + Math.sin(a) * 0.075, 0.022);
    g.add(line);
  }
  return g;
}
function buildTablet() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.17), std(0x8a6a3a, 0.6));
  board.position.y = 0.1; g.add(board);
  return g;
}

// ---- 人物（脚底 local y=0，面朝 +Z）----
function buildFigure(side, type) {
  const g = new THREE.Group();
  const C = COLORS[side];
  const military = ['K', 'H', 'R', 'C', 'S'].includes(type); // 将/骑/车/弩/兵为武职
  const robeColor = military ? C.armorDark : C.robe;
  const torsoColor = military ? C.armor : C.robe;
  const beardColor = (type === 'A') ? (side === 'b' ? 0xe8e8e8 : 0x2a2a2a) : 0x1a1a1a;

  // 裙袍
  addPart(g, new THREE.CylinderGeometry(0.14, 0.22, 0.46, 18), 0, 0.23, 0, std(robeColor, 0.7));
  // 腰带
  addPart(g, new THREE.CylinderGeometry(0.155, 0.155, 0.05, 18), 0, 0.47, 0, std(C.trim, 0.4, 0.8));
  // 躯干
  addPart(g, new THREE.CylinderGeometry(0.13, 0.15, 0.3, 16), 0, 0.62, 0, std(torsoColor, 0.55, military ? 0.3 : 0.1));
  // 胸甲（武职）
  if (military) {
    addPart(g, new THREE.SphereGeometry(0.135, 16, 12), 0, 0.66, 0.02, std(C.armor, 0.45, 0.35));
    // 兽面铆钉
    addPart(g, new THREE.TorusGeometry(0.05, 0.012, 8, 16), 0, 0.66, 0.13, std(C.trim, 0.4, 0.8), Math.PI / 2, 0, 0);
    // 肩甲
    addPart(g, new THREE.SphereGeometry(0.065, 12, 10), 0.14, 0.74, 0, std(C.armor, 0.45, 0.35));
    addPart(g, new THREE.SphereGeometry(0.065, 12, 10), -0.14, 0.74, 0, std(C.armor, 0.45, 0.35));
  }
  // 颈
  addPart(g, new THREE.CylinderGeometry(0.05, 0.06, 0.06, 10), 0, 0.79, 0, std(SKIN, 0.6));
  // 头
  addPart(g, new THREE.SphereGeometry(0.11, 18, 14), 0, 0.92, 0, std(SKIN, 0.6));
  // 发髻底（除戴冠文职外）
  if (!['A', 'E'].includes(type)) {
    addPart(g, new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.95, 0, std(0x1a120a, 0.8));
  }
  // 眼
  addPart(g, new THREE.SphereGeometry(0.012, 6, 6), 0.04, 0.93, 0.1, std(0x111111, 0.9), 0, 0, 0, false);
  addPart(g, new THREE.SphereGeometry(0.012, 6, 6), -0.04, 0.93, 0.1, std(0x111111, 0.9), 0, 0, 0, false);

  // 胡须
  if (['K', 'A'].includes(type)) addBeard(g, 0.85, beardColor);

  // 双臂
  const armMat = military ? std(C.armor, 0.5, 0.3) : std(C.robe, 0.7);
  // 右臂（执武器）前伸
  addPart(g, new THREE.CylinderGeometry(0.045, 0.05, 0.3, 10), 0.14, 0.72, 0.02, armMat, -0.7, 0, 0.1);
  addPart(g, new THREE.SphereGeometry(0.04, 10, 8), 0.17, 0.6, 0.1, std(SKIN, 0.6), -0.7, 0, 0.1);
  // 左臂
  addPart(g, new THREE.CylinderGeometry(0.045, 0.05, 0.3, 10), -0.14, 0.72, 0.02, armMat, 0.25, 0, -0.08);
  addPart(g, new THREE.SphereGeometry(0.04, 10, 8), -0.16, 0.58, 0.05, std(SKIN, 0.6), 0.25, 0, -0.08);

  // ---- 头盔/冠 ----
  switch (type) {
    case 'K': { // 主帅：红=刘邦帝冕，黑=项羽双翎兜鍪
      if (side === 'r') {
        addPart(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20), 0, 1.0, 0, std(0x1a120a, 0.6));
        addPart(g, new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20), 0, 1.04, 0, std(0x111111, 0.5));
        // 前后旒珠
        for (let i = -2; i <= 2; i++) {
          addPart(g, new THREE.SphereGeometry(0.018, 8, 8), i * 0.035, 0.97, 0.12, std(GOLD, 0.4, 0.8), 0, 0, 0, false);
          addPart(g, new THREE.SphereGeometry(0.018, 8, 8), i * 0.035, 0.97, -0.12, std(GOLD, 0.4, 0.8), 0, 0, 0, false);
        }
      } else {
        addPart(g, new THREE.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.0, 0, std(0x1a1814, 0.4, 0.5));
        // 双翎（项羽雉鸡翎）
        for (const s of [-1, 1]) {
          const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.34, 8), std(0xc43a2a, 0.6));
          plume.position.set(s * 0.07, 1.18, -0.02); plume.rotation.z = s * 0.5; plume.rotation.x = -0.3;
          plume.castShadow = true; g.add(plume);
        }
      }
      addCape(g, C.cape);
      break;
    }
    case 'A': { // 谋士：文士巾
      addPart(g, new THREE.CylinderGeometry(0.11, 0.13, 0.09, 16), 0, 1.0, 0, std(0x4a3a2a, 0.7));
      addPart(g, new THREE.CylinderGeometry(0.14, 0.12, 0.03, 16), 0, 1.05, 0, std(0x2a2018, 0.7));
      break;
    }
    case 'E': { // 相国：进贤冠
      addPart(g, new THREE.BoxGeometry(0.17, 0.18, 0.15), 0, 1.06, 0, std(0x1a120a, 0.6));
      addPart(g, new THREE.BoxGeometry(0.19, 0.03, 0.17), 0, 0.98, 0, std(C.trim, 0.4, 0.7));
      break;
    }
    case 'H': { // 骑将：盔顶红缨
      addPart(g, new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.0, 0, std(0x1a1814, 0.4, 0.5));
      addPart(g, new THREE.ConeGeometry(0.05, 0.22, 10), 0, 1.2, -0.02, std(0xc43a2a, 0.6), -0.2);
      addCape(g, C.cape);
      break;
    }
    case 'R': { // 战车将：护耳盔
      addPart(g, new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.0, 0, std(0x1a1814, 0.4, 0.5));
      addPart(g, new THREE.BoxGeometry(0.04, 0.12, 0.12), 0.12, 0.95, 0, std(0x1a1814, 0.4, 0.5));
      addPart(g, new THREE.BoxGeometry(0.04, 0.12, 0.12), -0.12, 0.95, 0, std(0x1a1814, 0.4, 0.5));
      break;
    }
    case 'C': { // 弓弩手：布兜帽
      addPart(g, new THREE.ConeGeometry(0.12, 0.2, 12), 0, 1.06, -0.01, std(C.robe, 0.7));
      break;
    }
    case 'S': { // 步兵：尖顶胄
      addPart(g, new THREE.ConeGeometry(0.11, 0.16, 12), 0, 1.06, 0, std(0x2a2520, 0.5, 0.3));
      addPart(g, new THREE.TorusGeometry(0.1, 0.012, 6, 16), 0, 0.99, 0, std(C.trim, 0.4, 0.6), Math.PI / 2);
      break;
    }
  }

  // ---- 武器（右手前侧）----
  const rightHand = new THREE.Group();
  rightHand.position.set(0.17, 0.6, 0.12);
  g.add(rightHand);
  let weapon;
  switch (type) {
    case 'K': weapon = buildSword(); weapon.position.set(0, 0.0, 0.05); weapon.rotation.x = -0.08; break;
    case 'A': weapon = buildFan(); weapon.position.set(-0.14, 0.0, 0.12); weapon.rotation.y = 0.4; break;
    case 'E': weapon = buildTablet(); weapon.position.set(-0.1, 0.0, 0.2); break;
    case 'H': weapon = buildLance(); weapon.position.set(0, 0.0, 0.05); break;
    case 'R': weapon = buildHalberd(); weapon.position.set(0, 0.0, 0.05); break;
    case 'C': weapon = buildCrossbow(); weapon.position.set(0, 0.0, 0.22); break;
    case 'S': weapon = buildSpear(); weapon.position.set(0, 0.0, 0.05); break;
  }
  if (weapon) { weapon.traverse(o => { if (o.isMesh) o.castShadow = true; }); rightHand.add(weapon); }

  return g;
}

// ---- 导出 ----
export function createCharacter(side, type) {
  const group = new THREE.Group();
  group.add(buildPedestal(side));
  group.add(buildPlaque(side, type));
  const fig = buildFigure(side, type);
  fig.position.y = PED_TOP;
  group.add(fig);

  // 朝向敌方：红方在 +Z 朝 -Z；黑方在 -Z 朝 +Z。人偶默认面朝 +Z
  group.rotation.y = side === 'r' ? Math.PI : 0;

  group.userData = { side, type };
  return group;
}

export const CHARACTER_HEIGHT = 1.25; // 供外部参考（如选中环高度）
