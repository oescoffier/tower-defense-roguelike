// ============================================================
//  Test headless (Node, sans DOM) : le mortier n'a plus de zones de
//  dégâts persistantes ("cratères") — elles faisaient trop de lag
//  (tours × zones × ennemis vérifiés chaque frame) et de trop grandes
//  taches à l'écran. Vérifie : (a) plus aucun dégât après l'impact
//  initial, pour un tir normal comme pour la variante OGIVE NUCLÉAIRE
//  (désormais une seconde salve immédiate, pas une zone qui dure) ;
//  (b) TERRE BRÛLÉE (mortar.scorched) embrase la cible touchée au lieu
//  de faire durer une zone.
// ============================================================
import { GRID, VARIANT_BY_ID } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

function makeGame(mods = {}) {
  const grid = new Grid(1);
  return {
    grid, mods, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, chainBlastMult: 0.6, onEnemyKilled() {}, onEnemyLeaked() {}
  };
}

function fireAndResolve(game, mortar, target, simSeconds = 3) {
  const DT = 1 / 60;
  for (let t = 0; t < simSeconds; t += DT) {
    mortar.update(DT, game);
    for (const p of game.projectiles) p.update(DT, game);
    game.projectiles = game.projectiles.filter((p) => !p.dead);
    target.x = mortar.px + mortar.rangeMinPx + (mortar.rangePx - mortar.rangeMinPx) * 0.5;
    target.y = mortar.py;
    game.time += DT;
  }
}

console.log('\n=== MORTIER NORMAL : aucun dégât après l\'impact initial ===\n');
{
  const game = makeGame();
  const mortar = new Tower('mortar', 0, 0, game);
  game.towers.push(mortar);

  check(mortar.craters === undefined, 'Tower.craters n\'existe plus (mécanisme retiré)');

  const enemy = new Enemy('juggernaut', game.grid, {});
  enemy.x = mortar.px + mortar.rangeMinPx + (mortar.rangePx - mortar.rangeMinPx) * 0.5;
  enemy.y = mortar.py;
  game.enemies.push(enemy);

  // Un seul tir résolu, puis on laisse le temps passer SANS que d'autres
  // tirs ne partent (rate très bas, 3s < 1/rate) : l'ennemi reste dans le
  // rayon d'impact tout du long.
  fireAndResolve(game, mortar, enemy, 3);
  const hpAfterFirstShot = enemy.hp;
  check(hpAfterFirstShot < enemy.maxHp, `le premier obus inflige bien des dégâts (${enemy.maxHp - hpAfterFirstShot} dégâts)`);

  // 2 secondes de plus, aucun nouveau tir (cadence mortier ~0.7/s donc un
  // second tir a pu partir — on ne regarde que l'ABSENCE de saignement
  // continu en dehors des tirs eux-mêmes, en comparant à un enfant témoin
  // qui n'est jamais dans le rayon d'aucun tir).
  const witness = new Enemy('juggernaut', game.grid, {});
  witness.x = mortar.px + mortar.rangeMinPx + (mortar.rangePx - mortar.rangeMinPx) * 0.5 + 500;
  witness.y = mortar.py + 500;
  game.enemies.push(witness);
  for (let t = 0; t < 2; t += 1 / 60) {
    mortar.update(1 / 60, game);
    for (const p of game.projectiles) p.update(1 / 60, game);
    game.projectiles = game.projectiles.filter((p) => !p.dead);
    game.time += 1 / 60;
  }
  check(witness.hp === witness.maxHp, 'un ennemi jamais touché par un obus ne perd aucun PV (pas de zone qui traîne)');
}

console.log('\n=== TERRE BRÛLÉE (mortar.scorched) : embrase la cible au lieu d\'une zone qui dure ===\n');
{
  const game = makeGame({ 'mortar.scorched': 1 });
  const mortar = new Tower('mortar', 0, 0, game);
  game.towers.push(mortar);

  const enemy = new Enemy('juggernaut', game.grid, {});
  enemy.x = mortar.px + mortar.rangeMinPx + (mortar.rangePx - mortar.rangeMinPx) * 0.5;
  enemy.y = mortar.py;
  game.enemies.push(enemy);

  fireAndResolve(game, mortar, enemy, 1.5);
  check(enemy.burning, 'la cible touchée est en feu après un impact sous mortar.scorched');
}

console.log('\n=== OGIVE NUCLÉAIRE : une seconde salve immédiate, jamais de zone persistante ===\n');
{
  const nukeVariant = VARIANT_BY_ID['mortar_nuke'];
  if (!nukeVariant) {
    fails++; console.log('[FAIL] variante "mortar_nuke" introuvable dans VARIANT_BY_ID');
  } else {
    const gameNuke = makeGame();
    gameNuke.loadout = { mortar: 'mortar_nuke' };
    const nukeTower = new Tower('mortar', 0, 0, gameNuke);
    gameNuke.towers.push(nukeTower);
    check(nukeTower.craters === undefined, 'Tower.craters n\'existe plus, même pour la variante OGIVE NUCLÉAIRE');

    const gameBase = makeGame();
    const baseTower = new Tower('mortar', 0, 0, gameBase);
    gameBase.towers.push(baseTower);

    const eNuke = new Enemy('juggernaut', gameNuke.grid, {});
    eNuke.x = nukeTower.px + nukeTower.rangeMinPx + (nukeTower.rangePx - nukeTower.rangeMinPx) * 0.5;
    eNuke.y = nukeTower.py;
    gameNuke.enemies.push(eNuke);

    const eBase = new Enemy('juggernaut', gameBase.grid, {});
    eBase.x = baseTower.px + baseTower.rangeMinPx + (baseTower.rangePx - baseTower.rangeMinPx) * 0.5;
    eBase.y = baseTower.py;
    gameBase.enemies.push(eBase);

    // L'ogive nucléaire tire très lentement (rate ×0.23) : assez de temps
    // pour un seul impact résolu, pas pour un second tir.
    fireAndResolve(gameNuke, nukeTower, eNuke, 2.5);
    fireAndResolve(gameBase, baseTower, eBase, 2.5);

    const nukeDmg = eNuke.maxHp - eNuke.hp;
    const baseDmg = eBase.maxHp - eBase.hp;
    check(nukeDmg > baseDmg, `un impact d'OGIVE NUCLÉAIRE inflige plus de dégâts au total (explosion + retombée) qu'un tir normal (${nukeDmg} vs ${baseDmg})`);

    // Plus aucun dégât une fois l'impact résolu, même en laissant le temps passer.
    const hpAfterImpact = eNuke.hp;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      nukeTower.update(1 / 60, gameNuke);
      for (const p of gameNuke.projectiles) p.update(1 / 60, gameNuke);
      gameNuke.projectiles = gameNuke.projectiles.filter((p) => !p.dead);
      gameNuke.time += 1 / 60;
    }
    check(eNuke.hp === hpAfterImpact, `aucun dégât supplémentaire après la résolution de l'impact (${hpAfterImpact} → ${eNuke.hp}, pas de zone qui traîne)`);
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
