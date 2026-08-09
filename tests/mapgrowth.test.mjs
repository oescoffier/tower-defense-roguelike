// ============================================================
//  Test headless (Node, sans DOM) : vérifie la courbe de difficulté
//  longue distance (nombre d'ennemis, dégâts de fuite qui montent avec
//  la vague) et la mécanique d'extension infinie de la carte
//  (Grid.grow() : +1 case tout autour toutes les MAP_GROWTH.every
//  vagues, avec de nouveaux points de spawn possibles sur l'anneau).
// ============================================================
import { GRID, CELL, MAP_GROWTH, PALETTE, waveCount, waveLeakMult } from '../js/config.js';
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
//  Nouveau point de spawn — Grid._addRingSpawn() testé directement et
//  isolément (Math.random mocké UNIQUEMENT autour de cet appel, pour ne
//  pas interférer avec le semis de cailloux qui, lui, utilise aussi le
//  hasard) : les deux branches, ajout / pas d'ajout.
// ============================================================
console.log('\n=== NOUVEAUX POINTS DE SPAWN SUR L\'ANNEAU (_addRingSpawn) ===\n');
{
  const realRandom = Math.random;
  try {
    GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
    const grid = new Grid(3);
    grid.grow(); // anneau réel, pour avoir de vraies cases candidates
    const before = grid.spawns.length;

    Math.random = () => 0.99; // > spawnChance : ne doit rien ajouter
    const missed = grid._addRingSpawn();
    Math.random = realRandom;
    if (missed !== null || grid.spawns.length !== before) {
      fail(`un spawn a été ajouté malgré un tirage défavorable (${before} → ${grid.spawns.length})`);
    } else {
      console.log(`[PASS] tirage défavorable (0.99) → aucun nouveau spawn (${grid.spawns.length} au total)`);
    }

    Math.random = () => 0.01; // < spawnChance : doit en ajouter un
    const added = grid._addRingSpawn();
    Math.random = realRandom;
    if (!added || grid.spawns.length !== before + 1) {
      fail(`aucun nouveau spawn ajouté malgré un tirage favorable (toujours ${grid.spawns.length})`);
    } else {
      const problems = [];
      if (grid.cells[grid.idx(added.x, added.y)] !== CELL.SPAWN) problems.push('la case ajoutée n\'a pas la valeur CELL.SPAWN');
      const onRing = added.x === 0 || added.y === 0 || added.x === grid.cols - 1 || added.y === grid.rows - 1;
      if (!onRing) problems.push('le nouveau spawn n\'est pas sur l\'anneau extérieur fraîchement ajouté');
      if (grid.canPlace(added.x, added.y).ok) problems.push('canPlace autorise à construire directement sur un point de spawn');
      const distToBase = Math.hypot(added.x - grid.base.x, added.y - grid.base.y);
      if (distToBase < MAP_GROWTH.minSpawnDistFromBase) problems.push(`trop près de la base (${distToBase.toFixed(1)} case(s), minimum ${MAP_GROWTH.minSpawnDistFromBase})`);
      if (problems.length) fail(`nouveau spawn : ${problems.join(' · ')}`);
      else console.log(`[PASS] tirage favorable → nouveau spawn en (${added.x},${added.y}), sur l'anneau, à ${distToBase.toFixed(1)} cases de la base, non constructible`);
    }
  } finally {
    Math.random = realRandom;
  }
}

// ============================================================
//  Un nouveau spawn n'est jamais tenté à chaque extension : seulement
//  une extension sur MAP_GROWTH.spawnEvery (donc pas toutes les 10 vagues).
// ============================================================
console.log('\n=== LES NOUVEAUX SPAWNS NE SONT PAS LIÉS À CHAQUE EXTENSION ===\n');
{
  GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
  const grid = new Grid(17);
  let violation = null;
  for (let i = 1; i <= 12 && !violation; i++) {
    const before = grid.spawns.length;
    grid.grow();
    const added = grid.spawns.length > before;
    if (added && grid.growthCount % MAP_GROWTH.spawnEvery !== 0) {
      violation = `spawn ajouté au cycle ${i} (growthCount=${grid.growthCount}), pas un multiple de spawnEvery=${MAP_GROWTH.spawnEvery}`;
    }
  }
  if (violation) fail(violation);
  else console.log(`[PASS] sur 12 extensions, aucun nouveau spawn hors des cycles multiples de spawnEvery=${MAP_GROWTH.spawnEvery} (growthCount final : ${grid.growthCount})`);
}

