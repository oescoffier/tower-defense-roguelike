// ============================================================
//  MAIN — machine à états, boucle de jeu à pas fixe, entrées.
// ============================================================

import {
  STATE, GRID, ECONOMY, WAVE, TOWERS, TOWER_ORDER, COMMANDERS, COMMANDER_RANK_KILLS, PALETTE, TARGET,
  VARIANT_ORDER, VARIANT_BY_ID, materialsForWave
} from './config.js';
import { Grid } from './grid.js';
import { Enemy } from './enemies.js';
import { Tower, towerCost } from './towers.js';
import { Vfx } from './vfx.js';
import { Renderer } from './render.js';
import { buildWave, waveSummary, WaveRunner } from './waves.js';
import { chainReaction, teslaStorm, explode, hit, enemiesInRange, canHit } from './combat.js';
import { buildTree, computeMods, branchSummary, TreeView } from './skilltree.js';
import { Tutorial, TUTORIAL_MAP, TUTORIAL_REWARD } from './tutorial.js';
import { Save } from './save.js';
import * as UI from './ui.js';
import { A, $, $$ } from './ui.js';

const STEP = 1 / 60;

// ============================================================
//  État global
// ============================================================

const save = new Save();
const tree = buildTree();

const game = {
  state: STATE.BOOT,
  time: 0,
  wave: 0,
  gold: 0,
  lives: 0,
  maxLives: 0,
  kills: 0,
  towersBuilt: 0,
  runTime: 0,
  speed: 1,
  paused: false,

  grid: null,
  towers: [],
  enemies: [],
  projectiles: [],
  vfx: new Vfx(),
  mods: {},
  commanderChoice: null,

  waveRunner: null,
  waveRunning: false,
  waveData: null,
  autoWave: false,       // enchaînement automatique des vagues
  autoLeft: 0,           // répit restant avant la vague suivante
  stormTimer: 0,
  baseHitFlash: 0,
  freeTypes: new Set(),

  placing: null,
  hover: null,
  hoverTower: null,
  placeValid: false,
  placeReason: '',
  selected: null,

  chainBlastMult: 0.6,

  // --- Tutoriel ---
  tutorial: null,          // instance Tutorial quand le mode entraînement est actif
  allowedTowers: null,     // Set des tours autorisées (null = toutes)
  tutorialCell: null,      // case mise en avant sur la grille
  tutorialRequireCell: false,

  spend(n) { this.gold = Math.max(0, this.gold - n); },

  /** Notifie le tutoriel d'un fait de jeu. Sans effet en partie normale. */
  emit(event, payload) {
    if (this.tutorial) this.tutorial.handle(event, payload);
  },

  // --------------------------------------------------------
  onEnemyKilled(e, opts) {
    this.kills++;
    this.vfx.death(e);

    let gain = Math.round(e.gold * (1 + (this.mods['player.goldPerKill'] || 0)));
    if (e.boss && this.mods['player.bossBounty']) {
      gain = Math.round(gain * (1 + this.mods['player.bossBounty']));
    }
    // BUTIN DE GUERRE : prime sur la première élimination de chaque vague.
    if (!this.firstKillDone && this.mods['player.firstBlood']) {
      this.firstKillDone = true;
      const bonus = Math.round(this.mods['player.firstBlood']);
      gain += bonus;
      this.vfx.floatText(e.x, e.y - 34, `PREMIER SANG +${bonus}`, PALETTE.gold, 15, 1.1);
    }
    this.gold += gain;
    this.vfx.coin(e.x, e.y, GRID.w * 0.42, -30);

    if (opts && opts.source) {
      opts.source.kills++;
    }

    // Combustion (keystone lance-flamme) : mourir en brûlant fait exploser
    if (this.mods['flame.combust'] && e.burning) {
      import('./combat.js').then(({ explode }) => {
        explode(this, e.x, e.y, GRID.cell * 1.5, e.maxHp * 0.25, {
          mask: TARGET.BOTH, color: PALETTE.fire, power: 0.9
        });
      });
    }

    // Réaction en chaîne Tesla
    if (e.charged > 0 && e.chargedDmg > 0) chainReaction(this, e);

    // Scindeur
    if (e.def.splitInto) {
      for (let i = 0; i < e.def.splitCount; i++) {
        const child = new Enemy(e.def.splitInto, this.grid, {
          hpMult: this.waveData ? this.waveData.hpMult : 1,
          speedMult: this.waveData ? this.waveData.speedMult : 1
        });
        child.x = e.x + (i - 0.5) * 14;
        child.y = e.y + (Math.random() - 0.5) * 14;
        child.spawnAnim = 0.5;
        child._pickTarget();
        this.enemies.push(child);
      }
      this.vfx.floatText(e.x, e.y - 24, 'SCINDÉ', PALETTE.violet, 14, 0.8);
    }

    if (e.boss) UI.toast(`<b>${e.name} ABATTU</b><br>+${gain} crédits`, 'good', 3200);

    applyCommanderOnKill(e, opts, this);
    checkCommanderRankUp();
  },

  onEnemyLeaked(e) {
    // BOUCLIER DE SECTEUR : la première brèche de chaque vague est absorbée.
    if (!this.leakShieldUsed && this.mods['player.leakShield']) {
      this.leakShieldUsed = true;
      const b0 = this.grid;
      this.vfx.ring(b0.cx(b0.base.x), b0.cy(b0.base.y), 8, 110, 0.6, PALETTE.accent, 5);
      this.vfx.floatText(b0.cx(b0.base.x), b0.cy(b0.base.y) - 34, 'ABSORBÉ', PALETTE.accent, 20, 1.2);
      UI.toast('<b>BOUCLIER DE SECTEUR</b><br>Brèche absorbée sans dégât', 'good', 2400);
      return;
    }
    this.lives -= e.leak;
    this.baseHitFlash = 1;
    this.vfx.addShake(5);
    this.vfx.addFlash(0.3, PALETTE.danger);
    this.vfx.addChroma(6);
    const b = this.grid;
    this.vfx.ring(b.cx(b.base.x), b.cy(b.base.y), 6, 90, 0.5, PALETTE.danger, 5);
    this.vfx.floatText(b.cx(b.base.x), b.cy(b.base.y) - 34, `-${e.leak}`, PALETTE.danger, 22, 1.2);
    UI.toast(`<b>BRÈCHE</b><br>${e.name} a franchi la ligne · −${e.leak} intégrité`, 'bad', 2600);
    this.applySurvivor();
    if (this.lives <= 0) { this.lives = 0; endRun(); }
  },

  applySurvivor() {
    const want = (this.mods['player.survivor'] && this.lives <= 1) ? 0.4 : 0;
    if (this.mods.__survivorBonus === want) return;
    this.mods.__survivorBonus = want;
    for (const t of this.towers) t.recompute(this.mods);
    if (want > 0) UI.toast('<b>SURVIVANT</b><br>+40% dégâts sur toutes les tours', 'warn', 3000);
  }
};

