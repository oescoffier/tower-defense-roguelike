// ============================================================
//  SPATIAL — table de hachage spatiale des ennemis, reconstruite une
//  fois par frame. Remplace le parcours complet de game.enemies dans les
//  fonctions de collision/portée les plus chaudes (segmentHit pour les
//  balles de mitraillette, enemiesInRange utilisée par le ciblage de
//  CHAQUE tour à CHAQUE frame) : avec beaucoup de tours à cadence
//  élevée et beaucoup d'ennemis, un simple `for (const e of
//  game.enemies)` par balle/par tour devient O(tours×ennemis) ou
//  O(balles×ennemis) par frame — ça explose vite. Ici, une requête ne
//  regarde que les quelques cases voisines du point interrogé.
//
//  Usage purement optionnel et sans risque : c'est un filtre GROSSIER —
//  tout code appelant fait toujours son propre test exact (distance,
//  projection sur segment...) sur les candidats renvoyés. Une requête
//  trop large ne casse rien (juste un peu moins rapide) ; elle ne doit
//  en revanche jamais en oublier.
// ============================================================

export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.buckets = new Map();
  }

  _key(cx, cy) { return cx * 1000003 + cy; }

  clear() { this.buckets.clear(); }

  build(enemies) {
    this.clear();
    for (const e of enemies) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / this.cellSize), cy = Math.floor(e.y / this.cellSize);
      const k = this._key(cx, cy);
      let arr = this.buckets.get(k);
      if (!arr) { arr = []; this.buckets.set(k, arr); }
      arr.push(e);
    }
  }

  /** Ennemis dans les cases couvrant le cercle (x,y,radius) — filtre grossier, pas le test final. */
  queryCircle(x, y, radius) {
    const out = [];
    const cx0 = Math.floor((x - radius) / this.cellSize), cx1 = Math.floor((x + radius) / this.cellSize);
    const cy0 = Math.floor((y - radius) / this.cellSize), cy1 = Math.floor((y + radius) / this.cellSize);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const arr = this.buckets.get(this._key(cx, cy));
        if (arr) for (const e of arr) out.push(e);
      }
    }
    return out;
  }

  /** Ennemis dans les cases couvrant la boîte englobante du segment [x1,y1]-[x2,y2], marge `pad`. */
  querySegment(x1, y1, x2, y2, pad = 0) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const half = Math.hypot(x2 - x1, y2 - y1) / 2;
    return this.queryCircle(cx, cy, half + pad);
  }
}
