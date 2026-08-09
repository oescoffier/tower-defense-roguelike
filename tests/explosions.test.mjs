// ============================================================
//  Test headless (Node, sans DOM) : quand plusieurs explosions tombent
//  quasi au même endroit et au même instant (mortiers multiples, tir
//  groupé), Vfx.explosion() n'affiche le plein rendu (2 anneaux + 50+
//  particules) que pour la première — les suivantes, redondantes à
//  l'œil, se contentent d'un éclat réduit au lieu d'empiler le coût
//  complet plusieurs fois. Voir js/vfx.js.
// ============================================================
import { FX } from '../js/config.js';
import { Vfx } from '../js/vfx.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

console.log('\n=== DEUX EXPLOSIONS AU MÊME ENDROIT, AU MÊME INSTANT : la 2e est allégée ===\n');
{
  const vfx = new Vfx();
  vfx.explosion(100, 100, 60, '#ff5533', 1);
  const countAfterFirst = vfx.particles.length;
  const ringsAfterFirst = vfx.rings.length;

  vfx.explosion(105, 98, 60, '#ff5533', 1); // quasi au même endroit
  const countAfterSecond = vfx.particles.length;
  const ringsAfterSecond = vfx.rings.length;

  const addedBySecond = countAfterSecond - countAfterFirst;
  const ringsAddedBySecond = ringsAfterSecond - ringsAfterFirst;

  check(addedBySecond > 0, `la 2e explosion ajoute quand même un minimum de particules visibles (${addedBySecond})`);
  check(addedBySecond < countAfterFirst, `la 2e explosion (${addedBySecond} particules) coûte nettement moins que la 1re (${countAfterFirst} particules)`);
  check(ringsAddedBySecond < ringsAfterFirst, `la 2e explosion ajoute moins d'anneaux (${ringsAddedBySecond}) que la 1re (${ringsAfterFirst})`);
}

console.log('\n=== EXPLOSIONS ÉLOIGNÉES DANS L\'ESPACE : chacune reçoit le plein rendu ===\n');
{
  const vfx = new Vfx();
  vfx.explosion(0, 0, 60, '#ff5533', 1);
  const countAfterFirst = vfx.particles.length;

  vfx.explosion(2000, 2000, 60, '#ff5533', 1); // loin, aucun rapport
  const addedBySecond = vfx.particles.length - countAfterFirst;

  check(addedBySecond >= countAfterFirst - 1, `deux explosions sans rapport spatial reçoivent chacune le plein rendu (1re: ${countAfterFirst}, 2e: ${addedBySecond})`);
}

console.log('\n=== EXPLOSIONS AU MÊME ENDROIT MAIS ESPACÉES DANS LE TEMPS : chacune reçoit le plein rendu ===\n');
{
  const vfx = new Vfx();
  vfx.explosion(50, 50, 60, '#ff5533', 1);
  const countAfterFirst = vfx.particles.length;

  vfx.update(FX.explosionCombineWindow + 0.05); // laisse passer la fenêtre de regroupement
  vfx.explosion(50, 50, 60, '#ff5533', 1);
  const addedBySecond = vfx.particles.length - countAfterFirst;

  check(addedBySecond >= countAfterFirst - 1, `une fois la fenêtre de regroupement passée, une explosion au même endroit reçoit de nouveau le plein rendu (1re: ${countAfterFirst}, 2e: ${addedBySecond})`);
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
