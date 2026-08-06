// ============================================================
//  UI — HUD, panneaux, boutiques, transitions d'écran.
//  Toutes les animations DOM passent par `A` (anime.js du CDN
//  ou le moteur de repli tween.js).
// ============================================================

import {
  TOWERS, TOWER_ORDER, COMMANDERS, COMMANDER_ORDER, COMMANDER_RANK_KILLS,
  TARGET, PALETTE, TREE, BRANCHES, VARIANTS, VARIANT_ORDER, VARIANT_RING,
  materialsForWave
} from './config.js';
import { towerCost } from './towers.js';
import { RARITY, CARD_BY_ID, describeMods } from './cards.js';
import tween from './tween.js';

/** anime.js si le CDN a répondu, sinon le moteur maison. */
export const A = (typeof window !== 'undefined' && window.anime) ? window.anime : tween;
export const usingCdn = (typeof window !== 'undefined' && !!window.anime);

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const TARGET_LABEL = {
  [TARGET.NONE]: 'BLOCAGE',
  [TARGET.GROUND]: '<span class="gnd-tag">SOL</span>',
  [TARGET.AIR]: '<span class="air-tag">AIR</span>',
  [TARGET.BOTH]: '<span class="gnd-tag">SOL</span> + <span class="air-tag">AIR</span>'
};

const GLYPHS = { mg: '⌗', sniper: '✛', mortar: '◎', tesla: '⚡', flame: '▲', aa: '✈', sandbag: '▦' };

// ============================================================
//  Transitions d'écran (volets néo-brutalistes)
// ============================================================

let currentScreen = 'screen-boot';

export function showScreen(id, opts = {}) {
  if (id === currentScreen && !opts.force) return Promise.resolve();
  const wipe = $('#wipe');
  const bars = Array.from(wipe.children);

  return new Promise((resolve) => {
    A.set(bars, { scaleY: 0, transformOrigin: 'top' });
    A({
      targets: bars,
      scaleY: [0, 1],
      duration: 260,
      easing: 'easeInQuart',
      delay: A.stagger(38),
      complete: () => {
        $$('.screen').forEach((s) => s.classList.remove('active'));
        const el = document.getElementById(id);
        el.classList.add('active');
        el.scrollTop = 0;
        currentScreen = id;
        if (opts.onSwap) opts.onSwap();

        A.set(bars, { transformOrigin: 'bottom' });
        A({
          targets: bars,
          scaleY: [1, 0],
          duration: 300,
          easing: 'easeOutQuart',
          delay: A.stagger(38, { from: 'last' }),
          complete: () => { animateScreenIn(id); resolve(); }
        });
      }
    });
  });
}

/** Entrée en cascade des panneaux de l'écran affiché. */
export function animateScreenIn(id) {
  const el = document.getElementById(id);
  const panels = Array.from(el.querySelectorAll('.panel, .hud-box, .branch-btn'));
  if (panels.length) {
    A.set(panels, { opacity: 0, translateY: 22 });
    A({
      targets: panels,
      opacity: [0, 1],
      translateY: [22, 0],
      duration: 520,
      delay: A.stagger(34),
      easing: 'easeOutBack'
    });
  }

  // Le plateau ne fait QUE se révéler : le déplacer décalerait sa boîte
  // pendant qu'il est déjà cliquable, et un clic viserait la mauvaise case.
  // fitStage() est par ailleurs seul maître de son transform (scale).
  const stage = el.querySelector('.stage');
  if (stage) {
    A.set(stage, { opacity: 0 });
    A({ targets: stage, opacity: [0, 1], duration: 460, easing: 'easeOutQuad' });
  }
}

// ============================================================
//  Séquence de démarrage
// ============================================================

const BOOT_LOG = [
  'INITIALISATION DU NOYAU DÉFENSIF...',
  'CHARGEMENT DE LA GRILLE TACTIQUE... <b>OK</b>',
  'CALIBRAGE DES TOURELLES [6 MODÈLES]... <b>OK</b>',
  'ANALYSE DES COULOIRS SOL / AIR... <b>OK</b>',
  'SYNCHRONISATION DE L\'ARBRE [2156 NŒUDS]... <b>OK</b>',
  'MENACE DÉTECTÉE — SECTEUR COMPROMIS'
];

