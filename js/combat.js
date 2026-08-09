// ============================================================
//  COMBAT — armes, projectiles, chaîne, cône, missiles guidés.
//  Aucune dépendance vers towers.js : les armes reçoivent la tour
//  et l'objet `game` en paramètre.
// ============================================================

import { TARGET, PALETTE, GRID, FX } from './config.js';
import { rand, pick } from './rng.js';

const TAU = Math.PI * 2;
const C = GRID.cell;

// ----------------------------------------------------------
//  Sélection de cibles
// ----------------------------------------------------------

export function canHit(enemy, mask) {
  return enemy.air ? (mask & TARGET.AIR) !== 0 : (mask & TARGET.GROUND) !== 0;
}

export function enemiesInRange(game, x, y, radiusPx, mask) {
  const out = [];
  const r2 = radiusPx * radiusPx;
  // game.enemyHash (facultatif) réduit le parcours aux cases voisines au
  // lieu de TOUS les ennemis — décisif avec beaucoup de tours, appelée
  // une fois par tour et par frame pour le ciblage. Simple filtre grossier :
  // le test de distance exact ci-dessous reste inchangé.
  const candidates = game.enemyHash ? game.enemyHash.queryCircle(x, y, radiusPx) : game.enemies;
  for (const e of candidates) {
    if (e.dead || !canHit(e, mask)) continue;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy <= r2) out.push(e);
  }
  return out;
}

