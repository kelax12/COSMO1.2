# Prompt · audit de sécurité complet avant acquisition (2026-09-30)

> **Mode d'emploi.** Deux parties. La **partie A** est le constat du 2026-09-30 : les écarts
> entre la doc sécurité et la réalité (code, CI, production), chacun avec sa preuve. La
> **partie B** est le prompt à coller dans une nouvelle session. Il reprend la partie A comme
> points de départ, déjà mesurés.
>
> Mesures faites le 2026-09-30 au soir, **en lecture seule** : dépôt `main` (`530b01f4`), API
> GitHub (runs, CodeQL, Dependabot), MCP Supabase (`list_migrations`, `list_edge_functions`,
> `list_tables`, `get_advisors`). Aucune écriture nulle part.

---

## Partie A · incohérences constatées entre les `.md` et la réalité

Classées de la plus grave à la plus anodine. « Doc » = ce qui est écrit, « Réel » = ce qui a été
mesuré.

### 🔴 A-1 · `faille.md` n'a pas vu passer le mode entreprise des 160-205

- **Doc** : `faille.md` et `docs/SECURITY.md` ne sont plus touchés depuis le **2026-09-24**.
  La dernière mesure de la base citée date du 2026-09-22 : « **51 tables / 51 sous RLS /
  126 policies** », advisors « **10 / 53 / 2 / 1** ».
