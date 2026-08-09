// ============================================================
//  ENEMIES — 12 types, statuts, déplacement sol (flow field)
//  et aérien (courbe fixe).
// ============================================================

import { ENEMIES, GRID, PALETTE } from './config.js';

let uid = 1;

export class Enemy {
  constructor(typeId, grid, mods = {}) {
    const def = ENEMIES[typeId];
    this.id = uid++;
    this.def = def;
    this.type = typeId;
    this.name = def.name;
    this.air = def.air;
    this.boss = !!def.boss;
    this.grid = grid;

    this.maxHp = Math.max(1, Math.round(def.hp * (mods.hpMult || 1)));
    this.hp = this.maxHp;
    this.armor = def.armor * (mods.armorMult || 1);
    this.baseArmor = this.armor;
    this.speed = def.speed * (mods.speedMult || 1);
    this.baseSpeed = this.speed;
    this.gold = Math.max(1, Math.round(def.gold * (mods.goldMult || 1)));
    this.leak = def.leak;
    this.radius = def.radius;
    this.color = def.color;
    this.shape = def.shape;

    this.maxShield = def.shield ? Math.round(def.shield * (mods.hpMult || 1)) : 0;
    this.shield = this.maxShield;
    this.shieldTimer = 0;

    this.dead = false;
    this.leaked = false;
    this.t = 0;
    this.hitFlash = 0;
    this.spawnAnim = 0;

    // Statuts
    this.burns = [];        // [{dps, until, melt}]
    this.charged = 0;       // durée restante de la marque Tesla
    this.chargedDmg = 0;    // dégâts stockés pour l'explosion en chaîne
    this.slowUntil = 0;
    this.slowAmount = 0;
    this.stunUntil = 0;
    this.stunAccum = 0;       // temps étourdi d'affilée (remis à 0 dès que ça s'arrête)
    this.stunImmuneUntil = 0; // anti-stunlock : immunité temporaire après un étourdissement trop long

    // Déplacement
    if (this.air) {
      this.travel = 0;
      const p = grid.airAt(0);
      this.x = p.x; this.y = p.y; this.angle = p.a;
      this.bob = Math.random() * Math.PI * 2;
    } else {
      const spawns = grid.spawns || [grid.spawn];
      const sp = spawns[Math.floor(Math.random() * spawns.length)];
      // _px/_py : position "logique" qui suit le flow field au centre du
      // couloir (utilisée pour tout le pathing). x/y (publiques, lues par
      // le rendu et le combat) y ajoutent un décalage latéral fixe pour que
      // les ennemis ne marchent pas tous en file indienne sur la même
      // ligne — décisif contre un sniper qui perce en ligne droite : un
      // essaim vraiment étalé échappe à un tir qui n'en aligne que
      // quelques-uns, alors qu'un couloir à sens unique se ferait
      // entièrement traverser par un seul tir.
      this._px = grid.cx(sp.x);
      this._py = grid.cy(sp.y);
      this.angle = 0;
      this.target = null;
      this.wobble = Math.random() * Math.PI * 2;
      this.offset = (Math.random() - 0.5) * GRID.cell * 0.38 * (def.spread || 1);
      this.x = this._px; this.y = this._py;
      this._pickTarget();
      this._applyOffset();
    }
  }

  // ----------------------------------------------------------
  _pickTarget() {
    const g = this.grid;
    const gx = Math.floor(this._px / g.cell);
    const gy = Math.floor(this._py / g.cell);
    const n = g.nextStep(gx, gy);
    if (n) {
      this.target = { x: g.cx(n.x), y: g.cy(n.y), gx: n.x, gy: n.y };
    } else {
      this.target = null;
    }
  }

  /** Reprojette x/y (position publique) depuis _px/_py + le décalage latéral. */
  _applyOffset() {
    const perp = this.angle + Math.PI / 2;
    this.x = this._px + Math.cos(perp) * this.offset;
    this.y = this._py + Math.sin(perp) * this.offset;
  }

  /** Appelé quand la grille change : on revalide la case visée. */
  repath() {
    if (this.air) return;
    if (!this.target) { this._pickTarget(); return; }
    if (this.grid.blocked(this.target.gx, this.target.gy)) this._pickTarget();
    else {
      // La case visée reste libre, mais un chemin plus court existe peut-être.
      const g = this.grid;
      const gx = Math.floor(this._px / g.cell);
      const gy = Math.floor(this._py / g.cell);
      const cur = g.dist[g.idx(gx, gy)];
      const tgt = g.dist[g.idx(this.target.gx, this.target.gy)];
      if (tgt === -1 || (cur !== -1 && tgt >= cur)) this._pickTarget();
    }
  }