let renderer = null;
let treeView = null;
let activeBranch = -1;

// ============================================================
//  Cycle de partie
// ============================================================

/**
 * Variante POSTE DE COMMANDEMENT : toutes les N vagues, chaque tour de ce
 * type rend de l'intégrité et verse une prime. C'est la seule tour du jeu
 * dont l'intérêt n'est pas de faire des dégâts.
 */
function applySupportTowers() {
  const supports = game.towers.filter((t) => t.variantFlags && t.variantFlags.support);
  if (!supports.length) return;

  for (const t of supports) {
    const v = t.variant;
    const every = v.supportEvery || 3;
    if (game.wave % every !== 0) continue;

    const gold = Math.round((v.supportGoldBase || 45) + (v.supportGoldPerWave || 8) * game.wave);
    game.gold += gold;
    let healed = 0;
    if (game.lives < game.maxLives) {
      healed = Math.min(v.supportLives || 1, game.maxLives - game.lives);
      game.lives += healed;
    }

    game.vfx.ring(t.px, t.py, 6, 90, 0.6, PALETTE.ok, 4);
    game.vfx.floatText(t.px, t.py - 30, `+${gold}${healed ? ` · +${healed} PV` : ''}`, PALETTE.ok, 17, 1.3);
    UI.toast(
      `<b>POSTE DE COMMANDEMENT</b><br>+${gold} crédits${healed ? ` · +${healed} intégrité` : ''}`,
      'good', 2800
    );
  }
}

function startRun(opts = {}) {
  const tuto = !!opts.tutorial;

  // L'entraînement se joue sur une base neutre : aucun bonus d'arbre ni
  // commandant, pour que ce qu'on montre corresponde exactement au texte.
  game.mods = tuto ? Object.create(null) : computeMods(tree, save.unlocked);
  game.mods.__survivorBonus = 0;

  game.grid = tuto
    ? new Grid(0, TUTORIAL_MAP)
    : new Grid((Math.random() * 0xffffff) | 0);
  game.towers = [];
  game.enemies = [];
  game.projectiles = [];
  game.vfx.clear();
  // Le commandant choisi dans le menu est figé pour toute la durée de la partie.
  game.commanderChoice = tuto ? null : save.commander;

  game.maxLives = tuto ? 20 : ECONOMY.startLives + Math.floor(game.mods['player.lives'] || 0);
  game.lives = game.maxLives;
  // En entraînement, chaque étape verse exactement ce qu'elle demande.
  game.gold = tuto ? 0 : ECONOMY.startGold + Math.round(game.mods['player.startGold'] || 0);
  game.wave = 0;
  game.kills = 0;
  game.towersBuilt = 0;
  game.runTime = 0;
  game.time = 0;
  game.speed = 1;
  game.paused = false;
  game.waveRunning = false;
  game.waveRunner = null;
  game.selected = null;
  game.placing = null;
  game.hover = null;
  game.stormTimer = 0;
  game.freeTypes = new Set();
  game.chainBlastMult = 0.6 + (game.mods['tesla.chainBlast'] || 0);
  // Variantes retenues pour cette partie (aucune pendant l'entraînement).
  // On filtre : une variante non débloquée dans l'arbre ne doit pas
  // s'appliquer, même si elle traîne encore dans la sauvegarde.
  game.loadout = tuto ? {} : activeLoadout();
  game.regenPool = 0;
  game.firstKillDone = false;
  game.leakShieldUsed = false;
  // Aucun compte à rebours : le joueur lance la première vague quand il veut.
  game.autoWave = tuto ? false : save.autoWave;
  game.autoLeft = 0;

  // Réinitialise l'état de tutoriel avant de (ré)armer le mode.
  game.tutorial = null;
  game.allowedTowers = null;
  game.tutorialCell = null;
  game.tutorialRequireCell = false;

  UI.resetHudCache();
  UI.buildShop(game, pickTower);

  if (tuto) startTutorial();

  UI.refreshShop(game);
  UI.refreshHud(game);
  UI.renderTowerPanel(game, null);
  prepareNextWave();
  UI.setWaveButton(game);
  $('#pause-overlay').hidden = true;
  $('#tuto-coach').hidden = !tuto;
  $('#btn-auto-wave').hidden = tuto;
  $('#btn-auto-wave').classList.toggle('on', game.autoWave);
  $$('.speed-btns button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === 1));

  game.state = STATE.GAME;
}

function prepareNextWave() {
  game.waveData = game.tutorial ? game.tutorial.waveFor() : buildWave(game.wave + 1);
  UI.renderWaveComp(game.waveData, waveSummary(game.waveData));
}

function startWave() {
  if (game.waveRunning) return;
  // En entraînement, la vague n'est disponible que quand l'étape l'attend.
  if (game.tutorial && !game.tutorial.canStartWave()) return;
  game.wave++;
  game.waveData = game.tutorial ? game.tutorial.waveFor() : buildWave(game.wave);
  game.waveRunner = new WaveRunner(game.waveData);
  game.waveRunning = true;
  game.autoLeft = 0;

  game.firstKillDone = false;
  game.leakShieldUsed = false;
  for (const t of game.towers) t.onWaveStart(game);

  // Keystone DCA : barrage automatique sur les vagues aériennes
  if (game.mods['aa.barrage'] && game.waveData.airRatio > 0) {
    for (const t of game.towers) if (t.archetype === 'aa') t.cooldown = 0;
  }

  const sum = waveSummary(game.waveData);
  UI.renderWaveComp(game.waveData, sum);
  const airCount = sum.filter((s) => s.air).reduce((a, s) => a + s.n, 0);
  const sub = game.waveData.hasBoss
    ? 'MENACE MAJEURE DÉTECTÉE'
    : `${game.waveData.spawns.length} HOSTILES · ${airCount} AÉRIENS`;
  UI.showWaveBanner(game.wave, sub, game.waveData.hasBoss);
  UI.setWaveButton(game);
  game.vfx.addFlash(0.14, PALETTE.accent);

  if (game.waveData.hasBoss) {
    UI.toast('<b>ALERTE BOSS</b><br>Unité lourde en approche', 'bad', 3600);
  }
}

function completeWave() {
  game.waveRunning = false;
  game.waveRunner = null;

  // L'entraînement gère lui-même sa progression : ni prime, ni vague suivante.
  if (game.tutorial) {
    UI.setWaveButton(game);
    UI.refreshShop(game);
    game.emit('wave-cleared', { wave: game.wave });
    return;
  }

  const bonusMult = 1 + (game.mods['player.waveBonus'] || 0);
  const bonus = Math.round((ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave * game.wave) * bonusMult);
  const interest = Math.round(game.gold * (game.mods['player.interest'] || 0));
  game.gold += bonus + interest;

  // GÉNIE MILITAIRE : régénération lente de l'intégrité.
  if (game.mods['player.regen']) {
    game.regenPool = (game.regenPool || 0) + game.mods['player.regen'];
    while (game.regenPool >= 1 && game.lives < game.maxLives) {
      game.regenPool -= 1;
      game.lives++;
      UI.toast('<b>GÉNIE MILITAIRE</b><br>+1 intégrité réparée', 'good', 2200);
    }
  }

  // Variante POSTE DE COMMANDEMENT du sniper : soutien périodique.
  applySupportTowers();

  // Keystone commandant : +1 vie toutes les 5 vagues
  if (game.mods['player.command'] && game.wave % 5 === 0) {
    game.maxLives++;
    game.lives++;
    UI.toast('<b>COMMANDEMENT</b><br>+1 intégrité maximale', 'good');
  }
  game.applySurvivor();

  const b = game.grid;
  game.vfx.floatText(b.cx(b.base.x), b.cy(b.base.y) - 40, `+${bonus + interest}`, PALETTE.gold, 20, 1.4);
  UI.toast(
    `<b>VAGUE ${game.wave} REPOUSSÉE</b><br>+${bonus} crédits${interest ? ` · +${interest} intérêts` : ''}`,
    'good', 2800
  );

  prepareNextWave();
  game.autoLeft = WAVE.autoWaveGap;
  UI.setWaveButton(game);
  UI.refreshShop(game);
}

function endRun() {
  if (game.state !== STATE.GAME) return;

  // L'entraînement ne compte pas comme une partie : pas de score, pas de stats.
  if (game.tutorial) { quitTutorial(); return; }

  game.state = STATE.OVER;
  game.waveRunning = false;

  const matMult = 1 + (game.mods['player.materials'] || 0);
  const materials = Math.round(materialsForWave(game.wave) * matMult);

  const stats = {
    wave: game.wave,
    kills: game.kills,
    materials,
    gold: game.gold,
    towersBuilt: game.towersBuilt,
    duration: game.runTime
  };

  UI.renderGameOver(stats, save);
  save.addMaterials(materials);
  save.recordRun(stats);

  game.vfx.addFlash(0.6, PALETTE.danger);
  setTimeout(() => UI.showScreen('screen-over'), 520);
}

// ============================================================
//  Pas de simulation
// ============================================================

function step(dt) {
  game.time += dt;
  game.runTime += dt;
  if (game.baseHitFlash > 0) game.baseHitFlash = Math.max(0, game.baseHitFlash - dt * 1.6);
  if (game.grid.pathAge < 1) game.grid.pathAge = Math.min(1, game.grid.pathAge + dt * 1.5);

  // Vagues automatiques : enchaîne après un court répit, sur demande du joueur.
  if (game.autoWave && !game.waveRunning && !game.tutorial) {
    game.autoLeft -= dt;
    UI.setWaveButton(game);
    if (game.autoLeft <= 0) startWave();
  }

  // Apparitions
  if (game.waveRunner) {
    const spawns = game.waveRunner.update(dt);
    if (spawns) {
      for (const s of spawns) {
        const e = new Enemy(s.type, game.grid, {
          hpMult: game.waveData.hpMult,
          speedMult: game.waveData.speedMult,
          goldMult: 1 + game.wave * 0.02
        });
        game.enemies.push(e);
        if (e.boss) {
          game.vfx.ring(e.x, e.y, 6, 120, 0.7, PALETTE.danger, 5);
          game.vfx.addShake(4);
        }
      }
    }
    $('#wave-progress-bar').style.width = (game.waveRunner.progress * 100).toFixed(1) + '%';
  }

  // Orage Tesla (keystone)
  if (game.mods['tesla.storm'] && game.waveRunning) {
    game.stormTimer -= dt;
    if (game.stormTimer <= 0) { game.stormTimer = 6; teslaStorm(game); }
  }

  // Aptitudes de commandant : aura de zone continue + pulsation périodique
  applyCommanderFieldEffects(dt, game);
  updateCommanderPulse(dt, game);

  // Ennemis
  for (const e of game.enemies) e.update(dt, game);
  for (let i = game.enemies.length - 1; i >= 0; i--) {
    if (game.enemies[i].dead) game.enemies.splice(i, 1);
  }

  // Tours
  for (const t of game.towers) t.update(dt, game);

  // Projectiles
  for (const p of game.projectiles) p.update(dt, game);
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    if (game.projectiles[i].dead) game.projectiles.splice(i, 1);
  }

  // Cratères persistants du mortier
  for (const t of game.towers) {
    if (t.archetype !== 'mortar' || !t.craters.length) continue;
    const boost = 1 + (game.mods['mortar.craterDps'] || 0);
    const baseDps = t.stats.damage * 0.18 * boost;
    for (const c of t.craters) {
      // Une zone irradiée (ogive nucléaire) porte ses propres dégâts.
      const dps = (c.dps !== undefined ? c.dps : baseDps) * (c.dps !== undefined ? boost : 1);
      for (const e of game.enemies) {
        if (e.dead || e.air) continue;
        if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 <= c.r * c.r) {
          e.damage(dps * dt, { type: 'burn', silent: true }, game);
        }
      }
    }
  }

  game.vfx.update(dt);

  // Fin de vague
  if (game.waveRunning && game.waveRunner && game.waveRunner.done && game.enemies.length === 0) {
    completeWave();
  }
}

