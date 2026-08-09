// ============================================================
//  Test headless (Node, sans DOM) : le réglage "EFFETS VISUELS" du menu
//  pause (Vfx.enabled, piloté par save.vfxEnabled) coupe LITTÉRALEMENT
//  TOUS les émetteurs de Vfx — particules, anneaux, arcs, rayons,
//  cratères, secousse, flash, chromatique, ET les nombres de dégâts /
//  textes flottants (les "points jaunes" et "trucs des dégâts").
//  Voir js/vfx.js et js/save.js.
// ============================================================
import { Vfx } from '../js/vfx.js';
import { Save } from '../js/save.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

console.log('\n=== Vfx.enabled = false : STRICTEMENT AUCUN émetteur ne produit quoi que ce soit ===\n');
{
  const vfx = new Vfx();
  vfx.enabled = false;

  vfx.particle(0, 0, 1, 1, 1, '#fff', 2);
  vfx.ring(0, 0, 1, 10, 0.3, '#fff');
  vfx.arc([{ x: 0, y: 0 }, { x: 10, y: 10 }], 0.3, '#fff');
  vfx.beam(0, 0, 10, 10, 0.3, '#fff', 2);
  vfx.crater(0, 0, 10);
  vfx.addShake(10);
  vfx.addFlash(1);
  vfx.addChroma(10);
  vfx.damageNumber(0, 0, 42);
  vfx.floatText(0, 0, 'PERCÉE');
  vfx.explosion(0, 0, 60);
  vfx.impact(0, 0);
  vfx.muzzle(0, 0, 0);

  check(vfx.particles.length === 0, 'aucune particule émise');
  check(vfx.rings.length === 0, 'aucun anneau émis');
  check(vfx.arcs.length === 0, 'aucun arc émis');
  check(vfx.beams.length === 0, 'aucun rayon émis');
  check(vfx.craters.length === 0, 'aucun cratère émis');
  check(vfx.shake === 0, 'aucune secousse accumulée');
  check(vfx.flash === 0, 'aucun flash accumulé');
  check(vfx.chroma === 0, 'aucune aberration chromatique accumulée');
  check(vfx.numbers.length === 0, 'aucun nombre de dégâts (les "points jaunes") émis');
  check(vfx.texts.length === 0, 'aucun texte flottant émis');
}

console.log('\n=== Vfx.enabled = false : TOUTES les méthodes composées, une par une, n\'ajoutent RIEN ===\n');
{
  // Un bug passé (coin(), qui poussait directement dans this.particles
  // sans passer par particle()) a laissé des particules dorées s'afficher
  // sur les ennemis tués MÊME effets visuels coupés. On balaye ici toutes
  // les méthodes publiques de Vfx une par une (primitives ET composées),
  // effets coupés, et on vérifie qu'AUCUNE ne modifie le moindre état —
  // pour qu'un futur ajout qui pousserait directement dans un tableau
  // interne (au lieu de passer par un émetteur déjà gardé) échoue ici.
  const fakeEnemy = { x: 0, y: 0, color: '#f0d24b', radius: 12, boss: false, air: false };
  const calls = [
    ['particle', [0, 0, 1, 1, 1, '#fff', 2]],
    ['ring', [0, 0, 1, 10, 0.3, '#fff']],
    ['arc', [[{ x: 0, y: 0 }, { x: 10, y: 10 }], 0.3, '#fff']],
    ['beam', [0, 0, 10, 10, 0.3, '#fff', 2]],
    ['damageNumber', [0, 0, 42]],
    ['floatText', [0, 0, 'X']],
    ['crater', [0, 0, 10]],
    ['addShake', [10]],
    ['addFlash', [1]],
    ['addChroma', [10]],
    ['addSlowmo', [0.5]],
    ['muzzle', [0, 0, 0]],
    ['shell', [0, 0, 0]],
    ['impact', [0, 0]],
    ['explosion', [0, 0, 60]],
    ['smoke', [0, 0]],
    ['lightning', [0, 0, 10, 10]],
    ['flameJet', [0, 0, 0, 40, 0.5]],
    ['coin', [0, 0, 100, 100]],
    ['healSpark', [0, 0]],
    ['shieldBreak', [0, 0]],
    ['death', [fakeEnemy]],
    ['towerPlaced', [0, 0, '#fff']],
    ['towerSold', [0, 0]]
  ];

  for (const [name, args] of calls) {
    const vfx = new Vfx();
    vfx.enabled = false;
    const snapshot = () => JSON.stringify({
      p: vfx.particles.length, r: vfx.rings.length, a: vfx.arcs.length,
      b: vfx.beams.length, n: vfx.numbers.length, t: vfx.texts.length,
      c: vfx.craters.length, shake: vfx.shake, flash: vfx.flash,
      chroma: vfx.chroma, slowmo: vfx.slowmo
    });
    const before = snapshot();
    if (typeof vfx[name] !== 'function') { check(false, `Vfx.${name} n'existe plus (test à mettre à jour)`); continue; }
    vfx[name](...args);
    const after = snapshot();
    check(before === after, `Vfx.${name}(...) n'ajoute rien quand enabled=false`);
  }
}

console.log('\n=== Vfx.enabled = true (par défaut) : tout fonctionne normalement ===\n');
{
  const vfx = new Vfx();
  vfx.explosion(0, 0, 60);
  vfx.damageNumber(0, 0, 42);
  vfx.floatText(0, 0, 'PERCÉE');
  check(vfx.particles.length > 0, 'les particules fonctionnent normalement quand les effets visuels sont activés');
  check(vfx.rings.length > 0, 'les anneaux fonctionnent normalement quand les effets visuels sont activés');
  check(vfx.numbers.length === 1, 'les nombres de dégâts fonctionnent normalement quand les effets visuels sont activés');
  check(vfx.texts.length === 1, 'les textes flottants fonctionnent normalement quand les effets visuels sont activés');
}

console.log('\n=== Save : le réglage vfxEnabled est persisté indépendamment de shakeEnabled ===\n');
{
  const originalLocalStorage = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k)
  };

  const save = new Save();
  check(save.vfxEnabled === true, 'vfxEnabled vaut true par défaut');

  save.setVfxEnabled(false);
  check(save.vfxEnabled === false, 'setVfxEnabled(false) est bien pris en compte');
  check(save.shakeEnabled === true, 'shakeEnabled reste indépendant, toujours true');

  const reloaded = new Save();
  check(reloaded.vfxEnabled === false, 'vfxEnabled=false survit à un rechargement depuis localStorage');

  globalThis.localStorage = originalLocalStorage;
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
