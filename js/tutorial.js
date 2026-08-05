// ============================================================
//  TUTORIAL — scénario jouable scripté.
//
//  Principe « show, don't tell » : le joueur apprend chaque mécanique
//  en la déclenchant lui-même sur une carte fixe et des vagues
//  prédéterminées. Les popups n'arrivent qu'APRÈS l'action, pour
//  nommer ce qui vient de se produire à l'écran.
//
//  Le tutoriel ne fait que PILOTER le jeu : il n'a aucune règle à lui.
//  Il pose des objectifs, écoute les événements émis par main.js, et
//  restreint temporairement la boutique.
// ============================================================

import { GRID, CELL, PALETTE } from './config.js';

// ============================================================
//  Carte du tutoriel
//  Dessinée à la main, jamais aléatoire : chaque leçon repose sur
//  une case précise. 24 colonnes × 14 lignes.
//    #  roche          .  case libre
//    S  apparition     B  base
//  Le mur vertical en x=20 n'a qu'UN passage (le goulet, en y=6) :
//  c'est lui qui rend la leçon « on ne peut pas tout fermer »
//  déclenchable avec une seule tour.
// ============================================================

export const TUTORIAL_LAYOUT = [
  '########################',
  '#...................#..#',
  '#...................#..#',
  '#...................#..#',
  '#.....####.....####.#..#',
  '#.....####.....####.#..#',
  'S...................*..B',
  '#.....####.....####.#..#',
  '#.....####.....####.#..#',
  '#...................#..#',
  '#...................#..#',
  '#...................#..#',
  '#...................#..#',
  '########################'
];

/** Le goulet : seule case franchissable du mur de droite. */
export const CHOKE = { x: 20, y: 6 };

export const TUTORIAL_MAP = {
  layout: TUTORIAL_LAYOUT,
  spawn: { x: 0, y: 6 },
  base: { x: 23, y: 6 },
  // Couloir aérien : entre par le haut, loin du spawn au sol, pour
  // qu'on voie bien qu'il n'a rien à voir avec le chemin terrestre.
  airEdge: 2,
  airFrac: 0.18,
  airBowSign: 1
};

// ============================================================
//  Étapes
//
//  goal.type :
//    place        — poser une tour (kind = type de tour attendu)
//    refuse       — provoquer un refus de pose (reason = motif attendu)
//    reroute      — modifier le tracé du chemin au sol
//    wave         — survivre à la vague scriptée
//    upgrade      — améliorer une tour
//    info         — simple lecture, bouton CONTINUER
//
//  requireCell  : la pose n'est acceptée QUE sur la case surlignée.
//  allow        : types de tours disponibles dans la boutique.
//  gold         : crédits accordés à l'entrée de l'étape.
//  after        : popup joué une fois l'objectif atteint (le « tell »
//                 qui nomme ce que le joueur vient de voir).
// ============================================================

