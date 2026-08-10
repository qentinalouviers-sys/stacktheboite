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

| Étape | Contenu | État |
|---|---|---|
| 1 | Mécanique + découpe + chute + score | ✅ |
| 2 | Squash & stretch, ondes, particules, tremblement, effets perfect | ✅ |
| 3 | Boîte à pizza QENTINA, four, salle, fond dégradé | ✅ |
| 4 | Haptique, manifeste PWA | ✅ — audio, offline et paliers à faire |

Fait : la mécanique complète, les effets de pose, la boîte à pizza blanche avec
QENTINA imprimé sur les tranches, le four napolitain et sa salle, le fond qui
passe de l'intérieur chaud au ciel nocturne, la vibration, le manifeste PWA.
Manquent l'audio, le fonctionnement hors ligne et les paliers de récompense.

## Le décor

Reconstruit d'après une photo du vrai four et une maquette 3D de la cuisine, en
volumes simples : coupole en mosaïque cuivre / or / bronze à joints sombres,
bouche en arche avec les braises au fond, socle cylindrique carrelé de la même
faïence, bûches rangées dessous, tablette de marbre, conduit d'extraction coudé
avec ses anneaux, plan de travail inox avec évier, robinet et vitrine de
préparation, comptoir de service bois et marbre, sol carrelé.

Trois décisions valent d'être connues, parce qu'elles s'écartent du réel :

- **Le four est à l'échelle 0,62.** La caméra est orthographique : rien ne
  rapetisse avec la distance. Un four à sa taille réelle par rapport à une boîte
  à pizza remplirait l'écran. On triche donc à l'échelle, et le cerveau lit
  « four au fond de la salle ».
- **Les surfaces claires sont assourdies, et le mur derrière le four est
  sombre.** Un aplat blanc à côté de boîtes blanches leur vole la lecture, et
  c'est la tour qu'on doit lire en premier. Le panneau de marbre initialement
  placé derrière le four virait en prime au rose sous la lumière des braises.
- **Le métal est en `MeshPhongMaterial` avec `specular`, pas en
  `MeshStandardMaterial` avec `metalness`.** Sans environment map, un matériau
  métallique n'a rien à réfléchir : il rend sombre et terne, parce qu'un métal
  n'a pas de couleur diffuse. Le `specular` de Phong, lui, brille avec les
  lumières de la scène sans rien avoir à charger.
- **Le conduit d'extraction n'est pas là que pour le décor.** Les UV sphériques
  convergent au pôle de la coupole, ce qui donnait au sommet un aspect de panier
  tressé. Le conduit couvre ce point — et il existe sur la vraie photo.

Le sol s'éteint en alpha vers ses bords : sans ça il se termine par une arête
franche en plein écran. Il se fond dans le dégradé de fond, et à mesure que la
caméra monte on quitte la salle pour la nuit.

## Arborescence

```
index.html          import map + HUD DOM
styles.css          HUD, écrans, règles tactiles mobiles
vendor/             Three.js r160 (ESM minifié) + sa licence
src/
  config.js         TOUTES les constantes de tuning
  game.js           machine à états + règles, zéro code de rendu
  boxes.js          meshes des boîtes, tour visible, pool de fragments
  effects.js        écrasement, ondes, particules, tremblement de caméra
  main.js           scène, caméra, boucle de rendu, entrées
  textures.js       atlas carton QENTINA généré au canvas
  scenery.js        fond dégradé et couleur de lumière selon la hauteur
  haptics.js        vibration, avec no-op silencieux si non supporté
  ui.js             HUD DOM
  storage.js        meilleur score et préférences (localStorage)
manifest.webmanifest, icon.svg
```

`audio.js` arrivera avec l'étape 4. `effects.js` est un ajout à l'arborescence
prévue : ces effets ne sont ni des boîtes ni du décor, et `boxes.js` porte déjà
la découpe, la tour et les fragments.

## Les effets de pose

