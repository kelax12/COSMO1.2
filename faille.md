# Sécurité — findings ouverts & priorités — COSMO 1.2

**Source de vérité sécurité du projet.** Ce fichier ne contient que ce qui est **encore ouvert**
et les **règles durables** tirées des audits.

- Historique complet (preuve des corrections, audits datés 2026-04 → 2026-08, anciens ordres de
  priorité) : [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md) — **archive, non maintenue**.
- Procédures et patterns : [`docs/SECURITY.md`](./docs/SECURITY.md).
- **Passe documentaire du 2026-09-03** : les 71 commits postérieurs au 2026-08-29 relus, la note
  portée à **86**, et les deux tableaux d'actions relus ligne par ligne (A-9 et les réglages de
  console : **trois lignes sur cinq étaient périmées**). ⚠️ **Aucune mesure nouvelle contre la
  production** ce jour-là : les chiffres cités sont ceux des commits qui les ont produits.
- Dernière vérification de ce fichier contre le code **et contre la prod** : **2026-09-02**
  (audit des Edge Functions Stripe, findings `S-1` à `S-6`, quinze requêtes de lecture en base).
  Relu contre le code de `main` le **2026-08-27** (ajout du finding G-1, mig. `130`). ⚠️ Les
  chiffres d'advisors et de policies de ce fichier datent toujours du 08-25 : la campagne du 09-02
  n'a mesuré que la surface de facturation, pas la RLS.

Légende : 🔴 bloquant · 🟠 important · 🟡 à planifier · ✅ corrigé

---

## Note de sécurité : 82 → 86 → 84 → 86 → 88 → 83 → **83 / 100** (2026-08-24 → 2026-09-02 → 2026-09-03 → 2026-09-14 → 2026-09-16 → 2026-09-22 soir) · **VÉRIFIÉE inchangée le 2026-09-14 au soir**

> ### ⚪ 2026-09-22 (soir) · 0 : remesure item par item, contre la CI réelle et la production
>
> **Règle appliquée**, déclarée au [tableau de bord](./docs/README.md) : un angle mort payé le 2026-09-16
> n'est remboursé que si sa garde a rendu **au moins un verdict exploitable en CI** (vert, ou
> rouge sur un vrai défaut). Une garde posée mais jamais jouée, ou cassée, ne rembourse rien.
> Un défaut nommé ce soir coûte selon le barème du 09-16.
>
> | Item | Effet | Mesuré le 2026-09-22 |
> |---|---|---|
> | AM-4 · aucun SAST | **+1** | `codeql.yml` tourne et est vert sur chaque push |
> | 🔴 9 alertes CodeQL ouvertes, aucune triée | **−1** | **5 `high`** (`js/file-system-race` ×4 dans `scripts/`, `js/bad-tag-filter` dans `check-i18n-pages.mjs`), **4 `medium`** (dont `actions/missing-workflow-permissions` sur `renewal-notice.yml`). Toutes hors du bundle client, aucune n'est une faille produit démontrée. C'est `M-60` |
> | AM-1 · advisors lus à la main | **0** | **non remboursé** : `check:supabase-posture` échoue exprès tant que `M-58` n'est pas fait. ✅ Relus ce soir par l'API : **10 / 53 / 2 / 1**, les deux comptes qui bougent sont **exactement** ceux que `M-58` annonçait (mig. `150`) |
> | AM-2 · comportement des fonctions | **0** | **non remboursé** : `check:edge-smoke` **n'a jamais sondé en CI**, `VITE_SUPABASE_ANON_KEY` n'est pas passé au job. → `C-114`. Et `check:edge` est rouge depuis le 09-21 sur une dérive **légitime** de `report-bug` (`M-61`) |
> | AM-5 · témoins de sécurité jamais rejoués | **0** | **non remboursé** : `Sabotages` rouge (cf. `docs/TESTING.md`) |
>
> ✅ Vérifié en base ce soir : 51 tables / 51 sous RLS / 126 policies ; `get_support_stats` et
> `get_admin_stats` appellent `is_admin()` ; `org_subscriptions` et `payment_records` à 0 ligne.
>
> **83 → 83.** Détail, règle et ordre de réparation : [tableau de bord](./docs/README.md).

> ### 🟠 2026-09-16 · -5 : la note comptait ce qui était mesuré, jamais ce qui ne l'était pas
>
> **Ce n'est pas une régression.** Rien n'a cassé depuis la dernière passe. Les angles morts
> listés juste en dessous **existaient tous** pendant que cette note montait : elle était
> surévaluée parce qu'elle ne comptait que ce que les gardes regardent. C'est exactement ce qui
> s'est produit le 2026-09-14, où cinq notes ont baissé sans qu'aucun défaut ne soit récent.
>
> **Barème, déclaré pour être contestable ligne par ligne :**
>
> | Situation | Effet |
> |---|---|
> | angle mort **structurel**, de portée large, qu'aucun outil ne regarde | −2 |
> | angle mort réel mais de portée limitée, ou partiellement couvert | −1 |
> | angle mort **assumé** (arbitrage documenté), ou déjà compté dans une passe antérieure | 0 |
> | angle mort **comblé** le jour même, avec garde **et** témoin | +1 |
>
> **Le calcul pour cette note :**
>
> | Angle mort | Effet | Pourquoi |
> |---|---|---|
> | AM-1 · **les advisors Supabase ne sont lus qu'à la main** | −2 | seule source qui voit une policy manquante après coup ; « advisor » dans `ci.yml` désigne `npm audit` |
> | AM-4 · aucun SAST, sur un dépôt **public** où CodeQL serait gratuit | −1 | filet manquant, pas une faille : les invariants nommés tiennent |
> | AM-2 · `check:edge` compare le CODE, jamais le COMPORTEMENT | −1 | un secret qui change rend la garde verte |
> | AM-5 · les témoins de sécurité ne sont jamais rejoués | −1 | `csp.guard`, `rgpd-erasure.guard`, `refund.guard`, `org-deletion.guard` |
> | AM-3 · `npm audit` ne couvre que les dépendances de production | 0 | arbitrage assumé et documenté |
>
> 🔴 **Une note baisse UNE FOIS, quand l'angle mort est nommé ; elle remonte quand il est
> outillé.** Sans cette règle, nommer un angle mort deviendrait punitif, et la passe du
> 2026-09-16 serait la dernière à en chercher. Un angle mort reconduit sans être comblé ne
> re-coûte rien : il est **déjà payé**.
>
> ⚠️ Un transversal (T-1 à T-10 du [tableau de bord](./docs/README.md)) est compté dans **chaque** audit
> qu'il touche, parce que chaque note prétend quelque chose de différent. Les témoins jamais
> rejoués coûtent donc à la fois aux tests et à la sécurité, et ce n'est pas un double comptage.
> (Ils étaient 36 ce jour-là, **39 au 2026-09-20** ; le calcul de la note ne change pas.)



### 🕳️ Angles morts · ce que cet audit NE mesure PAS (2026-09-16)

> 🔎 **Colonne « État » réécrite le 2026-09-21.** La quatrième colonne posait « Outillable ? »,
> c'est-à-dire une **prédiction** faite le 2026-09-16. La passe du 2026-09-20 au soir (`2b4c4304`)
> y a répondu : elle porte donc maintenant l'**état réel**, la garde qui couvre la ligne, et
> 🔴 **ce que cette garde ne prouve pas** — la moitié qui manque d'habitude.
>
> ❌ **La colonne « Angle mort » n'est PAS touchée.** C'est l'énoncé, daté du 2026-09-16, et
> c'est lui qui, nommé, a permis d'outiller : le réécrire effacerait la seule chose qui explique
> pourquoi la garde existe. Un seul endroit porte l'état, et c'est la colonne de droite.
>
> ⚠️ **Une garde posée n'est pas un angle mort fermé**, et `M-56` (« ce que chaque angle mort
> coûte en points ») ne change rien ici : **aucune note ne bouge** sur cette base.



