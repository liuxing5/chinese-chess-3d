// main.js —— 三维象棋主逻辑
import * as THREE from 'three';
import { createScene, animateCameraTo } from './scene.js';
import { createBoard, boardToWorld, TOP_Y, SPACING, HALF_W, HALF_H } from './board.js';
import { createPiece, createSelectionRing, createMoveDot, PIECE_H } from './pieces.js';
import { Animator, animateMove, animateCapture, animateLand } from './animations.js';
import { audio } from './audio.js';
import { music } from './music.js';
import {
  createInitialBoard, cloneBoard, legalMoves, isInCheck, isCheckmate, hasAnyMove, SIDE_NAME,
} from './rules.js';

const REST_Y = TOP_Y + PIECE_H / 2;
const key = (r, c) => `${r},${c}`;

class Game {
  constructor() {
    this.container = document.getElementById('app');
    this.sceneApi = createScene(this.container);
    this.scene = this.sceneApi.scene;
    this.camera = this.sceneApi.camera;
    this.renderer = this.sceneApi.renderer;
    this.animator = new Animator();
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.board = createInitialBoard();
    this.pieces = new Map();      // cellKey -> THREE.Group
    this.history = [];            // 棋谱
    this.turn = 'r';
    this.selected = null;         // {r,c}
    this.legal = [];              // 当前选中可走点
    this.gameOver = false;
    this.inputLocked = false;
    this.viewSide = 'r';
    this.soundOn = true;

    this.dotGroup = new THREE.Group();
    this.scene.add(this.dotGroup);
    this.selRing = createSelectionRing();
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    this._bindUI();
  }

