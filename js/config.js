// ============================================================
//  CONFIG — palette, constantes, tables de balance
// ============================================================

export const PALETTE = {
  bg: '#090909',
  surface: '#141414',
  surface2: '#1f1f1f',
  text: '#f4f4f4',
  textDark: '#090909',
  muted: '#b8b8b8',
  accent: '#0d67ff',
  line: '#f4f4f4',
  gold: '#f0d24b',
  danger: '#e46363',
  ok: '#71d58a',
  air: '#58b7e9',
  fire: '#ff7a29',
  tesla: '#8ad8ff',
  violet: '#b878ff'
};

// ---------- Grille ----------
export const GRID = {
  cols: 24,
  rows: 14,
  cell: 44,
  get w() { return this.cols * this.cell; },
  get h() { return this.rows * this.cell; }
};

export const CELL = {
  EMPTY: 0,
  ROCK: 1,
  SPAWN: 2,
  BASE: 3,
  TOWER: 4
};

// ---------- Machine à états ----------
export const STATE = {
  BOOT: 'BOOT',
  MENU: 'MENU',
  TREE: 'TREE',
  COMMANDER: 'COMMANDER',
  LOADOUT: 'LOADOUT',
  GAME: 'GAME',
  OVER: 'OVER'
};

// ---------- Cibles ----------
export const TARGET = { NONE: 0, GROUND: 1, AIR: 2, BOTH: 3 };

export const PRIORITY = ['first', 'last', 'close', 'strong', 'weak'];
export const PRIORITY_LABEL = {
  first: 'PREMIER',
  last: 'DERNIER',
  close: 'PROCHE',
  strong: 'SOLIDE',
  weak: 'FAIBLE'
};

// ============================================================
//  TOURS
// ============================================================
// range est exprimé en CELLULES. dps calculé = damage * rate.

export const TOWERS = {
  mg: {
    id: 'mg',
    name: 'MITRAILLETTE',
    short: 'MG',
    cost: 70,
    color: '#f4f4f4',
    accent: '#0d67ff',
    targets: TARGET.BOTH,
    damage: 7,
    rate: 8,           // tirs / seconde
    range: 3.2,
    projSpeed: 30,     // cellules / seconde
    spinMax: 1.8,      // multiplicateur de cadence à plein régime
    spinUp: 1.6,       // secondes pour atteindre le plein régime
    spinDown: 2.2,
    desc: 'Cadence extrême. Monte en régime en tirant sans interruption. Touche le sol et l\'air.',
    upgrades: [
      { cost: 60, damage: 1.35, rate: 1.15, range: 1.05 },
      { cost: 96, damage: 1.40, rate: 1.20, range: 1.08 },
      { cost: 154, damage: 1.50, rate: 1.25, range: 1.10 }
    ]
  },

  sniper: {
    id: 'sniper',
    name: 'SNIPER',
    short: 'SNP',
    cost: 120,
    color: '#f4f4f4',
    accent: '#e46363',
    targets: TARGET.BOTH,
    damage: 95,
    rate: 0.55,
    range: 9.0,
    pierce: 2,         // nombre de cibles traversées
    critChance: 0.15,
    critMult: 2.5,
    ignoreArmor: true,
    desc: 'Tir hitscan longue portée. Ignore l\'armure, traverse 2 ennemis, peut critiquer.',
    upgrades: [
      { cost: 105, damage: 1.45, rate: 1.10, range: 1.06 },
      { cost: 168, damage: 1.50, rate: 1.12, range: 1.08, pierce: 1 },
      { cost: 269, damage: 1.60, rate: 1.15, range: 1.10, critChance: 0.10 }
    ]
  },

  mortar: {
    id: 'mortar',
    name: 'MORTIER',
    short: 'MRT',
    cost: 140,
    color: '#f4f4f4',
    accent: '#f0d24b',
    targets: TARGET.GROUND,
    damage: 60,
    rate: 0.7,
    range: 6.5,
    splash: 1.6,       // rayon AoE en cellules
    arcTime: 0.75,     // temps de vol en secondes
    desc: 'Obus en cloche, dégâts de zone. Laisse un cratère brûlant. Sol uniquement.',
    upgrades: [
      { cost: 120, damage: 1.40, splash: 1.12, rate: 1.10 },
      { cost: 192, damage: 1.45, splash: 1.14, range: 1.10 },
      { cost: 307, damage: 1.55, splash: 1.18, rate: 1.15 }
    ]
  },

  tesla: {
    id: 'tesla',
    name: 'TESLA',
    short: 'TSL',
    cost: 130,
    color: '#f4f4f4',
    accent: '#8ad8ff',
    targets: TARGET.BOTH,
    damage: 26,
    rate: 1.4,
    range: 4.0,
    bounces: 5,
    bounceFalloff: 0.85,   // dégâts × 0.85 par rebond
    bounceRange: 3.0,
    chargeDur: 4.0,        // durée de la marque « chargé »
    chainBlast: 0.6,       // % des dégâts relâchés quand un chargé meurt
    desc: 'Arc électrique qui rebondit. Marque les cibles : leur mort déclenche une réaction en chaîne.',
    upgrades: [
      { cost: 110, damage: 1.35, bounces: 1, rate: 1.10 },
      { cost: 176, damage: 1.40, bounces: 1, bounceRange: 1.15 },
      { cost: 282, damage: 1.50, bounces: 2, chainBlast: 0.25 }
    ]
  },

  flame: {
    id: 'flame',
    name: 'LANCE-FLAMME',
    short: 'FLM',
    cost: 90,
    color: '#f4f4f4',
    accent: '#ff7a29',
    targets: TARGET.GROUND,
    damage: 14,
    rate: 6,
    range: 2.6,
    cone: 60,          // degrés
    burnDps: 8,
    burnDur: 3.0,
    burnStacks: 5,
    desc: 'Cône de flammes continu. Applique une brûlure cumulable. Sol uniquement.',
    upgrades: [
      { cost: 78, damage: 1.35, burnDps: 1.30, cone: 1.10 },
      { cost: 125, damage: 1.40, burnDur: 1.30, range: 1.12 },
      { cost: 200, damage: 1.50, burnDps: 1.40, burnStacks: 3 }
    ]
  },

  aa: {
    id: 'aa',
    name: 'DCA',
    short: 'DCA',
    cost: 160,
    color: '#f4f4f4',
    accent: '#58b7e9',
    targets: TARGET.AIR,
    damage: 220,
    rate: 1.2,
    range: 7.5,
    missiles: 1,
    missileSpeed: 13,
    turnRate: 5.5,     // radians / seconde
    flakSplash: 1.1,
    desc: 'Missiles à tête chercheuse. Dégâts massifs. NE TIRE QUE SUR LES AÉRIENS.',
    upgrades: [
      { cost: 140, damage: 1.40, rate: 1.12, range: 1.06 },
      { cost: 224, damage: 1.45, missiles: 1, turnRate: 1.15 },
      { cost: 358, damage: 1.55, missiles: 1, flakSplash: 1.3 }
    ]
  },

  sandbag: {
    id: 'sandbag',
    name: 'SAC DE SABLE',
    short: 'SDS',
    cost: 15,
    color: '#f4f4f4',
    accent: '#c9a870',
    targets: TARGET.NONE,
    damage: 0,
    rate: 0,
    range: 0,
    desc: 'Bloc inerte, pas cher. Ne tire pas : sert uniquement à barricader une case et forcer les ennemis à dévier.',
    upgrades: []
  }
};

export const TOWER_ORDER = ['mg', 'sniper', 'mortar', 'tesla', 'flame', 'aa', 'sandbag'];