// ============================================================
//  Boucle principale
// ============================================================

let last = performance.now();
let acc = 0;
let hudTimer = 0;

function frame(now) {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (game.state === STATE.GAME && !game.paused) {
    let mult = game.speed;
    if (game.vfx.slowmo > 0) mult *= 0.35;
    acc += raw * mult;
    let guard = 0;
    while (acc >= STEP && guard++ < 12) { step(STEP); acc -= STEP; }
    if (acc > 0.5) acc = 0;

    renderer.draw(game);

    hudTimer += raw;
    if (hudTimer > 0.1) {
      hudTimer = 0;
      UI.refreshHud(game);
      UI.refreshShop(game);
      if (game.selected) UI.renderTowerPanel(game, game.selected);
    }
  } else if (game.state === STATE.GAME && game.paused) {
    renderer.draw(game);
  } else if (game.state === STATE.TREE && treeView) {
    treeView.draw(raw);
  }

  requestAnimationFrame(frame);
}

// ============================================================
//  Entrées — jeu
// ============================================================

function pickTower(id) {
  // Pendant l'entraînement, seules les tours de l'étape sont sélectionnables.
  if (game.allowedTowers && !game.allowedTowers.has(id)) return;
  if (game.placing === id) { game.placing = null; }
  else {
    game.placing = id;
    game.selected = null;
    UI.renderTowerPanel(game, null);
  }
  UI.refreshShop(game);
  updatePlaceValidity();
}