/** Choisit une cible selon la priorité de la tour. */
export function selectTarget(game, tower, list) {
  if (!list.length) return null;
  let best = null, bestScore = -Infinity;
  for (const e of list) {
    let s;
    switch (tower.priority) {
      case 'first': s = -progress(game, e); break;      // le plus avancé
      case 'last': s = progress(game, e); break;
      case 'close': s = -Math.hypot(e.x - tower.px, e.y - tower.py); break;
      case 'strong': s = e.hp + e.shield; break;
      case 'weak': s = -(e.hp + e.shield); break;
      default: s = -progress(game, e);
    }
    if (e.boss) s += tower.priority === 'weak' ? 0 : 0.001;
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best;
}

/** Distance restante avant la base (plus bas = plus avancé). */
function progress(game, e) {
  if (e.air) return (game.grid.airLength - e.travel) / C;
  return game.grid.progressGround(e);
}

// ----------------------------------------------------------
//  Projectiles
// ----------------------------------------------------------

let pid = 1;

export class Projectile {
  constructor(cfg) {
    Object.assign(this, cfg);
    this.id = pid++;
    this.dead = false;
    this.t = 0;
    this.trail = [];
  }

  update(dt, game) {
    this.t += dt;
    switch (this.kind) {
      case 'bullet': this._bullet(dt, game); break;
      case 'shell': this._shell(dt, game); break;
      case 'missile': this._missile(dt, game); break;
      case 'frag': this._frag(dt, game); break;
    }
    if (this.t > (this.maxLife || 6)) this.dead = true;
  }

  _pushTrail() {
    this.trail.push({ x: this.x, y: this.y, t: 0 });
    if (this.trail.length > (this.trailLen || 6)) this.trail.shift();
  }

  // ---- Balle rectiligne (mitraillette) ----
  _bullet(dt, game) {
    const step = this.speed * dt;
    const nx = this.x + Math.cos(this.angle) * step;
    const ny = this.y + Math.sin(this.angle) * step;

    const hit = segmentHit(game, this.x, this.y, nx, ny, this.mask, this.ignore);
    if (hit) {
      this.x = hit.px; this.y = hit.py;
      this.onHit(game, hit.enemy);
      this.dead = true;
      return;
    }
    this.x = nx; this.y = ny;
    this._pushTrail();
    if (this.x < -40 || this.y < -40 || this.x > GRID.w + 40 || this.y > GRID.h + 40) this.dead = true;
  }

  // ---- Obus en cloche (mortier) ----
  _shell(dt, game) {
    const p = Math.min(1, this.t / this.flight);
    this.x = this.sx + (this.tx - this.sx) * p;
    this.y = this.sy + (this.ty - this.sy) * p;
    this.alt = Math.sin(p * Math.PI) * this.arcHeight;
    if (this.t % 0.05 < dt) game.vfx.smoke(this.x, this.y - this.alt, '#2e2e2e', 1);
    if (p >= 1) {
      this.dead = true;
      this.onHit(game, null);
    }
  }

  // ---- Missile guidé (DCA) ----
  _missile(dt, game) {
    if (this.target && this.target.dead) this.target = null;
    if (!this.target) {
      // Cherche une nouvelle cible aérienne, sinon poursuit tout droit
      const near = enemiesInRange(game, this.x, this.y, C * 5, this.mask);
      this.target = near.length ? near[0] : null;
    }
    if (this.target) {
      const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      let diff = ((want - this.angle + Math.PI * 3) % TAU) - Math.PI;
      const max = this.turnRate * dt;
      this.angle += Math.max(-max, Math.min(max, diff));
    }
    this.speed = Math.min(this.speed + 340 * dt, this.maxSpeed || 900);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this._pushTrail();
    if (this.t % 0.03 < dt) {
      game.vfx.particle(this.x, this.y, rand(-12, 12), rand(-12, 12), rand(0.25, 0.5), '#5a5a5a', rand(2, 4), { drag: 0.95, fade: 0.5 });
    }
    if (this.target) {
      const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (d < this.target.radius + 6) { this.dead = true; this.onHit(game, this.target); return; }
    }
    if (this.x < -80 || this.y < -80 || this.x > GRID.w + 80 || this.y > GRID.h + 80) this.dead = true;
  }

  // ---- Éclat (shrapnel de mortier) ----
  _frag(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.94, dt * 60);
    this.vy *= Math.pow(0.94, dt * 60);
    const hits = enemiesInRange(game, this.x, this.y, 9, this.mask);
    if (hits.length) {
      const victim = hits[0];
      if (this.source) hit(this.source, victim, game, this.damage, { type: 'frag' });
      else victim.damage(this.damage, { type: 'frag' }, game);
      game.vfx.impact(this.x, this.y, PALETTE.gold, 3, 0.5);
      this.dead = true;
    }
  }

  draw(ctx, time) {
    switch (this.kind) {
      case 'bullet': {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.big ? 3.5 : 2;
        ctx.globalAlpha = 0.85;
        const tl = 13 * (this.big ? 1.8 : 1);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(this.angle) * tl, this.y - Math.sin(this.angle) * tl);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.big ? 3 : 1.9, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'shell': {
        const y = this.y - this.alt;
        ctx.save();
        // ombre au sol
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(this.x, this.y, 5, 2.4, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.translate(this.x, y);
        ctx.rotate(Math.atan2(this.ty - this.sy, this.tx - this.sx) + Math.sin(this.t * 12) * 0.15);
        ctx.fillStyle = PALETTE.gold;
        ctx.strokeStyle = '#090909';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(7, 0); ctx.lineTo(-4, -4); ctx.lineTo(-6, 0); ctx.lineTo(-4, 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'missile': {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = PALETTE.air;
        ctx.strokeStyle = '#090909';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-5, -3.2); ctx.lineTo(-3, 0); ctx.lineTo(-5, 3.2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = PALETTE.fire;
        ctx.beginPath();
        ctx.moveTo(-3, 0); ctx.lineTo(-11 - Math.random() * 6, 0);
        ctx.lineWidth = 3; ctx.strokeStyle = PALETTE.fire; ctx.stroke();
        ctx.restore();
        break;
      }
      case 'frag': {
        ctx.save();
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(this.x - 1.5, this.y - 1.5, 3, 3);
        ctx.restore();
        break;
      }
    }
  }
}

// Rayon max plausible d'un ennemi (juggernaut=24) + marge : sert à élargir
// les requêtes spatiales de segmentHit/rayHits pour ne jamais rater une
// cible dont le CENTRE est hors segment mais le CONTOUR le touche.
const MAX_ENEMY_RADIUS_PAD = 30;

/** Premier ennemi touché par le segment [x1,y1]→[x2,y2]. */
function segmentHit(game, x1, y1, x2, y2, mask, ignore) {
  let best = null, bestT = Infinity;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const candidates = game.enemyHash ? game.enemyHash.querySegment(x1, y1, x2, y2, MAX_ENEMY_RADIUS_PAD) : game.enemies;
  for (const e of candidates) {
    if (e.dead || !canHit(e, mask)) continue;
    if (ignore && ignore.has(e.id)) continue;
    const t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / len2));
    const px = x1 + dx * t, py = y1 + dy * t;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d <= e.radius + 3 && t < bestT) { bestT = t; best = { enemy: e, px, py, t }; }
  }
  return best;
}