> **Pourquoi cette section existe.** Cette note est justifiée par des points **nommés** (« ce qui
> retient à N », suivi d'une liste). Une note construite ainsi ne peut baisser que sur un défaut
> que quelqu'un a d'abord nommé : **un angle mort ne pèse rien tant qu'il reste anonyme**, et ce
> n'est pas un oubli d'auditeur, c'est une propriété de la méthode de notation.
>
> Le prototype du problème est daté : `CLAUDE.md` a pesé 150 ko et ~43 000 tokens sans qu'aucune
> note ne bouge, alors qu'il est cité **13 fois** dans [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), dont **9**
> dans la seule colonne « Où il est écrit » du tableau des invariants, et **jamais** dans ce
> qui est mesuré. Il était le mètre,
> jamais l'objet.
>
> Ces lignes entrent donc **dans ce qui est mesuré**. La prochaine passe les traite comme les
> invariants ci-dessus : chacune est soit comblée, soit reconduite avec sa date.

| # | Angle mort · **énoncé du 2026-09-16, non réécrit** | Vérifié le 2026-09-16 | 🔎 État au 2026-09-21 |
|---|---|---|---|
| AM-1 | 🔴 **Les advisors Supabase ne sont lus qu'à LA MAIN.** Ils sont la seule source qui voit une policy manquante ou une fonction `SECURITY DEFINER` exposée après coup, et aucun workflow ne les interroge | le mot « advisor » dans `ci.yml` désigne **`npm audit`**, pas les advisors de la base. `9 / 52 / 2 / 1` au 2026-09-14, relevé manuellement | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:supabase-posture` · advisors lus par l'API Management (`C-88`) — 🔴 ne prouve PAS : 🔴 rien pour l'instant : **elle échoue exprès** tant que la référence des réglages d'auth n'est pas posée **et commitée** — **`M-58`** |
| AM-2 | **`check:edge` compare le CODE déployé, jamais le COMPORTEMENT.** Une fonction identique au dépôt mais dont un **secret** a changé de valeur, ou dont une dépendance distante a bougé, rend la garde verte | `scripts/check-edge-deploy.mjs` compare des sources | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:edge-smoke` · **8 sondes**, dans `edge-deploy-drift.yml`, **vertes contre la production** le jour de leur pose (`C-91`) — 🔴 ne prouve PAS : que la fonction fasse son travail : on touche ses premiers mètres, on ne parcourt pas le chemin · 🔎 🔴 **2026-09-22 : jamais joué en CI.** `VITE_SUPABASE_ANON_KEY` n'est pas passé au job, la sonde s'arrête avant de sonder. → `C-114` |
| AM-3 | **`npm audit` ne couvre que les dépendances de PRODUCTION** (`--omit=dev`). Une vulnérabilité dans la chaîne de build n'est vue par rien | `ci.yml:148` : `npm audit --omit=dev --audit-level=high` | ✅ **OUTILLÉ le 2026-09-20** · second `npm audit` sur la chaîne de build, **non bloquant mais LU** (compte par sévérité au résumé) (`C-90`) — 🔴 ne prouve PAS : rien, et c'est assumé : c'est un **arbitrage** écrit comme tel, pas une garde |
| AM-4 | **Aucune analyse statique de sécurité (SAST) sur le code du dépôt.** Les gardes existantes vérifient des invariants nommés, jamais des motifs inconnus | aucun CodeQL, Semgrep ou équivalent dans `.github/workflows/` | ✅ **OUTILLÉ le 2026-09-20** · `codeql.yml`, `security-extended`, JS/TS **et** `actions` (`C-89`) — 🔴 ne prouve PAS : 🔴 un job vert. Fini quand **chaque alerte ouverte porte une décision** — **`M-60`** · 🔎 🟠 **2026-09-22 : 9 alertes ouvertes** (5 `high`, 4 `medium`), aucune triée |
| AM-5 | **Les 39 témoins ne sont jamais rejoués** (cf. [`docs/TESTING.md`](./docs/TESTING.md) AM-1). Plusieurs gardent des frontières de sécurité : `csp.guard`, `rgpd-erasure.guard`, `refund.guard`, `org-deletion.guard` | **39** fichiers `*.guard.test.*` (`git ls-files`, **recomptés le 2026-09-20** ; « 36 » datait du 09-16 et n'avait pas suivi les trois ajouts), aucun mutation testing | ✅ **OUTILLÉ le 2026-09-20** · `npm run check:sabotages` · 11 sabotages rejoués, restauration octet pour octet vérifiée (`C-81`) — 🔴 ne prouve PAS : que les **39** témoins détectent : le rapport couvert / total est imprimé exprès · 🔎 🔴 **2026-09-22 : job rouge.** Les 11 sabotages sont vus, mais le contrôle « arbre restauré » échoue sur le `sabotages.log` du workflow. → `C-113` |


> ### ⚪ 2026-09-14 (soir) · 0 : tout ce que cette note affirme a été rejoué, et deux angles morts s'ouvrent
>
> **Rejoué ce soir, contre le code de l'arbre ET contre la prod `ykeugqfgklejcdbrmawy`** :
> `check:rls` (**132 policies sur 106 migrations, 0 violation**), `validate:migrations`
> (**152 fichiers, 0 erreur, les 6 mêmes avertissements**), `typecheck` (0), `lint` (0 erreur,
> **31** warnings), `npm test` (**228 fichiers / 2 586 passés**, exit 0), `test:coverage` (verte,
> exit 0), et les advisors Supabase : **9 / 52 / 2 / 1**, à l'unité près ce que ce fichier
> annonçait. Aucune régression.
>
> **Et l'invariant fondamental du projet est reconfirmé en base, pas déduit d'une migration** :
> `public` porte **50 tables**, et **les 50 ont `relrowsecurity = true`**. C'est la même forme de
> preuve que celle du 2026-08-25 (« 0 table sans RLS »), rejouée sur un schéma qui a gagné des
> tables depuis. La base porte par ailleurs **126 policies** actives et **117 fonctions** dans
> `public`.
>
> **Une vérification d'isolation en prod s'y ajoute, et elle n'avait jamais été faite sous cette
> forme.** Dans une transaction annulée, en se plaçant dans le rôle `authenticated` avec les claims
> d'un compte réel, `select * from tasks` rend **289 lignes sur les 750 de la base**, et le plan
> affiche `Rows Removed by Filter: 461` : les 461 lignes des autres comptes sont examinées puis
> **rejetées par la policy**. C'est une preuve directe, sur données réelles, que
> `tasks_select_own_or_shared` filtre ce qu'elle doit filtrer.
>
> 🔴 **Angle mort D-1 · le ledger de migrations ne prouve pas ce qu'on lui fait dire.** Ce fichier
> écrivait « ledger à 148 entrées ». Recompté : **138**. « 148 » est le NUMÉRO de la dernière
> migration, recopié comme un total. Pire que l'erreur de chiffre, le raisonnement : comparé nom à
> nom, **32 des 152 fichiers du dépôt n'ont aucune entrée au ledger** et **17 entrées n'ont aucun
> fichier**. Les 32 SONT appliquées (vérifié objet par objet sur un échantillon dans le catalogue
> Postgres), mais ce n'est jamais le ledger qui l'établit. **Aucune garde de ce dépôt ne surveille
> ce recouvrement**, et `check:drift` ne le couvre pas : il compare un schéma, pas un journal.
> C'est la version symétrique du défaut de la mig. `144` : là, une ligne au ledger ne prouvait pas
> qu'un `CREATE OR REPLACE` avait pris ; ici, l'absence de ligne ne prouve pas qu'une migration
> manque.
>
> 🔴 **Angle mort D-2 · `email_confirmed_at` est rempli pour tout le monde, et ne vérifie rien.**
> Mesuré ce soir : **28 comptes sur 28 portent `email_confirmed_at`**, dont **26 à la seconde même
> de leur création**, et **18 comptes sont créés par email + mot de passe** (10 par Google). La
> confirmation d'adresse étant désactivée (décision d'Axel, cf. G-2), Supabase pose la colonne
> d'office : **aucune de ces 18 adresses n'a jamais été prouvée**. Le danger n'est pas la décision,
> qui est assumée et documentée ; c'est que la colonne qui sert partout à répondre « cette adresse
> est-elle vérifiée ? » réponde **oui** pour des adresses que personne n'a vérifiées. ❌ Ne jamais
> conclure de `email_confirmed_at IS NOT NULL` que l'adresse existe, tant que G-2 est ouvert : le
> seul signal exploitable ici est `raw_app_meta_data->>'provider' = 'google'`, où c'est Google qui
> a fait la vérification.
>
> ⚠️ **Ce que ce poste ne peut pas vérifier, et qui est donc repris de la CI, pas remesuré** :
> `npm run check:edge` exige `SUPABASE_ACCESS_TOKEN`, absent de cet environnement. La non-dérive
> des 8 Edge Functions reste établie par le job `Edge deploy drift` (run `34861975638`), pas par
> une mesure d'aujourd'hui. Les **versions en ligne ont en revanche été relues ce soir par l'API**
> et sont : `stripe-webhook` **v33**, `stripe-create-checkout` v23, `delete-account` **v17**,
> `stripe-org-checkout` v15, `renewal-notice` v13, `report-bug` v12, `stripe-org-portal` v12,
> `stripe-org-refund` **v6**.
>
> **La note ne bouge pas, et c'est le bon résultat** : rien n'a été durci aujourd'hui, rien n'a
> cédé. Les deux angles morts ci-dessus sont des défauts de PREUVE, pas des vulnérabilités : ils ne
> retirent pas de point parce que rien n'indique qu'ils masquent une faille, et ils n'en donnent
> évidemment aucun.


> ### 🟢 2026-09-14 · +2 : le seul verrou non testé d'un chemin qui déplace de l'argent l'est désormais
>
> `stripe-org-refund` a trois verrous anti-rejeu. Jusqu'à ce jour, **un seul des trois n'avait
> jamais été exécuté par quoi que ce soit** : le pré-contrôle qui retranche le déjà-remboursé
> vivait en ligne dans l'entrypoint Deno, entre deux appels réseau — structurellement intestable
> depuis n'importe quel poste. Il est extrait (`_shared/refund-replay.ts`, TS pur), couvert par
> **10 cas** (nominal, rejeu, période déjà remboursée, plus un témoin), **vu rouge sur trois
> sabotages** avant d'être commité, et **déployé en v6**, identique au dépôt
> (`Edge deploy drift` run `34861975638` : « 8 fonction(s) verifiee(s) »).
>
> ⚠️ **Ce que ça change concrètement** : avant ce jour, rien ne garantissait que la borne « ce qui
> reste à rendre = décidé − déjà rendu » calculait juste. Un mutant qui inverserait la soustraction
> ou compterait un remboursement `failed` comme rendu serait passé inaperçu — les 3 sabotages joués
> ici le prouvent, ils faisaient tous tomber des cas précis, jamais tous en même temps.
>
> ⚠️ **Ce qui n'est PAS nouveau et ne doit pas gonfler ce +2** : la clé d'idempotence Stripe
> (verrou 1) et le clamp par l'encaissé (verrou 3) existaient déjà et sont inchangés. Et rien n'a
> encore tourné **contre Stripe** : `refunds.create` et la résiliation réelle restent non
> éprouvées, `org_subscriptions` à zéro ligne. Ce +2 porte sur la preuve d'un verrou, pas sur
> l'encaissement.
>
> **Ce qui ne relève PAS d'un score** : quatre numéros de version d'Edge Functions cités par ce
> fichier étaient décalés d'une unité, et un angle mort affirmait deux choses fausses. Corrigés
> aujourd'hui — c'est une correction de documentation, pas un changement de posture, et ça n'entre
> pas dans le delta.

> ### 2026-09-03 · +2, et pour la première fois depuis longtemps ce sont des protections EN VIGUEUR
>
> Cette passe rattrape les journées 08-30 au 09-01, que la campagne du 09-02 n'avait pas notées.
> Les deux points viennent de choses qui **tournent en production**, pas de code écrit :
>
> | | Ce qui a changé |
> |---|---|
> | **`/admin` derrière une session `aal2`** | La mig. `131` est appliquée (08-31) **et** le facteur TOTP est enrôlé : `auth.mfa_factors` porte 1 facteur `totp` en statut `verified` sur le compte admin, créé le 2026-09-01 à 14:20:27 UTC et vérifié 46 secondes plus tard. Une session ouverte avec un mot de passe volé ne suffit plus |
> | **Realtime n'était pas chiffré ailleurs, il était BLOQUÉ** | `connect-src` autorisait `https://*.supabase.co` mais pas `wss://*.supabase.co` ; en CSP un schéma écrit explicitement doit correspondre. Les trois canaux de collaboration étaient coupés **en production**, en silence, et ils avaient justement remplacé huit sondages : plus aucun filet derrière eux. Verrouillé par `src/csp.guard.test.ts`, vérifié rouge sans le correctif |
> | **Secret scanning, push protection et Dependabot** | Actifs sur le dépôt **public**. Une fuite réelle trouvée dans l'historique : `.env` commité au commit initial (`service_role`, `DATABASE_URL`). **Inerte** : ces clés visent un projet supprimé depuis (absent du compte, DNS inexistant). Reste la question de la réutilisation du mot de passe, qui n'appartient qu'à Axel |
> | **Mig. `134` et `135` appliquées et vérifiées** | Déjà créditées le 09-02, rappelées ici parce qu'elles ferment la condition d'encaissement : sans `withdrawal_consents`, `stripe-org-checkout` refuse toute session |
>
> 🔴 **Ce qui empêche d'aller au-delà de 86 :**
>
> - **`V-1` reste ouvert par son seul bout qui compte** : le DPA du fournisseur de mesure
>   d'audience n'est pas obtenu (art. 28). Le script a transmis **email et nom** depuis `/signup`
>   en production, et la garde qui l'a détecté a échoué quatre jours sans être lue ;
> - **A-9 change de forme sans disparaître** : le drill de restauration a été **exécuté avec succès
>   le 2026-09-01**, RTO mesuré **163 s**, isolation vérifiée. Il n'y a toujours **aucun PITR**, le
>   plan Free n'incluant aucune sauvegarde : le dump quotidien est désormais la **seule** copie de
>   la base qui existe ;
> - **le canal d'alerte d'ops reste inerte** tant que `OPS_ALERT_WEBHOOK_URL` n'est pas posé dans
>   les secrets Actions du dépôt.
>
> ⚠️ **Une leçon qui vaut plus que les deux points.** La mig. `131` a été appliquée **avant** que le
> chemin de secours ait été parcouru une seule fois. Ce chemin était cassé : l'écran d'enrôlement
> levait en phase de rendu, donc affichait l'erreur générique au lieu du QR code, lui-même cassé
> par un double préfixe `data:`. `/admin` est resté inaccessible du 2026-08-31 au 2026-09-01, et un
> seul compte au monde ouvre cette console. *Quand une migration crée une dépendance à un chemin de
> récupération, ce chemin se PARCOURT avant de l'appliquer, il ne se raisonne pas : il suffisait
> d'ouvrir l'écran une fois.*

> ### 🟠 2026-09-02 · la note BAISSE de 2, et c'est l'audit qui l'a fait baisser
>
> Rien ne s'est cassé : six findings sont apparus parce qu'on a enfin regardé la surface de
> facturation. La ligne « findings ouverts dans le code » disait 0 depuis le 08-24 ; elle disait 0
> **parce que personne n'avait lu les Edge Functions Stripe**, pas parce qu'elles étaient propres.
>
> *Une note qui monte quand on cesse de chercher ne mesure pas la sécurité, elle mesure
> l'attention.* Les six correctifs livrés le même jour ne la font pas remonter : ils réparent des
> trous que la note n'avait jamais comptés.
>
> ~~**Ce qui la retient à 84**, ce ne sont plus des findings ouverts — il n'y en a plus — mais deux
> migrations **écrites et non appliquées** (`134`, `135`).~~ ✅ **Les deux ont été APPLIQUÉES en
> production le 2026-09-02 au soir** (ledger `20260902162407` et `20260902162428`), et vérifiées
> acteur par acteur dans une transaction annulée : doublon de `stripe_customer_id` refusé en 23505,
> consentement incomplet refusé par la CHECK, UPDATE et DELETE refusés par le trigger **même au rôle
> privilégié**, une seule policy et aucune policy d'écriture, un compte tiers ne voit rien. Le motif
> qui retenait la note est donc levé le jour même. Un correctif non déployé n'est pas un correctif —
> et celui-ci l'est.
>
> ⚠️ **Incident de méthode, à consigner.** Les deux migrations ont été appliquées DEUX fois : une
> session voisine les avait déjà passées à 16:24 UTC, une seconde application a suivi à 21:14 sans
> que le ledger ait été relu d'abord. Sans effet sur le schéma — les deux migrations sont
> idempotentes, et les vérifications ci-dessus portent sur l'état réel — mais le ledger a porté
> **deux lignes par migration**, les seuls doublons de ses 127 entrées. Retirées, une entrée par
> migration, schéma intact. *Ce dépôt a plusieurs sessions actives : lire le ledger avant
> d'appliquer, pas seulement après.*

> ### 🔴 2026-08-29 · la note ne bouge pas, mais une de ses justifications était fausse
>
> Le +4 du 2026-08-25 était en partie porté par cette phrase, écrite plus bas : la mig. 115 est
> arrivée avec « **337 lignes de test d'intégration contre une vraie base dans le même commit** ».
> Le test existe, il est bon, et **il n'avait jamais été vert en CI** : le job `rls-integration`
> échouait dessus depuis sa création. Un test rouge qu'on n'ouvre pas ne vaut pas mieux qu'un test
> absent, et il coûte en plus la confiance qu'on lui accorde.
>
> **Ce que le test reprochait n'était pas la base.** Rejeu mesuré sur base vierge, sous le rôle
> `authenticated` avec un `auth.uid()` forgé : `is_org_admin` vrai, `my_org_perm` vrai, insertion
> **acceptée**. Le refus venait de la RELECTURE demandée par `.insert().select()`, soumise à
> `can_access_team_project(id)`, qui cherche en table une ligne pas encore visible. Le test
> éprouvait une forme d'appel que l'application n'utilise nulle part, et que `createProject`
> documente comme telle depuis le bug #9.
>
> **Depuis le 2026-08-29, le test passe** : la justification est enfin vraie. La note ne monte pas
> pour autant, parce qu'aucune protection nouvelle n'a été mise en vigueur, et parce que le crédit
> avait déjà été versé. *Une note qui récompense une garde doit d'abord vérifier que la garde
> tourne.*
>
> ~~G-1 reste ouvert en production~~ → ✅ **G-1 est REFERMÉ le 2026-08-29** : mig. `130` appliquée en
> production et vérifiée en base, pas sur parole (voir la section G-1).

| Ce qui compose la note | 08-25 | 08-27 | **09-02** |
|---|---|---|---|
| Findings High/Critical exploitables | 0 | 0 | **0** |
| Findings ouverts dans le code | 0 | 0 | **0** · `S-5` et `S-6` refermés le jour même |
| Migrations écrites, **non appliquées** en prod | 0 | 0 | **0** · `134` et `135` appliquées le 2026-09-02 au soir |
| Surface auditée au moins une fois | pages + RLS | idem | **+ les 4 Edge Functions Stripe** |
| Findings ouverts **en production** | 0 | 0 | ~~🟠 1 · G-1~~ → **0 au 2026-08-29**, mig. 130 appliquée et vérifiée |
| Bloquants restants, **hors dépôt** | A-9 (pas de PITR) + 5 réglages de console | **inchangés** | **inchangés** |
| Gardes automatiques vertes | 4 | **4** (+ périmètre élargi : 128 policies, 127 migrations) | **4** · `check:rls` 0 violation, `validate:migrations` 0 erreur avec la mig. 130 |
| Nouvelle surface livrée **avec** son test de base réelle | · | ✅ `org_member_permissions` (mig. 115) + `e2e/rls/org-permissions.test.ts` | ⚪️ sans objet, aucune nouvelle surface |
| Fonctions `anon`-exécutables | 2 (les deux volontaires) | 2 | 2, non remesuré |

**+4, et pas davantage.** Les neuf migrations du 2026-08-25 (`115` → `123`) n'ont ouvert aucune
faille : la plus sensible, un système de permissions par membre, est arrivée avec sa policy, son
trigger de garde en `SECURITY INVOKER`, ses `REVOKE`, et **337 lignes de test d'intégration contre
une vraie base dans le même commit**. C'est la première fois qu'une brique entreprise fait ça, et
c'est ce que la note récompense.

Ce qui l'empêche de monter plus haut n'a pas bougé d'un pouce : **A-9** (plan Free, pas de PITR,
restauration jamais testée) et les réglages de console. Ce sont les deux seules choses qui
séparent « aucune faille connue » de « rattrapable en production », et aucune n'est du code.