export function runBoot(onDone) {
  const title = $('#boot-title');
  const raw = title.textContent;
  title.innerHTML = raw.split('').map((c) =>
    c === ' ' ? '<span>&nbsp;</span>' : `<span>${c}</span>`).join('');
  const letters = title.querySelectorAll('span');

  const log = $('#boot-log');
  log.innerHTML = BOOT_LOG.map((l) => `<div>&gt; ${l}</div>`).join('');
  const lines = log.querySelectorAll('div');

  A({
    targets: letters,
    opacity: [0, 1],
    translateY: [-70, 0],
    rotate: [() => A.random(-40, 40), 0],
    scale: [0.4, 1],
    duration: 760,
    delay: A.stagger(52),
    easing: 'easeOutElastic'
  });

  A({
    targets: '.boot-bar i',
    width: ['0%', '100%'],
    duration: 2100,
    easing: 'easeInOutQuart'
  });

  A({
    targets: lines,
    opacity: [0, 1],
    translateX: [-16, 0],
    duration: 220,
    delay: A.stagger(280, { start: 420 }),
    easing: 'easeOutQuad'
  });

  // Glitch du titre pendant le chargement
  const glitch = setInterval(() => {
    const l = letters[Math.floor(Math.random() * letters.length)];
    if (!l) return;
    A({ targets: l, translateX: [A.random(-9, 9), 0], duration: 110, easing: 'easeOutQuad' });
  }, 170);

  setTimeout(() => { clearInterval(glitch); onDone(); }, 2500);
}

// ============================================================
//  Menu
// ============================================================

export function renderMenu(save, treeSize) {
  $('#menu-materials').textContent = save.materials;
  $('#menu-best').textContent = save.data.bestWave || '—';
  $('#menu-runs').textContent = save.data.totalRuns;
  $('#menu-kills').textContent = save.data.totalKills;
  $('#menu-nodes').textContent = `${save.unlocked.size} / ${treeSize}`;
  $('#tree-badge').textContent = save.materials;
  const cmdr = COMMANDERS[save.commander];
  $('#commander-badge').textContent = cmdr ? cmdr.name : 'AUCUN';
  const tutoBadge = $('#tutorial-badge');
  if (tutoBadge) {
    tutoBadge.textContent = save.tutorialDone ? 'REVOIR' : 'NOUVEAU';
    tutoBadge.style.background = save.tutorialDone ? 'var(--surface-3)' : 'var(--gold)';
    tutoBadge.style.color = save.tutorialDone ? 'var(--muted)' : 'var(--text-dark)';
  }

  const list = $('#menu-towers');
  list.innerHTML = TOWER_ORDER.map((id) => {
    const t = TOWERS[id];
    return `<div class="legend-item" style="border-left-color:${t.accent}">
      <span class="dot" style="background:${t.accent}"></span>
      <span class="nm">${t.name}</span>
      <span class="tg">${TARGET_LABEL[t.targets]}</span>
    </div>`;
  }).join('');
}

// ============================================================
//  Commandant
// ============================================================

/** Grille de sélection des 20 commandants (un seul actif par partie). */
export function renderCommanderGrid(save, onPick) {
  const grid = $('#cmdr-grid');
  grid.innerHTML = COMMANDER_ORDER.map((id) => {
    const c = COMMANDERS[id];
    const arche = BRANCHES.find((b) => b.id === c.archetype);
    const on = save.commander === id;
    return `<div class="cmdr-card ${on ? 'on' : ''}" data-cmdr="${id}" style="border-left-color:${c.accent}">
      <div class="cmdr-card-head">
        <span class="cmdr-card-name" style="color:${c.accent}">${c.name}</span>
        <span class="cmdr-card-arche" style="color:${arche.color}">${GLYPHS[c.archetype]} ${arche.name}</span>
      </div>
      <p class="cmdr-card-desc">${c.desc}</p>
      <div class="cmdr-card-foot">
        <span class="cmdr-card-cost">${c.cost}</span>
        <span class="cmdr-card-pick">${on ? 'SÉLECTIONNÉ' : 'CHOISIR'}</span>
      </div>
    </div>`;
  }).join('');
  $$('.cmdr-card').forEach((el) => {
    el.addEventListener('click', () => onPick(el.dataset.cmdr));
  });
}

