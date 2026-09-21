# Gardes et scripts · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16, **sans une coupe**. Règles transversales :
> [`CLAUDE.md`](../CLAUDE.md) à la racine.

---

## 📋 Inventaire des gardes · une ligne par commande

> **Descendu de [`CLAUDE.md`](../CLAUDE.md) le 2026-09-21**, la racine étant à 96,7 % de son
> plafond alors que **24 gardes posées le 2026-09-21** (`2b4c4304`) n'y figuraient pas. La racine
> garde les commandes du quotidien et renvoie ici pour l'inventaire.
>
> ⚠️ **Cette table ne porte QUE la commande et ce qu'elle regarde.** Ses pièges et ses mesures
> datées vivent dans le doc cité en fin de ligne. ❌ Elle ne dit pas qu'une garde est juste : la
> section suivante existe précisément parce que quatre d'entre elles répondaient sans mesurer.

| Commande | Ce qu'elle regarde | Item | Détail |
|---|---|---|---|
| `validate:migrations` | garde statique sur les `.sql` | | `docs/SECURITY.md` |
| `check:rls` | invariants RLS | | `docs/SECURITY.md` |
| `check:drift` | dérive dépôt ↔ prod (2 étapes) | | `docs/SECURITY.md` |
| `check:migration-coverage` | fichiers de migration ↔ ledger de PROD | | `docs/SECURITY.md` |
| `check:edge` | code **déployé** des Edge Functions vs dépôt | `C-35` | `supabase/functions/CLAUDE.md` |
| `check:edge-smoke` | le **comportement** en ligne, là où `check:edge` ne compare que le code | `C-91` | `supabase/functions/CLAUDE.md` |
| `check:deploy` | le commit **servi** en prod vs le dépôt | `T-8` | `docs/DEPLOYMENT.md` |
| `check:supabase-posture` | advisors Supabase + réglages de Dashboard, lus par l'API | `C-88` | `docs/SECURITY.md` |
| `check:env` | contrat des variables d'environnement Vercel | `C-105` | `docs/DEPLOYMENT.md` |
| `check:bundle` | budget de bundle | | `docs/PERFORMANCE.md` |
| `analyze:entry` | qui pèse dans le chunk d'entrée | | `docs/PERFORMANCE.md` |
| `profile:landing` | profil du fil principal (Playwright) | | `docs/PERFORMANCE.md` |
| `check:db-cost` | coût serveur et croissance, en continu | `C-87` | `docs/SCALABILITY.md` |
| `check:cycles` | cycles d'imports (`wc -l` n'est pas un proxy de complexité) | `C-103` | `docs/ARCHITECTURE.md` |
| `check:test-floor` | un test supprimé avec le code qu'il gardait | `C-83` | `docs/TESTING.md` |
| `check:sabotages` | **rejeu** des témoins : un témoin jamais rejoué ne garde rien | `C-81` | `docs/TESTING.md` |
| `check:tooling-coverage` · `check:edge-coverage` | couverture de l'outillage et des Edge Functions | `C-82` | `docs/TESTING.md` |
| `check:keyboard-coverage` | surfaces réellement mesurées au clavier | `C-96` | `docs/ACCESSIBILITY.md` |
| `i18n:check` | parité des clés `fr` ↔ `en` | | `docs/I18N.md` |
| `i18n:scan` | chaînes d'interface en dur, cliquet à **0** | `C-38` | `docs/I18N.md` |
| `i18n:identical` | valeurs `en` recopiées du `fr`, cliquet à **0** | `C-21` | `docs/I18N.md` |
| `i18n:namespaces` | catalogues rendus par le SHELL | | `docs/I18N.md` |
| `i18n:pages` | **corps** des pages prérendues par locale, pluriels, formats | `C-99` | `docs/I18N.md` |
| `check:seo` | sitemap ↔ pages réellement prérendues, 4 balises par page | `C-98` | `docs/SEO.md` |
| `check:acquisition` | une action d'acquisition reliée à son résultat | `C-101` | `docs/ACQUISITION.md` |
| `check:legal` | tableau de conformité | | `docs/LEGAL.md` |
| `check:legal-journal` | une modification des CGU est un **changement de contrat** | `C-107` | `docs/LEGAL-JOURNAL.md` |
| `check:retention` | durées de conservation confrontées à la **donnée** | `C-93` | `docs/RGPD-REGISTRE.md` |
| `check:erasure` | couverture d'effacement, sans liste en dur | `C-92` | `docs/RGPD.md` |
| `check:portability` | export art. 20 comparé à l'inventaire des colonnes | `C-94` | `docs/RGPD.md` |
| `check:stripe-prices` | grille **Stripe** comparée au code | `C-106` | `docs/STRIPE-LIVE.md` |
| `check:docs` | plafonds et pointeurs des `CLAUDE.md` | | ce fichier |
| `check:docs-scored` | chaque doc de `docs/` déclare son rapport à une note | `C-109` | `docs/README.md` |
| `check:study` | une **étude** décrit encore les versions installées | `C-108` | `docs/MIGRATION-REACT19.md` |
| `check:mail` | SPF / DKIM / DMARC — **pas une gate** | | `docs/DEPLOYMENT.md` |
| `images:check` | images non optimisées — **pas une gate** | | `docs/PERFORMANCE.md` |

