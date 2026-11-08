> ⚠️ **ARCHIVE : décomptes e2e et récits de parcours, extrait de `docs/TESTING.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/TESTING.md`](../TESTING.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

### Décompte réel — mesuré le 2026-09-14 (`npx playwright test --list`)

**220 cas, 26 specs, 4 projects.**

| Project | Cas | Ce qu'il joue |
|---|---|---|
| `chromium` | **107** | Desktop Chrome, mode démo |
| `mobile-safari` | **96** | iPhone 12 / WebKit, mode démo |
| `supabase-stub` | **16** | Desktop Chrome, **hors mode démo** (cf. plus bas) |
| `supabase-stub-warmup` | **1** | Préalable de chauffe, pas un parcours (cf. plus bas) |

**Ce que la passe du 2026-09-14 a ajouté** : `e2e/stubbed/delete-org.spec.ts`
(4 cas), le parcours nominal de suppression d'entreprise — rembourser, résilier,
supprimer — exigé par **C-39** et jamais joué jusque-là. Il prouve l'ordre en
**retenant la réponse** de l'Edge Function : tant qu'elle ne part pas, aucune
`rpc/delete_organization` ne doit exister. Vu ROUGE sur une mutation de
`useDeleteOrgFlow` avant d'être commité.

✅ **La sonde jetable `e2e/_tmp-probe.spec.ts` est SUPPRIMÉE** (2026-09-14). Elle
était non suivie par git, rouge, et faussait de 2 cas tout recomptage local : la
commande affichait 212 quand le dépôt en portait 210, et l'écart devait être
expliqué à chaque mesure. Local et dépôt disent désormais le même nombre.
⚠️ Ce que cet écart enseignait reste vrai : **un décompte local qu'on recopie
sans regarder ce qui est SUIVI** est exactement la façon dont le précédent est
devenu faux.

⚠️ **`supabase-stub-warmup` n'est pas un parcours** : il compile les deux écrans
du harnais avant que les douze autres cas ne commencent. Le compter avec eux
gonflerait le total d'un test qui ne mesure pas le produit ; le taire ferait
réapparaître un écart entre `--list` et ce fichier. Il est donc compté à part.

**Mesures précédentes**, conservées pour montrer la dérive et pas pour être
recopiées : **190 cas, 23 specs, 3 projects** le 2026-09-05 ; et avant cela
« 62 × 2 = 124, 15/16 specs », qui datait du **2026-08-25** et a été **recopié**
pendant onze jours au lieu d'être remesuré — il était déjà faux de 44 cas et de
2 specs avant tout ajout de septembre. Un total qu'on recopie n'est pas une
mesure.

**Ce que cette passe a ajoutée, et elle seule** : le parcours de remboursement
(C-65, 5 cas, cf. plus bas) et son préalable de chauffe (1). Le reste de l'écart
avec le 2026-09-05 vient des autres chantiers de la fenêtre, et n'a pas été
attribué ligne par ligne — l'attribuer de tête est précisément ce qui produit un
chiffre faux qu'on recopie ensuite.

❌ **Ne jamais écrire ce total sous la forme « N × 2 ».** Les projects ne jouent
plus le même ensemble : `demo-calendar` et `demo-task-dependencies` sont hors de
`mobile-safari` (raison mesurée, cf. ci-dessous), et `e2e/stubbed/**` n'est joué
que par `supabase-stub`. Une multiplication redonnerait un chiffre faux, et
c'est exactement comme ça que le précédent l'est devenu.

Les 3 tests de `demo-touch-gestures.spec.ts` sont `skip` sur chromium
(viewport ≥ 768 px). La CI joue `chromium` **et** `supabase-stub` (mêmes
binaires Chrome) ; `mobile-safari` reste hors CI, WebKit coûtant une minute
d'installation de plus.

🔴 **Un project hors CI est un project qui ne tourne nulle part.** `supabase-stub`
a été ajouté au job `e2e` le 2026-09-05 en même temps que les specs qu'il porte :
sans ça, `FirstRunSetup` et le retour OAuth seraient des gardes posées sur `main`
qui ne s'exécutent jamais — la faute déjà commise deux fois ici.

---

#### C-65 — le parcours de REMBOURSEMENT (`e2e/stubbed/refund.spec.ts`, 5 cas) · ❌ retiré le 2026-11-01

> ⚠️ **Récit historique.** Le bouton « Résilier et être remboursé » et cette spec ont disparu le
> 2026-11-01 (`d765d9c5`) : aucun remboursement ne part plus de l'interface. Le parcours vivant
> est `e2e/stubbed/retractation.spec.ts` (rétractation 14 jours, résiliation en fin de période),
> doublé de `OrgBillingTab.retractation.parcours.test.tsx`. Le mécanisme de substitution du
> drapeau ci-dessous reste celui en usage.

C-27 exigeait nommément ce parcours : « C-65 touche de l'argent, il ne part pas
sans son parcours E2E ». Il manquait pour une raison **structurelle** : le bouton
n'est monté nulle part tant que `ENTERPRISE_BILLING_ENFORCED` vaut `false`, et le
mode démo rend `null` pour tout abonnement d'organisation.

🔴 **Le drapeau est retourné par une substitution de MODULE, jamais par une
variable d'environnement.** `vite.config.ts` remplace
`@/modules/billing/premium-config` par `e2e/stubs/premium-config.e2e-stub.ts`
**dans le seul mode `e2e-stub`** ; ce module réexporte le produit (`export *`) et
ne change qu'un booléen. C'est le même geste que le `vi.mock(…, importOriginal)`
du test unitaire, au niveau du bundler. Faire dériver le drapeau d'un
`import.meta.env` aurait cassé la règle écrite du dépôt — « le flag est la SEULE
condition » — dans le produit livré, pas seulement dans les tests.

Ce que les 5 cas prouvent, sur l'app réelle, avec le vrai routage et le vrai
catalogue :

| Cas | Ce qu'il mesure |
|---|---|
| mensuel | un seul appel à `stripe-org-refund`, authentifié, corps `{ orgId }` **sans aucun montant** ; montant affiché = celui du serveur ; résiliation visible **sans rechargement** ; plus aucun bouton pour recommencer ; zéro écriture cliente dans `org_subscriptions` |
| annuel | même chose au **prorata des mois entiers** restants |
| échec Stripe | le message dit « rien n'a été résilié », **aucun montant** n'est annoncé, et l'écran reste dans l'état d'avant — donc on peut réessayer |
| non-propriétaire | `?tab=billing` tapé à la main retombe sur l'aperçu, aucun appel ne part |
| témoin | rien n'a quitté le stub vers un vrai projet Supabase |

⚠️ **Les deux montants ne sont pas écrits à la main** : la spec importe
`supabase/functions/_shared/refund-amount.ts` — le module que l'Edge Function
appelle — et vérifie que l'écran affiche exactement ce qu'il décide. Un montant
en dur dans le test ferait de lui une **seconde définition** de la règle de
remboursement, exactement le risque qui a imposé `org-tiers.parity.test.ts`.
La spec épingle aussi la `reason` rendue (`monthly_full`, `yearly_prorata`), sans
quoi les deux cas pourraient mesurer la même branche sans que rien ne le dise.

🔴 **Ce que ce parcours NE prouve PAS, et qu'aucun test de ce poste ne peut
prouver** : `refunds.create`, l'ordre « rembourser d'abord, résilier ensuite », la
clé d'idempotence dérivée de l'`invoice_id`, le pré-contrôle qui retranche, et la
ligne compensatoire écrite par `stripe-webhook`. La clé Stripe du projet est une
clé de **test**, `org_subscriptions` est vide, il n'existe aucune facture à
rembourser, et `APP_URL` épingle l'origine CORS sur la production.
❌ **Ne pas déployer C-65 en s'appuyant sur ce fichier seul.**

⚠️ Le cas d'échec se lit deux fois : c'est le **stub** qui décide de ne rien
résilier, donc il ne mesure pas le serveur. Ce qu'il mesure est une propriété du
**client**, et elle n'était pas acquise : sur un échec, l'écran ne doit pas
anticiper une résiliation qui n'a pas eu lieu.

---

#### Les parcours ajoutés le 2026-09-05 (C-27)

| Spec | Cas | Ce qu'elle ferme |
|---|---|---|
| `stubbed/first-run.spec.ts` | 5 | `FirstRunSetup` : la garde s'ouvre sur un compte vide, **chaque étape écrit au moment où elle est validée** (mesuré sur les requêtes parties, pas sur un état React), la première tâche part sans échéance, l'accueil ne revient pas |
| `demo-calendar.spec.ts` | 7 | Le calendrier COSMO sur ses **six** surfaces, plus `minDate` du report en masse et le focus au clavier dans la grille (défaut React 18 / `forwardRef`) |
| `demo-task-dependencies.spec.ts` | 2 | Graphe **personnel** (mig. 132) : poser une arête et la relire, refuser un cycle **indirect à trois maillons**, ne jamais se proposer soi-même, retirer ; « Créer et lier » |
| `demo-billing-consent.spec.ts` | 1 | Facturation armée depuis la bascule live (`5bf21a50`) : prix TTC affichés, et aucun « Choisir ce palier » tant que les DEUX cases de rétractation ne sont pas cochées (S-6, L221-28). S'appelait `demo-billing-disarmed` et vérifiait l'inverse jusqu'au 2026-10-22 |

Les quatre premiers cas ont été **vus rouges avant d'être verts** : différer les
créations de `FirstRunSetup` à la dernière étape fait tomber le premier ; le
calcul du montant remboursé refait côté client fait tomber deux cas du parcours
de remboursement.

Les fichiers `e2e/rls/*.test.ts` ne sont **pas** des specs Playwright : ce sont
des tests Vitest d'intégration (`npm run test:rls`, job CI `rls-integration`,
stack Supabase locale). Ils sont **6** au 2026-08-25 : `tasks`, `get-my-tasks`,
`shared-tasks`, `org-helpers-not-exposed`, `org-subscriptions`, et
`org-permissions` (mig. 115).

