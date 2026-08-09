// ============================================================
//  Test headless (Node, sans DOM) : vérifie la courbe de difficulté
//  longue distance (nombre d'ennemis, dégâts de fuite qui montent avec
//  la vague) et la mécanique d'extension infinie de la carte
//  (Grid.grow() : +1 case tout autour toutes les MAP_GROWTH.every
//  vagues, avec de nouveaux points de spawn possibles sur l'anneau).
// ============================================================
import { GRID, CELL, MAP_GROWTH, waveCount, waveLeakMult } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

const ORIG_COLS = GRID.cols, ORIG_ROWS = GRID.rows;

// ============================================================
//  Courbe de difficulté : le nombre d'ennemis et les dégâts de fuite
//  doivent continuer à croître loin dans la partie, pas plafonner tôt.
// ============================================================
console.log('\n=== COURBE DE DIFFICULTÉ ===\n');
{
  const c60 = waveCount(60), c80 = waveCount(80), c150 = waveCount(150);
  if (!(c80 > c60)) fail(`waveCount(80)=${c80} n'est pas > waveCount(60)=${c60} — le plafond n'a pas été relevé`);
  else if (!(c150 > c80)) fail(`waveCount(150)=${c150} n'est pas > waveCount(80)=${c80} — plafonne encore trop tôt`);
  else console.log(`[PASS] waveCount croît toujours en vague avancée : v60=${c60}, v80=${c80}, v150=${c150}`);

  const m1 = waveLeakMult(1), m20 = waveLeakMult(20), m50 = waveLeakMult(50);
  if (m1 !== 1) fail(`waveLeakMult(1) = ${m1}, attendu 1 (pas de bonus à la vague 1)`);
  else if (!(m20 > m1 && m50 > m20)) fail('waveLeakMult ne croît pas de façon monotone avec la vague');
  else console.log(`[PASS] waveLeakMult(1)=${m1.toFixed(2)} → (20)=${m20.toFixed(2)} → (50)=${m50.toFixed(2)}, croissance monotone`);
}

// ============================================================
//  Grid.grow() — une extension isolée
// ============================================================
console.log('\n=== EXTENSION DE LA GRILLE (Grid.grow) ===\n');
{
  GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
  const grid = new Grid(7);
  const oldCols = grid.cols, oldRows = grid.rows;
  const oldBase = { ...grid.base };
  const oldSpawn = { ...grid.spawns[0] };

  grid.grow();

  const problems = [];
  if (grid.cols !== oldCols + 2 || grid.rows !== oldRows + 2) {
    problems.push(`dimensions attendues ${oldCols + 2}x${oldRows + 2}, obtenu ${grid.cols}x${grid.rows}`);
  }
  if (GRID.cols !== grid.cols || GRID.rows !== grid.rows) {
    problems.push('GRID.cols/rows (config global, dont dépend GRID.w/h) désynchronisé de la grille');
  }
  if (grid.base.x !== oldBase.x + 1 || grid.base.y !== oldBase.y + 1) problems.push('la base n\'a pas été décalée de (1,1)');
  if (grid.spawns[0].x !== oldSpawn.x + 1 || grid.spawns[0].y !== oldSpawn.y + 1) problems.push('le spawn principal n\'a pas été décalé de (1,1)');
  if (grid.spawn !== grid.spawns[0]) problems.push('grid.spawn ne pointe plus vers grid.spawns[0]');
  if (grid.cells[grid.idx(grid.base.x, grid.base.y)] !== CELL.BASE) problems.push('la case base n\'a pas la valeur CELL.BASE après décalage');
  if (grid.cells[grid.idx(grid.spawns[0].x, grid.spawns[0].y)] !== CELL.SPAWN) problems.push('la case spawn n\'a pas la valeur CELL.SPAWN après décalage');
  if (!grid._reachable(null)) problems.push('la base n\'est plus atteignable depuis tous les spawns après extension');
  if (!grid.path || grid.path.length < 2) problems.push('le chemin de référence n\'a pas été recalculé');

  if (problems.length) fail(`Grid.grow() : ${problems.join(' · ')}`);
  else console.log(`[PASS] +1 case tout autour : ${oldCols}x${oldRows} → ${grid.cols}x${grid.rows}, base/spawn décalés, chemin toujours valide`);
}

