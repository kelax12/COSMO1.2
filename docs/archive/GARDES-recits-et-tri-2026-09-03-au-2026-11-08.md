> ⚠️ **ARCHIVE : récits d'incident des gardes (2026-08-29 → 2026-10-16) et mesures du tri V18.1 de l'outillage (2026-11-08), extraits de `scripts/CLAUDE.md` et de `docs/TESTING.md` le 2026-11-08, non maintenus.**
> Chaque passage décrit l'état **à sa date**. État courant : [`docs/TESTING.md`](../TESTING.md) § « Gardes : classes et outils standards », et [`scripts/CLAUDE.md`](../../scripts/CLAUDE.md) (inventaire classé, retraits, règles).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Le tri du 2026-11-08 (V18.1, MAI-02)

🔴 **Constat de l'audit externe du 2026-11-06** : outillage maison disproportionné. Mesuré au
départ du tri (`305bb463`) : `scripts/` à 173 fichiers et 41 572 lignes (l'audit en comptait
139 et 22 600), 34 workflows, 47 gardes `check:` / `i18n:` / `validate:` (`docs/FAITS.md`). Après le tri : 44, `check:docs-scored` ayant été retiré le même jour par V19.4 (ADR 0014).

**Où passe le temps du noyau** (run `42465975014`, 2 min 53, 12 derniers runs de `main` entre
2 min 53 et 5 min 18) : le job `noyau` fait le chemin critique, dont `test:coverage` 1 min 54,
`tsc -b` 18 s, `lint` 12 s, couverture de l'outillage 11 s. Les 18 gardes statiques de
`lint-test-build` tiennent en **7 s à elles toutes** : retirer des `check:*` allège la
maintenance, pas la durée. `rls-integration` et `contrat-donnees` démarrent chacun leur stack
Supabase (~1 min 40), en parallèle : les fusionner épargnerait des minutes facturées, pas de
la durée.

**Les workflows, un par un** (runs : 300 derniers au plus, au 2026-11-08) :

| Workflow | Classe | Runs / échecs | Motif |
|---|---|---|---|
| `ci-noyau.yml` | NOYAU | 113 / 35 | le verdict du commit |
| `ci-vert.yml` | NOYAU (porte) | 47 / 1 | tag `ci-vert/<sha>` lu par Vercel (V3.2) |
| `ci-alert.yml` | PLANIFIÉE | 300 / 1 | issue `ci-red`, webhook, règle des 7 jours |
| `ci.yml` (`CI etendue`) | PLANIFIÉE | 300 / 124 | e2e et Lighthouse ; `audit` retiré (Dependabot) |
| `codeql.yml` | REMPLACANT actif | 300 / 1 | analyse statique standard |
| `visual.yml`, `captures-regenerer.yml` | PLANIFIÉE | 300 / 98 | régression visuelle (vagues 6 à 15) |
| `sabotages.yml` | PLANIFIÉE | 179 / 11 | rejeu des témoins + couverture de l'outillage |
| `mutation.yml` | PLANIFIÉE | 4 / 1 | Stryker, périmètre argent |
| `gardes-calendrier.yml` | PLANIFIÉE | 2 / 0 | gardes qui lisent une date |
| `posture.yml` | PLANIFIÉE | 60 / 39 | advisors Supabase, rétention, coût, env |
| `migration-coverage.yml` | PLANIFIÉE | 133 / 29 | fichiers ↔ ledger et catalogue de prod |
| `edge-deploy-drift.yml` | PLANIFIÉE | 121 / 68 | code déployé et sondes Edge (C-35) |
| `deploy-sha-drift.yml` | PLANIFIÉE | 254 / 6 | commit servi par Vercel |
| `secrets-age.yml`, `restore-drill-fraicheur.yml`, `indicateurs.yml` | PLANIFIÉE | | vagues récentes, inchangés |
| `prod-errors.yml`, `stripe-prices.yml`, `seo-signals.yml`, `uptime.yml`, `smoke-prod.yml` | PLANIFIÉE | | sondes de production |
| `restore-drill.yml`, `db-backup.yml`, `scalability-volume.yml`, `e2e-supabase.yml` | PLANIFIÉE | | exercices et sauvegarde |
| `edge-deploy.yml` | DÉPLOIEMENT | 117 / 8 | après un noyau vert |
| `daily-digest`, `weekly-digest`, `org-digest`, `org-webhook-dispatch`, `inactive-accounts`, `renewal-notice` | PRODUIT | | traitements planifiés de production, pas des gardes |
| `cron-journal.yml` | en attente | 0 | `schedule:` posé par la bascule pg_cron (V10.2) |