🔴 **Quatre de ces gardes ne mesurent rien tant qu'un geste manuel n'est pas fait**, et elles sont
vertes ou rouges pour des raisons qui ne parlent pas du produit : `check:supabase-posture` attend
la référence des réglages d'auth (`C-88`, **échoue exprès** tant qu'elle n'est pas posée),
`check:env` attend `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` (`C-105`), le tri des premières alertes
CodeQL reste à faire (`C-89`), et la mig. `150` n'est **pas appliquée** (`C-110` : `/admin`
affiche « non installé »). Ces quatre gestes sont au § 9 d'[`a-faire-manuel.md`](../a-faire-manuel.md).

---

### 🛡️ Une garde se vérifie sur ce qu'elle REGARDE (passe du 2026-09-03)

**En cinq jours, QUATRE gardes ont été prises en train de répondre sans mesurer.** C'est le constat
le plus lourd de la fenêtre 08-30 → 09-03, et il ne porte pas sur le produit :

| Garde | Ce qu'elle affirmait | Ce qu'elle regardait vraiment |
|---|---|---|
| `check:bundle` | chemin critique à 321,2 ko | un build sans Sentry, ~45 ko de moins que ce qui part en prod |
| `uptime.yml` | run **vert**, « tout va bien » | le site répond ; la moitié backend était sautée sur un secret inexistant |
| `restore-drill.yml` | isolation vérifiée | `tail -1` capturait le mot `ROLLBACK`, jamais le compte : le contrôle **ne pouvait pas** échouer |
| `i18n:scan` | « plus aucune chaîne d'interface en dur » | une heuristique aveugle à quatre formes entières |

- ❌ **Ne jamais conclure d'un « exit 0 » qu'une garde a mesuré.** La question n'est pas « tourne-t-elle ? »
  (règle du 2026-08-29, insuffisante) mais **« sur quoi ? »**. Les quatre ci-dessus tournaient.
- ❌ **Ne jamais laisser une garde sauter silencieusement une moitié de son travail.** Un secret
  absent se solde par un **échec**, jamais par un `::warning::` dans un run vert.
- ✅ **Toute garde corrigée repart avec un TÉMOIN** : une sonde qui refuse un parseur, un détecteur
  ou une mesure qui ne détecterait plus rien. Trois des quatre en ont un aujourd'hui.
- 🔴 **Une garde qui se trompe dans le sens rassurant est pire qu'une garde absente : elle donne
  une réponse, et on la croit.**

#### Le cas symétrique : ce que AUCUNE garde ne regardait (C-35)

Les quatre lignes ci-dessus sont des gardes qui mesuraient à côté. Le défaut jumeau est une zone
que **rien** ne mesure, et il est plus difficile à voir : il n'y a pas de run vert à mettre en
cause, juste un silence qu'on prend pour un accord.

**Le code déployé des Edge Functions était cette zone.** Le 2026-09-03, les trois sources en ligne
ont été relues via l'API Management et comparées à `main` : les trois divergeaient, de trois façons
différentes. `delete-account` exécutait une variante **absente du dépôt** ; `renewal-notice` et
`report-bug` portaient le défaut S-4 que `faille.md` déclare corrigé. Remesuré le 2026-09-04 : la
`report-bug` v8 en ligne porte toujours `?? 'Cosmo <bug@thecosmo.app>'` là où le dépôt ne porte plus
de valeur par défaut.

