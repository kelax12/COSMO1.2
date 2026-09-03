# Prompts des huit audits (A-1 → A-8)

**Écrits le 2026-09-03**, en accompagnement du §10 de [`a-faire-code.md`](./a-faire-code.md). Un
prompt par session, à coller tel quel. Ils sont indépendants : n'importe quel ordre marche, mais
l'ordre du tableau est celui du rapport valeur / effort.

**Chaque prompt est en deux parties** : le **préambule commun** (à coller en tête, il porte les
règles du dépôt qui ont coûté cher à apprendre) puis le **corps de l'audit**. Coller les deux.

---

## Préambule commun (à mettre en tête de CHAQUE audit)

```text
Tu fais un AUDIT sur le dépôt COSMO. Lis CLAUDE.md en entier avant de commencer, puis
a-faire-code.md (la liste des problèmes de code connus) et faille.md (la sécurité fait foi là).

MÉTHODE, non négociable, chaque règle vient d'une erreur réelle de ce dépôt :

1. Mesurer, jamais déduire. Un finding affirmé depuis une règle écrite, sans avoir ouvert l'écran
   ou joué la requête, sera rejeté. Le 2026-08-27, un bug a été affirmé par déduction puis
   rétracté ; le même jour, une contre-mesure prise dans un onglet caché (où requestAnimationFrame
   ne tourne pas) a rendu un rapport « tout est cassé » parfaitement convaincant et parfaitement
   faux.
2. Tout harnais de mesure embarque un TÉMOIN : une sonde qui doit échouer si le détecteur ne
   détecte plus rien. Un outil qui ne voit pas une chose ne prouve pas qu'elle est absente.
3. Un « avant » se reconstruit à un commit nommé, jamais dans un arbre de travail, jamais recopié
   d'un tableau plus ancien. Trois erreurs de ce type en deux semaines.
4. Ne JAMAIS relever un plafond ni baisser un seuil pour faire passer une garde
   (check:bundle, architecture.guard, i18n:scan, test:coverage).
5. Chercher la CHOSE décrite, pas le symptôme cité par la doc. Une vérification qui ne corrige
   qu'un nom sur six laisse la dérive intacte et la fait paraître vérifiée.

CONTRAINTES D'ENVIRONNEMENT :

- Ce dépôt a PLUSIEURS SESSIONS ACTIVES. L'arbre de travail contient probablement des fichiers
  modifiés qui ne sont pas à toi. Ne commite JAMAIS avec `git add -A` : utilise
  `git commit <chemins> -F -` en nommant tes fichiers. Relis le ledger de migrations AVANT
  d'appliquer quoi que ce soit, pas après.
- Écriture en base : uniquement par `npm run cosmo` (CLI, RLS respectée). JAMAIS par le MCP
  Supabase. Lecture SQL en prod : autorisée, et toute sonde qui écrit doit vivre dans une
  transaction annulée par un RAISE final.
- Ne lance jamais `npm run cosmo:login` (interactif).
- prefers-reduced-motion est ACTIF sur la machine d'Axel : si une animation « ne s'affiche pas »,
  vérifier ce réglage avant de suspecter le code.
- Pas de tiret cadratin dans un texte livré à l'utilisateur (fr comme en).

LIVRABLE, dans cet ordre :

1. Un rapport en fin de session : ce qui a été mesuré, comment, et chaque finding avec sa preuve.
   Un finding sans scénario d'échec concret (entrées, état, résultat faux) n'est pas un finding.
2. Les findings AJOUTÉS à a-faire-code.md, en continuant la numérotation (C-29, C-30, ...), au
   même format que les items existants : titre, priorité, effort, où, pourquoi ça compte, et
   « fini quand ». Retire du §10 la ligne de l'audit que tu viens de faire, et dis ce qu'il a
   rendu.
3. Les correctifs ÉVIDENTS et bornés peuvent être livrés dans la foulée, avec leurs tests, vus
   rouges avant d'être verts. Tout ce qui dépasse va dans a-faire-code.md, pas dans un commit
   fourre-tout.
4. Gates avant tout push : npm run typecheck, npm run lint, npm test, npm run i18n:check.
   Si tu touches au bundle : npm run build puis npm run check:bundle (avec VITE_SENTRY_DSN posée,
   sinon la garde mesure un artefact qui n'existe nulle part).
5. Commit + push automatiques une fois vérifié, sans demander confirmation. Message en français,
   qui dit ce qui a été TROUVÉ, pas ce qui a été fait.
   Terminer par : Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## A-1 · Les trois Edge Functions non-Stripe

```text
PÉRIMÈTRE : supabase/functions/delete-account/, report-bug/, renewal-notice/, et tout
supabase/functions/_shared/ qu'elles consomment. Les 4 fonctions Stripe ont déjà été auditées le
2026-09-02 (findings S-1 à S-6 de faille.md) : ne les refais pas, mais LIS ces six findings
d'abord, ce sont les familles à chercher ici.

