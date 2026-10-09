// rules.js —— 中国象棋规则引擎
// 棋盘：10 行 × 9 列，棋子落在交叉点上。row 0 为红方底线，row 9 为黑方底线。
// 棋子表示：{ side: 'r' | 'b', type: 'K'|'A'|'E'|'H'|'R'|'C'|'S' }
//   K 将/帅  A 士/仕  E 象/相  H 马  R 车  C 炮  S 卒/兵

export const ROWS = 10;
export const COLS = 9;

// 棋子汉字
export const CHAR = {
  r: { K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', S: '兵' },
  b: { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', S: '卒' },
};

export const SIDE_NAME = { r: '红方', b: '黑方' };

// 初始局面
export function createInitialBoard() {
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const back = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'];
  // 红方
  back.forEach((t, c) => { b[0][c] = { side: 'r', type: t }; });
  b[2][1] = { side: 'r', type: 'C' }; b[2][7] = { side: 'r', type: 'C' };
  for (const c of [0, 2, 4, 6, 8]) b[3][c] = { side: 'r', type: 'S' };
  // 黑方
  back.forEach((t, c) => { b[9][c] = { side: 'b', type: t }; });
  b[7][1] = { side: 'b', type: 'C' }; b[7][7] = { side: 'b', type: 'C' };
  for (const c of [0, 2, 4, 6, 8]) b[6][c] = { side: 'b', type: 'S' };
  return b;
}

export function cloneBoard(b) {
  return b.map(row => row.map(p => p ? { ...p } : null));
}

export function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function inPalace(r, c, side) {
  if (c < 3 || c > 5) return false;
  return side === 'r' ? (r >= 0 && r <= 2) : (r >= 7 && r <= 9);
}

function ownSide(r, side) {
  // 是否在本方半场（红 0-4，黑 5-9）
  return side === 'r' ? r <= 4 : r >= 5;
}

// 生成单个棋子的伪合法走法（不考虑将军/照面）
function pseudoMoves(board, r, c) {
  const p = board[r][c];
  if (!p) return [];
  const moves = [];
  const side = p.side;
  const enemy = side === 'r' ? 'b' : 'r';

  const tryStep = (nr, nc) => {
    if (!inBoard(nr, nc)) return;
    const t = board[nr][nc];
    if (!t) moves.push({ r: nr, c: nc, capture: false });
    else if (t.side === enemy) moves.push({ r: nr, c: nc, capture: true });
  };

  switch (p.type) {
    case 'K': { // 将/帅
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (inPalace(nr, nc, side)) tryStep(nr, nc);
      });
      break;
    }
    case 'A': { // 士
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (inPalace(nr, nc, side)) tryStep(nr, nc);
      });
      break;
    }
    case 'E': { // 象/相，田字，不过河，塞象眼
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (!inBoard(nr, nc)) return;
        if (!ownSide(nr, side)) return; // 不过河
        const er = r + dr / 2, ec = c + dc / 2;
        if (board[er][ec]) return; // 塞象眼
        tryStep(nr, nc);
      });
      break;
    }
    case 'H': { // 马，日字，蹩马腿
      const offs = [
        [-2, -1, -1, 0], [-2, 1, -1, 0],
        [2, -1, 1, 0], [2, 1, 1, 0],
        [-1, -2, 0, -1], [1, -2, 0, -1],
        [-1, 2, 0, 1], [1, 2, 0, 1],
      ];
      offs.forEach(([dr, dc, lr, lc]) => {
        const nr = r + dr, nc = c + dc;
        if (!inBoard(nr, nc)) return;
        if (board[r + lr][c + lc]) return; // 蹩腿
        tryStep(nr, nc);
      });
      break;
    }
    case 'R': { // 车
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        while (inBoard(nr, nc)) {
          const t = board[nr][nc];
          if (!t) { moves.push({ r: nr, c: nc, capture: false }); }
          else { if (t.side === enemy) moves.push({ r: nr, c: nc, capture: true }); break; }
          nr += dr; nc += dc;
        }
      });
      break;
    }
    case 'C': { // 炮，移动同车，吃子须翻一山
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        let jumped = false;
        while (inBoard(nr, nc)) {
          const t = board[nr][nc];
          if (!jumped) {
            if (!t) moves.push({ r: nr, c: nc, capture: false });
            else jumped = true;
          } else {
            if (t) { if (t.side === enemy) moves.push({ r: nr, c: nc, capture: true }); break; }
          }
          nr += dr; nc += dc;
        }
      });
      break;
    }
    case 'S': { // 卒/兵
      const forward = side === 'r' ? 1 : -1;
      tryStep(r + forward, c); // 向前
      // 过河后可横走
      const crossed = side === 'r' ? r >= 5 : r <= 4;
      if (crossed) {
        tryStep(r, c - 1);
        tryStep(r, c + 1);
      }
      break;
    }
  }
  return moves;
}

// 找将/帅位置
function findKing(board, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.side === side && p.type === 'K') return { r, c };
    }
  return null;
}

// 两将是否照面（同列且中间无子）
function kingsFacing(board) {
  const rk = findKing(board, 'r');
  const bk = findKing(board, 'b');
  if (!rk || !bk || rk.c !== bk.c) return false;
  const c = rk.c;
  const lo = Math.min(rk.r, bk.r), hi = Math.max(rk.r, bk.r);
  for (let r = lo + 1; r < hi; r++) if (board[r][c]) return false;
  return true;
}

// side 是否被将军
export function isInCheck(board, side) {
  const king = findKing(board, side);
  if (!king) return true;
  if (kingsFacing(board)) return true;
  const enemy = side === 'r' ? 'b' : 'r';
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.side === enemy) {
        const ms = pseudoMoves(board, r, c);
        for (const m of ms) if (m.r === king.r && m.c === king.c) return true;
      }
    }
  return false;
}

// 合法走法（过滤将军与照面）
export function legalMoves(board, r, c) {
  const p = board[r][c];
  if (!p) return [];
  const result = [];
  const ms = pseudoMoves(board, r, c);
  for (const m of ms) {
    const nb = cloneBoard(board);
    nb[m.r][m.c] = nb[r][c];
    nb[r][c] = null;
    if (!isInCheck(nb, p.side)) result.push(m);
  }
  return result;
}

// 是否将死
export function isCheckmate(board, side) {
  if (!isInCheck(board, side)) return false;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.side === side) {
        if (legalMoves(board, r, c).length > 0) return false;
      }
    }
  return true;
}

// 是否无棋可走（困毙）
export function hasAnyMove(board, side) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.side === side) {
        if (legalMoves(board, r, c).length > 0) return true;
      }
    }
  return false;
}
