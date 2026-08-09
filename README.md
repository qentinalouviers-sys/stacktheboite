# QENTINA STACK

Jeu de salle pour la pizzeria QENTINA (Louviers). Empilage de boîtes à pizza,
jouable au premier tap depuis un QR code sur la table.

## En ligne

**https://qentinalouviers-sys.github.io/stacktheboite/**

Publié automatiquement : chaque push sur `claude/new-session-k04edj` déclenche
le workflow `.github/workflows/pages.yml`, qui assemble le site et force-push
la branche `gh-pages`, d'où GitHub Pages sert.

## Lancer en local

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Rien à installer, rien à compiler. Three.js est vendorisé dans `vendor/`.
Ajouter `?debug=1` à l'URL pour afficher le compteur de géométries / draw calls
et exposer `window.__qentina` (jeu, renderer, scène) dans la console.

## État d'avancement

**Étape 1 — v0 jouable : faite.** Mécanique, découpe, chute, score, caméra,
game over, rejeu. Habillage volontairement nu.

| Étape | Contenu | État |
|---|---|---|
| 1 | Mécanique + découpe + chute + score | ✅ |
| 2 | Squash & stretch, ondes, particules, tremblement, effets perfect | à faire |
| 3 | Textures carton QENTINA, four, salle, dégradé de fond | à faire |
| 4 | Audio, haptique, PWA/offline, paliers et partage | à faire |

## Arborescence

```
index.html          import map + HUD DOM
styles.css          HUD, écrans, règles tactiles mobiles
vendor/             Three.js r160 (ESM minifié) + sa licence
src/
  config.js         TOUTES les constantes de tuning
  game.js           machine à états + règles, zéro code de rendu
  boxes.js          meshes des boîtes, tour visible, pool de fragments
  main.js           scène, caméra, boucle de rendu, entrées
  ui.js             HUD DOM
  storage.js        meilleur score et préférences (localStorage)
```

`scenery.js`, `textures.js`, `audio.js`, `haptics.js` arriveront aux étapes 3 et 4.

## Écarts assumés par rapport au master prompt

Trois points de la spec ne tenaient pas tels quels. Les valeurs sont dans
`config.js`, remets-les pour constater le problème.

1. **Course de la boîte : `±12` → `±4.5`.** Avec la caméra isométrique
   `(6,6,6)`, l'axe X se projette à l'écran avec un facteur `1/√3 ≈ 0.577`, et
   une boîte pleine ajoute ~`1.73` unité d'emprise écran. À `±12` la boîte
   passait l'essentiel de son trajet hors cadre. Le frustum est par ailleurs
   calculé à partir d'une **largeur** minimale (`VIEW_WIDTH_MIN = 9`) et non
   d'une hauteur : en portrait, une hauteur de 10 donnait 4,6 unités de large,
   trop peu pour une boîte de 3.

2. **Plafond de vitesse `22` u/s : le perfect devient une loterie.** La fenêtre
   perfect fait `0.24` unité ; à 60 fps un frame déplace la boîte de `v/60`,
   soit `0.37` unité à 22 u/s — plus large que la fenêtre entière. Le perfect
   cesse d'être atteignable de façon fiable vers 14 u/s (niveau ~30). La valeur
   par défaut reste `22` mais c'est le premier chiffre à baisser après test.

3. **Three.js vendorisé au lieu du CDN.** L'exigence « offline après premier
   chargement » et la cible « premier tap < 1,5 s en 4G » supportent mal une
   origine tierce (DNS + TLS supplémentaires, panne CDN = jeu mort en salle).
   Le fichier reste du texte, donc la règle « zéro binaire » tient. 167 ko
   gzippés.

Le squash `scaleY 0.72` du §3 et l'interdiction de scaler le mesh du §4 se
concilient : le squash est transitoire (180 ms), les redimensionnements
permanents régénèrent la géométrie.

## Vérifications automatisées

Non incluses dans le dépôt (jetables), mais l'étape 1 a été validée sous
Chromium en 390×844 :

- découpe exacte au flottant près, jointure boîte posée / fragment sans trou ;
- 10 perfects d'affilée : recalage exact, regain de largeur, série comptée ;
- 200 niveaux : `renderer.info.memory.geometries` se stabilise à 79
  (25 boîtes × 2 + boîte mobile × 2 + pool de 13 fragments × 2 + sol),
  ~40 draw calls, aucune fuite ;
- game over : chute complète, écran de fin à 0,7 s, record écrit, rejeu en un tap ;
- portrait et paysage : boîte dans le cadre sur toute sa course, y compris avec
  une tour décalée au maximum.

## À tester sur téléphone

C'est le feel qui est en jeu, pas l'habillage.

1. La vitesse de départ et la montée en difficulté : trop mou ? trop raide ?
2. La montée de caméra (lerp exponentiel) : sèche ? molle ?
3. La course `±4.5` : assez d'amplitude pour que ce soit un choix, ou trop long ?
4. La fenêtre perfect à `0.12` : atteignable au doigt, ou frustrante ?
5. Le délai de `0.7 s` avant l'écran de fin : on a le temps de voir la chute ?
6. Aucun scroll, aucun zoom, aucun rebond élastique.

Les effets visuels de pose (squash, ondes, particules, tremblement) ne sont
volontairement pas là : ils arrivent à l'étape 2, une fois le feel de base validé.