// ============================================================
//  COMMANDANTS
// ============================================================
// Tours d'élite choisies une fois pour toutes depuis le menu, avant de
// lancer une partie. Une seule peut être posée à la fois. Chacune reprend
// l'archétype d'une tour existante (mêmes armes, même rendu) mais avec des
// statistiques bien supérieures, et possède en plus une APTITUDE UNIQUE
// (`ability`) : une mécanique propre au commandant, qu'aucun nœud de
// l'arbre de compétences ne peut reproduire — aura spatiale autour d'elle,
// pulsation périodique, ou déclencheur sur élimination. Rien de tout ça
// n'existe comme bonus de branche ; c'est ce qui rend un commandant
// vraiment différent d'un gros multiplicateur de stats.
//
//   type: 'aura'       buff continu (stat/valeur/rayon en cases) aux TOURS
//                       à portée, quel que soit leur archétype
//   type: 'auraDebuff'  effet de zone continu (ralentissement/brûlure) sur
//                       les ennemis au sol à portée
//   type: 'pulse'       effet périodique (toutes les `interval` secondes)
//                       tant qu'une vague est en cours
//   type: 'onKill'      se déclenche sur CHAQUE élimination, par n'importe
//                       quelle tour, tant que le commandant est déployé
//
// La puissance (valeur/dégâts) suit le rang du commandant (rankMult),
// exactement comme ses propres statistiques.

export const COMMANDERS = {
  cmdr_fury: {
    id: 'cmdr_fury', name: 'FURIE', archetype: 'mg', cost: 300, accent: '#ff6a3d',
    targets: TARGET.BOTH, damage: 32, rate: 16, range: 4.6, projSpeed: 36, spinMax: 3.4, spinUp: 0.5, spinDown: 0.3,
    desc: 'Rafale ininterrompue qui monte en régime presque instantanément. Sa cadence est contagieuse : toutes les tours à 3.5 cases tirent 25% plus vite.',
    ability: { type: 'aura', target: 'towers', stat: 'rate', value: 0.25, radius: 3.5 },
    upgrades: []
  },
  cmdr_leadstorm: {
    id: 'cmdr_leadstorm', name: 'TEMPÊTE DE PLOMB', archetype: 'mg', cost: 300, accent: '#ffae42',
    targets: TARGET.BOTH, damage: 24, rate: 22, range: 4.2, projSpeed: 42, spinMax: 2.6, spinUp: 0.8, spinDown: 0.6,
    desc: 'Un déluge de balles qui ricochent d\'une cible à l\'autre. Toutes les 5 secondes, une giclée de plomb balaie l\'ennemi le plus solide à sa portée.',
    ability: { type: 'pulse', kind: 'nova', interval: 5, damage: 70, radius: 2.6, targetMask: TARGET.BOTH, rangeLimited: true },
    upgrades: []
  },
  cmdr_bastion: {
    id: 'cmdr_bastion', name: 'BASTION', archetype: 'mg', cost: 320, accent: '#c94b4b',
    targets: TARGET.BOTH, damage: 48, rate: 12, range: 4.0, projSpeed: 30, spinMax: 2.0, spinUp: 1.0, spinDown: 1.0,
    desc: 'Mur de plomb qui écrase tout ce qui s\'approche. Tout ennemi au sol à moins de 3 cases patauge, ralenti de 30% en permanence.',
    ability: { type: 'auraDebuff', kind: 'slow', value: 0.3, radius: 3 },
    upgrades: []
  },

  cmdr_ghost: {
    id: 'cmdr_ghost', name: 'FANTÔME', archetype: 'sniper', cost: 420, accent: '#ff3b3b',
    targets: TARGET.BOTH, damage: 900, rate: 1.4, range: 11, pierce: 6, critChance: 0.35, critMult: 4,
    desc: 'Tir fantôme, précision inhumaine. Toutes les 4 secondes, achève instantanément l\'ennemi le plus proche de la mort sur tout le terrain (hors boss).',
    ability: { type: 'pulse', kind: 'execute', interval: 4, threshold: 0.4 },
    upgrades: []
  },
  cmdr_hawkeye: {
    id: 'cmdr_hawkeye', name: 'ŒIL DE FAUCON', archetype: 'sniper', cost: 380, accent: '#ff7043',
    targets: TARGET.BOTH, damage: 500, rate: 2.2, range: 13, pierce: 4, critChance: 0.5, critMult: 3,
    desc: 'Voit et abat tout ce qui entre sur le terrain. Son regard guide le tir : toutes les tours à 6 cases gagnent 25% de portée.',
    ability: { type: 'aura', target: 'towers', stat: 'range', value: 0.25, radius: 6 },
    upgrades: []
  },
  cmdr_executioner: {
    id: 'cmdr_executioner', name: 'BOURREAU', archetype: 'sniper', cost: 400, accent: '#d63447',
    targets: TARGET.BOTH, damage: 650, rate: 1.0, range: 9, pierce: 3, critChance: 0.25, critMult: 3.5,
    desc: 'Achève tout ce qui vacille. Toutes les 6 secondes, désigne l\'ennemi le plus solide du terrain : il subit 50% de dégâts en plus de la part de toutes les tours pendant 4s.',
    ability: { type: 'pulse', kind: 'overcharge', interval: 6, value: 0.5, dur: 4 },
    upgrades: []
  },
  cmdr_vengeance: {
    id: 'cmdr_vengeance', name: 'VENGEANCE', archetype: 'sniper', cost: 440, accent: '#a4161a',
    targets: TARGET.BOTH, damage: 1100, rate: 0.8, range: 10, pierce: 8, critChance: 0.2, critMult: 5,
    desc: 'Chaque tir embrase et transperce la colonne ennemie. À chaque élimination, toutes tours confondues, 20% de chance qu\'un tir vengeur frappe un ennemi proche.',
    ability: { type: 'onKill', kind: 'chainSpark', chance: 0.2, damage: 150, radius: 3 },
    upgrades: []
  },

  cmdr_heavyarty: {
    id: 'cmdr_heavyarty', name: 'ARTILLERIE LOURDE', archetype: 'mortar', cost: 380, accent: '#e0a72e',
    targets: TARGET.GROUND, damage: 260, rate: 1.0, range: 8, splash: 3.2, arcTime: 0.6,
    desc: 'Pluie d\'obus sur toute une zone. Toutes les 8 secondes, un tir de barrage s\'abat sur l\'ennemi au sol le plus solide du terrain.',
    ability: { type: 'pulse', kind: 'nova', interval: 8, damage: 260, radius: 3.4, targetMask: TARGET.GROUND },
    upgrades: []
  },
  cmdr_scorchedearth: {
    id: 'cmdr_scorchedearth', name: 'TERRE BRÛLÉE', archetype: 'mortar', cost: 360, accent: '#c96f2e',
    targets: TARGET.GROUND, damage: 180, rate: 1.3, range: 7, splash: 2.6, arcTime: 0.55,
    desc: 'Ne laisse derrière lui que des ruines fumantes. Tout ennemi au sol à moins de 3 cases brûle en continu tant qu\'il reste dans la zone.',
    ability: { type: 'auraDebuff', kind: 'burn', value: 14, radius: 3 },
    upgrades: []
  },
  cmdr_earthquake: {
    id: 'cmdr_earthquake', name: 'SÉISME', archetype: 'mortar', cost: 380, accent: '#b5651d',
    targets: TARGET.GROUND, damage: 220, rate: 0.9, range: 7.5, splash: 3.6, arcTime: 0.7,
    desc: 'Chaque impact fait trembler le secteur. Toutes les 7 secondes, étourdit 1.2s tout ce qui se trouve à moins de 4 cases d\'elle.',
    ability: { type: 'pulse', kind: 'freeze', interval: 7, dur: 1.2, radius: 4 },
    upgrades: []
  },

  cmdr_lightning: {
    id: 'cmdr_lightning', name: 'FOUDRE', archetype: 'tesla', cost: 420, accent: '#7fdfff',
    targets: TARGET.BOTH, damage: 90, rate: 2.6, range: 5.5, bounces: 14, bounceFalloff: 0.94, bounceRange: 4.5, chargeDur: 6, chainBlast: 1.0,
    desc: 'L\'arc électrique ne s\'arrête presque jamais de rebondir. Toutes les 5 secondes, la foudre s\'abat sur l\'ennemi le plus solide du terrain.',
    ability: { type: 'pulse', kind: 'nova', interval: 5, damage: 110, radius: 2.2, targetMask: TARGET.BOTH },
    upgrades: []
  },
  cmdr_overvolt: {
    id: 'cmdr_overvolt', name: 'SURTENSION', archetype: 'tesla', cost: 400, accent: '#5ec8f8',
    targets: TARGET.BOTH, damage: 130, rate: 2.0, range: 5, bounces: 8, bounceFalloff: 0.9, bounceRange: 3.6, chargeDur: 5, chainBlast: 1.4,
    desc: 'Chaque mort chargée devient une bombe. Son champ électrique amplifie tout : toutes les tours à 3 cases infligent 25% de dégâts en plus.',
    ability: { type: 'aura', target: 'towers', stat: 'damage', value: 0.25, radius: 3 },
    upgrades: []
  },
  cmdr_reactor: {
    id: 'cmdr_reactor', name: 'RÉACTEUR', archetype: 'tesla', cost: 400, accent: '#38b6ff',
    targets: TARGET.BOTH, damage: 70, rate: 3.2, range: 5.2, bounces: 10, bounceFalloff: 0.92, bounceRange: 4.0, chargeDur: 6, chainBlast: 0.8,
    desc: 'Une cadence effrénée qui ne faiblit jamais. Chaque élimination, toutes tours confondues, a 8% de chance de reverser l\'énergie excédentaire à la base : +1 intégrité.',
    ability: { type: 'onKill', kind: 'healChance', chance: 0.08 },
    upgrades: []
  },
  cmdr_endlessstorm: {
    id: 'cmdr_endlessstorm', name: 'ORAGE ÉTERNEL', archetype: 'tesla', cost: 460, accent: '#29a8e0',
    targets: TARGET.BOTH, damage: 100, rate: 2.2, range: 5.6, bounces: 12, bounceFalloff: 0.93, bounceRange: 4.2, chargeDur: 7, chainBlast: 1.2,
    desc: 'Le ciel entier devient une arme. Toutes les 10 secondes, une impulsion électromagnétique fait sauter le bouclier de tous les ennemis présents.',
    ability: { type: 'pulse', kind: 'emp', interval: 10 },
    upgrades: []
  },

  cmdr_inferno: {
    id: 'cmdr_inferno', name: 'INFERNO', archetype: 'flame', cost: 380, accent: '#ff5722',
    targets: TARGET.GROUND, damage: 55, rate: 9, range: 3.6, cone: 110, burnDps: 40, burnDur: 6, burnStacks: 12,
    desc: 'Une mer de flammes qui ne s\'éteint jamais. Toutes les 6 secondes, une éruption embrase tout ce qui se trouve autour d\'elle.',
    ability: { type: 'pulse', kind: 'nova', interval: 6, damage: 150, radius: 2.8, targetMask: TARGET.GROUND, selfCentered: true },
    upgrades: []
  },
  cmdr_dragon: {
    id: 'cmdr_dragon', name: 'DRAGON', archetype: 'flame', cost: 380, accent: '#ff8a3d',
    targets: TARGET.GROUND, damage: 45, rate: 8, range: 3.8, cone: 90, burnDps: 30, burnDur: 5, burnStacks: 10,
    desc: 'Souffle un cône de feu qui touche même les aériens à basse altitude. Son aura embrase les armes proches : toutes les tours à 3.5 cases infligent 20% de dégâts en plus.',
    ability: { type: 'aura', target: 'towers', stat: 'damage', value: 0.2, radius: 3.5 },
    upgrades: []
  },
  cmdr_combustion: {
    id: 'cmdr_combustion', name: 'COMBUSTION', archetype: 'flame', cost: 360, accent: '#ff3d00',
    targets: TARGET.GROUND, damage: 60, rate: 7, range: 3.4, cone: 80, burnDps: 45, burnDur: 5, burnStacks: 8,
    desc: 'Chaque cadavre en flammes devient une explosion. 25% de chance qu\'une élimination, toutes tours confondues, fasse détoner les ennemis proches.',
    ability: { type: 'onKill', kind: 'chainSpark', chance: 0.25, damage: 120, radius: 2.5 },
    upgrades: []
  },

  cmdr_totalflak: {
    id: 'cmdr_totalflak', name: 'FLAK TOTALE', archetype: 'aa', cost: 440, accent: '#4fc3f7',
    targets: TARGET.AIR, damage: 380, rate: 2.0, range: 9, missiles: 5, missileSpeed: 20, turnRate: 9, flakSplash: 2.2,
    desc: 'Sature le ciel de munitions. Toutes les tours à 4 cases tirent 20% plus vite, portées par le rythme du barrage.',
    ability: { type: 'aura', target: 'towers', stat: 'rate', value: 0.2, radius: 4 },
    upgrades: []
  },
  cmdr_sentinel: {
    id: 'cmdr_sentinel', name: 'SENTINELLE', archetype: 'aa', cost: 420, accent: '#29b6f6',
    targets: TARGET.AIR, damage: 450, rate: 1.6, range: 10, missiles: 3, missileSpeed: 18, turnRate: 8, flakSplash: 1.8,
    desc: 'Ne laisse rien franchir la ligne aérienne. Toutes les 6 secondes, frappe l\'appareil le plus solide présent dans le ciel.',
    ability: { type: 'pulse', kind: 'nova', interval: 6, damage: 200, radius: 2.4, targetMask: TARGET.AIR },
    upgrades: []
  },
  cmdr_interceptor: {
    id: 'cmdr_interceptor', name: 'INTERCEPTEUR', archetype: 'aa', cost: 400, accent: '#039be5',
    targets: TARGET.AIR, damage: 320, rate: 2.6, range: 8.5, missiles: 4, missileSpeed: 24, turnRate: 11, flakSplash: 1.6,
    desc: 'Rien n\'est assez rapide ou blindé pour lui échapper. Son uplink radar porte à 5 cases : +30% de portée pour toutes les tours proches.',
    ability: { type: 'aura', target: 'towers', stat: 'range', value: 0.3, radius: 5 },
    upgrades: []
  }
};

