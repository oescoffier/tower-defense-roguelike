// ============================================================
//  Test headless (Node, sans DOM) : le nerf de mortar.scorched
//  ("cratères permanents"). Vérifie que les cratères d'un mortier sous
//  ce mod (a) ne durent plus 999s mais 60s, (b) sont plafonnés à 8 actifs
//  par tour, et (c) sont bien vidés au démarrage d'une nouvelle vague —
//  pour que la capacité reste forte "pendant la vague" sans s'accumuler
//  sans fin sur toute la partie.
// ============================================================
import { GRID, TARGET } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

function makeGame() {
  const grid = new Grid(1);
  return {
    grid, mods: { 'mortar.scorched': 1 }, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, chainBlastMult: 0.6, onEnemyKilled() {}, onEnemyLeaked() {}
  };
}

const game = makeGame();
const sx = game.grid.spawn.x, sy = game.grid.spawn.y;
const mortar = new Tower('mortar', sx, sy, game);
game.towers.push(mortar);

const enemy = new Enemy('juggernaut', game.grid, {});
const dist = mortar.rangeMinPx + (mortar.rangePx - mortar.rangeMinPx) * 0.5; // dans la fenêtre de tir, pas la zone morte
enemy.x = mortar.px + dist; enemy.y = mortar.py;
game.enemies.push(enemy);

const DT = 1 / 60;
// 20s simulées à cadence mortier (~1 tir/s) : largement de quoi dépasser
// le plafond de cratères actifs si celui-ci n'était pas appliqué.
for (let t = 0; t < 20; t += DT) {
  mortar.update(DT, game);
  for (const p of game.projectiles) p.update(DT, game);
  game.projectiles = game.projectiles.filter((p) => !p.dead);
  enemy.x = mortar.px + dist; enemy.y = mortar.py;
  game.time += DT;
}

check(mortar.craters.length > 0, `des cratères ont bien été créés (${mortar.craters.length})`);
check(mortar.craters.length <= 8, `le nombre de cratères actifs est plafonné à 8 (obtenu : ${mortar.craters.length})`);

const life = mortar.craters.length ? mortar.craters[mortar.craters.length - 1].until - game.time : -1;
check(life > 0 && life <= 61, `la durée de vie d'un cratère "permanent" est bornée à ~60s (obtenu : ${life.toFixed(1)}s), pas 999s`);

mortar.onWaveStart(game);
check(mortar.craters.length === 0, 'les cratères sont bien vidés au démarrage d\'une nouvelle vague');

console.log(fails === 0 ? '\nTOUT EST VERT.' : `\n${fails} PROBLÈME(S) DÉTECTÉ(S).`);
process.exit(fails === 0 ? 0 : 1);
