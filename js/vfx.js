// ============================================================
//  VFX — particules, ondes, arcs, nombres de dégâts, screen shake.
//  Système à pool : tous les effets sont mis à jour et rendus
//  par la boucle de jeu, sans allocation par frame en régime établi.
// ============================================================

import { PALETTE, FX, GRID } from './config.js';
import { rand, randInt, pick } from './rng.js';

const TAU = Math.PI * 2;

export class Vfx {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.arcs = [];
    this.numbers = [];
    this.craters = [];
    this.beams = [];
    this.texts = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.chroma = 0;
    this.slowmo = 0;
    this.time = 0;
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.arcs.length = 0;
    this.numbers.length = 0;
    this.craters.length = 0;
    this.beams.length = 0;
    this.texts.length = 0;
    this.shake = this.flash = this.chroma = this.slowmo = 0;
  }

  // ----------------------------------------------------------
  //  Émetteurs
  // ----------------------------------------------------------
  particle(x, y, vx, vy, life, color, size, opts = {}) {
    if (this.particles.length >= FX.maxParticles) this.particles.shift();
    this.particles.push({
      x, y, vx, vy, life, max: life, color, size,
      grav: opts.grav || 0,
      drag: opts.drag === undefined ? 0.94 : opts.drag,
      shape: opts.shape || 'dot',
      rot: opts.rot || 0,
      spin: opts.spin || 0,
      glow: opts.glow || false,
      fade: opts.fade === undefined ? 1 : opts.fade
    });
  }

  ring(x, y, r0, r1, life, color, width = 3, opts = {}) {
    this.rings.push({
      x, y, r0, r1, life, max: life, color, width,
      fill: opts.fill || null, ease: opts.ease || 'out'
    });
  }

  arc(pts, life, color, width = 2, opts = {}) {
    this.arcs.push({ pts, life, max: life, color, width, branches: opts.branches || [] });
  }

  beam(x1, y1, x2, y2, life, color, width) {
    this.beams.push({ x1, y1, x2, y2, life, max: life, color, width });
  }

  damageNumber(x, y, value, opts = {}) {
    if (value <= 0) return;
    const crit = !!opts.crit;
    this.numbers.push({
      x: x + rand(-6, 6), y, value,
      vx: rand(-14, 14), vy: rand(-52, -34),
      life: crit ? FX.dmgNumberLife * 1.25 : FX.dmgNumberLife,
      max: crit ? FX.dmgNumberLife * 1.25 : FX.dmgNumberLife,
      crit,
      color: crit ? PALETTE.gold : (opts.type === 'burn' ? PALETTE.fire : '#f4f4f4'),
      size: crit ? 22 : 14
    });
  }

  floatText(x, y, text, color = '#f4f4f4', size = 16, life = 1.1) {
    this.texts.push({ x, y, text, color, size, life, max: life, vy: -26 });
  }

  crater(x, y, r, life = FX.craterLife) {
    this.craters.push({ x, y, r, life, max: life });
  }

  addShake(amount) { this.shake = Math.min(26, this.shake + amount); }
  addFlash(amount, color = '#ffffff') {
    if (amount > this.flash) { this.flash = amount; this.flashColor = color; }
  }
  addChroma(amount) { this.chroma = Math.min(12, this.chroma + amount); }
  addSlowmo(dur) { this.slowmo = Math.max(this.slowmo, dur); }

  // ----------------------------------------------------------
  //  Effets composés
  // ----------------------------------------------------------

  muzzle(x, y, angle, color = '#f4f4f4', scale = 1) {
    this.ring(x, y, 2, 13 * scale, 0.11, color, 2);
    for (let i = 0; i < 4; i++) {
      const a = angle + rand(-0.42, 0.42);
      const s = rand(90, 210) * scale;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.07, 0.16), color, rand(1.6, 3.2) * scale, { drag: 0.86, glow: true });
    }
  }

  shell(x, y, angle) {
    const a = angle + Math.PI / 2 + rand(-0.4, 0.4);
    this.particle(x, y, Math.cos(a) * rand(50, 110), Math.sin(a) * rand(50, 110) - 40,
      rand(0.4, 0.7), PALETTE.gold, 2.2, { grav: 420, drag: 0.99, shape: 'rect', spin: rand(-16, 16) });
  }

  impact(x, y, color = '#f4f4f4', n = 6, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(50, 190) * power;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.14, 0.34), color, rand(1.4, 3), { drag: 0.9 });
    }
    this.ring(x, y, 1, 15 * power, 0.2, color, 2);
  }

  explosion(x, y, radius, color = PALETTE.fire, power = 1) {
    this.ring(x, y, radius * 0.15, radius, 0.34, '#ffffff', 4);
    this.ring(x, y, radius * 0.05, radius * 1.28, 0.5, color, 2);
    const n = Math.min(46, Math.round(20 * power));
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(60, 330) * power;
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.62),
        pick([color, '#ffffff', PALETTE.gold]), rand(2, 5.4), { drag: 0.9, glow: true });
    }
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const s = rand(80, 260);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 60, rand(0.5, 0.95),
        '#090909', rand(2, 4), { grav: 520, drag: 0.985, shape: 'rect', spin: rand(-14, 14) });
    }
    this.addShake(4.5 * power);
    this.addFlash(0.16 * power, color);
  }

  smoke(x, y, color = '#3a3a3a', n = 3) {
    for (let i = 0; i < n; i++) {
      this.particle(x + rand(-4, 4), y + rand(-4, 4), rand(-16, 16), rand(-30, -8),
        rand(0.5, 1.1), color, rand(3, 7), { drag: 0.96, fade: 0.55 });
    }
  }

  /** Arc électrique procédural avec ramifications. */
  lightning(x1, y1, x2, y2, color = PALETTE.tesla, life = 0.16, jag = 12) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const segs = Math.max(4, Math.min(18, Math.round(dist / 16)));
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const nx = x1 + (x2 - x1) * t;
      const ny = y1 + (y2 - y1) * t;
      const perp = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const off = (i === 0 || i === segs) ? 0 : rand(-jag, jag) * Math.sin(t * Math.PI);
      pts.push({ x: nx + Math.cos(perp) * off, y: ny + Math.sin(perp) * off });
    }
    const branches = [];
    const nb = randInt(1, 3);
    for (let b = 0; b < nb; b++) {
      const i = randInt(1, segs - 1);
      const p = pts[i];
      const a = rand(0, TAU);
      const len = rand(10, 30);
      branches.push([
        { x: p.x, y: p.y },
        { x: p.x + Math.cos(a) * len * 0.5, y: p.y + Math.sin(a) * len * 0.5 },
        { x: p.x + Math.cos(a + rand(-0.6, 0.6)) * len, y: p.y + Math.sin(a + rand(-0.6, 0.6)) * len }
      ]);
    }
    this.arc(pts, life, color, 2.2, { branches });
  }

  flameJet(x, y, angle, range, cone) {
    const half = cone / 2;
    for (let i = 0; i < 3; i++) {
      const a = angle + rand(-half, half);
      const s = rand(range * 0.7, range * 1.25);
      const col = pick([PALETTE.fire, '#ffcc33', '#ff4d1a', '#ffffff']);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.22, 0.42), col,
        rand(4, 9), { drag: 0.9, glow: true, fade: 0.7 });
    }
    if (Math.random() < 0.3) this.smoke(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, '#2a2018', 1);
  }

  coin(x, y, tx, ty) {
    this.particles.push({
      x, y, vx: rand(-60, 60), vy: rand(-120, -50), life: 0.7, max: 0.7,
      color: PALETTE.gold, size: 3.4, grav: 0, drag: 1, shape: 'coin',
      homing: { tx, ty }, glow: true, fade: 1, rot: 0, spin: rand(-10, 10)
    });
  }

  healSpark(x, y) {
    this.particle(x + rand(-8, 8), y, rand(-8, 8), rand(-46, -22), 0.5, PALETTE.ok, 2.2, { drag: 0.97 });
  }

  shieldBreak(x, y) {
    this.ring(x, y, 4, 30, 0.3, PALETTE.accent, 3);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU);
      this.particle(x, y, Math.cos(a) * rand(80, 200), Math.sin(a) * rand(80, 200),
        rand(0.3, 0.55), PALETTE.accent, rand(2, 4), { drag: 0.92, shape: 'rect', spin: rand(-12, 12) });
    }
    this.addShake(2);
  }

  death(e) {
    const col = e.color;
    const n = e.boss ? 60 : Math.min(24, 8 + e.radius);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(60, e.boss ? 420 : 230);
      this.particle(e.x, e.y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.75),
        pick([col, '#ffffff', '#090909']), rand(2, e.boss ? 6 : 4),
        { drag: 0.91, grav: e.air ? 240 : 0, shape: Math.random() < 0.5 ? 'rect' : 'dot', spin: rand(-16, 16) });
    }
    this.ring(e.x, e.y, 2, e.radius * (e.boss ? 6 : 2.6), e.boss ? 0.6 : 0.3, col, e.boss ? 5 : 2);
    if (e.boss) {
      this.ring(e.x, e.y, 2, e.radius * 9, 0.9, '#ffffff', 3);
      this.addShake(16);
      this.addFlash(0.5, '#ffffff');
      this.addChroma(9);
      this.addSlowmo(0.55);
    } else {
      this.addShake(e.radius * 0.09);
    }
  }

  towerPlaced(x, y, color) {
    this.ring(x, y, 4, GRID.cell * 2.4, 0.42, color, 4);
    this.ring(x, y, 2, GRID.cell * 1.3, 0.28, '#ffffff', 2);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU;
      this.particle(x, y, Math.cos(a) * rand(90, 190), Math.sin(a) * rand(90, 190),
        rand(0.3, 0.55), color, rand(2, 4), { drag: 0.9 });
    }
    this.addShake(4);
  }

  towerSold(x, y) {
    this.ring(x, y, GRID.cell, 2, 0.3, PALETTE.gold, 3);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU);
      this.particle(x, y, Math.cos(a) * rand(40, 120), Math.sin(a) * rand(40, 120) - 60,
        rand(0.4, 0.7), PALETTE.gold, rand(2, 3.4), { grav: 380, drag: 0.98, shape: 'rect' });
    }
  }

  // ----------------------------------------------------------
  //  Update
  // ----------------------------------------------------------
  update(dt) {
    this.time += dt;

    // Particules
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      if (p.homing) {
        const dx = p.homing.tx - p.x, dy = p.homing.ty - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const t = 1 - p.life / p.max;
        const pull = 900 * t * t;
        p.vx += (dx / d) * pull * dt;
        p.vy += (dy / d) * pull * dt;
        if (d < 18) { this.particles.splice(i, 1); continue; }
      }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    // Anneaux
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }

    // Arcs
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= dt;
      if (a.life <= 0) this.arcs.splice(i, 1);
    }

    // Rayons
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) this.beams.splice(i, 1);
    }

    // Nombres
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      if (n.life <= 0) { this.numbers.splice(i, 1); continue; }
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.vy += 90 * dt;
      n.vx *= 0.96;
    }

    // Textes flottants
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 0.94;
    }

    // Cratères
    for (let i = this.craters.length - 1; i >= 0; i--) {
      const c = this.craters[i];
      c.life -= dt;
      if (c.life <= 0) this.craters.splice(i, 1);
    }

    // Caméra
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - FX.shakeDecay * dt * (1 + this.shake * 0.1));
      const a = rand(0, TAU);
      this.shakeX = Math.cos(a) * this.shake;
      this.shakeY = Math.sin(a) * this.shake;
    } else { this.shakeX = this.shakeY = 0; }

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.chroma > 0) this.chroma = Math.max(0, this.chroma - dt * 14);
    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
  }

  // ----------------------------------------------------------
  //  Rendu
  // ----------------------------------------------------------

  /** Couche sous les entités (cratères). */
  drawBelow(ctx) {
    for (const c of this.craters) {
      const t = c.life / c.max;
      ctx.save();
      ctx.globalAlpha = t * 0.55;
      ctx.fillStyle = '#1a0d06';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill();
      ctx.globalAlpha = t * 0.5 * (0.6 + Math.sin(this.time * 8 + c.x) * 0.4);
      ctx.strokeStyle = PALETTE.fire;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.65 + t * 0.3), 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  /** Couche au-dessus des entités. */
  drawAbove(ctx) {
    ctx.save();

    // Rayons (sniper)
    for (const b of this.beams) {
      const t = b.life / b.max;
      ctx.globalAlpha = t;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * t;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.globalAlpha = t * 0.4;
      ctx.lineWidth = b.width * 3 * t;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Arcs électriques
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const a of this.arcs) {
      const t = a.life / a.max;
      const drawPts = (pts, w, alpha, col) => {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      };
      drawPts(a.pts, a.width * 3.2, t * 0.28, a.color);
      drawPts(a.pts, a.width, t, a.color);
      drawPts(a.pts, a.width * 0.4, t, '#ffffff');
      for (const br of a.branches) drawPts(br, a.width * 0.6, t * 0.7, a.color);
    }
    ctx.globalAlpha = 1;

    // Particules
    for (const p of this.particles) {
      const t = p.life / p.max;
      const alpha = Math.min(1, t / p.fade);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
      }
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      } else if (p.shape === 'coin') {
        ctx.save();
        ctx.translate(p.x, p.y);
        const sx = Math.abs(Math.cos(p.rot));
        ctx.scale(0.3 + sx * 0.7, 1);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, TAU);
        ctx.fill();
      }
      if (p.glow) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;

    // Anneaux
    for (const r of this.rings) {
      const raw = 1 - r.life / r.max;
      const t = r.ease === 'out' ? 1 - Math.pow(1 - raw, 3) : raw;
      const rad = r.r0 + (r.r1 - r.r0) * t;
      ctx.globalAlpha = (1 - raw) * 0.95;
      if (r.fill) {
        ctx.fillStyle = r.fill;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(0.5, r.width * (1 - raw));
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /** Couche UI (nombres, textes) — toujours lisible, non affectée par le zoom. */
  drawUi(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const n of this.numbers) {
      const t = n.life / n.max;
      const pop = t > 0.8 ? 1 + (t - 0.8) * 3 : 1;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = `${n.crit ? '700 ' : ''}${n.size * pop}px "Space Mono", monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#090909';
      ctx.strokeText(n.value, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.value, n.x, n.y);
      if (n.crit) {
        ctx.font = `700 ${10 * pop}px "Space Mono", monospace`;
        ctx.strokeText('CRIT', n.x, n.y - n.size * 0.85);
        ctx.fillText('CRIT', n.x, n.y - n.size * 0.85);
      }
    }

    for (const tx of this.texts) {
      const t = tx.life / tx.max;
      ctx.globalAlpha = Math.min(1, t * 1.8);
      ctx.font = `${tx.size}px "Bebas Neue", "Space Mono", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#090909';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }

    ctx.restore();
  }
}