function canvasCell(ev) {
  const c = $('#game-canvas');
  const r = c.getBoundingClientRect();
  const sx = (ev.clientX - r.left) / r.width * GRID.w;
  const sy = (ev.clientY - r.top) / r.height * GRID.h;
  const cell = game.grid.cellAt(sx, sy);
  if (!game.grid.inBounds(cell.x, cell.y)) return null;
  return cell;
}

/** Une seule tour commandant peut être déployée à la fois. */
function hasCommanderDeployed() {
  return game.towers.some((t) => t.isCommander);
}

function deployedCommander() {
  return game.towers.find((t) => t.isCommander) || null;
}

// ============================================================
//  Aptitudes de commandant — mécaniques propres, introuvables dans
//  l'arbre de compétences (auras spatiales, pulsations, déclencheurs
//  sur élimination). Voir COMMANDERS[*].ability dans config.js.
// ============================================================

/**
 * Aura passive (type 'aura') : buff continu aux tours à portée d'un
 * commandant, QUEL QUE SOIT LEUR ARCHÉTYPE — une zone spatiale autour
 * d'une tour posée, ce que l'arbre ne fait jamais. N'a besoin d'être
 * recalculée que quand la topologie change (pose/vente/rang), jamais
 * chaque frame : les tours ne bougent pas.
 */
function applyCommanderTowerAura(game) {
  const cmdr = deployedCommander();
  const ab = cmdr && cmdr.def.ability;
  const active = ab && ab.type === 'aura' && ab.target === 'towers';

  for (const t of game.towers) {
    t.auraMult.damage = 1; t.auraMult.rate = 1; t.auraMult.range = 1;
    if (!active || t === cmdr) continue;
    const d = Math.hypot(t.px - cmdr.px, t.py - cmdr.py);
    if (d <= ab.radius * GRID.cell) {
      t.auraMult[ab.stat] = 1 + ab.value * (cmdr.rankMult || 1);
    }
  }
  for (const t of game.towers) t.recompute(game.mods);
}

/**
 * Aura de zone (type 'auraDebuff') : effet continu sur les ennemis au sol
 * à portée d'un commandant. Contrairement à l'aura sur les tours, la
 * cible bouge : on la réévalue chaque frame, tant qu'une vague tourne.
 */
function applyCommanderFieldEffects(dt, game) {
  const cmdr = deployedCommander();
  const ab = cmdr && cmdr.def.ability;
  if (!ab || ab.type !== 'auraDebuff' || !game.waveRunning) return;

  const r2 = (ab.radius * GRID.cell) ** 2;
  const mult = cmdr.rankMult || 1;
  for (const e of game.enemies) {
    if (e.dead || e.air) continue;
    const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
    if (dx * dx + dy * dy > r2) continue;
    if (ab.kind === 'slow') e.applySlow(ab.value, 0.4, game);
    else if (ab.kind === 'burn') e.applyBurn(ab.value * mult, 0.4, 6, game, 0);
  }
}

/**
 * Pulsation périodique (type 'pulse') : se déclenche toutes les
 * `interval` secondes tant qu'une vague tourne. Le minuteur vit sur la
 * tour commandant elle-même (`pulseTimer`).
 */
function updateCommanderPulse(dt, game) {
  const cmdr = deployedCommander();
  const ab = cmdr && cmdr.def.ability;
  if (!ab || ab.type !== 'pulse' || !game.waveRunning) return;

  if (cmdr.pulseTimer === undefined) cmdr.pulseTimer = ab.interval;
  cmdr.pulseTimer -= dt;
  if (cmdr.pulseTimer > 0) return;
  cmdr.pulseTimer = ab.interval;
  fireCommanderPulse(cmdr, ab, game);
}

function fireCommanderPulse(cmdr, ab, game) {
  const mult = cmdr.rankMult || 1;

  switch (ab.kind) {
    case 'nova': {
      let pos = { x: cmdr.px, y: cmdr.py };
      if (!ab.selfCentered) {
        const maxD2 = ab.rangeLimited ? cmdr.rangePx * cmdr.rangePx : Infinity;
        let best = null, bestHp = -1;
        for (const e of game.enemies) {
          if (e.dead || !canHit(e, ab.targetMask)) continue;
          const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
          if (dx * dx + dy * dy > maxD2) continue;
          const hp = e.hp + e.shield;
          if (hp > bestHp) { bestHp = hp; best = e; }
        }
        if (!best) return; // rien à frapper : pas de coup dans le vide
        pos = { x: best.x, y: best.y };
      }
      explode(game, pos.x, pos.y, ab.radius * GRID.cell, ab.damage * mult, {
        mask: ab.targetMask, color: cmdr.def.accent, power: 1.2, source: cmdr, type: 'commander'
      });
      break;
    }
    case 'execute': {
      let worst = null, worstRatio = ab.threshold;
      for (const e of game.enemies) {
        if (e.dead || e.boss) continue;
        if (e.hpRatio < worstRatio) { worstRatio = e.hpRatio; worst = e; }
      }
      if (!worst) return;
      game.vfx.floatText(worst.x, worst.y - worst.radius - 6, 'EXÉCUTÉ', cmdr.def.accent, 14, 0.9);
      hit(cmdr, worst, game, worst.hp + worst.shield + 9999, { ignoreArmor: true, type: 'commander' });
      break;
    }
    case 'overcharge': {
      let best = null, bestHp = -1;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const hp = e.hp + e.shield;
        if (hp > bestHp) { bestHp = hp; best = e; }
      }
      if (!best) return;
      best.commanderMarkUntil = game.time + ab.dur;
      best.commanderMarkBonus = ab.value;
      game.vfx.ring(best.x, best.y, 4, best.radius * 2.4, 0.5, cmdr.def.accent, 4);
      game.vfx.floatText(best.x, best.y - best.radius - 6, 'MARQUÉ', cmdr.def.accent, 14, ab.dur * 0.6);
      break;
    }
    case 'freeze': {
      const r2 = (ab.radius * GRID.cell) ** 2;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
        if (dx * dx + dy * dy <= r2) e.applyStun(ab.dur, game);
      }
      game.vfx.ring(cmdr.px, cmdr.py, 4, ab.radius * GRID.cell, 0.45, cmdr.def.accent, 5);
      game.vfx.addShake(1.5);
      break;
    }
    case 'emp': {
      let hitAny = false;
      for (const e of game.enemies) {
        if (e.dead || !e.maxShield || e.shield <= 0) continue;
        e.shield = 0;
        hitAny = true;
      }
      if (hitAny) game.vfx.addFlash(0.25, cmdr.def.accent);
      break;
    }
  }
}

/**
 * Déclencheur sur élimination (type 'onKill') : se déclenche à CHAQUE
 * élimination, par n'importe quelle tour, tant que le commandant est
 * déployé. Le garde-fou sur opts.type évite qu'une étincelle déclenchée
 * par ce système ne se redéclenche elle-même en cascade infinie.
 */