  // ----------------------------------------------------------
  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.spawnAnim = Math.min(1, this.spawnAnim + dt * 4);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 5);

    // --- Brûlures ---
    if (this.burns.length) {
      let dps = 0, melt = 0;
      for (let i = this.burns.length - 1; i >= 0; i--) {
        const b = this.burns[i];
        if (game.time >= b.until) { this.burns.splice(i, 1); continue; }
        dps += b.dps;
        melt += b.melt || 0;
      }
      if (dps > 0) {
        this.damage(dps * dt, { type: 'burn', silent: true }, game);
        if (melt > 0) this.armor = Math.max(0, this.armor - melt * dt);
      }
    }

    // --- Marque Tesla ---
    if (this.charged > 0) {
      this.charged -= dt;
      if (this.charged <= 0) { this.charged = 0; this.chargedDmg = 0; }
    }

    // --- Bouclier ---
    if (this.maxShield > 0) {
      if (this.shieldTimer > 0) this.shieldTimer -= dt;
      else if (this.shield < this.maxShield) {
        this.shield = Math.min(this.maxShield, this.shield + this.maxShield * this.def.shieldRegen * dt);
      }
    }

    if (this.dead) return;

    // --- Anti-stunlock : 5s d'étourdissement d'affilée donnent 1s d'immunité ---
    if (game.time < this.stunUntil) {
      this.stunAccum += dt;
      if (this.stunAccum >= 5) {
        this.stunUntil = game.time;           // coupe l'étourdissement en cours
        this.stunImmuneUntil = game.time + 1; // ignore tout nouveau stun pendant 1s
        this.stunAccum = 0;
        if (game.vfx) game.vfx.ring(this.x, this.y, 2, this.radius * 2.2, 0.35, '#ffffff', 2);
      }
    } else {
      this.stunAccum = 0;
    }

    // --- Vitesse effective ---
    let speed = this.baseSpeed;
    if (game.time < this.slowUntil) speed *= (1 - this.slowAmount);
    if (game.time < this.stunUntil) speed = 0;
    this.speed = speed;

    if (this.air) this._moveAir(dt, game, speed);
    else this._moveGround(dt, game, speed);

    // --- Soigneur ---
    if (this.def.healPerSec) this._heal(dt, game);
  }

  _moveAir(dt, game, speed) {
    const g = this.grid;
    this.travel += speed * g.cell * dt;
    if (this.travel >= g.airLength) {
      this.leakOut(game);
      return;
    }
    const p = g.airAt(this.travel);
    this.bob += dt * 6;
    this.x = p.x;
    this.y = p.y + Math.sin(this.bob) * 3;
    this.angle = p.a;
  }

  _moveGround(dt, game, speed) {
    const g = this.grid;
    if (!this.target) {
      this._pickTarget();
      if (!this.target) {
        // Arrivé sur la base (ou totalement enfermé, ce que la validation interdit)
        const bx = g.cx(g.base.x), by = g.cy(g.base.y);
        if (Math.hypot(this._px - bx, this._py - by) < g.cell * 0.6) { this.leakOut(game); return; }
        return;
      }
    }
    const tx = this.target.x, ty = this.target.y;
    const dx = tx - this._px, dy = ty - this._py;
    const d = Math.hypot(dx, dy);
    const step = speed * g.cell * dt;
    this.wobble += dt * 9;

    if (d <= step || d < 0.6) {
      this._px = tx; this._py = ty;
      const gx = this.target.gx, gy = this.target.gy;
      if (gx === g.base.x && gy === g.base.y) { this._applyOffset(); this.leakOut(game); return; }
      this._pickTarget();
    } else {
      this._px += (dx / d) * step;
      this._py += (dy / d) * step;
      this.angle = Math.atan2(dy, dx);
    }
    this._applyOffset();
  }

  _heal(dt, game) {
    const r = this.def.healRadius * GRID.cell;
    const amount = this.def.healPerSec * dt;
    for (const e of game.enemies) {
      if (e === this || e.dead || e.air !== this.air) continue;
      if (e.hp >= e.maxHp) continue;
      const dd = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
      if (dd > r * r) continue;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * amount);
      if (Math.random() < dt * 3) game.vfx.healSpark(e.x, e.y);
    }
  }

  // ----------------------------------------------------------
  //  Dégâts
  //  opts: {type, armorPen, ignoreArmor, crit, silent, source}
  // ----------------------------------------------------------
  damage(amount, opts = {}, game) {
    if (this.dead) return 0;
    let dmg = amount;

    // Marque de commandant (BOURREAU) : cible désignée, dégâts amplifiés
    // de la part de TOUTES les tours tant que la marque dure.
    if (game && this.commanderMarkUntil && game.time < this.commanderMarkUntil) {
      dmg *= 1 + this.commanderMarkBonus;
    }

    if (!opts.ignoreArmor && this.armor > 0 && opts.type !== 'burn') {
      const pen = opts.armorPen || 0;
      const eff = Math.max(0, this.armor - pen);
      dmg = Math.max(dmg * 0.12, dmg - eff);
    }

    // Bouclier absorbe en premier
    if (this.shield > 0) {
      const shieldDmg = opts.type === 'tesla' ? dmg * 1.5 : dmg;
      if (shieldDmg >= this.shield) {
        const carry = (shieldDmg - this.shield) / (opts.type === 'tesla' ? 1.5 : 1);
        this.shield = 0;
        this.shieldTimer = this.def.shieldDelay || 2;
        dmg = carry;
        if (game) game.vfx.shieldBreak(this.x, this.y);
      } else {
        this.shield -= shieldDmg;
        this.shieldTimer = this.def.shieldDelay || 2;
        dmg = 0;
      }
    }

    if (dmg <= 0) {
      this.hitFlash = 0.5;
      return 0;
    }

    const applied = Math.min(this.hp, dmg);
    this.hp -= dmg;
    this.hitFlash = 1;
    if (this.charged > 0) this.chargedDmg += applied * 0.35;

    if (game && !opts.silent) {
      game.vfx.damageNumber(this.x, this.y - this.radius, Math.round(applied), opts);
    }

    if (this.hp <= 0 && !this.dead) this.kill(game, opts);
    return applied;
  }

  kill(game, opts = {}) {
    if (this.dead) return;
    this.dead = true;
    if (game) game.onEnemyKilled(this, opts);
  }

  leakOut(game) {
    if (this.dead || this.leaked) return;
    this.dead = true;
    this.leaked = true;
    if (game) game.onEnemyLeaked(this);
  }

  applyBurn(dps, dur, maxStacks, game, melt = 0) {
    if (this.burns.length >= maxStacks) {
      // On rafraîchit la brûlure la plus ancienne au lieu d'en empiler une de plus.
      let oldest = 0;
      for (let i = 1; i < this.burns.length; i++) {
        if (this.burns[i].until < this.burns[oldest].until) oldest = i;
      }
      this.burns[oldest] = { dps, until: game.time + dur, melt };
    } else {
      this.burns.push({ dps, until: game.time + dur, melt });
    }
  }

  applySlow(amount, dur, game) {
    if (amount >= this.slowAmount || game.time >= this.slowUntil) {
      this.slowAmount = Math.max(this.slowAmount, amount);
      this.slowUntil = Math.max(this.slowUntil, game.time + dur);
    }
  }

  /**
   * Étourdit l'ennemi — sauf s'il vient tout juste d'être libéré d'un
   * étourdissement trop long (voir stunImmuneUntil dans update()) : point de
   * passage unique, pour qu'aucune source de stun ne puisse contourner
   * l'anti-stunlock en écrivant stunUntil directement.
   */
  applyStun(dur, game) {
    if (game && game.time < this.stunImmuneUntil) return;
    this.stunUntil = Math.max(this.stunUntil, game.time + dur);
  }

  get burning() { return this.burns.length > 0; }
  get hpRatio() { return Math.max(0, this.hp / this.maxHp); }
  get shieldRatio() { return this.maxShield ? Math.max(0, this.shield / this.maxShield) : 0; }
}

