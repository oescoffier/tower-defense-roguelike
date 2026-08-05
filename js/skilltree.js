// ============================================================
//  SKILLTREE — étoile à 7 branches, 308 noeuds par branche
//  (2156 au total), générés procéduralement de façon déterministe
//  (PRNG seedé) pour que les sauvegardes restent valides.
//  Rendu sur canvas dédié avec pan / zoom et culling par viewport.
// ============================================================

import {
  TREE, BRANCHES, BRANCH_STATS, NOTABLES, KEYSTONES, PALETTE,
  VARIANTS, VARIANT_RINGS, iconForKey
} from './config.js';
import { Rng, hashStr } from './rng.js';

const TAU = Math.PI * 2;

// ============================================================
//  Génération
// ============================================================

/** Nombre de noeuds par anneau : croît avec le rayon pour garder un espacement lisible. */
function ringCounts() {
  const counts = [];
  const R = TREE.rings;
  for (let r = 0; r < R; r++) {
    counts.push(Math.round(5 + (23 - 5) * (r / (R - 1))));
  }
  // Ajustement pour atteindre exactement TREE.perBranch
  let sum = counts.reduce((a, b) => a + b, 0);
  let i = R - 1;
  while (sum !== TREE.perBranch) {
    if (sum < TREE.perBranch) { counts[i]++; sum++; }
    else { if (counts[i] > 3) { counts[i]--; sum--; } }
    i--;
    if (i < Math.floor(R / 2)) i = R - 1;
  }
  return counts;
}

const KEYSTONE_RINGS = [8, 14, 20];

function fmtValue(stat, value) {
  const v = stat.pct ? (value * 100) : value;
  const rounded = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return stat.fmt.replace('{v}', (rounded > 0 && stat.flat ? '' : '') + rounded);
}