### 2026-08-27 · note inchangée, et c'est le bon résultat

**Rien n'a changé en production.** Un finding de minimisation connu depuis le 2026-08-24 (noté
alors sous B-2, « reste ouvert, non traité ») a reçu son correctif dans le dépôt, la **mig. 130**,
qui **n'est pas appliquée**. Écrire une migration ne referme rien : tant qu'elle n'est pas passée
en base, l'état de la prod est exactement celui du 25. La note ne peut donc pas monter, et elle ne
baisse pas non plus, le finding n'étant pas nouveau.

Deux points de vigilance sont apparus par ailleurs, tous deux vérifiés et **sans impact
d'autorisation** :

- **`wasOrgMember` (commit `f32d080`) est un INDICE D'AFFICHAGE persisté, jamais une
  autorisation.** Il réserve la place de l'entrée « Entreprise » dans la navigation pendant que la
  requête vole, à partir de la préférence d'organisation déjà stockée sur l'appareil. Il ne
  débloque aucune donnée : `/entreprise` redirige toujours vers le tableau de bord si `activeOrg`
  est nul une fois la requête résolue, et toute lecture reste gouvernée par la RLS. **Pire cas :
  une entrée de navigation affichée une seconde de trop** chez quelqu'un qui vient de quitter sa
  dernière organisation depuis un autre appareil. L'indice est effacé dès que la requête répond
  « aucune organisation », et il ne traverse pas un changement de compte (vérifié par test).
- **Le seed de démo passe de deux organisations à une seule** (`180fba1`). Effet de bord voulu :
  sous une seule organisation la navigation redevient un vrai `<a href="/entreprise">` au lieu
  d'un menu. La couverture des **refus non-admin**, qui dépendait de la seconde organisation, a
  été reconstituée dans les tests (`seedSecondOrg`), **pas supprimée** : c'est la seule condition
  qui rendait ce retrait acceptable.

---

## Gardes automatiques · **rejouées le 2026-09-20**

Toutes jouées ce jour, sur cet arbre, contre la prod `ykeugqfgklejcdbrmawy` pour les advisors et
le ledger. Le tableau du 2026-09-14 est conservé sous celui-ci, à sa date.

| Garde | Résultat au 2026-09-20 | Au 2026-09-14 |
|---|---|---|
| `npm run check:rls` | ✅ **132 policies sur 107 migration(s)**, 0 violation | 132 / 106 |
| `npm run validate:migrations` | ✅ **153 fichiers**, 0 erreur, **les mêmes 6** avertissements | 152 fichiers, mêmes 6 |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur, **31** warnings | identique |
| `npm run i18n:check` | ✅ 23 namespaces, 0 erreur | identique |
| `npm run i18n:scan` | 🔴 **ROUGE, puis corrigé le jour même** : 1 chaîne en dur, `Catégorie` dans `HabitModal.tsx`, entrée avec `6a25071c`. Externalisée en `habits.modal.category`, la gate est revenue à **0** | non mesurée ce jour-là |
| `npm run i18n:identical` | ✅ 3 916 couples, 92 identiques **tous déclarés**, 0 non déclarée | — |
| `npm test` | ✅ **2 653 passés / 232 fichiers**, + 1 sauté (cas POSIX du témoin de `check:edge`), exit 0 | 2 586 / 228 |
| `npx playwright test --list` | **237 cas dans 27 fichiers** (recomptés, jamais « N × 2 ») | 236 à `HEAD` le 09-15 |
| `npm run check:legal` | ✅ cohérent : 13 ✅ · 13 🟡 · 15 ❌ · 5 ⬜, total 46 | — |
| `npm run check:docs` | ✅ **18 CLAUDE.md**, racine à 96,3 % du plafond, aucun lien mort | 17 |
| `npm run check:deploy` | ✅ `egal` : la prod sert `ebb1dec`, le commit du dépôt | — |
| Advisors Supabase (sécurité) | **9 / 52 / 2 / 1**, à l'unité près les mêmes | 9 / 52 / 2 / 1 |
| Invariant RLS en base | ✅ **50 tables `public`, les 50 en `relrowsecurity = true`**, 126 policies, 117 fonctions | identique |
| Ledger de migrations | ⚠️ **140 entrées pour 153 fichiers** après application de la `136` et de la `149` ce jour (138 au début de la passe). Reste la `140`, non appliquée **délibérément**. Et une confirmation NEUVE de l'angle mort D-1 : la `146` n'a **aucune entrée** alors que `events.review_dismissed_at` **existe en base** | 138 pour 152 |

✅ **`okrTime` n'est plus à 0 : `C-77` est REFERMÉ le 2026-09-20**, mig. `136` appliquée et
vérifiée par `pg_get_functiondef`. Détail, preuve avant/après et la réserve sur les KR sans
`estimated_time` : § « Ordre de priorité avant déploiement prod ».

---

## Gardes automatiques · état au 2026-09-14 · *conservé à sa date*

🔴 **Le tableau qui suivait datait du 2026-08-25 et affichait « 1 736 tests / 151 fichiers » — la
suite en compte 2 586 sur 228.** Vingt jours de dérive, sur une page dont le métier est de dire
où on en est. Il est conservé sous celui-ci, à sa date. Tout ce qui suit a été **joué ce jour**,
advisors compris.

| Garde | Résultat au 2026-09-14 | Au 2026-08-25 |
|---|---|---|
| `npm run check:rls` | ✅ **132 policies sur 106 migrations, 0 violation** | 128 / 81 |
| `npm run validate:migrations` | ✅ **152 fichiers, 0 erreur, 6 avertissements** — les **mêmes** 6 qu'au 08-25, aucune des 29 migrations depuis n'en a ajouté | 127 fichiers, mêmes 6 |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur, **31 warnings** Fast-refresh tolérés (rejoués le 2026-09-14 au soir ; « 35 » datait d'avant la suppression de `CategoryManager`) | 0 erreur, 27 warnings |
| `npm run i18n:check` | ✅ **23 namespaces**, 0 erreur, 0 avertissement | 19 namespaces |
| `npm test` | ✅ **2 586 passés / 228 fichiers**, zéro échec, **+ 1 sauté** : le cas POSIX du témoin de `check:edge`, que `it.skipIf(win32)` neutralise sur ce poste. Rejoué le 2026-09-14 au soir, exit 0 | 1 736 / 151 |
| `npm run test:coverage` | ✅ verte, exit 0, rejouée le 2026-09-14 au soir : **31,15 L · 30,73 S · 24,48 F · 26,35 B** (les deux dernières valeurs étaient données à 24,41 et 26,31) | 26,96 L / 26,65 S |
| `npm run check:edge` | ✅ **8 fonctions vérifiées, le code déployé est celui du dépôt** (job `Edge deploy drift`, run `34861975638`) | n'existait pas |
| Advisors Supabase (sécurité) | **9** INFO `rls_enabled_no_policy`, **52** WARN `authenticated_security_definer_…`, **2** WARN `anon_security_definer_…`, **1** WARN `auth_leaked_password_protection` | 5 / 51 / 2 / 1 |
| Migrations appliquées en prod | ⚠️ **RECOMPTÉ le 2026-09-14 au soir : le ledger porte 138 entrées, pas 148.** La dernière appliquée est bien `148_team_categories_tree_merge` (2026-09-13) : c'est son NUMÉRO qui avait été recopié comme un total. Et le ledger ne recouvre que 120 des 152 fichiers du dépôt, cf. l'angle mort **D-1** ci-dessous | jusqu'à `123` |

⚠️ **Les quatre `rls_enabled_no_policy` de plus ne sont pas une régression** : ce sont
`payment_records`, `payment_closures`, `rate_limits` et `renewal_notices`, toutes créées depuis, et
toutes en **deny-all volontaire** — un journal scellé et un cache de défense n'ont aucune raison
d'être lisibles par le client. Les cinq autres sont les tables analytiques déjà documentées.

⚠️ **La 52ᵉ fonction `SECURITY DEFINER` exécutable par `authenticated`** est `my_org_badge_tasks`
(mig. `142`). Elle l'est pour la seule raison qui vaut : appeler `my_team_project_ids`, dont
`EXECUTE` est révoqué à `authenticated`. Son autorisation est celle de `get_my_team_tasks`, reprise
mot pour mot.

---

## Gardes automatiques · état au 2026-08-25 · *conservé à sa date*

| Garde | Résultat |
|---|---|
| `npm run check:rls` | ✅ **128 policies sur 81 migrations, 0 violation** (120/68 au 08-24) · règle 3 comprise : toute fonction citée par une policy doit rester exécutable par `authenticated` |
| `npm run validate:migrations` | ✅ **127 fichiers, 0 erreur, 6 avertissements**, les **mêmes** 6 qu'au 08-24 : 5 préexistants (doublons `000`/`007`/`010`, deux `FOR UPDATE` sans `WITH CHECK`) + 1 informatif (mig. `110`, trigger de notification en `SECURITY DEFINER`, légitime). Les sept migrations du 25 n'en ont ajouté aucun |
| `npm run typecheck` · `npm run lint` | ✅ 0 erreur (27 warnings Fast-refresh tolérés) — + règle `no-restricted-imports` sur l'alias `@/` |
| `npm run i18n:check` | ✅ 19 namespaces, 0 erreur |
| `npm test` | ✅ **1 736 tests / 151 fichiers**, tous verts (1 583 / 143 au 08-24) |
| `npm run test:coverage` | ✅ **VERTE au 2026-08-25 en fin de journée** (26,96 L / 26,65 S / 21,32 F / 22,75 B). Elle était rouge sur 3 seuils quelques heures plus tôt : refermée par **115 tests de repository**, sans qu'aucun seuil ne soit baissé, et les seuils du glob `supabase.repository.ts` ont été **remontés** (65 → 74 statements). Cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| Advisors Supabase (sécurité) | 5 INFO `rls_enabled_no_policy` (tables analytiques, **deny-all volontaire**), 1 WARN `auth_leaked_password_protection` (= A-10 ci-dessous), 51 WARN `authenticated_security_definer_function_executable` (48 au 08-24 : les 3 nouvelles RPC de lecture), **2** WARN `anon_security_definer_function_executable`, les deux volontaires, aucun de plus après sept migrations |
| Couverture RLS | ✅ **toutes** les tables `public` ont RLS activée (vérifié en prod : `relrowsecurity = false` sur 0 table) |
| Migrations appliquées en prod | ✅ ledger à jour jusqu'à `123_org_subscriptions_billing_interval` (relu en base le 2026-08-25 au soir) |

Les fonctions exécutables par `anon` étaient **cinq** au 2026-08-24. Deux le sont
volontairement : `preview_share_link(uuid)` (aperçu d'un lien d'invitation avant connexion) et
`record_demo_visit(uuid)` (comptage des visites de démo). Toutes deux prennent un UUID non
devinable en argument — à ne pas « nettoyer » par erreur. Les trois autres
(`seed_default_categories`, `validate_team_task_dependency`,
`prevent_team_task_dependency_cycle`) sont des **fonctions de trigger** : Postgres refuse leur
appel direct, elles ne sont donc pas exploitables, mais elles violaient la règle de durcissement
posée par les migrations `064b` / `094b` (cf. B-3). **La mig. `109` les révoque** — l'advisor
retombera à deux dès qu'elle sera appliquée.

## État global

**Aucun finding High ou Critical exploitable** (dernière passe complète : **2026-08-25**, contre
la prod `ykeugqfgklejcdbrmawy`). Risque global : **faible**.

### Ce que la vague du 2026-08-25 a changé (mig. `115` → `123`)

- ✅ **`org_member_permissions` (mig. 115)**, dix droits surchargeables par membre. Nouvelle
  surface d'autorisation, donc nouveau risque potentiel ; elle arrive avec sa policy, un trigger
  de garde en `SECURITY INVOKER` (règle B-3 respectée dès le premier jet, pas après coup), les
  `REVOKE` correspondants, et `e2e/rls/org-permissions.test.ts` contre une base réelle. Deux
  invariants méritent d'être relus avant toute évolution : `assign_targets = NULL` (aucune
  décision → tout le monde) et `{}` (personne) sont **opposés**, et **aucune ligne ne peut être
  posée sur un admin**, sinon un admin se retire un droit et bloque son organisation sans chemin
  de retour.
