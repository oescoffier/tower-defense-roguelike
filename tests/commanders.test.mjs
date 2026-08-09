// ============================================================
//  Test headless (Node, sans DOM) : vérifie que les 20 commandants
//  déclenchent effectivement leur tir et infligent des dégâts, que
//  chacun des 3 TYPES D'APTITUDE UNIQUE (aura sur les tours, aura de
//  zone sur les ennemis, pulsation périodique, déclencheur sur
//  élimination) produit bien l'effet attendu et NULLE PART via une clé
//  de modificateur d'arbre (game.mods), et qu'ils montent bien en rang
//  à mesure que les tours éliminent des ennemis. Couvre aussi les 7
//  tours de base en régression.
//
//  main.js ne peut pas être importé tel quel dans Node (il touche le
//  DOM et localStorage dès le chargement du module) : les fonctions
//  d'aptitude y sont donc reproduites fidèlement ici, comme le reste
//  de cette suite le fait déjà pour la boucle de jeu.
// ============================================================
import { GRID, TARGET, TOWERS, TOWER_ORDER, COMMANDERS, COMMANDER_ORDER, COMMANDER_RANK_KILLS } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower, getTowerDef } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';
import { explode, hit, enemiesInRange, canHit } from '../js/combat.js';

const C = GRID.cell;
const DT = 1 / 60;
const DURATION = 6; // secondes simulées pour le test de tir

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

function makeGame(overrides = {}) {
  const grid = new Grid(1);
  return {
    grid, mods: {}, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, gold: 0, lives: 10, maxLives: 10,
    chainBlastMult: 0.6,
    onEnemyKilled() {}, onEnemyLeaked() {},
    ...overrides
  };
}

function makeEnemy(game, type, px, py) {
  const e = new Enemy(type, game.grid, {});
  e.x = px; e.y = py;
  game.enemies.push(e);
  return e;
}

// ============================================================
//  Reproduction fidèle des fonctions d'aptitude de main.js
// ============================================================

function mirrorApplyTowerAura(game) {
  const cmdr = game.towers.find((t) => t.isCommander);
  const ab = cmdr && cmdr.def.ability;
  const active = ab && ab.type === 'aura' && ab.target === 'towers';
  for (const t of game.towers) {
    t.auraMult.damage = 1; t.auraMult.rate = 1; t.auraMult.range = 1;
    if (!active || t === cmdr) continue;
    const d = Math.hypot(t.px - cmdr.px, t.py - cmdr.py);
    if (d <= ab.radius * C) t.auraMult[ab.stat] = 1 + ab.value * (cmdr.rankMult || 1);
  }
  for (const t of game.towers) t.recompute(game.mods);
}

function mirrorFieldEffects(cmdr, ab, game) {
  const r2 = (ab.radius * C) ** 2;
  const mult = cmdr.rankMult || 1;
  for (const e of game.enemies) {
    if (e.dead || e.air) continue;
    const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
    if (dx * dx + dy * dy > r2) continue;
    if (ab.kind === 'slow') e.applySlow(ab.value, 0.4, game);
    else if (ab.kind === 'burn') e.applyBurn(ab.value * mult, 0.4, 6, game, 0);
  }
}

function mirrorFirePulse(cmdr, ab, game) {
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
        if (!best) return false;
        pos = { x: best.x, y: best.y };
      }
      explode(game, pos.x, pos.y, ab.radius * C, ab.damage * mult, {
        mask: ab.targetMask, color: cmdr.def.accent, power: 1.2, source: cmdr, type: 'commander'
      });
      return true;
    }
    case 'execute': {
      const maxD2 = ab.rangeLimited ? cmdr.rangePx * cmdr.rangePx : Infinity;
      let worst = null, worstRatio = ab.threshold;
      for (const e of game.enemies) {
        if (e.dead || e.boss) continue;
        if (ab.rangeLimited) {
          const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
          if (dx * dx + dy * dy > maxD2) continue;
        }
        if (e.hpRatio < worstRatio) { worstRatio = e.hpRatio; worst = e; }
      }
      if (!worst) return false;
      hit(cmdr, worst, game, worst.hp + worst.shield + 9999, { ignoreArmor: true, type: 'commander' });
      return true;
    }
    case 'overcharge': {
      let best = null, bestHp = -1;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const hp = e.hp + e.shield;
        if (hp > bestHp) { bestHp = hp; best = e; }
      }
      if (!best) return false;
      best.commanderMarkUntil = game.time + ab.dur;
      best.commanderMarkBonus = ab.value;
      return true;
    }
    case 'freeze': {
      const r2 = (ab.radius * C) ** 2;
      let any = false;
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - cmdr.px, dy = e.y - cmdr.py;
        if (dx * dx + dy * dy <= r2) { e.applyStun(ab.dur, game); any = true; }
      }
      return any;
    }
    case 'emp': {
      let any = false;
      for (const e of game.enemies) {
        if (e.dead || !e.maxShield || e.shield <= 0) continue;
        e.shield = 0; any = true;
      }
      return any;
    }
    default:
      return false;
  }
}