/** Compteur qui roule jusqu'à sa valeur. */
export function countUp(el, to, dur = 900, prefix = '') {
  const obj = { v: parseFloat(el.textContent.replace(/[^\d.-]/g, '')) || 0 };
  A({
    targets: obj,
    v: to,
    duration: dur,
    easing: 'easeOutExpo',
    update: () => { el.textContent = prefix + Math.round(obj.v); }
  });
}

// ============================================================
//  HUD de jeu
// ============================================================

export function buildShop(game, onPick) {
  const list = $('#shop-list');
  list.innerHTML = '';
  TOWER_ORDER.forEach((id, i) => {
    const t = TOWERS[id];
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.dataset.tower = id;
    btn.style.borderLeftColor = t.accent;
    btn.innerHTML = `
      <span class="shop-glyph" style="color:${t.accent}">${GLYPHS[id]}</span>
      <span class="shop-info">
        <span class="shop-name">${t.name}</span>
        <span class="shop-tags">${TARGET_LABEL[t.targets]}</span>
      </span>
      <span class="shop-cost" data-cost>${towerCost(id, game.mods)}</span>
      <span class="shop-key">${i + 1}</span>`;
    btn.title = t.desc;
    btn.addEventListener('click', () => onPick(id));
    list.appendChild(btn);
  });

  const cid = game.commanderChoice;
  if (cid && COMMANDERS[cid]) {
    const c = COMMANDERS[cid];
    const btn = document.createElement('button');
    btn.className = 'shop-item cmdr';
    btn.dataset.tower = cid;
    btn.style.borderLeftColor = c.accent;
    btn.innerHTML = `
      <span class="shop-glyph" style="color:${c.accent}">${GLYPHS[c.archetype]}</span>
      <span class="shop-info">
        <span class="shop-name">${c.name}</span>
        <span class="shop-tags">COMMANDANT</span>
      </span>
      <span class="shop-cost" data-cost>${towerCost(cid, game.mods)}</span>`;
    btn.title = c.desc;
    btn.addEventListener('click', () => onPick(cid));
    list.appendChild(btn);
  }
}

export function refreshShop(game) {
  $$('.shop-item').forEach((el) => {
    const id = el.dataset.tower;
    const cost = towerCost(id, game.mods);
    if (COMMANDERS[id]) {
      const deployed = game.towers.some((t) => t.isCommander);
      el.querySelector('[data-cost]').textContent = deployed ? 'DÉPLOYÉ' : cost;
      el.classList.toggle('poor', deployed || game.gold < cost);
    } else {
      el.querySelector('[data-cost]').textContent = cost;
      el.classList.toggle('poor', game.gold < cost);
    }
    el.classList.toggle('on', game.placing === id);
    // Entraînement : tout ce qui sort de la leçon en cours est neutralisé.
    el.classList.toggle('locked', !!game.allowedTowers && !game.allowedTowers.has(id));
  });
}

let lastHud = {};

export function refreshHud(game) {
  const set = (sel, val, boxSel, dangerFlash) => {
    const el = $(sel);
    if (lastHud[sel] === val) return;
    const had = lastHud[sel] !== undefined;
    lastHud[sel] = val;
    el.textContent = val;
    if (!had) return;
    A({ targets: el, scale: [1.4, 1], duration: 300, easing: 'easeOutBack' });
    if (boxSel) {
      const box = $(boxSel);
      box.classList.remove('flash', 'flash-danger');
      void box.offsetWidth;
      box.classList.add(dangerFlash ? 'flash-danger' : 'flash');
    }
  };

  set('#hud-wave', game.wave, '#hud-wave-box');
  set('#hud-lives', game.lives, '#hud-lives-box', true);
  set('#hud-gold', game.gold, '#hud-gold-box');
  $('#hud-enemies').textContent = game.enemies.filter((e) => !e.dead).length;
  $('#hud-kills').textContent = game.kills;

  const livesEl = $('#hud-lives');
  livesEl.classList.toggle('danger', game.lives <= 5);
}