- ✅ **`friends.friend_user_id` : `SET NULL` → `CASCADE` (mig. 116)**, la prod divergeait du
  dépôt sur la sémantique d'effacement d'une table qui porte l'email et le nom d'un tiers. Défense
  en profondeur : la purge explicite de `delete-account` reste le rempart principal. Détail :
  [`docs/RGPD.md`](./docs/RGPD.md) §2.
- ✅ **Trois RPC de lecture (`117`, `119`, `121`)**, toutes `REVOKE`-ées pour `anon`, exécutables
  par `authenticated` seulement. L'advisor `anon_security_definer_function_executable` est resté à
  **2** (les deux volontaires) après sept migrations : le durcissement de la mig. `109` tient.
- ⚠️ **Une entrée de ledger sans fichier** : `119b_habits_bounded_payload_future_guard` est
  appliquée en prod et n'existe pas dans `supabase/migration/`. Vérifié : son contenu est
  **identique** à celui du fichier `119` du dépôt (le correctif a été replié dans le fichier
  d'origine au lieu d'être versionné à part), donc rejouer le dépôt sur base vierge donne le
  **même** état final. Dérive de forme, pas de fond, mais c'est exactement le motif que
  [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §5 a mis six semaines à voir la première fois.
  **Règle : un correctif appliqué en prod se versionne sous son propre numéro, jamais par édition
  du fichier déjà appliqué.**

Trois choses ont changé depuis le 2026-08-14 :

- ✅ **La fuite inter-organisations par les helpers RLS est refermée** (mig. `100`, appliquée en
  prod le 2026-08-23). Vérifié en base :
  `has_function_privilege('authenticated', 'get_subtree', 'EXECUTE')` → **false**, idem
  `has_subordinates` et `org_admin_count`. Finding + PoC archivés dans
  [`docs/archive/faille-historique.md`](./docs/archive/faille-historique.md).
- 🟠 **Trois findings ouverts par la vague entreprise du 2026-08-23/24** (migrations `103` → `108`) :
  B-1, B-2, B-3.
- ✅ **Les trois sont refermés, dépôt ET production.** Migration `109` appliquée en prod le
  2026-08-24, vérifiée en base immédiatement après (policy, droits d'exécution, `prosecdef`).
  Advisor `anon_security_definer_function_executable` retombé de 5 à **2** — les deux seules
  fonctions volontaires (`preview_share_link`, `record_demo_visit`).

Un seul **bloquant** subsiste côté sécurité, et c'est un point de **résilience**, pas une faille :
le plan Supabase `free`. Tout le reste est du réglage de console Supabase.

---

## ✅ B-1 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `100` a fermé la fuite des helpers en révoquant `EXECUTE` à
`authenticated` sur `get_subtree` — et a réécrit la seule policy qui l'appelait **directement**,
`org_team_members_insert`, en `is_above(org_id, user_id)`. Sept jours plus tard, la mig. `107`
(leads d'équipe) a créé `org_team_members_update` **en réintroduisant le motif supprimé** :

```sql
OR user_id IN (SELECT public.get_subtree(org_id, (select auth.uid())))   -- 🔴
```

Un `WITH CHECK` de policy s'évalue **avec le rôle courant** (`authenticated`), pas avec le
propriétaire : l'appel est refusé au niveau des droits.

**Ce n'était pas une fuite — ça échoue fermé.** C'était une **fonctionnalité cassée en prod** : le
`OR` court-circuite pour un admin et pour quelqu'un qui modifie sa propre ligne, mais dès qu'un
**lead ou manager non-admin** nomme un lead sur un subordonné (`setTeamLead`,
`src/modules/org-teams/supabase.repository.ts`), Postgres renvoie
`ERROR: permission denied for function get_subtree`. Exactement le cas d'usage de la mig. `107`.

**Correctif (mig. 109)** : `public.is_above(org_id, user_id)`, qui est à la lettre
`p_user IN (SELECT get_subtree(p_org, auth.uid()))` (vérifié via `pg_get_functiondef`) — sémantique
identique, droit d'exécution conservé.

**Garde ajoutée** : `npm run check:rls` refuse désormais toute policy citant une fonction révoquée
à `authenticated`. Il rejoue les `GRANT`/`REVOKE` de tout l'historique et évalue l'état final.
Vérifié en réinjectant la régression : le script sort **exit 1** avec le nom de la fonction.
Verrouillé par `scripts/migration-guards.test.mjs`.

## ✅ B-2 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** `invite_friend_to_org` (mig. `105`) n'exigeait que `is_org_member(p_org)`, là
où les deux autres chemins d'entrée dans une organisation sont bien plus stricts — vérifié en prod
sur `pg_policies` :

| Chemin | Qui pouvait l'ouvrir |
|---|---|
| `org_invite_links_insert` (lien / code) | admin **ou** manager ayant des subordonnés (`i_have_subordinates`) |
| `organization_join_requests` (demande spontanée) | l'admin décide (`respond_join_request`) |
| **`invite_friend_to_org` (mig. 105)** | **n'importe quel membre** 🟠 |

Pas d'élévation de privilège (l'entrant arrive `role = 'member'`, `manager_id NULL`) et le quota de
sièges était bien vérifié à l'acceptation ✅ — mais la feuille la plus basse de la pyramide pouvait
faire entrer un tiers, et consommer un siège payant une fois le paywall actif, sans qu'aucun admin
ne l'ait décidé.

**Décision (Axel, 2026-08-24)** : aligner sur le chemin du lien d'invitation. La mig. `109` ajoute
`is_org_admin(p_org) OR i_have_subordinates(p_org)` en tête de la RPC — le **même** prédicat que
`org_invite_links_insert`, pour qu'il n'y ait qu'une seule réponse à « qui peut faire grossir
l'organisation ».

**Le front était déjà aligné, par chance et non par conception** : `OrganizationPage` monte
`InviteFriendsToOrg` sous `isAdmin`, et `AddUnderSheet` sous
`canEdit = isAdmin || isManagerOf(members, currentUserId)` — or `isManagerOf` est, à la lettre,
« quelqu'un a `managerId === moi` », c'est-à-dire `i_have_subordinates`. Aucun changement d'écran
n'a donc été nécessaire ; la clé d'erreur `api.not_allowed_to_invite` est ajoutée aux deux
catalogues comme filet, pas comme parcours attendu.

**Vérifié en base le 2026-08-24** : `invite_friend_to_org(uuid, uuid)` redéployée avec la garde,
signature inchangée.

> ⚠️ **Reste ouvert, non traité** : `org_invitations_select` laisse tout membre lire l'`invitee_id`
> de toutes les invitations, **y compris refusées**, sans date de péremption. Ce ne sont que des
> UUID, mais c'est une trace persistante d'un refus. Cf. [`docs/RGPD.md`](./docs/RGPD.md) §1.
>
> 🟠 **Suivi le 2026-08-27 : ce point devient le finding G-1**, correctif écrit (mig. `130`),
> **non appliqué en production**. Détail ci-dessous.

## ✅ G-1 · `org_invitations_select` · REFERMÉ le 2026-08-29, mig. `130` appliquée

**Ce que c'est.** La policy posée par la mig. `105` est
`(auth.uid() = invitee_id) OR is_org_member(org_id)` : **tout membre** de l'organisation lit
l'`invitee_id` de **toutes** les invitations émises en son nom, y compris celles qui ont été
**refusées**. Autrement dit, « telle personne a refusé de rejoindre cette entreprise » est lisible
par n'importe quel collègue, alors que ni l'inviteur ni le destinataire ne le lui ont partagé.

**Ce n'est pas une élévation de privilège.** Ce ne sont que des UUID : ni email ni nom, la policy
de `profiles` tient toujours la frontière. C'est un défaut de **minimisation** (RGPD art. 5.1.c),
sur une donnée qui est une décision individuelle rattachée à une personne identifiable par
jointure.

**Ce qui avait déjà été fait, et ce qui restait.** La mig. `112` a traité la **péremption** (les
refus de plus de 30 jours sont purgés par `pg_cron`). Elle n'a pas touché au **périmètre** de
lecture : pendant ces 30 jours, et pour toute invitation en attente, toute l'organisation lit la
ligne. *Une purge n'est pas un contrôle d'accès.*

**Correctif (mig. `130`)** : lecture restreinte à trois personnes, le **destinataire**,
l'**inviteur** (il doit voir « en attente » pour ne pas réinviter) et un **admin** de
l'organisation. Une seule policy PERMISSIVE, le `OR` existant est élargi (invariant mig. 049).

**Impact client : nul.** La seule lecture directe de cette table côté application est
`getPendingSentInvitationIds`, qui filtre déjà `inviter_id = auth.uid()`. La boîte de réception du
destinataire passe par `get_my_org_invitations`, une fonction `SECURITY DEFINER` que cette policy
ne gouverne pas.

| État | Détail |
|---|---|
| Dépôt | ✅ `supabase/migration/130_org_invitations_select_narrowed.sql`, `check:rls` et `validate:migrations` verts |
| **Production** | ✅ **APPLIQUÉE le 2026-08-29**, ledger `org_invitations_select_narrowed`. Vérifié en base : une seule policy PERMISSIVE en SELECT ; un membre simple de l'organisation qui porte l'invitation lit **0 ligne** (avant : toutes), témoin sur un second membre simple à 0 ; l'inviteur, le destinataire et l'admin lisent **2 lignes**, inchangé. `check:drift` derrière : aucun objet attendu ne manque |
| Test de base réelle | ✅ `e2e/rls/org-invitations.test.ts` (2026-08-27, soir) · sept cas joués dans **cinq rôles réels** sur la stack Supabase, plus le rôle `anon` |
| Réversibilité | rejouer le bloc `CREATE POLICY` de la mig. `105` |

**Ce que le test ajoute, et pourquoi le commentaire ne suffisait pas.** La migration portait en
pied de fichier une « vérification après application » : trois requêtes à jouer à la main dans
trois rôles. *Un commentaire n'est pas une vérification.* Tant que personne ne les joue, la
migration ne repose que sur une relecture de son propre `USING`, ce qui est exactement la manière
dont B-1 (mig. `107`) est passée : le SQL avait l'air juste.

Le test couvre les trois qui **doivent** voir (destinataire, inviteur, admin), celui qui ne doit
**rien** voir (un membre simple, sur l'invitation en attente **et** sur le refus d'un tiers, la
donnée personnelle en cause), et le rôle `anon`.

> ⚠️ **Un cas est un contre-exemple délibéré** : `etranger` est le destinataire de l'invitation
> refusée. Le test exige qu'il voie **la sienne, et rien d'autre**. Un fichier qui n'attendrait que
> des listes vides passerait aussi bien avec une policy qui n'autorise plus personne : il
> vérifierait qu'on ne fuit rien, pas que le produit marche encore.
>
> 🔴 **Ce test est ROUGE tant que la migration n'est pas appliquée**, et seulement sur le cas du
> membre simple. C'est voulu : c'est ce qui distingue « écrite » de « en vigueur ». Il tourne avec
> `npm run test:rls`, qui exige une stack Supabase locale, donc en CI (job `rls-integration`).

⚠️ `is_org_admin(org_id)` **dépend de la ligne**, contrairement aux deux autres branches. C'est
assumé et documenté dans la migration : `org_invitations` compte des dizaines de lignes par
organisation, pas des milliers. **Ne pas généraliser ce motif à une table volumineuse**, cf. les
mig. `085` / `113` / `128`.

## ✅ B-3 · refermé (mig. 109, appliquée en prod le 2026-08-24)

**Ce que c'était.** La mig. `108` enfreignait deux règles déjà écrites :

1. « Un trigger de garde doit être `SECURITY INVOKER` » (audit du 2026-07-26) —
   `validate_team_task_dependency()` et `prevent_team_task_dependency_cycle()` étaient `DEFINER`,
   alors que la mig. `107`, écrite le même jour, respecte la règle pour
   `freeze_team_membership_identity()`.
2. Pas de `REVOKE … FROM anon` (règle `064b`, réappliquée par `094b`).

**Exploitabilité directe : nulle** (`RETURNS trigger`, Postgres refuse l'appel direct). Mais un
trigger `BEFORE INSERT` s'exécute **avant** le `WITH CHECK` de la RLS : en `DEFINER`, la lecture de
`team_tasks` ignorait la RLS, et les messages d'erreur distinguaient
« `Both tasks must exist` » de « `… single project` » — soit un **oracle d'existence** sur
`team_tasks` hors organisation. Étroit (UUID v4 requis, réponse booléenne), mais c'est la classe
exacte du finding refermé par la mig. `100`.

**Correctif (mig. 109)** : les deux triggers repassent en `SECURITY INVOKER` — le `SELECT`
redevient filtré par la RLS, les deux cas convergent vers `Both tasks must exist`, l'oracle
disparaît — et **quatre** fonctions de trigger sont révoquées pour `anon` **et** `authenticated`
(`validate_team_task_dependency`, `prevent_team_task_dependency_cycle`,
`freeze_team_membership_identity`, `seed_default_categories`).

Ces quatre-là sont exactement celles qui restaient exposées : vérifié en prod le 2026-08-24 sur
les **28** fonctions `RETURNS trigger` du schéma `public`, les 24 autres sont déjà fermées.

**Garde ajoutée** : `npm run validate:migrations` refuse toute nouvelle fonction de trigger sans
`REVOKE` explicite pour les deux rôles, et avertit si elle est `SECURITY DEFINER`. Cliquet à partir
de la mig. `109` — et le contrôle évalue l'**état final** de l'historique, pas chaque fichier
isolément, pour qu'une migration puisse réparer l'oubli d'une précédente.

> **Pourquoi un cliquet et pas un audit rétroactif** : le premier jet, plancher à la mig. `064`,
> sortait 12 erreurs. Vérification en prod : **les 12 étaient des faux positifs** — ces fonctions
> sont déjà révoquées, par des chemins qu'un modèle statique ne voit pas (privilèges par défaut du
> schéma, `REVOKE` hors du jeu de migrations). C'est la limite que `check-rls-advisors.mjs`
> documentait déjà : *un modèle statique de l'historique complet est faux*. Une gate rouge en
> permanence finit ignorée — le remède aurait été pire que le mal.

---

## 🟠 G-2 · aucune vérification de l'adresse email à l'inscription (2026-08-27)

> **DÉCISION D'AXEL, 2026-08-29 : la confirmation d'adresse NE SERA PAS activée pour l'instant.**
> Motif : la friction à l'inscription, sur un produit dont le problème mesuré est l'activation
> (0 compte actif sur 7 jours pour 28 comptes). Chaque étape entre « je veux essayer » et
> « j'utilise » coûte des inscrits, et ce coût-là est certain, quand le risque ci-dessous est
> probabiliste.
>
> **Ce n'est donc plus une tâche en attente, c'est un risque accepté**, et il doit être lu comme
> tel : la moitié « délivrabilité » de G-2 est traitée (SMTP Resend en service le 2026-08-29,
> `npm run check:mail` vert pour la première fois), la moitié « vérification d'identité » reste
> ouverte **par choix**.
>
> Ce que la décision NE change pas : l'interrupteur reste à un clic, le front est prêt
> (`AuthForm` affiche « Vérifiez votre boîte mail », verrouillé par test), et les quatre gabarits
> sont posés en production. Réactivable à tout moment, sans développement.
>
> ⚠️ **À rouvrir si l'un de ces trois faits apparaît** : un compte injoignable signalé au support,
> une inscription avec l'adresse d'un tiers, ou l'arrivée du premier client payant (un compte qui
> paie et qu'on ne peut pas joindre est un litige, plus un désagrément).


**Mesuré en base, pas déduit.** Sur les 28 comptes : `confirmation_sent_at` est renseigné sur
**un seul**, et le délai entre `created_at` et `email_confirmed_at` descend à **15 millisecondes**
(< 10 min sur 27 comptes). Ce n'est pas quelqu'un qui clique vite, c'est de l'auto-confirmation :
**les confirmations d'inscription sont désactivées** sur le projet.

**Ce que ça ouvre.** N'importe qui peut créer un compte portant l'adresse d'un tiers — COSMO
traite alors la donnée personnelle de quelqu'un qui n'a rien demandé, et l'adresse est ensuite
inutilisable par son propriétaire légitime. Symétriquement, une faute de frappe crée un compte
**définitivement injoignable** : sans adresse valide, la réinitialisation de mot de passe ne peut
plus rien pour lui.

**Ce n'est pas une élévation de privilège** : l'inscrit contrôle son propre compte, pas celui d'un
autre, et le tiers ne reçoit rien (aucun email ne part). C'est un défaut de **vérification
d'identité déclarative**, avec un versant RGPD (base légale du traitement d'une adresse fournie
par un tiers).

**Pourquoi ça n'a pas été corrigé en le lisant.** Activer les confirmations sans SMTP applicatif
est **pire** que le défaut : chaque inscription partirait par l'expéditeur intégré de Supabase,
plafonné à quelques envois par heure. GoTrue répond alors `over_email_send_rate_limit`, que
`safeAuthError` traduit par « Trop de tentatives. Réessayez dans quelques minutes. » — exact côté
serveur, **trompeur** côté inscrit, qui n'a rien fait de trop et repart. Les deux gestes ne se
séparent pas.

| État | Détail |
|---|---|
| Front | ✅ **Prêt** : `register()` rapporte `needsEmailConfirmation` quand `signUp` ne renvoie pas de session, et `AuthForm` affiche « Vérifiez votre boîte mail » au lieu de pousser l'inscrit vers un écran protégé qui le rejetterait. Verrouillé par `src/components/AuthForm.confirmation.test.tsx`, **vu rouge** sans le correctif (2 cas sur 3), avec un **témoin** pour le régime actuel |
| Gabarits | ✅ Écrits et versionnés (`supabase/templates/`, quatre emails, en français) |
| Garde | ✅ `npm run check:mail` — **rouge aujourd'hui**, 3 contrôles DNS en échec |
| **Production** | 🟠 **Rien n'est changé.** Le SMTP et le réglage vivent dans deux consoles, hors dépôt |
| Marche à suivre | [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §2ter — **le SMTP d'abord, les confirmations ensuite** |

> ⚠️ **Le sous-domaine d'envoi n'est pas un détail de confort.** La racine `thecosmo.app` porte
> déjà les MX et le SPF d'IONOS, qui servent `contact@thecosmo.app`. Vérifier la racine chez
> Resend et remplacer son SPF couperait l'émission légitime d'IONOS. C'est `send.thecosmo.app`
> qui se vérifie, et la racine ne bouge pas — `check:mail` contrôle les deux, précisément pour
> attraper cette erreur-là.

---

## 🟠 V-1 · le script analytics tiers capte email et nom — mitigé, arbitrage ouvert (2026-09-01)

**Trouvé par `vendor-watch.yml`**, qui échouait à chaque exécution **depuis au moins le
2026-08-29** sans que personne ne lise l'alerte. Le workflow n'était pas cassé : il alertait.
C'est le premier enseignement, et il vaut pour toutes les gardes planifiées — **une alerte que
personne ne lit ne protège rien.**

**Ce qui a changé.** Le script servi à `https://www.vesk.dev/a.js` a gagné une fonction
`tryIdentify()` qui lit les champs d'un formulaire d'inscription, en extrait l'**adresse email**
(160 car. max) et le **nom** (80), et les envoie à `vesk.dev`. Elle se déclenche sur `submit`
**et** sur un clic qui « ressemble » à une inscription — donc dans une SPA sans `submit` natif,
ce qui est exactement notre cas. Elle exige un champ mot de passe et un signe d'inscription : un
formulaire newsletter ne la déclenche donc pas.

**Pourquoi c'est un écart.** Le registre (art. 30, `docs/RGPD-REGISTRE.md` §T8) déclare pour ce
traitement : « adresse de la page, page référente, adresse IP, navigateur. **Sans cookie.** » Ni
email, ni nom, ni identifiant persistant — or le script pose aussi un UUID `_a_cid` en
`localStorage`. **Un consentement recueilli pour une MESURE D'AUDIENCE ne couvre pas la
transmission de l'identité de la personne à un tiers.** Et `/signup` étant une page publique sans
session, les trois conditions de chargement étaient réunies : le script tournait bel et bien là
où l'on saisit son email.

**Ce qui a été fait (2026-09-01).** `src/lib/audience.ts` ne monte plus le script sur les pages
portant un formulaire d'identifiants (`CREDENTIAL_FORM_SEGMENTS` : `signup`, `login`,
`forgot-password`, `reset-password`, `invite`, `org-invite`). On aligne le code sur ce qui est
déclaré, plutôt que l'inverse. La mesure garde sa finalité : landing, blog, guide, cas d'usage.
Cliquet : `src/lib/audience.test.ts`, vérifié rouge sans la garde.

**Le reste de la revue, sans reproche** : aucun `eval`, aucun `new Function`, aucune injection de
script, aucune lecture de `document.cookie`, aucun accès aux champs mot de passe, aucune
obfuscation `atob`. L'endpoint est dérivé de l'origine du script lui-même, et la CSP borne
`connect-src`.

**✅ Arbitré par Axel le 2026-09-01 — option A : on garde Vesk, et on met la déclaration en
conformité.** Motif : Vercel reste le tableau de bord de référence, et les indicateurs
d'engagement de Vesk gardent leur valeur pour la phase d'acquisition qui commence.

Fait dans la foulée :

- `docs/RGPD-REGISTRE.md` §T8 — les données déclarées incluent désormais les indicateurs
  d'engagement **et l'identifiant persistant `_a_cid`**. La mention « sans cookie » a été
  retirée, avec la raison écrite sur place : littéralement vraie, elle laissait croire à
  l'absence de traceur. L'exclusion des pages d'identifiants y est inscrite comme **garde de
  conformité**, pas comme détail d'implémentation.
- `PolitiqueConfidentialitePage.tsx` — trois corrections. La page affirmait « Vesk n'écrit rien
  sur votre appareil » (faux), rangeait la mesure sous l'**intérêt légitime** en §5 alors que
  §7 et le registre disent consentement (deux sections du même document se contredisaient), et
  sa section Cookies ne distinguait pas le strictement nécessaire de ce qui exige un accord.
  Les pages exclues de la mesure sont maintenant nommées pour le visiteur. Une phrase cassée
  qui traînait a été réparée au passage.
- `docs/ROADMAP-60J.md` T-43 — **Vesk ajouté à la liste des DPA à collecter**, dont il était
  absent. Un sous-traitant qu'on oublie de lister est un sous-traitant sans contrat.

**🔴 Ce qui reste, et qui n'appartient qu'à Axel : obtenir le DPA de Vesk** (art. 28). Tant
qu'il manque, ce traitement s'appuie sur un sous-traitant sans contrat de sous-traitance.

⚠️ **Et la vraie leçon de ce finding n'est pas Vesk.** `vendor-watch.yml` a fait exactement son
travail et a échoué chaque jour pendant quatre jours sans que personne ne le lise. Le prochain
changement de ce script sera détecté de la même façon — **et ne servira à rien si l'alerte n'est
pas lue.** Une garde planifiée sans destinataire n'est pas une garde. `OPS_ALERT_WEBHOOK_URL`
existe depuis le 2026-08-29 : y router les échecs de `vendor-watch` fermerait ce trou.

---

## 🟠 Audit des Edge Functions Stripe — 2026-09-02

**Périmètre** : `stripe-webhook` (662 l.), `stripe-org-checkout`, `stripe-org-portal`,
`stripe-create-checkout`, `_shared/org-tiers.ts`, `_shared/org-stripe-prices.ts`, `_shared/alert.ts`,
et `renewal-notice` parce qu'il dépend du même état. Vérifié en base : contraintes, RPC, volumes.

**Aucun finding critique, et ce n'est pas une politesse.** Les gardes qui comptent sont là et sont
justes : signature vérifiée avant toute lecture du corps, marqueur d'idempotence écrit APRÈS le
handler, palier redérivé du price ID et jamais des metadata, refus explicite d'un prix inconnu
plutôt qu'une dégradation au palier gratuit, `getUidFromCustomer` qui refuse un customer portant
`org_id`. Les six findings ci-dessous portent tous sur des chemins d'ERREUR, pas sur le chemin
nominal.

**Mesuré en production le 2026-09-02** : 8 événements Stripe traités (4 `invoice.payment_succeeded`
le 02/07, 4 `customer.subscription.deleted` le 31/07), 0 ligne dans `payment_records`,
0 dans `org_subscriptions`, 54 dans `subscriptions`, 0 doublon de `stripe_customer_id`.

> ⚠️ **Le journal fiscal ne couvre pas ces 8 événements**, et c'est normal : `payment_records`
> naît avec la mig. `125` du 2026-08-26, un mois après. Aucun euro réel n'est concerné (clé Stripe
> de TEST), donc aucune obligation n'a été manquée — mais « le journal couvre tout » est faux, et
> une phrase pareille se dit vite devant un contrôleur.

