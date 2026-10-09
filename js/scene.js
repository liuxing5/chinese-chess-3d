// scene.js —— 三维场景：水墨远山、红灯笼、暖光、飘落花瓣
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140f0a);
  scene.fog = new THREE.FogExp2(0x1a140d, 0.018);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 11, 13);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 26;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.target.set(0, 0, 0);
  controls.enablePan = false;

  // ===== 光照 =====
  const hemi = new THREE.HemisphereLight(0xffe6b0, 0x2a1a10, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.1);
  sun.position.set(6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // 暖色补光（仿烛火）
  const warm = new THREE.PointLight(0xff8a3a, 0.7, 30, 1.6);
  warm.position.set(-6, 5, 6);
  scene.add(warm);
  const warm2 = new THREE.PointLight(0xff7a2a, 0.5, 30, 1.6);
  warm2.position.set(6, 5, -6);
  scene.add(warm2);

  // ===== 天空穹顶（渐变） =====
  const skyGeo = new THREE.SphereGeometry(80, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x241a12) },
      mid: { value: new THREE.Color(0x3a2616) },
      bot: { value: new THREE.Color(0x0c0805) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h = normalize(vP).y; vec3 c = mix(bot, mid, smoothstep(-0.2,0.2,h)); c = mix(c, top, smoothstep(0.15,0.7,h)); gl_FragColor = vec4(c,1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ===== 水墨远山（画卷圆柱） =====
  scene.add(createMountainPanorama());

  // ===== 圆木桌 =====
  const tableTex = makeWoodTexture(0x3a2418, 0x241208, 220);
  const tableGeo = new THREE.CylinderGeometry(13, 13.6, 1.0, 64);
  const tableMat = new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.8, metalness: 0.05 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -1.4;
  table.receiveShadow = true;
  scene.add(table);
  // 桌沿金线
  const ringGeo = new THREE.TorusGeometry(13.05, 0.06, 12, 80);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xb8893a, roughness: 0.4, metalness: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.9;
  scene.add(ring);

  // ===== 灯笼 =====
  const lanterns = [];
  const lanternPositions = [
    [-9, 5, 9], [9, 5, 9], [-9, 5, -9], [9, 5, -9], [0, 6.5, 11],
  ];
  lanternPositions.forEach(p => lanterns.push(addLantern(scene, p[0], p[1], p[2])));

  // ===== 飘落花瓣 =====
  const petals = createPetals();
  scene.add(petals.points);

  // ===== 地面雾气圆盘 =====
  const mistGeo = new THREE.CircleGeometry(14, 48);
  const mistMat = new THREE.MeshBasicMaterial({ color: 0x6a5a4a, transparent: true, opacity: 0.12, depthWrite: false });
  const mist = new THREE.Mesh(mistGeo, mistMat);
  mist.rotation.x = -Math.PI / 2; mist.position.y = -0.85;
  scene.add(mist);

  const clock = new THREE.Clock();

  function update() {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    controls.update();
    // 灯笼轻摇
    lanterns.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.8 + i) * 0.05; l.children[0] && (l.children[0].intensity = 1.0 + Math.sin(t * 3 + i) * 0.15); });
    // 花瓣飘落
    updatePetals(petals, dt);
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // 视角翻转：红方/黑方
  function setViewSide(side, animate) {
    const z = side === 'r' ? 13 : -13;
    const targetZ = side === 'r' ? 0 : 0;
    if (animate) {
      animateCameraTo(camera, controls, new THREE.Vector3(0, 11, z), new THREE.Vector3(0, 0, targetZ));
    } else {
      camera.position.set(0, 11, z);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  return { scene, camera, renderer, controls, update, setViewSide, getClock: () => clock };
}

// ====== 工具：木纹纹理 ======
function makeWoodTexture(baseC, darkC, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const base = new THREE.Color(baseC), dark = new THREE.Color(darkC);
  ctx.fillStyle = `rgb(${base.r * 255 | 0},${base.g * 255 | 0},${base.b * 255 | 0})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * size;
    const a = 0.04 + Math.random() * 0.10;
    ctx.strokeStyle = `rgba(${dark.r * 255 | 0},${dark.g * 255 | 0},${dark.b * 255 | 0},${a})`;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ====== 水墨远山画卷 ======
function createMountainPanorama() {
  const group = new THREE.Group();
  const w = 4096, h = 1024;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  // 天空渐变
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3a2616');
  g.addColorStop(0.5, '#5a3a22');
  g.addColorStop(1, '#241810');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // 远山三层（水墨深浅）
  const layers = [
    { y: h * 0.62, amp: 80, color: 'rgba(70,60,70,0.55)', step: 600 },
    { y: h * 0.7, amp: 110, color: 'rgba(40,32,40,0.7)', step: 480 },
    { y: h * 0.8, amp: 140, color: 'rgba(20,16,20,0.85)', step: 380 },
  ];
  layers.forEach(L => {
    ctx.fillStyle = L.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const yy = L.y + Math.sin(x / L.step) * L.amp + Math.sin(x / (L.step * 0.37)) * L.amp * 0.4;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  });
  // 雾气
  ctx.fillStyle = 'rgba(180,160,150,0.10)';
  ctx.fillRect(0, h * 0.55, w, h * 0.2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.CylinderGeometry(40, 40, 30, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 6;
  return mesh;
}

// ====== 灯笼 ======
function addLantern(scene, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  // 提绳
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 3, 6),
    new THREE.MeshBasicMaterial({ color: 0x2a1a10 })
  );
  cord.position.y = 1.5;
  group.add(cord);

  // 上盖
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.5, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0xd4a24a, roughness: 0.4, metalness: 0.6 })
  );
  cap.position.y = 0.6; group.add(cap);
  // 灯身
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0xff4a2a, emissiveIntensity: 0.6, roughness: 0.6 })
  );
  body.scale.y = 0.95;
  group.add(body);
  // 下盖
  const cap2 = cap.clone(); cap2.position.y = -0.6; group.add(cap2);
  // 流苏
  const tassel = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8c878, roughness: 0.7 })
  );
  tassel.position.y = -0.85; group.add(tassel);

  // 灯光
  const light = new THREE.PointLight(0xff7a3a, 1.0, 14, 1.8);
  light.position.set(0, 0, 0);
  group.add(light);

  group.userData.body = body;
  scene.add(group);
  return group;
}

// ====== 花瓣粒子 ======
function createPetals() {
  const COUNT = 160;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 28;
    pos[i * 3 + 1] = Math.random() * 14;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    vel[i * 3] = (Math.random() - 0.5) * 0.3;
    vel[i * 3 + 1] = -0.25 - Math.random() * 0.3;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    phase[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // 花瓣纹理
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(16, 16, 2, 16, 16, 14);
  grd.addColorStop(0, 'rgba(255,200,210,0.95)');
  grd.addColorStop(1, 'rgba(220,120,140,0.0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({
    size: 0.28, map: tex, transparent: true, depthWrite: false,
    opacity: 0.85, color: 0xff9aa8, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  return { points, pos, vel, phase, count: COUNT };
}
function updatePetals(P, dt) {
  for (let i = 0; i < P.count; i++) {
    P.phase[i] += dt;
    P.pos[i * 3] += P.vel[i * 3] * dt + Math.sin(P.phase[i]) * 0.004;
    P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
    P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt + Math.cos(P.phase[i] * 0.7) * 0.004;
    if (P.pos[i * 3 + 1] < -1) {
      P.pos[i * 3] = (Math.random() - 0.5) * 28;
      P.pos[i * 3 + 1] = 14;
      P.pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
  }
  P.points.geometry.attributes.position.needsUpdate = true;
}

// ====== 相机过渡动画 ======
export function animateCameraTo(camera, controls, toPos, toTarget, duration = 900) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const start = performance.now();
  function step() {
    const k = Math.min(1, (performance.now() - start) / duration);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
    camera.position.lerpVectors(fromPos, toPos, e);
    controls.target.lerpVectors(fromTarget, toTarget, e);
    controls.update();
    if (k < 1) requestAnimationFrame(step);
  }
  step();
}