export const COMMANDER_ORDER = [
  'cmdr_fury', 'cmdr_leadstorm', 'cmdr_bastion',
  'cmdr_ghost', 'cmdr_hawkeye', 'cmdr_executioner', 'cmdr_vengeance',
  'cmdr_heavyarty', 'cmdr_scorchedearth', 'cmdr_earthquake',
  'cmdr_lightning', 'cmdr_overvolt', 'cmdr_reactor', 'cmdr_endlessstorm',
  'cmdr_inferno', 'cmdr_dragon', 'cmdr_combustion',
  'cmdr_totalflak', 'cmdr_sentinel', 'cmdr_interceptor'
];

// Paliers d'éliminations (toutes tours confondues, depuis la pose du
// commandant) nécessaires pour passer au rang suivant. De gros paliers,
// volontairement peu nombreux : chaque rang doit se mériter sur la durée.
// Chaque rang applique le tier d'amélioration correspondant de l'archétype
// (mêmes multiplicateurs que TOWERS[archetype].upgrades) à la tour
// elle-même, et augmente d'autant la puissance de son aptitude unique
// (rankMult, lu directement par les fonctions d'aptitude dans main.js).
export const COMMANDER_RANK_KILLS = [60, 180, 420];

// ============================================================
//  ENNEMIS
// ============================================================
// hp/speed/gold sont les valeurs de BASE vague 1, mises à l'échelle ensuite.
// speed en cellules / seconde.