export const STEPS = [
  {
    id: 'place-mg',
    title: 'PREMIÈRE TOURELLE',
    text: 'Clique <b>MITRAILLETTE</b> dans la boutique à droite, puis la case qui clignote.',
    objective: 'Poser une mitrailleuse sur la case indiquée',
    allow: ['mg'],
    gold: 70,
    cell: { x: 5, y: 5 },
    requireCell: true,
    goal: { type: 'place', kind: 'mg' },
    after: {
      title: 'EN POSITION',
      text: 'Les tours se posent <b>sur les cases</b>, jamais librement. Le cercle en pointillés est sa portée : elle ne tire que là-dedans.'
    }
  },

  {
    id: 'first-wave',
    title: 'PREMIER ASSAUT',
    text: 'Lance la vague. Tu n\'as rien à viser : les tourelles tirent toutes seules.',
    objective: 'Repousser la vague 1',
    allow: ['mg'],
    highlight: '#btn-wave',
    wave: [
      { type: 'grunt', at: 0 },
      { type: 'grunt', at: 1.1 },
      { type: 'grunt', at: 2.2 },
      { type: 'grunt', at: 3.3 }
    ],
    goal: { type: 'wave' },
    after: {
      title: 'CRÉDITS',
      text: 'Chaque élimination rapporte des <b>crédits</b>, et repousser une vague verse une prime. C\'est ta seule ressource pendant la partie.'
    }
  },

  {
    id: 'reroute',
    title: 'PLIER LA ROUTE',
    text: 'Le trait blanc au sol est le chemin ennemi. Pose une tour <b>dessus</b>, sur la case qui clignote.',
    objective: 'Poser une tour en plein milieu du chemin',
    allow: ['mg', 'sandbag'],
    gold: 90,
    cell: { x: 12, y: 6 },
    requireCell: true,
    goal: { type: 'reroute' },
    after: {
      title: 'LE CHEMIN S\'EST RECALCULÉ',
      text: 'Il contourne ta tour et <b>s\'allonge</b>. C\'est ton principal levier : plus le trajet est long, plus tes tourelles ont le temps de tirer.'
    }
  },

  {
    id: 'no-block',
    title: 'JUSQU\'OÙ ?',
    text: 'À droite, tout le mur est infranchissable sauf une case. Essaie de la boucher.',
    objective: 'Tenter de fermer complètement le passage',
    allow: ['sandbag'],
    gold: 40,
    cell: CHOKE,
    requireCell: true,
    goal: { type: 'refuse', reason: 'CHEMIN COUPÉ' },
    after: {
      title: 'REFUSÉ',
      text: 'Impossible d\'<b>enfermer</b> les ennemis. Le jeu vérifie chaque pose et refuse tout ce qui couperait la route de l\'apparition à la base. Tu peux allonger le trajet, jamais le supprimer.'
    }
  },

  {
    id: 'upgrade',
    title: 'MONTER EN PUISSANCE',
    text: 'Clique ta mitrailleuse sur la grille, puis <b>AMÉLIORER</b> dans le panneau de droite.',
    objective: 'Améliorer une tour au niveau 1',
    allow: ['mg', 'sandbag'],
    gold: 60,
    highlight: '#tp-upgrade',
    goal: { type: 'upgrade' },
    after: {
      title: 'TROIS NIVEAUX',
      text: 'Améliorer coûte moins cher que rebâtir. Le bouton <b>VENDRE</b> juste à côté rembourse une partie de l\'investissement : utile pour redessiner le chemin en cours de partie.'
    }
  },

  {
    id: 'mortar',
    title: 'DÉGÂTS DE ZONE',
    text: 'Le <b>MORTIER</b> frappe une zone entière. Pose-le sur la case qui clignote, puis lance la vague.',
    objective: 'Poser le mortier et repousser la vague',
    allow: ['mortar'],
    gold: 140,
    cell: { x: 12, y: 8 },
    requireCell: true,
    wave: [
      { type: 'grunt', at: 0 }, { type: 'grunt', at: 0.25 }, { type: 'grunt', at: 0.5 },
      { type: 'grunt', at: 0.75 }, { type: 'grunt', at: 1.0 }, { type: 'grunt', at: 1.25 },
      { type: 'grunt', at: 1.5 }, { type: 'grunt', at: 1.75 }
    ],
    goal: { type: 'placeThenWave', kind: 'mortar' },
    after: {
      title: 'GROUPÉS = PUNIS',
      text: 'Un obus en cloche, une explosion, et tout le paquet encaisse. Le mortier laisse aussi un <b>cratère brûlant</b> qui continue à faire mal.'
    }
  },

  {
    id: 'air',
    title: 'ALERTE AÉRIENNE',
    text: 'Des drones arrivent. Ils suivent le trait bleu en pointillés. Lance la vague et <b>regarde bien le mortier</b>.',
    objective: 'Observer la vague aérienne',
    allow: [],
    wave: [
      { type: 'drone', at: 0 },
      { type: 'drone', at: 1.4 },
      { type: 'drone', at: 2.8 }
    ],
    goal: { type: 'wave' },
    after: {
      title: 'LE MORTIER N\'A PAS BOUGÉ',
      text: 'Le couloir aérien <b>ignore la grille</b> et tu ne peux pas le modifier. Et toutes les tours ne lèvent pas le canon : mortier et lance-flamme sont <b>sol uniquement</b>. Mitraillette, sniper, tesla et DCA touchent l\'air.'
    }
  },

  {
    id: 'aa',
    title: 'COUVERTURE ANTIAÉRIENNE',
    text: 'La <b>DCA</b> ne tire que sur les volants, mais très fort. Pose-la sous le couloir bleu, puis lance la dernière vague.',
    objective: 'Poser la DCA et repousser la vague',
    allow: ['aa'],
    gold: 170,
    cell: { x: 8, y: 3 },
    requireCell: true,
    wave: [
      { type: 'drone', at: 0 }, { type: 'drone', at: 0.8 },
      { type: 'grunt', at: 1.2 }, { type: 'drone', at: 1.6 },
      { type: 'grunt', at: 2.0 }, { type: 'wasp', at: 2.6 }
    ],
    goal: { type: 'placeThenWave', kind: 'aa' },
    after: {
      title: 'DEUX MENACES, DEUX RÉPONSES',
      text: 'Une défense qui ne regarde que le sol s\'effondre à la première vague aérienne. Il faut couvrir <b>les deux couloirs</b>.'
    }
  },

  {
    id: 'done',
    title: 'SECTEUR TENU',
    text: 'Tu as tout ce qu\'il faut. En partie réelle les vagues ne s\'arrêtent jamais : tu ne gagnes pas, tu tiens le plus longtemps possible. La vague atteinte se convertit en <b>matériaux</b> à dépenser dans l\'arbre de compétences, et ça, c\'est définitif.',
    objective: null,
    allow: [],
    goal: { type: 'info' }
  }
];

