// ============================================================
//  TOWERS — 6 tours, résolution des statistiques (base × upgrades
//  × modificateurs de l'arbre), ciblage, tir et rendu.
// ============================================================

import { TOWERS, TARGET, PALETTE, GRID, PRIORITY } from './config.js';
import { Weapons, enemiesInRange, selectTarget } from './combat.js';

const C = GRID.cell;
const TAU = Math.PI * 2;

/** Lecture d'un modificateur accumulé (0 si absent). */
export const m = (mods, key) => mods[key] || 0;

/** Coût de construction, modificateurs inclus. */
export function towerCost(id, mods) {
  const base = TOWERS[id].cost;
  const mult = Math.max(0.4, 1 + m(mods, `${id}.cost`));
  return Math.max(10, Math.round(base * mult));
}

let tuid = 1;

export class Tower {
  constructor(id, gx, gy, game) {
    this.uid = tuid++;
    this.id = id;
    this.def = TOWERS[id];
    this.gx = gx;
    this.gy = gy;
    this.px = game.grid.cx(gx);
    this.py = game.grid.cy(gy);
    this.level = 0;                 // 0..3
    this.invested = towerCost(id, game.mods);
    this.priority = 'first';
    this.cooldown = 0;
    this.angle = -Math.PI / 2;
    this.aim = -Math.PI / 2;
    this.recoil = 0;
    this.spin = 0;                  // montée en régime (mitraillette)
    this.firing = false;
    this.target = null;
    this.craters = [];
    this.shotCount = 0;
    this.salvoCount = 0;
    this.firstShotOfWave = true;
    this.placeAnim = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.stats = {};
    this.recompute(game.mods);
  }

  // ----------------------------------------------------------
  //  Résolution des statistiques
  // ----------------------------------------------------------
  recompute(mods) {
    const d = this.def;
    const id = this.id;

    // Multiplicateurs cumulés des améliorations achetées
    const up = { damage: 1, rate: 1, range: 1, splash: 1, burnDps: 1, burnDur: 1, cone: 1, turnRate: 1, flakSplash: 1, bounceRange: 1 };
    const add = { pierce: 0, bounces: 0, missiles: 0, critChance: 0, chainBlast: 0, burnStacks: 0 };
    for (let i = 0; i < this.level; i++) {
      const u = d.upgrades[i];
      for (const k of Object.keys(u)) {
        if (k === 'cost') continue;
        if (up[k] !== undefined) up[k] *= u[k];
        else if (add[k] !== undefined) add[k] += u[k];
      }
    }

    const global = 1 + m(mods, 'player.allDamage') + (mods.__survivorBonus || 0);
    const s = {};

    s.damage = d.damage * up.damage * (1 + m(mods, `${id}.damage`)) * global;
    s.rate = d.rate * up.rate * (1 + m(mods, `${id}.rate`));
    s.range = d.range * up.range * (1 + m(mods, `${id}.range`));
    s.mask = d.targets;

    switch (id) {
      case 'mg':
        s.spinMax = d.spinMax * (1 + m(mods, 'mg.spinMax'));
        s.spinUp = Math.max(0.2, d.spinUp * (1 + m(mods, 'mg.spinUp')));
        s.spinDown = Math.max(0.2, d.spinDown * (1 + m(mods, 'mg.spinDown')));
        break;
      case 'sniper':
        s.pierce = (d.pierce + add.pierce) * (1 + m(mods, 'sniper.pierce'));
        s.critChance = Math.min(0.95, d.critChance + add.critChance + m(mods, 'sniper.critChance'));
        s.critMult = d.critMult * (1 + m(mods, 'sniper.critMult'));
        break;
      case 'mortar':
        s.splash = d.splash * up.splash * (1 + m(mods, 'mortar.splash'));
        s.arcTime = Math.max(0.15, d.arcTime * (1 + m(mods, 'mortar.arcTime')));
        break;
      case 'tesla':
        s.bounces = Math.round((d.bounces + add.bounces) * (1 + m(mods, 'tesla.bounces')) + m(mods, 'tesla.bouncesFlat'));
        s.bounceFalloff = Math.min(0.98, d.bounceFalloff + m(mods, 'tesla.bounceFalloff'));
        s.bounceRange = d.bounceRange * up.bounceRange * (1 + m(mods, 'tesla.bounceRange'));
        s.chargeDur = d.chargeDur * (1 + m(mods, 'tesla.chargeDur'));
        s.chainBlast = d.chainBlast + add.chainBlast + m(mods, 'tesla.chainBlast');
        break;
      case 'flame':
        s.burnDps = d.burnDps * up.burnDps * (1 + m(mods, 'flame.burnDps')) * global;
        s.burnDur = d.burnDur * up.burnDur * (1 + m(mods, 'flame.burnDur'));
        s.burnStacks = d.burnStacks + add.burnStacks + Math.floor(m(mods, 'flame.burnStacks'));
        s.cone = Math.min(160, d.cone * up.cone * (1 + m(mods, 'flame.cone')));
        if (mods['flame.dragon']) s.mask = TARGET.BOTH;
        break;
      case 'aa':
        s.missiles = (d.missiles + add.missiles) * (1 + m(mods, 'aa.missiles')) + m(mods, 'aa.missilesFlat');
        s.turnRate = d.turnRate * up.turnRate * (1 + m(mods, 'aa.turnRate'));
        s.flakSplash = d.flakSplash * up.flakSplash * (1 + m(mods, 'aa.flakSplash'));
        break;
    }

    this.stats = s;
    this.rangePx = s.range * C;
  }