export const ENEMIES = {
  // ---- SOL ----
  grunt: {
    id: 'grunt', name: 'GRUNT', air: false, hp: 46, speed: 1.5, armor: 0,
    gold: 6, leak: 1, radius: 11, color: '#d7dbe4', shape: 'square',
    unlock: 1
  },
  runner: {
    id: 'runner', name: 'COUREUR', air: false, hp: 28, speed: 3.1, armor: 0,
    gold: 7, leak: 1, radius: 9, color: '#71d58a', shape: 'tri',
    unlock: 3
  },
  brute: {
    id: 'brute', name: 'BRUTE', air: false, hp: 130, speed: 1.0, armor: 8,
    gold: 14, leak: 2, radius: 15, color: '#b8b8b8', shape: 'hex',
    unlock: 5
  },
  swarm: {
    id: 'swarm', name: 'ESSAIM', air: false, hp: 14, speed: 2.2, armor: 0,
    gold: 2, leak: 1, radius: 6, color: '#f0d24b', shape: 'dot',
    packSize: 8, unlock: 4
  },
  healer: {
    id: 'healer', name: 'SOIGNEUR', air: false, hp: 90, speed: 1.3, armor: 2,
    gold: 18, leak: 1, radius: 12, color: '#71d58a', shape: 'cross',
    healRadius: 2.4, healPerSec: 0.035, unlock: 7
  },
  shielder: {
    id: 'shielder', name: 'BOUCLIER', air: false, hp: 80, speed: 1.2, armor: 0,
    gold: 16, leak: 2, radius: 13, color: '#0d67ff', shape: 'shield',
    shield: 90, shieldRegen: 0.12, shieldDelay: 2.5, unlock: 6
  },
  splitter: {
    id: 'splitter', name: 'SCINDEUR', air: false, hp: 110, speed: 1.4, armor: 3,
    gold: 15, leak: 2, radius: 14, color: '#b878ff', shape: 'diamond',
    splitInto: 'splitling', splitCount: 2, unlock: 8
  },
  splitling: {
    id: 'splitling', name: 'ÉCLAT', air: false, hp: 34, speed: 2.4, armor: 0,
    gold: 3, leak: 1, radius: 8, color: '#b878ff', shape: 'diamond',
    unlock: 99, spawnOnly: true
  },
  juggernaut: {
    id: 'juggernaut', name: 'JUGGERNAUT', air: false, hp: 1400, speed: 0.8, armor: 20,
    gold: 140, leak: 5, radius: 24, color: '#e46363', shape: 'boss',
    boss: true, unlock: 10
  },

  // ---- AIR ----
  drone: {
    id: 'drone', name: 'DRONE', air: true, hp: 38, speed: 1.9, armor: 0,
    gold: 8, leak: 1, radius: 10, color: '#58b7e9', shape: 'rotor',
    unlock: 2
  },
  wasp: {
    id: 'wasp', name: 'GUÊPE', air: true, hp: 26, speed: 3.6, armor: 0,
    gold: 9, leak: 1, radius: 8, color: '#f0d24b', shape: 'wasp',
    unlock: 6
  },
  bomber: {
    id: 'bomber', name: 'BOMBARDIER', air: true, hp: 210, speed: 1.1, armor: 6,
    gold: 24, leak: 3, radius: 17, color: '#b8b8b8', shape: 'bomber',
    unlock: 9
  },
  raptor: {
    id: 'raptor', name: 'RAPACE', air: true, hp: 1100, speed: 1.4, armor: 12,
    gold: 160, leak: 5, radius: 22, color: '#b878ff', shape: 'boss',
    boss: true, unlock: 15
  }
};

// ============================================================
//  VAGUES & ÉCONOMIE
// ============================================================

export const WAVE = {
  hpBase: 1.0,
  hpGrowth: 1.157,       // hp(w) = hpBase * 1.157^(w-1) * (1 + w/30)
  hpLate: 30,
  speedGrowth: 0.006,    // +0.6 % de vitesse par vague
  countBase: 9,
  countGrowth: 0.85,     // +0.85 ennemi par vague
  countCap: 60,
  airRampStart: 2,
  airRampEnd: 26,
  airMax: 0.35,
  spawnGap: 0.62,        // secondes entre 2 spawns (réduit avec la vague)
  spawnGapMin: 0.16,
  bossGroundEvery: 10,
  bossAirEvery: 15,
  autoWaveGap: 4         // répit (s) entre deux vagues en mode automatique
};

export const ECONOMY = {
  startGold: 250,
  startLives: 20,
  waveBonusBase: 20,
  waveBonusPerWave: 4,
  sellRatio: 0.6,
  // Matériaux méta = floor(w^1.55) + 3w  →  ~164 à la vague 20
  matPow: 1.55,
  matLinear: 3
};

export function materialsForWave(wave) {
  if (wave <= 0) return 0;
  return Math.floor(Math.pow(wave, ECONOMY.matPow)) + ECONOMY.matLinear * wave;
}

export function waveHpMult(wave) {
  return WAVE.hpBase * Math.pow(WAVE.hpGrowth, wave - 1) * (1 + wave / WAVE.hpLate);
}

export function waveCount(wave) {
  return Math.min(WAVE.countCap, Math.round(WAVE.countBase + WAVE.countGrowth * (wave - 1)));
}

export function waveAirRatio(wave) {
  if (wave < WAVE.airRampStart) return 0;
  const t = Math.min(1, (wave - WAVE.airRampStart) / (WAVE.airRampEnd - WAVE.airRampStart));
  return t * WAVE.airMax;
}

// ============================================================
//  ARBRE DE COMPÉTENCES
// ============================================================

export const TREE = {
  branches: 7,
  rings: 22,
  perRing: 14,           // 22 * 14 = 308 noeuds par branche
  get perBranch() { return this.rings * this.perRing; },
  get total() { return this.branches * this.perBranch; },
  // ring0 doit être assez grand pour que les 5 noeuds du 1er anneau
  // ne se chevauchent pas dans un secteur de 51° (arc ≈ 269 px).
  ring0: 340,            // rayon du 1er anneau (px monde)
  ringStep: 124,         // écart entre anneaux
  hubRadius: 78,
  // Ecart de taille volontairement large : c'est le premier signal de
  // hierarchie, celui qui fonctionne encore quand on est dezoome au max.
  nodeR: 11,
  notableR: 22,
  keystoneR: 33,
  minorRate: 0.72,
  // Relevé : un arbre de +2000 nœuds n'a d'intérêt que si les effets
  // vraiment marquants y sont assez denses pour orienter un parcours.
  notableRate: 0.24,
  // Cale sur la simulation : une partie moyenne (vague ~20, 166 materiaux)
  // doit financer une quinzaine de noeuds d'entree, pas une trentaine.
  costBase: 10,
  costPerRing: 5,
  notableCostMult: 3,
  keystoneCostMult: 8,
  variantCostMult: 7,    // les variantes sont le gros lot d'une branche
  variantR: 40
};

export const BRANCHES = [
  { id: 'mg', name: 'MITRAILLETTE', color: '#0d67ff', icon: '⌗' },
  { id: 'sniper', name: 'SNIPER', color: '#e46363', icon: '✛' },
  { id: 'mortar', name: 'MORTIER', color: '#f0d24b', icon: '◎' },
  { id: 'tesla', name: 'TESLA', color: '#8ad8ff', icon: '⚡' },
  { id: 'flame', name: 'LANCE-FLAMME', color: '#ff7a29', icon: '▲' },
  { id: 'aa', name: 'DCA', color: '#58b7e9', icon: '✈' },
  { id: 'player', name: 'COMMANDANT', color: '#71d58a', icon: '★' }
];

// Statistiques mineures disponibles par branche.
// key = identifiant de modificateur, v = valeur par point, fmt = affichage
// Plancher volontaire a 1.2% : en dessous, un noeud ne se ressent pas et
// donne l'impression d'avoir depense pour rien.
const towerStats = (t) => ([
  { key: `${t}.damage`, v: 0.025, fmt: '+{v}% dégâts', pct: true, w: 26 },
  { key: `${t}.rate`, v: 0.018, fmt: '+{v}% cadence', pct: true, w: 22 },
  { key: `${t}.range`, v: 0.016, fmt: '+{v}% portée', pct: true, w: 16 },
  { key: `${t}.cost`, v: -0.014, fmt: '{v}% coût de construction', pct: true, w: 10 }
]);

