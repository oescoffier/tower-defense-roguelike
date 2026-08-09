// ============================================================
//  Test headless (Node, sans DOM) : la portée des tours est FIXE, dans
//  TOUS les cas — plus aucune source de bonus (arbre, points de
//  branche, cartes, améliorations, variantes) ne doit pouvoir la faire
//  varier (voir Tower.recompute dans js/towers.js). Ce test scanne
//  TOUTES les sources de données pour qu'un futur ajout de noeud/carte
//  avec un mod ".range" échoue ici plutôt que de refaire dériver la
//  portée en jeu. Vérifie aussi qu'on n'a pas de nom de noeud dupliqué
//  dans une même branche (repéré en écrivant ce test).
// ============================================================
import { TOWERS, COMMANDERS, NOTABLES, BRANCH_STATS, VARIANTS } from '../js/config.js';
import { CARDS } from '../js/cards.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

console.log('\n=== NOTABLES (arbre) : aucun mod ".range", aucun nom dupliqué ===\n');
{
  let bad = 0, dup = 0;
  for (const [arche, nodes] of Object.entries(NOTABLES)) {
    const seenNames = new Set();
    for (const [name, key] of nodes) {
      if (key.endsWith('.range')) { fail(`NOTABLES.${arche} : "${name}" utilise le mod "${key}"`); bad++; }
      if (seenNames.has(name)) { fail(`NOTABLES.${arche} : nom "${name}" dupliqué dans la même branche`); dup++; }
      seenNames.add(name);
    }
  }
  if (bad === 0 && dup === 0) console.log('[PASS] aucun mod ".range" dans NOTABLES, aucun nom dupliqué par branche');
}

console.log('\n=== BRANCH_STATS (points de branche) : aucun mod ".range" ===\n');
{
  let bad = 0;
  for (const [arche, stats] of Object.entries(BRANCH_STATS)) {
    for (const s of stats) {
      if (s.key.endsWith('.range')) { fail(`BRANCH_STATS.${arche} : clé "${s.key}"`); bad++; }
    }
  }
  if (bad === 0) console.log('[PASS] aucun mod ".range" dans BRANCH_STATS');
}

console.log('\n=== CARDS : aucun mod ".range" ===\n');
{
  let bad = 0;
  for (const c of CARDS) {
    for (const key of Object.keys(c.mods || {})) {
      if (key.endsWith('.range')) { fail(`Carte "${c.id}" (${c.name}) : clé "${key}"`); bad++; }
    }
  }
  if (bad === 0) console.log(`[PASS] aucun mod ".range" dans les ${CARDS.length} cartes`);
}

console.log('\n=== VARIANTS : aucun mult/add/set sur range ou minRange ===\n');
{
  let bad = 0;
  for (const [arche, variants] of Object.entries(VARIANTS)) {
    for (const v of variants) {
      for (const bucket of ['mult', 'add', 'set']) {
        if (v[bucket] && ('range' in v[bucket] || 'minRange' in v[bucket])) {
          fail(`VARIANTS.${arche}/${v.id} : ${bucket} touche à range/minRange`);
          bad++;
        }
      }
    }
  }
  if (bad === 0) console.log('[PASS] aucune variante ne modifie range/minRange');
}

console.log('\n=== TOWERS/COMMANDERS : aucun palier d\'amélioration ne touche range ===\n');
{
  let bad = 0;
  for (const [group, name] of [[TOWERS, 'TOWERS'], [COMMANDERS, 'COMMANDERS']]) {
    for (const [id, def] of Object.entries(group)) {
      for (const u of def.upgrades || []) {
        if ('range' in u || 'minRange' in u) { fail(`${name}.${id} : un palier d'amélioration touche range/minRange`); bad++; }
      }
    }
  }
  if (bad === 0) console.log('[PASS] aucun palier d\'amélioration (tour ou commandant) ne touche range/minRange');
}

console.log('\n=== Chaque commandant a exactement la range/minRange de sa tour de base ===\n');
{
  let bad = 0;
  for (const [id, def] of Object.entries(COMMANDERS)) {
    const base = TOWERS[def.archetype];
    if (!base) { fail(`${id} : archétype "${def.archetype}" introuvable`); bad++; continue; }
    if (def.range !== base.range) { fail(`${id} : range=${def.range}, attendu ${base.range}`); bad++; }
    if ((def.minRange || 0) !== (base.minRange || 0)) { fail(`${id} : minRange=${def.minRange || 0}, attendu ${base.minRange || 0}`); bad++; }
  }
  if (bad === 0) console.log(`[PASS] les ${Object.keys(COMMANDERS).length} commandants correspondent exactement à leur tour de base`);
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