  get dps() {
    const s = this.stats;
    switch (this.id) {
      case 'mg': return s.damage * s.rate * ((1 + s.spinMax) / 2);
      case 'sniper': return s.damage * s.rate * (1 + s.critChance * (s.critMult - 1)) * (1 + s.pierce * 0.5);
      case 'mortar': return s.damage * s.rate * 2.2;
      case 'tesla': return s.damage * s.rate * (1 + s.bounces * s.bounceFalloff * 0.8);
      case 'flame': return (s.damage * s.rate + s.burnDps) * 1.6;
      case 'aa': return s.damage * s.rate * Math.max(1, Math.round(s.missiles));
      default: return s.damage * s.rate;
    }
  }

  upgradeCost(mods) {
    if (this.level >= this.def.upgrades.length) return null;
    const base = this.def.upgrades[this.level].cost;
    return Math.max(10, Math.round(base * Math.max(0.4, 1 + m(mods, `${this.id}.cost`))));
  }

  upgrade(game) {
    const cost = this.upgradeCost(game.mods);
    if (cost === null || game.gold < cost) return false;
    game.spend(cost);
    this.invested += cost;
    this.level++;
    this.recompute(game.mods);
    this.placeAnim = 0;
    game.vfx.towerPlaced(this.px, this.py, this.def.accent);
    game.vfx.floatText(this.px, this.py - 26, `NIVEAU ${this.level}`, this.def.accent, 16, 1);
    return true;
  }

  sellValue(mods) {
    const ratio = Math.min(0.95, 0.6 + m(mods, 'player.sellRatio'));
    return Math.floor(this.invested * ratio);
  }

  cyclePriority(dir = 1) {
    const i = PRIORITY.indexOf(this.priority);
    this.priority = PRIORITY[(i + dir + PRIORITY.length) % PRIORITY.length];
  }

  // ----------------------------------------------------------
  update(dt, game) {
    this.placeAnim = Math.min(1, this.placeAnim + dt * 3.2);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 7);

    // Nettoyage des cratères expirés (mortier)
    if (this.craters.length) {
      for (let i = this.craters.length - 1; i >= 0; i--) {
        if (game.time > this.craters[i].until) this.craters.splice(i, 1);
      }
    }

    const inRange = enemiesInRange(game, this.px, this.py, this.rangePx, this.stats.mask);
    const target = selectTarget(game, this, inRange);
    this.target = target;
    this.firing = !!target;

    // Montée / descente en régime (mitraillette)
    if (this.id === 'mg') {
      const s = this.stats;
      if (target) this.spin = Math.min(1, this.spin + dt / s.spinUp);
      else this.spin = Math.max(0, this.spin - dt / s.spinDown);
    }

    // Orientation de la tourelle
    if (target) {
      const want = Math.atan2(target.y - this.py, target.x - this.px);
      let diff = ((want - this.angle + Math.PI * 3) % TAU) - Math.PI;
      const turn = (this.id === 'sniper' ? 5 : this.id === 'mortar' ? 3.5 : 11) * dt;
      this.angle += Math.max(-turn, Math.min(turn, diff));
    }