export const BRANCH_STATS = {
  mg: [
    ...towerStats('mg'),
    { key: 'mg.spinMax', v: 0.02, fmt: '+{v}% régime maximum', pct: true, w: 12 },
    { key: 'mg.spinUp', v: -0.02, fmt: '{v}% temps de montée en régime', pct: true, w: 8 },
    { key: 'mg.ricochet', v: 0.015, fmt: '+{v}% chance de ricochet', pct: true, w: 8 }
  ],
  sniper: [
    ...towerStats('sniper'),
    { key: 'sniper.critChance', v: 0.012, fmt: '+{v}% chance critique', pct: true, w: 14 },
    { key: 'sniper.critMult', v: 0.03, fmt: '+{v}% dégâts critiques', pct: true, w: 12 },
    { key: 'sniper.pierce', v: 0.04, fmt: '+{v}% perçage', pct: true, w: 8 }
  ],
  mortar: [
    ...towerStats('mortar'),
    { key: 'mortar.splash', v: 0.015, fmt: '+{v}% rayon d\'explosion', pct: true, w: 18 },
    { key: 'mortar.craterDps', v: 0.03, fmt: '+{v}% dégâts de cratère', pct: true, w: 12 },
    { key: 'mortar.arcTime', v: -0.015, fmt: '{v}% temps de vol', pct: true, w: 8 }
  ],
  tesla: [
    ...towerStats('tesla'),
    { key: 'tesla.bounces', v: 0.035, fmt: '+{v}% rebonds', pct: true, w: 18 },
    { key: 'tesla.bounceFalloff', v: 0.014, fmt: '+{v}% dégâts conservés par rebond', pct: true, w: 12 },
    { key: 'tesla.chainBlast', v: 0.025, fmt: '+{v}% explosion en chaîne', pct: true, w: 12 }
  ],
  flame: [
    ...towerStats('flame'),
    { key: 'flame.burnDps', v: 0.025, fmt: '+{v}% dégâts de brûlure', pct: true, w: 20 },
    { key: 'flame.burnDur', v: 0.02, fmt: '+{v}% durée de brûlure', pct: true, w: 14 },
    { key: 'flame.cone', v: 0.016, fmt: '+{v}% angle du cône', pct: true, w: 10 }
  ],
  aa: [
    ...towerStats('aa'),
    { key: 'aa.turnRate', v: 0.03, fmt: '+{v}% guidage', pct: true, w: 14 },
    { key: 'aa.flakSplash', v: 0.02, fmt: '+{v}% rayon de flak', pct: true, w: 14 },
    { key: 'aa.missiles', v: 0.02, fmt: '+{v}% salve de missiles', pct: true, w: 8 }
  ],
  player: [
    // `int` : une vie ne se compte pas en fractions. Le gain est entier et
    // le noeud est rare (w faible), au lieu d'un +0.04 illisible qu'il
    // fallait acheter 25 fois pour voir le compteur bouger.
    { key: 'player.lives', v: 1, fmt: '+{v} vie maximale', flat: true, int: true, w: 7 },
    { key: 'player.startGold', v: 8, fmt: '+{v} or de départ', flat: true, int: true, w: 24 },
    { key: 'player.goldPerKill', v: 0.022, fmt: '+{v}% or par élimination', pct: true, w: 20 },
    { key: 'player.waveBonus', v: 0.028, fmt: '+{v}% bonus de fin de vague', pct: true, w: 16 },
    { key: 'player.sellRatio', v: 0.012, fmt: '+{v}% remboursement à la vente', pct: true, w: 10 },
    { key: 'player.materials', v: 0.014, fmt: '+{v}% matériaux récoltés', pct: true, w: 14 },
    { key: 'player.interest', v: 0.008, fmt: '+{v}% intérêts par vague', pct: true, w: 10 },
    { key: 'player.allDamage', v: 0.01, fmt: '+{v}% dégâts de toutes les tours', pct: true, w: 8 }
  ]
};