function applyCommanderOnKill(e, opts, game) {
  const cmdr = deployedCommander();
  const ab = cmdr && cmdr.def.ability;
  if (!ab || ab.type !== 'onKill') return;
  if (opts && opts.type === 'commander-spark') return;

  if (ab.kind === 'goldBonus') {
    game.gold += ab.value;
    game.vfx.floatText(e.x, e.y - e.radius - 6, `+${ab.value}`, cmdr.def.accent, 12, 0.6);
  } else if (ab.kind === 'healChance') {
    if (Math.random() < ab.chance && game.lives < game.maxLives) {
      game.lives++;
      game.vfx.floatText(cmdr.px, cmdr.py - 24, '+1', PALETTE.ok, 15, 0.9);
      UI.refreshHud(game);
    }
  } else if (ab.kind === 'chainSpark') {
    if (Math.random() >= ab.chance) return;
    const near = enemiesInRange(game, e.x, e.y, ab.radius * GRID.cell, TARGET.BOTH).filter((o) => !o.dead && o !== e);
    if (!near.length) return;
    const target = near[Math.floor(Math.random() * near.length)];
    game.vfx.lightning(e.x, e.y, target.x, target.y, cmdr.def.accent, 0.16, 8);
    hit(cmdr, target, game, ab.damage * (cmdr.rankMult || 1), { type: 'commander-spark' });
  }
}

/**
 * Un commandant monte en rang (gros palier, jusqu'à 3) à mesure que
 * N'IMPORTE QUELLE tour élimine des ennemis pendant qu'il est sur le
 * terrain. Chaque rang le rend plus fort ET renforce son aptitude
 * d'autant (aura recalculée ; pulsation/déclencheur lisent rankMult
 * directement au moment où ils se déclenchent).
 */
function checkCommanderRankUp() {
  const cmdr = deployedCommander();
  if (!cmdr || cmdr.level >= COMMANDER_RANK_KILLS.length) return;
  const earned = game.kills - cmdr.killsAtPlacement;
  if (earned < COMMANDER_RANK_KILLS[cmdr.level]) return;

  cmdr.level++;
  cmdr.rankMult = 1 + cmdr.level * 0.5;
  cmdr.recompute(game.mods);
  applyCommanderTowerAura(game);

  cmdr.placeAnim = 0;
  game.vfx.towerPlaced(cmdr.px, cmdr.py, PALETTE.gold);
  game.vfx.floatText(cmdr.px, cmdr.py - 32, `RANG ${cmdr.level}`, PALETTE.gold, 20, 1.4);
  UI.toast(
    `<b>${cmdr.def.name} MONTE EN RANG</b><br>Rang ${cmdr.level}/${COMMANDER_RANK_KILLS.length} — lui et son aptitude sont renforcés`,
    'good', 3400
  );
  UI.refreshHud(game);
}

/** Case imposée par l'étape de tutoriel en cours (null si libre). */
function tutorialCellBlocks(x, y) {
  if (!game.tutorialRequireCell || !game.tutorialCell) return false;
  return game.tutorialCell.x !== x || game.tutorialCell.y !== y;
}

function updatePlaceValidity() {
  if (!game.placing || !game.hover) { game.placeValid = false; return; }
  if (tutorialCellBlocks(game.hover.x, game.hover.y)) {
    game.placeValid = false;
    game.placeReason = 'CASE INDIQUÉE';
    return;
  }
  const cost = towerCost(game.placing, game.mods);
  const free = !COMMANDERS[game.placing] && game.mods['player.war'] && !game.freeTypes.has(game.placing);
  if (COMMANDERS[game.placing] && hasCommanderDeployed()) {
    game.placeValid = false;
    game.placeReason = 'COMMANDANT DÉJÀ DÉPLOYÉ';
    return;
  }
  const res = game.grid.canPlace(game.hover.x, game.hover.y, game.enemies);
  game.placeValid = res.ok && (free || game.gold >= cost);
  game.placeReason = res.ok ? (free || game.gold >= cost ? '' : 'CRÉDITS INSUFFISANTS') : res.reason;
}

function tryPlace() {
  if (!game.placing || !game.hover) return;
  const { x, y } = game.hover;
  const id = game.placing;

  // Le scénario impose la case : on refuse ailleurs sans consommer de crédits.
  if (tutorialCellBlocks(x, y)) {
    refusePlacement(x, y, 'POSE-LA SUR LA CASE INDIQUÉE');
    return;
  }

  const cost = towerCost(id, game.mods);
  const free = !COMMANDERS[id] && game.mods['player.war'] && !game.freeTypes.has(id);

  if (COMMANDERS[id] && hasCommanderDeployed()) {
    refusePlacement(x, y, 'COMMANDANT DÉJÀ DÉPLOYÉ');
    return;
  }

  const res = game.grid.canPlace(x, y, game.enemies);
  if (!res.ok) {
    refusePlacement(x, y, res.reason);
    return;
  }
  if (!free && game.gold < cost) {
    refusePlacement(x, y, 'CRÉDITS INSUFFISANTS');
    return;
  }

  const tower = new Tower(id, x, y, game);
  if (free) {
    game.freeTypes.add(id);
    tower.invested = 0;
    UI.toast('<b>ÉCONOMIE DE GUERRE</b><br>Première ' + TOWERS[id].name + ' offerte', 'good');
  } else {
    game.spend(cost);
  }

  game.towers.push(tower);
  game.towersBuilt++;
  game.grid.place(x, y, tower);
  for (const e of game.enemies) e.repath();

  if (tower.isCommander) {
    tower.killsAtPlacement = game.kills;
    tower.rankMult = 1;
    UI.toast(`<b>COMMANDANT DÉPLOYÉ</b><br>${tower.def.name} prend le terrain`, 'good', 3200);
  }
  // Une nouvelle tour (commandant ou non) peut entrer/sortir de l'aura d'un
  // commandant déjà posé : on recalcule à chaque pose, pas seulement la sienne.
  applyCommanderTowerAura(game);

  game.vfx.towerPlaced(tower.px, tower.py, tower.def.accent);
  UI.refreshShop(game);
  UI.refreshHud(game);
  updatePlaceValidity();

  game.emit('tower-placed', { tower, archetype: tower.archetype || id, id });
  game.emit('path-changed', {});
}

function refusePlacement(x, y, reason) {
  game.vfx.floatText(game.grid.cx(x), game.grid.cy(y) - 18, reason, PALETTE.danger, 15, 1);
  game.vfx.ring(game.grid.cx(x), game.grid.cy(y), 4, GRID.cell, 0.3, PALETTE.danger, 3);
  game.vfx.addShake(1.5);
  const stage = $('#stage');
  A({ targets: stage, translateX: [-7, 7, -4, 4, 0], duration: 240, easing: 'easeOutQuad' });
  game.emit('place-refused', { x, y, reason });
}