/** Tous les ennemis touchés par un rayon (pour le sniper qui perce). */
function rayHits(game, x1, y1, x2, y2, mask) {
  const hits = [];
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const candidates = game.enemyHash ? game.enemyHash.querySegment(x1, y1, x2, y2, MAX_ENEMY_RADIUS_PAD) : game.enemies;
  for (const e of candidates) {
    if (e.dead || !canHit(e, mask)) continue;
    const t = ((e.x - x1) * dx + (e.y - y1) * dy) / len2;
    if (t < 0 || t > 1) continue;
    const px = x1 + dx * t, py = y1 + dy * t;
    if (Math.hypot(e.x - px, e.y - py) <= e.radius + 4) hits.push({ e, t, px, py });
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}



/**
 * Retombées de l'OGIVE NUCLÉAIRE : une seconde salve de dégâts immédiate
 * sur toute la zone, plus un étourdissement bref — l'explosion initiale
 * (gérée par l'appelant) plus cette "onde de choc" secondaire, mais tout
 * en un seul instant. PAS de zone qui continue à mordre frame après
 * frame : ça pesait lourd (tours × zones × ennemis, chaque frame) et
 * donnait de trop grandes zones visuelles à l'écran.
 */
export function nukeFallout(game, tower, x, y, radiusPx) {
  const r = Math.min(radiusPx, GRID.cell * 3.2);
  game.vfx.crater(x, y, r, 4); // marque au sol, purement décorative
  explode(game, x, y, r, tower.stats.damage * 0.35, {
    mask: TARGET.GROUND, source: tower, stun: 0.8, flat: true,
    power: 0.8, color: PALETTE.ok
  });

  // Champignon : anneaux concentriques + colonne de particules
  for (let i = 0; i < 3; i++) {
    game.vfx.ring(x, y, r * 0.2, r * (1.1 + i * 0.35), 0.6 + i * 0.2, PALETTE.ok, 4 - i);
  }
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * TAU;
    const sp = 40 + Math.random() * 120;
    game.vfx.particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 120,
      0.8 + Math.random() * 0.7, i % 3 ? PALETTE.ok : '#ffffff',
      3 + Math.random() * 4, { drag: 0.93, glow: true, fade: 0.6 });
  }
  game.vfx.addShake(5);
  game.vfx.addFlash(0.22, PALETTE.ok);
  game.vfx.addChroma(4);
}



