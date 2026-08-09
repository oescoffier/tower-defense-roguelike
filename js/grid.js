// ============================================================
//  GRID — quadrillage, obstacles, BFS, validation anti-blocage
//  et chemin aérien fixe.
// ============================================================

import { GRID, CELL, MAP_GROWTH } from './config.js';
import { Rng } from './rng.js';

export class Grid {
  /**
   * @param {number} seed
   * @param {object} [fixed]  carte imposée (tutoriel) : { layout, spawn, base,
   *                          airEdge, airFrac, airBowSign }. Quand elle est
   *                          fournie, aucune génération aléatoire n'a lieu.
   */
  constructor(seed = 1, fixed = null) {
    this.cols = GRID.cols;
    this.rows = GRID.rows;
    this.cell = GRID.cell;
    this.cells = new Uint8Array(this.cols * this.rows);
    this.towers = new Array(this.cols * this.rows).fill(null);

    // Le spawn et la base sont placés par generate() (bord + position aléatoires).
    this.spawn = { x: 0, y: (this.rows >> 1) };
    this.base = { x: this.cols - 1, y: (this.rows >> 1) };
    this.spawnEdge = 0;
    this.baseEdge = 1;
    this.airEdge = 2;
    this.airFrac = 0.5;

    if (fixed) this.applyFixed(fixed);
    else this.generate(seed);

    // Liste des points d'entrée au sol : this.spawn reste le premier (celui
    // d'origine), grow() peut en ajouter d'autres sur les anneaux extérieurs.
    this.spawns = [this.spawn];

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
  //  1. Une silhouette (this.shape) délimite la zone jouable : rectangle
  //     complet, rond, carré, étoile, ou bande horizontale/verticale.
  //  2. Le spawn et la base sont placés à l'opposé l'un de l'autre à
  //     travers le centre de cette silhouette (obligatoire pour le sol).
  //  3. Un motif d'obstacles (this.terrain) est généré à l'intérieur.
  // ----------------------------------------------------------
  /**
   * Carte dessinée à la main plutôt que générée : chaque caractère du
   * `layout` décrit une case (# roche, S apparition, B base, tout le
   * reste = libre). Utilisé par le tutoriel, dont les leçons reposent
   * sur des cases précises.
   */
  applyFixed(fixed) {
    this.shape = 'full';
    this.terrain = 'fixed';
    this.cells.fill(CELL.EMPTY);

    const rows = fixed.layout || [];
    for (let y = 0; y < this.rows; y++) {
      const line = rows[y] || '';
      for (let x = 0; x < this.cols; x++) {
        this.set(x, y, line[x] === '#' ? CELL.ROCK : CELL.EMPTY);
      }
    }

    this.spawn = { ...fixed.spawn };
    this.base = { ...fixed.base };
    this.set(this.spawn.x, this.spawn.y, CELL.SPAWN);
    this.set(this.base.x, this.base.y, CELL.BASE);

    const cx = (this.cols - 1) / 2, cy = (this.rows - 1) / 2;
    this.spawnEdge = this._approxEdge(this.spawn, cx, cy);
    this.baseEdge = this._approxEdge(this.base, cx, cy);
    this.airEdge = fixed.airEdge !== undefined ? fixed.airEdge : 2;
    this.airFrac = fixed.airFrac !== undefined ? fixed.airFrac : 0.5;
    this.airBowSign = fixed.airBowSign || 1;
  }

  generate(seed) {
    const rng = new Rng(seed);
    this.cells.fill(CELL.EMPTY);

    this.shape = rng.pick(['full', 'circle', 'square', 'star', 'rect-h', 'rect-v']);
    this._placeSpawnAndBase(rng);
    this._pickAirEntry(rng);
    this.airBowSign = rng.bool() ? 1 : -1;

    this.terrain = rng.pick(['clusters', 'zigzag', 'chambers', 'pillars']);
    switch (this.terrain) {
      case 'zigzag': this._genZigzag(rng); break;
      case 'chambers': this._genChambers(rng); break;
      case 'pillars': this._genPillars(rng); break;
      default: this._genClusters(rng); break;
    }

    // Découpe la silhouette : tout ce qui tombe hors de la forme devient
    // roche, quel que soit ce que le motif d'obstacles y a posé.
    if (this.shape !== 'full') {
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this._insideShape(x, y)) this.set(x, y, CELL.ROCK);
        }
      }
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