POURQUOI MAINTENANT : ces trois fonctions n'ont jamais été relues. La ligne « 0 finding ouvert »
de faille.md a valu pour les fonctions Stripe jusqu'au jour où quelqu'un les a lues, et il y en
avait six. delete-account porte le droit à l'effacement (RGPD art. 17) et tourne en service_role,
donc HORS RLS : une erreur y est une fuite ou une donnée non effacée, pas un bug d'écran.

QUESTIONS AUXQUELLES L'AUDIT DOIT RÉPONDRE, une par une, preuve à l'appui :

1. Une lecture qui DÉCIDE d'un routage avale-t-elle son erreur ? (famille S-1 / S-2 : une panne de
   lecture devenait « pas d'utilisateur » ou « jamais traité »). En cas de doute, il faut
   relancer, jamais deviner.
2. delete-account efface-t-il RÉELLEMENT tout ce que le registre art. 30 dit qu'il efface ?
   Compare la liste des tables portant user_id en prod (requête d'introspection) à ce que la
   fonction touche. Le fichier avatar dans le bucket PUBLIC était un trou trouvé le 2026-09-02.
   ⚠️ payment_records ne doit PAS être touché, et le commentaire qui l'explique doit être là.
3. L'autorisation est-elle dérivée du bon champ ? Un appelant peut-il faire agir la fonction sur
   l'identité d'un autre (paramètre de corps, en-tête, JWT non vérifié) ?
4. Les gardes sont-elles conditionnelles à la présence de leur propre secret ? Le motif
   `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n'est pas
   posé. Ce bug exact a été introduit puis corrigé dans renewal-notice le 2026-08-26 : vérifie
   qu'il n'est pas revenu, et cherche ses cousins.
5. Idempotence : que se passe-t-il si le fournisseur rejoue l'appel ? renewal-notice écrit une
   preuve (renewal_notices), report-bug envoie un email.
6. Un message d'erreur brut du fournisseur (Resend, Postgres) peut-il remonter à l'appelant ?
7. CORS et origines autorisées : quelles origines peuvent appeler chaque fonction, et est-ce
   volontaire ?

MÉTHODE : lecture de code + sondes réelles. Tu peux appeler les fonctions déployées en prod avec
des entrées invalides (mauvaise signature, secret absent, identité d'un tiers) : ce sont des
chemins d'échec, ils ne modifient rien. Ne joue AUCUN appel qui supprime un compte réel.

⚠️ Une Edge Function modifiée dans le dépôt n'est PAS déployée par un push : elle passe par
`supabase functions deploy`. Dis-le explicitement dans ton rapport pour chaque correctif livré.
```

---

## A-2 · `src/modules` : repositories, hooks, parité démo ↔ Supabase

```text
PÉRIMÈTRE : tout src/modules/ (une vingtaine de modules). La revue du 2026-09-02 portait sur
src/pages et src/lib : les modules n'ont jamais été relus en tant que tels.

POURQUOI MAINTENANT : c'est là que vivent DEUX implémentations qui doivent se comporter pareil
(local.repository.ts et supabase.repository.ts), et c'est là que se cache la classe de bug la plus
silencieuse du produit : une clé React Query mal invalidée, donc un écran qui cesse de se
rafraîchir sans que rien n'échoue.

QUESTIONS, par module :

1. PARITÉ. Pour chaque méthode d'un repository, les deux implémentations rendent-elles la même
   FORME et la même sémantique ? Les pièges déjà rencontrés : agrégats présents en Supabase et
   absents en local (habits : streak, completionsTotal, firstCompletionDate, avec repli JS
   attendu), tri, valeurs par défaut, gestion du « non trouvé ».
2. INVALIDATIONS. Pour chaque mutation, quelles clés sont invalidées, et est-ce SUFFISANT ?
   Cherche les clés qui ne portent plus de donnée (mig. 129 a fondu cinq lectures d'organisation
   en une : invalider une ancienne sous-clé ne rafraîchit plus rien, EN SILENCE).
3. ÉCRITURES. Toute écriture passe-t-elle par un mapToDb en liste blanche ? Un champ interdit
   (user_id, recurrence_parent_id, id) peut-il entrer par le payload ? Rappel du contrat :
   l'identifiant de restauration passe par le SECOND argument de create(), jamais par le payload
   (src/lib/restore-id.ts), parce qu'un id forgé ouvre un oracle d'existence.
4. LECTURES DE LISTE. Passent-elles par les RPC obligatoires ? get_my_tasks, get_my_team_tasks,
   get_my_team_projects, get_my_team_task_dependencies, get_my_habits, get_my_org_inbox. Un
   `.from()` direct sur ces tables est un Seq Scan global (ou un prédicat-fonction par ligne).
   Exceptions légitimes : getById, insert, update, delete, et task_dependencies personnelles.
5. LES 36 `eslint-disable react-hooks/exhaustive-deps` (28 fichiers, item C-06). Traite ceux qui
   sont dans src/modules : chacun est soit supprimable, soit à justifier par un commentaire disant
   pourquoi la dépendance absente ne peut pas périmer la valeur.
6. CODE MORT. Un hook ou une primitive sans consommateur n'est pas seulement inutile, il est NON
   ÉPROUVÉ : useUser était mort et cachait un bug de parcours démo, MobileHeader n'avait jamais
   fonctionné en un mois. Compte les consommateurs, ne suppose pas.

MÉTHODE : lecture systématique, plus des tests qui EXÉCUTENT les deux repositories sur le même
scénario quand la parité est en doute. Le mode démo est en localStorage : il n'émet aucune
requête, donc un comptage d'appels y est possible avec un mock, mais un gain réseau ne s'y mesure
pas.
```

---

## A-3 · Accessibilité manuelle : clavier, modals, /agenda, VoiceOver iOS

```text
PÉRIMÈTRE : les quatre audits que docs/ACCESSIBILITY.md déclare « jamais faits », plus le
calendrier COSMO devenu depuis le composant de saisie de date sur six surfaces.

POURQUOI MAINTENANT : un tiers de WCAG est invisible pour axe-core, et le dépôt vient d'en faire
la démonstration. Le 2026-08-30, on a découvert que les flèches ne déplaçaient PAS le focus dans
le calendrier : `Button` n'était pas un forwardRef (la source shadcn amont vise React 19, ce projet
est en React 18), donc `ref.current?.focus()` ne faisait rien. Aucune gate ne pouvait le voir.

CE QU'IL FAUT PARCOURIR, au clavier UNIQUEMENT (débrancher la souris mentalement) :

1. Les modals : focus trap à l'ouverture, retour du focus au déclencheur à la fermeture, ESC,
   aria-modal, et le cas des DEUX dialogues superposés (le sélecteur de dépendances ouvre un
   second Dialog, un getByRole('dialog') nu y devient ambigu).
2. Le calendrier COSMO (DatePicker / DateCalendarPanel) : entrer, naviguer aux flèches, changer de
   mois, choisir, sortir. Sur les six surfaces, dont les DEUX entrées de MENU qui l'ouvrent sans
   champ d'ancrage (report en masse, deadline de la barre de sélection) : là, le focus a déjà
   produit une course entre le menu Radix et le DismissableLayer.
3. /agenda (FullCalendar) : pattern ARIA non trivial, jamais audité. Dis ce qui est atteignable et
   ce qui ne l'est pas, sans chercher à tout réparer.
4. Les bottom-sheets mobiles, sous prefers-reduced-motion RÉELLEMENT émulé.
5. VoiceOver iOS sur un vrai appareil si tu en as un ; sinon dis-le et ne simule pas.

À VÉRIFIER AUSSI, c'est bon marché et c'est écrit comme « le prochain geste » depuis le 08-24 :
faire passer la gate axe-core de `critical` à `serious` (e2e/a11y-audit.spec.ts). Les violations
serious sont déjà dumpées dans test-results/a11y/ : chiffre-les d'abord, corrige, puis durcis.

⚠️ PIÈGE DE MESURE : quand le panneau navigateur n'est pas affiché, la page ne compose pas de
frames, les transitions CSS ne progressent pas, et getComputedStyle rend des valeurs initiales.
Toute mesure visuelle se fait panneau AFFICHÉ, et le harnais doit refuser de conclure si sa propre
page ne peint pas.
```

---

## A-4 · Un vrai téléphone (iOS Safari, Android)

```text
PÉRIMÈTRE : le produit connecté sur un appareil RÉEL. docs/MOBILE.md porte une note de 76/100 qui
n'a AUCUNE mesure hors viewport émulé : tout vient d'un navigateur de bureau redimensionné.

POURQUOI MAINTENANT : les pièges documentés dans MOBILE.md (WebKit, 100vh, clavier virtuel,
scroll d'un conteneur qui n'est pas window) viennent tous de bugs qui ne se voyaient pas en
émulation. Et deux écrans neufs sont arrivés sans jamais avoir été ouverts sur un téléphone :
FirstRunSetup (l'accueil d'un compte vide, monté dans Layout donc mobile aussi) et le calendrier
COSMO.

CE QU'IL FAUT OUVRIR ET FAIRE, en mode démo puis sur un vrai compte :

1. FirstRunSetup, les trois étapes, y compris « passer » : le clavier virtuel masque-t-il le champ
   ou le bouton ? La création se fait-elle bien à chaque étape validée ?
2. Les bottom-sheets : MobileMoreSheet (seul accès mobile à OKR, Statistiques, Paramètres et
   déconnexion), les feuilles de tâche, d'événement, d'habitude. Ouvrir, glisser, fermer.
3. La barre d'onglets entreprise : sept destinations pour 335 px visibles, avec un lien profond
   ?tab=members, qui doit ramener l'onglet ACTIF dans le champ.
4. Les deux input[type=date] natifs volontairement conservés (EventModalForm) : la roue système
   doit bien être ce qui s'ouvre, et la date choisie doit être le jour choisi (la conversion
   jour ↔ instant est le bug R-01, corrigé le 2026-09-02 : vérifie-le sur un appareil réglé sur un
   fuseau à décalage NÉGATIF, c'est là que ça cassait).
5. La landing : c'est la seule page lente du site (56-63 de performance en CI). Sur un téléphone
   réel, dis ce que ça donne, avec la référence de l'appareil et du réseau.
6. prefers-reduced-motion activé dans les réglages système : rien ne doit rester hors écran.

LIVRABLE PARTICULIER : chaque finding porte le MODÈLE, la version d'OS et le navigateur. Un bug
mobile sans ces trois informations n'est pas reproductible. Si tu n'as accès à aucun appareil
réel, dis-le et n'invente pas de mesure : l'audit devient alors « à refaire », pas « fait ».
```

---

## A-5 · La seconde moitié de `src/components`

```text
PÉRIMÈTRE : src/components/, hors ce que la revue du 2026-09-02 a déjà traité. Commence par lire
le commit 8f2a6e8 : il liste ses 16 points, et il s'est arrêté avec la journée, pas avec le
dossier.

POURQUOI MAINTENANT : la première moitié a rendu 16 findings, dont deux qui ROUVRAIENT un risque
que le lot était censé fermer (supprimer deux catégories dans la même sauvegarde, la seconde
servant de destination à la première ; « Annuler » qui restituait la catégorie mais laissait les
éléments déplacés). La densité de la seconde moitié n'a aucune raison d'être plus faible.

CE QU'IL FAUT CHERCHER, ce sont les familles trouvées la première fois :

1. Une action destructive qui n'annonce pas son impact, ou qui l'annonce puis fait autre chose.
2. Un « Annuler » qui ne restaure pas l'état exact (identifiant compris, cf. src/lib/restore-id.ts
   et l'item C-01 de a-faire-code.md : les complétions de KR ne reviennent pas).
3. Un échec de sauvegarde AVALÉ : une mutation qui échoue sans que l'écran le dise.
4. Des requêtes qui partent alors que le composant n'est pas visible (une modale fermée qui charge
   quand même).
5. Une confirmation de suppression qui existe en double, deux composants pour le même geste.
6. Du texte affiché hors catalogue i18n. `npm run i18n:scan -- --list` dit lesquels ; le seuil est
   à 25 et il doit DESCENDRE, jamais monter.
7. Un composant qui porte une allowlist de sécurité sans aucun test (RichText était dans ce cas).
8. Un état de chargement rendu comme une vérité : `const { data = [] }` sans lire isLoading affiche
   « Aucun élément » pendant le premier fetch.

MÉTHODE : lire, puis OUVRIR l'écran. Les deux findings les plus coûteux de la campagne du 09-02
ont été trouvés en regardant (quatre liens qui rendaient une 404 en anglais, un compteur d'étapes
qui affichait « Étape {current} sur {total} »), et aucune gate ne pouvait les voir.
```

---

## A-6 · Faisabilité React 19 + `react-router` 8

```text
PÉRIMÈTRE : une ÉTUDE, pas une migration. Le livrable est un plan chiffré, pas une PR qui migre.

POURQUOI MAINTENANT : c'est la seule sortie d'une double contrainte de sécurité, et c'est déjà la
cause d'un bug livré. faille.md § « à planifier » : GHSA-qwww-vcr4-c8h2 vise react-router
>= 7.12.0 < 8.3.0 (CSRF en mode RSC, inapplicable dans une SPA Vite), mais rétrograder en 7.11.0
RÉINTRODUIRAIT l'open redirect GHSA-wrjc-x8rr-h8h6. Aucune version ne ferme les deux familles sous
React 18. ❌ Ne lance JAMAIS `npm audit fix` sur ce paquet.

CE QUE L'ÉTUDE DOIT RENDRE :

1. L'inventaire des ruptures React 19 qui touchent CE code : refs comme props ordinaires (c'est ce
   qui a tué le focus clavier du calendrier, cf. C-19), useEffect en StrictMode, les types, et les
   paires de dépendances qui devront bouger ensemble (framer-motion, radix, recharts,
   @tanstack/*, FullCalendar, @stripe/react-stripe-js).
2. La liste des composants de src/components/ui/ recopiés depuis shadcn, avec pour chacun : version
   amont visée, écart avec la nôtre, et s'il reçoit un ref. `Button` a été corrigé ; rien ne dit
   qu'il était le seul, et le symptôme est SILENCIEUX.
3. Les ruptures react-router 7 → 8 sur nos usages : basename porté par la locale (figé au montage,
   cf. src/i18n/bootstrap.ts), lazy routes, ErrorBoundary, et les slugs localisés.
4. Un chiffrage honnête (jours), un ordre d'exécution, et les points où la migration peut être
   coupée en deux PR.
5. Ce qui doit rester vrai après : src/lib/no-open-redirect.test.ts vert, aucune navigation
   alimentée par un paramètre d'URL non assaini (src/lib/safe-redirect.ts, 21 tests d'attaque).

Tu peux créer une branche jetable pour mesurer ce que `npm install` propose et ce que tsc casse,
mais NE POUSSE PAS de migration. Le livrable va dans docs/, et son résumé dans a-faire-code.md.
```

---

## A-7 · Les chemins d'erreur du client

```text
PÉRIMÈTRE : ce que voit l'utilisateur quand quelque chose casse. Transverse : pages, modals,
formulaires, mutations, boundaries.

POURQUOI MAINTENANT : le finding R-10 du 2026-09-02 a trouvé un message d'erreur BRUT affiché à
l'écran, en contradiction avec une règle (« faille V7 ») que le fichier fautif citait lui-même dans
un commentaire. Personne n'a vérifié les autres. Et le 2026-09-01, l'écran d'enrôlement TOTP levait
en phase de rendu : l'utilisateur voyait « Une erreur inattendue s'est produite » au lieu du QR
code, /admin est resté inaccessible deux jours, et un seul compte au monde ouvre cette console.

QUESTIONS :

1. Où un message d'erreur de Supabase, Postgres, Stripe ou Resend peut-il arriver tel quel à
   l'écran ? Un code d'erreur brut est une fuite d'information et une impasse pour l'utilisateur.
2. Où un throw peut-il se produire en PHASE DE RENDU ? C'est le cas qui remonte à
   AppErrorBoundary et donne un écran générique sans cause. Cherche les fonctions appelées
   directement dans le corps d'un composant qui supposent une forme (`x.match`, `data.a.b`,
   destructurations de réponses d'API).
3. Toute réponse d'API dont on lit un champ est-elle validée À LA FRONTIÈRE ? La correction du
   09-01 est le modèle : rejeter explicitement (`mfa_enrol_malformed_response`) plutôt que laisser
   une lecture optimiste exploser plus loin.
4. Une mutation qui échoue le DIT-elle toujours ? Cherche les catch vides, les .catch(() => {}),
   et les toasts d'erreur absents.
5. Les erreurs sont-elles identifiées par leur CODE et jamais par leur message français ? Le
   message est traduit ; un test qui compare une phrase recopiée devient rouge à la première
   traduction (six assertions étaient dans ce cas le 2026-09-03).
6. Que voit un utilisateur DÉCONNECTÉ en cours de session, ou hors ligne ?

MÉTHODE : provoque les pannes, ne les imagine pas. Coupe le réseau dans le navigateur, force des
réponses 500 et des corps malformés, ouvre les écrans. Chaque finding porte la capture de ce que
l'utilisateur voit.
```

---

## A-8 · Le fil principal de la landing

```text
PÉRIMÈTRE : la page / (parcours perso) et /entreprise-presentation. Objectif : attribuer, puis
supprimer, les 546 à 1 633 ms de blocage du fil principal. C'est l'item C-12 de a-faire-code.md et
la tâche T-51 de docs/ROADMAP-60J.md.

CE QUI EST DÉJÀ MESURÉ, et qu'il ne faut pas refaire :

- / est à 56-63 de performance en CI, le blog et le guide à 96-98 SUR LE MÊME BUILD. Ce n'est pas
  le socle, c'est la page.
- Les annotations du job lighthouse (run 33656961480, deux passes) donnent : vendor-animation
  11 675 / 11 992 ms de bootup sur /, vendor-gsap 11 679 / 10 727 ms, à ÉGALITÉ. vendor-react suit
  vers 9 000 ms.
- Le chiffre décisif : le MÊME vendor-animation ne coûte que 228-270 ms sur /guide/, soit 40× moins.
  Le chunk n'est pas cher, c'est la quantité de travail que la landing lui demande.
- vendor-sentry n'apparaissait dans aucun top 3, et cette absence NE PROUVE RIEN : ce build de CI
  était construit sans VITE_SENTRY_DSN, donc aveugle à Sentry. C'est l'item C-13, à trancher avec
  une mesure faite AVEC la variable posée.

CONTRAINTE DE MÉTHODE, elle est le cœur de cet audit : LA MESURE LOCALE NE VAUT RIEN ICI. Sur un
poste de dev, la landing (55 en CI) et le guide (96 en CI) rendent le même score, la charge machine
dominant tout. `npm run profile:landing` ne sert qu'à comparer un AVANT / APRÈS sur LA MÊME page.
Toute attribution entre deux pages vient du runner, via le job lighthouse et ses annotations.

CE QU'IL FAUT RENDRE :

1. Qui fait le travail : combien d'animations sont montées au premier rendu, combien de
   ScrollTrigger, combien d'observateurs, et ce qui s'exécute avant le premier paint.
2. Ce qui peut attendre : rien de ce qui est sous la ligne de flottaison ne doit coûter au premier
   rendu.
3. Un avant / après pris sur le runner, deux passes chacun.

⚠️ RÈGLES DE LA LANDING À NE PAS CASSER (elles viennent de deux régressions) :
- l'entrée du hero perso est en CSS, pas en GSAP, et chaque règle n'a qu'un `from`, donc l'état
  final est l'état par défaut : une animation qui ne joue pas laisse le contenu VISIBLE ;
- ne jamais remettre SplitText sur le H1 (bg-clip-text ne survit pas aux transforms des enfants,
  le dégradé s'affichait en bleu plat) ;
- la route / a son propre squelette SOMBRE (LandingSkeleton), jamais le PageLoader clair ;
- les tarifs viennent de ENTERPRISE_PRICING_TIERS, jamais en dur, et ne sont pas animés.
```
