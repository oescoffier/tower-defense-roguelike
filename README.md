# NULL SECTOR

Tower defense roguelike jouable dans le navigateur. Parties infinies : on ne gagne pas, on tient plus longtemps.

**▶ [Jouer](https://oescoffier.github.io/tower-defense-roguelike/)**

## Le jeu

Grille 24×14 avec obstacles. Les tours se posent sur les cases, jamais en placement libre. Poser une tour sur le chemin au sol le **modifie** — mais il est impossible de le fermer complètement : la pose est refusée si elle coupe l'accès à la base, ou si elle enferme un ennemi déjà sur le terrain. Le couloir aérien est une courbe fixe que le joueur ne peut pas altérer.

### Les 6 tours

| Tour | Cibles | Spécificité |
|---|---|---|
| Mitraillette | sol + air | Monte en régime en tirant sans interruption |
| Sniper | sol + air | Hitscan, ignore l'armure, traverse plusieurs cibles, critiques |
| Mortier | sol | Tir en cloche, dégâts de zone, laisse un cratère brûlant |
| Tesla | sol + air | Arc à rebonds, marque les cibles : leur mort déclenche une réaction en chaîne |
| Lance-flamme | sol | Cône continu, brûlure cumulable |
| DCA | **air uniquement** | Missiles à tête chercheuse, dégâts massifs |

12 types d'ennemis (armure, boucliers régénérants, soigneurs, scindeurs, essaims, boss au sol et aériens).

### Méta-progression

À la fin d'une partie, la vague atteinte donne des matériaux qui se dépensent dans un arbre de compétences en **étoile à 7 branches** : une par tour, plus une branche Commandant (vie maximale, or de départ, intérêts…).

**2156 nœuds** (7 × 308), générés procéduralement de façon déterministe — mineurs, notables et clés de voûte qui modifient les règles du jeu. Une partie moyenne monte à la vague 20 et rapporte de quoi ouvrir une quinzaine de nœuds.

## Lancer en local

Les modules ES exigent un serveur HTTP — un double-clic sur `index.html` ne suffit pas.

```bash
python -m http.server 8000
```

Puis `http://localhost:8000`.

## Technique

HTML/CSS/JavaScript, aucun build, aucune dépendance à installer.

```
index.html
styles.css
js/
  config.js      constantes et tables d'équilibrage
  grid.js        quadrillage, BFS, validation anti-blocage
  towers.js      les 6 tours, résolution des stats
  combat.js      armes, projectiles, chaîne, missiles guidés
  enemies.js     12 types et leurs statuts
  waves.js       vagues infinies procédurales
  skilltree.js   l'étoile à 7 branches
  vfx.js         particules, ondes, screen shake
  render.js      rendu canvas du champ de bataille
  tween.js       moteur d'animation de repli
  ...
```

Les animations d'interface utilisent [anime.js](https://animejs.com/) via CDN, avec un moteur de tween interne (`tween.js`) qui prend le relais si le CDN est injoignable — le jeu reste entièrement jouable hors ligne.

`window.TD` est exposé en console (`TD.game`, `TD.tree`, `TD.save`) pour inspection.