function mirrorOnKill(cmdr, ab, e, opts, game) {
  if (opts && opts.type === 'commander-spark') return;
  if (ab.kind === 'goldBonus') {
    game.gold += ab.value;
  } else if (ab.kind === 'healChance') {
    if (Math.random() < ab.chance && game.lives < game.maxLives) game.lives++;
  } else if (ab.kind === 'chainSpark') {
    if (Math.random() >= ab.chance) return;
    const near = enemiesInRange(game, e.x, e.y, ab.radius * C, TARGET.BOTH).filter((o) => !o.dead && o !== e);
    if (!near.length) return;
    const target = near[0];
    hit(cmdr, target, game, ab.damage * (cmdr.rankMult || 1), { type: 'commander-spark' });
  }
}

// ============================================================
//  Test de tir (identique pour les 20 commandants + 7 tours de base)
// ============================================================

function fireTest(id) {
  const def = getTowerDef(id);
  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;

  const tower = new Tower(id, sx, sy, game);
  game.towers.push(tower);

  const isAir = def.targets === TARGET.AIR;
  // Place la cible à 60% de l'intervalle [portée min, portée max] de la
  // tour : reste dans la zone morte du mortier serait une portée nulle à
  // tort, et une position fixe en pixels ne veut plus rien dire depuis que
  // les portées varient énormément d'une tour à l'autre (mitrailleuse 2
  // cases, sniper 4, DCA 3...).
  const dist = tower.rangeMinPx + (tower.rangePx - tower.rangeMinPx) * 0.6;
  const enemy = makeEnemy(game, isAir ? 'bomber' : 'juggernaut', tower.px + dist, tower.py);

  const startHp = enemy.hp;
  let t = 0;
  while (t < DURATION && !enemy.dead) {
    tower.update(DT, game);
    for (const p of game.projectiles) p.update(DT, game);
    game.projectiles = game.projectiles.filter((p) => !p.dead);
    enemy.update(DT, game);
    enemy.x = tower.px + dist; enemy.y = tower.py;
    game.time += DT;
    t += DT;
  }

  return {
    id, name: def.name, archetype: def.archetype || id,
    hits: game.vfx.numbers.length,
    dmgDealt: startHp - enemy.hp,
    startHp, killed: enemy.dead
  };
}

console.log(`\n=== TEST DE TIR — ${COMMANDER_ORDER.length} commandants, ${DURATION}s simulées chacun ===\n`);
for (const id of COMMANDER_ORDER) {
  let r;
  try {
    r = fireTest(id);
  } catch (err) {
    fail(`${id} — ${err.message}`);
    continue;
  }
  const ok = r.hits > 0 && r.dmgDealt > 0;
  if (!ok) fail(`${r.name}: aucun dégât infligé en ${DURATION}s`);
  const pct = Math.round((r.dmgDealt / r.startHp) * 100);
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${r.name.padEnd(20)} (${r.archetype.padEnd(6)}) — ${r.hits} touches · ${Math.round(r.dmgDealt)}/${r.startHp} PV (${pct}%)${r.killed ? ' · CIBLE ÉLIMINÉE' : ''}`);
}

console.log(`\n=== RÉGRESSION — ${TOWER_ORDER.length} tours de base ===\n`);
for (const id of TOWER_ORDER) {
  let r;
  try {
    r = fireTest(id);
  } catch (err) {
    fail(`${id} — ${err.message}`);
    continue;
  }
  const shouldFire = id !== 'sandbag';
  const ok = shouldFire ? (r.hits > 0 && r.dmgDealt > 0) : (r.hits === 0 && r.dmgDealt === 0);
  if (!ok) fail(`${r.name}: comportement de tir inattendu`);
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${r.name.padEnd(20)} — ${r.hits} touches · ${Math.round(r.dmgDealt)}/${r.startHp} PV${shouldFire ? '' : ' (bloqueur inerte, attendu)'}`);
}