export function resetHudCache() { lastHud = {}; }

export function setWaveButton(game) {
  const btn = $('#btn-wave');
  const label = $('#btn-wave-label');
  if (game.waveRunning) {
    btn.disabled = true;
    label.textContent = `VAGUE ${game.wave} EN COURS`;
    return;
  }
  // En entraînement, la vague n'est armée que quand l'étape la réclame.
  if (game.tutorial) {
    const ready = game.tutorial.canStartWave();
    btn.disabled = !ready;
    label.textContent = ready ? 'LANCER LA VAGUE' : 'SUIS LA CONSIGNE';
    return;
  }
  btn.disabled = false;
  // En mode automatique, le bouton devient un décompte cliquable :
  // le joueur garde la main pour partir plus tôt.
  if (game.autoWave && game.autoLeft > 0) {
    label.textContent = `VAGUE ${game.wave + 1} DANS ${Math.ceil(game.autoLeft)}s`;
  } else {
    label.textContent = `LANCER LA VAGUE ${game.wave + 1}`;
  }
}

export function renderWaveComp(waveData, summary) {
  const el = $('#wave-comp');
  el.innerHTML = summary.map((s) => `
    <div class="comp-row ${s.boss ? 'boss' : s.air ? 'air' : ''}">
      <span class="dot" style="background:${s.color}"></span>
      <span class="nm">${s.name}${s.air ? ' ✈' : ''}</span>
      <span class="qt">×${s.n}</span>
    </div>`).join('');
}

export function showWaveBanner(wave, sub, boss) {
  const banner = $('#wave-banner');
  $('#wb-num').textContent = wave;
  $('#wb-sub').textContent = sub || '';
  banner.classList.toggle('boss', !!boss);

  const inner = banner.querySelector('.wave-banner-inner');
  A.set(banner, { opacity: 1 });
  A.set(inner, { scaleX: 0, opacity: 1 });

  const tl = A.timeline({ easing: 'easeOutExpo' });
  tl.add({ targets: inner, scaleX: [0, 1], duration: 340 })
    .add({ targets: '.wb-num', scale: [2.4, 1], opacity: [0, 1], duration: 460, easing: 'easeOutElastic' }, '-=180')
    .add({ targets: '.wb-label, .wb-sub', opacity: [0, 1], translateY: [10, 0], duration: 260, delay: A.stagger(60) }, '-=300')
    .add({ targets: banner, opacity: [1, 0], duration: 340, delay: 780, easing: 'easeInQuad' });

  // Secousse glitch
  let n = 0;
  const gl = setInterval(() => {
    A({ targets: inner, translateX: [A.random(-7, 7), 0], skewX: [A.random(-12, -4), -8], duration: 90 });
    if (++n > 7) clearInterval(gl);
  }, 95);
}

export function toast(msg, kind = '', dur = 2400) {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = msg;
  stack.appendChild(el);
  A({ targets: el, opacity: [0, 1], translateX: [-26, 0], duration: 300, easing: 'easeOutBack' });
  setTimeout(() => {
    A({
      targets: el, opacity: [1, 0], translateX: [0, -20], duration: 240,
      complete: () => el.remove()
    });
  }, dur);
  while (stack.children.length > 5) stack.firstChild.remove();
}

// ============================================================
//  Panneau de tour sélectionnée
// ============================================================