> ⚠️ **Les numéros de version de ce tableau ont été RECORRIGÉS le 2026-09-14**, relus par l'API
> Management : `stripe-webhook` est en **v33** et `renewal-notice` en **v13**, pas v32 et v12. Ils
> étaient décalés d'une unité — et c'est un défaut instructif : la règle « cite la version
> déployée » a bien été appliquée, mais le chiffre a été **écrit de mémoire juste après un
> déploiement**, donc avant que l'API ne le confirme. Une version se relit, elle ne se déduit pas
> d'un « je viens de déployer ». Le CONTENU, lui, était juste : le job `Edge deploy drift` est vert.
>
> 📋 **Les huit fonctions, relevées par l'API le 2026-09-14 à 15:30 UTC** — `stripe-webhook` **v33**
> (09-13 16:12) · `delete-account` **v17** (09-13 10:16) · `renewal-notice` **v13** (09-13 10:12) ·
> `report-bug` **v12** (09-12 23:08) · `stripe-org-refund` **v6** (**09-14 15:24**) ·
> `stripe-org-checkout` **v15** (09-08 06:31) · `stripe-org-portal` **v12** (09-08 06:32) ·
> `stripe-create-checkout` **v23** (09-06 19:28).
>
> 🔴 **Chaque état ci-dessous cite désormais la VERSION DÉPLOYÉE, pas le commit.** Jusqu'au
> 2026-09-13 ils disaient « ✅ corrigé » en décrivant `main`, et trois d'entre eux étaient FAUX
> de la production : `renewal-notice` en ligne portait encore le défaut S-4, et `stripe-webhook`
> tournait sur un `org-stripe-prices.ts` antérieur. C'est la règle de `CLAUDE.md` — *un « ✅ corrigé »
> qui ne dit pas « déployé le … » décrit un commit, pas la production* — et elle n'était tenue
> nulle part ici. Depuis le 2026-09-13, `npm run check:edge` rend **8 fonctions identiques au
> dépôt** et le job `Edge deploy drift` est vert : ces dates sont désormais vérifiées en continu.