// ============================================================
//  Validation du schéma des aptitudes (attrape les fautes de frappe
//  dans les données sans avoir à tout simuler)
// ============================================================

console.log('\n=== SCHÉMA DES APTITUDES ===\n');
const AURA_STATS = ['damage', 'rate', 'range'];
const PULSE_KINDS = ['nova', 'execute', 'overcharge', 'freeze', 'emp'];
const ONKILL_KINDS = ['goldBonus', 'healChance', 'chainSpark'];

for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  const ab = def.ability;
  const problems = [];
  if (!ab || !ab.type) {
    problems.push('pas d\'aptitude définie (ability manquant)');
  } else if (ab.type === 'aura') {
    if (ab.target !== 'towers') problems.push('aura sans target: "towers"');
    if (!AURA_STATS.includes(ab.stat)) problems.push(`stat d'aura invalide "${ab.stat}"`);
    if (typeof ab.value !== 'number' || ab.value <= 0) problems.push('value d\'aura invalide');
    if (typeof ab.radius !== 'number' || ab.radius <= 0) problems.push('radius d\'aura invalide');
  } else if (ab.type === 'auraDebuff') {
    if (!['slow', 'burn'].includes(ab.kind)) problems.push(`kind auraDebuff invalide "${ab.kind}"`);
    if (typeof ab.value !== 'number' || ab.value <= 0) problems.push('value auraDebuff invalide');
    if (typeof ab.radius !== 'number' || ab.radius <= 0) problems.push('radius auraDebuff invalide');
  } else if (ab.type === 'pulse') {
    if (!PULSE_KINDS.includes(ab.kind)) problems.push(`kind pulse invalide "${ab.kind}"`);
    if (typeof ab.interval !== 'number' || ab.interval <= 0) problems.push('interval de pulse invalide');
    if (ab.kind === 'nova' && (typeof ab.damage !== 'number' || typeof ab.radius !== 'number' || ab.targetMask === undefined)) {
      problems.push('nova incomplet (damage/radius/targetMask)');
    }
    if (ab.kind === 'execute' && typeof ab.threshold !== 'number') problems.push('execute sans threshold');
    if (ab.kind === 'overcharge' && (typeof ab.value !== 'number' || typeof ab.dur !== 'number')) problems.push('overcharge incomplet (value/dur)');
    if (ab.kind === 'freeze' && (typeof ab.dur !== 'number' || typeof ab.radius !== 'number')) problems.push('freeze incomplet (dur/radius)');
  } else if (ab.type === 'onKill') {
    if (!ONKILL_KINDS.includes(ab.kind)) problems.push(`kind onKill invalide "${ab.kind}"`);
    if (ab.kind === 'goldBonus' && typeof ab.value !== 'number') problems.push('goldBonus sans value');
    if (ab.kind === 'healChance' && typeof ab.chance !== 'number') problems.push('healChance sans chance');
    if (ab.kind === 'chainSpark' && (typeof ab.chance !== 'number' || typeof ab.damage !== 'number' || typeof ab.radius !== 'number')) {
      problems.push('chainSpark incomplet (chance/damage/radius)');
    }
  } else {
    problems.push(`type d'aptitude inconnu "${ab.type}"`);
  }

  if (problems.length) {
    fail(`${id}: ${problems.join(' · ')}`);
  } else {
    console.log(`[PASS] ${def.name.padEnd(20)} — ${ab.type}/${ab.kind || ab.stat}`);
  }
}

