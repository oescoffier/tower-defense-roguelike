// ============================================================
//  GRID — quadrillage, obstacles, BFS, validation anti-blocage
//  et chemin aérien fixe.
// ============================================================

import { GRID, CELL } from './config.js';
import { Rng } from './rng.js';

export class Grid {
  constructor(seed = 1) {
    this.cols = GRID.cols;
    this.rows = GRID.rows;
    this.cell = GRID.cell;
    this.cells = new Uint8Array(this.cols * this.rows);
    this.towers = new Array(this.cols * this.rows).fill(null);

    this.spawn = { x: 0, y: (this.rows >> 1) };
    this.base = { x: this.cols - 1, y: (this.rows >> 1) };

    this.generate(seed);

    // Champ de distance BFS (distance en cases jusqu'à la base) + chemin de référence
    this.dist = new Int32Array(this.cols * this.rows).fill(-1);
    this.flow = new Int8Array(this.cols * this.rows * 2); // direction vers la base
    this.path = [];
    this.prevPath = [];
    this.pathAge = 1;      // 0→1 : progression de l'animation de retracé
    this.recompute();
    this.buildAirPath();
  }

  idx(x, y) { return y * this.cols + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.idx(x, y)] : CELL.ROCK; }
  set(x, y, v) { if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = v; }

  /** Centre pixel d'une cellule. */
  cx(x) { return x * this.cell + this.cell / 2; }
  cy(y) { return y * this.cell + this.cell / 2; }
  /** Cellule sous un point pixel. */
  cellAt(px, py) {
    return { x: Math.floor(px / this.cell), y: Math.floor(py / this.cell) };
  }

  // ----------------------------------------------------------
  //  Génération de la map
  // ----------------------------------------------------------
  generate(seed) {
    const rng = new Rng(seed);
    this.cells.fill(CELL.EMPTY);

    // Amas rocheux : on sème des graines et on les fait croître.
    const clusters = 11;
    for (let c = 0; c < clusters; c++) {
      let x = rng.int(2, this.cols - 3);
      let y = rng.int(1, this.rows - 2);
      const size = rng.int(2, 6);
      for (let s = 0; s < size; s++) {
        if (this.inBounds(x, y)) this.set(x, y, CELL.ROCK);
        const d = rng.int(0, 3);
        x += [1, -1, 0, 0][d];
        y += [0, 0, 1, -1][d];
        x = Math.max(1, Math.min(this.cols - 2, x));
        y = Math.max(0, Math.min(this.rows - 1, y));
      }
    }

    // Colonnes décoratives régulières pour structurer le labyrinthe.
    for (let x = 4; x < this.cols - 4; x += 5) {
      const y = rng.int(1, this.rows - 2);
      this.set(x, y, CELL.ROCK);
      if (rng.bool(0.5)) this.set(x, Math.min(this.rows - 1, y + 1), CELL.ROCK);
    }

    // On dégage l'entrée, la sortie et leurs abords.
    const clear = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (this.inBounds(x, y)) this.set(x, y, CELL.EMPTY);
        }
      }
    };
    clear(this.spawn.x, this.spawn.y, 1);
    clear(this.base.x, this.base.y, 1);
    this.set(this.spawn.x, this.spawn.y, CELL.SPAWN);
    this.set(this.base.x, this.base.y, CELL.BASE);

    // On garantit qu'un chemin existe dès la génération.
    let guard = 0;
    while (!this._reachable(null) && guard++ < 200) {
      // On casse une roche au hasard jusqu'à rouvrir un passage.
      const i = Math.floor(Math.random() * this.cells.length);
      if (this.cells[i] === CELL.ROCK) this.cells[i] = CELL.EMPTY;
    }
  }

  // ----------------------------------------------------------
  //  Franchissabilité
  // ----------------------------------------------------------
  blocked(x, y, extraBlock) {
    if (!this.inBounds(x, y)) return true;
    if (extraBlock && extraBlock.x === x && extraBlock.y === y) return true;
    const v = this.cells[this.idx(x, y)];
    return v === CELL.ROCK || v === CELL.TOWER;
  }

  buildable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const v = this.cells[this.idx(x, y)];
    return v === CELL.EMPTY;
  }

  // ----------------------------------------------------------
  //  BFS — champ de distance depuis la base
  //  On calcule les distances DEPUIS la base : chaque case connaît
  //  alors sa direction de descente, ce qui donne un flow field
  //  valable pour tous les ennemis, où qu'ils se trouvent.
  // ----------------------------------------------------------
  computeDistance(extraBlock = null, out = null) {
    const n = this.cols * this.rows;
    const dist = out || new Int32Array(n);
    dist.fill(-1);
    const queue = new Int32Array(n);
    let head = 0, tail = 0;
    const b = this.idx(this.base.x, this.base.y);
    dist[b] = 0;
    queue[tail++] = b;
    const DX = [1, -1, 0, 0];
    const DY = [0, 0, 1, -1];
    while (head < tail) {
      const cur = queue[head++];
      const cxp = cur % this.cols;
      const cyp = (cur / this.cols) | 0;
      const nd = dist[cur] + 1;
      for (let d = 0; d < 4; d++) {
        const nx = cxp + DX[d], ny = cyp + DY[d];
        if (!this.inBounds(nx, ny)) continue;
        const ni = ny * this.cols + nx;
        if (dist[ni] !== -1) continue;
        if (this.blocked(nx, ny, extraBlock)) continue;
        dist[ni] = nd;
        queue[tail++] = ni;
      }
    }
    return dist;
  }

  _reachable(extraBlock) {
    const d = this.computeDistance(extraBlock);
    return d[this.idx(this.spawn.x, this.spawn.y)] !== -1;
  }

  /** Recalcule le champ de distance et le chemin de référence spawn→base. */
  recompute() {
    this.prevPath = this.path;
    this.computeDistance(null, this.dist);
    this.path = this.tracePath(this.spawn.x, this.spawn.y);
    this.pathAge = 0;
    return this.path;
  }

  /** Suit le gradient de distance depuis (x,y) jusqu'à la base. */
  tracePath(x, y, limit = 512) {
    const out = [];
    let cx = x, cy = y;
    const DX = [1, -1, 0, 0];
    const DY = [0, 0, 1, -1];
    for (let step = 0; step < limit; step++) {
      out.push({ x: cx, y: cy });
      const d = this.dist[this.idx(cx, cy)];
      if (d <= 0) break;
      let bx = -1, by = -1, best = d;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (!this.inBounds(nx, ny)) continue;
        const nd = this.dist[this.idx(nx, ny)];
        if (nd === -1) continue;
        if (nd < best) { best = nd; bx = nx; by = ny; }
      }
      if (bx === -1) break;
      cx = bx; cy = by;
    }
    return out;
  }

  /** Étape suivante pour un ennemi à la case (x,y). null si bloqué/arrivé. */
  nextStep(x, y) {
    const here = this.dist[this.idx(x, y)];
    if (here === -1) return null;
    if (here === 0) return null;
    const DX = [1, -1, 0, 0];
    const DY = [0, 0, 1, -1];
    let bx = -1, by = -1, best = here;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k], ny = y + DY[k];
      if (!this.inBounds(nx, ny)) continue;
      const nd = this.dist[this.idx(nx, ny)];
      if (nd !== -1 && nd < best) { best = nd; bx = nx; by = ny; }
    }
    return bx === -1 ? null : { x: bx, y: by };
  }

  // ----------------------------------------------------------
  //  Pose de tour — validation anti-blocage
  //  Refus si : case non constructible, OU la pose coupe le chemin
  //  spawn→base, OU un ennemi au sol déjà présent perdrait son accès.
  // ----------------------------------------------------------
  canPlace(x, y, groundEnemies = []) {
    if (!this.buildable(x, y)) return { ok: false, reason: 'OCCUPÉ' };

    const test = this.computeDistance({ x, y });
    if (test[this.idx(this.spawn.x, this.spawn.y)] === -1) {
      return { ok: false, reason: 'CHEMIN COUPÉ' };
    }
    for (const e of groundEnemies) {
      if (e.dead || e.air) continue;
      const gx = Math.floor(e.x / this.cell);
      const gy = Math.floor(e.y / this.cell);
      if (!this.inBounds(gx, gy)) continue;
      if (gx === x && gy === y) return { ok: false, reason: 'ENNEMI PRÉSENT' };
      if (test[this.idx(gx, gy)] === -1) {
        return { ok: false, reason: 'ENNEMI ENFERMÉ' };
      }
    }
    return { ok: true };
  }

  place(x, y, tower) {
    this.set(x, y, CELL.TOWER);
    this.towers[this.idx(x, y)] = tower;
    this.recompute();
  }

  remove(x, y) {
    if (this.cells[this.idx(x, y)] !== CELL.TOWER) return null;
    const t = this.towers[this.idx(x, y)];
    this.set(x, y, CELL.EMPTY);
    this.towers[this.idx(x, y)] = null;
    this.recompute();
    return t;
  }

  towerAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.towers[this.idx(x, y)];
  }

  // ----------------------------------------------------------
  //  Chemin aérien — courbe fixe, insensible aux obstacles
  //  et non modifiable par le joueur.
  // ----------------------------------------------------------
  buildAirPath() {
    const w = GRID.w, h = GRID.h;
    const start = { x: -30, y: h * 0.16 };
    const c1 = { x: w * 0.28, y: -h * 0.06 };
    const c2 = { x: w * 0.62, y: h * 1.02 };
    const end = { x: this.cx(this.base.x), y: this.cy(this.base.y) };

    const pts = [];
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      const x = mt * mt * mt * start.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * end.x;
      const y = mt * mt * mt * start.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * end.y;
      pts.push({ x, y });
    }
    // Longueurs cumulées pour un déplacement à vitesse constante.
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    this.airPath = pts;
    this.airCum = cum;
    this.airLength = cum[cum.length - 1];
  }

  /** Position sur le chemin aérien à la distance d (px). */
  airAt(d) {
    const cum = this.airCum, pts = this.airPath;
    if (d <= 0) return { x: pts[0].x, y: pts[0].y, a: 0 };
    if (d >= this.airLength) {
      const p = pts[pts.length - 1], q = pts[pts.length - 2];
      return { x: p.x, y: p.y, a: Math.atan2(p.y - q.y, p.x - q.x) };
    }
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / seg;
    const a = pts[lo], b = pts[hi];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      a: Math.atan2(b.y - a.y, b.x - a.x)
    };
  }

  /** Distance restante jusqu'à la base, en px, pour trier les cibles. */
  progressGround(e) {
    const gx = Math.floor(e.x / this.cell);
    const gy = Math.floor(e.y / this.cell);
    if (!this.inBounds(gx, gy)) return 9999;
    const d = this.dist[this.idx(gx, gy)];
    return d === -1 ? 9999 : d;
  }
}
