// ============================================================
//  CARDS — draft de fin de vague.
//
//  Toutes les 3 vagues, le jeu se met en pause et propose 3 cartes ;
//  le joueur en garde une pour le reste de la partie. C'est la couche
//  roguelike : deux parties ne se ressemblent plus.
//
//  Une carte se contente d'écrire dans `game.mods` — les mêmes clés que
//  l'arbre de compétences et les commandants. Rien de neuf côté combat :
//  tout est déjà appliqué par `hit()`, `Tower.recompute()` et compagnie.
//  Les cartes marquées `apply` produisent en plus un effet immédiat.
// ============================================================

import { PALETTE, TOWERS } from './config.js';

export const DRAFT_EVERY = 3;   // une offre toutes les N vagues
export const DRAFT_CHOICES = 3; // cartes proposées

// ============================================================
//  Raretés
// ============================================================
// `weight` est le poids de base ; il glisse vers le haut au fil des
// vagues (voir rarityWeights) pour que les offres tardives soient
// dignes de la difficulté du moment.

export const RARITY = {
  // Gris volontairement sourd : en blanc clair, une commune ressortait
  // plus qu'une rare sur fond noir et inversait la hiérarchie de rareté.
  common: { id: 'common', name: 'COMMUNE', color: '#6f6f6f', weight: 100, drift: -2.2 },
  rare: { id: 'rare', name: 'RARE', color: '#0d67ff', weight: 42, drift: 0.6 },
  epic: { id: 'epic', name: 'ÉPIQUE', color: '#b878ff', weight: 13, drift: 1.1 },
  legendary: { id: 'legendary', name: 'LÉGENDAIRE', color: '#f0d24b', weight: 3.2, drift: 0.5 },
  // Cartes clin d'œil : probabilité volontairement minuscule, elles ne
  // sont pas censées être vues souvent.
  secret: { id: 'secret', name: '? ? ?', color: '#71d58a', weight: 0.17, drift: 0.012 }
};

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'secret'];

/** Poids des raretés à une vague donnée : les offres montent en gamme. */
export function rarityWeights(wave) {
  const out = {};
  for (const id of RARITY_ORDER) {
    const r = RARITY[id];
    out[id] = Math.max(id === 'common' ? 14 : 0.2, r.weight + r.drift * wave);
  }
  return out;
}

// ============================================================
//  Pool
// ============================================================
// Format compact : [id, nom, rareté, icône, description, mods, options]
// `mods`    : clés ajoutées à game.mods (mêmes clés que l'arbre)
// `options` : { unique, apply(game), cond(game) }

