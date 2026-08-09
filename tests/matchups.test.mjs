// ============================================================
//  Test headless (Node, sans DOM) : vérifie que chaque tourelle a un
//  vrai point fort et un vrai point faible, ancrés dans les mécaniques
//  de combat existantes (armure, bouclier, portée air/sol, chaîne de
//  proximité) plutôt que dans une table de correspondances arbitraire —
//  et que le décalage latéral des ennemis au sol (offset) est bien
//  câblé, en particulier plus large pour les essaims.
// ============================================================
import { GRID, TARGET, TOWERS } from '../js/config.js';
import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';
import { hit, canHit, Weapons } from '../js/combat.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

function makeGame() {
  const grid = new Grid(1);
  return {
    grid, mods: {}, enemies: [], projectiles: [], towers: [],
    vfx: new Vfx(), time: 0, gold: 0, lives: 10, maxLives: 10,
    chainBlastMult: 0.6,
    onEnemyKilled() {}, onEnemyLeaked() {}
  };
}

// ============================================================
//  L'armure plate pénalise bien plus les petits coups (mitrailleuse)
//  qu'un coup unique qui ignore l'armure (sniper) — le vrai "pire
//  ennemi" de la mitrailleuse, la vraie cible de choix du sniper.
// ============================================================
console.log('\n=== ARMURE : MITRAILLETTE vs SNIPER ===\n');
{
  const game = makeGame();
  const mg = new Tower('mg', 0, 0, game);
  const sniper = new Tower('sniper', 0, 0, game);

  const mkPair = () => {
    const bare = new Enemy('grunt', game.grid, {});
    const armored = new Enemy('grunt', game.grid, {});
    armored.armor = 22; // même PV, blindage "COLOSSE"
    return { bare, armored };
  };

  const mgPair = mkPair();
  const mgBareDmg = hit(mg, mgPair.bare, game, mg.stats.damage, {});
  const mgArmoredDmg = hit(mg, mgPair.armored, game, mg.stats.damage, {});
  const mgRatio = mgArmoredDmg / mgBareDmg;

  const snPair = mkPair();
  const snBareDmg = hit(sniper, snPair.bare, game, sniper.stats.damage, { ignoreArmor: true });
  const snArmoredDmg = hit(sniper, snPair.armored, game, sniper.stats.damage, { ignoreArmor: true });
  const snRatio = snArmoredDmg / snBareDmg;

  if (!(mgRatio < 0.5)) fail(`la mitrailleuse ne perd que ${Math.round((1 - mgRatio) * 100)}% de dégâts contre un blindage lourd, attendu > 50%`);
  else console.log(`[PASS] MITRAILLETTE — ${Math.round((1 - mgRatio) * 100)}% de dégâts perdus contre un blindage lourd (pire ennemi)`);

  if (!(snRatio > 0.95)) fail(`le sniper perd ${Math.round((1 - snRatio) * 100)}% de dégâts contre un blindage lourd malgré ignoreArmor, attendu quasi 0%`);
  else console.log(`[PASS] SNIPER — ignore l'armure, ${Math.round((1 - snRatio) * 100)}% de perte seulement (cible de choix)`);
}

// ============================================================
//  La brûlure (lance-flamme) ignore l'armure, contrairement à un coup
//  "normal" — c'est ce qui en fait une arme anti-blindage à part entière.
// ============================================================
console.log('\n=== L\'ARMURE N\'ARRÊTE PAS LA BRÛLURE ===\n');
{
  const grid = new Grid(1);
  const normalHit = new Enemy('grunt', grid, {});
  normalHit.armor = 22;
  normalHit.hp = normalHit.maxHp = 200; // assez de PV pour que le plafond "min(hp, dmg)" ne fausse pas la mesure
  const appliedNormal = normalHit.damage(50, {}, null);

  const burnHit = new Enemy('grunt', grid, {});
  burnHit.armor = 22;
  burnHit.hp = burnHit.maxHp = 200;
  const appliedBurn = burnHit.damage(50, { type: 'burn' }, null);

  if (!(appliedNormal < 50)) fail(`un coup normal contre 22 d'armure ne devrait pas passer intégralement (obtenu ${appliedNormal}/50)`);
  if (appliedBurn !== 50) fail(`la brûlure devrait ignorer l'armure et passer intégralement (obtenu ${appliedBurn}/50)`);
  if (appliedNormal < 50 && appliedBurn === 50) {
    console.log(`[PASS] coup normal réduit à ${appliedNormal}/50 par l'armure, brûlure intacte à ${appliedBurn}/50`);
  }
}