export function renderTowerPanel(game, tower) {
  const panel = $('#tower-panel');
  if (!tower) { panel.hidden = true; return; }
  const wasHidden = panel.hidden;
  panel.hidden = false;

  const s = tower.stats;
  const def = tower.def;
  const maxLvl = TOWERS[tower.archetype].upgrades.length;
  const lvlLabel = tower.isCommander ? 'RANG' : 'NIV';
  $('#tp-name').innerHTML =
    `<span style="color:${def.accent}">${def.name}</span> <small style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted)">${lvlLabel} ${tower.level}/${maxLvl}</small>`;

  const rows = tower.id === 'sandbag'
    ? [['RÔLE', 'BLOQUE LE CHEMIN']]
    : [
      ['DPS', Math.round(tower.dps)],
      ['DÉGÂTS', Math.round(s.damage * 10) / 10],
      ['CADENCE', (Math.round(s.rate * 100) / 100) + '/s'],
      ['PORTÉE', Math.round(s.range * 10) / 10],
      ['CIBLES', s.mask === TARGET.AIR ? 'AIR' : s.mask === TARGET.GROUND ? 'SOL' : 'SOL+AIR']
    ];
  if (tower.archetype === 'sniper') {
    rows.push(['CRITIQUE', Math.round(s.critChance * 100) + '% ×' + (Math.round(s.critMult * 10) / 10)]);
    rows.push(['PERÇAGE', Math.floor(s.pierce)]);
  }
  if (tower.archetype === 'mortar') rows.push(['RAYON AoE', Math.round(s.splash * 10) / 10]);
  if (tower.archetype === 'tesla') {
    rows.push(['REBONDS', s.bounces]);
    rows.push(['CONSERVÉ', Math.round(s.bounceFalloff * 100) + '%']);
  }
  if (tower.archetype === 'flame') {
    rows.push(['BRÛLURE', Math.round(s.burnDps) + '/s × ' + (Math.round(s.burnDur * 10) / 10) + 's']);
    rows.push(['CÔNE', Math.round(s.cone) + '°']);
  }
  if (tower.archetype === 'aa') rows.push(['MISSILES', Math.max(1, Math.round(s.missiles))]);
  if (tower.archetype === 'mg') rows.push(['RÉGIME', Math.round(tower.spin * 100) + '% (max ×' + (Math.round(s.spinMax * 100) / 100) + ')']);
  if (tower.isCommander) {
    const need = COMMANDER_RANK_KILLS[tower.level];
    if (need !== undefined) {
      const earned = Math.max(0, game.kills - (tower.killsAtPlacement || 0));
      rows.push(['PROCHAIN RANG', `${Math.min(earned, need)}/${need} élim.`]);
    } else {
      rows.push(['RANG', 'MAXIMUM']);
    }
  }
  if (tower.id !== 'sandbag') rows.push(['ÉLIMINATIONS', tower.kills]);

  $('#tp-stats').innerHTML = rows.map(([k, v]) =>
    `<div class="tp-stat"><span>${k}</span><b>${v}</b></div>`).join('');

  const cmdrDesc = $('#tp-cmdr-desc');
  cmdrDesc.hidden = !tower.isCommander;
  if (tower.isCommander) cmdrDesc.textContent = 'APTITUDE UNIQUE — ' + tower.def.desc;

  $('#tp-target-row').hidden = tower.id === 'sandbag';
  $('#tp-priority').textContent = {
    first: 'PREMIER', last: 'DERNIER', close: 'PROCHE', strong: 'SOLIDE', weak: 'FAIBLE'
  }[tower.priority];

  const upCost = tower.upgradeCost(game.mods);
  const upBtn = $('#tp-upgrade');
  if (upCost === null) {
    upBtn.disabled = true;
    upBtn.textContent = tower.isCommander
      ? (tower.level >= maxLvl ? 'RANG MAXIMUM' : 'RANG PAR ÉLIMINATIONS')
      : 'NIVEAU MAX';
  } else {
    upBtn.disabled = game.gold < upCost;
    upBtn.textContent = `AMÉLIORER · ${upCost}`;
  }
  $('#tp-sell').textContent = `VENDRE · ${tower.sellValue(game.mods)}`;

  if (wasHidden) {
    A({ targets: panel, opacity: [0, 1], translateX: [26, 0], duration: 320, easing: 'easeOutBack' });
  }
}

// ============================================================
//  Écran de fin
// ============================================================