// Notables : effets nommés, tirés au sort par branche.
// La majorité sont CONDITIONNELS (contre les boss, les blindés, les cibles
// en feu, à faible vie...) ou mécaniques, plutôt que de simples bonus
// plats : c'est ce qui rend un chemin dans l'arbre différent d'un autre.
export const NOTABLES = {
  mg: [
    ["CANON JUMELÉ", "mg.damage", 0.14, "+14% dégâts mitraillette"],
    ["BARILLET FROID", "mg.spinDown", -0.35, "La montée en régime se dissipe 35% moins vite"],
    ["MUNITIONS PERFORANTES", "mg.armorPen", 4, "Ignore 4 points d'armure"],
    ["SUR-RÉGIME", "mg.spinMax", 0.25, "+25% de régime maximum"],
    ["RICOCHET", "mg.ricochet", 0.18, "+18% de chance de ricochet sur une seconde cible"],
    ["SUPPRESSION", "mg.slow", 0.1, "Les cibles touchées sont ralenties de 10%"],
    ["TIR DE BARRAGE", "mg.vsGround", 0.3, "+30% de dégâts contre les ennemis au sol"],
    ["DÉFENSE RAPPROCHÉE", "mg.vsAir", 0.35, "+35% de dégâts contre les aériens"],
    ["ACHARNEMENT", "mg.lowHp", 0.55, "+55% de dégâts sur les cibles sous 35% de vie"],
    ["MEULEUSE", "mg.shred", 0.35, "Chaque balle retire définitivement 0.35 point d'armure"],
    ["TIR NOURRI", "mg.vsBurning", 0.4, "+40% de dégâts sur une cible qui brûle"],
    ["CIBLE PRIORITAIRE", "mg.vsBoss", 0.45, "+45% de dégâts contre les boss"],
    ["PERCE-BOUCLIER", "mg.vsShield", 0.5, "+50% de dégâts contre les cibles à bouclier"],
    ["SANS SOMMATION", "mg.fullHp", 0.35, "+35% de dégâts sur une cible encore intacte"],
    ["ENRAYAGE IMPOSSIBLE", "mg.rate", 0.16, "+16% cadence"],
    ["LIGNE DE MIRE", "mg.range", 0.18, "+18% portée"]
  ],
  sniper: [
    ["ŒIL D'AIGLE", "sniper.range", 0.22, "+22% portée"],
    ["POINT FAIBLE", "sniper.critChance", 0.1, "+10% chance critique"],
    ["TRAVERSÉE", "sniper.pierce", 0.5, "+50% de cibles traversées"],
    ["EXÉCUTION", "sniper.execute", 0.08, "Élimine les cibles non-boss sous 8% de vie"],
    ["BALLE INCENDIAIRE", "sniper.burn", 1, "Applique une brûlure à l'impact"],
    ["LÉTALITÉ", "sniper.critMult", 0.4, "+40% dégâts critiques"],
    ["CHASSEUR DE TÊTES", "sniper.vsBoss", 0.6, "+60% de dégâts contre les boss"],
    ["PREMIER SANG", "sniper.fullHp", 0.65, "+65% de dégâts sur une cible encore intacte"],
    ["TIR ANTI-BLINDAGE", "sniper.vsArmor", 0.55, "+55% de dégâts contre les cibles blindées"],
    ["DÉFENSE ANTIAÉRIENNE", "sniper.vsAir", 0.45, "+45% de dégâts contre les aériens"],
    ["COUP DE GRÂCE", "sniper.lowHp", 0.8, "+80% de dégâts sur les cibles sous 35% de vie"],
    ["DÉSINTÉGRATION", "sniper.shred", 2.5, "Chaque tir retire définitivement 2.5 points d'armure"],
    ["BRISE-GARDE", "sniper.vsShield", 0.7, "+70% de dégâts contre les cibles à bouclier"],
    ["CADENCE SOUTENUE", "sniper.rate", 0.18, "+18% cadence"],
    ["CALIBRE LOURD", "sniper.damage", 0.18, "+18% dégâts"],
    ["MARQUAGE", "sniper.vsSlowed", 0.5, "+50% de dégâts sur une cible ralentie ou étourdie"]
  ],
  mortar: [
    ["ONDE DE CHOC", "mortar.splash", 0.2, "+20% rayon d'explosion"],
    ["NAPALM", "mortar.craterDps", 0.45, "+45% dégâts de cratère"],
    ["SALVE DOUBLE", "mortar.salvo", 1, "Tire un obus supplémentaire par salve"],
    ["ÉCLATS", "mortar.shrapnel", 6, "L'explosion projette 6 éclats"],
    ["TIR TENDU", "mortar.arcTime", -0.3, "-30% temps de vol"],
    ["SISMIQUE", "mortar.stun", 0.35, "Étourdit les cibles 0.35s dans le rayon"],
    ["SATURATION", "mortar.vsGround", 0.35, "+35% de dégâts contre les ennemis au sol"],
    ["DÉMOLITION", "mortar.vsArmor", 0.6, "+60% de dégâts contre les cibles blindées"],
    ["FRAPPE DÉCISIVE", "mortar.vsBoss", 0.5, "+50% de dégâts contre les boss"],
    ["SOUFFLE THERMIQUE", "mortar.vsBurning", 0.45, "+45% de dégâts sur une cible qui brûle"],
    ["ACIER FONDU", "mortar.shred", 1.5, "Chaque explosion retire définitivement 1.5 point d'armure"],
    ["PILONNAGE", "mortar.vsSlowed", 0.55, "+55% de dégâts sur une cible ralentie ou étourdie"],
    ["CHARGE CREUSE", "mortar.damage", 0.2, "+20% dégâts"],
    ["BOMBARDEMENT", "mortar.range", 0.2, "+20% portée"],
    ["CADENCE DE TIR", "mortar.rate", 0.16, "+16% cadence"],
    ["ACHÈVEMENT", "mortar.lowHp", 0.6, "+60% de dégâts sur les cibles sous 35% de vie"]
  ],
  tesla: [
    ["ARC ÉTENDU", "tesla.bouncesFlat", 2, "+2 rebonds"],
    ["CONDUCTEUR", "tesla.bounceFalloff", 0.08, "Les rebonds conservent 8% de dégâts en plus"],
    ["DÉTONATION", "tesla.chainBlast", 0.35, "+35% de puissance d'explosion en chaîne"],
    ["IMPULSION EMP", "tesla.emp", 0.2, "Retire 20% du bouclier des cibles touchées"],
    ["CHAMP MAGNÉTIQUE", "tesla.bounceRange", 0.25, "+25% portée de rebond"],
    ["CHARGE PERSISTANTE", "tesla.chargeDur", 0.5, "+50% durée de la marque électrique"],
    ["COURT-CIRCUIT", "tesla.vsShield", 0.85, "+85% de dégâts contre les cibles à bouclier"],
    ["PARATONNERRE", "tesla.vsAir", 0.45, "+45% de dégâts contre les aériens"],
    ["MISE À LA TERRE", "tesla.vsGround", 0.35, "+35% de dégâts contre les ennemis au sol"],
    ["ARC FATAL", "tesla.lowHp", 0.7, "+70% de dégâts sur les cibles sous 35% de vie"],
    ["ÉLECTROLYSE", "tesla.shred", 1, "Chaque décharge retire définitivement 1 point d'armure"],
    ["SURTENSION CIBLÉE", "tesla.vsBoss", 0.5, "+50% de dégâts contre les boss"],
    ["PLASMA", "tesla.vsBurning", 0.5, "+50% de dégâts sur une cible qui brûle"],
    ["BOBINE LOURDE", "tesla.rate", 0.18, "+18% cadence"],
    ["SURTENSION", "tesla.damage", 0.2, "+20% dégâts"],
    ["ANTENNE", "tesla.range", 0.18, "+18% portée"]
  ],
  flame: [
    ["CARBURANT LOURD", "flame.burnDps", 0.3, "+30% dégâts de brûlure"],
    ["BRAISE", "flame.burnDur", 0.35, "+35% durée de brûlure"],
    ["GUEULE LARGE", "flame.cone", 0.2, "+20% angle du cône"],
    ["PROPAGATION", "flame.spread", 1.2, "La brûlure se propage aux ennemis à 1.2 cellule"],
    ["FONTE D'ARMURE", "flame.melt", 0.5, "La brûlure retire 0.5 armure par seconde"],
    ["STACKS PROFONDS", "flame.burnStacks", 3, "+3 cumuls de brûlure maximum"],
    ["ATTISER", "flame.vsBurning", 0.75, "+75% de dégâts sur une cible déjà en feu"],
    ["FOUR À BLINDAGE", "flame.vsArmor", 0.55, "+55% de dégâts contre les cibles blindées"],
    ["CENDRES", "flame.lowHp", 0.65, "+65% de dégâts sur les cibles sous 35% de vie"],
    ["BÛCHER", "flame.vsBoss", 0.45, "+45% de dégâts contre les boss"],
    ["DÉCAPAGE", "flame.shred", 0.8, "Chaque tick retire définitivement 0.8 point d'armure"],
    ["NAPALM COLLANT", "flame.vsSlowed", 0.5, "+50% de dégâts sur une cible ralentie ou étourdie"],
    ["SURCHAUFFE", "flame.damage", 0.2, "+20% dégâts directs"],
    ["PRESSION", "flame.range", 0.22, "+22% portée"],
    ["INJECTION", "flame.rate", 0.16, "+16% cadence"],
    ["VAPORISATION", "flame.vsShield", 0.45, "+45% de dégâts contre les cibles à bouclier"]
  ],
  aa: [
    ["SALVE", "aa.missilesFlat", 1, "+1 missile par salve"],
    ["GUIDAGE ACTIF", "aa.turnRate", 0.35, "+35% de guidage"],
    ["FLAK", "aa.flakSplash", 0.35, "+35% rayon de flak"],
    ["VERROUILLAGE MULTIPLE", "aa.multiLock", 1, "Les missiles d'une salve visent des cibles différentes"],
    ["ANTI-BLINDAGE", "aa.armorPen", 10, "Ignore 10 points d'armure"],
    ["CIEL DÉGAGÉ", "aa.vsAir", 0.4, "+40% de dégâts contre les aériens"],
    ["INTERCEPTION", "aa.vsBoss", 0.55, "+55% de dégâts contre les boss"],
    ["OGIVE THERMOBARIQUE", "aa.vsShield", 0.6, "+60% de dégâts contre les cibles à bouclier"],
    ["COUP AU BUT", "aa.fullHp", 0.5, "+50% de dégâts sur une cible encore intacte"],
    ["ACHÈVEMENT", "aa.lowHp", 0.6, "+60% de dégâts sur les cibles sous 35% de vie"],
    ["CHARGE PERFORANTE", "aa.shred", 2, "Chaque impact retire définitivement 2 points d'armure"],
    ["TIR TENDU", "aa.vsSlowed", 0.45, "+45% de dégâts sur une cible ralentie ou étourdie"],
    ["OGIVE LOURDE", "aa.damage", 0.2, "+20% dégâts"],
    ["RADAR LONGUE PORTÉE", "aa.range", 0.22, "+22% portée"],
    ["RECHARGEMENT RAPIDE", "aa.rate", 0.18, "+18% cadence"],
    ["DÉTONATION DE PROXIMITÉ", "aa.vsBurning", 0.4, "+40% de dégâts sur une cible qui brûle"]
  ],
  player: [
    ["FORTIFICATION", "player.lives", 3, "+3 vies maximum"],
    ["TRÉSOR DE GUERRE", "player.startGold", 60, "+60 or de départ"],
    ["PILLAGE", "player.goldPerKill", 0.12, "+12% or par élimination"],
    ["LOGISTIQUE", "player.waveBonus", 0.15, "+15% bonus de fin de vague"],
    ["RECYCLAGE", "player.sellRatio", 0.08, "+8% remboursement à la vente"],
    ["PROSPECTION", "player.materials", 0.1, "+10% matériaux récoltés"],
    ["PLACEMENTS", "player.interest", 0.03, "+3% d'intérêts sur l'or en fin de vague"],
    ["DOCTRINE", "player.allDamage", 0.05, "+5% dégâts de toutes les tours"],
    ["GÉNIE MILITAIRE", "player.regen", 0.34, "Répare 1 point d'intégrité toutes les 3 vagues"],
    ["PRIME DE CHASSE", "player.bossBounty", 1, "Les boss rapportent le double de crédits"],
    ["BOUCLIER DE SECTEUR", "player.leakShield", 1, "La première fuite de chaque vague ne coûte rien"],
    ["BUTIN DE GUERRE", "player.firstBlood", 25, "La première élimination de chaque vague verse 25 crédits"],
    ["INGÉNIERIE", "player.upgradeCost", -0.12, "-12% sur le coût des améliorations"],
    ["CHAÎNE DE PRODUCTION", "player.allCost", -0.08, "-8% sur le coût de toutes les tours"],
    ["RÉQUISITION", "player.startGold", 90, "+90 or de départ"],
    ["DERNIER REMPART", "player.lastStand", 0.5, "Sous 5 points d'intégrité, +50% de dégâts partout"]
  ]
};