Deux règles tenues partout : aucun `setTimeout`, tout avance avec le delta de la
boucle de rendu ; et rien ne bloque l'entrée, on peut poser la boîte suivante
alors que l'onde précédente n'est pas finie.

- **Écrasement** en deux phases explicites — montée en ease-out jusqu'à
  `1 + SQUASH_OVERSHOOT`, retour en smoothstep jusqu'à 1 — plutôt qu'une
  élastique paramétrique. Le dépassement vaut donc exactement les 6 % demandés
  au lieu de dépendre d'une constante magique d'easing. Le dessous de la boîte
  reste collé à celle du dessous pendant tout l'écrasement.
- **Onde** au niveau de la boîte, blanc cassé à la pose, dorée et plus large au
  perfect, plus intense encore à partir de cinq perfects d'affilée.
- **Particules dorées** au perfect, 8 à 14 par pose, éjectées à
  l'horizontale, gravité `-18`, extinction en 600 ms.
- **Tremblement de caméra** à partir de cinq perfects : la caméra et sa cible
  sont décalées du même vecteur, donc la vue se translate au lieu de pivoter.
- **Flash du four** ×1,5 pendant 120 ms au perfect.

Tout est en pool, plafonds compris : aucune allocation de mesh en cours de
partie une fois le régime établi.

Deux écarts sur ce point :

- **L'onde naît au bord de la boîte, pas à un rayon nul.** Elle apparaît sur le
  dessus de la boîte posée : une onde blanc cassé sur un carton blanc, à
  l'intérieur de l'empreinte de la boîte, est strictement invisible. Partir de
  zéro perdait la moitié de l'animation.
- **Le nombre de particules simultanées est plafonné.** Quatre perfects
  enchaînés en faisaient coexister 69, soit autant d'appels de dessin en plus,
  et le pool débordait donc on réallouait en pleine partie. Au plafond, les plus
  anciennes sont recyclées.

## Le texte QENTINA et le rétrécissement des boîtes

C'est le point technique du projet. Une seule texture est partagée par toutes
les boîtes : un atlas dont la moitié haute est la tranche imprimée QENTINA et
la moitié basse le carton uni du couvercle.

L'adaptation à la taille d'une boîte se fait en **retouchant les UV de sa
géométrie**, jamais en étirant le mesh ni en clonant la texture :

- la bande imprimée couvre toujours `TEXTURE_REF_LENGTH` unités monde, donc les
  lettres gardent exactement la même taille physique quelle que soit la largeur
  de la boîte — QENTINA ne s'étire jamais, même après vingt découpes ;
- le motif reste centré sur la tranche, donc une boîte étroite montre le milieu
  du mot et pas un blanc entre deux mots ;
- l'atlas évite les matériaux par face. Avec un matériau par face, une boîte
  coûtait six appels de dessin et la tour en consommait 210 ; on est à 58.

## Écarts assumés par rapport au master prompt

Trois points de la spec ne tenaient pas tels quels. Les valeurs sont dans
`config.js`, remets-les pour constater le problème.

1. **Course de la boîte : `±12` → `±3.5`.** Avec la caméra isométrique
   `(6,6,6)`, l'axe X se projette à l'écran avec un facteur `1/√3 ≈ 0.577`, et
   une boîte pleine ajoute ~`1.73` unité d'emprise écran. À `±12` la boîte
   passait l'essentiel de son trajet hors cadre. Le frustum est par ailleurs
   calculé à partir d'une **largeur** minimale (`VIEW_WIDTH_MIN = 7.8`) et non
   d'une hauteur : en portrait, une hauteur de 10 donnait 4,6 unités de large,
   trop peu pour une boîte de 3. Course plus courte = frustum plus serré =
   boîtes plus grosses à l'écran, ce qui manquait le plus en portrait.

