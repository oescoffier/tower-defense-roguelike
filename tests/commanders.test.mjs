// ============================================================
//  Test headless (Node, sans DOM) : vérifie que les 20 commandants
//  déclenchent effectivement leur tir et infligent des dégâts, et que
//  les clés de leur capacité de commandement sont bien lues quelque
//  part dans le code (pas de faute de frappe silencieuse).
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { GRID, TARGET, TOWERS, TOWER_ORDER, COMMANDERS, COMMANDER_ORDER } from '../js/config.js';
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
