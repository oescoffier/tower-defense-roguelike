// ============================================================
//  Test headless (Node, sans DOM) : PHALANGE est le contre du duo
//  sniper+mitraillette — armure lourde (punit la mitrailleuse, dégâts
//  par coup faibles rasés par la soustraction à plat) ET arrivée en
//  paquet étalé latéralement (le sniper, qui ignore l'armure, ne peut
//  tuer qu'une poignée d'unités par tir avant que le reste n'arrive).
//  Voir aussi MONOLITHE dans matchups.test.mjs pour le contre-plafond.
// ============================================================
import { ENEMIES } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';
import { hit } from '../js/combat.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

function makeGame() {
  const grid = new Grid(1);
  return {
    grid, mods: {}, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, gold: 0, lives: 10, maxLives: 10,
    chainBlastMult: 0.6, onEnemyKilled() {}, onEnemyLeaked() {}
  };
}

console.log('\n=== PHALANGE : ARMURE PUNIT LA MITRAILLETTE ===\n');
{
  const game = makeGame();
  const mg = new Tower('mg', 0, 0, game);

  const bare = new Enemy('grunt', game.grid, {});
  const phalanx = new Enemy('phalanx', game.grid, {});

  const bareDmg = hit(mg, bare, game, mg.stats.damage, {});
  const phalanxDmg = hit(mg, phalanx, game, mg.stats.damage, {});
  const ratio = phalanxDmg / bareDmg;

  if (!(ratio < 0.5)) fail(`la mitrailleuse ne perd que ${Math.round((1 - ratio) * 100)}% de dégâts contre PHALANGE, attendu > 50%`);
  else console.log(`[PASS] MITRAILLETTE — ${Math.round((1 - ratio) * 100)}% de dégâts perdus contre l'armure de PHALANGE`);
}

console.log('\n=== PHALANGE : LE SNIPER (ignoreArmor) N\'EST PAS RALENTI PAR L\'ARMURE... ===\n');
{
  const game = makeGame();
  const sniper = new Tower('sniper', 0, 0, game);

  const bare = new Enemy('grunt', game.grid, {});
  const phalanx = new Enemy('phalanx', game.grid, {});

  const bareDmg = hit(sniper, bare, game, sniper.stats.damage, { ignoreArmor: true });
  const phalanxDmg = hit(sniper, phalanx, game, sniper.stats.damage, { ignoreArmor: true });
  const ratio = phalanxDmg / bareDmg;

  if (!(ratio > 0.95)) fail(`le sniper perd ${Math.round((1 - ratio) * 100)}% de dégâts contre PHALANGE malgré ignoreArmor, attendu quasi 0%`);
  else console.log(`[PASS] SNIPER — armure de PHALANGE sans effet sur un coup qui l'ignore (${Math.round((1 - ratio) * 100)}% de perte)`);
}

console.log('\n=== ...MAIS ARRIVE EN GRAND NOMBRE, ÉTALÉ, TROP POUR SA CADENCE LENTE ===\n');
{
  const def = ENEMIES.phalanx;
  if (!def) { fail('ENEMIES.phalanx introuvable'); }
  else {
    if (!(def.packSize >= 4)) fail(`PHALANGE.packSize=${def.packSize}, attendu >= 4 (arrive en paquet, pas à l'unité)`);
    else console.log(`[PASS] PHALANGE arrive par paquets de ${def.packSize}`);

    const grid = new Grid(1);
    const N = 400;
    let gruntSum = 0, phalanxSum = 0;
    for (let i = 0; i < N; i++) {
      const g = new Enemy('grunt', grid, {});
      const p = new Enemy('phalanx', grid, {});
      gruntSum += Math.abs(g.offset);
      phalanxSum += Math.abs(p.offset);
    }
    const gruntAvg = gruntSum / N, phalanxAvg = phalanxSum / N;
    if (!(phalanxAvg > gruntAvg * 1.5)) {
      fail(`décalage moyen PHALANGE (${phalanxAvg.toFixed(2)}px) pas assez supérieur au décalage normal (${gruntAvg.toFixed(2)}px) — un sniper qui perce en ligne droite pourrait aligner tout le paquet`);
    } else {
      console.log(`[PASS] décalage moyen : grunt ${gruntAvg.toFixed(2)}px, PHALANGE ${phalanxAvg.toFixed(2)}px (×${(phalanxAvg / gruntAvg).toFixed(2)}) — un paquet étalé, pas aligné pour un seul tir qui perce`);
    }
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