// ============================================================
//  Grid.grow() — nombreux cycles successifs (carte "à l'infini")
// ============================================================
console.log('\n=== CYCLES SUCCESSIFS D\'EXTENSION ===\n');
{
  GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
  const grid = new Grid(42);
  const CYCLES = 20;
  let ok = true;
  for (let i = 1; i <= CYCLES; i++) {
    grid.grow();
    if (!grid._reachable(null)) { fail(`cycle ${i} : plus de chemin valide depuis un des ${grid.spawns.length} spawns`); ok = false; break; }
    if (grid.cols !== ORIG_COLS + i * 2 || grid.rows !== ORIG_ROWS + i * 2) {
      fail(`cycle ${i} : dimensions incohérentes (${grid.cols}x${grid.rows})`); ok = false; break;
    }
    if (grid.spawns.length > MAP_GROWTH.maxSpawns) { fail(`cycle ${i} : ${grid.spawns.length} spawns, dépasse le plafond ${MAP_GROWTH.maxSpawns}`); ok = false; break; }
  }
  if (ok) {
    console.log(`[PASS] ${CYCLES} extensions d'affilée : carte finale ${grid.cols}x${grid.rows}, ${grid.spawns.length} point(s) de spawn, toujours praticable`);
  }
}

// ============================================================
//  Nouveau point de spawn sur l'anneau — forcé via Math.random mocké,
//  pour tester déterministe les deux branches (ajout / pas d'ajout).
// ============================================================
console.log('\n=== NOUVEAUX POINTS DE SPAWN SUR L\'ANNEAU ===\n');
{
  const realRandom = Math.random;
  try {
    GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
    const grid = new Grid(3);
    const before = grid.spawns.length;

    Math.random = () => 0.99; // > spawnChance : ne doit rien ajouter
    grid.grow();
    if (grid.spawns.length !== before) fail(`un spawn a été ajouté malgré un tirage défavorable (${before} → ${grid.spawns.length})`);
    else console.log(`[PASS] tirage défavorable (0.99) → aucun nouveau spawn (${grid.spawns.length} au total)`);

    Math.random = () => 0; // < spawnChance : doit en ajouter un
    grid.grow();
    if (grid.spawns.length !== before + 1) {
      fail(`aucun nouveau spawn ajouté malgré un tirage favorable (toujours ${grid.spawns.length})`);
    } else {
      const added = grid.spawns[grid.spawns.length - 1];
      const problems = [];
      if (grid.cells[grid.idx(added.x, added.y)] !== CELL.SPAWN) problems.push('la case ajoutée n\'a pas la valeur CELL.SPAWN');
      const onRing = added.x === 0 || added.y === 0 || added.x === grid.cols - 1 || added.y === grid.rows - 1;
      if (!onRing) problems.push('le nouveau spawn n\'est pas sur l\'anneau extérieur fraîchement ajouté');
      if (grid.canPlace(added.x, added.y).ok) problems.push('canPlace autorise à construire directement sur un point de spawn');
      if (problems.length) fail(`nouveau spawn : ${problems.join(' · ')}`);
      else console.log(`[PASS] tirage favorable (0) → nouveau spawn en (${added.x},${added.y}), sur l'anneau, non constructible`);
    }
  } finally {
    Math.random = realRandom;
  }
}

// ============================================================
//  Les ennemis au sol apparaissent bien sur l'un des points de spawn
//  connus de la grille (et pas seulement le premier).
// ============================================================
console.log('\n=== RÉPARTITION DES ENNEMIS SUR PLUSIEURS SPAWNS ===\n');
{
  const realRandom = Math.random;
  try {
    GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
    const grid = new Grid(9);
    Math.random = () => 0; // force l'ajout d'un 2e spawn
    grid.grow();
    Math.random = realRandom;

    if (grid.spawns.length < 2) {
      fail('setup : la grille n\'a toujours qu\'un seul spawn, impossible de tester la répartition');
    } else {
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        const e = new Enemy('grunt', grid, {});
        const match = grid.spawns.find((s) => Math.abs(e.x - grid.cx(s.x)) < 0.01 && Math.abs(e.y - grid.cy(s.y)) < 0.01);
        if (!match) fail(`ennemi #${i} apparaît en (${e.x},${e.y}), qui ne correspond à aucun spawn connu`);
        else seen.add(`${match.x},${match.y}`);
      }
      if (seen.size < 2) fail(`sur 200 ennemis générés, un seul point de spawn a été utilisé (${seen.size}) — la répartition aléatoire ne fonctionne pas`);
      else console.log(`[PASS] 200 ennemis générés, répartis sur ${seen.size}/${grid.spawns.length} points de spawn`);
    }
  } finally {
    Math.random = realRandom;
  }
}

GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