// Récompense unique, pour que le joueur puisse toucher à l'arbre juste après.
export const TUTORIAL_REWARD = 40;

// ============================================================
//  Moteur
// ============================================================

export class Tutorial {
  /**
   * @param {object} game   l'état de jeu partagé
   * @param {object} hooks  { onStep, onFinish, onAbort, toast }
   */
  constructor(game, hooks = {}) {
    this.game = game;
    this.hooks = hooks;
    this.index = -1;
    this.step = null;
    this.done = false;
    this.goalMet = false;
    this.awaitingAfter = false;
    this.placedThisStep = false;
    this.pathSignature = null;
    this.finished = false;
  }

  get total() { return STEPS.length; }
  get stepNumber() { return this.index + 1; }

  // ----------------------------------------------------------
  start() {
    this.index = -1;
    this.next();
  }

  next() {
    this.index++;
    if (this.index >= STEPS.length) { this.finish(); return; }

    this.step = STEPS[this.index];
    this.goalMet = false;
    this.awaitingAfter = false;
    this.placedThisStep = false;

    const g = this.game;

    // Boutique restreinte à ce que l'étape enseigne.
    g.allowedTowers = this.step.allow ? new Set(this.step.allow) : null;

    // Une tour restée armée transformerait le clic suivant en tentative de
    // pose : sur une étape qui demande de sélectionner ou d'observer, on
    // désarme pour que le clic fasse ce que la consigne annonce.
    const PLACING_GOALS = ['place', 'placeThenWave', 'reroute', 'refuse'];
    if (!PLACING_GOALS.includes(this.step.goal.type)) g.placing = null;
    else if (g.placing && g.allowedTowers && !g.allowedTowers.has(g.placing)) g.placing = null;

    // Case objectif mise en avant sur la grille.
    g.tutorialCell = this.step.cell || null;
    g.tutorialRequireCell = !!this.step.requireCell;

    if (this.step.gold) g.gold += this.step.gold;

    // Mémorise le tracé courant pour détecter un reroutage.
    this.pathSignature = this.signature();

    if (this.hooks.onStep) this.hooks.onStep(this.step, this);
  }

  /** Empreinte du chemin au sol, pour repérer qu'il a changé. */
  signature() {
    const p = this.game.grid && this.game.grid.path;
    if (!p || !p.length) return '';
    return p.length + ':' + p.map((c) => c.x + ',' + c.y).join('|');
  }

  // ----------------------------------------------------------
  //  Vagues scriptées
  //  On renvoie un objet à la forme d'un waveData normal, pour que
  //  main.js et WaveRunner n'aient rien de spécial à gérer.
  // ----------------------------------------------------------
  waveFor() {
    const spawns = (this.step && this.step.wave) ? this.step.wave : [];
    return {
      wave: this.stepNumber,
      spawns: spawns.map((s) => ({ ...s })),
      duration: spawns.length ? spawns[spawns.length - 1].at : 0,
      hpMult: 1,
      speedMult: 1,
      airRatio: spawns.some((s) => s.type === 'drone' || s.type === 'wasp') ? 1 : 0,
      hasBoss: false,
      scripted: true
    };
  }

