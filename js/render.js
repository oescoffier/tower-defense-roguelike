// ============================================================
//  RENDER — dessin du champ de bataille, en couches :
//  fond → grille → chemins → cratères → tours → ennemis
//  → projectiles → VFX → post-traitement (chroma / flash / scanlines)
// ============================================================

import { GRID, CELL, PALETTE } from './config.js';
import { drawEnemy } from './enemies.js';
import { drawGhost } from './towers.js';
import { drawTutorialCell } from './tutorial.js';

const C = GRID.cell;
const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.resize();

    // Calque hors-écran pour l'aberration chromatique
    this.fxCanvas = document.createElement('canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');

    // Motif de bruit statique (grain)
    this.noise = this._makeNoise(128);
    this.noiseOffset = 0;
  }

  resize() {
    const c = this.canvas;
    c.width = GRID.w * this.dpr;
    c.height = GRID.h * this.dpr;
    c.style.width = GRID.w + 'px';
    c.style.height = GRID.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  _makeNoise(size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const cx = cv.getContext('2d');
    const img = cx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 16;
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }

  // ==========================================================
  draw(game) {
    const ctx = this.ctx;
    const t = game.time;
    const vfx = game.vfx;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, GRID.w, GRID.h);

    // --- Screen shake ---
    ctx.save();
    ctx.translate(vfx.shakeX, vfx.shakeY);

    this._drawBackground(ctx, t);
    this._drawGrid(ctx, game, t);
    this._drawGroundPath(ctx, game, t);
    this._drawAirPath(ctx, game, t);

    vfx.drawBelow(ctx);

    // Case objectif du tutoriel, sous le fantôme de placement
    if (game.tutorialCell) drawTutorialCell(ctx, game.tutorialCell, t);

    // Fantôme de placement sous les entités
    if (game.placing && game.hover) {
      drawGhost(ctx, game.placing, game.hover.x, game.hover.y, game.placeValid, t, game.grid, game.mods, game.loadout);
    }

    // --- Tours (triées par y pour un léger effet de profondeur) ---
    const towers = game.towers.slice().sort((a, b) => a.py - b.py);
    for (const tw of towers) {
      tw.draw(ctx, t, game.selected === tw, game.hoverTower === tw);
    }

    // --- Ennemis au sol puis aériens (les volants passent au-dessus) ---
    for (const e of game.enemies) if (!e.dead && !e.air) drawEnemy(ctx, e, t);

    // --- Projectiles ---
    for (const p of game.projectiles) p.draw(ctx, t);

    for (const e of game.enemies) if (!e.dead && e.air) drawEnemy(ctx, e, t);

    vfx.drawAbove(ctx);
    this._drawBase(ctx, game, t);
    this._drawSpawn(ctx, game, t);
    vfx.drawUi(ctx);

    ctx.restore();

    this._post(ctx, game, t);
  }

  // ----------------------------------------------------------
  _drawBackground(ctx, t) {
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, GRID.w, GRID.h);

    // Halo radial très discret au centre
    const g = ctx.createRadialGradient(GRID.w / 2, GRID.h / 2, 40, GRID.w / 2, GRID.h / 2, GRID.w * 0.75);
    g.addColorStop(0, 'rgba(13,103,255,0.10)');
    g.addColorStop(1, 'rgba(9,9,9,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GRID.w, GRID.h);

    // Lignes de fond en parallaxe
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 1;
    const off = (t * 14) % 60;
    for (let x = -60 + off; x < GRID.w + 60; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 40, GRID.h);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawGrid(ctx, game, t) {
    const grid = game.grid;
    ctx.save();

    // Lignes de la grille
    ctx.strokeStyle = 'rgba(244,244,244,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= grid.cols; x++) {
      ctx.moveTo(x * C + 0.5, 0);
      ctx.lineTo(x * C + 0.5, GRID.h);
    }
    for (let y = 0; y <= grid.rows; y++) {
      ctx.moveTo(0, y * C + 0.5);
      ctx.lineTo(GRID.w, y * C + 0.5);
    }
    ctx.stroke();

    // Points d'intersection
    ctx.fillStyle = 'rgba(244,244,244,0.10)';
    for (let y = 0; y <= grid.rows; y++) {
      for (let x = 0; x <= grid.cols; x++) {
        ctx.fillRect(x * C - 0.5, y * C - 0.5, 1.5, 1.5);
      }
    }

    // Obstacles
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (grid.get(x, y) !== CELL.ROCK) continue;
        // Les rochers n'ont PAS d'ombre colorée : c'est ce qui les
        // distingue au premier coup d'oeil des tours construites.
        const px = x * C, py = y * C;
        ctx.fillStyle = '#232323';
        ctx.beginPath();
        ctx.moveTo(px + 5, py + 9);
        ctx.lineTo(px + 13, py + 3);
        ctx.lineTo(px + C - 4, py + 7);
        ctx.lineTo(px + C - 3, py + C - 8);
        ctx.lineTo(px + C - 12, py + C - 3);
        ctx.lineTo(px + 4, py + C - 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(184,184,184,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // facettes internes
        ctx.strokeStyle = 'rgba(244,244,244,0.16)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px + 13, py + 3); ctx.lineTo(px + 17, py + C / 2);
        ctx.lineTo(px + C - 3, py + C - 8);
        ctx.moveTo(px + 17, py + C / 2); ctx.lineTo(px + 4, py + C - 6);
        ctx.stroke();
      }
    }

    // Surbrillance de la case survolée (hors placement)
    if (game.hover && !game.placing && grid.buildable(game.hover.x, game.hover.y)) {
      ctx.globalAlpha = 0.10 + Math.sin(t * 6) * 0.04;
      ctx.fillStyle = PALETTE.line;
      ctx.fillRect(game.hover.x * C, game.hover.y * C, C, C);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /** Chemin au sol : ruban animé + flèches de direction. */
  _drawGroundPath(ctx, game, t) {
    const grid = game.grid;
    const path = grid.path;
    if (!path || path.length < 2) return;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(grid.cx(path[0].x), grid.cy(path[0].y));
      for (let i = 1; i < path.length; i++) ctx.lineTo(grid.cx(path[i].x), grid.cy(path[i].y));
    };

    // Ruban : bord clair puis chaussée sombre — le chemin au sol est
    // l'élément de gameplay central, il doit se lire immédiatement.
    ctx.strokeStyle = 'rgba(244,244,244,0.34)';
    ctx.lineWidth = C * 0.80;
    trace(); ctx.stroke();

    ctx.strokeStyle = '#161616';
    ctx.lineWidth = C * 0.68;
    trace(); ctx.stroke();

    ctx.strokeStyle = 'rgba(13,103,255,0.16)';
    ctx.lineWidth = C * 0.68;
    trace(); ctx.stroke();

    // Contour animé : se retrace après chaque modification du chemin
    const reveal = grid.pathAge;
    const total = path.length - 1;
    const shown = Math.max(1, Math.floor(total * reveal));
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.moveTo(grid.cx(path[0].x), grid.cy(path[0].y));
    for (let i = 1; i <= shown; i++) ctx.lineTo(grid.cx(path[i].x), grid.cy(path[i].y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Front lumineux du retracé
    if (reveal < 1 && shown < total) {
      const p = path[shown];
      ctx.fillStyle = PALETTE.line;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(grid.cx(p.x), grid.cy(p.y), 6 + Math.sin(t * 20) * 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Chevrons de direction
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2.4;
    const flow = (t * 1.5) % 1;
    for (let i = 0; i < shown; i++) {
      if ((i + Math.floor(flow * 3)) % 3 !== 0) continue;
      const a = path[i], b = path[i + 1];
      const ax = grid.cx(a.x), ay = grid.cy(a.y);
      const bx = grid.cx(b.x), by = grid.cy(b.y);
      const ang = Math.atan2(by - ay, bx - ax);
      const mx = ax + (bx - ax) * 0.5, my = ay + (by - ay) * 0.5;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-5, -5); ctx.lineTo(4, 0); ctx.lineTo(-5, 5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Chemin aérien : courbe fixe, pointillés bleus flottants. */
  _drawAirPath(ctx, game, t) {
    const grid = game.grid;
    const pts = grid.airPath;
    ctx.save();

    ctx.strokeStyle = PALETTE.air;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Balises lumineuses qui remontent le couloir
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = PALETTE.air;
    for (let k = 0; k < 4; k++) {
      const d = ((t * 130 + k * grid.airLength / 4) % grid.airLength);
      const p = grid.airAt(d);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawSpawn(ctx, game, t) {
    const g = game.grid;
    ctx.save();
    for (const s of g.spawns || [g.spawn]) {
      const x = g.cx(s.x), y = g.cy(s.y);
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.7 + i / 3) % 1);
        ctx.globalAlpha = (1 - p) * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 6 + p * 26, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(x - 7, y - 7, 14, 14);
      ctx.strokeStyle = PALETTE.line;
      ctx.strokeRect(x - 7, y - 7, 14, 14);
    }
    ctx.restore();
  }

  _drawBase(ctx, game, t) {
    const g = game.grid;
    const x = g.cx(g.base.x), y = g.cy(g.base.y);
    const hurt = game.baseHitFlash || 0;
    ctx.save();

    // Anneaux de protection
    ctx.strokeStyle = hurt > 0 ? PALETTE.danger : PALETTE.gold;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      ctx.globalAlpha = 0.28 + Math.sin(t * 3 + i) * 0.12;
      ctx.beginPath();
      ctx.arc(x, y, 22 + i * 9 + Math.sin(t * 2 + i) * 3, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Noyau
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.6);
    ctx.fillStyle = hurt > 0 ? PALETTE.danger : PALETTE.gold;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 15, Math.sin(a) * 15);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = PALETTE.bg;
    ctx.beginPath(); ctx.arc(x, y, 6 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.fill();

    if (hurt > 0) {
      ctx.globalAlpha = hurt;
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, 30 + (1 - hurt) * 40, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ----------------------------------------------------------
  //  Post-traitement
  // ----------------------------------------------------------
  _post(ctx, game, t) {
    const vfx = game.vfx;

    // Aberration chromatique
    if (vfx.chroma > 0.4) {
      const fx = this.fxCanvas;
      if (fx.width !== this.canvas.width) {
        fx.width = this.canvas.width;
        fx.height = this.canvas.height;
      }
      this.fxCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.fxCtx.clearRect(0, 0, fx.width, fx.height);
      this.fxCtx.drawImage(this.canvas, 0, 0);

      const o = vfx.chroma;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.32;
      ctx.drawImage(fx, -o, 0, GRID.w, GRID.h);
      ctx.drawImage(fx, o, 0, GRID.w, GRID.h);
      ctx.restore();
    }

    // Flash plein écran
    if (vfx.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.65, vfx.flash);
      ctx.fillStyle = vfx.flashColor;
      ctx.fillRect(0, 0, GRID.w, GRID.h);
      ctx.restore();
    }

    // Grain animé
    this.noiseOffset = (this.noiseOffset + 7) % 128;
    ctx.save();
    ctx.globalAlpha = 0.045;
    const pat = ctx.createPattern(this.noise, 'repeat');
    ctx.translate(-this.noiseOffset, this.noiseOffset * 0.5);
    ctx.fillStyle = pat;
    ctx.fillRect(0, -64, GRID.w + 128, GRID.h + 128);
    ctx.restore();

    // Scanlines
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#000';
    for (let y = 0; y < GRID.h; y += 3) ctx.fillRect(0, y, GRID.w, 1);
    ctx.restore();

    // Vignette
    const vg = ctx.createRadialGradient(GRID.w / 2, GRID.h / 2, GRID.h * 0.35, GRID.w / 2, GRID.h / 2, GRID.w * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, GRID.w, GRID.h);

    // Cadre néo-brutaliste
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, GRID.w - 2, GRID.h - 2);

    // Alerte vie basse
    if (game.lives > 0 && game.lives <= 3 && game.state === 'GAME') {
      ctx.save();
      ctx.globalAlpha = 0.10 + Math.sin(t * 7) * 0.07;
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, GRID.w - 14, GRID.h - 14);
      ctx.restore();
    }
  }
}