export function renderGameOver(stats, save) {
  $('#over-kicker').textContent = stats.wave >= save.data.bestWave ? 'NOUVEAU RECORD' : 'SECTEUR PERDU';
  $('#over-wave').textContent = '0';
  $('#over-materials').textContent = '0';
  $('#over-kills').textContent = stats.kills;
  $('#over-towers').textContent = stats.towersBuilt;
  $('#over-best').textContent = Math.max(save.data.bestWave, stats.wave);
  const mm = Math.floor(stats.duration / 60);
  const ss = Math.floor(stats.duration % 60).toString().padStart(2, '0');
  $('#over-time').textContent = `${mm}:${ss}`;

  const avgCost = TREE.costBase + TREE.costPerRing * 2;
  $('#over-nodes-est').textContent = `≈ ${Math.floor(stats.materials / Math.max(1, avgCost))} nœuds au coût d'entrée`;

  setTimeout(() => {
    countUp($('#over-wave'), stats.wave, 1100);
    countUp($('#over-materials'), stats.materials, 1500);
    A({
      targets: '.over-stat',
      opacity: [0, 1], translateX: [-18, 0],
      duration: 400, delay: A.stagger(80, { start: 300 }), easing: 'easeOutBack'
    });
    A({
      targets: '.over-mats',
      scale: [0.9, 1], opacity: [0, 1],
      duration: 620, delay: 700, easing: 'easeOutElastic'
    });
  }, 360);
}

// ============================================================
//  Arbre — panneau de détail
// ============================================================

export function renderNodeDetail(node, save, tree, canBuy) {
  const empty = $('#detail-empty');
  const body = $('#detail-body');
  if (!node || node.hub) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const typeEl = $('#detail-type');
  typeEl.className = 'detail-type ' + node.type;
  typeEl.textContent = {
    minor: 'MINEUR', notable: 'NOTABLE',
    keystone: 'CLÉ DE VOÛTE', variant: 'VARIANTE DE TOURELLE'
  }[node.type] || 'NŒUD';

  $('#detail-name').textContent = `${node.icon || ''} ${node.name || node.desc}`.trim();
  $('#detail-name').style.color = node.color;
  const branchName = (BRANCHES[node.branch] || {}).name || node.branchId.toUpperCase();
  $('#detail-branch').textContent = `${branchName} · ANNEAU ${node.ring + 1}`;
  $('#detail-desc').textContent = node.type === 'variant'
    ? `${node.desc}

Une fois débloquée, choisis-la avant de partir en mission depuis l'écran de PRÉPARATION.`
    : node.desc;
  $('#detail-desc').style.whiteSpace = node.type === 'variant' ? 'pre-line' : '';
  $('#detail-desc').style.borderLeftColor = node.color;
  $('#detail-cost').textContent = node.cost;

  const buy = $('#detail-buy');
  const status = $('#detail-status');
  const unlocked = save.unlocked.has(node.id);

  if (unlocked) {
    buy.disabled = true;
    buy.textContent = 'DÉBLOQUÉ';
    status.textContent = 'Ce nœud est actif.';
  } else if (!canBuy.reachable) {
    buy.disabled = true;
    buy.textContent = 'INACCESSIBLE';
    status.textContent = 'Débloque d\'abord un nœud voisin.';
  } else if (save.materials < node.cost) {
    buy.disabled = true;
    buy.textContent = 'MATÉRIAUX INSUFFISANTS';
    status.textContent = `Il manque ${node.cost - save.materials} matériaux.`;
  } else {
    buy.disabled = false;
    buy.textContent = 'DÉBLOQUER';
    status.textContent = 'Double-clic sur le nœud fonctionne aussi.';
  }

  A({ targets: body, opacity: [0, 1], translateY: [12, 0], duration: 260, easing: 'easeOutQuad' });
}

export function renderBranchNav(summaries, active, onPick) {
  const nav = $('#tree-branches');
  nav.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'branch-btn' + (active === -1 ? ' on' : '');
  all.style.borderColor = active === -1 ? PALETTE.line : '';
  all.innerHTML = `VUE GLOBALE<small>${summaries.reduce((a, s) => a + s.count, 0)} nœuds</small>`;
  all.addEventListener('click', () => onPick(-1));
  nav.appendChild(all);

  summaries.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'branch-btn' + (active === i ? ' on' : '');
    b.style.borderColor = active === i ? s.color : '';
    b.style.color = s.color;
    b.innerHTML = `${s.icon} ${s.name}<small>${s.count} / ${TREE.perBranch}</small>`;
    b.addEventListener('click', () => onPick(i));
    nav.appendChild(b);
  });
}