// Clés de voûte : modifient une règle du jeu. Rares (3 % des noeuds).
export const KEYSTONES = {
  mg: [
    ['DÉLUGE', 'mg.deluge', 1, 'La mitraillette ne perd plus son régime entre deux vagues'],
    ['FUSILLADE', 'mg.fusillade', 1, 'Chaque 10e balle inflige des dégâts triplés'],
    ['MUR DE PLOMB', 'mg.wall', 1, '+60% dégâts contre les cibles à moins d\'une cellule']
  ],
  sniper: [
    ['UN COUP, UNE MORT', 'sniper.oneshot', 1, 'Les critiques ignorent toute réduction et percent tout'],
    ['SILENCE RADIO', 'sniper.silence', 1, 'Portée illimitée sur la première cible de chaque vague'],
    ['CASCADE', 'sniper.cascade', 1, 'Une élimination recharge instantanément le tir']
  ],
  mortar: [
    ['TAPIS DE BOMBES', 'mortar.carpet', 1, 'Chaque 5e salve tire 4 obus en éventail'],
    ['TERRE BRÛLÉE', 'mortar.scorched', 1, 'Les cratères sont permanents pendant la vague'],
    ['IMPLOSION', 'mortar.implode', 1, 'L\'explosion attire les ennemis vers son centre']
  ],
  tesla: [
    ['RÉACTION EN CHAÎNE TOTALE', 'tesla.infinite', 1, 'Sous 20% de vie, la chaîne rebondit sans limite'],
    ['ORAGE', 'tesla.storm', 1, 'Toutes les 6 secondes, un éclair frappe la cible la plus solide'],
    ['SURCHARGE CRITIQUE', 'tesla.overload', 1, 'Un ennemi chargé qui meurt recharge les chargés voisins']
  ],
  flame: [
    ['INFERNO', 'flame.inferno', 1, 'Les brûlures ne s\'arrêtent plus tant que la cible reste en vie'],
    ['COMBUSTION', 'flame.combust', 1, 'Une cible qui meurt en brûlant explose'],
    ['SOUFFLE DU DRAGON', 'flame.dragon', 1, 'Le cône touche désormais aussi les aériens à basse altitude']
  ],
  aa: [
    ['BARRAGE ANTIAÉRIEN', 'aa.barrage', 1, 'Tire une salve complète sur chaque nouvelle vague aérienne'],
    ['CIEL INTERDIT', 'aa.nofly', 1, '+50% dégâts contre les boss aériens'],
    ['MISSILES EN GRAPPE', 'aa.cluster', 1, 'Chaque missile se divise en 3 à l\'impact']
  ],
  player: [
    ['COMMANDEMENT', 'player.command', 1, '+1 vie tous les 5 vagues survécues'],
    ['ÉCONOMIE DE GUERRE', 'player.war', 1, 'La première tour de chaque type est gratuite'],
    ['SURVIVANT', 'player.survivor', 1, 'À 1 vie, toutes les tours gagnent +40% de dégâts']
  ]
};

// ============================================================
//  RENDU
// ============================================================

// ============================================================
//  VARIANTES DE TOURELLES
// ============================================================
// Chaque tourelle a 3 versions mutuellement exclusives. Le joueur en
// choisit UNE par tourelle avant de partir en mission (écran de loadout) ;
// elle s'applique alors à toutes les tourelles de ce type de la partie.
//
//   mult   multiplie une stat de base           (damage, rate, range…)
//   add    ajoute à une stat                    (bounces, missiles, pierce…)
//   flags  active un comportement dans combat.js
//   cost   multiplie le prix de construction
//
// Les variantes sont des ARBITRAGES, pas des améliorations : ce qu'une
// version gagne d'un côté, elle le paie de l'autre.