// ============================================================
//  Aura sur les tours : un allié dans le rayon est buffé, un allié
//  hors rayon ne l'est pas — jamais via game.mods.
// ============================================================

console.log('\n=== AURA SUR LES TOURS ===\n');
for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  if (!def.ability || def.ability.type !== 'aura') continue;
  const ab = def.ability;

  const game = makeGame();
  // Position fixe au centre de la grille (pas relative au spawn, qui peut
  // être tout près d'un bord selon la silhouette tirée) : garantit assez
  // de place des deux côtés pour tester "dans le rayon" / "hors du rayon".
  const cgx = Math.floor(GRID.cols / 2), cgy = Math.floor(GRID.rows / 2);
  const cmdr = new Tower(id, cgx, cgy, game);
  game.towers.push(cmdr);

  const inGx = Math.max(0, cgx - Math.max(1, Math.floor(ab.radius * 0.5)));
  const outGx = Math.min(GRID.cols - 1, cgx + Math.ceil(ab.radius) + 4);
  const near = new Tower('mg', inGx, cgy, game);
  const far = new Tower('mg', outGx, cgy, game);
  game.towers.push(near, far);

  mirrorApplyTowerAura(game);

  const problems = [];
  if (!(near.auraMult[ab.stat] > 1)) problems.push(`la tour proche (${ab.radius * 0.5} case) n'est pas buffée`);
  if (far.auraMult[ab.stat] !== 1) problems.push('la tour lointaine est buffée à tort (rayon non respecté)');
  if (game.mods[`${ab.stat}`] || Object.keys(game.mods).length) problems.push('l\'aura a laissé une trace dans game.mods — ce ne doit jamais être le cas');

  if (problems.length) fail(`${def.name}: ${problems.join(' · ')}`);
  else console.log(`[PASS] ${def.name.padEnd(20)} — +${Math.round(ab.value * 100)}% ${ab.stat} à ${ab.radius} cases, hors rayon non affecté`);
}

// ============================================================
//  Aura de zone sur les ennemis (ralentissement / brûlure)
// ============================================================

console.log('\n=== AURA DE ZONE SUR LES ENNEMIS ===\n');
for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  if (!def.ability || def.ability.type !== 'auraDebuff') continue;
  const ab = def.ability;

  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
  const cmdr = new Tower(id, sx, sy, game);
  cmdr.rankMult = 1;
  game.towers.push(cmdr);

  const near = makeEnemy(game, 'juggernaut', cmdr.px + ab.radius * C * 0.4, cmdr.py);
  const far = makeEnemy(game, 'juggernaut', cmdr.px + (ab.radius + 4) * C, cmdr.py);

  mirrorFieldEffects(cmdr, ab, game);

  const problems = [];
  if (ab.kind === 'slow') {
    if (!(near.slowUntil > game.time)) problems.push('l\'ennemi proche n\'est pas ralenti');
    if (far.slowUntil > game.time) problems.push('l\'ennemi lointain est ralenti à tort');
  } else if (ab.kind === 'burn') {
    if (!near.burning) problems.push('l\'ennemi proche ne brûle pas');
    if (far.burning) problems.push('l\'ennemi lointain brûle à tort');
  }

  if (problems.length) fail(`${def.name}: ${problems.join(' · ')}`);
  else console.log(`[PASS] ${def.name.padEnd(20)} — ${ab.kind} sur les ennemis à ${ab.radius} cases, hors rayon épargné`);
}

// ============================================================
//  Pulsations périodiques
// ============================================================

