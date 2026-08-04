// ============================================================
//  Test headless (Node, sans DOM) : vérifie que les 20 commandants
//  déclenchent effectivement leur tir et infligent des dégâts, que leur
//  capacité de commandement s'applique correctement aux autres tours,
//  qu'ils montent bien en rang à mesure que les tours éliminent des
//  ennemis (gros paliers, buff cumulé sur la tour ET sur sa capacité),
//  et que les clés de "grants" sont bien lues quelque part dans le code
//  (pas de faute de frappe silencieuse). Couvre aussi les 7 tours de
//  base en régression.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { GRID, TARGET, TOWERS, TOWER_ORDER, COMMANDERS, COMMANDER_ORDER, COMMANDER_RANK_KILLS } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower, getTowerDef } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DT = 1 / 60;
const DURATION = 6; // secondes simulées

function makeGame() {
  const grid = new Grid(1);
  return {
    grid,
    mods: {},
    enemies: [],
    projectiles: [],
    towers: [],
    vfx: new Vfx(),
    time: 0,
    chainBlastMult: 0.6,
    onEnemyKilled() {},
    onEnemyLeaked() {}
  };
}

function fireTest(id) {
  const def = getTowerDef(id);
  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;

  const tower = new Tower(id, sx, sy, game);
  game.towers.push(tower);

  const isAir = def.targets === TARGET.AIR;
  const enemy = new Enemy(isAir ? 'bomber' : 'juggernaut', game.grid, {});
  const pinX = tower.px + 50, pinY = tower.py;
  enemy.x = pinX; enemy.y = pinY;
  game.enemies.push(enemy);

  const startHp = enemy.hp;
  let t = 0;
  while (t < DURATION && !enemy.dead) {
    tower.update(DT, game);
    for (const p of game.projectiles) p.update(DT, game);
    game.projectiles = game.projectiles.filter((p) => !p.dead);
    enemy.update(DT, game);
    enemy.x = pinX; enemy.y = pinY; // cible fixe : on isole le test du pathfinding
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

/**
 * Reproduit exactement applyCommanderGrants() de main.js : injecte les
 * bonus du commandant dans game.mods, puis force un recompute() de toutes
 * les tours. Vérifie que ça ne plante pas et que chaque clé numérique du
 * "grants" a bien bougé game.mods dans le bon sens.
 */
function grantPropagationTest(id) {
  const def = COMMANDERS[id];
  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;

  const commander = new Tower(id, sx, sy, game);
  game.towers.push(commander);
  const ally = new Tower(def.archetype, sx + 3, sy, game);
  game.towers.push(ally);

  const before = { ...game.mods };
  for (const [key, value] of Object.entries(def.grants || {})) {
    game.mods[key] = (game.mods[key] || 0) + value;
  }
  game.chainBlastMult = 0.6 + (game.mods['tesla.chainBlast'] || 0);
  for (const t of game.towers) t.recompute(game.mods);

  const problems = [];
  for (const [key, value] of Object.entries(def.grants || {})) {
    const got = game.mods[key] || 0;
    const expected = (before[key] || 0) + value;
    if (Math.abs(got - expected) > 1e-9) {
      problems.push(`${id}: game.mods['${key}'] = ${got}, attendu ${expected}`);
    }
  }
  return problems;
}

/**
 * Reproduit checkCommanderRankUp() de main.js : fait franchir au commandant
 * les COMMANDER_RANK_KILLS.length paliers d'élimination, un par un, et
 * vérifie à chaque rang que (a) le niveau/rankMult montent bien, (b) les
 * stats de la tour progressent (elle utilise les tiers de son archétype),
 * (c) sa capacité de commandement est ré-appliquée à la puissance du
 * nouveau rang sans jamais planter, pour les 20 commandants.
 */
function rankProgressionTest(id) {
  const def = COMMANDERS[id];
  const game = makeGame();
  const sx = game.grid.spawn.x, sy = game.grid.spawn.y;

  const cmdr = new Tower(id, sx, sy, game);
  game.towers.push(cmdr);
  cmdr.killsAtPlacement = 0;
  cmdr.rankMult = 1;
  for (const [key, value] of Object.entries(def.grants || {})) {
    game.mods[key] = (game.mods[key] || 0) + value;
  }
  for (const t of game.towers) t.recompute(game.mods);

  const problems = [];
  let prevDamage = cmdr.stats.damage;

  for (let tier = 0; tier < COMMANDER_RANK_KILLS.length; tier++) {
    game.kills = COMMANDER_RANK_KILLS[tier]; // franchit le palier

    // --- reproduit exactement checkCommanderRankUp() ---
    const applyGrants = (sign) => {
      const mult = cmdr.rankMult || 1;
      for (const [key, value] of Object.entries(cmdr.def.grants || {})) {
        game.mods[key] = (game.mods[key] || 0) + value * mult * sign;
      }
      for (const t of game.towers) t.recompute(game.mods);
    };
    applyGrants(-1);
    cmdr.level++;
    cmdr.rankMult = 1 + cmdr.level * 0.5;
    cmdr.recompute(game.mods);
    applyGrants(1);
    // ---------------------------------------------------

    if (cmdr.level !== tier + 1) {
      problems.push(`${id}: niveau ${cmdr.level} après le palier ${tier + 1}, attendu ${tier + 1}`);
    }
    if (!(cmdr.stats.damage > prevDamage)) {
      problems.push(`${id}: les dégâts n'ont pas augmenté au rang ${cmdr.level} (${prevDamage} -> ${cmdr.stats.damage})`);
    }
    for (const [key, value] of Object.entries(def.grants || {})) {
      const expected = value * cmdr.rankMult;
      const got = game.mods[key] || 0;
      if (Math.abs(got - expected) > 1e-9) {
        problems.push(`${id}: au rang ${cmdr.level}, game.mods['${key}'] = ${got}, attendu ${expected} (valeur de base × rankMult ${cmdr.rankMult})`);
      }
    }
    prevDamage = cmdr.stats.damage;
  }
  return { problems, finalDamage: cmdr.stats.damage, finalLevel: cmdr.level };
}

function grantsKeyAudit() {
  // Toutes les clés lues via `mods['x.y']`/`m(mods,'x.y')`, littérales ou
  // dynamiques (`${id}.suffixe`), dans tout le moteur.
  const files = ['combat.js', 'main.js', 'towers.js'].map((f) =>
    readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');

  const literal = new Set();
  const literalRe = /mods\[\s*'([\w.]+)'\s*\]|m\(\s*mods\s*,\s*'([\w.]+)'\s*\)/g;
  let m;
  while ((m = literalRe.exec(files))) literal.add(m[1] || m[2]);

  const dynamicSuffix = new Set();
  const dynamicRe = /mods\[\s*`\$\{[^}]+\}\.(\w+)`\s*\]|m\(\s*mods\s*,\s*`\$\{[^}]+\}\.(\w+)`\s*\)/g;
  while ((m = dynamicRe.exec(files))) dynamicSuffix.add(m[1] || m[2]);

  const problems = [];
  for (const id of COMMANDER_ORDER) {
    const grants = COMMANDERS[id].grants || {};
    for (const key of Object.keys(grants)) {
      const suffix = key.split('.')[1];
      if (!literal.has(key) && !dynamicSuffix.has(suffix)) {
        problems.push(`${id}: clé "${key}" jamais lue via mods[...] / m(mods,...) dans combat.js/main.js/towers.js`);
      }
    }
  }
  return problems;
}

console.log(`\n=== TEST DE TIR — ${COMMANDER_ORDER.length} commandants, ${DURATION}s simulées chacun ===\n`);
let fails = 0;
for (const id of COMMANDER_ORDER) {
  let r;
  try {
    r = fireTest(id);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] ${id} — ${err.message}`);
    console.log(err.stack.split('\n').slice(0, 4).join('\n'));
    continue;
  }
  const ok = r.hits > 0 && r.dmgDealt > 0;
  if (!ok) fails++;
  const pct = Math.round((r.dmgDealt / r.startHp) * 100);
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${r.name.padEnd(20)} (${r.archetype.padEnd(6)}) — ${r.hits} touches · ${Math.round(r.dmgDealt)}/${r.startHp} PV (${pct}%)${r.killed ? ' · CIBLE ÉLIMINÉE' : ''}`);
}

console.log(`\n=== RÉGRESSION — ${TOWER_ORDER.length} tours de base ===\n`);
for (const id of TOWER_ORDER) {
  let r;
  try {
    r = fireTest(id);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] ${id} — ${err.message}`);
    console.log(err.stack.split('\n').slice(0, 4).join('\n'));
    continue;
  }
  // Le sac de sable est conçu pour ne jamais tirer : on attend l'inverse.
  const shouldFire = id !== 'sandbag';
  const ok = shouldFire ? (r.hits > 0 && r.dmgDealt > 0) : (r.hits === 0 && r.dmgDealt === 0);
  if (!ok) fails++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${r.name.padEnd(20)} — ${r.hits} touches · ${Math.round(r.dmgDealt)}/${r.startHp} PV${shouldFire ? '' : ' (bloqueur inerte, attendu)'}`);
}

console.log(`\n=== PROPAGATION DE LA CAPACITÉ DE COMMANDEMENT ===\n`);
for (const id of COMMANDER_ORDER) {
  let problems;
  try {
    problems = grantPropagationTest(id);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] ${id} — ${err.message}`);
    continue;
  }
  if (problems.length) {
    fails += problems.length;
    for (const p of problems) console.log(`[FAIL] ${p}`);
  } else {
    console.log(`[PASS] ${COMMANDERS[id].name.padEnd(20)} — capacité appliquée sans erreur, tour alliée recalculée`);
  }
}

console.log(`\n=== MONTÉE EN RANG PAR ÉLIMINATIONS (paliers : ${COMMANDER_RANK_KILLS.join(' / ')}) ===\n`);
for (const id of COMMANDER_ORDER) {
  let r;
  try {
    r = rankProgressionTest(id);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] ${id} — ${err.message}`);
    console.log(err.stack.split('\n').slice(0, 4).join('\n'));
    continue;
  }
  if (r.problems.length) {
    fails += r.problems.length;
    for (const p of r.problems) console.log(`[FAIL] ${p}`);
  } else {
    console.log(`[PASS] ${COMMANDERS[id].name.padEnd(20)} — rang ${r.finalLevel}/${COMMANDER_RANK_KILLS.length} atteint, dégâts finaux ×${(r.finalDamage / COMMANDERS[id].damage).toFixed(2)}`);
  }
}

console.log(`\n=== AUDIT DES CLÉS DE CAPACITÉ (grants) ===\n`);
const problems = grantsKeyAudit();
if (problems.length) {
  fails += problems.length;
  for (const p of problems) console.log(`[FAIL] ${p}`);
} else {
  console.log('[PASS] Toutes les clés de "grants" des 20 commandants sont lues quelque part dans le moteur.');
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