  async init() {
    // 加载页兜底：无论如何 6 秒后强制隐藏
    const hideLoader = () => {
      const loader = document.getElementById('loader');
      if (loader) { loader.classList.add('hidden'); setTimeout(() => loader && loader.remove(), 900); }
    };
    const fallback = setTimeout(hideLoader, 6000);
    try {
      // 等待中文字体，保证棋子/棋盘文字渲染
      if (document.fonts) {
        try {
          await Promise.race([
            Promise.all([
              document.fonts.load('900 120px "Noto Serif SC"'),
              document.fonts.load('40px "Ma Shan Zheng"'),
              document.fonts.ready,
            ]),
            new Promise(r => setTimeout(r, 4000)),
          ]);
        } catch (e) { /* ignore */ }
      }

      // 棋盘
      this.boardMesh = createBoard();
      this.scene.add(this.boardMesh);

      // 棋子
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 9; c++) {
          const p = this.board[r][c];
          if (p) this._addPiece(p.side, p.type, r, c, false);
        }

      this._setTurn('r');
      this._loop();

      clearTimeout(fallback);
      hideLoader();
      window.__xiangqiReady = true;

      // 首次交互唤醒音频（音效与配乐共享同一手势解锁）
      const wake = () => { audio.resume(); music.resume(); window.removeEventListener('pointerdown', wake); };
      window.addEventListener('pointerdown', wake);
    } catch (err) {
      console.error('象棋初始化失败：', err);
      clearTimeout(fallback);
      hideLoader();
      if (window.__xiangqiFatal) window.__xiangqiFatal('初始化失败<br><small>' + (err && err.message ? err.message : '未知错误') + '</small>');
    }
  }

  _addPiece(side, type, r, c, animateIn = true) {
    const g = createPiece(side, type);
    const w = boardToWorld(r, c);
    g.position.set(w.x, REST_Y, w.z);
    this.scene.add(g);
    this.pieces.set(key(r, c), g);
    return g;
  }

  // ====== UI 绑定 ======
  _bindUI() {
    const dom = this.renderer.domElement;
    let downPos = null, downT = 0;
    dom.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY }; downT = performance.now();
    });
    dom.addEventListener('pointerup', (e) => {
      if (!downPos) return;
      const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      const dist = Math.hypot(dx, dy);
      const dt = performance.now() - downT;
      downPos = null;
      if (dist > 8 || dt > 500) return; // 视为拖拽，不落子
      this._handleTap(e.clientX, e.clientY);
    });

    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('btn-camera').addEventListener('click', () => this.flipView());
    document.getElementById('btn-sound').addEventListener('click', (e) => this.toggleSound(e.currentTarget));
    document.getElementById('btn-help').addEventListener('click', () => document.getElementById('help-modal').classList.remove('hidden'));
    document.getElementById('btn-help-close').addEventListener('click', () => document.getElementById('help-modal').classList.add('hidden'));

    this._bindMusic();
    this._setupRotateHint();
  }

  // ====== 横屏提示（仅触屏设备竖屏时显示） ======
  _setupRotateHint() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;
    // 通过 (pointer: coarse) 判断触屏设备；桌面窗口不提示
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) return;
    const update = () => {
      const portrait = window.innerHeight > window.innerWidth;
      hint.classList.toggle('hidden', !portrait);
    };
    update();
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
  }

  // ====== 配乐面板绑定（独立于音效） ======
  _bindMusic() {
    const sel = document.getElementById('music-select');
    const btn = document.getElementById('btn-music');
    const fileIn = document.getElementById('music-file');

    const syncBtn = () => { btn.textContent = music.playing ? '⏸' : '▶'; };

    sel.addEventListener('change', () => {
      const v = sel.value;
      if (!v) { music.pause(); music.currentId = null; syncBtn(); return; }
      music.setTrack(v);
      syncBtn();
    });

    btn.addEventListener('click', () => {
      music.resume();
      if (!music.currentId) {
        // 默认播放第一首
        sel.value = 'dajiang';
        music.setTrack('dajiang');
        syncBtn();
        return;
      }
      music.toggle();
      syncBtn();
    });

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      try {
        const name = await music.loadFile(f);
        // 在下拉中新增/更新"本地音频"选项并选中
        let opt = sel.querySelector('option[value="file"]');
        if (!opt) { opt = document.createElement('option'); opt.value = 'file'; sel.appendChild(opt); }
        opt.textContent = '🎵 ' + name;
        sel.value = 'file';
        syncBtn();
      } catch (err) {
        this._toast('音频加载失败', false);
        console.error('本地音频加载失败：', err);
      }
      fileIn.value = ''; // 允许再次选择同一文件
    });

    // 悬停提示：引导用户加载自有曲目
    const hint = document.getElementById('mp-hint');
    const fileBtn = document.querySelector('.mp-file-btn');
    if (fileBtn && hint) {
      fileBtn.addEventListener('mouseenter', () => hint.hidden = false);
      fileBtn.addEventListener('mouseleave', () => hint.hidden = true);
      fileBtn.addEventListener('focus', () => hint.hidden = false);
      fileBtn.addEventListener('blur', () => hint.hidden = true);
    }
  }

  toggleSound(btn) {
    this.soundOn = !this.soundOn;
    audio.setEnabled(this.soundOn);
    btn.textContent = this.soundOn ? '🔊' : '🔇';
  }

  flipView() {
    this.viewSide = this.viewSide === 'r' ? 'b' : 'r';
    const z = this.viewSide === 'r' ? 13 : -13;
    animateCameraTo(this.camera, this.sceneApi.controls, new THREE.Vector3(0, 11, z), new THREE.Vector3(0, 0, 0));
  }

  // ====== 输入拾取 ======
  _handleTap(cx, cy) {
    if (this.gameOver || this.inputLocked) return;
    audio.resume();
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 优先拾取棋子
    const pickables = Array.from(this.pieces.values());
    const hits = this.raycaster.intersectObjects(pickables, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.side) obj = obj.parent;
      if (obj && obj.userData.side) {
        const cell = this._cellOf(obj);
        if (!cell) return;
        this._onTapCell(cell.r, cell.c);
        return;
      }
    }
    // 否则拾取棋盘交叉点
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP_Y);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, pt)) {
      const c = Math.round(pt.x / SPACING + HALF_W);
      const r = Math.round(HALF_H - pt.z / SPACING);
      if (r < 0 || r > 9 || c < 0 || c > 8) { this._deselect(); return; }
      // 容差判断
      const w = boardToWorld(r, c);
      if (Math.hypot(pt.x - w.x, pt.z - w.z) > SPACING * 0.5) { this._deselect(); return; }
      this._onTapCell(r, c);
    }
  }

  _cellOf(group) {
    for (const [k, g] of this.pieces) if (g === group) {
      const [r, c] = k.split(',').map(Number); return { r, c };
    }
    return null;
  }

  _onTapCell(r, c) {
    const piece = this.board[r][c];
    // 点到己方棋子：选中
    if (piece && piece.side === this.turn) {
      if (this.selected && this.selected.r === r && this.selected.c === c) { this._deselect(); return; }
      this._select(r, c);
      return;
    }
    // 已选中，判断是否合法落点
    if (this.selected) {
      const m = this.legal.find(mm => mm.r === r && mm.c === c);
      if (m) { this._execute(this.selected.r, this.selected.c, r, c); return; }
      audio.invalid();
      this._deselect();
      return;
    }
    // 未选中点空地或敌方
    audio.invalid();
  }

  _select(r, c) {
    this._deselect();
    this.selected = { r, c };
    this.legal = legalMoves(this.board, r, c);
    audio.select();
    const g = this.pieces.get(key(r, c));
    this._selectedGroup = g;
    // 选中光环
    const w = boardToWorld(r, c);
    this.selRing.position.set(w.x, TOP_Y + 0.02, w.z);
    this.selRing.visible = true;
    // 可走点
    this.legal.forEach(m => {
      const dot = createMoveDot(m.capture);
      const mw = boardToWorld(m.r, m.c);
      dot.position.set(mw.x, TOP_Y + 0.03, mw.z);
      this.dotGroup.add(dot);
    });
  }

  _deselect() {
    // 取消选中前，把悬浮的棋子落回棋盘
    if (this._selectedGroup) this._selectedGroup.position.y = REST_Y;
    this.selected = null;
    this.legal = [];
    this._selectedGroup = null;
    this.selRing.visible = false;
    while (this.dotGroup.children.length) this.dotGroup.remove(this.dotGroup.children[0]);
  }

  // ====== 执行走子 ======
  _execute(fromR, fromC, toR, toC) {
    this.inputLocked = true;
    const piece = this.pieces.get(key(fromR, fromC));
    const captured = this.pieces.get(key(toR, toC)) || null;
    const fromVec = piece.position.clone();
    const toVec = boardToWorld(toR, toC); toVec.y = REST_Y;

    // 逻辑更新
    this.board[toR][toC] = this.board[fromR][fromC];
    this.board[fromR][fromC] = null;
    this.pieces.delete(key(fromR, fromC));
    if (captured) this.pieces.delete(key(toR, toC));
    this.pieces.set(key(toR, toC), piece);

    this._deselect();
    audio.clack(!!captured);

    if (captured) {
      animateCapture(this.animator, captured, () => { this.scene.remove(captured); });
    }
    animateMove(this.animator, piece, fromVec, toVec, () => {
      animateLand(this.animator, piece, () => this._afterMove(toR, toC));
    });

    this.history.push({
      from: { r: fromR, c: fromC }, to: { r: toR, c: toC },
      piece, captured, mover: this.turn,
    });
  }

  _afterMove(toR, toC) {
    const mover = this.history[this.history.length - 1].mover;
    const opponent = mover === 'r' ? 'b' : 'r';
    let msg = null;
    if (isCheckmate(this.board, opponent) || !hasAnyMove(this.board, opponent)) {
      // 将死或困毙 -> 胜
      this.gameOver = true;
      msg = `${SIDE_NAME[mover]}胜！`;
      this._toast(msg, true);
      audio.win();
      this._updateTurn(mover); // 高亮胜方
      this.inputLocked = false;
      return;
    }
    if (isInCheck(this.board, opponent)) {
      msg = '将军！';
      this._toast(msg, false);
      audio.check();
    }
    this._setTurn(opponent);
    this.inputLocked = false;
  }

  _setTurn(side) {
    this.turn = side;
    this._updateTurn(side);
  }
  _updateTurn(side) {
    document.querySelector('.turn-card.red').classList.toggle('active', side === 'r');
    document.querySelector('.turn-card.black').classList.toggle('active', side === 'b');
  }

  _toast(text, persist) {
    const el = document.getElementById('status-toast');
    el.textContent = text;
    el.classList.add('show');
    el.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (!persist) this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ====== 悔棋 ======
  undo() {
    if (this.inputLocked || !this.history.length) return;
    const rec = this.history.pop();
    const { piece, captured, from, to, mover } = rec;
    this.inputLocked = true;
    this._deselect();

    // 复原被吃棋子（若有），否则清空落点
    if (captured) {
      this._restoreCaptured(captured, to.r, to.c);
      this.pieces.set(key(to.r, to.c), captured);
      this.board[to.r][to.c] = { side: captured.userData.side, type: captured.userData.type };
    } else {
      this.pieces.delete(key(to.r, to.c));
      this.board[to.r][to.c] = null;
    }
    // 走子棋子回到起点
    this.pieces.set(key(from.r, from.c), piece);
    this.board[from.r][from.c] = { side: piece.userData.side, type: piece.userData.type };

    const toVec = boardToWorld(from.r, from.c); toVec.y = REST_Y;
    animateMove(this.animator, piece, piece.position.clone(), toVec, () => {
      this.inputLocked = false;
    });

    this.gameOver = false;
    document.getElementById('status-toast').classList.remove('show');
    this._setTurn(mover);
  }

  _restoreCaptured(captured, r, c) {
    captured.scale.set(1, 1, 1);
    captured.rotation.set(0, 0, 0);
    const w = boardToWorld(r, c);
    captured.position.set(w.x, REST_Y, w.z);
    captured.traverse(o => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m.transparent = false; m.opacity = 1; });
      }
    });
    this.scene.add(captured);
  }

  // ====== 重新开局 ======
  restart() {
    this._deselect();
    // 清空棋子
    this.pieces.forEach(g => this.scene.remove(g));
    this.pieces.clear();
    this.history = [];
    this.board = createInitialBoard();
    this.gameOver = false;
    this.inputLocked = false;
    document.getElementById('status-toast').classList.remove('show');
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 9; c++) {
        const p = this.board[r][c];
        if (p) this._addPiece(p.side, p.type, r, c);
      }
    this._setTurn('r');
  }

  // ====== 主循环 ======
  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = this.clock.getDelta();
    this.animator.update(dt);
    // 选中悬浮 + 光环旋转
    if (this._selectedGroup) {
      const t = this.clock.elapsedTime;
      this._selectedGroup.position.y = REST_Y + 0.12 + Math.sin(t * 4) * 0.04;
      this.selRing.rotation.z += dt * 1.2;
    }
    // 可走点呼吸
    this.dotGroup.children.forEach((d, i) => {
      d.material.opacity = 0.55 + 0.35 * Math.sin(this.clock.elapsedTime * 4 + i);
    });
    this.sceneApi.update();
  }
}

let game;
try {
  game = new Game();
  game.init();
  window.__xiangqi = game; // 调试用
} catch (e) {
  console.error('象棋启动失败：', e);
  if (window.__xiangqiFatal) {
    const msg = (e && e.message) ? e.message : '未知错误，浏览器可能不支持 WebGL';
    window.__xiangqiFatal('启动失败<br><small>' + msg + '</small>');
  }
}