| # | Finding | Gravité | État |
|---|---|---|---|
| S-1 | Le pré-contrôle d'idempotence avalait son erreur → rejeu possible de `bump_win_streak` | 🟡 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-2 | `getUidFromCustomer` avalait son erreur → paiement encaissé, abonnement jamais appliqué | 🟠 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-3 | `subscriptions.stripe_customer_id` sans contrainte UNIQUE, alors que le code en dépend | ✅ | mig. `134` **appliquée en prod le 2026-09-02**, doublon refusé en 23505 (vérifié) |
| S-4 | `renewal-notice` : expéditeur par défaut sur un domaine que Resend ne signera jamais | 🟠 | ✅ corrigé · **`renewal-notice` v13, déployée le 2026-09-13 à 10:12 UTC**. 🔴 Ce « ✅ corrigé » était écrit depuis le 2026-09-02 et la PROD portait toujours le défaut : mesuré le 09-13, la v11 en ligne avait encore `?? 'Cosmo <bug@thecosmo.app>'` |
| S-5 | Un event tardif d'un ANCIEN abonnement peut dégrader l'org qui vient de repayer | 🟠 | ✅ corrigé · **`stripe-webhook` v33, déployée le 2026-09-13 à 16:12 UTC** |
| S-6 | La renonciation au droit de rétractation ne quitte jamais le navigateur | ✅ | corrigé · mig. `135` **appliquée en prod le 2026-09-02**, immuabilité et cloisonnement vérifiés |

### ✅ S-1 · le pré-contrôle d'idempotence avalait son erreur

`const { data: alreadyProcessed } = await …` jetait `error`. Une panne de lecture se lisait donc
« jamais traité », et les handlers repartaient. La plupart sont des upserts, donc idempotents —
**mais pas `bump_win_streak`, qui incrémente**. Un rejeu y ajoutait une victoire jamais gagnée,
c'est-à-dire exactement ce que ce pré-contrôle existe pour empêcher.

**Corrigé** : l'erreur produit un 500, Stripe retente. C'est la même règle que le marqueur écrit
après le handler (faille M-5) : en cas de doute, faire retenter plutôt que deviner.

### ✅ S-2 · une panne de lecture devenait un succès silencieux

Même motif, conséquence plus lourde. `getUidFromCustomer` ignorait l'erreur de sa requête et
rendait `null`. Tous ses appelants font `if (!uid) return` : un **succès** du handler, donc le
marqueur d'idempotence écrit, donc Stripe qui ne re-livre jamais. Un paiement encaissé sans que
l'abonnement soit appliqué, et personne pour le voir passer.

C'est le finding que `orgIdFromInvoice` avait déjà reçu, avec un commentaire de dix lignes
expliquant pourquoi il fallait relancer. **La leçon n'avait pas traversé les vingt lignes qui
séparent les deux fonctions** : la branche entreprise a été durcie, sa jumelle particulière non.

**Corrigé** : l'erreur est relancée. `recordPayment` reste protégé à part — une ligne de journal
sans `user_id` reste une pièce comptable, une ligne absente est un trou.

### ✅ S-3 · le code s'appuyait sur une unicité qui n'existait pas — mig. `134` appliquée le 2026-09-02

