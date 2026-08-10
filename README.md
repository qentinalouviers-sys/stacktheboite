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
| 4 | Audio, haptique, PWA, hors ligne, profil, paliers, partage | ✅ |

Fait : la mécanique complète, les effets de pose, la boîte à pizza blanche avec
QENTINA imprimé sur les tranches, le four napolitain et sa salle, le fond qui
passe de l'intérieur chaud au ciel nocturne, la vibration, le manifeste PWA.
Le jeu est complet au regard du master prompt.

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
  audio.js          synthèse Web Audio, aucun fichier son
  haptics.js        vibration, avec no-op silencieux si non supporté
  account.js        profil joueur, consentements, seul module qui parle réseau
  rewards.js        paliers, codes, badges
  share.js          partage natif et génération de la carte de score
  ui.js             HUD DOM
  storage.js        meilleur score et préférences (localStorage)
manifest.webmanifest, icon.svg
legal.html          CGU et politique de confidentialité
sw.js               service worker : le jeu tourne hors ligne
```

`effects.js` est un ajout à l'arborescence
prévue : ces effets ne sont ni des boîtes ni du décor, et `boxes.js` porte déjà
la découpe, la tour et les fragments.

## Le carton qui brûle

Rien ne brûle avant le niveau 12 : les premières boîtes doivent être
impeccables, sinon l'effet n'a pas de point de comparaison et le carton a
simplement l'air sale. Ensuite la brûlure monte jusqu'au niveau 55, et de la
fumée commence à s'élever du sommet de la tour.

Le mélange se fait sur deux plans :

- **Trois états de tranche dans l'atlas** — intacte, roussie, calcinée — qui
  portent les marques : bord bas noirci, taches irrégulières, plaques quasi
  noires, points de braise, QENTINA peu à peu mangé. Les couvercles ont leurs
  propres colonnes dans l'atlas, sinon le dessus d'une boîte reste crème alors
  que ses tranches sont noires.
- **Une teinte qui dérive en continu** par-dessus, qui assure la transition
  entre deux paliers.

Le réglage qui compte : la teinte est **volontairement discrète**. Une teinte
sombre écrase la texture et le carton lit « brun uni » au lieu de « brûlé ». Ce
sont les marques qui doivent porter l'effet, pas l'assombrissement global.

La fumée est un pool de bouffées qui montent du sommet, avec un débit
proportionnel à la brûlure. Elles naissent au-dessus du couvercle et non dedans,
faute de quoi la moitié de leur vie se passe cachée dans la boîte.

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

## Profil joueur, paliers et partage

### Jouer ne demande rien

Aucun compte n'est requis pour jouer, et le formulaire n'apparaît **jamais**
avant la fin d'une partie. Le profil sert uniquement à enregistrer un score et
à récupérer les paliers.

### Il n'y a pas encore de serveur — et c'est important

Le jeu est un site statique. **Tant que `ACCOUNT_ENDPOINT` est vide dans
`config.js`, rien ne quitte le téléphone** : ni le pseudo, ni l'e-mail, ni le
score. Le profil est écrit dans le `localStorage` de l'appareil, point. En
conséquence :

- QENTINA ne reçoit aucune adresse e-mail ;
- « J'ai déjà un profil » ne peut retrouver qu'un profil créé **sur ce même
  téléphone**, ce que le message d'erreur dit explicitement au joueur ;
- les codes de récompense sont générés côté client, donc trivialement
  falsifiables. C'est un geste commercial, pas un bon de réduction.

Tout le réseau passe par une seule fonction privée, `post()` dans
`account.js`. Le jour où un endpoint existe, il suffit de renseigner
`ACCOUNT_ENDPOINT` : aucune autre ligne du jeu ne change.

### Contrat de l'API à implémenter

Quatre routes, toutes en `POST`, corps et réponse en JSON, CORS ouvert au
domaine du jeu. Un Cloudflare Worker avec un binding KV suffit.

| Route | Corps envoyé | Réponse attendue |
|---|---|---|
| `/register` | `{pseudo, email, consents, best}` | `200` quelconque |
| `/signin` | `{email}` | `{pseudo, best}` si connu, `404` sinon |
| `/score` | `{email, pseudo, score, streak}` | `200` quelconque |
| `/forget` | `{email}` | `200`, et effacement effectif côté serveur |

`consents` contient, pour `terms` et `marketing`, `{given, at, version}` :
l'horodatage et la version des conditions acceptées. **Conserve-les tels
quels** — c'est ce qui permet de prouver, en cas de contrôle, à quoi le joueur
a consenti et quand.

Le jeu ne bloque jamais sur le réseau : le profil est écrit en local **avant**
l'appel, et un échec réseau est silencieux. Personne ne doit perdre son
inscription parce que le wifi de la salle a hoqueté.

### Consentement marketing : le point à faire trancher

Le formulaire exige aujourd'hui la case marketing, comme demandé. Il faut
savoir que le RGPD exige un consentement **libre** : la CNIL considère qu'un
consentement marketing conditionnant l'accès à un service n'est pas valide, ce
qui expose à une plainte et rend la base de contacts contestable.

La case est donc pilotée par une constante unique,
`MARKETING_CONSENT_REQUIRED` dans `config.js`. La passer à `false` la rend
facultative et ajoute la mention « facultatif, sans conséquence sur le jeu »
— rien d'autre à toucher. **À trancher avec un juriste.**

### Conditions générales

`legal.html` contient un projet complet de CGU et de politique de
confidentialité : éditeur, objet, profil, paliers, tableau des traitements avec
finalités, bases légales et durées de conservation, prospection, destinataires,
droits, sécurité, propriété intellectuelle, responsabilité, droit applicable.

**Les mentions entre crochets doivent être renseignées par QENTINA** (raison
sociale, adresse, SIREN, e-mail de contact, durée de validité des codes,
médiateur de la consommation) **et le texte doit être relu par un
professionnel du droit** avant d'être opposé aux clients.

À chaque modification du texte, incrémenter `LEGAL_VERSION` : les consentements
sont horodatés avec cette version, c'est ce qui permet de savoir qui doit
re-consentir.

Le droit à l'effacement est implémenté dans le jeu : le bouton « Effacer
définitivement mes données » vide le `localStorage` et appelle `/forget`.

### Partage

Instagram et TikTok n'apparaissent dans la feuille de partage native que si on
partage une **image**, pas du texte. Le jeu génère donc une carte au format
story (1080 × 1920) avec le score, le pseudo et la marque, et la passe à
`navigator.share`. Trois replis en cascade : image native, puis texte et lien
en natif, puis copie dans le presse-papier, puis téléchargement de l'image.

### Gamification et déverrouillage du code

Trois paliers de récompense, une barre de progression vers le palier suivant,
et sept badges — dont deux calés sur la brûlure du carton, pour que l'effet
visuel serve aussi de jalon.

Le cadeau gagné est **annoncé à tout le monde** — « 🎁 TU AS GAGNÉ · UN CAFÉ
OFFERT » — mais le **code est verrouillé** tant qu'il n'y a pas de profil. Le
bouton d'action devient alors « Voir mon code », en doré, et la feuille change
de discours : « Récupère ton cadeau », « Ton code apparaît juste après ».

Ce n'est pas qu'un masquage visuel : tant que le joueur n'est pas inscrit, le
code **n'est pas généré du tout**. Il n'est ni dans le stockage local, ni dans
le DOM — il n'y a rien à aller chercher avec l'inspecteur. `claimReward()`
n'est appelée qu'une fois le profil créé. Un code déjà obtenu reste acquis :
rejouer au même palier réaffiche le même code.

C'est le bon ordre incitatif : on montre ce qui est gagné, et l'inscription
devient le moyen de l'encaisser.

## Audio

Tout est synthétisé à la Web Audio API : le jeu ne charge pas un octet pour
sonner. Quatre sons — un thud à la pose (sinus qui descend + bouffée de bruit
passe-bas), un froissement à la découpe (bruit passe-haut), une note claire au
perfect, un glissando descendant au game over.

Deux points valent d'être connus :

- **L'AudioContext est créé au premier tap, jamais au chargement.** iOS refuse
  tout contexte créé hors d'un geste utilisateur, et un contexte créé trop tôt
  reste « suspended » à vie.
- **Le son démarre coupé.** On est dans une salle de restaurant : un jeu qui
  hurle depuis la table d'à côté est un problème commercial avant d'être un
  problème technique. Une pastille « Son coupé » signale qu'il existe, et
  disparaît au premier appui.

La note du perfect monte d'un **demi-ton par perfect consécutif** —
`261,63 × 2^(n/12)`, plafonnée à deux octaves puis remise à zéro. C'est le
mécanisme de récompense du jeu d'origine, et c'est pour ça que le plafond
existe : au-delà, ça devient strident.

## Hors ligne

Le jeu est jouable hors ligne **dès le premier chargement**, y compris la page
légale une fois visitée.

Deux stratégies dans `sw.js`, et le choix n'est pas cosmétique :

- les **documents** passent par le réseau d'abord. Ils ne portent pas
  d'empreinte de version dans leur URL : servis depuis le cache en priorité,
  une mise en ligne ne serait jamais vue ;
- **tout le reste** passe par le cache d'abord, puisque le déploiement tamponne
  une empreinte de version dans ces URL — une entrée en cache ne peut donc pas
  être périmée.

Le point délicat : au tout premier chargement, les modules sont demandés
**avant** que le worker soit actif, donc ils ne passent jamais par son `fetch`.
La page lui envoie donc la liste de ce qu'elle vient réellement de charger, et
il la met en cache. C'est ce qui évite d'attendre une deuxième visite — et ça
évite au worker d'avoir à connaître les empreintes de version.

Le cache est purgé à chaque changement de version, remplacée au déploiement par
le sha du commit.

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
- 60 appels de dessin en régime établi et ~115 au pic d'une série de perfects,
  8 textures, décor et fumée compris ;
- 30 ko transférés hors Three.js (100 ko bruts), page chargée en 250 ms en
  local ;
- courbes des effets vérifiées pas à pas : l'écrasement culmine à 1,06 puis
  revient exactement à 1, le dessous de la boîte ne bouge pas d'un flottant,
  l'onde s'éteint pile à sa durée, le tremblement dure exactement 150 ms ;
- le bouton vibration ne pose pas de boîte, son état persiste, et les quatre
  motifs de vibration partent au bon moment ;
- parcours de compte de bout en bout : partie jouable sans profil, validation
  du formulaire vide puis avec un e-mail invalide, création de profil,
  normalisation de l'e-mail, consentements horodatés et versionnés, mode
  connexion qui masque pseudo et consentements, partage, effacement RGPD ;
- un tap derrière la feuille de compte ouverte ne relance pas de partie ;
- audio : aucun oscillateur créé tant que le son est coupé, et la note du
  perfect monte bien d'un demi-ton exact par perfect consécutif
  (261,63 → 277,19 → 293,67 → 311,13 Hz) ;
- hors ligne : après UN seul chargement en ligne, réseau coupé, la page se
  recharge, le jeu tourne et `legal.html` répond.

## À tester sur téléphone

C'est le feel qui est en jeu, pas l'habillage.

1. La vitesse : `4.2` au départ, `+0.16` par niveau, plafond `12.0`. Encore
   trop rapide ? trop mou maintenant ?
2. Le cadrage : les boîtes sont-elles à la bonne taille à l'écran ?
3. QENTINA sur les tranches : bien lisible, y compris sur les boîtes étroites ?
4. La vibration à chaque pose (Android uniquement) : bon dosage ?
5. Le son, une fois activé : le thud, la montée des perfects, le game over.
6. Les effets de pose : l'écrasement se voit-il ? l'onde ? le tremblement à
   partir de cinq perfects est-il perceptible, ou faut-il monter
   `SHAKE_AMPLITUDE` au-delà de `0.04` ?
7. La brûlure : assez discrète au début, assez inquiétante à la fin ? Le seuil
   est `BURN_START_LEVEL`, la vitesse `BURN_FULL_LEVEL`.
8. La fenêtre perfect à `0.12` : atteignable au doigt ?
9. Aucun scroll, aucun zoom, aucun rebond élastique.
10. Hors ligne : joue une partie, coupe les données, recharge la page.

Reste à faire côté QENTINA, hors code : remplir les mentions entre crochets des
CGU, les faire relire, trancher le consentement marketing, et brancher un
endpoint si tu veux recevoir les inscriptions.
