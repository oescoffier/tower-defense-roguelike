// ============================================================
//  Test headless (Node, sans DOM) : l'ennemi "siège" BÉLIER (def.siege)
//  ignore le flow field — il suit la ligne géométriquement la plus
//  directe vers la base, à travers cailloux ET tours, et rase toute
//  tour rencontrée sur son passage (voir Enemy._moveSiege dans
//  enemies.js et game.onTowerCrushed dans main.js).
// ============================================================
import { CELL } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

function makeGame(grid) {
  const game = {
    grid, mods: {}, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, chainBlastMult: 0.6,
    onEnemyKilled() {}, onEnemyLeaked() {},
    crushed: [],
    onTowerCrushed(tower, siege) { game.crushed.push({ tower, siege }); }
  };
  return game;
}

console.log('\n=== BÉLIER : IGNORE LES OBSTACLES, RASE LES TOURS SUR SA LIGNE DROITE ===\n');
{
  const grid = new Grid(13);
  const game = makeGame(grid);
  const { x: bx, y: by } = grid.base;
  const dir = bx > grid.cols / 2 ? -1 : 1;
  const startX = bx + dir * 6;

  if (!grid.inBounds(startX, by)) {
    fail('setup : la case de départ tombe hors grille pour ce seed (carte trop petite) — à ré-essayer avec un autre seed');
  } else {
    const ram = new Enemy('ram', grid, {});
    // Point de départ contrôlé (plutôt qu'un vrai spawn) pour maîtriser la
    // géométrie du test : même ligne que la base = trajectoire déterministe.
    ram._px = grid.cx(startX); ram._py = grid.cy(by);
    ram._siegePath = null; ram._siegeRepathTimer = 0;
    ram._applyOffset();
    game.enemies.push(ram);

    if (!ram.siege) fail('ENEMIES.ram devrait avoir siege:true');

    // Un caillou ET une tour, tous deux directement sur la ligne droite.
    const rockX = bx + dir * 4;
    grid.set(rockX, by, CELL.ROCK);

    const towerX = bx + dir;
    const tower = new Tower('mg', towerX, by, game);
    grid.place(towerX, by, tower);
    game.towers.push(tower);

    let guard = 0;
    while (!ram.dead && !ram.leaked && guard++ < 6000) {
      ram.update(1 / 60, game);
    }

    const problems = [];
    if (!ram.leaked) problems.push(`n'a jamais atteint la base (${guard} pas simulés)`);
    if (game.crushed.length !== 1) problems.push(`${game.crushed.length} tour(s) signalée(s) écrasée(s) via onTowerCrushed, attendu exactement 1`);
    else if (game.crushed[0].tower !== tower) problems.push('la tour signalée écrasée n\'est pas celle posée sur le chemin');
    if (grid.cells[grid.idx(towerX, by)] === CELL.TOWER) problems.push('la case de la tour est encore marquée CELL.TOWER');
    if (grid.towers[grid.idx(towerX, by)] !== null) problems.push('grid.towers garde encore une référence à la tour rasée');

    if (problems.length) fail(`BÉLIER : ${problems.join(' · ')}`);
    else console.log('[PASS] le BÉLIER traverse un caillou et rase la tour posée sur sa ligne droite, puis atteint la base');
  }
}

console.log('\n=== BÉLIER : repath() est un no-op (il ignore les obstacles par définition) ===\n');
{
  const grid = new Grid(21);
  const ram = new Enemy('ram', grid, {});
  const before = { path: ram._siegePath, index: ram._siegeIndex, timer: ram._siegeRepathTimer };
  ram.repath();
  const after = { path: ram._siegePath, index: ram._siegeIndex, timer: ram._siegeRepathTimer };
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    fail('repath() a modifié l\'état de tracé d\'un BÉLIER — devrait être un no-op pour un ennemi siège');
  } else {
    console.log('[PASS] repath() ne touche pas à l\'état de tracé d\'un BÉLIER');
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