export function buildTree() {
  const nodes = [];
  const byId = new Map();
  const counts = ringCounts();
  const sectorHalf = (TAU / TREE.branches) / 2 * 0.88;

  const hub = {
    id: 'hub', hub: true, branch: -1, ring: -1, x: 0, y: 0,
    cost: 0, type: 'hub', name: 'NOYAU', desc: 'Point de départ de toutes les branches.',
    links: [], r: TREE.hubRadius
  };
  nodes.push(hub);
  byId.set('hub', hub);

  BRANCHES.forEach((branch, bi) => {
    const rng = new Rng(hashStr('branch:' + branch.id) ^ 0x9E3779B9);
    const centerA = bi * (TAU / TREE.branches) - Math.PI / 2;
    const stats = BRANCH_STATS[branch.id];
    const notables = NOTABLES[branch.id];
    const keystones = KEYSTONES[branch.id];
    const branchVariants = VARIANTS[branch.id] || [];
    let keyUsed = 0;
    let variantUsed = 0;

    const rings = [];

    for (let r = 0; r < TREE.rings; r++) {
      const n = counts[r];
      const baseR = TREE.ring0 + r * TREE.ringStep;
      const ring = [];
      const keystoneSlot = KEYSTONE_RINGS.includes(r) ? Math.floor(n / 2) : -1;
      // Un nœud VARIANTE par anneau reserve, decale du keystone.
      const variantSlot = (branchVariants.length && VARIANT_RINGS.includes(r))
        ? Math.max(0, Math.floor(n / 2) - 2) : -1;

      for (let i = 0; i < n; i++) {
        const tSlot = n > 1 ? (i + 0.5) / n : 0.5;
        const angle = centerA - sectorHalf + tSlot * sectorHalf * 2
          + rng.float(-0.012, 0.012);
        const radius = baseR + rng.float(-TREE.ringStep * 0.2, TREE.ringStep * 0.2);

        const id = `${branch.id}-${r}-${i}`;
        let type, name, desc, effects, cost, icon, variantId;

        if (i === variantSlot && variantUsed < branchVariants.length) {
          // Nœud VARIANTE : ouvre une version alternative de la tourelle,
          // sélectionnable ensuite depuis l'écran de préparation.
          const vr = branchVariants[variantUsed++];
          type = 'variant';
          name = vr.name;
          desc = vr.desc;
          icon = vr.icon;
          variantId = vr.id;
          effects = [{ key: `variant.${vr.id}`, value: 1 }];
          cost = Math.round((TREE.costBase + TREE.costPerRing * r) * TREE.variantCostMult);
        } else if (i === keystoneSlot && keyUsed < keystones.length) {
          const k = keystones[keyUsed++];
          type = 'keystone';
          name = k[0];
          desc = k[3];
          effects = [{ key: k[1], value: k[2] }];
          icon = iconForKey(k[1]);
          cost = Math.round((TREE.costBase + TREE.costPerRing * r) * TREE.keystoneCostMult);
        } else if (r >= 2 && rng.next() < TREE.notableRate) {
          const nb = rng.pick(notables);
          type = 'notable';
          name = nb[0];
          desc = nb[3];
          effects = [{ key: nb[1], value: nb[2] }];
          icon = iconForKey(nb[1]);
          cost = Math.round((TREE.costBase + TREE.costPerRing * r) * TREE.notableCostMult);
        } else {
          const stat = rng.weighted(stats);
          const scale = 1 + r * 0.11;
          const value = stat.v * scale;
          type = 'minor';
          name = null;
          desc = fmtValue(stat, value);
          effects = [{ key: stat.key, value }];
          icon = iconForKey(stat.key);
          cost = TREE.costBase + TREE.costPerRing * r;
        }

        const node = {
          id, branch: bi, branchId: branch.id, ring: r, index: i,
          x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
          angle, radius, type, name, desc, effects, cost,
          icon: icon || '•', variantId: variantId || null,
          links: [], color: branch.color,
          r: type === 'variant' ? TREE.variantR
            : type === 'keystone' ? TREE.keystoneR
            : type === 'notable' ? TREE.notableR : TREE.nodeR,
          twinkle: rng.float(0, TAU)
        };
        ring.push(node);
        nodes.push(node);
        byId.set(id, node);
      }
      rings.push(ring);
    }

    // ---- Connexions ----
    // Anneau 0 → hub
    for (const n of rings[0]) link(n, hub);

    for (let r = 1; r < rings.length; r++) {
      const prev = rings[r - 1];
      for (const n of rings[r]) {
        // 1 à 2 parents : les plus proches angulairement dans l'anneau précédent
        const sorted = prev.slice().sort((a, b) =>
          Math.abs(angDiff(a.angle, n.angle)) - Math.abs(angDiff(b.angle, n.angle)));
        link(n, sorted[0]);
        if (sorted[1] && rng.next() < 0.35) link(n, sorted[1]);
      }
      // Liaisons latérales dans l'anneau (maillage en toile)
      const cur = rings[r];
      for (let i = 0; i < cur.length - 1; i++) {
        if (rng.next() < 0.32) link(cur[i], cur[i + 1]);
      }
    }
  });

  // Index spatial pour le culling et le hit-test
  const CELLSZ = 420;
  const spatial = new Map();
  for (const n of nodes) {
    const k = `${Math.floor(n.x / CELLSZ)},${Math.floor(n.y / CELLSZ)}`;
    if (!spatial.has(k)) spatial.set(k, []);
    spatial.get(k).push(n);
  }

  // Arêtes uniques
  const edges = [];
  const seen = new Set();
  for (const n of nodes) {
    for (const o of n.links) {
      const k = n.id < o.id ? n.id + '|' + o.id : o.id + '|' + n.id;
      if (seen.has(k)) continue;
      seen.add(k);
      edges.push({ a: n, b: o });
    }
  }

  return { nodes, byId, edges, spatial, cellSize: CELLSZ, hub };
}

function link(a, b) {
  if (!a.links.includes(b)) a.links.push(b);
  if (!b.links.includes(a)) b.links.push(a);
}

function angDiff(a, b) {
  return ((a - b + Math.PI * 3) % TAU) - Math.PI;
}

// ============================================================
//  Modificateurs
// ============================================================

/** Agrège tous les effets des noeuds débloqués en une table de modificateurs. */
export function computeMods(tree, unlocked) {
  const mods = Object.create(null);
  for (const id of unlocked) {
    const n = tree.byId.get(id);
    if (!n || !n.effects) continue;
    for (const e of n.effects) {
      mods[e.key] = (mods[e.key] || 0) + e.value;
    }
  }
  return mods;
}

/** Résumé lisible par branche, pour le panneau latéral. */
export function branchSummary(tree, unlocked) {
  const out = BRANCHES.map((b) => ({ ...b, count: 0, keystones: [], notables: 0 }));
  for (const id of unlocked) {
    const n = tree.byId.get(id);
    if (!n || n.branch < 0) continue;
    const s = out[n.branch];
    s.count++;
    if (n.type === 'keystone') s.keystones.push(n.name);
    if (n.type === 'notable') s.notables++;
  }
  return out;
}

// ============================================================
//  Vue canvas — pan / zoom / rendu
// ============================================================