`getUidFromCustomer` fait `.maybeSingle()` sur `stripe_customer_id`, qui **lève** au-delà d'une
ligne. Côté organisation, la mig. `101` pose la contrainte UNIQUE, et le commentaire de
`orgIdFromInvoice` la cite comme ce qui rend son appel sûr. Côté particulier, la même hypothèse est
faite et rien ne la garantit (vérifié en base : la contrainte n'existe pas).

0 doublon aujourd'hui sur 54 lignes : latent, sans gardien. La mig. `134` pose un index unique
partiel. **Elle échouera s'il existe un doublon — c'est voulu** : le découvrir en appliquant une
migration vaut mieux que le découvrir sur une facture.

### ✅ S-4 · l'avis de reconduction ne pouvait pas partir

`renewal-notice` portait `BUG_REPORT_FROM ?? 'Cosmo <bug@thecosmo.app>'`. Or le domaine vérifié
chez Resend est `send.thecosmo.app` : la racine porte les MX et le SPF d'IONOS et **ne sera jamais
signée**. Ce défaut ne dégradait pas l'envoi, il le rendait impossible.

Ce qui rend le défaut coûteux, c'est ce que la fonction porte : l'avis de l'article L215-1. Ne pas
l'envoyer ne coûte pas une amende, ça rend l'abonnement annuel **résiliable à tout moment et
remboursable**. `docs/DEPLOYMENT.md` §2ter le disait déjà noir sur blanc ; le code, lui, offrait la
valeur qui échoue.

**Corrigé** : plus de défaut. Sans le secret, la fonction répond 503 et alerte.

### ✅ S-5 · un event tardif peut dégrader une organisation qui vient de repayer

`handleOrgSubscriptionDeleted` filtre sur `stripe_subscription_id`, avec un commentaire qui
explique exactement pourquoi : après un cycle « résiliation puis réabonnement », la livraison
tardive du `deleted` de l'ANCIEN abonnement remettrait au gratuit une organisation qui vient de
payer.

**`applyOrgSubscription` n'a pas ce filtre.** Elle fait un `upsert` sur `org_id` seul. Un
`customer.subscription.updated` tardif portant le statut `canceled` de l'ancien abonnement écrit
donc `tier_key = 'free'`, `max_members = 5`, `current_period_end = null` sur l'organisation qui
vient de souscrire. La garde a été posée sur une porte et pas sur l'autre.

**Corrigé le 2026-09-02.** La garde est ASYMÉTRIQUE, et c'est ce qui la rend juste :

- un event qui **active** fait autorité, d'où qu'il vienne : un nouvel abonnement actif supersède
  le précédent, c'est la souscription elle-même ;
- un event qui **dégrade** (`cancelled`, `past_due`) n'est appliqué que s'il concerne l'abonnement
  actuellement enregistré. Venant d'un autre, il parle par définition d'un abonnement abandonné.

Un simple `.eq()` sur l'upsert ne convenait pas : il aurait empêché la toute première écriture,
quand la ligne n'a encore aucun `stripe_subscription_id`. La lecture préalable relance sur erreur,
comme partout ailleurs dans ce fichier.

⚠️ **Fenêtre de concurrence assumée** : lecture puis écriture, donc deux livraisons simultanées
peuvent lire la même valeur. L'état converge — l'event actif finit toujours par être appliqué, et
une dégradation appliquée à tort est corrigée par le suivant. Verrouiller la ligne coûterait plus
cher que ce que ça protège.

### ✅ S-6 · la renonciation au droit de rétractation ne quitte jamais le navigateur

`OrgBillingTab` recueille les deux cases exigées par l'article L221-28, 13° — accord exprès à
l'exécution immédiate, et reconnaissance de renoncer — sans les pré-cocher, et son commentaire
conclut : « nous laisse la preuve ». **Rien n'est envoyé au serveur et rien n'est enregistré.** Le
corps posté à `stripe-org-checkout` est `{ orgId, tierKey, interval }`.

Deux conséquences. Un appel direct à la fonction avec un JWT valide ouvre une session de paiement
sans qu'aucun consentement ait été donné, alors que les CGU affirment « le paiement ne peut être
engagé sans elles ». Et surtout, **le jour où un client conteste, il n'y a aucune preuve** — alors
que le même dépôt traite `renewal_notices` comme une pièce à produire, avec la règle écrite
« ⚠️ c'est une PREUVE, pas un cache ».

**Corrigé le 2026-09-02**, en trois pièces.

1. Les deux booléens sont **transmis** au serveur, séparément.
2. `stripe-org-checkout` les **exige** strictement à `true`, chacun de son côté : accepter une
   valeur « truthy » reviendrait à accepter `"false"`, et les fondre en un seul drapeau ferait
   exactement ce que le texte interdit — un accord global au lieu de deux accords distincts.
3. La **mig. `135`** crée `withdrawal_consents`, jumelle de `renewal_notices` : append-only,
   immuabilité par TRIGGER (car `service_role` contourne la RLS mais pas un trigger), aucune policy
   d'écriture, lecture ouverte au propriétaire de l'organisation — c'est SA preuve autant que la
   nôtre. La ligne est écrite **avant** la création de la session : l'ordre est la preuve.

L'échec d'écriture est **bloquant**, contrairement à `renewal_notices` qui trace après l'envoi. La
règle n'est pas la même parce que la situation ne l'est pas : là-bas, un avis parti sans trace vaut
mieux qu'un avis jamais parti ; ici, rien n'est encore engagé, donc renoncer ne coûte rien — et
ouvrir une page de paiement en sachant qu'on ne pourra rien produire en cas de litige, c'est
encaisser sans preuve.

> ⚠️ **Une incohérence RESTE dans les CGU, et elle n'appartient qu'à Axel.** L'article 5 bis dit
> « le paiement ne peut être engagé sans elles » — vrai depuis ce correctif — puis « si vous ne
> donnez pas ces confirmations, vous conservez l'intégralité de votre délai de quatorze jours »,
> qui décrit un cas que le produit rend impossible. Deux lectures possibles : soit la seconde
> phrase disparaît, soit le produit accepte de vendre sans renonciation (le client garde alors ses
> quatorze jours, et il faut un chemin de remboursement). C'est un choix produit, pas un correctif.

### Ce que l'audit n'a PAS trouvé, et qui méritait d'être cherché

- Aucun montant n'est calculé côté COSMO au moment de facturer. Le seul endroit qui CHOISIT un prix
  est la dérivation annuelle, et elle vérifie le montant contre la grille avant d'ouvrir la session.
- Aucune donnée de carte ne transite ni n'est stockée. `payment_records.payload` est une copie
  volontairement étroite.
- Les deux fonctions org vérifient `organizations.owner_id` côté serveur, et répondent la même chose
  pour « pas propriétaire » et « org inexistante ».
- `allow_promotion_codes` délègue les coupons à Stripe : aucune surface de brute-force côté COSMO.
- Aucun message d'erreur brut n'est renvoyé à l'appelant.

### 🆕 Hors périmètre de l'audit du 09-02 : `stripe-org-refund` — le chemin qui REND de l'argent

Cette fonction **n'existait pas** le 2026-09-02 : elle est née le 09-12. L'audit ne pouvait donc
pas la voir, et il ne faut pas lire son « aucun finding critique » comme couvrant ce chemin-là.
État relevé le **2026-09-14**, version déployée **v6** (09-14 15:24 UTC), identique au dépôt
(`Edge deploy drift` vert, run `34861975638`).

**Ce qui la protège, et ce que chaque verrou couvre exactement** — ils ne se remplacent pas :

| Verrou | Ce qu'il arrête | Ce qu'il n'arrête PAS |
|---|---|---|
| clé d'idempotence Stripe dérivée de l'`invoice_id` | deux appels **concurrents** | un rejeu tardif : **la clé d'idempotence Stripe expire** |
| pré-contrôle qui RETRANCHE le déjà-rendu (`_shared/refund-replay.ts`) | le rejeu tardif, et le remboursement partiel réémis | rien de ce qui précède l'appel |
| double bornage par l'encaissé (ici + `refundAmount`) | rendre plus que perçu | — |

🔴 **Le deuxième verrou n'a eu AUCUN test jusqu'au 2026-09-14**, alors que cet item déclarait
« une borne » depuis le 09-04. Son arithmétique vivait en ligne dans l'entrypoint Deno, entre deux
appels réseau : inexécutable par quoi que ce soit. Elle est désormais un module TS pur, couvert
par 10 cas (nominal, rejeu, période déjà remboursée, plus un **témoin** qui refuse un zéro
constant), et **vu rouge sur trois sabotages** avant d'être commité.

⚠️ **Deux erreurs symétriques y sont couvertes nommément**, parce qu'elles coûtent de l'argent dans
les deux sens : un remboursement `pending` compte comme rendu (sinon on rembourse par-dessus un
virement en vol) ; un `failed` ou `canceled` ne compte pas (sinon on prive la personne de son
argent après un échec bancaire, définitivement, sans qu'aucun écran ne le dise).

🔴 **Ce qui reste NON PROUVÉ, et qu'aucun test de ce dépôt ne peut prouver** : `refunds.create`, la
résiliation immédiate et la ligne compensatoire négative du journal **n'ont jamais tourné contre
Stripe**. `org_subscriptions` et `payment_records` sont à zéro ligne, il n'existe aucune facture à
rembourser. Et un doute mesurable reste ouvert : le webhook traite **six** types d'events, or
`charge.refunded` n'est arrivé qu'avec la v27 du 09-06 — **rien ne dit que l'endpoint a été mis à
jour avec elle**. Si l'event n'est pas souscrit, la branche est en ligne et ne reçoit jamais rien :
le journal montrerait un encaissement sans son remboursement. Gestes : `a-faire-manuel.md`
**M-37c** puis **M-37b**.

---

### ⚠️ Deux angles morts que cet audit ne pouvait pas couvrir

1. **Le passage en compte live.** `stripe-org-checkout` et `stripe-org-portal` réutilisent le
   `stripe_customer_id` et le `stripe_subscription_id` enregistrés. Ceux d'aujourd'hui vivent dans
   le compte de TEST : le jour où `STRIPE_SECRET_KEY` devient une clé live, un identifiant de test
   présenté à une clé live répond `resource_missing` (404).

   ✅ **Le CODE n'en fait plus un 500** (finding C-71, livré) : `_shared/stripe-errors.ts` expose
   `isResourceMissing`, et les deux fonctions traitent ce cas-là comme « pas de customer » /
   « pas d'abonnement en cours » plutôt que de lever. **Toute autre** erreur Stripe continue de
   relancer — « en cas de doute, faire retenter Stripe, jamais deviner ». Testé
   (`src/modules/billing/stripe-errors.test.ts`).

   🔴 **La DONNÉE, elle, reste à nettoyer**, et c'est la mig. `140` (`reset_stripe_identifiers`),
   **non appliquée**, à jouer DANS la fenêtre de bascule — jamais avant : tant que la clé est une
   clé de test, chaque checkout réécrit un identifiant de test. Geste suivi en `a-faire-manuel.md`
   **M-43**.

   🔴 **« Aujourd'hui `org_subscriptions` est vide, donc le coût est nul » était FAUX d'une table
   sur deux**, et cette phrase portait la décision. Mesuré en prod le 2026-09-04 : `org_subscriptions`
   = 0 ligne, mais **`subscriptions` porte 5 `cus_…` et 2 `sub_…`** du compte de test. Le coût
   n'est pas nul, il est faible — ce qui ne change pas la conclusion (« c'est le bon moment »)
   mais change ce qu'il faut vérifier après la bascule.
2. **Le cache `productIndex`** (`org-stripe-prices.ts`) n'est jamais invalidé en production
   (`resetProductIndex` n'a aucun appelant hors test). Un isolate Deno survit longtemps : après une
   rotation des secrets de prix, il continue d'indexer les anciens produits jusqu'à son recyclage.
   Conséquence bornée (le webhook alerte et Stripe retente), mais elle tombera pile pendant le
   basculement live.

---

## 🔴 Ouvert — bloquant

### A-9 — Plan Supabase `free` : pas de PITR (drill de restauration ✅ exécuté le 2026-09-01)
~~Rétention de backup minimale, aucun Point-In-Time Recovery, et le drill de restauration n'a
jamais été exécuté. **RPO réel jusqu'à 24 h, RTO inconnu.**~~

**Mis à jour le 2026-09-03.** Deux des trois branches sont refermées :

- ✅ **Le drill a été exécuté et réussi le 2026-09-01** : **RTO mesuré 163 s**, 0 table sans RLS,
  129 policies, isolation vérifiée (289 des 724 tâches visibles par un seul utilisateur). Détail
  et bugs de script corrigés en route dans [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §7. Le
  parcours de mutation n'a pas été rejoué à la main : risque résiduel assumé, décision consignée ;
- ✅ **Le RPO est ramené à 24 h** par un dump quotidien (T-46), et non plus mensuel. Le secret est
  posé et la sauvegarde **tourne** : 4 runs quotidiens verts au 2026-09-02, artefact de 385 ko,
  rétention 30 jours ;
- 🔴 **Aucun PITR, et c'est une décision, pas un retard** : rester en plan Free est un arbitrage
  d'Axel du 2026-08-29 (Pro 25 $/mois, PITR 100 $/mois de plus, pour 19 Mo de base et 28 comptes).
  Conséquence à porter en clair, **le plan Free n'inclut AUCUNE sauvegarde** : ce dump est la
  **seule** copie de la base qui existe.

**Action restante** (compte, non scriptable) : passer en plan Pro puis activer PITR, aux seuils de
réouverture nommés dans [`docs/ROADMAP-60J.md`](./docs/ROADMAP-60J.md).

---

## 🟠 Ouvert — réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics dans le Dashboard.

**Relu ligne par ligne le 2026-09-03** : trois des cinq lignes étaient périmées. Ce tableau se
relit contre la console et contre `docs/ROADMAP-60J.md`, jamais de mémoire.

| # | Action | Où | État au 2026-09-03 |
|---|---|---|---|
| A-10 | **Activer « Leaked password protection »** (HaveIBeenPwned) + minimum 12 caractères. | Authentication → Policies | 🟡 **à moitié**. La longueur minimale est posée, et les **trois** endroits disent 12 (code, serveur, texte affiché sous le champ, ce dernier annonçait encore 8). « Leaked password protection » est **réservée au plan Pro**, donc hors de portée tant que T-01 est écarté : l'advisor `auth_leaked_password_protection` restera rouge, et c'est attendu |
| — | ~~**MFA (TOTP) sur le compte admin.**~~ | Authentication | ✅ **FAIT, et en vigueur.** 2FA posée sur le compte Supabase le 2026-08-29 ; côté applicatif, la mig. `131` (appliquée le 08-31) exige une session `aal2` pour `is_admin()`, et le facteur TOTP est **enrôlé et vérifié** depuis le 2026-09-01. ⚠️ Un seul compte au monde ouvre cette console, et la suppression du facteur en SQL est sa seule porte de sortie |
| — | **Vérifier l'allowlist de redirection OAuth** : un wildcard trop large annulerait une partie du bénéfice de PKCE. | Authentication → URL Configuration | ✅ **FAIT le 2026-08-29** (T-07). `/reset-password` y manquait, donc une réinitialisation retombait sur la Site URL au lieu de l'écran de changement de mot de passe. Les deux jokers Vercel sont conservés **sciemment** : le suffixe appartient au compte d'Axel, et `flowType: 'pkce'` rend le code inexploitable depuis une autre origine |
| — | **Activer « Secure email change »** (confirmation sur l'ancienne ET la nouvelle adresse). | Authentication | ✅ **Déclaré posé le 2026-08-29** (T-08), avec « Secure password change ». Marqué **déclaré et non vérifié** : aucun réglage Auth n'est lisible depuis le dépôt, contrairement à `Confirm email` que `/auth/v1/settings` expose |
| — | **Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique** + activer le secret scanning GitHub (le dépôt est **public**). | Supabase + GitHub | 🟡 **à moitié**. Secret scanning, push protection et Dependabot **actifs** (T-09). Une fuite réelle confirmée dans l'historique : `.env` commité au commit initial, retiré du suivi ensuite, ce qui n'efface pas l'historique. **Inerte** : ces clés visent un projet supprimé depuis. 🔴 **Reste la réutilisation du mot de passe, qui n'appartient qu'à Axel** |

---

## 🟡 Ouvert — à planifier

- 🔴 **CORRIGÉ le 2026-09-03 (audit A-6)** : ce point disait « aucune version ne clôt les deux
  familles à la fois sous React 18 ». **Faux depuis le 2026-07-28**, et personne n'était revenu
  vérifier. L'avis `GHSA-qwww-vcr4-c8h2` porte en réalité **deux plages disjointes avec chacune son
  propre correctif** — `[7.12.0, 7.18.2)` corrigée en **7.18.2**, `[8.0.0, 8.3.0)` corrigée en
  8.3.0 — que ce paragraphe avait fusionnées en une seule plage (« ≥ 7.12.0 < 8.3.0 »), masquant le
  correctif intermédiaire. `react-router@7.18.2` (publié le 2026-07-28) est **déjà celui installé**
  (`package-lock.json`), et interrogé pour cette version précise, `npm audit` local et l'API OSV
  rendent tous les deux **zéro** vulnérabilité. `GHSA-wrjc-x8rr-h8h6` (l'open redirect) est lui
  aussi fermé, dès 7.18.0. **Conséquence : ce n'est plus un blocage sécurité.** La migration React
  19 + `react-router` 8 redevient une modernisation ordinaire, sans urgence — chiffrage complet
  dans [`docs/MIGRATION-REACT19.md`](./docs/MIGRATION-REACT19.md).
  ⚠️ Ça ne change rien à la règle : ne toujours pas lancer `npm audit fix` sur ce paquet sans
  relire l'avis, un lockfile différent peut encore proposer une rétrogradation.
  La propriété qui rend l'open redirect inexploitable (aucune navigation alimentée par un
  paramètre d'URL) reste **verrouillée par un test**, sans rapport avec la version installée :
  `src/lib/no-open-redirect.test.ts`.
- **CVE dev-only** (`vitest`, `eslint`, `vite`, `glob`/`minimatch`) : jamais servies au
  navigateur. `npm audit fix --force` casserait le peer `eslint-plugin-react-hooks` (vérifié en
  `--dry-run`) → mise à jour outillage dédiée, jamais dans une passe sécurité.
- ✅ **N6 — `useUser()` lit l'identité depuis `localStorage`** — **fermé le 2026-08-24**, et pas
  par le chemin prévu. La sortie annoncée était « consommer `useAuth().user` » ; en vérifiant les
  consommateurs, `useUser` n'en avait **aucun**. Tout `src/modules/user` était mort à l'exception
  d'un hook qui écrivait dans `cosmo_user` — une clé que plus rien ne relisait, ce qui cachait un
  bug de parcours en mode démo (cf. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §4). Le
  module a été supprimé ; il ne reste plus une seule lecture d'identité depuis `localStorage`.

---

## Ordre de priorité avant déploiement prod (**relue le 2026-09-20**)

Section référencée par [`CLAUDE.md`](./CLAUDE.md) — elle n'existait plus depuis la refonte
documentaire du 2026-08-14, le lien pointait dans le vide. Restaurée ici.

> 🔴 **Cette table est restée « à jour 2026-09-02 » pendant dix-huit jours, et TROIS migrations
> écrites depuis n'y figuraient pas** — dont celle qui répare le seul défaut ouvert que voie un
> utilisateur. C'est le défaut exact que la ligne `Migrations écrites, non appliquées : 0` du
> tableau de composition de la note affichait encore, à sa date de 09-02 : vraie ce jour-là,
> recopiée comme un état courant par quiconque ouvrait la page pour savoir quoi déployer.
> **Une checklist de déploiement qui ne se relit pas à chaque migration écrite n'est pas une
> checklist.** Les trois lignes manquantes sont ci-dessous, **deux refermées le jour même**.

| # | Migration | État au 2026-09-20 | Preuve |
|---|---|---|---|
| **P0** | **`136_work_time_stats_okr_from_completions`** (commitée le 2026-09-03) | ✅ **APPLIQUÉE**, ledger `20260920105113` | `pg_get_functiondef` : la fonction vivante cite `kr_completions` et **plus une seule fois** `history`. `SECURITY INVOKER` conservé, `anon` **f** / `authenticated` **t**, index `idx_kr_completions_user_completed_at` posé. Prouvée **AVANT** en transaction annulée, puis rejouée après : sur un compte réel, `okrTime` passe de `0/0/0/0/0` à `300/180/0/0/0` sur mai→septembre, et `tasksTime`, `eventsTime`, `habitsTime` sont **identiques au chiffre près** (critère 4 de la migration) |
| **P1** | **`140_reset_stripe_identifiers`** | ⏳ **non appliquée, délibérément** | À jouer **DANS** la fenêtre de bascule live, jamais avant : tant que la clé est une clé de test, chaque checkout réécrit un identifiant de test |
| **P2** | **`149_admin_stats_excludes_non_users`** | ✅ **COMMITÉE** (`297ddd14`) **puis APPLIQUÉE**, ledger `20260920105522` | `/admin` annonçait **30 utilisateurs, 779 tâches, 454 événements, 32 habitudes** ; il annonce désormais **28 · 658 · 387 · 26**, plus une clé `excluded_accounts = 2`. Un non-admin est toujours refusé en **42501**. Prouvée en transaction annulée avant application, prod remesurée intacte entre les deux |

> ⚠️ **La `149` a été appliquée par le CLI** (`supabase db query --linked -f`, verbatim depuis le
> fichier, pour qu'aucune recopie ne s'interpose sur 374 lignes), **donc sa ligne de ledger a été
> insérée à la main** : le CLI n'inscrit rien, contrairement à `apply_migration`. C'est le même
> chemin que la mig. `145`, avec le même piège — refaire ce chemin sans l'insertion laisserait une
> migration appliquée et invisible du ledger. Le ledger porte **140** entrées après coup.
>
> ⚠️ **Ce que la `136` ne répare pas, et qui se verra tout de suite** : le temps OKR vaut
> `Σ minutes estimées du KR` par complétion. Sur le compte principal, **3 Key Results sur 5
> portent `estimated_time = 0`**, et ce sont ceux des 95 complétions d'août et septembre :
> ces deux mois **restent à zéro**, légitimement. ❌ Ne pas relire ce zéro comme un échec du
> correctif. Mai et juin, portés par les deux KR à 60 min, passent bien à 300 et 180.

⚠️ **La `146` est le contre-exemple, et il est instructif** : elle n'a **aucune entrée au ledger**
mais `events.review_dismissed_at` existe bel et bien en base. Une absence au ledger ne prouve donc
pas qu'une migration manque, exactement ce que dit l'angle mort **D-1**. Seul
`npm run check:migration-coverage` tranche, fichier par fichier.

| # | Action | Nature | Qui | État |
|---|---|---|---|---|
| 0 | **`npm run test:coverage`** bloquait tout déploiement (3 seuils manqués). 115 tests de repository ajoutés, seuils du glob remontés | 🔴 CI | · | ✅ **verte au 2026-08-25 en fin de journée**, cf. [`docs/TESTING.md`](./docs/TESTING.md) |
| 1 | Migrations `109`/`110` (B-1, B-2, B-3 + notifications de commentaire) | 🟠 sécurité + feature | — | ✅ **appliquées et vérifiées en prod le 2026-08-24** |
| 1bis | Migrations `115` → `123` (permissions, FK RGPD, RPC indexables, Realtime, payload borné, fuseau des habitudes, périodicité de facturation) | 🟠 sécurité + perf | · | ✅ **appliquées et vérifiées en prod le 2026-08-25** |
| 1ter | **Migration `130`** (G-1 · lecture d'`org_invitations` restreinte au destinataire, à l'inviteur et aux admins) | 🟠 minimisation RGPD | Claude applique et vérifie, sur demande d'Axel | ✅ **appliquée et vérifiée en prod le 2026-08-29** · parité mesurée acteur par acteur sur les données réelles, `check:drift` propre derrière |
| 1quater | **G-2 — SMTP applicatif pour Auth** ([`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) §2ter) | 🟠 délivrabilité | Axel (deux consoles, non scriptable) | ✅ **EN SERVICE le 2026-08-29** · domaine `send.thecosmo.app` vérifié chez Resend, SMTP posé, limite d'envoi relevée, 4 gabarits collés, email de réinitialisation reçu depuis `noreply@send.thecosmo.app`. `npm run check:mail` **vert pour la première fois**. ⚠️ La confirmation d'adresse reste **volontairement désactivée** (décision d'Axel, cf. section G-2) |
| 1quinquies | **Migration `134`** (S-3 · un customer Stripe ne désigne qu'un seul compte) | 🟠 intégrité facturation | ~~Axel applique~~ appliquée par agent | ✅ **APPLIQUÉE le 2026-09-02** · 0 doublon sur 54 lignes mesuré avant, doublon refusé en 23505 après |
| 1sexies | **S-5** — un event Stripe tardif peut dégrader une org qui vient de repayer | 🟠 revenu | — | ✅ **corrigé le 2026-09-02**, garde asymétrique dans `applyOrgSubscription` |
| 1septies | **Migration `135`** (S-6 · preuve de renonciation au droit de rétractation) | 🟠 preuve juridique | ~~Axel applique~~ appliquée par agent | ✅ **APPLIQUÉE le 2026-09-02**, donc AVANT tout déploiement des fonctions · append-only vérifiée : UPDATE et DELETE refusés même au rôle privilégié |
| 2 | **Réglages de console Supabase** : A-10 (leaked password protection), MFA sur le compte admin, allowlist de redirection OAuth, secure email change | 🟠 clics Dashboard, ~30 min cumulés | **Axel** | ⏳ **en attente** |
| 3 | **A-9 — plan Pro + PITR + drill de restauration** | 🔴 résilience, seul bloquant | **Axel** (compte, non scriptable) | ⏳ **en attente** |
| 4 | Test de bout en bout de l'attribution `?ref=` (cf. [`docs/ACQUISITION.md`](./docs/ACQUISITION.md) §3) | 🟡 exige une vraie inscription | **Axel** | ⏳ **en attente** |
| — | Garde `check:rls` « fonction citée par une policy exécutable par `authenticated` » | prévention (aurait attrapé B-1) | — | ✅ **livrée**, testée |
| — | Garde `validate:migrations` « fonction de trigger révoquée + `SECURITY DEFINER` signalé » | prévention (aurait attrapé B-3) | — | ✅ **livrée**, testée |
| — | Règle ESLint `no-restricted-imports` sur l'alias `@/` | prévention de dérive | — | ✅ **livrée** |

Les trois dernières lignes comptent autant que les correctifs : B-1 et B-3 sont deux **régressions
de règles déjà écrites**, chacune arrivée dans la migration qui suivait celle qui posait la règle.
*Une règle non vérifiée par un script n'est pas une règle* — et une garde qu'on n'a jamais vue
rouge n'est pas une garde, d'où `scripts/migration-guards.test.mjs`.

## Règles durables issues des audits

Ces règles ont chacune coûté un finding. Elles s'appliquent à tout nouveau code.

- **Un réglage qui vit dans une console d'éditeur n'est vérifié par personne** (G-2, 2026-08-27).
  Le dépôt gouverne son code, ses migrations et ses secrets — mais ni les réglages
  d'authentification Supabase, ni la zone DNS. Six semaines d'audits n'ont pas vu que les
  confirmations d'inscription étaient désactivées, parce qu'**aucune de ces surfaces n'apparaît
  dans un `grep`**. À chaque fois qu'un comportement du produit dépend d'un réglage hors dépôt,
  écrire le script qui va le lire là où il vit : `check:mail` interroge le DNS, comme
  `check:drift` interroge la base. Sinon la doc décrit une intention, jamais un état.
- **Une purge n'est pas un contrôle d'accès** (G-1, 2026-08-27). La mig. `112` faisait expirer les
  refus d'invitation au bout de 30 jours ; pendant ces 30 jours toute l'organisation les lisait.
  Borner la **durée** d'une donnée et borner son **public** sont deux gestes distincts, et le
  premier donne l'illusion d'avoir fait le second.
- **Un indice d'affichage persisté n'est jamais une autorisation** (2026-08-27, `wasOrgMember`).
  Un drapeau posé dans `localStorage` pour réserver la place d'une entrée de navigation doit
  rester **sans effet sur la donnée** : l'écran cible redirige toujours quand la vérité arrive, et
  la RLS gouverne toujours la lecture. Le jour où un tel indice décide d'un affichage de contenu,
  il devient une décision d'accès prise côté client.

- **La RLS dit ce qu'on a le DROIT de lire, jamais ce qu'on VEUT compter.** Une fonction de calcul
  métier doit filtrer explicitement (`user_id = auth.uid()`), sinon son périmètre change au gré
  des policies — c'est ainsi que `get_work_time_stats` s'est mise à agréger tout un sous-arbre
  managérial (A-1, corrigé mig. 085).
- **Une RPC `SECURITY DEFINER` n'est pas protégée par la RLS** : son périmètre ne tient qu'à sa
  propre logique. Elle doit donc être testée contre une vraie base
  (`e2e/rls/get-my-tasks.test.ts`), pas mockée, et `REVOKE` pour `anon` (A-5).
- **Une règle non vérifiée par un script n'est pas une règle** : les invariants RLS ne vivaient
  que dans la doc et avaient déjà régressé trois fois (mig. 059, 077, 082). D'où
  `npm run check:rls`, bloquant en CI (A-4).
- **`auth.uid()` doit être wrappé** — même imbriqué dans un argument de fonction
  (`get_subtree(org_id, auth.uid())`), sinon il est ré-évalué par ligne. **Les advisors Supabase
  ne voient pas ce cas** : ils ne descendent pas dans les arguments d'appel (A-2).
- **Une seule policy PERMISSIVE par rôle + action** (mig. 049) : élargir le `OR` existant, ne
  jamais en créer une seconde.
- **La RLS ne filtre pas les colonnes.** Auditer aussi `information_schema.column_privileges`
  (audit du 2026-07-26, mig. 083).
- **Toute table technique qui grossit doit avoir une purge** : `processed_stripe_events` (A-6,
  rétention 90 j) ; toute sauvegarde de données personnelles doit avoir une date de péremption
  (A-11, RGPD art. 5.1.e).
- **Frontière de sécurité = RLS + whitelist `mapToDb`.** zod est une garde UX, pas une frontière.
  `mapToDb` ne doit **jamais** émettre `user_id` ni `recurrence_parent_id`.
- **Un trigger de garde doit être `SECURITY INVOKER`** (audit 2026-07-26) — et une fonction de
  trigger doit être `REVOKE`-ée pour `anon` (mig. `064b`, `094b`). Enfreint par la mig. `108`
  (B-3) alors que la mig. `107`, écrite le même jour, respecte la règle : **une règle qu'aucun
  script ne vérifie régresse dès la migration suivante**.
- **Un helper `SECURITY DEFINER` ne doit pas être exposé en RPC** : le corriger par un `REVOKE`
  suffit, parce que dans une fonction `SECURITY DEFINER` le rôle effectif est le propriétaire —
  mais **une policy, elle, s'évalue avec le rôle courant**. Toute policy qui appelle un helper
  directement a donc besoin d'un helper resté exécutable (mig. `100` ; régression B-1 avec la
  mig. `107`).
- **Un trigger `BEFORE` s'exécute avant le `WITH CHECK` de la RLS.** En `SECURITY DEFINER`, ses
  messages d'erreur deviennent un canal d'information sur des lignes qu'on n'a pas le droit de
  lire (B-3).
- **Un correctif appliqué en prod se versionne sous son propre numéro**, jamais par édition du
  fichier déjà appliqué. Sinon le ledger porte une version que le dépôt ne contient pas, et
  personne ne le voit tant que rien ne rejoue les migrations à blanc (`119b`, 2026-08-25 : sans
  gravité cette fois, le contenu était identique, mais c'est le mécanisme exact de la dérive
  repo ↔ prod).
- **Une nouvelle surface d'autorisation se livre avec son test contre une base réelle**, dans le
  même commit. Une policy ne se prouve pas par relecture : `e2e/rls/org-permissions.test.ts`
  (mig. `115`) est le modèle à suivre.

---

## Migrations

L'état des migrations n'est **pas** décrit ici — il périme trop vite. Sources de vérité :

```bash
npm run validate:migrations   # garde statique (CI)
npm run check:rls             # invariants RLS (CI)
npm run check:drift           # dérive repo ↔ prod, 2 étapes (cf. docs/DEPLOYMENT.md)
```

Repo au 2026-08-25 : **127 fichiers, dernière = `123_org_subscriptions_billing_interval.sql`**,
**toutes appliquées en prod**, `115` → `123` déployées le 2026-08-25, après `111` → `114`.

Vérifié en base le 2026-08-25 (`supabase_migrations.schema_migrations`) :
- `115_org_member_permissions` → `123_org_subscriptions_billing_interval` présentes, dans l'ordre.
- `122_habits_local_date` (le fuseau du client décide de « aujourd'hui ») et `123` (colonne
  `billing_interval`) appliquées le soir du 2026-08-25.
- ⚠️ Le ledger porte **une entrée de plus que le dépôt** :
  `119b_habits_bounded_payload_future_guard`. Contenu relu et comparé au fichier `119` du dépôt :
  **identique**. Cf. l'avertissement de l'État global.
- Aucune migration en attente. `npm run check:drift` reste l'outil de référence avant tout
  déploiement comportant une migration.

Vérifié en base lors de la vague précédente (2026-08-24) :
- `team_categories` existe, avec `team_projects.category_id` / `team_tasks.category_id` (111).
- Le job `cosmo-prune-declined-invitations` est planifié et actif, `30 3 * * *` (112).
- `get_my_team_projects` / `get_my_team_tasks` exécutables par `authenticated` uniquement (`anon`
  et `public` révoqués), `my_team_project_ids` fermée à tout le monde (113 — c'est la migration qui
  débloquait le déploiement front : `main` appelle déjà ces deux RPC).
- `touch_last_seen` / `record_demo_visit` portent la rétention 400 j (114).
- Advisors relus après coup : aucune erreur, aucune fonction `anon`-exécutable de plus que les deux
  volontaires (`preview_share_link`, `record_demo_visit`).

- `099` → `108` : **appliquées en prod** (ledger relu le 2026-08-24), y compris la `100` qui
  referme la fuite des helpers.
- `109` (correctifs B-1/B-2/B-3) et `110` (notifications de commentaire) : **appliquées et
  vérifiées en prod le 2026-08-24**. Elles portent leur propre bloc de vérification SQL en fin de
  fichier.

> ⚠️ Ces deux dernières lignes ont dit « écrites, PAS appliquées » pendant vingt-quatre heures
> alors que le haut du même fichier disait le contraire, et vrai. Un document de sécurité qui se
> contredit sur l'état de la production est pire qu'un document absent. **Relire ce bloc à chaque
> application, pas seulement l'en-tête.**

Procédure d'application, checklist de rédaction d'une migration et pattern RLS obligatoire :
[`docs/SECURITY.md`](./docs/SECURITY.md). Réconciliation du ledger :
[`supabase/migration/README.md`](./supabase/migration/README.md).

---

## Stripe

**Audité pour la première fois le 2026-09-02** — voir la section « Audit des Edge Functions
Stripe » plus haut. La plomberie est complète et déployée ; ce qui manque n'est pas du code.

- L'encaissement est **désarmé** : `ENTERPRISE_BILLING_ENFORCED = false` ET
  `billing_flags.enterprise_seat_limit = false` (mig. `124`). Les deux drapeaux se déplacent
  ensemble, cf. [`CLAUDE.md`](./CLAUDE.md).
- `STRIPE_SECRET_KEY` est une clé de **TEST**. Les customers et abonnements enregistrés vivent donc
  dans le compte de test.
- 🔴 **Le basculement en compte live doit remettre à zéro les identifiants Stripe en base**
  (`org_subscriptions.stripe_customer_id` / `stripe_subscription_id`, idem `subscriptions`) :
  `stripe-org-checkout` et `stripe-org-portal` les réutilisent tels quels, et un identifiant de test
  présenté à une clé live répond 404, donc 500. Les deux tables sont vides ou presque
  aujourd'hui — c'est le moment le moins cher pour le faire.
- Secrets nécessaires : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
  (particulier), les quatre `STRIPE_ORG_PRICE_*` mensuels (les annuels se dérivent, cf.
  `_shared/org-stripe-prices.ts`), et l'endpoint webhook côté Stripe.
  Détails : [`docs/POST-AUDIT-GUIDE.md`](./docs/POST-AUDIT-GUIDE.md).