- ❌ **Ne jamais conclure d'une lecture de `supabase/functions/` qu'une Edge Function fait ce que le
  dépôt dit.** Le dépôt décrit ce qu'on a écrit, pas ce qui s'exécute. `npm run check:edge` est le
  seul lien entre les deux.
- ❌ **Ne jamais écrire un statut de finding sur une Edge Function sans citer sa version déployée.**
  Un « ✅ corrigé » qui ne dit pas *déployé le …* décrit un commit, pas la production.
- ⚠️ Un déploiement n'événemente rien dans la CI : c'est pour ça que le job tourne aussi **à
  l'heure**, et pas seulement sur `push`. La dérive du 09-03 est née d'un déploiement, pas d'un
  commit.

### 📣 Une alerte que personne ne lit est une archive, pas une alerte

`vendor-watch.yml` a fait exactement son travail : il a détecté que le script de mesure d'audience
chargé sur les pages publiques s'était mis à extraire **l'adresse email et le nom** saisis à
l'inscription, il a échoué **chaque jour du 2026-08-29 au 2026-09-01**, il a mis son issue à jour à
chaque fois, et personne ne l'a ouverte pendant quatre jours.

- Les échecs de garde sont désormais **poussés** sur `OPS_ALERT_WEBHOOK_URL` (`ci-alert.yml`), même
  format que `opsAlert()` des Edge Functions, avec un exercice à blanc en `workflow_dispatch`.
- ✅ **Le canal DÉLIVRE, mesuré le 2026-09-13.** Le secret est dans les secrets **Actions** depuis
  le **2026-09-02 à 09:13:47 UTC** (`gh secret list`), l'exercice à blanc a été joué le 09-02 **et
  rejoué le 09-13** — `Alerte poussee (HTTP 204)` les deux fois — et **73** alertes réelles sont
  parties depuis, dont les 14 échecs de `Edge deploy drift`.
  ⚠️ **Ce fichier a écrit « le canal reste INERTE » pendant onze jours après la pose du secret**,
  parce que la phrase a été recopiée au lieu d'être relue à sa source : une commande d'une seconde.
  ✅ **LU PAR UN HUMAIN, le 2026-09-13 à 18:28 (heure de Paris).** Capture du salon `#général` à
  l'appui, et les DEUX sources y arrivent : `ci-alert.yml` (« [cosmo/ci] Edge deploy drift en echec
  sur main ») et `opsAlert()` **depuis une Edge Function** (« [cosmo/renewal-notice] CRON_SECRET
  absent »). Le second chemin n'avait jamais été vu délivrer non plus.
  ⚠️ **Un HTTP 204 ne prouvait pas qu'on lit le salon**, il prouvait que l'endpoint acceptait. Le
  204 reste la mesure automatique ; la lecture, elle, ne se prouve qu'ainsi — quelqu'un qui montre
  le message. Aucune garde ne rendra jamais ce verdict-là.
- 🔴 **Ne jamais rendre une garde conditionnelle à la présence de son propre secret**, et la règle
  s'est appliquée à `ci-alert.yml` lui-même le **2026-09-13** : son étape de push sortait en **0**
  dans les deux cas où rien n'était parti (secret absent, webhook qui refuse), avec un `::warning::`
  dans un run vert — le motif exact retiré d'`uptime.yml` le 09-03 et de `renewal-notice.yml` le
  09-04, resté dans le seul fichier dont le métier EST d'alerter. La logique vit désormais dans
  `scripts/ops-alert.mjs` : secret absent ou refus après 3 tentatives = **`exit 1`**.
  ❌ L'argument « on ne peut pas alerter sur l'alerting » ne tient pas : **un job ROUGE est l'alerte
  sur l'alerting** (GitHub notifie l'échec d'un run sur son propre dépôt), le vert ne notifie rien,
  et l'issue `ci-red` étant écrite par une étape antérieure, échouer à la fin ne perd aucun filet.
  ⚠️ **Pas de shebang** sur `scripts/ops-alert.mjs` : son témoin l'importe, et la chaîne Vite/vitest
  ne retire pas le shebang que Node retire. Témoin : `scripts/ops-alert.guard.test.mjs`, 14 cas, vu
  rouge sur **six** sabotages, dont un `deliver` qui répond 204 sans rien poster.

