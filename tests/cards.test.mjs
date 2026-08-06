// ============================================================
//  Test headless (Node, sans DOM) : vérifie que cardArchetypes(), dont
//  dépend la pastille "quelle tourelle ça concerne" affichée sur les
//  cartes de draft, résout correctement le champ (portée) de chaque
//  carte du pool — une seule tourelle, plusieurs, ou aucune (carte
//  générale). C'est la donnée que l'UI transforme en badge visible ;
//  si elle est fausse, le badge ment.
// ============================================================
import { CARDS, cardArchetypes } from '../js/cards.js';
import { TOWERS } from '../js/config.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

const REAL_TOWERS = new Set(['mg', 'sniper', 'mortar', 'tesla', 'flame', 'aa']);

console.log(`\n=== PORTÉE DES ${CARDS.length} CARTES (cardArchetypes) ===\n`);

const counts = { general: 0, single: 0, multi: 0 };

for (const card of CARDS) {
  let arches;
  try {
    arches = cardArchetypes(card);
  } catch (err) {
    fail(`${card.id}: cardArchetypes() plante — ${err.message}`);
    continue;
  }

  // Chaque archétype renvoyé doit être une vraie tourelle jouable, jamais
  // le sac de sable (il n'a pas de stats à améliorer) ni un id inventé.
  for (const a of arches) {
    if (!REAL_TOWERS.has(a)) fail(`${card.id}: archétype invalide "${a}" (pas une tourelle réelle)`);
    if (!TOWERS[a]) fail(`${card.id}: archétype "${a}" absent de TOWERS — le badge n'aurait pas de couleur/icône`);
  }

  // La portée déduite des mods doit être cohérente avec les clés réellement
  // présentes : tout préfixe de mod qui est une vraie tourelle doit
  // apparaître dans arches, et rien d'autre.
  const expected = new Set();
  for (const key of Object.keys(card.mods)) {
    const ns = key.split('.')[0];
    if (REAL_TOWERS.has(ns)) expected.add(ns);
  }
  const got = [...arches].sort().join(',');
  const want = [...expected].sort().join(',');
  if (got !== want) fail(`${card.id}: cardArchetypes() = [${got}], attendu [${want}] d'après ses mods`);

  if (arches.size === 0) counts.general++;
  else if (arches.size === 1) counts.single++;
  else counts.multi++;
}

console.log(`Répartition : ${counts.single} mono-tourelle, ${counts.multi} multi-tourelles, ${counts.general} générales`);

// ---- Quelques cas connus, pour être sûr que le badge affichera ce qu'on croit ----
const spotChecks = [
  ['mg_c1', ['mg']],           // PLOMB LOURD : mono-tourelle
  ['te_l1', ['tesla']],        // ORAGE PERMANENT : mono-tourelle malgré 2 mods (même préfixe)
  ['gl_r1', ['aa', 'mg', 'sniper', 'tesla']], // GUERRE AÉRIENNE : 4 tourelles
  ['ec_c1', []],                // PILLAGE : carte générale (player.*)
  ['df_c1', []]                 // FORTIFICATION : carte générale (player.*)
];
console.log('\n=== CAS CONNUS ===\n');
for (const [id, expectedArr] of spotChecks) {
  const card = CARDS.find((c) => c.id === id);
  if (!card) { fail(`${id}: carte introuvable dans le pool (a-t-elle été renommée ?)`); continue; }
  const got = [...cardArchetypes(card)].sort();
  const want = [...expectedArr].sort();
  const ok = got.length === want.length && got.every((v, i) => v === want[i]);
  if (!ok) fail(`${id}: portée = [${got.join(',')}], attendu [${want.join(',')}]`);
  else console.log(`[PASS] ${card.name.padEnd(24)} — portée [${want.join(', ') || 'GÉNÉRAL'}]`);
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