    // On garantit qu'un chemin existe dès la génération, sans jamais percer
    // la silhouette : seules les roches DANS la forme peuvent être ouvertes.
    let guard = 0;
    while (!this._reachable(null) && guard++ < 600) {
      const i = Math.floor(rng.next() * this.cells.length);
      const x = i % this.cols, y = (i / this.cols) | 0;
      if (this.cells[i] === CELL.ROCK && this._insideShape(x, y)) this.cells[i] = CELL.EMPTY;
    }
  }

  /**
   * Place le spawn et la base à l'opposé l'un de l'autre à travers le
   * centre de la silhouette : on tire une direction au hasard, chacun va
   * jusqu'au bord de la forme dans un sens ou dans l'autre. Les terrestres
   * doivent donc toujours traverser la carte de part en part.
   */
  _placeSpawnAndBase(rng) {
    const cx = (this.cols - 1) / 2, cy = (this.rows - 1) / 2;
    const theta = rng.float(0, Math.PI * 2);
    this.spawn = this._farthestInside(cx, cy, theta);
    this.base = this._farthestInside(cx, cy, theta + Math.PI);
    this.spawnEdge = this._approxEdge(this.spawn, cx, cy);
    this.baseEdge = this._approxEdge(this.base, cx, cy);
  }

  /** Dernière case à l'intérieur de la silhouette en partant du centre, dans une direction donnée. */
  _farthestInside(cx, cy, theta) {
    const dx = Math.cos(theta), dy = Math.sin(theta);
    let best = { x: Math.round(cx), y: Math.round(cy) };
    const maxR = Math.hypot(this.cols, this.rows);
    for (let r = 0.5; r <= maxR; r += 0.5) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (!this.inBounds(x, y) || !this._insideShape(x, y)) break;
      best = { x, y };
    }
    return best;
  }

  /** Bord de la grille le plus proche d'un point, pour l'orientation du chemin aérien. */
  _approxEdge(pt, cx, cy) {
    const dx = (pt.x - cx) / this.cols, dy = (pt.y - cy) / this.rows;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 0 : 1;
    return dy < 0 ? 2 : 3;
  }

  /** Vecteur unitaire pointant hors de la grille depuis un bord donné. */
  _outwardDir(edge) {
    if (edge === 0) return { x: -1, y: 0 };
    if (edge === 1) return { x: 1, y: 0 };
    if (edge === 2) return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  /** Point (x,y) à l'intérieur de la silhouette de carte courante ? */
  _insideShape(x, y) {
    if (!this.shape || this.shape === 'full') return true;
    const cols = this.cols, rows = this.rows;
    const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    switch (this.shape) {
      case 'circle': {
        const nx = (x - cx) / (cols / 2), ny = (y - cy) / (rows / 2);
        return nx * nx + ny * ny <= 0.92 * 0.92;
      }
      case 'square': {
        const half = (Math.min(cols, rows) - 2) / 2;
        return Math.abs(x - cx) <= half && Math.abs(y - cy) <= half;
      }
      case 'rect-h': {
        const half = Math.max(5, Math.round(rows * 0.55)) / 2;
        return Math.abs(y - cy) <= half;
      }
      case 'rect-v': {
        const half = Math.max(7, Math.round(cols * 0.4)) / 2;
        return Math.abs(x - cx) <= half;
      }
      case 'star': {
        const nx = (x - cx) / (cols / 2), ny = (y - cy) / (rows / 2);
        return this._insideStar(nx, ny);
      }
      default:
        return true;
    }
  }

  /** Test d'appartenance à une étoile à 5 branches, en coordonnées normalisées (-1..1). */
  _insideStar(nx, ny) {
    const r = Math.hypot(nx, ny);
    if (r < 1e-6) return true;
    const points = 5;
    const outerR = 1.0, innerR = 0.42;
    const seg = Math.PI / points;
    let a = Math.atan2(ny, nx) + Math.PI / 2; // une pointe vers le haut
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const k = Math.floor(a / seg);
    const t = (a - k * seg) / seg;
    const rA = k % 2 === 0 ? outerR : innerR;
    const rB = k % 2 === 0 ? innerR : outerR;
    return r <= rA + (rB - rA) * t;
  }

  /** Case aléatoire à l'intérieur de la silhouette (retombe sur le centre si pas de chance). */
  _randomPointInShape(rng, tries = 25) {
    for (let i = 0; i < tries; i++) {
      const x = rng.int(1, this.cols - 2), y = rng.int(1, this.rows - 2);
      if (this._insideShape(x, y)) return { x, y };
    }
    return { x: Math.round((this.cols - 1) / 2), y: Math.round((this.rows - 1) / 2) };
  }

  /** Point en pixels sur un bord donné, à la fraction f (0..1) de sa longueur. */
  _edgePixelPoint(edge, f) {
    const w = GRID.w, h = GRID.h;
    if (edge === 0) return { x: 0, y: f * h };
    if (edge === 1) return { x: w, y: f * h };
    if (edge === 2) return { x: f * w, y: 0 };
    return { x: f * w, y: h };
  }

  /**
   * Choisit le point d'entrée du couloir aérien, INDÉPENDAMMENT du spawn au
   * sol : les ennemis volants n'ont pas à partir du même endroit que ceux
   * au sol. On retient, parmi les bords qui ne portent pas la base, celui
   * qui offre la plus longue traversée jusqu'à la base, pour garantir une
   * distance de vol toujours confortable quelle que soit la carte.
   */
  _pickAirEntry(rng) {
    const end = { x: this.cx(this.base.x), y: this.cy(this.base.y) };
    const candidates = [0, 1, 2, 3].filter((e) => e !== this.baseEdge);
    let bestEdge = candidates[0], bestDist = -1;
    for (const edge of candidates) {
      const mid = this._edgePixelPoint(edge, 0.5);
      const d = Math.hypot(mid.x - end.x, mid.y - end.y);
      if (d > bestDist) { bestDist = d; bestEdge = edge; }
    }
    this.airEdge = bestEdge;
    this.airFrac = rng.float(0.12, 0.88);
  }

  // ---- Formes d'obstacles ----

  /** Amas rocheux organiques + colonnes décoratives (forme historique). */
  _genClusters(rng) {
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
    for (let x = 4; x < this.cols - 4; x += 5) {
      const y = rng.int(1, this.rows - 2);
      this.set(x, y, CELL.ROCK);
      if (rng.bool(0.5)) this.set(x, Math.min(this.rows - 1, y + 1), CELL.ROCK);
    }
  }

  /** Murs pleins percés d'une brèche qui alterne d'un côté à l'autre : corridor en serpentin. */
  _genZigzag(rng) {
    const horizontal = Math.abs(this.base.x - this.spawn.x) >= Math.abs(this.base.y - this.spawn.y);
    let gapSide = rng.bool();
    if (horizontal) {
      const step = rng.int(3, 4);
      for (let x = 2; x < this.cols - 2; x += step) {
        const gapY = gapSide ? rng.int(0, 3) : rng.int(this.rows - 4, this.rows - 1);
        const gapH = rng.int(2, 3);
        for (let y = 0; y < this.rows; y++) {
          if (y >= gapY && y < gapY + gapH) continue;
          this.set(x, y, CELL.ROCK);
        }
        gapSide = !gapSide;
      }
    } else {
      const step = rng.int(3, 4);
      for (let y = 1; y < this.rows - 1; y += step) {
        const gapX = gapSide ? rng.int(0, 5) : rng.int(this.cols - 6, this.cols - 1);
        const gapW = rng.int(3, 5);
        for (let x = 0; x < this.cols; x++) {
          if (x >= gapX && x < gapX + gapW) continue;
          this.set(x, y, CELL.ROCK);
        }
        gapSide = !gapSide;
      }
    }
  }

  /** Salles carrées reliées par des corridors coudés, creusées dans un bloc de roche plein. */
  _genChambers(rng) {
    this.cells.fill(CELL.ROCK);

    const rooms = [{ x: this.spawn.x, y: this.spawn.y }];
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) rooms.push(this._randomPointInShape(rng));
    rooms.push({ x: this.base.x, y: this.base.y });

    const carveRoom = (cx, cy) => {
      const w = rng.int(2, 4), h = rng.int(2, 3);
      for (let y = cy - h; y <= cy + h; y++) {
        for (let x = cx - w; x <= cx + w; x++) {
          if (this.inBounds(x, y)) this.set(x, y, CELL.EMPTY);
        }
      }
    };
    const carveH = (fromX, toX, atY) => {
      const [x0, x1] = fromX < toX ? [fromX, toX] : [toX, fromX];
      for (let x = x0; x <= x1; x++) {
        for (let y = atY - 1; y <= atY + 1; y++) if (this.inBounds(x, y)) this.set(x, y, CELL.EMPTY);
      }
    };
    const carveV = (fromY, toY, atX) => {
      const [y0, y1] = fromY < toY ? [fromY, toY] : [toY, fromY];
      for (let y = y0; y <= y1; y++) {
        for (let x = atX - 1; x <= atX + 1; x++) if (this.inBounds(x, y)) this.set(x, y, CELL.EMPTY);
      }
    };

    for (const r of rooms) carveRoom(r.x, r.y);
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i], b = rooms[i + 1];
      if (rng.bool()) { carveH(a.x, b.x, a.y); carveV(a.y, b.y, b.x); }
      else { carveV(a.y, b.y, a.x); carveH(a.x, b.x, b.y); }
    }
  }

  /** Grille lâche de piliers de tailles variables, plus structurée que les amas organiques. */
  _genPillars(rng) {
    const spacingX = rng.int(4, 5), spacingY = rng.int(3, 4);
    for (let gy = 1; gy < this.rows - 1; gy += spacingY) {
      for (let gx = 2; gx < this.cols - 2; gx += spacingX) {
        if (rng.bool(0.22)) continue; // certains emplacements restent libres
        const jx = gx + rng.int(-1, 1), jy = gy + rng.int(-1, 1);
        const size = rng.bool(0.3) ? 2 : 1;
        for (let y = jy; y < jy + size; y++) {
          for (let x = jx; x < jx + size; x++) {
            if (this.inBounds(x, y)) this.set(x, y, CELL.ROCK);
          }
        }
      }
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
    const spawns = this.spawns || [this.spawn];
    return spawns.every((s) => d[this.idx(s.x, s.y)] !== -1);
  }

  /** Recalcule le champ de distance et un chemin de référence par spawn. */
  recompute() {
    this.prevPath = this.path;
    this.computeDistance(null, this.dist);
    this.paths = (this.spawns || [this.spawn]).map((s) => this.tracePath(s.x, s.y));
    this.path = this.paths[0];
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
    for (const s of this.spawns || [this.spawn]) {
      if (test[this.idx(s.x, s.y)] === -1) {
        return { ok: false, reason: 'CHEMIN COUPÉ' };
      }
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
  //  Extension infinie de la carte — appelée toutes les MAP_GROWTH.every
  //  vagues. Ajoute une case tout autour (donc +2 colonnes, +2 lignes),
  //  ce qui décale l'intégralité du contenu existant d'une case en (1,1).
  //  GRID.cols/rows (config global, dont dépendent GRID.w/h) sont mis à
  //  jour ici pour que canvas/UI restent synchronisés avec la grille.
  // ----------------------------------------------------------
  grow() {
    const off = 1;
    const oldCols = this.cols, oldRows = this.rows;
    const newCols = oldCols + off * 2, newRows = oldRows + off * 2;
    const newCells = new Uint8Array(newCols * newRows).fill(CELL.EMPTY);
    const newTowers = new Array(newCols * newRows).fill(null);
    const newIdx = (x, y) => y * newCols + x;

    for (let y = 0; y < oldRows; y++) {
      for (let x = 0; x < oldCols; x++) {
        const oi = y * oldCols + x;
        newCells[newIdx(x + off, y + off)] = this.cells[oi];
        newTowers[newIdx(x + off, y + off)] = this.towers[oi];
      }
    }

    this.cols = newCols;
    this.rows = newRows;
    this.cells = newCells;
    this.towers = newTowers;
    GRID.cols = newCols;
    GRID.rows = newRows;

    this.base = { x: this.base.x + off, y: this.base.y + off };
    this.spawns = this.spawns.map((s) => ({ x: s.x + off, y: s.y + off }));
    this.spawn = this.spawns[0];

    // L'anneau tout juste ajouté n'est pas un vide parfait : quelques
    // cailloux y apparaissent aussi, comme sur la carte d'origine.
    this._scatterRingRocks();

    // Un nouveau spawn n'est même tenté qu'une extension sur
    // MAP_GROWTH.spawnEvery (donc pas à chaque agrandissement).
    this.growthCount = (this.growthCount || 0) + 1;
    const addedSpawn = (this.growthCount % MAP_GROWTH.spawnEvery === 0)
      ? this._addRingSpawn() : null;

    // Garantit qu'un chemin existe toujours vers TOUS les spawns malgré les
    // nouveaux cailloux, en rouvrant des roches au hasard si besoin (même
    // filet de sécurité que generate()).
    let guard = 0;
    while (!this._reachable(null) && guard++ < 600) {
      const i = Math.floor(Math.random() * this.cells.length);
      if (this.cells[i] === CELL.ROCK) this.cells[i] = CELL.EMPTY;
    }

    this.dist = new Int32Array(this.cols * this.rows).fill(-1);
    this.flow = new Int8Array(this.cols * this.rows * 2);
    this.recompute();
    this.buildAirPath();

    return { addedSpawn };
  }

  /**
   * Pose des cailloux sur l'anneau extérieur fraîchement ajouté, par
   * courts tronçons séparés de passages nets — plutôt qu'un semis
   * indépendant case par case, ce qui dessine de vrais chemins qui
   * percent la bordure au lieu d'un mur troué au hasard.
   */
  _scatterRingRocks() {
    const [runMin, runMax] = MAP_GROWTH.ringRockRun;
    const [gapMin, gapMax] = MAP_GROWTH.ringGapRun;
    const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

    const walk = (cells) => {
      let i = randInt(0, gapMax); // décale le départ pour varier d'un côté à l'autre
      while (i < cells.length) {
        const runLen = randInt(runMin, runMax);
        for (let k = 0; k < runLen && i < cells.length; k++, i++) {
          this.set(cells[i].x, cells[i].y, CELL.ROCK);
        }
        i += randInt(gapMin, gapMax);
      }
    };

    const top = [], bottom = [];
    for (let x = 0; x < this.cols; x++) { top.push({ x, y: 0 }); bottom.push({ x, y: this.rows - 1 }); }
    const left = [], right = [];
    for (let y = 1; y < this.rows - 1; y++) { left.push({ x: 0, y }); right.push({ x: this.cols - 1, y }); }

    walk(top); walk(bottom); walk(left); walk(right);
  }

  /**
   * Avec une chance à chaque extension, ouvre un nouveau point de spawn
   * au sol sur l'anneau tout juste ajouté — plafonné pour ne pas non plus
   * étaler les défenses à l'infini.
   */
  _addRingSpawn() {
    if (this.spawns.length >= MAP_GROWTH.maxSpawns) return null;
    if (Math.random() >= MAP_GROWTH.spawnChance) return null;

    const taken = new Set(this.spawns.map((s) => `${s.x},${s.y}`));
    taken.add(`${this.base.x},${this.base.y}`);
    const ring = [];
    for (let x = 0; x < this.cols; x++) {
      for (const y of [0, this.rows - 1]) {
        if (this.cells[this.idx(x, y)] === CELL.EMPTY && !taken.has(`${x},${y}`)) ring.push({ x, y });
      }
    }
    for (let y = 1; y < this.rows - 1; y++) {
      for (const x of [0, this.cols - 1]) {
        if (this.cells[this.idx(x, y)] === CELL.EMPTY && !taken.has(`${x},${y}`)) ring.push({ x, y });
      }
    }
    if (!ring.length) return null;

    // Trop près de la base, ça ne laisserait aucun temps de réaction : on
    // exige une distance minimale, avec repli sur la case la plus éloignée
    // s'il n'existe vraiment aucune candidate assez loin (petite carte).
    const distToBase = (c) => Math.hypot(c.x - this.base.x, c.y - this.base.y);
    let candidates = ring.filter((c) => distToBase(c) >= MAP_GROWTH.minSpawnDistFromBase);
    if (!candidates.length) {
      let best = ring[0], bestD = -1;
      for (const c of ring) { const d = distToBase(c); if (d > bestD) { bestD = d; best = c; } }
      candidates = [best];
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.set(pick.x, pick.y, CELL.SPAWN);
    this.spawns.push(pick);
    return pick;
  }

  // ----------------------------------------------------------
  //  Chemin aérien — courbe fixe, insensible aux obstacles et non
  //  modifiable par le joueur. Indépendant du spawn au sol : les ennemis
  //  volants entrent par le bord le plus éloigné de la base (choisi en
  //  amont par _pickAirEntry), pour garantir une traversée toujours assez
  //  longue, puis rejoignent la base par une courbe en S.
  // ----------------------------------------------------------
  buildAirPath() {
    const end = { x: this.cx(this.base.x), y: this.cy(this.base.y) };
    const entry = this._edgePixelPoint(this.airEdge, this.airFrac);
    const out = this._outwardDir(this.airEdge);
    const overshoot = 110; // marge hors-champ avant l'entrée dans la zone visible
    const start = { x: entry.x + out.x * overshoot, y: entry.y + out.y * overshoot };

    const dx = end.x - start.x, dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len; // perpendiculaire unitaire
    const bow = Math.min(GRID.w, GRID.h) * 0.32 * (this.airBowSign || 1);
    const c1 = { x: start.x + dx * 0.3 + px * bow, y: start.y + dy * 0.3 + py * bow };
    const c2 = { x: start.x + dx * 0.7 - px * bow, y: start.y + dy * 0.7 - py * bow };

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