export const VARIANTS = {
  mg: [
    {
      id: 'mg_rate', name: 'ROTATIVE', short: 'CADENCE', icon: '»', accent: '#4da3ff',
      desc: 'Cadence quasi doublée et montée en régime éclair, mais des balles bien plus légères.',
      mult: { rate: 1.9, damage: 0.72, spinUp: 0.55 }
    },
    {
      id: 'mg_dmg', name: 'CALIBRE LOURD', short: 'DÉGÂTS', icon: '✦', accent: '#e46363',
      desc: 'Munitions lourdes qui percent le blindage, au prix d\'une cadence divisée par deux.',
      mult: { damage: 1.8, rate: 0.5 }, add: { armorPen: 6 }, cost: 1.25
    },
    {
      id: 'mg_range', name: 'AFFÛT LONG', short: 'PORTÉE', icon: '◎', accent: '#71d58a',
      desc: 'Portée quasi doublée : une seule tourelle couvre plusieurs boucles du chemin.',
      mult: { range: 1.85, damage: 0.78, rate: 0.88 }
    }
  ],

  sniper: [
    {
      id: 'sniper_rate', name: 'CULASSE AUTO', short: 'CADENCE', icon: '»', accent: '#0d67ff',
      desc: 'Tire deux fois plus vite, avec des balles moins lourdes.',
      mult: { rate: 2.1, damage: 0.6 }
    },
    {
      id: 'sniper_dmg', name: 'ANTI-MATÉRIEL', short: 'DÉGÂTS', icon: '✦', accent: '#b3261e',
      desc: 'Un coup, un trou : dégâts massifs, traverse deux cibles de plus, mais tire lentement.',
      mult: { damage: 2.2, rate: 0.6 }, add: { pierce: 2 }, cost: 1.25
    },
    {
      id: 'sniper_support', name: 'POSTE DE COMMANDEMENT', short: 'SUPPORT', icon: '✚', accent: '#71d58a',
      desc: 'Tire faiblement, mais toutes les 3 vagues elle rend 1 point d\'intégrité et verse une prime en crédits.',
      mult: { damage: 0.42, rate: 0.75 }, flags: { support: true }, cost: 1.15,
      supportEvery: 3, supportLives: 1, supportGoldBase: 18, supportGoldPerWave: 3
    }
  ],

  mortar: [
    {
      id: 'mortar_rate', name: 'TIR EN RAFALE', short: 'CADENCE', icon: '»', accent: '#0d67ff',
      desc: 'Obus plus légers mais deux fois plus fréquents, et un temps de vol raccourci.',
      mult: { rate: 2.0, damage: 0.68, arcTime: 0.7 }
    },
    {
      id: 'mortar_nuke', name: 'OGIVE NUCLÉAIRE', short: 'NUCLÉAIRE', icon: '☢', accent: '#c6e600',
      desc: 'Très lente, mais dévastatrice : énorme explosion, puis une zone irradiée qui continue à ronger tout ce qui la traverse.',
      mult: { damage: 2.8, rate: 0.23, splash: 1.75, arcTime: 2.2 },
      flags: { nuke: true }, cost: 2.0
    },
    {
      id: 'mortar_stun', name: 'OBUS À CONCUSSION', short: 'ÉTOURDIT', icon: '◉', accent: '#8ad8ff',
      desc: 'Dégâts réduits, mais chaque explosion cloue sur place tout ce qu\'elle touche pendant un instant.',
      mult: { damage: 0.48, splash: 1.15 }, flags: { stun: 0.6 }
    }
  ],

  tesla: [
    {
      id: 'tesla_bounces', name: 'ARC MULTIPLE', short: 'ÉCLAIRS', icon: '⌁', accent: '#0d67ff',
      desc: 'Deux fois plus de rebonds et une meilleure conservation des dégâts : ravage les groupes serrés.',
      mult: { damage: 0.88 }, add: { bounces: 6, bounceFalloff: 0.09 }
    },
    {
      id: 'tesla_dmg', name: 'SURTENSION', short: 'DÉGÂTS', icon: '✦', accent: '#e46363',
      desc: 'Décharge bien plus violente, mais l\'arc ne rebondit presque plus.',
      mult: { damage: 2.4, rate: 0.85 }, add: { bounces: -3 }, cost: 1.15
    },
    {
      id: 'tesla_range', name: 'CHAMP ÉTENDU', short: 'PORTÉE', icon: '◎', accent: '#71d58a',
      desc: 'Portée et distance de rebond très augmentées : la chaîne court beaucoup plus loin.',
      mult: { range: 1.7, bounceRange: 1.65, damage: 0.85 }
    }
  ],

  flame: [
    {
      id: 'flame_reach', name: 'LANCE LONGUE', short: 'PORTÉE', icon: '◎', accent: '#71d58a',
      desc: 'Un jet beaucoup plus long, mais un cône plus étroit : redoutable sur une ligne droite.',
      mult: { range: 2.1, cone: 0.7, damage: 1.1 }
    },
    {
      id: 'flame_nova', name: 'BRASIER', short: 'TOUT AUTOUR', icon: '❋', accent: '#ff3d3d',
      desc: 'Ne vise plus : brûle en permanence tout ce qui l\'entoure, sur 360°. À placer au cœur du trafic.',
      mult: { range: 1.05, damage: 1.05 }, set: { cone: 360 },
      flags: { omni: true }, cost: 1.25
    },
    {
      id: 'flame_thermite', name: 'THERMITE', short: 'DÉGÂTS', icon: '✦', accent: '#e46363',
      desc: 'Flammes bien plus chaudes et brûlure dévastatrice, sur une portée un peu plus courte.',
      mult: { damage: 2.8, burnDps: 3.2, range: 0.92, rate: 0.9 }, cost: 1.2
    }
  ],

  aa: [
    {
      id: 'aa_salvo', name: 'SALVE', short: 'SALVE', icon: '⁂', accent: '#0d67ff',
      desc: 'Trois missiles par tir au lieu d\'un, plus légers : sature le ciel.',
      mult: { damage: 0.52 }, add: { missiles: 2 }
    },
    {
      id: 'aa_multilock', name: 'VERROUILLAGE MULTIPLE', short: 'MULTI-LOCK', icon: '⊹', accent: '#b878ff',
      desc: 'Chaque missile d\'une salve part sur une cible différente : aucun tir gaspillé sur un mourant.',
      mult: { damage: 0.68 }, add: { missiles: 1 }, flags: { multiLock: true }
    },
    {
      id: 'aa_versatile', name: 'POLYVALENTE', short: 'SOL + AIR', icon: '✛', accent: '#71d58a',
      desc: 'Peut aussi frapper le sol, avec des dégâts très réduits — cesse d\'être une tour spécialisée.',
      mult: { damage: 0.9 }, targets: TARGET.BOTH, flags: { groundPenalty: 0.4 }, cost: 1.3
    }
  ]
};

/** Ordre d'affichage des tourelles dans l'écran de loadout. */
export const VARIANT_ORDER = ['mg', 'sniper', 'mortar', 'tesla', 'flame', 'aa'];

/** Index plat id → { archetype, index, def }, pour retrouver une variante. */
export const VARIANT_BY_ID = (() => {
  const map = Object.create(null);
  for (const arche of VARIANT_ORDER) {
    VARIANTS[arche].forEach((v, i) => { map[v.id] = { archetype: arche, index: i, def: v }; });
  }
  return map;
})();

// Anneau qui porte les 3 nœuds « VARIANTE » de chaque branche — un seul et
// même anneau, à peu près au milieu des 22 (0..21), pour que les 3 versions
// d'une tourelle soient toujours à égale distance et au même palier. Avant,
// elles étaient réparties sur 3 anneaux très éloignés (7/13/20) : une
// variante s'ouvrait très vite, les deux autres restaient hors de portée.
export const VARIANT_RING = 10;

// ============================================================
//  SYMBOLES DES NŒUDS
// ============================================================
// Chaque nœud affiche un pictogramme disant ce qu'il apporte, pour qu'on
// lise l'arbre d'un coup d'œil sans survoler chaque case.

const ICON_RULES = [
  [/\.damage$|allDamage/, '✦'],   // dégâts bruts
  [/\.rate$/, '»'],               // cadence
  [/\.range$/, '◎'],              // portée
  [/\.cost$/, '¤'],               // prix
  [/crit/i, '✷'],                 // critique
  [/pierce|armorPen/i, '➤'],      // perçage
  [/splash|flakSplash/i, '◍'],    // zone
  [/burn|craterDps|inferno|combust|melt|spread/i, '≈'],  // feu
  [/bounce|chain|emp|storm|overload|charge/i, '⌁'],      // électricité
  [/missile|salvo|barrage|cluster/i, '⁂'],               // munitions
  [/spin|deluge|fusillade/i, '◔'],                       // montée en régime
  [/cone|dragon|omni/i, '❋'],                            // cône / diffusion
  [/stun|slow|implode/i, '◉'],                           // contrôle
  [/lives|command|survivor|fortif/i, '♥'],               // survie
  [/gold|interest|sellRatio|waveBonus|war/i, '$'],       // économie
  [/materials/i, '◈'],                                   // méta
  [/vsShield|emp|shield/i, '⛨'],                         // anti-bouclier
  [/turnRate|guidage|arcTime|silence/i, '⥁'],           // trajectoire
  [/ricochet|shrapnel|multiLock|infinite/i, '✳'],       // dispersion
  [/regen|leakShield|lastStand/i, '⚕'],                 // soutien defensif
  [/bossBounty|firstBlood|allCost|upgradeCost/i, '¤'],  // economie bis
  [/vsBoss|execute|oneshot|cascade/i, '☠'],              // exécution
  [/vsAir|nofly/i, '✈'],                                 // antiaérien
  [/vsGround|wall|scorched|carpet/i, '▦'],               // sol
  [/shred|vsArmor/i, '⊘'],                               // anti-blindage
  [/lowHp|fullHp|opener|finisher/i, '◐']                 // conditionnel
];

export function iconForKey(key) {
  if (!key) return '•';
  for (const [re, glyph] of ICON_RULES) if (re.test(key)) return glyph;
  return '•';
}

export const FX = {
  maxParticles: 1400,
  shakeDecay: 9.5,
  shakeCap: 14,
  dmgNumberLife: 0.85,
  craterLife: 4.0,
  trailLife: 0.35
};

export const SPEEDS = [1, 2, 3];