console.log('\n=== PULSATIONS PÉRIODIQUES ===\n');
for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  if (!def.ability || def.ability.type !== 'pulse') continue;
  const ab = def.ability;

  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
  const cmdr = new Tower(id, sx, sy, game);
  cmdr.rankMult = 1;
  game.towers.push(cmdr);

  const isAirKind = ab.targetMask === TARGET.AIR;
  const weak = makeEnemy(game, isAirKind ? 'wasp' : 'grunt', cmdr.px + 20, cmdr.py);
  weak.hp = Math.max(1, Math.round(weak.maxHp * 0.1)); // presque mort, pour "execute"
  const tough = makeEnemy(game, isAirKind ? 'bomber' : 'juggernaut', cmdr.px + 20, cmdr.py);
  // Bouclier ajouté seulement pour "emp" : sur "overcharge", il absorberait
  // une partie du coup et fausserait la mesure d'amplification de dégâts.
  if (ab.kind === 'emp' && tough.maxShield === 0) { tough.maxShield = 40; tough.shield = 40; }

  let ok = false;
  let detail = '';
  try {
    const fired = mirrorFirePulse(cmdr, ab, game);
    if (ab.kind === 'nova') {
      ok = fired && (weak.dead || weak.hp < weak.maxHp * 0.1 || tough.hp < tough.maxHp);
      detail = `dégâts infligés (${ab.damage} × rayon ${ab.radius})`;
    } else if (ab.kind === 'execute') {
      ok = fired && weak.dead;
      detail = `exécute l'ennemi sous ${Math.round(ab.threshold * 100)}% de vie`;
    } else if (ab.kind === 'overcharge') {
      ok = fired && tough.commanderMarkUntil > game.time;
      if (ok) {
        const before = tough.hp;
        tough.damage(100, {}, game);
        ok = (before - tough.hp) > 100 * 1.001; // la marque doit amplifier le prochain coup
        detail = `marque et amplifie le prochain coup de +${Math.round(ab.value * 100)}%`;
      }
    } else if (ab.kind === 'freeze') {
      ok = fired && weak.stunUntil > game.time && tough.stunUntil > game.time;
      detail = `étourdit ${ab.dur}s à ${ab.radius} cases`;
    } else if (ab.kind === 'emp') {
      ok = fired && tough.shield === 0;
      detail = 'fait sauter le bouclier des ennemis';
    }
  } catch (err) {
    fail(`${def.name}: la pulsation plante — ${err.message}`);
    continue;
  }

  if (!ok) fail(`${def.name}: la pulsation "${ab.kind}" n'a pas produit l'effet attendu (${detail})`);
  else console.log(`[PASS] ${def.name.padEnd(20)} — ${ab.kind}, ${detail}`);
}

// ============================================================
//  Nerf FANTÔME : l'exécution est bornée à sa portée (sinon un seul
//  commandant nettoie n'importe quelle vague depuis un coin de la carte,
//  combo "impossible à perdre" avec un sniper full exécution).
// ============================================================

console.log('\n=== PORTÉE DE L\'EXÉCUTION (nerf FANTÔME) ===\n');
{
  const def = COMMANDERS.cmdr_ghost;
  const ab = def.ability;
  if (!ab.rangeLimited) fail('FANTÔME : ability.rangeLimited devrait être vrai (nerf retiré ?)');

  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
  const cmdr = new Tower('cmdr_ghost', sx, sy, game);
  cmdr.rankMult = 1;
  game.towers.push(cmdr);

  const inRange = makeEnemy(game, 'grunt', cmdr.px + cmdr.rangePx * 0.5, cmdr.py);
  inRange.hp = Math.max(1, Math.round(inRange.maxHp * 0.1));
  const outOfRange = makeEnemy(game, 'grunt', cmdr.px + cmdr.rangePx * 3, cmdr.py);
  outOfRange.hp = Math.max(1, Math.round(outOfRange.maxHp * 0.1));

  mirrorFirePulse(cmdr, ab, game);
  if (outOfRange.dead) fail('FANTÔME : a exécuté un ennemi hors de sa portée — le nerf ne fonctionne pas');
  else if (!inRange.dead) fail('FANTÔME : n\'a pas exécuté l\'ennemi mourant qui était bien à portée');
  else console.log(`[PASS] FANTÔME               — exécute à portée (${Math.round(cmdr.rangePx / C)} cases), épargne hors de portée`);
}

// ============================================================
//  Déclencheurs sur élimination
// ============================================================