function selectTowerAt(x, y) {
  const t = game.grid.towerAt(x, y);
  game.selected = t || null;
  UI.renderTowerPanel(game, game.selected);
  if (t) A({ targets: '#tower-panel', scale: [0.96, 1], duration: 240, easing: 'easeOutBack' });
}

function sellSelected() {
  const t = game.selected;
  if (!t) return;
  game.gold += t.sellValue(game.mods);
  game.vfx.towerSold(t.px, t.py);
  game.grid.remove(t.gx, t.gy);
  game.towers.splice(game.towers.indexOf(t), 1);
  for (const e of game.enemies) e.repath();
  // Vendre la tour (commandant ou non) peut changer qui est dans l'aura,
  // ou faire disparaître le commandant lui-même : on recalcule dans tous les cas.
  applyCommanderTowerAura(game);
  game.selected = null;
  UI.renderTowerPanel(game, null);
  UI.refreshShop(game);
  UI.refreshHud(game);
}

function bindGameInputs() {
  const canvas = $('#game-canvas');

  canvas.addEventListener('mousemove', (ev) => {
    const cell = canvasCell(ev);
    game.hover = cell;
    game.hoverTower = cell ? game.grid.towerAt(cell.x, cell.y) : null;
    updatePlaceValidity();
  });

  canvas.addEventListener('mouseleave', () => {
    game.hover = null;
    game.hoverTower = null;
  });

  canvas.addEventListener('click', (ev) => {
    const cell = canvasCell(ev);
    if (!cell) return;
    game.hover = cell;
    if (game.placing) { updatePlaceValidity(); tryPlace(); }
    else selectTowerAt(cell.x, cell.y);
  });

  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (game.placing) { game.placing = null; UI.refreshShop(game); }
    else { game.selected = null; UI.renderTowerPanel(game, null); }
  });

  $('#btn-wave').addEventListener('click', startWave);

  $('#btn-pause').addEventListener('click', togglePause);

  $('#btn-auto-wave').addEventListener('click', () => {
    game.autoWave = !game.autoWave;
    save.setAutoWave(game.autoWave);
    game.autoLeft = game.autoWave ? WAVE.autoWaveGap : 0;
    $('#btn-auto-wave').classList.toggle('on', game.autoWave);
    UI.setWaveButton(game);
    UI.toast(game.autoWave
      ? '<b>VAGUES AUTOMATIQUES</b><br>La suivante part toute seule'
      : '<b>VAGUES MANUELLES</b><br>À toi de lancer', game.autoWave ? 'good' : 'warn', 2000);
  });

  const chkShake = $('#chk-shake');
  chkShake.checked = save.shakeEnabled;
  game.vfx.shakeMult = save.shakeEnabled ? 1 : 0;
  chkShake.addEventListener('change', () => {
    save.setShakeEnabled(chkShake.checked);
    game.vfx.shakeMult = chkShake.checked ? 1 : 0;
  });

  $('#speed-btns').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    game.speed = +b.dataset.speed;
    $$('.speed-btns button').forEach((x) => x.classList.toggle('on', x === b));
  });

  $('#btn-quit').addEventListener('click', () => {
    if (confirm('Abandonner la partie en cours ? Les matériaux de la vague atteinte seront conservés.')) {
      endRun();
    }
  });

  $('#tp-upgrade').addEventListener('click', () => {
    if (game.selected && game.selected.upgrade(game)) {
      UI.renderTowerPanel(game, game.selected);
      UI.refreshHud(game);
      game.emit('tower-upgraded', { tower: game.selected });
    }
  });

  $('#tp-sell').addEventListener('click', sellSelected);

  $('#tp-priority').addEventListener('click', () => {
    if (!game.selected) return;
    game.selected.cyclePriority();
    UI.renderTowerPanel(game, game.selected);
  });

  window.addEventListener('keydown', (ev) => {
    if (game.state !== STATE.GAME) return;
    const k = ev.key;
    if (k >= '1' && k <= '7') {
      pickTower(TOWER_ORDER[+k - 1]);
    } else if (k === 'Escape') {
      game.placing = null;
      game.selected = null;
      UI.refreshShop(game);
      UI.renderTowerPanel(game, null);
    } else if (k === ' ') {
      ev.preventDefault();
      togglePause();
    } else if (k === 'Enter') {
      startWave();
    } else if (k.toLowerCase() === 'v') {
      sellSelected();
    } else if (k.toLowerCase() === 'u') {
      if (game.selected && game.selected.upgrade(game)) UI.renderTowerPanel(game, game.selected);
    }
  });

  window.addEventListener('blur', () => {
    if (game.state === STATE.GAME && !game.paused) togglePause();
  });
}

function togglePause() {
  game.paused = !game.paused;
  $('#pause-overlay').hidden = !game.paused;
  $('#btn-pause').textContent = game.paused ? 'REPRENDRE' : 'PAUSE';
  if (game.paused) {
    A({ targets: '.pause-text', scale: [0.6, 1], opacity: [0, 1], duration: 420, easing: 'easeOutElastic' });
  }
}

// ============================================================
//  Tutoriel — pilotage du panneau de coaching
//
//  Le scénario n'affiche jamais une explication avant l'action :
//  l'étape pose une consigne courte, le joueur agit, et c'est
//  seulement une fois l'objectif atteint que le popup nomme la
//  mécanique qu'il vient de voir à l'écran.
// ============================================================