- **Réel** : **76 tables** dans `public` (toutes sous RLS, c'est rassurant), advisors
  **11 / 78 / 2 / 1**. Soit **+25 tables** et **+25 fonctions `SECURITY DEFINER` exécutables
  par `authenticated`**, qu'aucun audit de sécurité n'a jamais relues. Parmi elles, des fonctions
  qui déplacent des droits ou des données : `offboard_org_member`, `set_member_access`,
  `set_member_role`, `transfer_org_ownership`, `purge_team_task`, `purge_team_okr`,
  `create_org_email_invitations`, `insert_kr_checkin_row`, `enqueue_team_task_webhook`,
  `member_departure_impact`, `get_org_member_last_activity`, `get_org_billing_history`.
- **Conséquence** : la note **83/100** décrit un produit qui n'existe plus. Elle couvre à peu près
  les deux tiers de la surface actuelle.

### 🔴 A-2 · Quatre Edge Functions n'existent dans AUCUN document de sécurité

- **Doc** : partout « **huit** Edge Functions » (`faille.md`, `supabase/functions/CLAUDE.md`,
  `scripts/check-edge-smoke.mjs` : « Les huit fonctions déployées répondent »,
  `check-tooling-coverage.guard.test.mjs` : « les huit Edge Functions sont vues »).
- **Réel** : **12** fonctions déployées. `send-org-invite` (v1), `org-digest` (v2),
  `verify-org-domain` (v1), `org-webhook-dispatch` (v1) sont citées **0 fois** dans `faille.md`,
  `docs/SECURITY.md` et `supabase/functions/CLAUDE.md`. `check:edge-smoke` ne les sonde pas.
  Trois d'entre elles utilisent `SUPABASE_SERVICE_ROLE_KEY`, deux envoient des e-mails via
  Resend, une fait des requêtes HTTP sortantes vers des URL saisies par les clients.

### 🔴 A-3 · Les webhooks d'entreprise n'ont JAMAIS fonctionné (HTTP 401)

- **Doc** : `org-webhook-dispatch.yml` promet un envoi toutes les dix minutes.
  `supabase/config.toml` déclare `verify_jwt = false` pour `org-digest` et `renewal-notice`,
  les deux autres crons.
- **Réel** : `org-webhook-dispatch` est **absente de `config.toml`**, donc déployée avec
  `verify_jwt = true` (confirmé par l'API). Le workflow n'envoie que `x-cron-secret`, sans
  `Authorization` : la passerelle répond **401** avant le code. **Aucun run vert depuis la
  création** (5 derniers : échec, log `HTTP 401`). Un client qui configure un webhook ne reçoit
  rien, et la file `org_webhook_deliveries` gonfle. `stripe-org-refund` et `verify-org-domain`
  sont aussi absentes de `config.toml` (sans effet pour elles, elles veulent un JWT, mais la règle
  de `docs/SECURITY.md` « jamais déployer sans `config.toml` » n'est plus tenue).

### 🔴 A-4 · Le code facturation en production n'est pas celui du dépôt

- **Doc** : mémoire du 2026-09-25 « 2 Edge Functions à déployer ». Rien dans `faille.md`.
- **Réel** : `Edge deploy drift` est **rouge tous les jours** (dernier run 2026-09-30) sur
  **5 divergences** : `stripe-org-checkout` et `stripe-org-portal` (déployées le 2026-09-08,
  source modifiée le 2026-09-25, `_shared/org-billing-contact.ts` **absent de la prod**), et
  `report-bug` (dérive connue depuis le 09-21, `M-61`). Le rouge est devenu un bruit de fond,
  exactement ce que `supabase/functions/CLAUDE.md` interdit.

### 🔴 A-5 · Treize migrations n'ont aucune entrée au ledger

- **Doc** : mémoire « mig. 195-199 écrites, non appliquées » ; `faille.md` § Migrations
  « Repo au 2026-08-25 : 127 fichiers […] **Aucune migration en attente** ».
- **Réel** : 182 fichiers SQL. Sans entrée au ledger : `164`, `181`, `190`, `191`, `192`, `193`,
  `194`, `195`, `196`, `197`, `198`, `199`, `204`. Or les tables `team_project_members` (190),
  `org_saved_views` (192), `org_settings` et `org_verified_domains` (195), `team_custom_fields`
  (197), `team_automations` (198), `org_webhooks` (199) **existent en prod**. Donc appliquées
  hors ledger (angle mort D-1, qui a triplé), ou partiellement appliquées : **personne ne sait
  lequel**. `164`, `181`, `191`, `193`, `194`, `196`, `204` restent à vérifier objet par objet.

### 🟠 A-6 · SSRF probable sur les webhooks sortants (mig. `199`)

- **Doc** : `org-webhook-dispatch/index.ts` dit « une URL HTTPS publique ne doit pas pouvoir
  rebondir vers une adresse interne » et pose `redirect: 'manual'`.
- **Réel** : la contrainte `org_webhooks_url` filtre par **liste noire textuelle** :
  `localhost|127.|10.|192.168.|169.254.|0.|[`. Non couverts : `172.16.0.0/12`,
  `100.64.0.0/10`, IPv4 en notation entière ou hexadécimale (`https://2130706433/`,
  `https://0x7f000001/`, que le parseur WHATWG de `fetch` normalise en `127.0.0.1`), et surtout
  **tout nom DNS qui résout vers une IP privée** (`127.0.0.1.nip.io`, DNS rebinding). Latent
  tant que A-3 bloque l'envoi : **devient exploitable le jour où A-3 est corrigé**. À corriger
  AVANT A-3.

### 🟠 A-7 · La note affichée se contredit dans un même fichier

- `faille.md` titre : « **83 / 100** (… 2026-09-22 soir) · **VÉRIFIÉE inchangée le 2026-09-14
  au soir** ». Deux dates de vérification pour une note, dont une antérieure à la note.
- `docs/SECURITY.md` AM-1 : « La note de sécurité (**88**) vit dans `faille.md` ». Elle vaut 83.
- `faille.md` § Ordre de priorité, ligne 2 : « MFA sur le compte admin, allowlist OAuth, secure
  email change : ⏳ **en attente** ». Le tableau juste au-dessus dit ✅ FAIT pour les trois.
- Ligne 3 : « A-9 : plan Pro + PITR + **drill de restauration** : ⏳ en attente ». Le drill est
  fait depuis le 2026-09-01 (RTO 163 s), écrit dix lignes plus haut.
- En-tête : « Dernière vérification contre la prod : **2026-09-02** ». Il y en a eu le 09-14 et
  le 09-22.

### 🟠 A-8 · Alertes ouvertes : plus nombreuses que ce que la doc déclare

- **CodeQL** : doc « 9 alertes (5 high, 4 medium) », réel **11** (5 high, 6 medium).
  Les deux nouvelles : `actions/missing-workflow-permissions` sur `org-digest.yml` et
  `org-webhook-dispatch.yml`, les deux workflows créés après l'audit. `M-60` (triage) toujours
  ouvert.
- **Dependabot** : **8 alertes ouvertes** dont **1 high** (`undici`, contournement de validation
  TLS), aucune mentionnée dans `faille.md`. Toutes en `development`, donc hors bundle, mais
  `undici` sert aux scripts qui appellent la prod avec `SUPABASE_ACCESS_TOKEN`.

### 🟡 A-9 · Compteurs périmés dans `CLAUDE.md` racine

- « Les **36 gardes** (`check:*`, `i18n:*`, `validate:*`) » : `package.json` en porte **34**.
- `faille.md` AM-5 : « Les **39** témoins » : `git ls-files` compte **53** fichiers
  `*.guard.test.*`. Le rapport « couvert / total » de `check:sabotages` ment donc par omission
  (11 sabotages sur 53, pas sur 39).

### 🟡 A-10 · Hypothèses de chaîne que la doc n'a jamais croisées

- **G-2 × invitations par e-mail** : `claim_org_invite` (mig. `161`, l. 538) lie une invitation
  nominative à `auth.email()`. Or la confirmation d'adresse est désactivée (G-2) : `auth.email()`
  est une adresse **déclarée, jamais prouvée**. Même chose pour `invite_domain_only` (mig. `195`),
  qui fait confiance au domaine d'une adresse non vérifiée. G-2 a été évalué seul le 2026-08-27,
  jamais contre ces deux mécanismes nés en septembre.
- **`send-org-invite` sans limite de débit** : 50 envois par appel, aucun appel à
  `_shared/rate-limit.ts` (seul `report-bug` l'utilise). Un compte gratuit crée une organisation,
  appelle en boucle, et brûle le quota Resend et la réputation de `send.thecosmo.app`, qui porte
  **aussi** les e-mails d'authentification. En phase d'acquisition, c'est le scénario qui coupe
  les inscriptions.

---

## Partie B · le prompt

Copier tout ce qui suit dans une nouvelle session, à la racine du dépôt.

````markdown
# Mission : audit de sécurité offensif et exhaustif de COSMO, avant le lancement de l'acquisition

Tu es un auditeur de sécurité senior, en posture d'attaquant. COSMO va ouvrir l'acquisition
(inscriptions publiques, trafic payant et organique, premiers clients entreprise). Ton objectif :
trouver **tout** ce qu'un attaquant, un bot, un concurrent, un utilisateur malveillant ou un
client maladroit pourrait exploiter, et tout ce qui casserait sous un afflux d'inscriptions.
Tu rends un verdict **go / no-go** argumenté, et un plan de correction ordonné.

Tu n'as aucune restriction sur ce que tu cherches ni sur la profondeur. Les seules limites sont
les règles d'engagement ci-dessous, qui protègent la production et le compte réel d'Axel.

## 0. Règles d'engagement (non négociables)

1. **La production est en lecture seule.** Aucun `INSERT`/`UPDATE`/`DELETE`/DDL en prod, aucune
   écriture via le MCP Supabase, aucun `apply_migration`, aucun `deploy_edge_function`.
   Une preuve d'exploitation en base se fait sur la **stack locale** (`npm run test:rls`,
   `supabase start`) ou dans une transaction `BEGIN … ROLLBACK` **seulement après accord
   explicite d'Axel dans le chat**, en le demandant pour chaque preuve.
2. **Ne jamais lancer** `npm run cosmo:login`, `git reset --hard`, `git push --force`,
   `npm audit fix --force`. Ne jamais passer `--maxWorkers` à Vitest.
3. **Aucune attaque contre la prod qui la dégrade** : pas de flood, pas de brute force, pas
   d'envoi d'e-mail réel, pas de webhook réel, pas de paiement. Une attaque de débit se prouve
   par lecture du code et par un test local, jamais par la mesure.
4. **Aucun secret dans ta sortie.** Si tu en trouves un (historique git, bundle, logs), écris son
   emplacement et son type, jamais sa valeur.
5. **Le code fait foi, la doc est une hypothèse.** Chaque affirmation d'un `.md` que tu utilises
   doit être revérifiée à sa source (code, CI, base). Tout écart entre les deux est un finding à
   part entière, classé « incohérence », avec la phrase exacte du `.md` et la preuve contraire.
6. **Un finding sans preuve n'en est pas un.** Chaque finding porte : fichier et ligne, scénario
   d'attaque concret (qui, avec quels droits, quelle requête, quel résultat), et le moyen de le
   rejouer. Distingue **CONFIRMÉ** (rejoué ou lu sans ambiguïté) de **PLAUSIBLE** (à prouver).
7. Lire `$?` après chaque commande, jamais une ligne de résumé ; jamais `| tail` avant de lire le
   code de sortie.

## 1. Lire d'abord, dans cet ordre

1. `CLAUDE.md` (racine) puis chaque `CLAUDE.md` de dossier listé dans sa table.
2. `faille.md` en entier : findings ouverts, angles morts AM-1 à AM-5, D-1, D-2, G-2, V-1.
3. `docs/SECURITY.md`, `docs/RGPD.md`, `docs/RGPD-REGISTRE.md`, `docs/LEGAL.md`,
   `docs/STRIPE-LIVE.md`, `docs/DEPLOYMENT.md`, `docs/SCALABILITY.md`, `a-faire-manuel.md`.
4. `prompt-audit-failles-acquisition-2026-09-30.md`, **partie A** : dix écarts déjà mesurés le
   2026-09-30. Ne les redécouvre pas : **reconfirme-les** (ils ont pu bouger), puis va au-delà.

`docs/archive/**` n'est jamais l'état courant.

## 2. Inventaire de la surface, à reconstruire toi-même

Avant de chercher des failles, dresse l'inventaire réel, et compare-le à ce que la doc annonce :

- **Tables** `public` (attendu au 2026-09-30 : 76, toutes sous RLS) : pour chacune, RLS active,
  policies par commande, `FORCE ROW LEVEL SECURITY` ou non, colonnes sensibles,
  `column_privileges` (la RLS ne filtre pas les colonnes).
- **Fonctions** exposées par PostgREST : chaque `SECURITY DEFINER` exécutable par `anon` ou
  `authenticated` (attendu : 2 et 78). Pour chacune : quelle garde, sur quel identifiant, et est-ce
  que l'appelant peut passer un `p_org`, `p_user`, `p_task` qui n'est pas à lui.
- **Edge Functions** : les 12 déployées (`list_edge_functions`), leur `verify_jwt` réel, leur
  présence dans `supabase/config.toml`, leur version déployée contre le dépôt (`npm run check:edge`),
  leurs secrets, leur CORS.
- **Workflows GitHub** : déclencheurs, `permissions`, secrets utilisés, `pull_request_target`,
  actions tierces non épinglées par SHA.
- **Surface client** : routes publiques, routes protégées, ce que le bundle `dist/` contient
  (clés, URL internes, commentaires, sourcemaps), ce qui est prérendu.
- **Buckets Storage**, **canaux Realtime**, **jobs `pg_cron`**, **templates d'e-mail**.
- **Tiers** : Stripe, Resend, Sentry, Vesk, Vercel, Cloudflare Turnstile, Google OAuth.

Produis un tableau « annoncé par la doc / mesuré / écart ».

## 3. Axes d'attaque, tous à couvrir

Pour chaque axe, cherche d'abord ce qui est **nouveau depuis le 2026-09-22** (migrations
`160` à `205`, les quatre Edge Functions d'entreprise), c'est là que rien n'a été relu.

### 3.1 Contrôle d'accès en base (le cœur du produit)

- **Isolation entre comptes** et **entre organisations** : pour chaque table et chaque RPC,
  un utilisateur A peut-il lire, créer, modifier, supprimer une ligne de B ? Un membre de l'org X
  peut-il toucher l'org Y en passant son `org_id` ?
- **Escalade dans une organisation** : un membre simple peut-il devenir manager ou admin, changer
  son propre rôle, lever sa su