2. **Vitesses baissées : `6.0 / 0.28 / 22.0` → `4.2 / 0.16 / 12.0`.** D'abord
   parce que le flux de boîtes était trop rapide au test. Ensuite parce que le
   plafond à 22 u/s rendait le perfect inatteignable : la fenêtre fait `0.24`
   unité alors qu'un frame à 60 fps déplaçait la boîte de `0.37` unité, soit
   plus large que la fenêtre entière. À 12 u/s le pas d'un frame vaut `0.20`
   unité et le perfect reste jouable jusqu'au plafond.

3. **Three.js vendorisé au lieu du CDN.** L'exigence « offline après premier
   chargement » et la cible « premier tap < 1,5 s en 4G » supportent mal une
   origine tierce (DNS + TLS supplémentaires, panne CDN = jeu mort en salle).
   Le fichier reste du texte, donc la règle « zéro binaire » tient. 167 ko
   gzippés.

Le squash `scaleY 0.72` du §3 et l'interdiction de scaler le mesh du §4 se
concilient : le squash est transitoire (180 ms), les redimensionnements
permanents régénèrent la géométrie.

## Vibration : la moitié des clients n'en aura pas

`navigator.vibrate` **n'existe pas sur Safari iOS**, et Apple n'expose aucune
alternative au web. Tout iPhone est donc muet côté haptique, quel que soit le
code, et ce n'est pas contournable de façon fiable. Conséquences assumées :

- le bouton vibration du HUD est **masqué** quand le navigateur ne sait pas
  vibrer, plutôt que d'afficher un interrupteur qui ne commande rien ;
- aucune mécanique ne s'appuie sur l'haptique, le retour visuel doit rester
  auto-suffisant.

Sur Android/Chrome, la vibration marche : `10 ms` à la pose, un motif plus
marqué au perfect, un motif long au game over. L'état du bouton est mémorisé.

## Vérifications automatisées

Non incluses dans le dépôt (jetables), mais validées sous Chromium en 390×844,
360×640 et 844×390 :

- découpe exacte au flottant près, jointure boîte posée / fragment sans trou ;
- 10 perfects d'affilée : recalage exact, regain de largeur, série comptée ;
- 200 niveaux : `renderer.info.memory.geometries` se stabilise (25 boîtes et
  leurs arêtes, boîte mobile, pool de fragments), aucune fuite ;
- game over : chute complète, écran de fin à 0,7 s, record écrit, rejeu en un tap ;
- portrait et paysage : boîte dans le cadre sur toute sa course, y compris avec
  une tour décalée au maximum ;
- 60 appels de dessin en régime établi et ~118 au pic d'une série de perfects,
  7 textures, décor compris ;
- courbes des effets vérifiées pas à pas : l'écrasement culmine à 1,06 puis
  revient exactement à 1, le dessous de la boîte ne bouge pas d'un flottant,
  l'onde s'éteint pile à sa durée, le tremblement dure exactement 150 ms ;
- le bouton vibration ne pose pas de boîte, son état persiste, et les quatre
  motifs de vibration partent au bon moment.

## À tester sur téléphone

C'est le feel qui est en jeu, pas l'habillage.

1. La vitesse : `4.2` au départ, `+0.16` par niveau, plafond `12.0`. Encore
   trop rapide ? trop mou maintenant ?
2. Le cadrage : les boîtes sont-elles à la bonne taille à l'écran ?
3. QENTINA sur les tranches : bien lisible, y compris sur les boîtes étroites ?
4. La vibration à chaque pose (Android uniquement) : bon dosage ?
5. Les effets de pose : l'écrasement se voit-il ? l'onde ? le tremblement à
   partir de cinq perfects est-il perceptible, ou faut-il monter
   `SHAKE_AMPLITUDE` au-delà de `0.04` ?
6. La fenêtre perfect à `0.12` : atteignable au doigt ?
7. Aucun scroll, aucun zoom, aucun rebond élastique.

Il reste l'audio, le fonctionnement hors ligne et les paliers de récompense.