// ============================================================
//  L'anneau fraîchement ajouté n'est pas un vide parfait : des cailloux
//  y apparaissent aussi (vérifié statistiquement sur plusieurs extensions,
//  Math.random réel).
// ============================================================
console.log('\n=== CAILLOUX SUR LES NOUVEAUX ANNEAUX ===\n');
{
  GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
  const grid = new Grid(5);
  let rockCells = 0, ringCells = 0;
  for (let cycle = 0; cycle < 6; cycle++) {
    grid.grow();
    for (let x = 0; x < grid.cols; x++) {
      for (const y of [0, grid.rows - 1]) {
        ringCells++;
        if (grid.cells[grid.idx(x, y)] === CELL.ROCK) rockCells++;
      }
    }
    for (let y = 1; y < grid.rows - 1; y++) {
      for (const x of [0, grid.cols - 1]) {
        ringCells++;
        if (grid.cells[grid.idx(x, y)] === CELL.ROCK) rockCells++;
      }
    }
  }
  if (rockCells === 0) fail(`aucun caillou trouvé sur ${ringCells} cases d'anneau après 6 extensions — grow() n'en génère plus`);
  else console.log(`[PASS] ${rockCells}/${ringCells} cases d'anneau sont des cailloux après 6 extensions, carte toujours praticable`);
}

// ============================================================
//  Un chemin distinct (et une couleur distincte) par point de spawn.
// ============================================================
console.log('\n=== CHEMINS MULTIPLES PAR SPAWN ===\n');
{
  const realChance = MAP_GROWTH.spawnChance;
  try {
    GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
    const grid = new Grid(11);
    grid.grow(); // growthCount=1 : pas de tentative de spawn
    // growthCount=2 (multiple de spawnEvery) : on force le TIRAGE DE
    // CHANCE à réussir à coup sûr (spawnChance=1), mais Math.random()
    // lui-même reste réel — sinon le semis de cailloux ET la boucle de
    // réparation anti-blocage (qui rouvre des roches AU HASARD tant que
    // ce n'est pas praticable) tirent toujours le même index et restent
    // bloqués sur la même case, incapables de vraiment réparer quoi que
    // ce soit.
    MAP_GROWTH.spawnChance = 1;
    grid.grow();
    MAP_GROWTH.spawnChance = realChance;

    const problems = [];
    if (!grid.paths || grid.paths.length !== grid.spawns.length) {
      problems.push(`grid.paths a ${grid.paths ? grid.paths.length : 0} entrée(s), attendu ${grid.spawns.length} (un par spawn)`);
    } else {
      for (let i = 0; i < grid.spawns.length; i++) {
        const p = grid.paths[i];
        if (!p || p.length < 2) problems.push(`spawn #${i} : chemin vide ou trop court`);
        else if (p[0].x !== grid.spawns[i].x || p[0].y !== grid.spawns[i].y) problems.push(`spawn #${i} : le chemin ne part pas de son propre spawn`);
      }
    }
    if (PALETTE.pathColors.length < MAP_GROWTH.maxSpawns) {
      problems.push(`seulement ${PALETTE.pathColors.length} couleurs pour jusqu'à ${MAP_GROWTH.maxSpawns} spawns possibles`);
    }
    if (problems.length) fail(`chemins multiples : ${problems.join(' · ')}`);
    else console.log(`[PASS] ${grid.spawns.length} spawn(s) → ${grid.paths.length} chemin(s) distincts, chacun avec sa propre couleur disponible`);
  } finally {
    MAP_GROWTH.spawnChance = realChance;
  }
}