/** Met en évidence l'élément d'interface à cliquer (bouton de vague, etc.). */
function setTutorialTarget(selector) {
  $$('.tuto-target').forEach((el) => el.classList.remove('tuto-target'));
  if (!selector) return;
  const el = $(selector);
  if (!el) return;
  el.classList.add('tuto-target');
  // Le panneau latéral défile : un halo sur un bouton hors champ ne sert
  // à rien, on le ramène dans la vue.
  if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderTutorialStep(step, tuto) {
  const coach = $('#tuto-coach');
  coach.hidden = false;
  $('#tuto-step').textContent = `${tuto.stepNumber}/${tuto.total}`;
  $('#tuto-title').textContent = step.title;
  $('#tuto-text').innerHTML = step.text;

  const obj = $('#tuto-objective');
  if (step.objective) {
    // Sur les étapes en deux temps, l'objectif se met à jour en cours de route.
    const half = step.goal.type === 'placeThenWave' && tuto.placedThisStep;
    obj.textContent = half ? 'Lancer la vague' : step.objective;
    obj.classList.remove('met');
    obj.hidden = false;
  } else {
    obj.hidden = true;
  }

  const next = $('#tuto-next');
  next.hidden = step.goal.type !== 'info';
  if (step.goal.type === 'info') next.textContent = 'TERMINER ✓';

  setTutorialTarget(tuto.canStartWave() ? '#btn-wave' : step.highlight);

  coach.classList.remove('swap');
  void coach.offsetWidth;
  coach.classList.add('swap');

  UI.refreshShop(game);
  UI.setWaveButton(game);
}

/** Objectif atteint : on félicite, puis on livre l'explication. */
function onTutorialComplete(step, tuto) {
  const obj = $('#tuto-objective');
  obj.textContent = 'Objectif atteint';
  obj.classList.add('met');
  obj.hidden = false;
  setTutorialTarget(null);
  UI.refreshShop(game);
  UI.setWaveButton(game);

  game.vfx.addFlash(0.1, PALETTE.gold);

  if (!step.after) { tuto.next(); return; }

  // Petit temps mort pour laisser l'action se finir à l'écran.
  setTimeout(() => {
    if (!game.tutorial || game.tutorial !== tuto || tuto.finished) return;
    $('#tuto-title').textContent = step.after.title;
    $('#tuto-text').innerHTML = step.after.text;
    const next = $('#tuto-next');
    next.textContent = 'CONTINUER ▶';
    next.hidden = false;
    const coach = $('#tuto-coach');
    coach.classList.remove('swap');
    void coach.offsetWidth;
    coach.classList.add('swap');
    A({ targets: coach, scale: [0.98, 1], duration: 320, easing: 'easeOutBack' });
  }, 700);
}

function startTutorial() {
  game.tutorial = new Tutorial(game, {
    onStep: renderTutorialStep,
    onComplete: onTutorialComplete,
    onFinish: finishTutorial,
    onAbort: () => { $('#tuto-coach').hidden = true; setTutorialTarget(null); }
  });
  game.tutorial.start();
}

function finishTutorial() {
  $('#tuto-coach').hidden = true;
  setTutorialTarget(null);
  const first = save.markTutorialDone();
  if (first) save.addMaterials(TUTORIAL_REWARD);

  game.tutorial = null;
  game.state = STATE.MENU;
  UI.renderMenu(save, tree.nodes.length - 1);
  UI.showScreen('screen-menu').then(() => {
    if (first) {
      UI.toast(
        `<b>ENTRAÎNEMENT TERMINÉ</b><br>+${TUTORIAL_REWARD} matériaux — de quoi ouvrir tes premiers nœuds`,
        'good', 5000
      );
    }
  });
}

/** Abandon volontaire du tutoriel (bouton QUITTER ou ABANDONNER). */
function quitTutorial() {
  if (game.tutorial) game.tutorial.abort();
  game.tutorial = null;
  game.state = STATE.MENU;
  UI.renderMenu(save, tree.nodes.length - 1);
  UI.showScreen('screen-menu');
}

function bindTutorialInputs() {
  $('#btn-tutorial').addEventListener('click', launchTutorial);
  $('#help-start-tutorial').addEventListener('click', () => {
    closeHelp();
    launchTutorial();
  });
  $('#tuto-next').addEventListener('click', () => {
    if (game.tutorial) game.tutorial.advance();
  });
  $('#tuto-skip').addEventListener('click', () => {
    if (confirm('Quitter l\'entraînement ? Tu pourras le relancer depuis le menu.')) quitTutorial();
  });
}

function launchTutorial() {
  UI.showScreen('screen-game', {
    onSwap: () => { startRun({ tutorial: true }); requestAnimationFrame(fitStage); }
  });
}

// ============================================================
//  Modale d'aide — affichée automatiquement au tout premier
//  lancement, rouvrable à volonté depuis le menu ou en jeu.
// ============================================================

function openHelp() {
  $('#help-modal').hidden = false;
  if (game.state === STATE.GAME && !game.paused) togglePause();
}

function closeHelp() {
  $('#help-modal').hidden = true;
  save.markOnboardingSeen();
}

function bindHelpModal() {
  $('#btn-help').addEventListener('click', openHelp);
  $('#btn-help-game').addEventListener('click', openHelp);
  $('#help-close').addEventListener('click', closeHelp);
  $('#help-got-it').addEventListener('click', closeHelp);
  $('#help-backdrop').addEventListener('click', closeHelp);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('#help-modal').hidden) closeHelp();
  });
}

// ============================================================
//  Mise à l'échelle du plateau
// ============================================================

function fitStage() {
  const wrap = document.querySelector('.stage-wrap');
  const stage = $('#stage');
  if (!wrap || !stage) return;
  const availW = wrap.clientWidth;
  const availH = wrap.clientHeight - 46;
  if (availW <= 0 || availH <= 0) return;
  const k = Math.min(1, availW / (GRID.w + 6), availH / (GRID.h + 6));
  stage.style.transform = `scale(${k})`;
  stage.style.marginLeft = stage.style.marginRight = `${-(GRID.w * (1 - k)) / 2}px`;
  stage.style.marginTop = stage.style.marginBottom = `${-(GRID.h * (1 - k)) / 2}px`;
  const bottom = document.querySelector('.stage-bottom');
  if (bottom) bottom.style.width = `${GRID.w * k}px`;
}

// ============================================================
//  Entrées — commandant
// ============================================================

function openCommanderScreen() {
  UI.showScreen('screen-commander', {
    onSwap: () => {
      game.state = STATE.COMMANDER;
      refreshCommanderScreen();
    }
  });
}

function refreshCommanderScreen() {
  UI.renderCommanderGrid(save, (id) => {
    save.setCommander(id);
    refreshCommanderScreen();
  });
  const c = COMMANDERS[save.commander];
  $('#cmdr-current-name').textContent = c ? c.name : 'AUCUN';
}

function bindCommanderInputs() {
  $('#btn-commander').addEventListener('click', openCommanderScreen);
  $('#cmdr-back').addEventListener('click', () => {
    UI.renderMenu(save, tree.nodes.length - 1);
    UI.showScreen('screen-menu', { onSwap: () => { game.state = STATE.MENU; } });
  });
}

// ============================================================
//  Préparation de mission — choix des variantes de tourelles
// ============================================================

/** Une variante est disponible si son nœud de l'arbre a été acheté. */
function variantUnlocked(id) {
  const mods = computeMods(tree, save.unlocked);
  return !!mods['variant.' + id];
}

/** Table des variantes réellement jouables, filtrée sur les déblocages. */
function activeLoadout() {
  const mods = computeMods(tree, save.unlocked);
  const out = Object.create(null);
  for (const arche of VARIANT_ORDER) {
    const id = save.loadout[arche];
    if (id && VARIANT_BY_ID[id] && mods['variant.' + id]) out[arche] = id;
  }
  return out;
}

function openLoadout() {
  UI.showScreen('screen-loadout', {
    onSwap: () => {
      game.state = STATE.LOADOUT;
      refreshLoadout();
    }
  });
}

function refreshLoadout() {
  // Un seul calcul de mods pour toute la grille : computeMods parcourt
  // l'ensemble des nœuds achetés, inutile de le refaire 18 fois.
  const mods = computeMods(tree, save.unlocked);
  UI.renderLoadout(save, (id) => !!mods['variant.' + id], (arche, variantId) => {
    save.setVariant(arche, variantId);
    refreshLoadout();
    const v = variantId ? VARIANT_BY_ID[variantId] : null;
    UI.toast(v
      ? `<b>${TOWERS[arche].name}</b><br>${v.def.name}`
      : `<b>${TOWERS[arche].name}</b><br>Version standard`, '', 1600);
  });
}

