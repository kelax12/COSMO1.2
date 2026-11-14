# Documentation COSMO · convention et routeur

> **Quand lire** : avant d'écrire un doc ou un `CLAUDE.md`, ou pour savoir quel doc lire avant de toucher une zone.
> **Fait foi** : ce fichier pour la convention ; `scripts/check-docs-budget.mjs` (`npm run check:docs`) pour ce qui est refusé.

## Convention

Le lecteur est un agent qui charge le fichier dans son contexte : chaque ligne coûte des tokens (ADR 0021).

1. 🔴 Un fichier décrit l'état courant : ni date, ni historique, ni récit d'incident. Un récit va une fois dans `docs/archive/`, une décision dans `docs/adr/`.
2. 🔴 Sous le titre, trois lignes au plus : `**Quand lire**` (chemins ou globs touchés) et `**Fait foi**` (code ou fichier source).
3. ✅ Une règle par ligne, à l'impératif, avec ❌ ✅ 🔴 ⚠️, et son pourquoi en une proposition ou en renvoi (ADR, archive, `C-xx`, mig. `NNN`).
4. ✅ Chemins exacts entre accents graves, commandes copiables.
5. ❌ Jamais un numéro de ligne d'un autre fichier : renvoyer à une ancre de section.
6. ❌ Jamais un chiffre recopié : renvoyer à [`FAITS.md`](./FAITS.md) ou à la commande qui le mesure.
7. ✅ Une règle vit à un seul endroit (le `CLAUDE.md` de sa zone ou le doc de son domaine) ; les autres y renvoient.
8. ❌ Pas de prose d'introduction, de pédagogie ni de tableau décoratif.
9. 🔴 Aucune règle perdue : en réécrivant, inventorier les ❌ 🔴 ⚠️ avant et après ; une règle retirée est déplacée (dire où) ou obsolète (le prouver par le code).
10. ⚠️ Des tests lisent la doc (`landing-promises`, `definition-of-done`) : `git grep` du nom de fichier dans `src/`, `e2e/` et `scripts/` avant de déplacer une section.
11. ✅ Mesurer avant et après : `npm run check:docs -- --mesurer` (lignes ; tokens ≈ caractères / 4).
12. 🔴 Plafonds : 150 lignes pour un `CLAUDE.md`, 300 pour un doc de `docs/`. Un dépassement fait descendre un contenu, jamais monter la borne.
13. 🔴 Cliquet : `docs/convention-exceptions.json` porte la mesure des fichiers qui ne tiennent pas encore la convention. ❌ Jamais une entrée ajoutée ni une valeur relevée ; retirer ses entrées dans la livraison qui met le fichier en règle.
14. ❌ Aucune note sur 100 (ADR 0012) : l'état de santé se lit dans [`INDICATEURS.md`](./INDICATEURS.md).
15. ⚠️ Un doc vivant qui n'a plus rien d'ouvert part en archive. `docs/archive/**` n'est jamais l'état courant : le code fait foi contre une archive.

## Routeur · une ligne par doc vivante

| Doc | Lire avant de |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | rien : chargé à chaque session |
| [`MODULES.md`](./MODULES.md) | chercher un module, ses tables, ses RPC, son écran |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | toucher un invariant transverse, la taille ou la complexité d'un fichier |
| [`FAITS.md`](./FAITS.md) | écrire un nombre (fonctions, migrations, tables, gardes, tests, lignes) |
| [`INDICATEURS.md`](./INDICATEURS.md) | affirmer l'état de santé du dépôt ou de la prod |
| [`adr/`](./adr/README.md) | remettre en cause une décision structurante |
| [`SECURITY.md`](./SECURITY.md) | toucher `supabase/`, un repository, une Edge Function, Stripe, la CSP, un secret |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | déployer, revenir en arrière, restaurer la base |
| [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) | toucher les emails Auth (Resend), Turnstile, le second facteur `/admin`, un cron `pg_cron` |
| [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md) | faire tourner un secret, toucher `.github/secrets-registry.json`, le coffre |
| [`CONTINUITE.md`](./CONTINUITE.md) | un geste de production à la main, l'arrivée d'un second administrateur |
| [`OBSERVABILITE.md`](./OBSERVABILITE.md) | toucher Sentry, une alerte, un traitement planifié de prod |
| [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) | toucher la grille de prix, le portail ou le compte Stripe live |
| [`TESTING.md`](./TESTING.md) | écrire un test ou une garde, toucher la CI, pousser en prod |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | toucher `vite.config.ts`, un `import()`, une image, une police |
| [`SCALABILITY.md`](./SCALABILITY.md) | une requête de liste, une pagination, un `refetchInterval` |
| [`MOBILE.md`](./MOBILE.md) | une page ou un composant mobile, une bottom-sheet |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | une liste, une modale, un tutoriel, l'onboarding, un thème |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | un `aria-*`, un focus, un contraste, une gate axe ou Lighthouse |
| [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) · [`AUDIT-NVDA-WINDOWS.md`](./AUDIT-NVDA-WINDOWS.md) | jouer une séance de lecteur d'écran (`check:lecteurs-ecran`) |
| [`I18N.md`](./I18N.md) | une chaîne d'interface, un namespace, une traduction |
| [`SEO.md`](./SEO.md) | le prérendu, le sitemap, `hreflang`, une page publique |
| [`ACQUISITION.md`](./ACQUISITION.md) · [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | l'attribution `?ref=`, le funnel, une soumission d'annuaire |
| [`LEGAL.md`](./LEGAL.md) | les CGU, la TVA, un sous-traitant, le droit de la consommation |
| [`LEGAL-JOURNAL.md`](./LEGAL-JOURNAL.md) | modifier un document contractuel (`check:legal-journal`) |
| [`MARQUE-COSMO.md`](./MARQUE-COSMO.md) | la marque, un conseil en propriété industrielle |
| [`RGPD.md`](./RGPD.md) · [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) | une donnée personnelle, une durée de conservation, un traitement |
| [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md) · [`RGPD-VIOLATION-EXERCICES.md`](./RGPD-VIOLATION-EXERCICES.md) | une violation de données, l'exercice 72 h |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | réactiver le premium (`PREMIUM_ENFORCED`), un chantier daté |
| [`ENTREPRISE-FEATURES.md`](./ENTREPRISE-FEATURES.md) | décrire commercialement le mode entreprise |
| [`SUPPORT.md`](./SUPPORT.md) | répondre à un utilisateur, qualifier un incident |
| [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) | monter React ou `react-router` (`check:study`) |
| [`COSMO-CLI.md`](./COSMO-CLI.md) · [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md) | lire ou écrire les vraies données d'Axel par `scripts/cosmo/` |
| [`../a-faire-code.md`](../a-faire-code.md) | chercher le backlog (issues étiquetées `backlog`) |
| [`../README.md`](../README.md) · [`../CONTRIBUTING.md`](../CONTRIBUTING.md) · [`../SECURITY.md`](../SECURITY.md) | répondre à un humain : lancer, contribuer, signaler une faille |

⚠️ `docs/SECURITY.md` porte les règles internes ; `SECURITY.md` à la racine est la politique de divulgation publique.
🔒 Les fichiers hors dépôt (`faille.md` et les autres) sont nommés dans `CLAUDE.md` § Hors dépôt : ❌ jamais un lien vers eux.
