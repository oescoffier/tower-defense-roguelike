// ============================================================
//  Test headless (Node, sans DOM) : MÉTÉORE (nouvel ennemi volant) doit
//  détruire à sa mort les 13 cases sous lui (losange de rayon 2, distance
//  de Manhattan). La logique d'impact vit dans js/main.js (meteorImpact),
//  qui ne peut pas être importé sans DOM — on vérifie donc ici : (a) la
//  config de l'ennemi ; (b) que le losange de rayon 2 fait bien 13 cases ;
//  (c) que Grid.remove() se comporte comme attendu quand on l'applique
//  sur ce motif (towers dans le losange détruites, tour hors losange
//  intacte, base/spawn jamais touchés car remove() ne touche que
//  CELL.TOWER) — les mêmes primitives que main.js utilise.
// ============================================================
import { ENEMIES, CELL } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Tower } from '../js/towers.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

console.log('\n=== CONFIG MÉTÉORE ===\n');
{
  const def = ENEMIES.meteor;
  check(!!def, 'ENEMIES.meteor existe');
  if (def) {
    check(def.air === true, 'MÉTÉORE est bien un ennemi volant');
    check(def.fallRadius === 2, `MÉTÉORE.fallRadius = ${def.fallRadius}, attendu 2`);

    // Losange (distance de Manhattan) de rayon r : 2r² + 2r + 1 cases.
    let count = 0;
    for (let dx = -def.fallRadius; dx <= def.fallRadius; dx++) {
      for (let dy = -def.fallRadius; dy <= def.fallRadius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= def.fallRadius) count++;
      }
    }
    check(count === 13, `le losange de rayon ${def.fallRadius} couvre ${count} cases, attendu 13`);
  }
}

console.log('\n=== IMPACT AU SOL : détruit les tours dans le losange, épargne le reste ===\n');
{
  const radius = ENEMIES.meteor.fallRadius;
  const grid = new Grid(1);
  const cx = Math.floor(grid.cols / 2), cy = Math.floor(grid.rows / 2);

  const makeGame = () => ({ grid, mods: {}, towers: [] });
  const game = makeGame();

  const placed = [];
  const inRadius = [];
  const outOfRadius = [];

  // Une tour à chaque case libre du losange (jusqu'à distance 2), plus
  // quelques-unes clairement hors du losange (distance 3+).
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      const x = cx + dx, y = cy + dy;
      if (!grid.inBounds(x, y)) continue;
      if (grid.get(x, y) !== CELL.EMPTY) continue;
      if (dist === 0 || dist > 3) continue; // garde une variété raisonnable de distances
      const t = new Tower('mg', x, y, game);
      grid.place(x, y, t);
      game.towers.push(t);
      placed.push({ t, x, y, dist });
      if (dist <= radius) inRadius.push({ t, x, y }); else outOfRadius.push({ t, x, y });
    }
  }

  check(inRadius.length > 0 && outOfRadius.length > 0, `assez de tours des deux côtés pour tester (dans: ${inRadius.length}, hors: ${outOfRadius.length})`);

  // Reproduit exactement la boucle de meteorImpact (js/main.js) : mêmes
  // primitives Grid (cellAt/remove/set), même filtre de distance.
  let removedCount = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const gx = cx + dx, gy = cy + dy;
      if (!grid.inBounds(gx, gy)) continue;
      const cell = grid.cells[grid.idx(gx, gy)];
      if (cell === CELL.BASE || cell === CELL.SPAWN) continue;
      if (cell === CELL.TOWER) {
        const tower = grid.remove(gx, gy);
        if (tower) {
          const ti = game.towers.indexOf(tower);
          if (ti !== -1) game.towers.splice(ti, 1);
          removedCount++;
        }
      }
    }
  }

  check(removedCount === inRadius.length, `${removedCount} tour(s) détruite(s), attendu exactement ${inRadius.length} (celles dans le losange)`);

  let survivorsOk = true;
  for (const { x, y } of outOfRadius) {
    if (grid.towerAt(x, y) === null) survivorsOk = false;
  }
  check(survivorsOk, 'les tours hors du losange (distance > 2) sont toutes intactes');

  let clearedOk = true;
  for (const { x, y } of inRadius) {
    if (grid.towerAt(x, y) !== null) clearedOk = false;
  }
  check(clearedOk, 'les tours dans le losange (distance <= 2) ont bien été retirées de la grille');

  check(game.towers.length === outOfRadius.length, `game.towers ne contient plus que les survivantes (${game.towers.length}/${outOfRadius.length})`);
}

console.log('\n=== BASE/SPAWN : Grid.remove() ne touche jamais une case qui n\'est pas CELL.TOWER ===\n');
{
  const grid = new Grid(1);
  const beforeBase = grid.cells[grid.idx(grid.base.x, grid.base.y)];
  const removed = grid.remove(grid.base.x, grid.base.y);
  const afterBase = grid.cells[grid.idx(grid.base.x, grid.base.y)];
  check(removed === null, 'Grid.remove() sur la case base renvoie null (aucune tour à retirer)');
  check(beforeBase === afterBase, 'la case base n\'est jamais altérée par Grid.remove()');
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