    // Cadence
    let rate = this.stats.rate;
    if (this.id === 'mg') rate *= 1 + (this.stats.spinMax - 1) * this.spin;
    this.cooldown -= dt;
    if (target && this.cooldown <= 0) {
      const aimed = Math.abs(((Math.atan2(target.y - this.py, target.x - this.px) - this.angle + Math.PI * 3) % TAU) - Math.PI);
      if (aimed < 0.35 || this.id === 'tesla' || this.id === 'mortar') {
        this.cooldown = 1 / rate;
        Weapons[this.id](this, game, target);
      }
    }
    if (this.cooldown < -1) this.cooldown = 0;
  }

  onWaveStart(game) {
    this.firstShotOfWave = true;
    if (!game.mods['mg.deluge']) this.spin = 0;
  }

  // ----------------------------------------------------------
  //  Rendu
  // ----------------------------------------------------------
  draw(ctx, time, selected, hovered) {
    const ease = 1 - Math.pow(1 - this.placeAnim, 3);
    const scale = 0.4 + 0.6 * ease;
    const accent = this.def.accent;
    const half = C / 2;

    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(scale, scale);
    ctx.globalAlpha = ease;

    // --- Socle néo-brutaliste : ombre dure décalée ---
    const s = C - 8;
    ctx.fillStyle = accent;
    ctx.fillRect(-s / 2 + 4, -s / 2 + 4, s, s);
    ctx.fillStyle = PALETTE.surface2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);

    // Barres de niveau
    for (let i = 0; i < this.level; i++) {
      ctx.fillStyle = accent;
      ctx.fillRect(-s / 2 + 3 + i * 6, s / 2 - 6, 4, 3);
    }

    // --- Tourelle ---
    ctx.rotate(this.angle);
    const rec = this.recoil * (this.id === 'sniper' ? 7 : 3);
    ctx.translate(-rec, 0);
    this._drawTurret(ctx, time);

    ctx.restore();

    // --- Cercle de portée ---
    if (selected || hovered) {
      ctx.save();
      ctx.globalAlpha = selected ? 0.85 : 0.4;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -time * 26;
      ctx.beginPath();
      ctx.arc(this.px, this.py, this.rangePx, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (selected) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = accent;
        ctx.fill();
        // cône du lance-flamme
        if (this.id === 'flame') {
          const halfC = (this.stats.cone * Math.PI / 180) / 2;
          ctx.globalAlpha = 0.16;
          ctx.beginPath();
          ctx.moveTo(this.px, this.py);
          ctx.arc(this.px, this.py, this.rangePx, this.angle - halfC, this.angle + halfC);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Trait vers la cible (aide de lecture quand sélectionnée)
    if (selected && this.target) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(this.px, this.py);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTurret(ctx, time) {
    const A = this.def.accent;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#090909';

    switch (this.id) {
      case 'mg': {
        const barrels = 1 + this.level;
        const spinRot = this.spin * time * 14;
        ctx.save();
        ctx.rotate(0);
        ctx.fillStyle = PALETTE.text;
        for (let i = 0; i < barrels; i++) {
          const off = (i - (barrels - 1) / 2) * 4.2;
          const wob = Math.cos(spinRot + i * 2) * 1.4 * this.spin;
          ctx.fillRect(4, off - 1.4 + wob, 18 + this.level * 2, 2.8);
          ctx.strokeRect(4, off - 1.4 + wob, 18 + this.level * 2, 2.8);
        }
        ctx.restore();
        ctx.fillStyle = A;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
        ctx.strokeStyle = PALETTE.line; ctx.stroke();
        // jauge de régime
        if (this.spin > 0.02) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, 11.5, -Math.PI / 2, -Math.PI / 2 + TAU * this.spin);
          ctx.stroke();
        }
        break;
      }
      case 'sniper': {
        ctx.fillStyle = PALETTE.text;
        ctx.fillRect(2, -2, 26 + this.level * 3, 4);
        ctx.strokeRect(2, -2, 26 + this.level * 3, 4);
        ctx.fillStyle = A;
        ctx.fillRect(-9, -6, 14, 12);
        ctx.strokeStyle = PALETTE.line;
        ctx.strokeRect(-9, -6, 14, 12);
        // lunette
        ctx.fillStyle = PALETTE.line;
        ctx.fillRect(-2, -9, 9, 3);
        // point laser
        if (this.target) {
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(time * 18) * 0.2;
          ctx.strokeStyle = PALETTE.danger;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(28, 0);
          ctx.lineTo(Math.hypot(this.target.x - this.px, this.target.y - this.py), 0);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case 'mortar': {
        ctx.save();
        ctx.rotate(-0.5);
        ctx.fillStyle = PALETTE.text;
        ctx.fillRect(0, -4.5, 20 + this.level * 2, 9);
        ctx.strokeRect(0, -4.5, 20 + this.level * 2, 9);
        ctx.fillStyle = '#090909';
        ctx.fillRect(16 + this.level * 2, -3.5, 4, 7);
        ctx.restore();
        ctx.fillStyle = A;
        ctx.beginPath();
        ctx.moveTo(-10, 8); ctx.lineTo(10, 8); ctx.lineTo(6, -4); ctx.lineTo(-6, -4);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = PALETTE.line; ctx.stroke();
        break;
      }
      case 'tesla': {
        const pulse = 0.6 + Math.sin(time * 6) * 0.4;
        ctx.fillStyle = PALETTE.surface;
        ctx.fillRect(-5, -3, 10, 12);
        ctx.strokeStyle = PALETTE.line;
        ctx.strokeRect(-5, -3, 10, 12);
        // bobines
        for (let i = 0; i < 3 + this.level; i++) {
          ctx.strokeStyle = i % 2 ? A : PALETTE.line;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(0, -6 - i * 2.4, 7 - i * 0.9, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = A;
        ctx.globalAlpha = pulse;
        ctx.beginPath(); ctx.arc(0, -14, 3.6 + pulse * 2, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        // arcs statiques
        if (this.firing) {
          ctx.strokeStyle = A;
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            const a = Math.random() * TAU;
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(Math.cos(a) * 12, -14 + Math.sin(a) * 12);
            ctx.stroke();
          }
        }
        break;
      }
      case 'flame': {
        ctx.fillStyle = PALETTE.text;
        ctx.fillRect(2, -3.5, 16 + this.level, 7);
        ctx.strokeRect(2, -3.5, 16 + this.level, 7);
        ctx.fillStyle = A;
        ctx.beginPath();
        ctx.moveTo(18 + this.level, -5.5);
        ctx.lineTo(24 + this.level, 0);
        ctx.lineTo(18 + this.level, 5.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // réservoirs
        ctx.fillStyle = A;
        ctx.beginPath(); ctx.arc(-7, -5, 4.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-7, 5, 4.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = PALETTE.line;
        ctx.beginPath(); ctx.arc(-7, -5, 4.2, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(-7, 5, 4.2, 0, TAU); ctx.stroke();
        // veilleuse
        ctx.fillStyle = PALETTE.fire;
        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
        ctx.beginPath(); ctx.arc(24 + this.level, 0, 2.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'aa': {
        const n = Math.max(1, Math.round(this.stats.missiles));
        ctx.fillStyle = PALETTE.surface;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = PALETTE.line;
        ctx.strokeRect(-8, -8, 16, 16);
        for (let i = 0; i < Math.min(4, n); i++) {
          const off = (i - (Math.min(4, n) - 1) / 2) * 5;
          ctx.fillStyle = A;
          ctx.beginPath();
          ctx.moveTo(16, off); ctx.lineTo(2, off - 2.2); ctx.lineTo(2, off + 2.2);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#090909';
          ctx.stroke();
        }
        // radar
        ctx.save();
        ctx.rotate(time * 2.4);
        ctx.strokeStyle = A;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = PALETTE.line;
        ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
        break;
      }
      case 'sandbag': {
        ctx.rotate(-this.angle); // pile symétrique, insensible à l'orientation
        const bags = [
          [-8, 5, 11, 7, -0.12], [7, 5, 11, 7, 0.1],
          [-6, -4, 11, 7, 0.08], [6, -4.5, 10, 6.5, -0.09]
        ];
        for (const [bx, by, bw, bh, rot] of bags) {
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(rot);
          ctx.fillStyle = A;
          ctx.beginPath();
          ctx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#090909';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // couture centrale
          ctx.beginPath();
          ctx.moveTo(-bw / 2 + 2, 0);
          ctx.lineTo(bw / 2 - 2, 0);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
    }
  }
}

/** Fantôme de placement (suivi du curseur, aimanté à la grille). */
export function drawGhost(ctx, id, gx, gy, valid, time, grid, mods) {
  const px = grid.cx(gx), py = grid.cy(gy);
  const def = TOWERS[id];
  const range = def.range * (1 + m(mods, `${id}.range`)) * C;
  const col = valid ? def.accent : PALETTE.danger;

  ctx.save();
  // portée
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.lineDashOffset = -time * 34;
  ctx.beginPath(); ctx.arc(px, py, range, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = col;
  ctx.fill();

  // cellule
  const pulse = 0.5 + Math.sin(time * 8) * 0.18;
  ctx.globalAlpha = valid ? pulse * 0.55 : pulse;
  ctx.fillStyle = col;
  ctx.fillRect(gx * C + 2, gy * C + 2, C - 4, C - 4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.strokeRect(gx * C + 2, gy * C + 2, C - 4, C - 4);

  // équerres d'angle
  ctx.lineWidth = 3;
  const k = 9;
  const corners = [[2, 2, 1, 1], [C - 2, 2, -1, 1], [2, C - 2, 1, -1], [C - 2, C - 2, -1, -1]];
  for (const [ox, oy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(gx * C + ox + sx * k, gy * C + oy);
    ctx.lineTo(gx * C + ox, gy * C + oy);
    ctx.lineTo(gx * C + ox, gy * C + oy + sy * k);
    ctx.stroke();
  }

  if (!valid) {
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gx * C + 10, gy * C + 10);
    ctx.lineTo(gx * C + C - 10, gy * C + C - 10);
    ctx.moveTo(gx * C + C - 10, gy * C + 10);
    ctx.lineTo(gx * C + 10, gy * C + C - 10);
    ctx.stroke();
  }
  ctx.restore();
}
