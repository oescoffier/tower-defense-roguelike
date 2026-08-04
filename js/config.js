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
// statistiques bien supérieures, et accorde en plus une capacité de
// commandement : un bonus global (les mêmes clés que les notables/clés de
// voûte de l'arbre) appliqué à TOUTES les tours de la branche concernée
// tant qu'elle reste sur le terrain.

export const COMMANDERS = {
  cmdr_fury: {
    id: 'cmdr_fury', name: 'FURIE', archetype: 'mg', cost: 300, accent: '#ff6a3d',
    targets: TARGET.BOTH, damage: 32, rate: 16, range: 4.6, projSpeed: 36, spinMax: 3.4, spinUp: 0.5, spinDown: 0.3,
    desc: 'Rafale ininterrompue qui monte en régime presque instantanément. Accorde DÉLUGE à toutes les mitrailleuses : leur régime ne retombe plus entre deux vagues.',
    grants: { 'mg.spinMax': 0.5, 'mg.deluge': 1 },
    upgrades: []
  },
  cmdr_leadstorm: {
    id: 'cmdr_leadstorm', name: 'TEMPÊTE DE PLOMB', archetype: 'mg', cost: 300, accent: '#ffae42',
    targets: TARGET.BOTH, damage: 24, rate: 22, range: 4.2, projSpeed: 42, spinMax: 2.6, spinUp: 0.8, spinDown: 0.6,
    desc: 'Un déluge de balles qui ricochent d\'une cible à l\'autre. Toutes les mitrailleuses gagnent +40% de cadence et +35% de chance de ricochet.',
    grants: { 'mg.rate': 0.4, 'mg.ricochet': 0.35 },
    upgrades: []
  },
  cmdr_bastion: {
    id: 'cmdr_bastion', name: 'BASTION', archetype: 'mg', cost: 320, accent: '#c94b4b',
    targets: TARGET.BOTH, damage: 48, rate: 12, range: 4.0, projSpeed: 30, spinMax: 2.0, spinUp: 1.0, spinDown: 1.0,
    desc: 'Mur de plomb qui écrase tout ce qui s\'approche. Toutes les mitrailleuses ignorent 10 points d\'armure et ralentissent leurs cibles de 20%.',
    grants: { 'mg.wall': 1, 'mg.armorPen': 10, 'mg.slow': 0.2 },
    upgrades: []
  },

  cmdr_ghost: {
    id: 'cmdr_ghost', name: 'FANTÔME', archetype: 'sniper', cost: 420, accent: '#ff3b3b',
    targets: TARGET.BOTH, damage: 900, rate: 1.4, range: 11, pierce: 6, critChance: 0.35, critMult: 4,
    desc: 'Tir fantôme, précision inhumaine. Accorde UN COUP, UNE MORT à tous les snipers : leurs critiques ignorent toute réduction et percent tout sur leur trajectoire.',
    grants: { 'sniper.oneshot': 1 },
    upgrades: []
  },
  cmdr_hawkeye: {
    id: 'cmdr_hawkeye', name: 'ŒIL DE FAUCON', archetype: 'sniper', cost: 380, accent: '#ff7043',
    targets: TARGET.BOTH, damage: 500, rate: 2.2, range: 13, pierce: 4, critChance: 0.5, critMult: 3,
    desc: 'Voit et abat tout ce qui entre sur le terrain. Tous les snipers gagnent +30% de portée et une portée illimitée sur la première cible de chaque vague.',
    grants: { 'sniper.silence': 1, 'sniper.range': 0.3 },
    upgrades: []
  },
  cmdr_executioner: {
    id: 'cmdr_executioner', name: 'BOURREAU', archetype: 'sniper', cost: 400, accent: '#d63447',
    targets: TARGET.BOTH, damage: 650, rate: 1.0, range: 9, pierce: 3, critChance: 0.25, critMult: 3.5,
    desc: 'Achève tout ce qui vacille. Tous les snipers exécutent les cibles sous 22% de vie et rechargent instantanément leur tir sur une élimination.',
    grants: { 'sniper.execute': 0.22, 'sniper.cascade': 1 },
    upgrades: []
  },
  cmdr_vengeance: {
    id: 'cmdr_vengeance', name: 'VENGEANCE', archetype: 'sniper', cost: 440, accent: '#a4161a',
    targets: TARGET.BOTH, damage: 1100, rate: 0.8, range: 10, pierce: 8, critChance: 0.2, critMult: 5,
    desc: 'Chaque tir embrase et transperce la colonne ennemie. Tous les snipers appliquent une brûlure à l\'impact et gagnent +60% de perçage.',
    grants: { 'sniper.burn': 1, 'sniper.pierce': 0.6 },
    upgrades: []
  },

  cmdr_heavyarty: {
    id: 'cmdr_heavyarty', name: 'ARTILLERIE LOURDE', archetype: 'mortar', cost: 380, accent: '#e0a72e',
    targets: TARGET.GROUND, damage: 260, rate: 1.0, range: 8, splash: 3.2, arcTime: 0.6,
    desc: 'Pluie d\'obus sur toute une zone. Tous les mortiers tirent 2 obus supplémentaires par salve et leurs cratères infligent +60% de dégâts.',
    grants: { 'mortar.salvo': 2, 'mortar.craterDps': 0.6 },
    upgrades: []
  },
  cmdr_scorchedearth: {
    id: 'cmdr_scorchedearth', name: 'TERRE BRÛLÉE', archetype: 'mortar', cost: 360, accent: '#c96f2e',
    targets: TARGET.GROUND, damage: 180, rate: 1.3, range: 7, splash: 2.6, arcTime: 0.55,
    desc: 'Ne laisse derrière lui que des ruines fumantes. Les cratères de tous les mortiers deviennent permanents et projettent 10 éclats à chaque explosion.',
    grants: { 'mortar.scorched': 1, 'mortar.shrapnel': 10 },
    upgrades: []
  },
  cmdr_earthquake: {
    id: 'cmdr_earthquake', name: 'SÉISME', archetype: 'mortar', cost: 380, accent: '#b5651d',
    targets: TARGET.GROUND, damage: 220, rate: 0.9, range: 7.5, splash: 3.6, arcTime: 0.7,
    desc: 'Chaque impact fait trembler le secteur. Toutes les explosions de mortier étourdissent 0.6s et aspirent les ennemis vers leur centre.',
    grants: { 'mortar.stun': 0.6, 'mortar.implode': 1 },
    upgrades: []
  },

  cmdr_lightning: {
    id: 'cmdr_lightning', name: 'FOUDRE', archetype: 'tesla', cost: 420, accent: '#7fdfff',
    targets: TARGET.BOTH, damage: 90, rate: 2.6, range: 5.5, bounces: 14, bounceFalloff: 0.94, bounceRange: 4.5, chargeDur: 6, chainBlast: 1.0,
    desc: 'L\'arc électrique ne s\'arrête presque jamais de rebondir. Déclenche ORAGE : toutes les 6 secondes, un éclair frappe la cible la plus solide du terrain.',
    grants: { 'tesla.storm': 1 },
    upgrades: []
  },
  cmdr_overvolt: {
    id: 'cmdr_overvolt', name: 'SURTENSION', archetype: 'tesla', cost: 400, accent: '#5ec8f8',
    targets: TARGET.BOTH, damage: 130, rate: 2.0, range: 5, bounces: 8, bounceFalloff: 0.9, bounceRange: 3.6, chargeDur: 5, chainBlast: 1.4,
    desc: 'Chaque mort chargée devient une bombe. Accorde SURCHARGE CRITIQUE à tous les teslas et +50% de puissance d\'explosion en chaîne.',
    grants: { 'tesla.overload': 1, 'tesla.chainBlast': 0.5 },
    upgrades: []
  },
  cmdr_reactor: {
    id: 'cmdr_reactor', name: 'RÉACTEUR', archetype: 'tesla', cost: 400, accent: '#38b6ff',
    targets: TARGET.BOTH, damage: 70, rate: 3.2, range: 5.2, bounces: 10, bounceFalloff: 0.92, bounceRange: 4.0, chargeDur: 6, chainBlast: 0.8,
    desc: 'Une cadence effrénée qui ne faiblit jamais. Sous 20% de vie, la chaîne de tous les teslas rebondit sans limite, et chaque impact retire 50% du bouclier touché.',
    grants: { 'tesla.infinite': 1, 'tesla.emp': 0.5 },
    upgrades: []
  },
  cmdr_endlessstorm: {
    id: 'cmdr_endlessstorm', name: 'ORAGE ÉTERNEL', archetype: 'tesla', cost: 460, accent: '#29a8e0',
    targets: TARGET.BOTH, damage: 100, rate: 2.2, range: 5.6, bounces: 12, bounceFalloff: 0.93, bounceRange: 4.2, chargeDur: 7, chainBlast: 1.2,
    desc: 'Le ciel entier devient une arme. Cumule ORAGE et RÉACTION EN CHAÎNE TOTALE sur tous les teslas — l\'orage le plus dévastateur du secteur.',
    grants: { 'tesla.storm': 1, 'tesla.infinite': 1 },
    upgrades: []
  },

  cmdr_inferno: {
    id: 'cmdr_inferno', name: 'INFERNO', archetype: 'flame', cost: 380, accent: '#ff5722',
    targets: TARGET.GROUND, damage: 55, rate: 9, range: 3.6, cone: 110, burnDps: 40, burnDur: 6, burnStacks: 12,
    desc: 'Une mer de flammes qui ne s\'éteint jamais. Accorde INFERNO à tous les lance-flammes : leurs brûlures ne s\'arrêtent plus tant que la cible reste en vie.',
    grants: { 'flame.inferno': 1 },
    upgrades: []
  },
  cmdr_dragon: {
    id: 'cmdr_dragon', name: 'DRAGON', archetype: 'flame', cost: 380, accent: '#ff8a3d',
    targets: TARGET.GROUND, damage: 45, rate: 8, range: 3.8, cone: 90, burnDps: 30, burnDur: 5, burnStacks: 10,
    desc: 'Souffle un cône de feu qui touche même les aériens à basse altitude. Tous les lance-flammes propagent leur brûlure à 2 cellules autour de la cible.',
    grants: { 'flame.dragon': 1, 'flame.spread': 2 },
    upgrades: []
  },
  cmdr_combustion: {
    id: 'cmdr_combustion', name: 'COMBUSTION', archetype: 'flame', cost: 360, accent: '#ff3d00',
    targets: TARGET.GROUND, damage: 60, rate: 7, range: 3.4, cone: 80, burnDps: 45, burnDur: 5, burnStacks: 8,
    desc: 'Chaque cadavre en flammes devient une explosion. Toutes les brûlures de lance-flammes font exploser leur cible à sa mort et rongent 1.2 armure/s.',
    grants: { 'flame.combust': 1, 'flame.melt': 1.2 },
    upgrades: []
  },

  cmdr_totalflak: {
    id: 'cmdr_totalflak', name: 'FLAK TOTALE', archetype: 'aa', cost: 440, accent: '#4fc3f7',
    targets: TARGET.AIR, damage: 380, rate: 2.0, range: 9, missiles: 5, missileSpeed: 20, turnRate: 9, flakSplash: 2.2,
    desc: 'Sature le ciel de munitions. Toutes les DCA verrouillent des cibles différentes par salve et chaque missile se divise en 3 à l\'impact.',
    grants: { 'aa.multiLock': 1, 'aa.cluster': 1 },
    upgrades: []
  },
  cmdr_sentinel: {
    id: 'cmdr_sentinel', name: 'SENTINELLE', archetype: 'aa', cost: 420, accent: '#29b6f6',
    targets: TARGET.AIR, damage: 450, rate: 1.6, range: 10, missiles: 3, missileSpeed: 18, turnRate: 8, flakSplash: 1.8,
    desc: 'Ne laisse rien franchir la ligne aérienne. Toutes les DCA tirent une salve complète à chaque nouvelle vague aérienne et infligent +50% aux boss volants.',
    grants: { 'aa.barrage': 1, 'aa.nofly': 1 },
    upgrades: []
  },
  cmdr_interceptor: {
    id: 'cmdr_interceptor', name: 'INTERCEPTEUR', archetype: 'aa', cost: 400, accent: '#039be5',
    targets: TARGET.AIR, damage: 320, rate: 2.6, range: 8.5, missiles: 4, missileSpeed: 24, turnRate: 11, flakSplash: 1.6,
    desc: 'Rien n\'est assez rapide ou blindé pour lui échapper. Toutes les DCA ignorent 20 points d\'armure et gagnent +50% de guidage.',
    grants: { 'aa.armorPen': 20, 'aa.turnRate': 0.5 },
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
// (mêmes multiplicateurs que TOWERS[archetype].upgrades) à la fois à la
// tour elle-même et à la capacité de commandement qu'elle accorde.
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
  prepTime: 12           // secondes de préparation avant la 1re vague
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
  nodeR: 13,
  notableR: 19,
  keystoneR: 27,
  minorRate: 0.84,
  notableRate: 0.13,
  costBase: 6,
  costPerRing: 3,
  notableCostMult: 3,
  keystoneCostMult: 8
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
const towerStats = (t) => ([
  { key: `${t}.damage`, v: 0.02, fmt: '+{v}% dégâts', pct: true, w: 26 },
  { key: `${t}.rate`, v: 0.015, fmt: '+{v}% cadence', pct: true, w: 22 },
  { key: `${t}.range`, v: 0.012, fmt: '+{v}% portée', pct: true, w: 16 },
  { key: `${t}.cost`, v: -0.008, fmt: '{v}% coût de construction', pct: true, w: 10 }
]);

export const BRANCH_STATS = {
  mg: [
    ...towerStats('mg'),
    { key: 'mg.spinMax', v: 0.02, fmt: '+{v}% régime maximum', pct: true, w: 12 },
    { key: 'mg.spinUp', v: -0.02, fmt: '{v}% temps de montée en régime', pct: true, w: 8 },
    { key: 'mg.ricochet', v: 0.01, fmt: '+{v}% chance de ricochet', pct: true, w: 8 }
  ],
  sniper: [
    ...towerStats('sniper'),
    { key: 'sniper.critChance', v: 0.008, fmt: '+{v}% chance critique', pct: true, w: 14 },
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
    { key: 'tesla.bounceFalloff', v: 0.01, fmt: '+{v}% dégâts conservés par rebond', pct: true, w: 12 },
    { key: 'tesla.chainBlast', v: 0.025, fmt: '+{v}% explosion en chaîne', pct: true, w: 12 }
  ],
  flame: [
    ...towerStats('flame'),
    { key: 'flame.burnDps', v: 0.025, fmt: '+{v}% dégâts de brûlure', pct: true, w: 20 },
    { key: 'flame.burnDur', v: 0.02, fmt: '+{v}% durée de brûlure', pct: true, w: 14 },
    { key: 'flame.cone', v: 0.012, fmt: '+{v}% angle du cône', pct: true, w: 10 }
  ],
  aa: [
    ...towerStats('aa'),
    { key: 'aa.turnRate', v: 0.03, fmt: '+{v}% guidage', pct: true, w: 14 },
    { key: 'aa.flakSplash', v: 0.02, fmt: '+{v}% rayon de flak', pct: true, w: 14 },
    { key: 'aa.missiles', v: 0.02, fmt: '+{v}% salve de missiles', pct: true, w: 8 }
  ],
  player: [
    { key: 'player.lives', v: 0.04, fmt: '+{v} vie maximale', flat: true, w: 22 },
    { key: 'player.startGold', v: 6, fmt: '+{v} or de départ', flat: true, w: 24 },
    { key: 'player.goldPerKill', v: 0.02, fmt: '+{v}% or par élimination', pct: true, w: 20 },
    { key: 'player.waveBonus', v: 0.025, fmt: '+{v}% bonus de fin de vague', pct: true, w: 16 },
    { key: 'player.sellRatio', v: 0.006, fmt: '+{v}% remboursement à la vente', pct: true, w: 10 },
    { key: 'player.materials', v: 0.012, fmt: '+{v}% matériaux récoltés', pct: true, w: 14 },
    { key: 'player.interest', v: 0.004, fmt: '+{v}% intérêts par vague', pct: true, w: 10 },
    { key: 'player.allDamage', v: 0.006, fmt: '+{v}% dégâts de toutes les tours', pct: true, w: 8 }
  ]
};

// Notables : effets nommés, tirés au sort par branche.
export const NOTABLES = {
  mg: [
    ['CANON JUMELÉ', 'mg.damage', 0.14, '+14% dégâts mitraillette'],
    ['BARILLET FROID', 'mg.spinDown', -0.35, 'La montée en régime se dissipe 35% moins vite'],
    ['MUNITIONS PERFORANTES', 'mg.armorPen', 4, 'Ignore 4 points d\'armure'],
    ['SUR-RÉGIME', 'mg.spinMax', 0.25, '+25% de régime maximum'],
    ['RICOCHET', 'mg.ricochet', 0.18, '+18% de chance de ricochet sur une seconde cible'],
    ['CHARGEUR TAMBOUR', 'mg.rate', 0.16, '+16% cadence'],
    ['LIGNE DE MIRE', 'mg.range', 0.18, '+18% portée'],
    ['SUPPRESSION', 'mg.slow', 0.10, 'Les cibles touchées sont ralenties de 10%']
  ],
  sniper: [
    ['ŒIL D\'AIGLE', 'sniper.range', 0.22, '+22% portée'],
    ['POINT FAIBLE', 'sniper.critChance', 0.10, '+10% chance critique'],
    ['CALIBRE LOURD', 'sniper.damage', 0.18, '+18% dégâts'],
    ['TRAVERSÉE', 'sniper.pierce', 0.5, '+50% de cibles traversées'],
    ['EXÉCUTION', 'sniper.execute', 0.08, 'Élimine les cibles non-boss sous 8% de vie'],
    ['CULASSE RAPIDE', 'sniper.rate', 0.18, '+18% cadence'],
    ['BALLE INCENDIAIRE', 'sniper.burn', 1, 'Applique une brûlure à l\'impact'],
    ['LETALITÉ', 'sniper.critMult', 0.4, '+40% dégâts critiques']
  ],
  mortar: [
    ['CHARGE CREUSE', 'mortar.damage', 0.20, '+20% dégâts'],
    ['ONDE DE CHOC', 'mortar.splash', 0.20, '+20% rayon d\'explosion'],
    ['NAPALM', 'mortar.craterDps', 0.45, '+45% dégâts de cratère'],
    ['SALVE DOUBLE', 'mortar.salvo', 1, 'Tire un obus supplémentaire par salve'],
    ['ÉCLATS', 'mortar.shrapnel', 6, 'L\'explosion projette 6 éclats'],
    ['TIR TENDU', 'mortar.arcTime', -0.3, '-30% temps de vol'],
    ['BOMBARDEMENT', 'mortar.range', 0.20, '+20% portée'],
    ['SISMIQUE', 'mortar.stun', 0.35, 'Étourdit les cibles 0.35s dans le rayon']
  ],
  tesla: [
    ['SURTENSION', 'tesla.damage', 0.20, '+20% dégâts'],
    ['ARC ÉTENDU', 'tesla.bouncesFlat', 2, '+2 rebonds'],
    ['CONDUCTEUR', 'tesla.bounceFalloff', 0.08, 'Les rebonds conservent 8% de dégâts en plus'],
    ['DÉTONATION', 'tesla.chainBlast', 0.35, '+35% de puissance d\'explosion en chaîne'],
    ['IMPULSION EMP', 'tesla.emp', 0.2, 'Retire 20% du bouclier des cibles touchées'],
    ['BOBINE LOURDE', 'tesla.rate', 0.18, '+18% cadence'],
    ['CHAMP MAGNÉTIQUE', 'tesla.bounceRange', 0.25, '+25% portée de rebond'],
    ['CHARGE PERSISTANTE', 'tesla.chargeDur', 0.5, '+50% durée de la marque électrique']
  ],
  flame: [
    ['CARBURANT LOURD', 'flame.burnDps', 0.30, '+30% dégâts de brûlure'],
    ['BRASIER', 'flame.burnDur', 0.35, '+35% durée de brûlure'],
    ['GUEULE LARGE', 'flame.cone', 0.20, '+20% angle du cône'],
    ['PROPAGATION', 'flame.spread', 1.2, 'La brûlure se propage aux ennemis à 1.2 cellule'],
    ['FONTE D\'ARMURE', 'flame.melt', 0.5, 'La brûlure retire 0.5 armure par seconde'],
    ['PRESSION', 'flame.range', 0.22, '+22% portée'],
    ['SURCHAUFFE', 'flame.damage', 0.20, '+20% dégâts directs'],
    ['STACKS PROFONDS', 'flame.burnStacks', 3, '+3 cumuls de brûlure maximum']
  ],
  aa: [
    ['OGIVE LOURDE', 'aa.damage', 0.20, '+20% dégâts'],
    ['SALVE', 'aa.missilesFlat', 1, '+1 missile par salve'],
    ['GUIDAGE ACTIF', 'aa.turnRate', 0.35, '+35% de guidage'],
    ['FLAK', 'aa.flakSplash', 0.35, '+35% rayon de flak'],
    ['VERROUILLAGE MULTIPLE', 'aa.multiLock', 1, 'Les missiles d\'une salve visent des cibles différentes'],
    ['RADAR LONGUE PORTÉE', 'aa.range', 0.22, '+22% portée'],
    ['RECHARGEMENT RAPIDE', 'aa.rate', 0.18, '+18% cadence'],
    ['ANTI-BLINDAGE', 'aa.armorPen', 10, 'Ignore 10 points d\'armure']
  ],
  player: [
    ['FORTIFICATION', 'player.lives', 3, '+3 vies maximum'],
    ['TRÉSOR DE GUERRE', 'player.startGold', 60, '+60 or de départ'],
    ['PILLAGE', 'player.goldPerKill', 0.12, '+12% or par élimination'],
    ['LOGISTIQUE', 'player.waveBonus', 0.15, '+15% bonus de fin de vague'],
    ['RECYCLAGE', 'player.sellRatio', 0.08, '+8% remboursement à la vente'],
    ['PROSPECTION', 'player.materials', 0.10, '+10% matériaux récoltés'],
    ['PLACEMENTS', 'player.interest', 0.03, '+3% d\'intérêts sur l\'or en fin de vague'],
    ['DOCTRINE', 'player.allDamage', 0.05, '+5% dégâts de toutes les tours']
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

export const FX = {
  maxParticles: 1400,
  shakeDecay: 9.5,
  shakeCap: 14,
  dmgNumberLife: 0.85,
  craterLife: 4.0,
  trailLife: 0.35
};

export const SPEEDS = [1, 2, 3];