**Architecture** :
- `e2e/fixtures.ts` : fixture `demoPage`. Clean localStorage/cookies → pose
  `cosmo_cookie_consent` → goto / → clic CTA « Essayer maintenant — sans
  inscription » → attend `/dashboard` → neutralise les flags
  `cosmo_tutorial_seen_*_(desktop|mobile)`.
- Tests smoke : `demo-create-task.spec.ts` (création réelle de bout en bout),
  `demo-toggle-habit.spec.ts`, `demo-create-okr.spec.ts` +
  `demo-journeys.spec.ts` (mutation + persistance SPA).

**Règles** :
- ✅ Naviguer via **clic sur les NavLink** (`navTo`) : ça teste au passage que le
  lien existe. `page.goto()` est néanmoins **sûr** — le mode démo est persisté
  (`cosmo_demo_active`, cf. `src/lib/app-mode.store.ts`) et `AuthContext` le
  restaure au reload. À utiliser pour une route sans lien de nav (ex. `/premium`
  quand `PREMIUM_ENFORCED=false`).
- ✅ `baseURL` aligné sur `npm start` (port **3000**). `reuseExistingServer: true`
  — ⚠️ **un serveur périmé qui squatte le port 3000 est réutilisé silencieusement**
  et fait échouer toute la suite. Vérifier le port avant d'incriminer une spec.