// ============================================================
//  Les ennemis au sol apparaissent bien sur l'un des points de spawn
//  connus de la grille (et pas seulement le premier).
// ============================================================
console.log('\n=== RÉPARTITION DES ENNEMIS SUR PLUSIEURS SPAWNS ===\n');
{
  const realChance = MAP_GROWTH.spawnChance;
  try {
    GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
    const grid = new Grid(9);
    grid.grow(); // growthCount=1 : pas de tentative de spawn
    // growthCount=2 : force le tirage de chance à réussir (spawnChance=1)
    // sans jamais mocker Math.random lui-même — voir le commentaire
    // détaillé dans "CHEMINS MULTIPLES PAR SPAWN" ci-dessus.
    MAP_GROWTH.spawnChance = 1;
    grid.grow();
    MAP_GROWTH.spawnChance = realChance;

    if (grid.spawns.length < 2) {
      fail('setup : la grille n\'a toujours qu\'un seul spawn, impossible de tester la répartition');
    } else {
      // _px/_py est la position logique de pathing (non décalée) : c'est
      // elle qui doit tomber exactement sur un spawn connu. x/y (publique)
      // porte en plus le décalage latéral anti-file-indienne, donc ne peut
      // plus être comparée au pixel près.
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        const e = new Enemy('grunt', grid, {});
        const match = grid.spawns.find((s) => Math.abs(e._px - grid.cx(s.x)) < 0.01 && Math.abs(e._py - grid.cy(s.y)) < 0.01);
        if (!match) fail(`ennemi #${i} apparaît en (${e._px},${e._py}), qui ne correspond à aucun spawn connu`);
        else seen.add(`${match.x},${match.y}`);
      }
      if (seen.size < 2) fail(`sur 200 ennemis générés, un seul point de spawn a été utilisé (${seen.size}) — la répartition aléatoire ne fonctionne pas`);
      else console.log(`[PASS] 200 ennemis générés, répartis sur ${seen.size}/${grid.spawns.length} points de spawn`);
    }
  } finally {
    MAP_GROWTH.spawnChance = realChance;
  }
}

// ============================================================
//  Un nouveau spawn perce le chemin géométriquement le plus court vers la
//  base, rasant cailloux ET tours sur son passage (voir
//  Grid._carvePathToBase, appelé depuis grow()).
// ============================================================
console.log('\n=== PERÇAGE DU CHEMIN VERS LA BASE (nouveaux spawns) ===\n');
{
  GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;
  const grid = new Grid(23);
  const { x: bx, y: by } = grid.base;

  // Un "spawn" fictif sur la MÊME ligne que la base : la ligne droite est
  // alors l'UNIQUE chemin le plus court (tout détour serait plus long),
  // donc le tracé de _carvePathToBase est déterministe et testable.
  const dir = bx > grid.cols / 2 ? -1 : 1; // s'éloigne vers l'intérieur de la grille
  const spawnX = bx + dir * 5;
  if (!grid.inBounds(spawnX, by)) {
    fail('setup : impossible de placer un spawn fictif sur la même ligne que la base (carte trop petite)');
  } else {
    const fakeSpawn = { x: spawnX, y: by };
    const towerX = bx + dir; // case adjacente à la base, sur la ligne droite : forcément sur le chemin
    const fakeTower = { id: 'fake-tower' };
    grid.set(towerX, by, CELL.TOWER);
    grid.towers[grid.idx(towerX, by)] = fakeTower;

    const destroyed = grid._carvePathToBase(fakeSpawn);

    const problems = [];
    if (!destroyed.includes(fakeTower)) problems.push('la tour sur le chemin le plus court n\'a pas été détruite');
    if (grid.cells[grid.idx(towerX, by)] !== CELL.EMPTY) problems.push('la case de la tour détruite n\'est pas repassée à CELL.EMPTY');
    if (grid.towers[grid.idx(towerX, by)] !== null) problems.push('grid.towers garde encore une référence à la tour détruite');
    if (problems.length) fail(`perçage du chemin : ${problems.join(' · ')}`);
    else console.log(`[PASS] une tour posée sur le chemin le plus court entre un nouveau spawn et la base est bien détruite (case libérée)`);
  }

  // Une tour HORS du chemin le plus court ne doit jamais être touchée.
  {
    const grid2 = new Grid(29);
    const { x: bx2, y: by2 } = grid2.base;
    const dir2 = bx2 > grid2.cols / 2 ? -1 : 1;
    const spawnX2 = bx2 + dir2 * 5;
    if (grid2.inBounds(spawnX2, by2) && grid2.inBounds(bx2, by2 + 1)) {
      const offPathTower = { id: 'off-path-tower' };
      // Une case décalée d'une ligne : hors de la ligne droite (seul plus court chemin).
      grid2.set(bx2 + dir2, by2 + 1, CELL.TOWER);
      grid2.towers[grid2.idx(bx2 + dir2, by2 + 1)] = offPathTower;

      const destroyed2 = grid2._carvePathToBase({ x: spawnX2, y: by2 });
      if (destroyed2.includes(offPathTower)) fail('une tour hors du chemin le plus court a été détruite à tort');
      else console.log('[PASS] une tour hors du chemin le plus court n\'est jamais touchée');
    }
  }
}

GRID.cols = ORIG_COLS; GRID.rows = ORIG_ROWS;

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