function bindLoadoutInputs() {
  $('#lo-back').addEventListener('click', () => {
    UI.renderMenu(save, tree.nodes.length - 1);
    UI.showScreen('screen-menu', { onSwap: () => { game.state = STATE.MENU; } });
  });
  $('#lo-deploy').addEventListener('click', () => {
    UI.showScreen('screen-game', {
      onSwap: () => { startRun(); requestAnimationFrame(fitStage); }
    });
  });
  window.addEventListener('keydown', (ev) => {
    if (game.state !== STATE.LOADOUT) return;
    if (ev.key === 'Escape') $('#lo-back').click();
    if (ev.key === 'Enter') $('#lo-deploy').click();
  });
}

// ============================================================
//  Entrées — arbre
// ============================================================

function openTree() {
  UI.showScreen('screen-tree', {
    onSwap: () => {
      if (!treeView) {
        treeView = new TreeView($('#tree-canvas'), tree, save);
        treeView.onSelect = (n) => UI.renderNodeDetail(n, save, tree, { reachable: treeView.isAvailable(n) });
        treeView.onBuy = buyNode;
      }
      requestAnimationFrame(() => treeView.resize());
      refreshTreeUi();
      game.state = STATE.TREE;
    }
  });
}

function refreshTreeUi() {
  const sums = branchSummary(tree, save.unlocked);
  UI.renderBranchNav(sums, activeBranch, (i) => {
    activeBranch = i;
    treeView.focusBranch(i);
    refreshTreeUi();
  });
  $('#tree-materials').textContent = save.materials;
  $('#tree-counter').textContent = `${save.unlocked.size} / ${tree.nodes.length - 1}`;
  if (treeView && treeView.selected) {
    UI.renderNodeDetail(treeView.selected, save, tree, { reachable: treeView.isAvailable(treeView.selected) });
  }
}

function buyNode(n) {
  if (!n || n.hub) return;
  if (save.unlocked.has(n.id)) return;
  const reachable = treeView.isAvailable(n);
  if (!reachable || save.materials < n.cost) {
    A({ targets: '#detail-buy', translateX: [-8, 8, -5, 5, 0], duration: 260, easing: 'easeOutQuad' });
    A({ targets: '#tree-materials', color: [PALETTE.danger, PALETTE.gold], duration: 600 });
    return;
  }
  save.unlock(n.id, n.cost);
  treeView.burst(n);
  treeView.select(n);
  refreshTreeUi();
  A({
    targets: '#tree-materials',
    scale: [1.5, 1], duration: 460, easing: 'easeOutElastic'
  });
}

/** Déverrouille au hasard un nœud accessible (relié à un nœud déjà acquis) et abordable. */
function randomUnlock() {
  if (!treeView) return;
  const candidates = tree.nodes.filter((n) =>
    !n.hub && !save.unlocked.has(n.id) && treeView.isAvailable(n) && save.materials >= n.cost);
  if (!candidates.length) {
    A({ targets: '#btn-random-node', translateX: [-8, 8, -5, 5, 0], duration: 260, easing: 'easeOutQuad' });
    A({ targets: '#tree-materials', color: [PALETTE.danger, PALETTE.gold], duration: 600 });
    UI.toast('<b>AUCUN NŒUD ACCESSIBLE</b><br>Rien d\'abordable pour l\'instant', 'bad', 2000);
    return;
  }
  const n = candidates[Math.floor(Math.random() * candidates.length)];
  buyNode(n);
  treeView.focusNode(n);
}

function bindTreeInputs() {
  $('#tree-back').addEventListener('click', () => {
    UI.renderMenu(save, tree.nodes.length - 1);
    UI.showScreen('screen-menu', { onSwap: () => { game.state = STATE.MENU; } });
  });
  $('#btn-random-node').addEventListener('click', randomUnlock);
  $('#detail-buy').addEventListener('click', () => {
    if (treeView && treeView.selected) buyNode(treeView.selected);
  });
  window.addEventListener('keydown', (ev) => {
    if (game.state !== STATE.TREE) return;
    if (ev.key === 'Escape') $('#tree-back').click();
    if (ev.key === 'Enter' && treeView.selected) buyNode(treeView.selected);
  });
}

// ============================================================
//  Entrées — menu / fin
// ============================================================

function bindMenuInputs() {
  $('#btn-play').addEventListener('click', openLoadout);

  $('#btn-tree').addEventListener('click', openTree);

  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Effacer toute la progression (matériaux et nœuds débloqués) ? Cette action est irréversible.')) {
      save.reset();
      UI.renderMenu(save, tree.nodes.length - 1);
      if (treeView) treeView.selected = null;
      UI.toast('Progression réinitialisée.', 'warn');
    }
  });

  $('#over-again').addEventListener('click', openLoadout);

  $('#over-tree').addEventListener('click', openTree);

  $('#over-menu').addEventListener('click', () => {
    UI.renderMenu(save, tree.nodes.length - 1);
    UI.showScreen('screen-menu', { onSwap: () => { game.state = STATE.MENU; } });
  });
}

// ============================================================
//  Démarrage
// ============================================================

function init() {
  renderer = new Renderer($('#game-canvas'));

  bindGameInputs();
  bindMenuInputs();
  bindTreeInputs();
  bindCommanderInputs();
  bindHelpModal();
  bindTutorialInputs();
  bindLoadoutInputs();

  window.addEventListener('resize', () => {
    fitStage();
    if (treeView && game.state === STATE.TREE) treeView.resize();
  });

  UI.renderMenu(save, tree.nodes.length - 1);

  UI.runBoot(() => {
    UI.showScreen('screen-menu', { onSwap: () => { game.state = STATE.MENU; } })
      .then(() => { if (!save.onboardingSeen) openHelp(); });
  });

  requestAnimationFrame(frame);

  // Handle d'inspection en console (debug / tests automatisés)
  window.TD = {
    game, save, tree,
    get treeView() { return treeView; },
    get tutorial() { return game.tutorial; },
    tryPlace, buyNode, endRun, startWave, startRun, fitStage,
    launchTutorial, pickTower, openLoadout, refreshLoadout, activeLoadout, variantUnlocked
  };

  console.log(
    `%cNULL SECTOR%c  arbre: ${tree.nodes.length - 1} nœuds · ${tree.edges.length} arêtes · moteur d'animation: ${UI.usingCdn ? 'anime.js (CDN)' : 'tween.js (repli local)'}`,
    'background:#0d67ff;color:#f4f4f4;padding:2px 6px;font-weight:700',
    'color:#b8b8b8'
  );
}

// Le CDN anime.js est chargé en <script> classique : le module s'exécute après.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