## Récits d'incident des gardes (descendus de `scripts/CLAUDE.md` le 2026-11-08)

### Une garde se vérifie sur ce qu'elle REGARDE (passe du 2026-09-03)

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
  ou une mesure qui ne détecterait plus rien.
- 🔴 **Une garde qui se trompe dans le sens rassurant est pire qu'une garde absente : elle donne
  une réponse, et on la croit.**
- 🔴 **Toute étape de garde de `lint-test-build` joue après un rouge** (`if: ${{ !cancelled() && steps.deps.outcome == 'success' }}`, un `id`, jamais `continue-on-error`), et la dernière étape liste tous les rouges. Témoin : `ci-toutes-les-gardes.guard.test.mjs`.

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

`vendor-watch.yml` (retiré le 2026-10-18 avec le script tiers, `23a12fdb`) a fait exactement son travail : il a détecté que le script de mesure d'audience
chargé sur les pages publiques s'était mis à extraire **l'adresse email et le nom** saisis à
l'inscription, il a échoué **chaque jour du 2026-08-29 au 2026-09-01**, il a mis son issue à jour à
chaque fois, et personne ne l'a ouverte pendant quatre jours.

- Les échecs de garde sont désormais **poussés** sur `OPS_ALERT_WEBHOOK_URL` (`ci-alert.yml`), même
  format que `opsAlert()` des Edge Functions, avec un exercice à blanc en `workflow_dispatch`.
- ✅ **Le canal DÉLIVRE, mesuré le 2026-09-13.** Le secret est dans les secrets **Actions** depuis
  le **2026-09-02 à 09:13:47 UTC** (`gh secret list`), l'exercice à blanc a été joué le 09-02 **et
  rejoué le 09-13** (`Alerte poussee (HTTP 204)` les deux fois), et **73** alertes réelles sont
  parties depuis, dont les 14 échecs de `Edge deploy drift`.
  ⚠️ **Ce fichier a écrit « le canal reste INERTE » pendant onze jours après la pose du secret**,
  parce que la phrase a été recopiée au lieu d'être relue à sa source : une commande d'une seconde.
  ✅ **LU PAR UN HUMAIN, le 2026-09-13 à 18:28 (heure de Paris).** Capture du salon `#général` à
  l'appui, et les DEUX sources y arrivent : `ci-alert.yml` (« [cosmo/ci] Edge deploy drift en echec
  sur main ») et `opsAlert()` **depuis une Edge Function** (« [cosmo/renewal-notice] CRON_SECRET
  absent »). Le second chemin n'avait jamais été vu délivrer non plus.
  ⚠️ **Un HTTP 204 ne prouvait pas qu'on lit le salon**, il prouvait que l'endpoint acceptait. Le
  204 reste la mesure automatique ; la lecture, elle, ne se prouve qu'ainsi : quelqu'un qui montre
  le message. Aucune garde ne rendra jamais ce verdict-là.
- 🔴 **Ne jamais rendre une garde conditionnelle à la présence de son propre secret**, et la règle
  s'est appliquée à `ci-alert.yml` lui-même le **2026-09-13** : son étape de push sortait en **0**
  dans les deux cas où rien n'était parti (secret absent, webhook qui refuse), avec un `::warning::`
  dans un run vert, le motif exact retiré d'`uptime.yml` le 09-03 et de `renewal-notice.yml` le
  09-04, resté dans le seul fichier dont le métier EST d'alerter. La logique vit désormais dans
  `scripts/ops-alert.mjs` : secret absent ou refus après 3 tentatives = **`exit 1`**.
  ❌ L'argument « on ne peut pas alerter sur l'alerting » ne tient pas : **un job ROUGE est l'alerte
  sur l'alerting** (GitHub notifie l'échec d'un run sur son propre dépôt), le vert ne notifie rien,
  et l'issue `ci-red` étant écrite par une étape antérieure, échouer à la fin ne perd aucun filet.
  ⚠️ **Pas de shebang** sur `scripts/ops-alert.mjs` : son témoin l'importe, et la chaîne Vite/vitest
  ne retire pas le shebang que Node retire. Témoin : `scripts/ops-alert.guard.test.mjs`, 14 cas, vu
  rouge sur **six** sabotages, dont un `deliver` qui répond 204 sans rien poster.
- ⚠️ Un rouge périmé ne sonne pas : `scripts/ci-alert-perime.mjs` → § Alerte périmée, plus haut.