// ============================================================
//  RÉSOLUTION D'UN COUP
//  Point de passage unique de tous les dégâts infligés par une tour.
//  C'est ici que s'appliquent les notables CONDITIONNELS de l'arbre
//  (contre les boss, les blindés, les cibles en feu, à faible vie...)
//  ainsi que les effets de variante liés à la cible.
// ============================================================
export function hit(tower, enemy, game, damage, opts = {}) {
  if (!enemy || enemy.dead) return 0;
  const mods = game.mods || {};
  let mult = 1;

  if (tower) {
    const a = tower.archetype;
    const g = (k) => mods[a + '.' + k] || 0;

    if (enemy.boss) mult += g('vsBoss');
    if (enemy.air) mult += g('vsAir'); else mult += g('vsGround');
    if (enemy.armor > 0) mult += g('vsArmor');
    if (enemy.shield > 0) mult += g('vsShield');
    if (enemy.burning) mult += g('vsBurning');
    if (enemy.hpRatio < 0.35) mult += g('lowHp');
    if (enemy.hpRatio > 0.9) mult += g('fullHp');
    if (game.time < enemy.slowUntil || game.time < enemy.stunUntil) mult += g('vsSlowed');

    // Effritement d'armure : définitif, contrairement à la pénétration.
    const shred = g('shred');
    if (shred > 0 && enemy.armor > 0) enemy.armor = Math.max(0, enemy.armor - shred);

    // Variante POLYVALENTE de la DCA : elle peut viser le sol, mais mal.
    const flags = tower.variantFlags || EMPTY_FLAGS;
    if (flags.groundPenalty && !enemy.air) mult *= flags.groundPenalty;
  }

  // DERNIER REMPART : sursaut général quand la base est presque tombée.
  if (mods['player.lastStand'] && game.lives <= 5) mult += mods['player.lastStand'];

  const o = opts.source === undefined ? { ...opts, source: tower } : opts;
  return enemy.damage(damage * mult, o, game);
}

export const EMPTY_FLAGS = Object.freeze({});

// ----------------------------------------------------------
//  Explosion générique
// ----------------------------------------------------------
export function explode(game, x, y, radiusPx, damage, opts = {}) {
  const mask = opts.mask === undefined ? TARGET.GROUND : opts.mask;
  const list = enemiesInRange(game, x, y, radiusPx, mask);
  for (const e of list) {
    const d = Math.hypot(e.x - x, e.y - y);
    const falloff = opts.flat ? 1 : Math.max(0.35, 1 - (d / radiusPx) * 0.55);
    const dmgOpts = {
      type: opts.type || 'explosion',
      armorPen: opts.armorPen || 0,
      source: opts.source || null   // sans ça, mortier et DCA ne se voient jamais créditer leurs éliminations
    };
    if (opts.source) hit(opts.source, e, game, damage * falloff, dmgOpts);
    else e.damage(damage * falloff, dmgOpts, game);
    if (opts.stun) e.applyStun(opts.stun, game);
    if (opts.pull) {
      const dd = Math.hypot(e.x - x, e.y - y) || 1;
      e.x += ((x - e.x) / dd) * Math.min(18, radiusPx * 0.25);
      e.y += ((y - e.y) / dd) * Math.min(18, radiusPx * 0.25);
    }
  }
  game.vfx.explosion(x, y, radiusPx, opts.color || PALETTE.fire, opts.power || 1);
  return list;
}

// ============================================================
//  ARMES — une fonction par tour
// ============================================================