// ============================================================
//  Dessin des ennemis (formes vectorielles néo-brutalistes)
// ============================================================

export function drawEnemy(ctx, e, time) {
  const r = e.radius * (0.4 + 0.6 * e.spawnAnim);
  ctx.save();
  ctx.translate(e.x, e.y);

  // Ombre au sol pour les aériens
  if (e.air) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(4, 16, r * 0.8, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const burning = e.burning;
  let fill = e.color;
  if (burning) fill = PALETTE.fire;
  if (e.hitFlash > 0.55) fill = '#ffffff';

  ctx.lineWidth = 2;
  ctx.strokeStyle = e.hitFlash > 0.2 ? '#ffffff' : '#090909';
  ctx.fillStyle = fill;

  const rot = e.air ? e.angle : 0;
  ctx.rotate(rot);

  switch (e.shape) {
    case 'square': {
      const w = r * 1.55;
      ctx.fillRect(-w / 2, -w / 2, w, w);
      ctx.strokeRect(-w / 2, -w / 2, w, w);
      ctx.fillStyle = '#090909';
      ctx.fillRect(-w / 2 + 3, -w / 2 + 3, w * 0.28, w * 0.28);
      break;
    }
    case 'tri': {
      ctx.beginPath();
      ctx.moveTo(r * 1.3, 0); ctx.lineTo(-r, -r * 0.95); ctx.lineTo(-r, r * 0.95);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'hex': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // plaques de blindage
      ctx.strokeStyle = '#090909';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.7); ctx.lineTo(-r * 0.5, r * 0.7);
      ctx.moveTo(r * 0.2, -r * 0.85); ctx.lineTo(r * 0.2, r * 0.85);
      ctx.stroke();
      break;
    }
    case 'dot': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }
    case 'cross': {
      const a = r * 0.45, b = r * 1.25;
      ctx.beginPath();
      ctx.rect(-a, -b, a * 2, b * 2);
      ctx.rect(-b, -a, b * 2, a * 2);
      ctx.fill();
      ctx.strokeRect(-a, -b, a * 2, b * 2);
      ctx.strokeRect(-b, -a, b * 2, a * 2);
      // halo de soin pulsant
      ctx.globalAlpha = 0.25 + Math.sin(time * 4) * 0.12;
      ctx.strokeStyle = PALETTE.ok;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.def.healRadius * GRID.cell, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.3);
      ctx.lineTo(r * 1.05, -r * 0.5);
      ctx.lineTo(r * 0.75, r * 1.2);
      ctx.lineTo(-r * 0.75, r * 1.2);
      ctx.lineTo(-r * 1.05, -r * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'diamond': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.35); ctx.lineTo(r * 1.05, 0);
      ctx.lineTo(0, r * 1.35); ctx.lineTo(-r * 1.05, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'rotor': {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f4f4f4';
      ctx.lineWidth = 2;
      const sp = time * 26;
      for (let i = 0; i < 2; i++) {
        const a = sp + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
        ctx.lineTo(-Math.cos(a) * r * 1.5, -Math.sin(a) * r * 1.5);
        ctx.stroke();
      }
      break;
    }
    case 'wasp': {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.5, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#090909';
      ctx.fillRect(-r * 0.2, -r * 0.6, r * 0.3, r * 1.2);
      ctx.fillRect(r * 0.5, -r * 0.55, r * 0.25, r * 1.1);
      // ailes floutées
      ctx.globalAlpha = 0.4 + Math.sin(time * 40) * 0.2;
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.1, r * 0.9, r * 0.3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(0, r * 1.1, r * 0.9, r * 0.3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'bomber': {
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(r * 0.2, -r * 0.85);
      ctx.lineTo(-r * 1.3, -r * 0.7);
      ctx.lineTo(-r * 1.3, r * 0.7);
      ctx.lineTo(r * 0.2, r * 0.85);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(-r * 0.9, -r * 1.35, r * 0.5, r * 2.7);
      ctx.strokeRect(-r * 0.9, -r * 1.35, r * 0.5, r * 2.7);
      break;
    }
    case 'boss': {
      const pulse = 1 + Math.sin(time * 3) * 0.04;
      ctx.rotate(e.air ? 0 : Math.sin(time * 1.5) * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + time * 0.3;
        const rr = (i % 2 ? r * 0.82 : r * 1.28) * pulse;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#090909'; ctx.stroke();
      ctx.fillStyle = '#090909';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2 * (1 + Math.sin(time * 8) * 0.2), 0, Math.PI * 2); ctx.fill();
      break;
    }
  }

  ctx.restore();

  // --- Marque Tesla ---
  if (e.charged > 0) {
    ctx.save();
    ctx.strokeStyle = PALETTE.tesla;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + Math.sin(time * 20) * 0.3;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + time * 5;
      const rr = e.radius * (1.45 + Math.sin(time * 30 + i) * 0.18);
      ctx[i ? 'lineTo' : 'moveTo'](e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // --- Barres de vie / bouclier ---
  if (e.hp < e.maxHp || e.shield < e.maxShield) {
    const w = Math.max(22, e.radius * 2.4);
    const bx = e.x - w / 2;
    const by = e.y - e.radius - (e.boss ? 18 : 11);
    ctx.fillStyle = '#090909';
    ctx.fillRect(bx - 1, by - 1, w + 2, 6);
    ctx.fillStyle = e.boss ? PALETTE.danger : (e.burning ? PALETTE.fire : PALETTE.ok);
    ctx.fillRect(bx, by, w * e.hpRatio, 4);
    ctx.strokeStyle = '#f4f4f4';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 0.5, by - 0.5, w + 1, 5);
    if (e.maxShield > 0 && e.shield > 0) {
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(bx, by - 4, w * e.shieldRatio, 3);
    }
  }
}