/** Aperçu chiffré des matériaux qu'une vague rapporterait. */
export function estimateMaterials(wave, mods) {
  const bonus = 1 + (mods['player.materials'] || 0);
  return Math.round(materialsForWave(wave) * bonus);
}

// ============================================================
//  Préparation de mission (loadout)
// ============================================================

/**
 * Une carte par tourelle, listant sa version de base et ses 3 variantes.
 * `isUnlocked(variantId)` dit si le nœud correspondant a été acheté dans
 * l'arbre ; sinon l'option est affichée verrouillée, avec l'anneau où la
 * trouver — on montre ce qu'il y a à gagner plutôt que de le cacher.
 */
export function renderLoadout(save, isUnlocked, onPick) {
  const grid = $('#lo-grid');
  let unlockedCount = 0;

  grid.innerHTML = VARIANT_ORDER.map((arche) => {
    const t = TOWERS[arche];
    const chosen = save.loadout[arche] || null;

    const base = `
      <button class="lo-opt ${chosen ? '' : 'on'}" data-arche="${arche}" data-variant="">
        <span class="lo-opt-icon" style="color:${t.accent}">◈</span>
        <span>
          <span class="lo-opt-name">STANDARD
            <span class="lo-opt-badge" style="color:var(--muted)">DE BASE</span>
          </span>
          <span class="lo-opt-desc">${t.desc}</span>
        </span>
      </button>`;

    const ring = VARIANT_RING + 1;
    const opts = VARIANTS[arche].map((v) => {
      const ok = isUnlocked(v.id);
      if (ok) unlockedCount++;
      const on = chosen === v.id;
      return `
      <button class="lo-opt ${on ? 'on' : ''} ${ok ? '' : 'locked'}"
              data-arche="${arche}" data-variant="${v.id}" ${ok ? '' : 'disabled'}>
        <span class="lo-opt-icon" style="color:${v.accent}">${v.icon}</span>
        <span>
          <span class="lo-opt-name" style="color:${ok ? v.accent : 'var(--muted)'}">${v.name}
            <span class="lo-opt-badge">${v.short}</span>
          </span>
          <span class="lo-opt-desc">${v.desc}</span>
          ${ok ? '' : `<span class="lo-opt-lock">✖ VERROUILLÉE — branche ${t.name}, anneau ${ring}</span>`}
        </span>
      </button>`;
    }).join('');

    return `<div class="lo-tower" style="border-left-color:${t.accent}">
      <div class="lo-tower-head">
        <span class="lo-glyph" style="color:${t.accent}">${GLYPHS[arche]}</span>
        <span class="lo-tower-name">${t.name}</span>
        <span class="lo-tower-tag">${TARGET_LABEL[t.targets]}</span>
      </div>
      <div class="lo-opts">${base}${opts}</div>
    </div>`;
  }).join('');

  $$('.lo-opt').forEach((el) => {
    if (el.disabled) return;
    el.addEventListener('click', () => onPick(el.dataset.arche, el.dataset.variant || null));
  });

  const total = VARIANT_ORDER.length * 3;
  $('#lo-count').textContent = `${unlockedCount} / ${total}`;
  renderLoadoutSummary(save);
}

/** Bandeau récapitulatif : ce qu'on emmène réellement. */
export function renderLoadoutSummary(save) {
  const el = $('#lo-summary');
  el.innerHTML = VARIANT_ORDER.map((arche) => {
    const t = TOWERS[arche];
    const id = save.loadout[arche];
    const v = id ? VARIANTS[arche].find((x) => x.id === id) : null;
    return `<span class="lo-chip" style="border-left-color:${v ? v.accent : 'var(--surface-3)'}">
      ${t.short} <b style="color:${v ? v.accent : 'var(--muted)'}">${v ? v.short : 'STANDARD'}</b>
    </span>`;
  }).join('');
}

// ============================================================
//  Draft de cartes
// ============================================================

/**
 * Affiche les 3 cartes proposees. `onPick` recoit la carte choisie.
 * L'overlay est plein ecran : le jeu doit deja etre fige par l'appelant.
 */