const P = [

  // ---------------------------------------------------------
  //  MITRAILLETTE
  // ---------------------------------------------------------
  ['mg_c1', 'PLOMB LOURD', 'common', '✦', '+25% de dégâts pour les mitraillettes', { 'mg.damage': 0.25 }],
  ['mg_c2', 'BARILLET HUILÉ', 'common', '»', '+20% de cadence pour les mitraillettes', { 'mg.rate': 0.20 }],
  ['mg_c3', 'LUNETTE DE CAMPAGNE', 'common', '◎', '+22% de portée pour les mitraillettes', { 'mg.range': 0.22 }],
  ['mg_c4', 'NOYAU PERFORANT', 'common', '➤', 'Les mitraillettes ignorent 5 points d\'armure', { 'mg.armorPen': 5 }],
  ['mg_r1', 'SUR-RÉGIME', 'rare', '◔', '+45% de régime maximum et montée deux fois plus rapide', { 'mg.spinMax': 0.45, 'mg.spinUp': -0.5 }],
  ['mg_r2', 'RICOCHET GUIDÉ', 'rare', '✳', '+35% de chance de ricochet sur une seconde cible', { 'mg.ricochet': 0.35 }],
  ['mg_r3', 'TIR DE SUPPRESSION', 'rare', '◉', 'Les cibles touchées sont ralenties de 22%', { 'mg.slow': 0.22 }],
  ['mg_e1', 'FUSILLADE', 'epic', '⁂', '+55% de dégâts et +30% de cadence pour les mitraillettes', { 'mg.damage': 0.55, 'mg.rate': 0.30 }],
  ['mg_e2', 'MEULE À BLINDAGE', 'epic', '⊘', 'Chaque balle retire 1 point d\'armure définitivement', { 'mg.shred': 1 }],
  ['mg_l1', 'DÉLUGE', 'legendary', '◔', 'Le régime des mitraillettes ne retombe plus jamais, et chaque 10e balle triple ses dégâts', { 'mg.deluge': 1, 'mg.fusillade': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  SNIPER
  // ---------------------------------------------------------
  ['sn_c1', 'MUNITION CALIBRÉE', 'common', '✦', '+28% de dégâts pour les snipers', { 'sniper.damage': 0.28 }],
  ['sn_c2', 'CULASSE POLIE', 'common', '»', '+22% de cadence pour les snipers', { 'sniper.rate': 0.22 }],
  ['sn_c3', 'TÉLÉMÈTRE', 'common', '◎', '+30% de portée pour les snipers', { 'sniper.range': 0.30 }],
  ['sn_c4', 'POINT FAIBLE', 'common', '✷', '+12% de chance critique pour les snipers', { 'sniper.critChance': 0.12 }],
  ['sn_r1', 'LÉTALITÉ', 'rare', '✷', '+70% de dégâts critiques pour les snipers', { 'sniper.critMult': 0.70 }],
  ['sn_r2', 'BALLE TRAVERSANTE', 'rare', '➤', '+120% de cibles traversées par tir', { 'sniper.pierce': 1.2 }],
  ['sn_r3', 'BALLE INCENDIAIRE', 'rare', '≈', 'Les tirs de sniper enflamment leur cible', { 'sniper.burn': 1 }, { unique: true }],
  ['sn_e1', 'EXÉCUTION', 'epic', '☠', 'Élimine instantanément les cibles non-boss sous 14% de vie', { 'sniper.execute': 0.14 }],
  ['sn_e2', 'CHASSEUR DE COLOSSES', 'epic', '☠', '+90% de dégâts de sniper contre les boss', { 'sniper.vsBoss': 0.90 }],
  ['sn_l1', 'UN COUP, UNE MORT', 'legendary', '✷', 'Les critiques de sniper ignorent toute réduction et traversent tout. Une élimination recharge le tir instantanément', { 'sniper.oneshot': 1, 'sniper.cascade': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  MORTIER
  // ---------------------------------------------------------
  ['mo_c1', 'CHARGE CREUSE', 'common', '✦', '+25% de dégâts pour les mortiers', { 'mortar.damage': 0.25 }],
  ['mo_c2', 'CHARGEMENT RAPIDE', 'common', '»', '+20% de cadence pour les mortiers', { 'mortar.rate': 0.20 }],
  ['mo_c3', 'ONDE DE CHOC', 'common', '◍', '+25% de rayon d\'explosion', { 'mortar.splash': 0.25 }],
  ['mo_c4', 'TIR TENDU', 'common', '⥁', 'Les obus arrivent 30% plus vite', { 'mortar.arcTime': -0.30 }],
  ['mo_r1', 'NAPALM', 'rare', '≈', '+80% de dégâts de cratère', { 'mortar.craterDps': 0.80 }],
  ['mo_r2', 'SALVE DOUBLE', 'rare', '⁂', 'Chaque tir de mortier lance un obus supplémentaire', { 'mortar.salvo': 1 }],
  ['mo_r3', 'ÉCLATS', 'rare', '✳', 'Chaque explosion projette 8 éclats', { 'mortar.shrapnel': 8 }],
  ['mo_e1', 'SISMIQUE', 'epic', '◉', 'Les explosions de mortier étourdissent 0.5 s', { 'mortar.stun': 0.5 }],
  ['mo_e2', 'DÉMOLITION', 'epic', '⊘', '+85% de dégâts de mortier contre les cibles blindées', { 'mortar.vsArmor': 0.85 }],
  ['mo_l1', 'TAPIS DE BOMBES', 'legendary', '▦', 'Chaque 5e salve tire 4 obus en éventail, et les cratères durent toute la vague', { 'mortar.carpet': 1, 'mortar.scorched': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  TESLA
  // ---------------------------------------------------------
  ['te_c1', 'BOBINE DENSE', 'common', '✦', '+26% de dégâts pour les teslas', { 'tesla.damage': 0.26 }],
  ['te_c2', 'DÉCHARGE RAPIDE', 'common', '»', '+22% de cadence pour les teslas', { 'tesla.rate': 0.22 }],
  ['te_c3', 'ANTENNE HAUTE', 'common', '◎', '+25% de portée pour les teslas', { 'tesla.range': 0.25 }],
  ['te_c4', 'ARC ÉTENDU', 'common', '⌁', '+2 rebonds pour les teslas', { 'tesla.bouncesFlat': 2 }],
  ['te_r1', 'SUPRACONDUCTEUR', 'rare', '⌁', 'Les rebonds conservent 12% de dégâts en plus', { 'tesla.bounceFalloff': 0.12 }],
  ['te_r2', 'CHAMP MAGNÉTIQUE', 'rare', '◎', '+50% de portée de rebond', { 'tesla.bounceRange': 0.50 }],
  ['te_r3', 'IMPULSION EMP', 'rare', '⛨', 'Chaque décharge retire 35% du bouclier de sa cible', { 'tesla.emp': 0.35 }],
  ['te_e1', 'DÉTONATION', 'epic', '⌁', '+80% de puissance des réactions en chaîne', { 'tesla.chainBlast': 0.80 }],
  ['te_e2', 'SURCHARGE', 'epic', '⌁', 'Un ennemi chargé qui meurt recharge tous ses voisins', { 'tesla.overload': 1 }, { unique: true }],
  ['te_l1', 'ORAGE PERMANENT', 'legendary', '⌁', 'Un éclair frappe la cible la plus solide toutes les 6 s, et la chaîne rebondit sans limite sous 20% de vie', { 'tesla.storm': 1, 'tesla.infinite': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  LANCE-FLAMME
  // ---------------------------------------------------------
  ['fl_c1', 'CARBURANT RAFFINÉ', 'common', '✦', '+28% de dégâts pour les lance-flammes', { 'flame.damage': 0.28 }],
  ['fl_c2', 'INJECTION FORCÉE', 'common', '»', '+22% de cadence pour les lance-flammes', { 'flame.rate': 0.22 }],
  ['fl_c3', 'BUSE LONGUE', 'common', '◎', '+28% de portée pour les lance-flammes', { 'flame.range': 0.28 }],
  ['fl_c4', 'GUEULE LARGE', 'common', '❋', '+35% d\'angle de cône', { 'flame.cone': 0.35 }],
  ['fl_r1', 'THERMITE', 'rare', '≈', '+70% de dégâts de brûlure', { 'flame.burnDps': 0.70 }],
  ['fl_r2', 'BRAISE TENACE', 'rare', '≈', '+80% de durée de brûlure', { 'flame.burnDur': 0.80 }],
  ['fl_r3', 'FONTE D\'ARMURE', 'rare', '⊘', 'La brûlure ronge 1.2 point d\'armure par seconde', { 'flame.melt': 1.2 }],
  ['fl_e1', 'PROPAGATION', 'epic', '❋', 'La brûlure se propage aux ennemis à 2 cellules', { 'flame.spread': 2 }],
  ['fl_e2', 'SOUFFLE DU DRAGON', 'epic', '✈', 'Les lance-flammes atteignent désormais aussi les aériens', { 'flame.dragon': 1 }, { unique: true }],
  ['fl_l1', 'INFERNO', 'legendary', '≈', 'Les brûlures ne s\'éteignent plus, et toute cible qui meurt en brûlant explose', { 'flame.inferno': 1, 'flame.combust': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  DCA
  // ---------------------------------------------------------
  ['aa_c1', 'OGIVE DENSE', 'common', '✦', '+26% de dégâts pour les DCA', { 'aa.damage': 0.26 }],
  ['aa_c2', 'RECHARGEMENT AUTO', 'common', '»', '+22% de cadence pour les DCA', { 'aa.rate': 0.22 }],
  ['aa_c3', 'RADAR ÉTENDU', 'common', '◎', '+28% de portée pour les DCA', { 'aa.range': 0.28 }],
  ['aa_c4', 'GUIDAGE ACTIF', 'common', '⥁', '+60% de capacité de guidage des missiles', { 'aa.turnRate': 0.60 }],
  ['aa_r1', 'SALVE', 'rare', '⁂', '+1 missile par tir de DCA', { 'aa.missilesFlat': 1 }],
  ['aa_r2', 'FLAK LARGE', 'rare', '◍', '+70% de rayon d\'explosion des missiles', { 'aa.flakSplash': 0.70 }],
  ['aa_r3', 'ANTI-BLINDAGE', 'rare', '➤', 'Les missiles ignorent 15 points d\'armure', { 'aa.armorPen': 15 }],
  ['aa_e1', 'VERROUILLAGE MULTIPLE', 'epic', '⊹', 'Les missiles d\'une même salve visent des cibles différentes', { 'aa.multiLock': 1 }, { unique: true }],
  ['aa_e2', 'CIEL INTERDIT', 'epic', '✈', '+95% de dégâts de DCA contre les boss aériens', { 'aa.nofly': 1, 'aa.vsBoss': 0.5 }],
  ['aa_l1', 'MISSILES EN GRAPPE', 'legendary', '⁂', 'Chaque missile se divise en 3 à l\'impact, et une salve complète part à chaque vague aérienne', { 'aa.cluster': 1, 'aa.barrage': 1 }, { unique: true }],

  // ---------------------------------------------------------
  //  ÉCONOMIE
  // ---------------------------------------------------------
  ['ec_c1', 'PILLAGE', 'common', '$', '+18% de crédits par élimination', { 'player.goldPerKill': 0.18 }],
  ['ec_c2', 'LOGISTIQUE', 'common', '$', '+25% de prime de fin de vague', { 'player.waveBonus': 0.25 }],
  ['ec_c3', 'RECYCLAGE', 'common', '¤', '+15% de remboursement à la vente', { 'player.sellRatio': 0.15 }],
  ['ec_c4', 'APPEL D\'OFFRES', 'common', '¤', '−12% sur le coût de toutes les tours', { 'player.allCost': -0.12 }],
  ['ec_r1', 'PLACEMENTS', 'rare', '$', '+6% d\'intérêts sur tes crédits à chaque fin de vague', { 'player.interest': 0.06 }],
  ['ec_r2', 'INGÉNIERIE', 'rare', '¤', '−28% sur le coût des améliorations', { 'player.upgradeCost': -0.28 }],
  ['ec_r3', 'PRIME DE CHASSE', 'rare', '☠', 'Les boss rapportent le double de crédits', { 'player.bossBounty': 1 }, { unique: true }],
  ['ec_e1', 'BUTIN DE GUERRE', 'epic', '$', 'La première élimination de chaque vague verse 60 crédits', { 'player.firstBlood': 60 }],
  ['ec_e2', 'MONOPOLE', 'epic', '$', '+40% de crédits par élimination et +40% de prime de vague', { 'player.goldPerKill': 0.40, 'player.waveBonus': 0.40 }],
  ['ec_l1', 'ÉCONOMIE DE GUERRE', 'legendary', '¤', 'La première tour de chaque type est gratuite, et les intérêts passent à 12%', { 'player.war': 1, 'player.interest': 0.12 }, { unique: true }],

  // ---------------------------------------------------------
  //  DÉFENSE / SURVIE
  // ---------------------------------------------------------
  ['df_c1', 'FORTIFICATION', 'common', '♥', '+3 points d\'intégrité maximum', { 'player.lives': 3 },
    { apply: (g) => { g.maxLives += 3; g.lives += 3; } }],
  ['df_c2', 'RÉPARATIONS', 'common', '⚕', 'Restaure 4 points d\'intégrité immédiatement', {},
    { apply: (g) => { g.lives = Math.min(g.maxLives, g.lives + 4); } }],
  ['df_c3', 'SACS DE SABLE', 'common', '▦', '−40% sur le coût des sacs de sable', { 'sandbag.cost': -0.40 }],
  ['df_r1', 'GÉNIE MILITAIRE', 'rare', '⚕', 'Répare 1 point d\'intégrité toutes les 2 vagues', { 'player.regen': 0.5 }],
  ['df_r2', 'BOUCLIER DE SECTEUR', 'rare', '⛨', 'La première brèche de chaque vague est absorbée sans dégât', { 'player.leakShield': 1 }, { unique: true }],
  ['df_r3', 'MUR DE BÉTON', 'rare', '♥', '+6 points d\'intégrité maximum', { 'player.lives': 6 },
    { apply: (g) => { g.maxLives += 6; g.lives += 6; } }],
  ['df_e1', 'DERNIER REMPART', 'epic', '⚕', 'Sous 5 points d\'intégrité, toutes tes tours gagnent +70% de dégâts', { 'player.lastStand': 0.70 }, { unique: true }],
  ['df_e2', 'COMMANDEMENT', 'epic', '♥', '+1 point d\'intégrité maximum toutes les 5 vagues', { 'player.command': 1 }, { unique: true }],
  ['df_l1', 'SURVIVANT', 'legendary', '⚕', 'À 1 point d\'intégrité, toutes tes tours gagnent +40% de dégâts. +8 intégrité maximum', { 'player.survivor': 1, 'player.lives': 8 },
    { unique: true, apply: (g) => { g.maxLives += 8; g.lives += 8; } }],

  // ---------------------------------------------------------
  //  GLOBAL (toutes tours)
  // ---------------------------------------------------------
  ['gl_c1', 'DOCTRINE', 'common', '✦', '+8% de dégâts pour toutes tes tours', { 'player.allDamage': 0.08 }],
  ['gl_c2', 'ENTRAÎNEMENT', 'common', '✦', '+10% de dégâts pour toutes tes tours', { 'player.allDamage': 0.10 }],
  ['gl_c3', 'MAINTENANCE', 'common', '»', '+12% de cadence pour les mitraillettes, teslas et DCA', { 'mg.rate': 0.12, 'tesla.rate': 0.12, 'aa.rate': 0.12 }],
  ['gl_r1', 'GUERRE AÉRIENNE', 'rare', '✈', '+40% de dégâts contre les aériens, toutes tours confondues', { 'mg.vsAir': 0.40, 'sniper.vsAir': 0.40, 'tesla.vsAir': 0.40, 'aa.vsAir': 0.40 }],
  ['gl_r2', 'GUERRE DE TRANCHÉES', 'rare', '▦', '+35% de dégâts contre les ennemis au sol, toutes tours confondues', { 'mg.vsGround': 0.35, 'sniper.vsGround': 0.35, 'tesla.vsGround': 0.35, 'mortar.vsGround': 0.35, 'flame.vsGround': 0.35 }],
  ['gl_r3', 'COUP DE GRÂCE', 'rare', '◐', '+60% de dégâts sur toute cible sous 35% de vie', { 'mg.lowHp': 0.6, 'sniper.lowHp': 0.6, 'mortar.lowHp': 0.6, 'tesla.lowHp': 0.6, 'flame.lowHp': 0.6, 'aa.lowHp': 0.6 }],
  ['gl_e1', 'ÉTAT-MAJOR', 'epic', '✦', '+22% de dégâts pour toutes tes tours', { 'player.allDamage': 0.22 }],
  ['gl_e2', 'BRISE-BOUCLIER', 'epic', '⛨', '+80% de dégâts contre les cibles à bouclier, toutes tours confondues', { 'mg.vsShield': 0.8, 'sniper.vsShield': 0.8, 'mortar.vsShield': 0.8, 'tesla.vsShield': 0.8, 'flame.vsShield': 0.8, 'aa.vsShield': 0.8 }],
  ['gl_l1', 'SUPRÉMATIE', 'legendary', '✦', '+40% de dégâts pour toutes tes tours', { 'player.allDamage': 0.40 }],
  ['gl_l2', 'TUEUR DE TITANS', 'legendary', '☠', '+120% de dégâts contre les boss, toutes tours confondues', { 'mg.vsBoss': 1.2, 'sniper.vsBoss': 1.2, 'mortar.vsBoss': 1.2, 'tesla.vsBoss': 1.2, 'flame.vsBoss': 1.2, 'aa.vsBoss': 1.2 }],

  // ---------------------------------------------------------
  //  PACTES — un gain franc contre un vrai prix
  // ---------------------------------------------------------
  ['pc_r1', 'LIGNE DE FRONT', 'rare', '⚖', '+45% de dégâts partout, mais −25% de portée partout',
    { 'player.allDamage': 0.45, 'mg.range': -0.25, 'sniper.range': -0.25, 'mortar.range': -0.25, 'tesla.range': -0.25, 'flame.range': -0.25, 'aa.range': -0.25 }],
  ['pc_r2', 'MARCHÉ NOIR', 'rare', '⚖', '+55% de crédits par élimination, mais −20% de dégâts partout',
    { 'player.goldPerKill': 0.55, 'player.allDamage': -0.20 }],
  ['pc_r3', 'SURPRODUCTION', 'rare', '⚖', '−35% sur le coût de toutes les tours, mais −15% de cadence partout',
    { 'player.allCost': -0.35, 'mg.rate': -0.15, 'sniper.rate': -0.15, 'mortar.rate': -0.15, 'tesla.rate': -0.15, 'flame.rate': -0.15, 'aa.rate': -0.15 }],
  ['pc_r4', 'BLINDAGE SACRIFIÉ', 'rare', '⚖', '+3 intégrité maximum, mais +25% sur le coût des améliorations',
    { 'player.lives': 3, 'player.upgradeCost': 0.25 }, { apply: (g) => { g.maxLives += 3; g.lives += 3; } }],
  ['pc_e1', 'TOUT POUR L\'ATTAQUE', 'epic', '⚖', '+70% de dégâts partout, mais −4 points d\'intégrité maximum',
    { 'player.allDamage': 0.70 },
    { apply: (g) => { g.maxLives = Math.max(1, g.maxLives - 4); g.lives = Math.min(g.lives, g.maxLives); } }],
  ['pc_e2', 'GUERRE ÉCLAIR', 'epic', '⚖', '+60% de cadence partout, mais −30% de dégâts partout',
    { 'mg.rate': 0.6, 'sniper.rate': 0.6, 'mortar.rate': 0.6, 'tesla.rate': 0.6, 'flame.rate': 0.6, 'aa.rate': 0.6, 'player.allDamage': -0.30 }],
  ['pc_e3', 'ARTILLERIE LOURDE', 'epic', '⚖', '+110% de dégâts de mortier et DCA, mais −45% de leur cadence',
    { 'mortar.damage': 1.1, 'aa.damage': 1.1, 'mortar.rate': -0.45, 'aa.rate': -0.45 }],
  ['pc_e4', 'DÉSARMEMENT', 'epic', '⚖', 'Vends une tour au hasard, et gagne +35% de dégâts partout',
    { 'player.allDamage': 0.35 },
    {
      apply: (g) => {
        if (!g.towers.length) return;
        const t = g.towers[Math.floor(Math.random() * g.towers.length)];
        g.gold += t.sellValue(g.mods);
        g.grid.remove(t.gx, t.gy);
        g.towers.splice(g.towers.indexOf(t), 1);
        for (const e of g.enemies) e.repath();
      }
    }],
  ['pc_l1', 'VA-TOUT', 'legendary', '⚖', '+130% de dégâts partout, mais ton intégrité maximum tombe à 8',
    { 'player.allDamage': 1.3 },
    { unique: true, apply: (g) => { g.maxLives = 8; g.lives = Math.min(g.lives, 8); } }],
  ['pc_l2', 'DOCTRINE DU FEU', 'legendary', '⚖', 'Les lance-flammes gagnent +150% de dégâts et touchent l\'air, mais toutes les autres tours perdent 20% de dégâts',
    { 'flame.damage': 1.5, 'flame.dragon': 1, 'mg.damage': -0.2, 'sniper.damage': -0.2, 'mortar.damage': -0.2, 'tesla.damage': -0.2, 'aa.damage': -0.2 },
    { unique: true }],

  // ---------------------------------------------------------
  //  RENFORTS IMMÉDIATS
  // ---------------------------------------------------------
  ['im_c1', 'LARGAGE DE VIVRES', 'common', '$', 'Reçois 220 crédits immédiatement', {},
    { apply: (g) => { g.gold += 220; } }],
  ['im_c2', 'CAISSE DE MUNITIONS', 'common', '$', 'Reçois 150 crédits et 2 points d\'intégrité', {},
    { apply: (g) => { g.gold += 150; g.lives = Math.min(g.maxLives, g.lives + 2); } }],
  ['im_c3', 'SUBVENTION', 'common', '$', 'Reçois 90 crédits par vague déjà survécue', {},
    { apply: (g) => { g.gold += 90 * Math.max(1, g.wave); } }],
  ['im_r1', 'MISE À NIVEAU', 'rare', '⚙', 'Améliore gratuitement toutes tes tours d\'un niveau', {},
    {
      apply: (g) => {
        for (const t of g.towers) {
          if (t.level < (t.def.upgrades ? t.def.upgrades.length : 3)) {
            t.level++;
            t.recompute(g.mods);
            t.placeAnim = 0;
          }
        }
      }
    }],
  ['im_r2', 'RÉQUISITION', 'rare', '⚙', 'Reçois 400 crédits immédiatement', {},
    { apply: (g) => { g.gold += 400; } }],
  ['im_e1', 'PLAN MARSHALL', 'epic', '$', 'Reçois 800 crédits et restaure toute ton intégrité', {},
    { apply: (g) => { g.gold += 800; g.lives = g.maxLives; } }],

  // ---------------------------------------------------------
  //  CARTES SECRÈTES — clin d'œil, très rares
  // ---------------------------------------------------------
  ['eg_answer', 'LA RÉPONSE', 'secret', '4²', 'La réponse à la grande question. +42% de dégâts, de cadence, de portée et de crédits. Sur absolument tout.',
    {
      'player.allDamage': 0.42, 'player.goldPerKill': 0.42, 'player.waveBonus': 0.42,
      'mg.rate': 0.42, 'sniper.rate': 0.42, 'mortar.rate': 0.42, 'tesla.rate': 0.42, 'flame.rate': 0.42, 'aa.rate': 0.42,
      'mg.range': 0.42, 'sniper.range': 0.42, 'mortar.range': 0.42, 'tesla.range': 0.42, 'flame.range': 0.42, 'aa.range': 0.42
    },
    { unique: true }],
  ['eg_cat', 'LE CHAT DU SECTEUR', 'secret', '=^.^=', 'Personne ne sait comment il est entré. Il dort sur le réacteur et tout va mieux. +9 vies, et +9% sur à peu près tout.',
    {
      'player.lives': 9, 'player.allDamage': 0.09, 'player.goldPerKill': 0.09, 'player.materials': 0.09,
      'mg.rate': 0.09, 'sniper.rate': 0.09, 'mortar.rate': 0.09, 'tesla.rate': 0.09, 'flame.rate': 0.09, 'aa.rate': 0.09
    },
    { unique: true, apply: (g) => { g.maxLives += 9; g.lives += 9; } }]
];

/** Pool exploitable, construit une fois. */
export const CARDS = P.map(([id, name, rarity, icon, desc, mods, opts]) => ({
  id, name, rarity, icon, desc,
  mods: mods || {},
  unique: !!(opts && opts.unique),
  apply: (opts && opts.apply) || null,
  cond: (opts && opts.cond) || null,
  color: RARITY[rarity].color
}));

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Répartition du pool, pour les tests et l'affichage. */
export function poolStats() {
  const out = {};
  for (const c of CARDS) out[c.rarity] = (out[c.rarity] || 0) + 1;
  return { total: CARDS.length, ...out };
}

// ============================================================
//  Affinité — le tirage regarde ce que le joueur a réellement bâti
// ============================================================
// Proposer « +26% dégâts tesla » à quelqu'un qui n'a que des
// mitraillettes, c'est lui faire perdre un choix sur trois. On pondère
// donc les cartes par la composition de sa défense, sans jamais le dire
// ni fermer complètement une porte : le plancher laisse toujours la
// possibilité de découvrir une tourelle qu'on n'utilise pas encore.

const AFFINITY = {
  floor: 0.2,      // poids minimal pour une tourelle absente du terrain
  ceil: 2.4,       // poids maximal pour une tourelle dominante
  fullBiasAt: 8    // nombre de tours à partir duquel le biais est total
};

/** Préfixes de clés correspondant à une vraie tourelle. */
const TOWER_NS = new Set(['mg', 'sniper', 'mortar', 'tesla', 'flame', 'aa']);

/** Archétypes de tourelle concernés par une carte (vide = carte globale). */
export function cardArchetypes(card) {
  const out = new Set();
  for (const key of Object.keys(card.mods)) {
    const ns = key.split('.')[0];
    if (TOWER_NS.has(ns)) out.add(ns);
  }
  return out;
}

/** Composition de la défense : nombre de tours par archétype. */
function composition(game) {
  const counts = Object.create(null);
  let total = 0;
  for (const t of (game.towers || [])) {
    const a = t.archetype;
    if (!TOWER_NS.has(a)) continue;   // les sacs de sable ne comptent pas
    counts[a] = (counts[a] || 0) + 1;
    total++;
  }
  return { counts, total };
}

/**
 * Poids d'affinité d'une carte, entre `floor` et `ceil`.
 * Une carte globale (économie, survie, toutes tours) vaut toujours 1.
 * Une carte multi-tourelles prend le meilleur de ses archétypes, pour
 * qu'un bonus transversal reste pertinent.
 */
export function affinityWeight(card, game) {
  const arch = cardArchetypes(card);
  if (!arch.size) return 1;

  const { counts, total } = composition(game);
  if (total === 0) return 1;   // aucune tour posée : rien à déduire

  // Le biais monte avec la taille de la défense : en début de partie on
  // ne sait pas encore ce que le joueur veut jouer, on ne l'enferme pas.
  const strength = Math.min(1, total / AFFINITY.fullBiasAt);
  const even = 1 / TOWER_NS.size;

  let best = 0;
  for (const a of arch) {
    const share = (counts[a] || 0) / total;
    const raw = AFFINITY.floor + (1 - AFFINITY.floor) * (share / even);
    best = Math.max(best, Math.min(AFFINITY.ceil, raw));
  }
  return 1 + strength * (best - 1);
}

// ============================================================
//  Tirage
// ============================================================

/**
 * Propose `count` cartes distinctes pour la vague en cours.
 * Les cartes `unique` déjà prises sont retirées du pool ; on tire
 * d'abord une rareté (pondérée par la vague), puis une carte dedans
 * (pondérée par l'affinité avec la défense du joueur).
 * Si une rareté est épuisée, on retombe sur les autres.
 */
export function drawCards(game, rng = Math.random, count = DRAFT_CHOICES) {
  const taken = game.cardsTaken || new Set();
  const pool = CARDS.filter((c) => {
    if (c.unique && taken.has(c.id)) return false;
    if (c.cond && !c.cond(game)) return false;
    return true;
  });

  const weights = rarityWeights(game.wave || 1);
  const affinity = new Map(pool.map((c) => [c.id, affinityWeight(c, game)]));
  const picked = [];
  const used = new Set();

  for (let i = 0; i < count; i++) {
    // Raretés encore disponibles compte tenu de ce qui est déjà tiré
    const buckets = RARITY_ORDER
      .map((r) => ({ r, list: pool.filter((c) => c.rarity === r && !used.has(c.id)) }))
      .filter((b) => b.list.length > 0);
    if (!buckets.length) break;

    let total = 0;
    for (const b of buckets) total += weights[b.r];
    let roll = rng() * total;
    let chosen = buckets[buckets.length - 1];
    for (const b of buckets) {
      roll -= weights[b.r];
      if (roll <= 0) { chosen = b; break; }
    }

    // Tirage pondéré par l'affinité à l'intérieur de la rareté retenue
    let wTotal = 0;
    for (const c of chosen.list) wTotal += affinity.get(c.id);
    let r2 = rng() * wTotal;
    let card = chosen.list[chosen.list.length - 1];
    for (const c of chosen.list) {
      r2 -= affinity.get(c.id);
      if (r2 <= 0) { card = c; break; }
    }

    used.add(card.id);
    picked.push(card);
  }

  return picked;
}

/** Applique une carte : mods cumulés + effet immédiat éventuel. */
export function applyCard(game, card) {
  for (const [k, v] of Object.entries(card.mods)) {
    game.mods[k] = (game.mods[k] || 0) + v;
  }
  if (card.unique) {
    if (!game.cardsTaken) game.cardsTaken = new Set();
    game.cardsTaken.add(card.id);
  }
  if (!game.cardsOwned) game.cardsOwned = [];
  game.cardsOwned.push(card.id);

  // Les stats dérivées doivent être recalculées après coup.
  game.chainBlastMult = 0.6 + (game.mods['tesla.chainBlast'] || 0);
  if (card.apply) card.apply(game);
  for (const t of game.towers) t.recompute(game.mods);
}

/** Le draft est-il dû à la fin de cette vague ? */
export function draftDue(wave) {
  return wave > 0 && wave % DRAFT_EVERY === 0;
}

// ============================================================
//  Lecture des effets cumulés
// ============================================================
// Les clés de mods sont techniques (`mg.vsBoss`) ; l'onglet doit
// afficher quelque chose de lisible. On traduit le suffixe, et le
// préfixe donne la portée (une tourelle, ou tout le monde).

const SCOPE = {
  mg: 'Mitraillette', sniper: 'Sniper', mortar: 'Mortier',
  tesla: 'Tesla', flame: 'Lance-flamme', aa: 'DCA',
  sandbag: 'Sac de sable', player: 'Général'
};

const PROP = {
  damage: 'dégâts', rate: 'cadence', range: 'portée', cost: 'coût',
  splash: "rayon d'explosion", craterDps: 'dégâts de cratère', arcTime: 'temps de vol',
  critChance: 'chance critique', critMult: 'dégâts critiques', pierce: 'perçage',
  bounces: 'rebonds', bouncesFlat: 'rebonds', bounceFalloff: 'dégâts conservés par rebond',
  bounceRange: 'portée de rebond', chainBlast: 'explosion en chaîne', chargeDur: 'durée de charge',
  burnDps: 'dégâts de brûlure', burnDur: 'durée de brûlure', burnStacks: 'cumuls de brûlure',
  cone: 'angle du cône', spread: 'propagation du feu', melt: "fonte d'armure",
  turnRate: 'guidage', flakSplash: 'rayon de flak', missiles: 'missiles', missilesFlat: 'missiles',
  armorPen: "pénétration d'armure", shred: "effritement d'armure", slow: 'ralentissement',
  spinMax: 'régime maximum', spinUp: 'montée en régime', spinDown: 'perte de régime',
  ricochet: 'ricochet', salvo: 'obus par salve', shrapnel: 'éclats', stun: 'étourdissement',
  emp: 'EMP', execute: 'exécution', burn: 'brûlure à l\'impact',
  vsBoss: 'dégâts contre les boss', vsAir: 'dégâts contre les aériens',
  vsGround: 'dégâts contre le sol', vsArmor: 'dégâts contre les blindés',
  vsShield: 'dégâts contre les boucliers', vsBurning: 'dégâts sur cible en feu',
  vsSlowed: 'dégâts sur cible ralentie', lowHp: 'dégâts sur cible affaiblie',
  fullHp: 'dégâts sur cible intacte',
  lives: 'intégrité maximale', startGold: 'crédits de départ',
  goldPerKill: 'crédits par élimination', waveBonus: 'prime de vague',
  sellRatio: 'remboursement', materials: 'matériaux', interest: 'intérêts',
  allDamage: 'dégâts (toutes tours)', allCost: 'coût de toutes les tours',
  upgradeCost: 'coût des améliorations', regen: 'réparation par vague',
  bossBounty: 'crédits des boss', firstBlood: 'prime de première élimination',
  leakShield: 'brèche absorbée', lastStand: 'dégâts en dernier rempart'
};

/** Clés dont la valeur est un compte, pas un pourcentage. */
const FLAT = new Set(['lives', 'startGold', 'armorPen', 'shred', 'bouncesFlat',
  'missilesFlat', 'salvo', 'shrapnel', 'burnStacks', 'firstBlood', 'stun',
  'spread', 'melt', 'bounceFalloff']);

/** Clés binaires : un effet nommé, sans valeur à afficher. */
const FLAGS = new Set(['deluge', 'fusillade', 'wall', 'oneshot', 'silence', 'cascade',
  'carpet', 'scorched', 'implode', 'infinite', 'storm', 'overload', 'inferno',
  'combust', 'dragon', 'cluster', 'nofly', 'barrage', 'multiLock', 'command',
  'war', 'survivor', 'leakShield', 'burn']);

/**
 * Transforme la table de mods en lignes lisibles, triées par portée.
 * Les valeurs internes de l'arbre (__survivorBonus) et les marqueurs de
 * variante sont écartés : ils ne sont pas des « améliorations ».
 */
export function describeMods(mods) {
  const rows = [];
  for (const [key, value] of Object.entries(mods || {})) {
    if (!value) continue;
    if (key.startsWith('__') || key.startsWith('variant.')) continue;
    const [ns, prop] = key.split('.');
    if (!prop) continue;
    const scope = SCOPE[ns];
    if (!scope) continue;

    const label = PROP[prop] || prop;
    let text;
    if (FLAGS.has(prop)) text = label.charAt(0).toUpperCase() + label.slice(1);
    else if (FLAT.has(prop)) {
      const v = Math.round(value * 10) / 10;
      text = (v > 0 ? '+' : '') + v + ' ' + label;
    } else {
      const v = Math.round(value * 1000) / 10;
      text = (v > 0 ? '+' : '') + v + '% ' + label;
    }
    rows.push({ key, scope, ns, text, value });
  }

  const order = ['player', 'mg', 'sniper', 'mortar', 'tesla', 'flame', 'aa', 'sandbag'];
  rows.sort((a, b) => {
    const d = order.indexOf(a.ns) - order.indexOf(b.ns);
    return d !== 0 ? d : Math.abs(b.value) - Math.abs(a.value);
  });
  return rows;
}