export class TreeView {
  constructor(canvas, tree, save) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tree = tree;
    this.save = save;
    this.cam = { x: 0, y: 0, zoom: 0.34 };
    this.targetCam = { x: 0, y: 0, zoom: 0.34 };
    this.dragging = false;
    this.moved = false;
    this.last = { x: 0, y: 0 };
    this.hover = null;
    this.selected = null;
    this.time = 0;
    this.bursts = [];
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.onSelect = null;
    this.onBuy = null;
    this._bind();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(320, rect.width);
    this.h = Math.max(240, rect.height);
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ---------- Conversions ----------
  toWorld(sx, sy) {
    return {
      x: (sx - this.w / 2) / this.cam.zoom + this.cam.x,
      y: (sy - this.h / 2) / this.cam.zoom + this.cam.y
    };
  }
  toScreen(wx, wy) {
    return {
      x: (wx - this.cam.x) * this.cam.zoom + this.w / 2,
      y: (wy - this.cam.y) * this.cam.zoom + this.h / 2
    };
  }

  // ---------- Entrées ----------
  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.dragging = true;
      this.moved = false;
      this.last = { x: e.clientX, y: e.clientY };
    });
    c.addEventListener('pointermove', (e) => {
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (this.dragging) {
        const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        this.cam.x -= dx / this.cam.zoom;
        this.cam.y -= dy / this.cam.zoom;
        this.targetCam.x = this.cam.x;
        this.targetCam.y = this.cam.y;
        this.last = { x: e.clientX, y: e.clientY };
      }
      this.hover = this.nodeAt(sx, sy);
      c.style.cursor = this.hover ? 'pointer' : (this.dragging ? 'grabbing' : 'grab');
    });
    const up = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.moved) {
        const rect = c.getBoundingClientRect();
        const n = this.nodeAt(e.clientX - rect.left, e.clientY - rect.top);
        if (n) this.select(n);
      }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', () => { this.dragging = false; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const before = this.toWorld(sx, sy);
      const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
      this.cam.zoom = Math.max(0.08, Math.min(2.4, this.cam.zoom * factor));
      const after = this.toWorld(sx, sy);
      this.cam.x += before.x - after.x;
      this.cam.y += before.y - after.y;
      this.targetCam = { ...this.cam };
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      const n = this.nodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (n && this.onBuy) this.onBuy(n);
    });
  }

  select(n) {
    this.selected = n;
    if (this.onSelect) this.onSelect(n);
  }

  nodeAt(sx, sy) {
    const w = this.toWorld(sx, sy);
    const cs = this.tree.cellSize;
    const gx = Math.floor(w.x / cs), gy = Math.floor(w.y / cs);
    let best = null, bestD = Infinity;
    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let x = gx - 1; x <= gx + 1; x++) {
        const list = this.tree.spatial.get(`${x},${y}`);
        if (!list) continue;
        for (const n of list) {
          const d = Math.hypot(n.x - w.x, n.y - w.y);
          const hit = Math.max(n.r, 16 / this.cam.zoom);
          if (d < hit && d < bestD) { bestD = d; best = n; }
        }
      }
    }
    return best;
  }

  /** Recentre la caméra sur une branche. */
  focusBranch(bi) {
    if (bi < 0) { this.targetCam = { x: 0, y: 0, zoom: 0.28 }; return; }
    const a = bi * (TAU / TREE.branches) - Math.PI / 2;
    const r = (TREE.ring0 + TREE.rings * TREE.ringStep) * 0.42;
    this.targetCam = { x: Math.cos(a) * r, y: Math.sin(a) * r, zoom: 0.42 };
  }

  focusNode(n) {
    this.targetCam = { x: n.x, y: n.y, zoom: Math.max(this.cam.zoom, 0.75) };
  }

  burst(n) {
    this.bursts.push({ x: n.x, y: n.y, t: 0, color: n.color, r: n.r });
  }

  // ---------- Disponibilité ----------
  isUnlocked(n) { return n.hub || this.save.unlocked.has(n.id); }

  isAvailable(n) {
    if (this.isUnlocked(n)) return false;
    for (const o of n.links) if (this.isUnlocked(o)) return true;
    return false;
  }

  // ---------- Rendu ----------
  draw(dt) {
    this.time += dt;
    // Lissage caméra
    const k = 1 - Math.pow(0.001, dt);
    this.cam.x += (this.targetCam.x - this.cam.x) * k;
    this.cam.y += (this.targetCam.y - this.cam.y) * k;
    this.cam.zoom += (this.targetCam.zoom - this.cam.zoom) * k;

    const ctx = this.ctx;
    const z = this.cam.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // --- Fond ---
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this._drawStars(ctx);

    // Limites du viewport en coordonnées monde (culling)
    const pad = 120 / z;
    const vx0 = this.cam.x - this.w / 2 / z - pad;
    const vx1 = this.cam.x + this.w / 2 / z + pad;
    const vy0 = this.cam.y - this.h / 2 / z - pad;
    const vy1 = this.cam.y + this.h / 2 / z + pad;
    const vis = (n) => n.x > vx0 && n.x < vx1 && n.y > vy0 && n.y < vy1;

    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    this._drawSectors(ctx);

    // --- Arêtes ---
    ctx.lineCap = 'round';
    for (const e of this.tree.edges) {
      if (!vis(e.a) && !vis(e.b)) continue;
      const ua = this.isUnlocked(e.a), ub = this.isUnlocked(e.b);
      const both = ua && ub;
      const half = ua || ub;
      if (both) {
        ctx.strokeStyle = e.a.hub ? e.b.color : e.a.color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 3.5;
      } else if (half) {
        ctx.strokeStyle = PALETTE.text;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2.2;
      } else {
        ctx.strokeStyle = e.a.hub ? e.b.color : e.a.color;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1.6;
      }
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();

      // Énergie qui circule vers les noeuds achetables
      if (half && !both && z > 0.2) {
        const from = ua ? e.a : e.b;
        const to = ua ? e.b : e.a;
        const p = (this.time * 0.55 + (from.x + from.y) * 0.001) % 1;
        const px = from.x + (to.x - from.x) * p;
        const py = from.y + (to.y - from.y) * p;
        ctx.globalAlpha = (1 - Math.abs(p - 0.5) * 2) * 0.9;
        ctx.fillStyle = to.color;
        ctx.beginPath();
        ctx.arc(px, py, 3.4, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // --- Noeuds ---
    let drawn = 0;
    for (const n of this.tree.nodes) {
      if (!vis(n)) continue;
      drawn++;
      this._drawNode(ctx, n, z);
    }
    this.visibleCount = drawn;

    // --- Explosions d'achat ---
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      if (b.t > 0.85) { this.bursts.splice(i, 1); continue; }
      const p = b.t / 0.85;
      const ease = 1 - Math.pow(1 - p, 3);
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 5 * (1 - p);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + ease * 120, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2.5 * (1 - p);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + ease * 62, 0, TAU); ctx.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + b.t * 2;
        const rr = b.r + ease * 100;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * rr * 0.6, b.y + Math.sin(a) * rr * 0.6);
        ctx.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // --- Repères de branches en surimpression ---
    this._drawBranchLabels(ctx);
  }

  _drawStars(ctx) {
    ctx.save();
    const n = 90;
    for (let i = 0; i < n; i++) {
      const sx = ((i * 7919) % 1000) / 1000 * this.w;
      const sy = ((i * 6271) % 1000) / 1000 * this.h;
      const tw = 0.25 + Math.sin(this.time * 1.6 + i) * 0.22;
      ctx.globalAlpha = Math.max(0, tw) * 0.5;
      ctx.fillStyle = i % 9 === 0 ? PALETTE.accent : PALETTE.line;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.restore();
  }

  /** Secteurs colorés très discrets derrière chaque branche. */
  _drawSectors(ctx) {
    const R = TREE.ring0 + TREE.rings * TREE.ringStep;
    const half = (TAU / TREE.branches) / 2 * 0.94;
    ctx.save();
    BRANCHES.forEach((b, i) => {
      const a = i * (TAU / TREE.branches) - Math.PI / 2;
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, a - half, a + half);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.13;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - half) * R, Math.sin(a - half) * R);
      ctx.stroke();
    });
    // Anneaux repères
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 1;
    for (let r = 0; r < TREE.rings; r += 4) {
      ctx.beginPath();
      ctx.arc(0, 0, TREE.ring0 + r * TREE.ringStep, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawNode(ctx, n, z) {
    const unlocked = this.isUnlocked(n);
    const available = !unlocked && this.isAvailable(n);
    const isHover = this.hover === n;
    const isSel = this.selected === n;
    const affordable = available && this.save.materials >= n.cost;

    let r = n.r;
    if (isHover || isSel) r *= 1.22;

    ctx.save();
    ctx.translate(n.x, n.y);

    // Halo
    if (unlocked || affordable) {
      const pulse = affordable ? 0.5 + Math.sin(this.time * 4 + n.twinkle) * 0.3 : 0.32;
      ctx.globalAlpha = pulse * 0.5;
      ctx.fillStyle = n.hub ? PALETTE.gold : n.color;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (n.hub) {
      ctx.rotate(this.time * 0.25);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU;
        const rr = i % 2 ? r * 0.6 : r;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PALETTE.line;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Corps du noeud — l'ombre dure décalée reprend la DA néo-brutaliste.
    // Les noeuds verrouillés gardent un contour teinté par leur branche :
    // c'est ce qui rend l'étoile lisible même dézoomée.
    const fill = unlocked ? n.color : (available ? PALETTE.surface3 : '#1c1c1c');
    const stroke = unlocked ? PALETTE.line
      : (affordable ? n.color : (available ? PALETTE.text : n.color));
    ctx.globalAlpha = (unlocked || available) ? 1 : 0.62;

    if (n.type === 'variant') {
      // Octogone a double contour : la forme la plus « lourde » de l'arbre,
      // pour qu'on repere un debouche de branche meme tres dezoome.
      const oct = (rr) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU + Math.PI / 8;
          ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
      };
      ctx.fillStyle = unlocked ? n.color : '#0d0d0d';
      ctx.save(); ctx.translate(4, 4); oct(r); ctx.fill(); ctx.restore();
      ctx.fillStyle = fill;
      oct(r); ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 4;
      oct(r); ctx.stroke();
      ctx.strokeStyle = unlocked ? PALETTE.bg : stroke;
      ctx.lineWidth = 1.6;
      oct(r * 0.7); ctx.stroke();
    } else if (n.type === 'keystone') {
      const s = r;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = unlocked ? n.color : '#0d0d0d';
      ctx.fillRect(-s * 0.72 + 4, -s * 0.72 + 4, s * 1.44, s * 1.44);
      ctx.fillStyle = fill;
      ctx.fillRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
      ctx.rotate(-Math.PI / 4);
      if (unlocked) {
        ctx.fillStyle = PALETTE.bg;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, TAU); ctx.fill();
      }
    } else if (n.type === 'notable') {
      ctx.fillStyle = unlocked ? n.color : '#0d0d0d';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + Math.PI / 6;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r + 3, Math.sin(a) * r + 3);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + Math.PI / 6;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    } else {
      ctx.fillStyle = unlocked ? n.color : '#0d0d0d';
      ctx.beginPath(); ctx.arc(2.5, 2.5, r, 0, TAU); ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // --- Symbole : dit d'un coup d'oeil ce que le noeud apporte ---
    // Sous 0.3 de zoom les glyphes deviennent illisibles : on les coupe
    // pour ne pas payer un fillText par noeud dans le vide.
    if (z > 0.3 && n.icon) {
      ctx.globalAlpha = unlocked ? 1 : (available ? 0.9 : 0.5);
      ctx.fillStyle = unlocked ? PALETTE.bg : (affordable ? n.color : PALETTE.text);
      ctx.font = `${Math.round(r * 1.15)}px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.icon, 0, r * 0.06);
    }

    // Anneau de sélection
    if (isSel) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.line;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.75, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Nom des notables/keystones quand on est assez zoomé
    if (z > 0.55 && n.type !== 'minor' && n.name) {
      ctx.save();
      ctx.font = `${n.type === 'variant' ? 23 : n.type === 'keystone' ? 20 : 15}px "Bebas Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 4;
      ctx.strokeStyle = PALETTE.bg;
      ctx.strokeText(n.name, n.x, n.y + n.r + 6);
      ctx.fillStyle = unlocked ? n.color : PALETTE.muted;
      ctx.fillText(n.name, n.x, n.y + n.r + 6);
      ctx.restore();
    }
  }

  _drawBranchLabels(ctx) {
    const R = TREE.ring0 + TREE.rings * TREE.ringStep;
    ctx.save();
    ctx.font = '600 13px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    BRANCHES.forEach((b, i) => {
      const a = i * (TAU / TREE.branches) - Math.PI / 2;
      const wx = Math.cos(a) * R * 0.72;
      const wy = Math.sin(a) * R * 0.72;
      const s = this.toScreen(wx, wy);
      const margin = 46;
      const cx = Math.max(margin, Math.min(this.w - margin, s.x));
      const cy = Math.max(margin, Math.min(this.h - margin, s.y));
      const off = Math.hypot(cx - s.x, cy - s.y) > 2;
      const w = 106;
      ctx.globalAlpha = off ? 0.45 : 0.92;
      ctx.fillStyle = b.color;
      ctx.fillRect(cx - w / 2 + 3, cy - 11 + 3, w, 22);
      ctx.fillStyle = PALETTE.surface2;
      ctx.fillRect(cx - w / 2, cy - 11, w, 22);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - w / 2, cy - 11, w, 22);
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(b.name, cx, cy + 1);
    });
    ctx.restore();
  }
}