export function renderDraft(game, cards, onPick) {
  const el = $('#draft');
  const list = $('#draft-cards');

  $('#draft-kicker').textContent = `VAGUE ${game.wave} REPOUSSÉE`;

  list.innerHTML = cards.map((c) => `
    <button class="card ${c.rarity}" data-card="${c.id}" style="--card:${c.color}">
      <span class="card-top">
        <span class="card-icon">${c.icon}</span>
        <span>
          <span class="card-rarity">${RARITY[c.rarity].name}</span>
          <span class="card-name">${c.name}</span>
        </span>
      </span>
      <span class="card-desc">${c.desc}</span>
      <span class="card-take">PRENDRE</span>
    </button>`).join('');

  // Rappel de ce qui a deja ete pris dans la partie
  const owned = $('#draft-owned');
  const list2 = (game.cardsOwned || []).map((id) => CARD_BY_ID[id]).filter(Boolean);
  owned.innerHTML = list2.length
    ? `<span style="width:100%;margin-bottom:4px">DÉJÀ EN MAIN</span>` +
      list2.map((c) => `<i style="border-left-color:${c.color}">${c.icon} ${c.name}</i>`).join('')
    : '';

  $$('#draft-cards .card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = cards.find((x) => x.id === btn.dataset.card);
      if (!c) return;
      // Les deux autres cartes s'effacent, la choisie part en avant.
      $$('#draft-cards .card').forEach((o) => {
        if (o === btn) return;
        A({ targets: o, opacity: [1, 0], translateY: [0, 26], scale: [1, 0.94], duration: 260, easing: 'easeInQuad' });
      });
      A({
        targets: btn, scale: [1, 1.06, 1], duration: 340, easing: 'easeOutBack',
        complete: () => onPick(c)
      });
    });
  });

  el.hidden = false;
}

export function hideDraft() {
  const el = $('#draft');
  A({
    targets: '.draft-inner', opacity: [1, 0], translateY: [0, -18],
    duration: 240, easing: 'easeInQuad',
    complete: () => {
      el.hidden = true;
      A.set('.draft-inner', { opacity: 1, translateY: 0 });
    }
  });
}

/** Bandeau discret rappelant la carte qui vient d'etre prise. */
export function announceCard(card) {
  toast(`<b>${card.icon} ${card.name}</b><br>${card.desc}`, 'good', 4200);
}

// ============================================================
//  Tiroir des ameliorations
// ============================================================

/**
 * Liste ce que le joueur a accumule pendant la partie : les cartes
 * prises, puis le total des effets une fois tout cumule (arbre +
 * commandant + cartes), traduit en francais lisible.
 */
export function renderUpgrades(game) {
  const owned = (game.cardsOwned || []).map((id) => CARD_BY_ID[id]).filter(Boolean);
  $('#upg-n').textContent = owned.length;
  $('#upg-count').textContent = owned.length;

  const list = $('#upg-cards');
  list.innerHTML = owned.length
    ? owned.map((c) => `
      <div class="upg-card" style="border-left-color:${c.color}">
        <span class="upg-card-icon" style="color:${c.color}">${c.icon}</span>
        <span>
          <span class="upg-card-name" style="color:${c.color}">${c.name}</span>
          <span class="upg-card-desc">${c.desc}</span>
        </span>
      </div>`).join('')
    : `<p class="upg-empty">Aucune carte pour l'instant. Une amélioration est proposée toutes les 3 vagues.</p>`;

  // Effets cumules, groupes par portee
  const rows = describeMods(game.mods);
  const mods = $('#upg-mods');
  if (!rows.length) {
    mods.innerHTML = `<p class="upg-empty">Aucun effet actif.</p>`;
    return;
  }
  let html = '';
  let lastScope = null;
  for (const r of rows) {
    if (r.scope !== lastScope) {
      html += `<div class="upg-mod-group">${r.scope}</div>`;
      lastScope = r.scope;
    }
    html += `<div class="upg-mod">${r.text}</div>`;
  }
  mods.innerHTML = html;
}

export function toggleUpgrades(game, force) {
  const el = $('#upg-drawer');
  const open = force !== undefined ? force : el.hidden;
  if (open) renderUpgrades(game);
  el.hidden = !open;
  $('#btn-upgrades').classList.toggle('on', open);
  return open;
}