export const Weapons = {

  // ---------- MITRAILLETTE ----------
  mg(t, game, target) {
    const a = Math.atan2(target.y - t.py, target.x - t.px);
    const spread = 0.05 + 0.05 * (1 - t.spin);
    const ang = a + rand(-spread, spread);
    const mx = t.px + Math.cos(ang) * 20;
    const my = t.py + Math.sin(ang) * 20;

    t.shotCount = (t.shotCount || 0) + 1;
    const fusillade = game.mods['mg.fusillade'] && t.shotCount % 10 === 0;
    let dmg = t.stats.damage * (fusillade ? 3 : 1);

    game.vfx.muzzle(mx, my, ang, fusillade ? PALETTE.gold : '#ffe9a8', fusillade ? 1.6 : 1);
    game.vfx.shell(t.px, t.py, ang);
    t.recoil = 1;

    const proj = new Projectile({
      kind: 'bullet', x: mx, y: my, angle: ang, speed: t.def.projSpeed * C,
      color: fusillade ? PALETTE.gold : '#ffe9a8', big: fusillade,
      mask: t.stats.mask, maxLife: 1.4,
      onHit: (g, e) => {
        const wall = game.mods['mg.wall'] && Math.hypot(e.x - t.px, e.y - t.py) < C;
        hit(t, e, g, dmg * (wall ? 1.6 : 1), { armorPen: t.stats.armorPen || 0 });
        g.vfx.impact(e.x, e.y, '#ffe9a8', 4, 0.7);
        const slow = game.mods['mg.slow'] || 0;
        if (slow > 0) e.applySlow(slow, 0.6, g);
        // Ricochet
        const rc = game.mods['mg.ricochet'] || 0;
        if (rc > 0 && Math.random() < rc) {
          const others = enemiesInRange(g, e.x, e.y, C * 2.5, t.stats.mask).filter((o) => o !== e);
          if (others.length) {
            const o = pick(others);
            const ra = Math.atan2(o.y - e.y, o.x - e.x);
            g.projectiles.push(new Projectile({
              kind: 'bullet', x: e.x, y: e.y, angle: ra, speed: t.def.projSpeed * C * 0.9,
              color: PALETTE.accent, mask: t.stats.mask, maxLife: 0.6,
              ignore: new Set([e.id]),
              onHit: (g2, e2) => {
                hit(t, e2, g2, dmg * 0.6, { armorPen: t.stats.armorPen || 0 });
                g2.vfx.impact(e2.x, e2.y, PALETTE.accent, 3, 0.5);
              }
            }));
          }
        }
      }
    });
    game.projectiles.push(proj);
  },

  // ---------- SNIPER ----------
  sniper(t, game, target) {
    const a = Math.atan2(target.y - t.py, target.x - t.px);
    const reach = (game.mods['sniper.silence'] && t.firstShotOfWave)
      ? Math.max(GRID.w, GRID.h) * 1.5 : t.stats.range * C;
    t.firstShotOfWave = false;

    const ex = t.px + Math.cos(a) * reach;
    const ey = t.py + Math.sin(a) * reach;

    const crit = Math.random() < t.stats.critChance;
    const oneshot = crit && game.mods['sniper.oneshot'];
    let maxHits = 1 + Math.floor(t.stats.pierce);
    if (oneshot) maxHits = 99;

    const hits = rayHits(game, t.px, t.py, ex, ey, t.stats.mask).slice(0, maxHits);
    const dmg = t.stats.damage * (crit ? t.stats.critMult : 1);

    let killed = false;
    for (const h of hits) {
      const e = h.e;
      const exec = game.mods['sniper.execute'] || 0;
      if (exec > 0 && !e.boss && e.hpRatio <= exec) {
        game.vfx.floatText(e.x, e.y - 20, 'EXÉCUTION', PALETTE.danger, 15, 0.8);
        e.damage(e.hp + e.shield + 9999, { ignoreArmor: true, crit: true, source: t }, game);
        killed = true;
      } else {
        hit(t, e, game, dmg, { ignoreArmor: true, crit });
        if (e.dead) killed = true;
      }
      if (game.mods['sniper.burn']) {
        e.applyBurn(t.stats.damage * 0.12, 3, 5, game, 0);
      }
      game.vfx.impact(h.px, h.py, crit ? PALETTE.gold : '#ffffff', crit ? 12 : 7, crit ? 1.5 : 1);
      game.vfx.ring(h.px, h.py, 2, crit ? 44 : 26, 0.3, crit ? PALETTE.gold : '#ffffff', 2);
    }

    const endX = hits.length ? hits[hits.length - 1].px : ex;
    const endY = hits.length ? hits[hits.length - 1].py : ey;
    game.vfx.beam(t.px, t.py, endX, endY, crit ? 0.24 : 0.16, crit ? PALETTE.gold : '#ffffff', crit ? 4 : 2.4);
    game.vfx.muzzle(t.px + Math.cos(a) * 24, t.py + Math.sin(a) * 24, a, '#ffffff', 1.7);
    game.vfx.addShake(crit ? 2.2 : 1.1);
    if (crit) game.vfx.addChroma(4);
    t.recoil = 1;

    if (killed && game.mods['sniper.cascade']) t.cooldown = 0;
  },

  // ---------- MORTIER ----------
  mortar(t, game, target) {
    t.salvoCount = (t.salvoCount || 0) + 1;
    const carpet = game.mods['mortar.carpet'] && t.salvoCount % 5 === 0;
    const extra = Math.floor(game.mods['mortar.salvo'] || 0);
    const shells = carpet ? 4 : 1 + extra;

    for (let i = 0; i < shells; i++) {
      const jitter = shells > 1 ? (i - (shells - 1) / 2) * C * 0.85 : 0;
      const perp = Math.atan2(target.y - t.py, target.x - t.px) + Math.PI / 2;
      // Anticipation du déplacement de la cible
      const lead = t.stats.arcTime * 0.85;
      const tx = target.x + Math.cos(target.angle) * target.speed * C * lead + Math.cos(perp) * jitter;
      const ty = target.y + Math.sin(target.angle) * target.speed * C * lead + Math.sin(perp) * jitter;

      game.projectiles.push(new Projectile({
        kind: 'shell',
        sx: t.px, sy: t.py, tx, ty, x: t.px, y: t.py, alt: 0,
        flight: t.stats.arcTime, arcHeight: 70 + Math.hypot(tx - t.px, ty - t.py) * 0.22,
        maxLife: t.stats.arcTime + 0.3,
        onHit: (g) => {
          const r = t.stats.splash * C;
          const vf = t.variantFlags || {};
          const hitList = explode(g, tx, ty, r, t.stats.damage, {
            mask: TARGET.GROUND, source: t,
            stun: (game.mods['mortar.stun'] || 0) + (vf.stun || 0),
            pull: !!game.mods['mortar.implode'],
            power: vf.nuke ? 2.2 : 1.2,
            color: vf.nuke ? PALETTE.ok : PALETTE.fire
          });
          if (vf.nuke) nukeFallout(g, t, tx, ty, r);
          // TERRE BRÛLÉE (mortar.scorched) : l'explosion embrase ce qu'elle
          // touche au lieu de laisser une zone qui continue à mordre —
          // le feu suit chaque ennemi individuellement (déjà optimisé),
          // pas une zone au sol vérifiée contre tout le monde chaque frame.
          if (game.mods['mortar.scorched']) {
            for (const e of hitList) e.applyBurn(t.stats.damage * 0.15, 3, 3, g, 0);
          }
          g.vfx.crater(tx, ty, r * 0.7, FX.craterLife); // marque au sol, purement décorative
          const shr = Math.floor(game.mods['mortar.shrapnel'] || 0);
          for (let k = 0; k < shr; k++) {
            const a = rand(0, TAU);
            g.projectiles.push(new Projectile({
              kind: 'frag', x: tx, y: ty, vx: Math.cos(a) * rand(150, 300), vy: Math.sin(a) * rand(150, 300),
              damage: t.stats.damage * 0.28, mask: TARGET.GROUND, maxLife: 0.7, source: t
            }));
          }
        }
      }));
    }
    game.vfx.muzzle(t.px, t.py - 8, -Math.PI / 2, PALETTE.gold, 1.3);
    game.vfx.smoke(t.px, t.py - 10, '#3a3a3a', 4);
    game.vfx.addShake(1);
    t.recoil = 1;
  },

  // ---------- TESLA ----------
  tesla(t, game, target) {
    const maxBounces = t.stats.bounces;
    const infinite = !!game.mods['tesla.infinite'];
    const emp = game.mods['tesla.emp'] || 0;
    let dmg = t.stats.damage;
    let from = { x: t.px, y: t.py };
    let cur = target;
    const seen = new Set();
    let bounces = 0;
    let guard = 0;

    while (cur && guard++ < 40) {
      seen.add(cur.id);
      game.vfx.lightning(from.x, from.y, cur.x, cur.y, PALETTE.tesla, 0.18, 10 + bounces * 2);
      if (emp > 0 && cur.maxShield > 0) {
        cur.shield = Math.max(0, cur.shield - cur.maxShield * emp);
      }
      const cheap = infinite && cur.hpRatio < 0.2;
      hit(t, cur, game, dmg, { type: 'tesla' });
      // Marque « chargé »
      cur.charged = Math.max(cur.charged, t.stats.chargeDur);
      cur.chargedDmg += dmg * 0.4;
      game.vfx.impact(cur.x, cur.y, PALETTE.tesla, 5, 0.8);

      if (!cheap) bounces++;
      if (bounces > maxBounces) break;
      dmg *= t.stats.bounceFalloff;
      if (dmg < 1) break;

      const near = enemiesInRange(game, cur.x, cur.y, t.stats.bounceRange * C, t.stats.mask)
        .filter((e) => !seen.has(e.id));
      if (!near.length) break;
      near.sort((a, b) => Math.hypot(a.x - cur.x, a.y - cur.y) - Math.hypot(b.x - cur.x, b.y - cur.y));
      from = { x: cur.x, y: cur.y };
      cur = near[0];
    }

    game.vfx.addFlash(0.05, PALETTE.tesla);
    game.vfx.addShake(0.35);
    t.recoil = 1;
  },

  // ---------- LANCE-FLAMME ----------
  flame(t, game, target) {
    const a = Math.atan2(target.y - t.py, target.x - t.px);
    t.aim = a;
    const half = (t.stats.cone * Math.PI / 180) / 2;
    const reach = t.stats.range * C;
    const mask = game.mods['flame.dragon'] ? TARGET.BOTH : TARGET.GROUND;

    game.vfx.flameJet(t.px + Math.cos(a) * 16, t.py + Math.sin(a) * 16, a, reach * 2.6, half * 2);

    const list = enemiesInRange(game, t.px, t.py, reach, mask);
    const melt = game.mods['flame.melt'] || 0;
    const spread = game.mods['flame.spread'] || 0;
    const infernoDur = game.mods['flame.inferno'] ? 999 : t.stats.burnDur;

    for (const e of list) {
      const ea = Math.atan2(e.y - t.py, e.x - t.px);
      let diff = Math.abs(((ea - a + Math.PI * 3) % TAU) - Math.PI);
      const angularPad = Math.atan2(e.radius, Math.max(1, Math.hypot(e.x - t.px, e.y - t.py)));
      if (diff > half + angularPad) continue;
      hit(t, e, game, t.stats.damage, { type: 'flame' });
      e.applyBurn(t.stats.burnDps, infernoDur, t.stats.burnStacks, game, melt);
      if (spread > 0) {
        for (const o of enemiesInRange(game, e.x, e.y, spread * C, mask)) {
          if (o !== e) o.applyBurn(t.stats.burnDps * 0.5, infernoDur * 0.6, t.stats.burnStacks, game, melt);
        }
      }
    }
    t.recoil = 0.35;
  },

  // ---------- DCA ----------
  aa(t, game, target) {
    const n = Math.max(1, Math.round(t.stats.missiles));
    const multi = !!(game.mods['aa.multiLock'] || (t.variantFlags && t.variantFlags.multiLock));
    const pool = multi
      ? enemiesInRange(game, t.px, t.py, t.stats.range * C, t.stats.mask)
      : [target];

    for (let i = 0; i < n; i++) {
      const tgt = multi && pool.length ? pool[i % pool.length] : target;
      const launchA = Math.atan2(tgt.y - t.py, tgt.x - t.px) + (i - (n - 1) / 2) * 0.45;
      const bonus = (game.mods['aa.nofly'] && tgt.boss) ? 1.5 : 1;

      game.projectiles.push(new Projectile({
        kind: 'missile',
        x: t.px + Math.cos(launchA) * 14, y: t.py + Math.sin(launchA) * 14,
        angle: launchA, speed: t.def.missileSpeed * C * 0.5, maxSpeed: t.def.missileSpeed * C * 1.6,
        turnRate: t.stats.turnRate, target: tgt, mask: t.stats.mask, maxLife: 4.5, trailLen: 10,
        onHit: (g, e) => {
          if (!e) return;
          const r = t.stats.flakSplash * C;
          explode(g, e.x, e.y, r, t.stats.damage * bonus, {
            mask: t.stats.mask, color: PALETTE.air, power: 0.55, source: t,
            armorPen: t.stats.armorPen || 0
          });
          if (game.mods['aa.cluster']) {
            for (let k = 0; k < 3; k++) {
              const ca = rand(0, TAU);
              g.projectiles.push(new Projectile({
                kind: 'missile', x: e.x, y: e.y, angle: ca,
                speed: 200, maxSpeed: 620, turnRate: t.stats.turnRate * 1.4,
                target: null, mask: TARGET.AIR, maxLife: 1.6, trailLen: 5,
                onHit: (g2, e2) => {
                  if (e2) explode(g2, e2.x, e2.y, r * 0.6, t.stats.damage * 0.3, { mask: TARGET.AIR, color: PALETTE.air, power: 0.3, source: t });
                }
              }));
            }
          }
        }
      }));
    }
    game.vfx.muzzle(t.px, t.py, -Math.PI / 2, PALETTE.air, 1.2);
    game.vfx.smoke(t.px, t.py, '#4a4a4a', 3);
    game.vfx.addShake(0.4);
    t.recoil = 1;
  }
};