  /** L'étape courante attend-elle que le joueur lance une vague ? */
  get expectsWave() {
    if (!this.step) return false;
    const t = this.step.goal.type;
    return (t === 'wave' || t === 'placeThenWave') && !!this.step.wave;
  }

  /** Le bouton LANCER LA VAGUE est-il actif à cet instant ? */
  canStartWave() {
    if (!this.expectsWave) return false;
    if (this.step.goal.type === 'placeThenWave' && !this.placedThisStep) return false;
    return true;
  }

  // ----------------------------------------------------------
  //  Événements émis par main.js
  // ----------------------------------------------------------
  handle(event, payload = {}) {
    if (this.done || this.finished || !this.step || this.goalMet) return;
    const goal = this.step.goal;

    switch (goal.type) {
      case 'place':
        if (event === 'tower-placed' && payload.archetype === goal.kind) this.complete();
        break;

      case 'placeThenWave':
        if (event === 'tower-placed' && payload.archetype === goal.kind) {
          this.placedThisStep = true;
          if (this.hooks.onStep) this.hooks.onStep(this.step, this); // rafraîchit l'objectif
        }
        if (event === 'wave-cleared' && this.placedThisStep) this.complete();
        break;

      case 'reroute':
        if (event === 'path-changed' && this.signature() !== this.pathSignature) this.complete();
        break;

      case 'refuse':
        if (event === 'place-refused' && payload.reason === goal.reason) this.complete();
        break;

      case 'wave':
        if (event === 'wave-cleared') this.complete();
        break;

      case 'upgrade':
        if (event === 'tower-upgraded') this.complete();
        break;
    }
  }

  complete() {
    if (this.goalMet) return;
    this.goalMet = true;
    this.game.tutorialCell = null;
    this.game.tutorialRequireCell = false;
    this.awaitingAfter = !!this.step.after;
    if (this.hooks.onComplete) this.hooks.onComplete(this.step, this);
  }

  /** Appelé par le bouton CONTINUER du panneau. */
  advance() {
    if (this.finished) return;
    if (this.step && this.step.goal.type === 'info') { this.finish(); return; }
    if (!this.goalMet) return;
    this.next();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.done = true;
    this.game.allowedTowers = null;
    this.game.tutorialCell = null;
    this.game.tutorialRequireCell = false;
    if (this.hooks.onFinish) this.hooks.onFinish(this);
  }

  abort() {
    if (this.finished) return;
    this.finished = true;
    this.done = true;
    this.game.allowedTowers = null;
    this.game.tutorialCell = null;
    this.game.tutorialRequireCell = false;
    if (this.hooks.onAbort) this.hooks.onAbort(this);
  }
}

// ============================================================
//  Rendu de la case objectif (appelé par render.js)
// ============================================================

export function drawTutorialCell(ctx, cell, time) {
  if (!cell) return;
  const C = GRID.cell;
  const px = cell.x * C, py = cell.y * C;
  const pulse = 0.5 + Math.sin(time * 5) * 0.5;

  ctx.save();

  // Halo qui respire
  ctx.globalAlpha = 0.12 + pulse * 0.2;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(px, py, C, C);

  // Cadre pointillé tournant
  ctx.globalAlpha = 0.6 + pulse * 0.4;
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -time * 30;
  ctx.strokeRect(px + 3, py + 3, C - 6, C - 6);
  ctx.setLineDash([]);

  // Onde qui se propage vers l'extérieur
  const t = (time * 0.9) % 1;
  ctx.globalAlpha = (1 - t) * 0.55;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(
    px + C / 2 - (C / 2 + t * 26), py + C / 2 - (C / 2 + t * 26),
    C + t * 52, C + t * 52
  );

  // Flèche qui pointe la case depuis le haut
  ctx.globalAlpha = 0.75 + pulse * 0.25;
  ctx.fillStyle = PALETTE.gold;
  const ay = py - 12 - pulse * 6;
  ctx.beginPath();
  ctx.moveTo(px + C / 2, ay + 10);
  ctx.lineTo(px + C / 2 - 7, ay - 2);
  ctx.lineTo(px + C / 2 + 7, ay - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