console.log('\n=== DÉCLENCHEURS SUR ÉLIMINATION ===\n');
for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  if (!def.ability || def.ability.type !== 'onKill') continue;
  const ab = def.ability;

  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
  const cmdr = new Tower(id, sx, sy, game);
  cmdr.rankMult = 1;
  game.towers.push(cmdr);

  let ok = false, detail = '';
  try {
    if (ab.kind === 'goldBonus') {
      const before = game.gold;
      const e = makeEnemy(game, 'grunt', cmdr.px, cmdr.py);
      mirrorOnKill(cmdr, ab, e, {}, game);
      ok = game.gold === before + ab.value;
      detail = `+${ab.value} crédits par élimination`;
    } else if (ab.kind === 'healChance') {
      game.lives = 5; game.maxLives = 10;
      let healed = 0;
      for (let i = 0; i < 400 && !healed; i++) {
        game.enemies.length = 0;
        const e = makeEnemy(game, 'grunt', cmdr.px, cmdr.py);
        const before = game.lives;
        mirrorOnKill(cmdr, ab, e, {}, game);
        if (game.lives > before) healed++;
      }
      ok = healed > 0;
      detail = `${Math.round(ab.chance * 100)}% de chance de rendre 1 intégrité (400 essais)`;
    } else if (ab.kind === 'chainSpark') {
      let sparked = false;
      for (let i = 0; i < 400 && !sparked; i++) {
        // Repart d'une liste d'ennemis vide à chaque essai : sinon, à mesure
        // que les essais s'accumulent, une étincelle peut toucher l'ennemi
        // "proche" d'un essai voisin plutôt que celui de cet essai-ci.
        game.enemies.length = 0;
        const e = makeEnemy(game, 'grunt', 300, 300);
        const near = makeEnemy(game, 'grunt', 310, 300);
        const before = near.hp;
        mirrorOnKill(cmdr, ab, e, {}, game);
        if (near.hp < before || near.dead) sparked = true;
      }
      ok = sparked;
      detail = `${Math.round(ab.chance * 100)}% de chance de frapper un ennemi proche (400 essais)`;
    }
  } catch (err) {
    fail(`${def.name}: le déclencheur plante — ${err.message}`);
    continue;
  }

  if (!ok) fail(`${def.name}: le déclencheur "${ab.kind}" ne s'est jamais produit (${detail})`);
  else console.log(`[PASS] ${def.name.padEnd(20)} — ${ab.kind}, ${detail}`);
}

// ============================================================
//  Montée en rang par éliminations
// ============================================================

console.log(`\n=== MONTÉE EN RANG PAR ÉLIMINATIONS (paliers : ${COMMANDER_RANK_KILLS.join(' / ')}) ===\n`);
for (const id of COMMANDER_ORDER) {
  const def = COMMANDERS[id];
  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
  const cmdr = new Tower(id, sx, sy, game);
  game.towers.push(cmdr);
  cmdr.killsAtPlacement = 0;
  cmdr.rankMult = 1;

  const problems = [];
  let prevDamage = cmdr.stats.damage;
  let prevRankMult = cmdr.rankMult;

  for (let tier = 0; tier < COMMANDER_RANK_KILLS.length; tier++) {
    game.kills = COMMANDER_RANK_KILLS[tier];
    // --- reproduit checkCommanderRankUp() ---
    cmdr.level++;
    cmdr.rankMult = 1 + cmdr.level * 0.5;
    cmdr.recompute(game.mods);
    mirrorApplyTowerAura(game);
    // -----------------------------------------

    if (cmdr.level !== tier + 1) problems.push(`niveau ${cmdr.level} après le palier ${tier + 1}, attendu ${tier + 1}`);
    if (!(cmdr.stats.damage > prevDamage)) problems.push(`les dégâts n'ont pas augmenté au rang ${cmdr.level}`);
    if (!(cmdr.rankMult > prevRankMult)) problems.push(`rankMult n'a pas augmenté au rang ${cmdr.level}`);
    prevDamage = cmdr.stats.damage;
    prevRankMult = cmdr.rankMult;
  }

  if (problems.length) {
    fails += problems.length;
    for (const p of problems) console.log(`[FAIL] ${def.name}: ${p}`);
  } else {
    console.log(`[PASS] ${def.name.padEnd(20)} — rang ${cmdr.level}/${COMMANDER_RANK_KILLS.length} atteint, dégâts finaux ×${(cmdr.stats.damage / def.damage).toFixed(2)}, rankMult ×${cmdr.rankMult}`);
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