// ============================================================
//  RÉACTION EN CHAÎNE — déclenchée à la mort d'un ennemi chargé
// ============================================================
export function chainReaction(game, enemy, depth = 0) {
  if (depth > 4) return;
  const power = enemy.chargedDmg * (game.chainBlastMult || 0.6);
  if (power < 1) return;
  const r = C * (1.6 + depth * 0.15);

  game.vfx.ring(enemy.x, enemy.y, 4, r * 1.3, 0.35, PALETTE.tesla, 4);
  game.vfx.addFlash(0.08, PALETTE.tesla);
  game.vfx.addShake(Math.max(0.12, 0.55 - depth * 0.12));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    game.vfx.lightning(enemy.x, enemy.y,
      enemy.x + Math.cos(a) * r, enemy.y + Math.sin(a) * r, PALETTE.tesla, 0.14, 8);
  }

  const list = enemiesInRange(game, enemy.x, enemy.y, r, TARGET.BOTH);
  for (const e of list) {
    if (e === enemy || e.dead) continue;
    const wasCharged = e.charged > 0;
    e.damage(power, { type: 'tesla' }, game);
    if (game.mods['tesla.overload']) {
      e.charged = Math.max(e.charged, 2.5);
      e.chargedDmg += power * 0.3;
    }
    if (wasCharged && e.dead) chainReaction(game, e, depth + 1);
  }
}

// ============================================================
//  ORAGE (keystone tesla.storm)
// ============================================================
export function teslaStorm(game) {
  let best = null;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (!best || e.hp + e.shield > best.hp + best.shield) best = e;
  }
  if (!best) return;
  const damage = 60 + game.wave * 14;
  game.vfx.lightning(best.x, -40, best.x, best.y, '#ffffff', 0.3, 22);
  game.vfx.addFlash(0.28, PALETTE.tesla);
  game.vfx.addShake(2);
  explode(game, best.x, best.y, C * 1.8, damage, { mask: TARGET.BOTH, color: PALETTE.tesla, type: 'tesla', power: 1.2 });
  best.charged = Math.max(best.charged, 3);
  best.chargedDmg += damage * 0.4;
}
