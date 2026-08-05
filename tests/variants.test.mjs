// ============================================================
//  Test headless (Node, sans DOM) : vérifie que les 3 variantes de
//  chaque branche sont bien au même anneau (donc même palier / même
//  coût) dans l'arbre de compétences — c'était le bug d'origine : les
//  3 étaient réparties sur 3 anneaux très éloignés, une variante
//  s'ouvrait très vite et les deux autres restaient hors de portée.
//  Vérifie aussi que la variante active d'une tour se reflète bien
//  dans sa couleur/rendu (identité visuelle différente de la version
//  de base et des autres variantes).
// ============================================================
import { TOWERS, VARIANTS, VARIANT_ORDER, VARIANT_RING, BRANCHES } from '../js/config.js';
import { buildTree } from '../js/skilltree.js';
import { Grid } from '../js/grid.js';
import { Tower } from '../js/towers.js';
import { Vfx } from '../js/vfx.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

console.log('=== PLACEMENT DES VARIANTES DANS L\'ARBRE ===\n');

const tree = buildTree();

for (const arche of VARIANT_ORDER) {
  const branchVariants = VARIANTS[arche];
  const branch = BRANCHES.find((b) => b.id === arche);
  const nodes = tree.nodes.filter((n) => n.type === 'variant' && n.branchId === arche);

  if (nodes.length !== branchVariants.length) {
    fail(`${arche}: ${nodes.length} nœud(s) VARIANTE trouvé(s) dans l'arbre, attendu ${branchVariants.length}`);
    continue;
  }

  const rings = new Set(nodes.map((n) => n.ring));
  const costs = new Set(nodes.map((n) => n.cost));
  const ids = new Set(nodes.map((n) => n.variantId));

  if (rings.size !== 1 || !rings.has(VARIANT_RING)) {
    fail(`${arche}: anneaux des variantes = [${[...rings].join(',')}], attendu un seul anneau (${VARIANT_RING})`);
  }
  if (costs.size !== 1) {
    fail(`${arche}: coûts différents entre variantes (${[...costs].join(', ')}) alors qu'elles sont au même anneau`);
  }
  if (ids.size !== branchVariants.length) {
    fail(`${arche}: variantId dupliqués ou manquants dans l'arbre (${[...ids].join(', ')})`);
  }
  for (const v of branchVariants) {
    if (!ids.has(v.id)) fail(`${arche}: la variante "${v.id}" (${v.name}) n'apparaît nulle part dans l'arbre`);
  }

  console.log(`[${rings.size === 1 && costs.size === 1 ? 'PASS' : 'FAIL'}] ${branch.name.padEnd(14)} — ${nodes.length} variantes, anneau ${[...rings].join(',')}, coût ${[...costs].join(',')}`);
}

console.log('\n=== IDENTITÉ VISUELLE PAR VARIANTE ===\n');

function makeGame(loadout) {
  return {
    grid: new Grid(1),
    mods: {},
    towers: [],
    vfx: new Vfx(),
    time: 0,
    loadout: loadout || {}
  };
}

for (const arche of VARIANT_ORDER) {
  const baseAccent = TOWERS[arche].accent;
  const seenAccents = new Set([baseAccent]);
  let ok = true;

  for (const v of VARIANTS[arche]) {
    const game = makeGame({ [arche]: v.id });
    let tower;
    try {
      tower = new Tower(arche, 3, 3, game);
    } catch (err) {
      fail(`${arche}/${v.id}: la pose d'une tour avec cette variante plante — ${err.message}`);
      ok = false;
      continue;
    }
    if (!tower.variant || tower.variant.id !== v.id) {
      fail(`${arche}/${v.id}: tower.variant ne correspond pas au loadout (${tower.variant && tower.variant.id})`);
      ok = false;
      continue;
    }
    if (tower.variant.accent !== v.accent) {
      fail(`${arche}/${v.id}: tower.variant.accent (${tower.variant.accent}) ne correspond pas à la couleur définie (${v.accent})`);
      ok = false;
    }
    const renderAccent = (tower.variant && tower.variant.accent) || tower.def.accent;
    if (renderAccent === baseAccent) {
      fail(`${arche}/${v.id}: la couleur de rendu reste celle de la tour de base (${baseAccent}) — pas de différenciation visuelle`);
      ok = false;
    }
    if (seenAccents.has(renderAccent)) {
      fail(`${arche}/${v.id}: couleur "${renderAccent}" déjà utilisée par une autre variante/la base de cette branche`);
      ok = false;
    }
    seenAccents.add(renderAccent);
    if (!v.icon) {
      fail(`${arche}/${v.id}: pas d'icône définie pour la pastille de variante`);
      ok = false;
    }
  }
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${arche.padEnd(8)} — ${VARIANTS[arche].length} variantes, ${seenAccents.size} couleurs distinctes (base incluse)`);
}

console.log(fails === 0 ? '\nTOUT EST VERT.' : `\n${fails} PROBLÈME(S) DÉTECTÉ(S).`);
process.exit(fails === 0 ? 0 : 1);
