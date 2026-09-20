import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — tests E2E critiques pour COSMO.
 *
 * Lance sur Chromium uniquement par défaut (gain de temps en CI).
 * Pour tester iOS Safari, ajouter le project "webkit-mobile" via flag.
 *
 * Le test reuseExistingServer permet de lancer les tests sans avoir à
 * redémarrer le dev server entre runs.
 */
export default defineConfig({
  testDir: './e2e',
  // Uniquement les *.spec.ts : e2e/rls/*.test.ts sont des tests Vitest
  // (vitest.integration.config.ts) que Playwright ne doit pas collecter.
  testMatch: '**/*.spec.ts',
  // 120 s : le tout premier test paie la compilation Vite à froid de l'app
  // (≈46k LOC : LandingPage + GSAP, puis DashboardPage + recharts, lazy tous
  // les deux). 60 s ne suffisaient plus — le clic sur le CTA démo lui-même
  // restait bloqué pendant la compilation et le test expirait DANS la fixture,
  // ce qui donnait un faux « sélecteur cassé ». Les tests suivants (serveur
  // chaud) tournent en 3-10 s, donc ce plafond ne masque aucune lenteur réelle.
  timeout: 120_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // mode démo partage localStorage → exécution séquentielle
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // 🔴 C-95 · LES RÉFÉRENCES VISUELLES SONT PAR PLATEFORME, et c'est le
  // réglage sans lequel la garde ne peut pas exister. Le rendu des polices
  // diffère entre Windows et Linux bien au-delà du seuil de tolérance : une
  // référence produite sur un poste de développement rendrait le job CI rouge
  // sur CHAQUE capture, et la réponse serait de désarmer la garde.
  // Seules les références `linux` comptent ; elles sont produites par la CI
  // (`.github/workflows/visual.yml`).
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  use: {
    // baseURL aligné sur le script `npm start` (port 3000 réseau)
    // pour réutiliser un dev server existant sans en redémarrer un.
    // Override via PLAYWRIGHT_BASE_URL si besoin.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    // ─── Locale du navigateur : française, comme l'utilisateur cible ───
    //
    // Sans ça, Chromium et WebKit annoncent `en-US`. Depuis la phase 2 i18n,
    // la racine `/` redirige alors vers `/en/` et la landing rend en anglais —
    // or toutes les fixtures et la plupart des sélecteurs sont écrits en
    // français (« Essayer maintenant — sans inscription »). Résultat : les ~55
    // tests passant par le mode démo échouaient dans la fixture, sur les deux
    // projets, avec un `TimeoutError` qui ressemblait à un sélecteur cassé.
    //
    // L'app est 100 % française (cf. CLAUDE.md) : un navigateur francophone est
    // la configuration NORMALE, pas un cas particulier. Les tests qui vérifient
    // la détection automatique de langue (e2e/i18n-routing.spec.ts) surchargent
    // eux-mêmes `navigator.language` via `addInitScript` — ils restent donc
    // indépendants de ce réglage, et c'est ce qui rend ce défaut sans danger.
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // `retain-on-failure` ENREGISTRE tout et jette après coup : chaque test paie
    // la capture, et la fermeture du contexte attend le flush du .webm. Mesuré
    // sur cette machine : fixture démo à 12,8 s sans vidéo contre 55,4 s avec,
    // plus 21 s de flush — soit un test à 3 min au lieu de 30 s, et un budget
    // vidéo de ~30 min sur les 82 tests.
    // `on-first-retry` s'aligne sur `trace` : rien en local (retries=0), et une
    // vidéo en CI (retries=2) sur la 2ᵉ tentative d'un test qui échoue — donc
    // la même valeur de diagnostic là où on en a besoin, sans la taxe partout.
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // ⚠️ `_warmup-mobile` est le prealable de chauffe de `mobile-safari`, pas
      // un test du produit. L'inclure ici gonflerait le compte de ce project
      // d'un cas qui ne mesure rien, et ferait payer deux fois la meme chauffe.
      testIgnore: [
        '**/stubbed/**',
        '**/_warmup-mobile.spec.ts',
        // C-97 : specs qui n'ont de sens que sur un appareil mobile emule
        // (paysage, texte agrandi, CPU bride). Les jouer en Desktop Chrome
        // mesurerait un viewport de bureau sous un nom qui dit « mobile ».
        '**/mobile-android.spec.ts',
        // C-95 : la regression visuelle a son PROPRE project (`visual`), pour
        // deux raisons. Ses references sont lourdes et par plateforme, donc
        // elle ne doit tourner que la ou on sait les regenerer ; et un rouge
        // visuel ne veut pas dire la meme chose qu'un rouge fonctionnel — le
        // melanger aux parcours rendrait le job `e2e` illisible.
        '**/visual-regression.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // ─── Le prealable de chauffe, avant les parcours WebKit ─────────
    //
    // 🔴 Meme motif que `supabase-stub-warmup`, pour le serveur du port 3000 :
    // le cout de compilation a froid de Vite tombait entierement sur le premier
    // cas execute. Rejoue depuis un poste le 2026-09-14, SEPT des neuf premiers
    // echecs de ce project etaient des attentes de fixture qui expirent, le CTA
    // de la landing n'etant pas visible dans les 30 s contre un serveur de
    // DEVELOPPEMENT. La meme page chargee depuis la PRODUCTION, meme moteur,
    // meme appareil emule, rend `load` en 2 159 ms.
    //
    // ⚠️ En CI ce cout est souvent INVISIBLE : `workers: 1` fait passer
    // `chromium` avant, qui a deja chauffe le port 3000. Le jour ou l'on joue
    // `mobile-safari` seul, la facture entiere retombe sur son premier cas. Un
    // prealable explicite est la seule forme qui ne depende pas de l'ordre.
    {
      name: 'mobile-safari-warmup',
      testMatch: '**/_warmup-mobile.spec.ts',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'mobile-safari',
      // ─── Deux specs ne sont PAS jouées ici, et il faut dire pourquoi ───
      //
      // `demo-calendar` et `demo-task-dependencies` visent un DOM qui n'est
      // pas forké par viewport : le panneau de calendrier et la popup de
      // dépendances sont exactement les mêmes composants sur les deux. Ce qui
      // diffère, c'est la NAVIGATION pour y arriver — et sur `/tasks` en
      // 390 px, mesuré le 2026-09-05, les commandes qui y mènent n'existent
      // pas : ni « Tout replanifier » (bandeau des tâches en retard), ni
      // « Sélectionner » (barre d'actions groupées), et la carte mobile n'a
      // pas de menu de ligne équivalent. Les jouer ici mesurerait la
      // navigation deux fois et le calendrier zéro fois de plus.
      //
      // 🔴 Ce n'est PAS un constat que tout va bien sur mobile : c'est un
      // écart de produit, noté comme tel dans `docs/TESTING.md`. Un `skip`
      // silencieux l'aurait fait disparaître ; cette liste le nomme.
      testIgnore: [
        '**/stubbed/**',
        '**/demo-calendar.spec.ts',
        '**/demo-task-dependencies.spec.ts',
        // C-97 : ce spec bride le CPU par CDP (`Emulation.setCPUThrottlingRate`),
        // un protocole que WebKit n'expose pas. Il appartient a `mobile-chrome`.
        '**/mobile-android.spec.ts',
        // C-95 : project `visual`, cf. son commentaire dans `chromium`.
        '**/visual-regression.spec.ts',
        // Son propre prealable : joue par le project `mobile-safari-warmup`,
        // dont celui-ci depend. L'inclure ici le rejouerait en plein milieu.
        '**/_warmup-mobile.spec.ts',
      ],
      dependencies: ['mobile-safari-warmup'],
      use: { ...devices['iPhone 12'] },
    },
    // ═══ C-95 · RÉGRESSION VISUELLE ════════════════════════════════
    //
    // 🔴 POURQUOI UN PROJECT À PART, et pas quelques cas dans `chromium` :
    //   · ses références sont des IMAGES, lourdes et PAR PLATEFORME. Une
    //     référence produite sous Windows ne vaut rien pour un runner Linux,
    //     les polices n'étant pas les mêmes (cf. `snapshotPathTemplate`) ;
    //   · un rouge visuel ne veut pas dire la même chose qu'un rouge
    //     fonctionnel : le premier dit « ça a changé », le second « c'est
    //     cassé ». Les mêler rendrait le job `e2e` illisible, et une garde
    //     illisible finit désarmée.
    //
    // ⚠️ `deviceScaleFactor: 1` explicite : un facteur non entier fabrique du
    // bruit sub-pixel à chaque capture, et c'est la première cause de garde
    // visuelle abandonnée.
    {
      name: 'visual',
      testMatch: '**/visual-regression.spec.ts',
      dependencies: ['mobile-safari-warmup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },

    // ═══ C-97 · ANDROID, PAYSAGE, TEXTE AGRANDI, CPU BRIDÉ ══════════
    //
    // 🔴 CE QUI MANQUAIT, vérifié le 2026-09-20 : un seul modèle de téléphone
    // (iPhone 12), un seul moteur (WebKit), aucun Android. Or Chrome Android
    // est le premier navigateur mobile du marché, et rien de ce que le dépôt
    // mesure en mobile ne tournait dessus. Ni paysage, ni grande taille de
    // police système, ni CPU bridé.
    //
    // ⚠️ LE BRIDAGE CPU EST LE POINT QUI COMPTE, et c'est lui qui impose le
    // moteur. C-68 (fil principal bloqué 3 637 ms sur 4 000) a été trouvé À LA
    // MAIN parce qu'aucun project ne bride quoi que ce soit : un émulateur qui
    // tourne à pleine vitesse sur un runner ne reverra jamais cette classe de
    // défaut. `Emulation.setCPUThrottlingRate` passe par CDP, que seul
    // Chromium expose — c'est donc `mobile-chrome`, et pas `mobile-safari`,
    // qui peut porter ce cas. Les deux projects ne sont pas redondants : ils
    // répondent à deux questions différentes.
    //
    // ⚠️ CE QUE CE PROJECT NE FAIT PAS : il ne rejoue PAS toute la suite sur
    // un second moteur. Il joue `mobile-android.spec.ts`, plus les deux specs
    // qui mesurent une propriété du RENDU mobile et non un parcours
    // (`touch-targets`, `reduced-motion-sheets`). Rejouer les ~40 parcours de
    // démo une troisième fois tripleraient le job `e2e` pour re-mesurer des
    // sélecteurs identiques ; le coût s'écrit ici plutôt que de se cacher
    // derrière un `--project` de plus.
    //
    // Même préalable de chauffe que `mobile-safari`, et pour la même raison :
    // le coût de compilation à froid de Vite tombe sinon entièrement sur le
    // premier cas exécuté.
    {
      name: 'mobile-chrome-warmup',
      testMatch: '**/_warmup-mobile.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-chrome',
      // 🔴 UN SEUL SPEC, ET C'EST UNE DÉCISION MESURÉE, pas un repli.
      //
      // La première écriture y ajoutait `touch-targets` et
      // `reduced-motion-sheets`, pour « rejouer le mobile sur un second
      // moteur ». Les deux ont été jouées le 2026-09-20, et le résultat
      // tranche :
      //
      //   · `reduced-motion-sheets` : 3 échecs, tous des `locator.click` qui
      //     expirent. ⚠️ ET CE N'EST PAS UN ARTEFACT DU PIXEL 7 : les MÊMES
      //     trois cas échouent sur `mobile-safari` dans la CI de `main`
      //     (run 35532009156, 2026-09-20). Ils sont donc cassés sur les deux
      //     moteurs mobiles, indépendamment de ce project. Les faire porter
      //     par un project neuf aurait attribué à C-97 une dette qui ne lui
      //     appartient pas — ils sont suivis sous **C-111**.
      //
      //   · `touch-targets` : 3 échecs — et ils sont VRAIS. Rejoués sous
      //     `chromium` (même viewport 375 px), ils échouent À L'IDENTIQUE :
      //     ce sont des défauts du PRODUIT, présents sur `main`, qu'aucun de
      //     mes changements n'a causés. Les faire porter par ce project neuf
      //     aurait attribué à C-97 une dette qui ne lui appartient pas.
      //     Ils sont nommés dans `a-faire-code.md` sous **C-111**, avec leur
      //     mesure.
      //
      // ❌ Ne pas relire cette liste comme « le mobile Android est couvert ».
      //    Elle couvre ce que WebKit NE PEUT PAS couvrir : le bridage CPU par
      //    CDP, le paysage et la police système à 200 %.
      testMatch: ['**/mobile-android.spec.ts'],
      dependencies: ['mobile-chrome-warmup'],
      use: { ...devices['Pixel 7'] },
    },

    // ─── Parcours HORS mode démo ────────────────────────────────────
    //
    // Les deux projects ci-dessus passent tous par `e2e/fixtures.ts`, donc par
    // le mode démo — c'est ce qui rend la suite instantanée et sans réseau.
    // Mais toute garde qui commence par `!isDemo` est alors STRUCTURELLEMENT
    // hors de portée : `FirstRunSetup` n'est pas resté sans parcours par
    // oubli, il l'est resté parce qu'aucun test ne pouvait l'atteindre.
    //
    // Ce project sert l'app en mode Vite `e2e-stub` (`.env.e2e-stub`), c'est-à-
    // dire avec deux variables Supabase NON VIDES pointant un hôte inexistant,
    // que `e2e/supabase-stub.ts` intercepte. Un seul viewport : ce qu'on y
    // vérifie est un enchaînement d'écrans et un corps de requête, pas un
    // comportement responsive.
    // ─── Le prealable de chauffe, avant les parcours du stub ────────
    //
    // 🔴 Ce n'est pas un test du produit : c'est le cout de compilation a froid
    // du serveur `e2e-stub`, paye UNE fois, sous un nom qui le dit. Il tombait
    // jusque-la sur le premier cas execute, qui echouait seul pendant que les
    // onze autres passaient — cf. l'en-tete de `e2e/stubbed/_warmup.spec.ts`.
    // `supabase-stub` en depend : si la chauffe echoue, rien n'est joue.
    {
      name: 'supabase-stub-warmup',
      testMatch: '**/stubbed/_warmup.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3210' },
    },
    {
      name: 'supabase-stub',
      testMatch: '**/stubbed/*.spec.ts',
      testIgnore: '**/stubbed/_warmup.spec.ts',
      dependencies: ['supabase-stub-warmup'],
      // 🔴 240 s, contre 120 s pour les deux autres projects, et ce n'est pas
      // une rustine sur des tests lents. Ce serveur a son PROPRE cache de
      // dependances (`cacheDir: node_modules/.vite-e2e-stub`, cf.
      // `vite.config.ts`) : il ne peut plus profiter de celui que le serveur du
      // port 3000 a deja chauffe, donc le premier ecran demande a Vite de
      // pre-empaqueter tout ce qu'il touche. Mesure du 2026-09-08, cache vide :
      // les cinq cas de `first-run` expiraient a 120 s, tous, y compris le
      // dernier — apres dix minutes de serveur pourtant deja debout. Le tout
      // premier cas paie ensuite la compilation des sources de la page (et non
      // plus des dependances, pre-empaquetees par le `vite optimize` du
      // webServer) : mesure, 2,7 min pour lui seul, 10 s pour les suivants.
      //
      // ⚠️ Ce cache separe n'est pas negociable : partage, les deux serveurs
      // (dont les alias different par le mode) invalidaient chacun celui de
      // l'autre et se redemarraient en boucle, servant une page blanche.
      timeout: 360_000,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3210' },
    },
  ],
  webServer: [
    {
      // npm start lance vite sur 127.0.0.1:3000 — utilisé par les tests E2E.
      // reuseExistingServer évite de redémarrer si tu as déjà `npm start` ouvert.
      command: 'npm start',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // 🔴 `--mode e2e-stub` est la SEULE chose qui distingue ce serveur du
      // premier, et elle n'est pas cosmétique : Vite charge alors
      // `.env.e2e-stub` PAR-DESSUS `.env`, ce qui remplace les deux variables
      // Supabase vides par des valeurs non vides. Sans ça, l'app retombe en
      // mode démo automatique et les specs de `e2e/stubbed/` testeraient
      // exactement ce que les autres testent déjà.
      // ⚠️ Pas de `vite optimize` prealable ici, et c'est une decision mesuree
      // le 2026-09-08 : la commande est depreciee, elle prend 2 min 48 a elle
      // seule, et les deux serveurs pre-empaquetant en parallele depassaient
      // les 600 s d'attente du webServer. Le cout de chauffe est paye la ou il
      // est visible et borne : le project `supabase-stub-warmup`.
      command: 'npx vite --mode e2e-stub --host 127.0.0.1 --port 3210',
      url: 'http://127.0.0.1:3210',
      timeout: 120_000,
      // 🔴 Les deux variables sont repassées EXPLICITEMENT, en plus de
      // `.env.e2e-stub`, et ce n'est pas une ceinture-bretelles décorative :
      // le job `e2e` de la CI injecte `VITE_SUPABASE_URL` / `_ANON_KEY` depuis
      // les secrets du dépôt, et Vite donne la priorité à `process.env` sur un
      // fichier `.env.<mode>`. Sans cette surcharge, le jour où ces secrets
      // sont renseignés, ce serveur pointerait le VRAI projet Supabase et les
      // specs de `e2e/stubbed/` iraient parler à la production avec une
      // session forgée. L'hôte doit rester celui qui ne résout pas.
      env: {
        VITE_SUPABASE_URL: 'https://stub.cosmo.invalid',
        VITE_SUPABASE_ANON_KEY: 'e2e-stub-anon-key-not-a-secret',
      },
      // 🔴 `false`, contrairement au serveur de démo, et ce n'est pas un
      // réglage de confort. Ce dépôt a plusieurs sessions actives, chacune
      // capable de laisser un `vite` derrière elle : réutiliser un serveur
      // trouvé sur ce port ferait jouer les specs de `e2e/stubbed/` contre une
      // app en mode DÉMO, où l'écran qu'elles testent ne monte jamais. Elles
      // passeraient en mesurant la mauvaise boîte. Une collision de port doit
      // échouer bruyamment.
      reuseExistingServer: false,
    },
  ],
});