// ============================================================
//  Mortier et lance-flamme sont strictement sol, DCA strictement air —
//  leur "pire ennemi" au sens le plus absolu : le mauvais domaine.
// ============================================================
console.log('\n=== DOMAINES SOL / AIR EXCLUSIFS ===\n');
{
  const grid = new Grid(1);
  const groundE = new Enemy('grunt', grid, {});
  const airE = new Enemy('drone', grid, {});

  const problems = [];
  if (TOWERS.mortar.targets !== TARGET.GROUND) problems.push('mortar.targets n\'est plus GROUND');
  if (TOWERS.flame.targets !== TARGET.GROUND) problems.push('flame.targets n\'est plus GROUND');
  if (TOWERS.aa.targets !== TARGET.AIR) problems.push('aa.targets n\'est plus AIR');
  if (canHit(airE, TARGET.GROUND)) problems.push('un aérien est considéré atteignable par un masque GROUND');
  if (canHit(groundE, TARGET.AIR)) problems.push('un ennemi au sol est considéré atteignable par un masque AIR');

  if (problems.length) fail(problems.join(' · '));
  else console.log('[PASS] mortier/lance-flamme = sol uniquement, DCA = air uniquement (aveugles à l\'autre domaine)');
}

// ============================================================
//  Décalage latéral (offset) : câblé, et nettement plus large pour un
//  essaim (spread) que pour un ennemi normal.
// ============================================================
console.log('\n=== DÉCALAGE LATÉRAL DES ENNEMIS AU SOL ===\n');
{
  const grid = new Grid(1);
  const N = 400;
  let gruntSum = 0, swarmSum = 0;
  let anyGruntMoved = false;
  for (let i = 0; i < N; i++) {
    const g = new Enemy('grunt', grid, {});
    const s = new Enemy('swarm', grid, {});
    gruntSum += Math.abs(g.offset);
    swarmSum += Math.abs(s.offset);
    if (Math.abs(g.x - g._px) > 0.01 || Math.abs(g.y - g._py) > 0.01) anyGruntMoved = true;
  }
  const gruntAvg = gruntSum / N, swarmAvg = swarmSum / N;

  if (!anyGruntMoved) fail('aucun ennemi ne présente de décalage x/_px — le champ "offset" n\'est toujours pas câblé');
  else if (!(swarmAvg > gruntAvg * 1.8)) {
    fail(`décalage moyen essaim (${swarmAvg.toFixed(2)}px) pas assez supérieur au décalage normal (${gruntAvg.toFixed(2)}px)`);
  } else {
    console.log(`[PASS] décalage moyen : grunt ${gruntAvg.toFixed(2)}px, essaim ${swarmAvg.toFixed(2)}px (×${(swarmAvg / gruntAvg).toFixed(2)}) — un tir qui perce en ligne droite ne peut plus aligner tout un essaim`);
  }
}

// ============================================================
//  Le tesla ne vaut que par la proximité : un ennemi esseulé ne prend
//  qu'un coup, un groupe compact se fait chaîner entièrement.
// ============================================================
console.log('\n=== TESLA : CHAÎNE VS CIBLE ISOLÉE ===\n');
{
  function fireScenario(clustered) {
    const game = makeGame();
    const cx = Math.floor(GRID.cols / 2), cy = Math.floor(GRID.rows / 2);
    const tower = new Tower('tesla', cx, cy, game);
    game.towers.push(tower);

    const primary = new Enemy('grunt', game.grid, {});
    primary.x = tower.px + 40; primary.y = tower.py;
    game.enemies.push(primary);

    if (clustered) {
      for (let i = 0; i < 3; i++) {
        const e = new Enemy('grunt', game.grid, {});
        e.x = primary.x + 20 + i * 12; e.y = primary.y + (i - 1) * 12;
        game.enemies.push(e);
      }
    } else {
      const far = new Enemy('grunt', game.grid, {});
      far.x = tower.px + 3000; far.y = tower.py + 3000;
      game.enemies.push(far);
    }

    Weapons.tesla(tower, game, primary);
    return game.enemies.filter((e) => e.hp < e.maxHp).length;
  }

  const solo = fireScenario(false);
  const cluster = fireScenario(true);

  if (solo !== 1) fail(`cible esseulée : ${solo} ennemi(s) touché(s), attendu exactement 1 (pas de cible à portée pour chaîner)`);
  else if (!(cluster > solo)) fail(`groupe compact : ${cluster} ennemi(s) touché(s), pas plus que la cible esseulée (${solo}) — la chaîne ne fonctionne pas`);
  else console.log(`[PASS] cible esseulée → ${solo} touché, groupe compact → ${cluster} touchés (chaîne bien dépendante de la proximité)`);
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