- ✅ Pas de sélecteur CSS `:has-text("..." i)` — utiliser `[data-sonner-toast][data-type="error"]`.
- ✅ **Toujours `filter({ visible: true })`** : desktop (`<table>`) et mobile
  (`TaskCard`) coexistent dans le DOM via `hidden md:block` / `md:hidden`, donc
  `.first()` résout volontiers un élément **caché**.
- ✅ `filter({ visible: true })` ≠ « dans le viewport ». Avant un geste
  `page.mouse` (qui ne scrolle PAS), appeler `scrollIntoViewIfNeeded()`.
- ✅ Cases de complétion de tâche : utiliser `TASK_TOGGLE*` de `fixtures.ts`.
  Desktop = `role="checkbox"`/`aria-checked`, mobile = `<button aria-pressed>` —
  **aucun rôle ARIA commun**, seul l'`aria-label` est partagé.
- ✅ Scoper au sheet (`[data-mobile-more-sheet]`) pour cliquer un item du menu
  « Plus » : la page reste montée derrière et ses contrôles matchent les mêmes noms.
- ⚠️ Le **toaster Sonner** (`z-index: 999999999`) couvre y≈16→90 sur mobile et le
  rappel « N en retard » ne se ferme pas seul : ne jamais cliquer un point fixe
  en haut de l'écran.
