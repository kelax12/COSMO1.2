# Roadmap 60 jours — du lancement à 10 000 utilisateurs

**Établie le 2026-08-27.** Source de vérité unique du travail des 60 prochains jours
(2026-08-28 → 2026-10-26). Elle **consolide** les dix audits vivants du dépôt, les confronte au
code de `main` et à la production `ykeugqfgklejcdbrmawy`, et ne garde que ce qui reste à faire.

> **Ce document ne remplace aucun audit.** `faille.md` reste la source de vérité sécurité,
> `docs/LEGAL.md` la source de vérité juridique. Cette roadmap dit **quoi faire, dans quel ordre,
> par qui**. Quand un audit et cette roadmap se contredisent sur un *fait*, l'audit gagne ; sur
> une *priorité*, cette roadmap gagne.
>
> **Règle d'entretien** : cocher une tâche ici au moment où son critère « Done » est vérifié, pas
> quand le code est écrit. Une migration écrite n'est pas une migration appliquée — c'est la
> leçon du 2026-08-27, elle vaut pour toute cette roadmap.

---

## 0. Ce que la confrontation au code a changé

Trois catégories de résultats, et la troisième est celle qui compte.

### Ce qui était annoncé « à faire » et qui est FAIT

| Recommandation d'audit | Réalité vérifiée |
|---|---|
| `SCALABILITY.md` §9 : « `useTeamOKRs` en `live` conditionnel, ~15 min » | ✅ **Déjà fait.** `team-okrs/hooks.ts:39` porte `...(options?.live ? { refetchInterval: 30_000 } : {})`. Les 4 `refetchInterval` restants sont tous conditionnels, vérifié par grep nominatif |
| `ACQUISITION.md` §7.1 : « appliquer la mig. 099 » | ✅ Appliquée en prod le 2026-08-23 |
| `ARCHITECTURE.md` §5 : dérive repo ↔ prod | ✅ Refermée, seule la `130` est en attente |
| `RGPD.md` §3 : rétention des tables analytiques | ✅ mig. 114 en prod |
| `POST-AUDIT-GUIDE.md` point 4 : harnais RLS d'intégration en CI | ✅ Job `rls-integration`, 8 fichiers dans `e2e/rls/` |
| `docs/TESTING.md` : couverture rouge | ✅ Verte au 2026-08-27 soir, 1 802 tests, seuils jamais baissés |

### Ce qui est OBSOLÈTE et qu'il ne faut pas faire

| Recommandation | Pourquoi elle tombe |
|---|---|
| `SEO.md` §3 : « approfondir les 5 articles les plus courts » | **Renversée par le §4 du même document.** Un article de 2 000 mots en position 88 reste en position 88. Le facteur limitant est l'autorité de domaine, pas la longueur |
| `PERFORMANCE.md` : « migrer `vendor-charts` vers visx / chart.js » | Caduc : la landing n'importe plus Recharts, le chunk est réellement lazy |
| `SCALABILITY.md` §7 : supprimer les 43 index inutilisés | Décision déjà prise : on ne supprime rien. 18 Mo de base, coût d'écriture négligeable |
| `npm audit fix` sur `react-router` | **Piège actif.** Il propose 7.11.0, qui réintroduit l'open redirect `GHSA-wrjc-x8rr-h8h6`. La sortie est React 19 + router 8, en PR dédiée, hors de ces 60 jours |
| Redis / file d'attente / read replicas | YAGNI à 10 000 utilisateurs. Voir §14 |
| `ACQUISITION.md` §4 : travailler la boucle de partage | Explicitement écarté par l'audit lui-même : il n'y a personne pour partager |

### Ce que les audits ont MANQUÉ — vérifié en production le 2026-08-27

Quatre angles morts, dont un est le plus gros risque de lancement du dossier.

| # | Angle mort | Preuve | Gravité |
|---|---|---|---|
| **AM-1** | **Aucun SMTP applicatif pour Supabase Auth, ET aucune vérification d'adresse à l'inscription.** Les deux se tiennent : les confirmations sont désactivées, donc n'importe qui peut s'inscrire avec l'adresse d'un tiers et une faute de frappe crée un compte injoignable à vie ; et on ne peut pas les activer, parce que chaque inscription passerait alors par l'expéditeur intégré de Supabase, plafonné à quelques envois par heure | `grep -rin "smtp"` → 0 résultat hors Resend (qui ne sert QUE `report-bug` et `renewal-notice`, jamais Auth). En base : 28 comptes, `confirmation_sent_at` renseigné sur **1**, délai création → confirmation de **15 ms** ; `recovery_sent_at` sur **3**, donc les resets de mot de passe partent bien par cet expéditeur. DNS : `resend._domainkey` **absent**, le domaine n'est pas vérifié chez Resend | 🔴 **P0.** Mode de défaillance **corrélé au trafic** : il ne se déclenche que le jour d'une campagne, et il ressemble à « la campagne n'a pas converti ». GoTrue répond `over_email_send_rate_limit`, que l'app traduit par « Trop de tentatives » — exact côté serveur, **trompeur** côté inscrit, qui n'a rien fait de trop |
| **AM-2** | **La fonction `report-bug` n'est PAS déployée en production.** Elle existe dans le dépôt, `BugReportModal` l'invoque, `SECURITY.md` et `DEPLOYMENT.md` la décrivent comme livrée | `list_edge_functions` en prod : 7 fonctions, `report-bug` n'y est pas | 🟠 **P1.** Le repli `mailto` évite l'impasse, mais chaque signalement affiche d'abord une erreur. C'est le seul canal de support du produit, à l'instant où on va en avoir besoin |
| **AM-3** | **Aucune protection anti-bot sur l'inscription.** Ni CAPTCHA, ni Turnstile, ni hCaptcha, nulle part | `grep -rin "captcha\|turnstile"` → 0 résultat | 🟠 **P1.** Couplé à AM-1 : une vague de bots vide le quota d'emails et rend les inscriptions légitimes impossibles. Les deux se corrigent ensemble ou pas du tout |
| **AM-4** | **Aucune surveillance de disponibilité.** Personne n'est prévenu si `thecosmo.app` ou l'API Supabase tombe. `OPS_ALERT_WEBHOOK_URL` n'est pas posé, donc `alert.ts` est un no-op silencieux | `grep -rin "uptime\|statuspage"` → 0 résultat | 🟠 **P2.** Acceptable à 28 comptes, plus du tout à 100 |
| AM-5 | `tmp-org-price-setup`, fonction temporaire **encore déployée en production**, absente du dépôt. Neutralisée (répond 410, aucun secret), donc sans risque, mais c'est un artefact non versionné dans la surface exposée | `get_edge_function` | ⚪ **P3**, quick win de 2 minutes |

---

## 1. Liste consolidée — 47 tâches, chacune une seule fois

Priorité : **P0** bloque le lancement · **P1** risque important · **P2** rapidement après ·
**P3** optimisation · **P4** nice to have.
Effort : **XS** <1 h · **S** 1-3 h · **M** 3-8 h · **L** 1-2 j · **XL** 3-5 j · **XXL** >5 j.
Piste : **A** = agent backend/infra/sécu · **B** = agent front/UX/tests · **X** = Axel seul.

### PHASE 1 — Avant d'ouvrir l'acquisition

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-01 | Infrastructure | Passer Supabase en plan Pro et activer le PITR | A-9, seul bloquant de résilience du dossier. Aujourd'hui une erreur en prod n'est pas rattrapable, RPO jusqu'à 24 h | P0 | XS | — | X | S1 |
| T-02 | Fiabilité | Exécuter le drill de restauration de `DEPLOYMENT.md` §7 vers un projet jetable, chronométré | Un backup non testé n'est pas un backup. RTO actuel : inconnu | P0 | M | T-01 | X + A | S1 |
| T-03 | Emails | Configurer un SMTP applicatif (Resend) pour **Supabase Auth** : sous-domaine d'envoi `send.thecosmo.app` vérifié, clé SMTP posée dans Supabase, limite d'envoi horaire relevée | AM-1. Sans lui l'inscription casse dès la première vague de trafic. ⚠️ Le sous-domaine est obligatoire : la racine porte les MX et le SPF d'IONOS qui servent `contact@` | P0 | M | — | **X** (préparé : runbook, gabarits, garde) | S1 |
| T-04 | Emails | Coller les 4 gabarits d'email dans le Dashboard | ✅ **Écrits** (`supabase/templates/`, en français). Ils ne se déploient pas depuis le dépôt : `config push` n'est pas le workflow de ce projet | P1 | XS | T-03 | X | S2 |
| T-04b | Sécurité | Activer *Confirm email* — **après** T-03, jamais avant | Ferme la porte à l'inscription avec l'adresse d'un tiers et aux comptes injoignables. ✅ Le front est prêt : `AuthForm` affiche « Vérifiez votre boîte mail » au lieu de pousser l'inscrit vers un écran protégé qui le rejetterait | P1 | XS | T-03, T-04 | X | S2 |
| T-05 | Sécurité | Activer « Leaked password protection » + minimum 12 caractères | A-10, encore ouvert : l'advisor `auth_leaked_password_protection` est toujours remonté par la prod le 2026-08-27 | P0 | XS | — | X | S1 |
| T-06 | Sécurité | MFA (TOTP) sur le compte admin `axellongatte2@gmail.com` | `/admin` expose toute la volumétrie business et n'est protégé que par un mot de passe. Meilleur rapport effort/risque du dossier | P0 | XS | — | X | S1 |
| T-07 | Sécurité | Vérifier l'allowlist de redirection OAuth (aucun wildcard large) | Un wildcard trop large annule une partie du bénéfice de PKCE | P1 | XS | — | X | S1 |
| T-08 | Sécurité | Activer « Secure email change » (confirmation sur les deux adresses) | Prise de contrôle de compte par changement d'email | P1 | XS | — | X | S1 |
| T-09 | Sécurité | Activer le secret scanning GitHub + vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique | Le dépôt est **public** | P1 | XS | — | X | S1 |
| T-10 | Base de données | Appliquer la **mig. 130** en prod, puis `npm run test:rls` doit passer au vert | G-1 : tout membre lit aujourd'hui les invitations refusées de ses collègues. Le test est rouge tant que la migration n'est pas passée, c'est ce qui distingue « écrite » de « en vigueur » | P1 | XS | — | X applique / A vérifie | S1 |
| ✅ T-11 | Base de données | `npm run check:drift` après la 130, et consigner le résultat | Après chaque migration appliquée, sans exception | P1 | XS | T-10 | A | S1 |
| T-12 | Support | Déployer `report-bug` + poser `RESEND_API_KEY` dans les secrets Supabase | AM-2. Seul canal de support du produit | P1 | XS | T-03 | A | S1 |
| T-13 | Monitoring | Poser `OPS_ALERT_WEBHOOK_URL` (webhook Slack ou Discord) | `alert.ts` est un no-op silencieux aujourd'hui : un webhook Stripe en échec ou une purge RGPD avortée ne réveillent personne | P1 | XS | — | X | S1 |
| 🟡 T-14 | Sécurité | **Code livré le 2026-08-28, inerte.** Reste : créer le widget Cloudflare, poser `VITE_TURNSTILE_SITE_KEY`, puis activer côté Supabase. Activer un CAPTCHA (Cloudflare Turnstile) sur inscription et reset de mot de passe | AM-3. Se pose côté Supabase Auth + un champ dans le formulaire | P1 | S | T-03 | A + B | S2 |
| T-15 | Analytics | Valider la chaîne `?ref=` de bout en bout : ouvrir `https://thecosmo.app/?ref=test_manuel`, créer un compte jetable, vérifier `profiles.acquisition_source = 'test_manuel'`, puis supprimer le compte | 28 comptes, **0** avec une source. On ne sait toujours pas si la chaîne marche ou si personne n'est passé par un `?ref=`. Lancer une campagne sur une chaîne jamais validée est le gaspillage le plus cher possible | P0 | S | T-03 | X | S2 |
| ✅ T-16 | Monitoring | Vérifier que `VITE_SENTRY_DSN` est bien posé sur Vercel et qu'une erreur de test remonte | Le monitoring est désactivé en silence si la variable manque. Jamais vérifié depuis le dépôt | P1 | XS | — | X | S1 |
| T-17 | Monitoring | Brancher une sonde de disponibilité externe (UptimeRobot / Better Stack, palier gratuit) sur `/` et sur `auth/v1/health` | AM-4 | P2 | XS | — | X | S2 |
| T-18 | DevOps | Supprimer la fonction `tmp-org-price-setup` depuis le dashboard Supabase | AM-5, artefact non versionné dans la surface exposée | P3 | XS | — | X | S2 |
| ✅ T-19 | Tests | Committer les trois fichiers non suivis (`e2e/rls/org-invitations.test.ts`, `e2e/reduced-motion-sheets.spec.ts`, `src/modules/team-projects/hooks.background.test.tsx`) et les 12 docs modifiés | Du travail vérifié qui n'est pas dans `main` n'existe pas, et une autre session peut l'emporter dans son propre commit | P1 | XS | — | X | S1 |
| ✅ T-20 | UX / Produit | Passer les deux drapeaux de facturation en revue **avant** d'ouvrir l'acquisition et confirmer qu'ils sont bien à `false` des deux côtés (`ENTERPRISE_BILLING_ENFORCED` + `billing_flags.enterprise_seat_limit`) | Ils ont basculé trois fois en douze heures le 2026-08-25. L'état se lit dans le code et en base, jamais dans un document | P0 | XS | — | A | S2 |

### PHASE 2 — 0 → 100 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-21 | Acquisition | Soumettre COSMO aux 20 premiers annuaires de `ACQUISITION-BACKLINKS.md`, dans l'ordre donné, et tenir le tableau de suivi | **Le seul levier qui débloque le SEO.** Position 88 sur les requêtes non-marque = 0 domaine référent. Aucun contenu ne compensera | P1 | XL | — | X | S3-S5 |
| T-22 | SEO | Relever dans Search Console : type de propriété (domaine ou préfixe), nombre de pages réellement indexées, et connecter Ahrefs Webmaster Tools pour compter les domaines référents | On pilote le SEO sans savoir combien de pages sont indexées. 13 impressions pour 20 URLs laisse l'hypothèse ouverte | P1 | S | — | X | S3 |
| 🟡 T-23 | UX / Produit | **Mesure faite le 2026-08-28** (cf. §11). Reste la correction. Instrumenter et corriger l'activation : **0 compte actif sur 7 jours** pour 28 comptes. Identifier le décrochage (première tâche créée ? deuxième session ?) et traiter le premier écran après inscription | Le vrai problème produit du dossier. Acquérir des utilisateurs qui ne reviennent pas est un coût, pas un progrès | P1 | L | T-15 | B | S3-S4 |
| ✅ T-24 | Fiabilité | Détection de nouvelle version pour les onglets jamais rechargés (bannière « une mise à jour est disponible ») | **91,5 % du trafic Supabase du 2026-08-26 venait de deux onglets exécutant un bundle périmé.** Sans ce mécanisme, tout correctif client n'atteint que ceux qui rouvrent l'application, et les utilisateurs les plus assidus sont les plus coûteux | P2 | M | — | B | S4 |
| T-25 | UX / Produit | Barre d'onglets entreprise sur mobile : 4 destinations sur 7 hors écran, aucun indice de continuation | P1 de la critique UI du 2026-08-27. Le mode entreprise est l'offre qui se vend | P2 | M | — | B | S4 |
| T-26 | UX / Produit | Unifier les deux grammaires de filtre entre les onglets « Tâches » et « Projets » | Même donnée, deux façons de la filtrer. Second P1 de la même critique | P2 | M | — | B | S5 |
| ⚪ T-27 | UX / Produit | **CLOS sans changement** (arbitrage Axel, 2026-08-28) : la répétition est assumée, le titre était déjà corrigé. `buildOrgEvents` : exclure `currentUserId` de la frise « entreprise », et corriger le titre contradictoire | La frise répète les tâches déjà affichées juste au-dessus | P3 | S | — | B | S5 |
| T-28 | Performance | Resserrer les seuils Lighthouse après le premier run réel en CI | Ils sont provisoires et posés au-dessus du réel : un budget très au-dessus du réel ne mesure rien | P2 | S | — | A | S3 |
| T-29 | Performance | Ramener le chunk d'entrée sous 92 ko gzip et **redescendre le plafond** de `check:bundle` | 87,2 → 106,9 ko en deux jours, plafond relevé de 92 à 112 pour l'absorber. C'est le seul plafond du dépôt qu'on ait jamais remonté ; tant que la marge se regagne en relevant la barre, le budget ne garde plus rien | P2 | M | — | B | S4 |
| ✅ T-30 | Legal | Publier les durées de conservation dans la politique de confidentialité (90 j visite démo, 400 j activité et démo convertie, 90 j marqueurs Stripe) | Dernier point du dossier RGPD qui n'attend plus rien d'autre que d'être écrit, et il débloque la réponse à un acheteur B2B | P2 | XS | — | B | S3 |
| T-31 | Support | Écrire la procédure de support : qui répond, sous quel délai, où arrivent les signalements, gabarit de réponse | À 100 utilisateurs le support devient réel. Un canal sans procédure devient un canal ignoré | P2 | S | T-12 | X | S4 |

### PHASE 3 — 100 → 1 000 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-32 | Legal | **Immatriculation micro-entreprise au guichet unique INPI** | Bloquant absolu de tout encaissement. Encaisser avant l'immatriculation est du travail dissimulé | P1 | M | — | X | S5 |
| T-33 | Legal | Choisir et signer une société de domiciliation | Décision prise le 2026-08-26, exécution en attente. Conditionne B2 | P1 | S | — | X | S5 |
| T-34 | Legal | Adhérer à un médiateur de la consommation et publier ses coordonnées dans les CGV | Adhésion payante et **obligatoire**, oubli classique sanctionné par la DGCCRF | P1 | S | T-32 | X | S6 |
| T-35 | Paiement | Configurer le portail client Stripe (annulation d'abonnement activée) sur les **deux** comptes, test et live | E5 : `/v1/billing_portal/configurations` renvoie vide sur les deux comptes. **Le bouton existe, la résiliation ne marche pas** — et la landing promet « résiliable à tout moment » | P1 | XS | — | X | S6 |
| T-36 | Paiement | Basculer Stripe en compte **live** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, les 4 `STRIPE_ORG_PRICE_*` mensuels, endpoint webhook live avec les 5 mêmes events | La prod COSMO tourne sur une clé de TEST depuis le début : les customers réels vivent dans le sandbox. Les prix annuels se **dérivent**, il n'y a aucun secret annuel à poser | P1 | M | T-32, T-35 | X + A | S6 |
| T-37 | Paiement | Compléter les mentions légales (SIREN, RCS, TVA, directeur de publication) et configurer les factures Stripe pour la France : mention « TVA non applicable, art. 293 B du CGI », mentions L441-9, numérotation continue | A3, C4, C5, C6. Une mention fausse est pire qu'une mention absente, d'où la dépendance au SIREN | P1 | S | T-32 | X + B | S6 |
| T-38 | Paiement | Réarmer la facturation : `ENTERPRISE_BILLING_ENFORCED = true` **et** `billing_flags.enterprise_seat_limit = true`, dans le même déploiement | Les deux drapeaux se déplacent ensemble. Serveur seul = impasse client, client seul = on encaisse sans rien débloquer | P1 | XS | T-35, T-36, T-37 | A | S7 |
| T-39 | Paiement | Recette de bout en bout avec une **vraie carte** : souscription mensuelle, changement de palier depuis le portail, résiliation, vérification de `org_subscriptions` et du journal `payment_records` | Le webhook et le checkout n'ont jamais traité un paiement réel. Le seul endroit où COSMO choisit un prix au lieu de se le faire désigner est la résolution annuelle | P1 | M | T-38 | X + A | S7 |
| T-40 | Emails | Poser `CRON_SECRET` (Supabase **et** GitHub) pour armer les avis de reconduction tacite | E6. Un avis non envoyé rend l'abonnement résiliable à tout moment, remboursement compris. Sans objet tant qu'aucun abonnement annuel n'existe, donc juste après T-39 | P2 | XS | T-39 | X | S7 |
| T-41 | Scalabilité | Mesurer à volume réel : injecter ~2 000 `team_tasks` dans une organisation de test de 50 membres et rejouer le runbook `SCALABILITY.md` §10 | Les correctifs 113/117/128 sont vérifiés en plan et en test, **jamais contre du volume**. C'est exactement la confiance non vérifiée qui a laissé passer un `Seq Scan` global pendant six semaines | P2 | M | — | A | S6 |
| T-42 | Infrastructure | Confirmer que la prod utilise l'URL du pooler (PgBouncer 6543, mode transaction) | Jamais vérifié depuis le dépôt, et d'autant plus important vu le coût par ligne des prédicats RLS | P2 | XS | — | A | S5 |
| T-43 | Legal | Collecter et archiver les DPA des sous-traitants (Supabase, Vercel, Sentry, Stripe, Resend) | A5 et A6. Chaînon obligatoire pour vendre à une entreprise, et il ne s'obtient qu'en tant qu'entreprise | P2 | M | T-32 | X | S7 |
| T-44 | Legal | Recherche d'antériorité « COSMO » sur `data.inpi.fr` **et** `euipo.europa.eu`, classes 9 et 42 | Nom très générique, antériorités quasi certaines. La question n'est pas « existe-t-il une marque COSMO » mais « une marque COSMO couvre-t-elle le logiciel ». Se lancer sans le savoir, c'est risquer de devoir renommer après acquisition | P2 | S | — | X | S6 |

### PHASE 4 — 1 000 → 10 000 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-45 | Dette technique | Découper `TaskTable.tsx` (1 124 lignes, plus gros fichier du dépôt, immobile depuis trois jours) | Les quatre passes du cliquet ont toutes porté sur `/entreprise`, parce que c'est là qu'a lieu le travail. La dette du socle ne baisse pas toute seule | P3 | L | — | B | S8 |
| T-46 | Fiabilité | Automatiser un `pg_dump` mensuel stocké hors Supabase | Plan de sortie fournisseur. Complément du PITR, pas un substitut | P3 | S | T-01 | A | S8 |
| T-47 | Performance | Trancher `vendor-sentry` (49,2 ko gzip) sur le chemin critique | Ce n'est **pas** un arbitrage de performance : le différer revient à ne plus capturer les erreurs de démarrage, celles qui blanchissent l'écran. Décision produit, pas optimisation | P3 | S | — | X décide | S8 |

---

## 2. Ordre d'exécution — la file unique

Chaque numéro est un point de reprise. Ce qui est sur la même ligne est parallélisable.

```
 1. T-19  committer le travail en cours          (X, XS)  — rien d'autre ne part tant que main ment
 2. T-01  Supabase Pro + PITR                    (X, XS)
 3. T-05 · T-06 · T-07 · T-08 · T-09             (X, 4×XS) — les 5 réglages de console, en une session
 4. T-16  vérifier VITE_SENTRY_DSN               (X, XS)
 5. T-13  OPS_ALERT_WEBHOOK_URL                  (X, XS)
 6. T-10  appliquer la mig. 130      ‖  T-03  SMTP Auth + domaine vérifié     (X)
 7. T-11  check:drift                ‖  T-12  déployer report-bug            (A)
 8. T-02  drill de restauration chronométré      (X + A, M)
 9. T-04  templates Auth traduits     ‖  T-14  CAPTCHA                        (B ‖ A)
10. T-20  audit des deux drapeaux de facturation (A, XS)
11. T-15  valider la chaîne ?ref= de bout en bout (X, S)
        ── ▲ GO / NO-GO DE LANCEMENT ▲ ──
12. T-17 sonde uptime  ‖  T-18 supprimer tmp-org-price-setup  ‖  T-22 GSC + Ahrefs   (X)
13. T-21  soumissions annuaires, par vagues de 5              (X, en fond sur 3 semaines)
14. T-23  activation : instrumenter puis corriger             (B, L)
15. T-30 durées de conservation  ‖  T-28 seuils Lighthouse    (B ‖ A)
16. T-29 chunk d'entrée sous 92 ko  ‖  T-24 détection de nouvelle version   (B)
17. T-31  procédure de support                                (X)
18. T-25 barre d'onglets mobile  ‖  T-41 mesure à volume  ‖  T-42 pooler   (B ‖ A ‖ A)
19. T-32  immatriculation  ‖  T-33 domiciliation  ‖  T-44 antériorité marque (X)
20. T-35 portail Stripe  ‖  T-34 médiateur                    (X)
21. T-36  Stripe en compte live                               (X + A, M)
22. T-37  mentions légales + factures conformes               (X + B)
23. T-38  réarmer les deux drapeaux ENSEMBLE                  (A, XS)
24. T-39  recette de paiement avec une vraie carte            (X + A, M)
25. T-40 CRON_SECRET  ‖  T-43 DPA  ‖  T-26 grammaires de filtre  ‖  T-27 frise
26. T-45 TaskTable  ‖  T-46 pg_dump mensuel  ‖  T-47 décision vendor-sentry
```

**Pourquoi cet ordre.** Les onze premières lignes sont toutes des tâches à effort XS ou S qui
ferment chacune un mode de défaillance silencieux — c'est-à-dire un problème qui ne se manifeste
qu'une fois qu'il y a des utilisateurs, quand il coûte le plus cher. Aucune ne demande de
développement. Le lancement n'attend pas du code, il attend une douzaine de clics et une
vérification.

---

## 3. Roadmap semaine par semaine

### SEMAINE 1 — 28 août → 3 septembre · **Rendre la production rattrapable**

**Objectif** : qu'une erreur en production redevienne réparable, et qu'un incident réveille
quelqu'un.

**Pourquoi cette semaine** : aujourd'hui, une manipulation malheureuse en base est définitive
(pas de PITR), et une Edge Function qui échoue ne prévient personne. Tout ce qui suit dans cette
roadmap suppose qu'on puisse se tromper sans tout perdre.

- [x] ✅ **T-19** — committer les trois tests non suivis et les douze docs modifiés · P1 · XS · X
  **Done** : `git status` propre, CI verte sur `main`.
- [ ] **T-01** — Supabase plan Pro + PITR activé · P0 · XS · X
  **Done** : Dashboard → Database → Backups affiche une fenêtre PITR non nulle.
- [ ] **T-02** — drill de restauration vers un projet jetable · P0 · M · X + A · dép. T-01
  **Done** : la date, la durée mesurée et le RTO constaté sont inscrits dans `DEPLOYMENT.md` §7 ;
  un login réel et une création de tâche ont été faits sur le projet restauré ; le projet jetable
  est supprimé. Un drill dont on ne peut pas citer le chronomètre n'a pas eu lieu.
- [ ] **T-05 à T-09** — les cinq réglages de console Supabase et GitHub · P0/P1 · 5×XS · X
  **Done** : `get_advisors(security)` ne remonte plus `auth_leaked_password_protection`, la
  connexion admin demande un code TOTP, l'allowlist de redirection ne contient aucun wildcard,
  le secret scanning est actif sur le dépôt.
- [x] ✅ **T-16** — vérifier `VITE_SENTRY_DSN` sur Vercel · P1 · XS · X
  **Done** : une erreur déclenchée volontairement en prod apparaît dans Sentry sous 2 minutes.
- [ ] **T-13** — poser `OPS_ALERT_WEBHOOK_URL` · P1 · XS · X
  **Done** : un POST manuel sur le webhook arrive dans le canal.
- [~] **T-10 / T-11** — appliquer la mig. 130, puis `check:drift` · P1 · XS · X applique, A vérifie
  **Done** : `e2e/rls/org-invitations.test.ts` **passe au vert** (il est rouge aujourd'hui, c'est
  le signal), le ledger affiche `130`, `check:drift` sort 0.
- [ ] **T-03** — SMTP Auth via Resend, sous-domaine d'envoi vérifié · P0 · M · X
  Procédure pas à pas : [`DEPLOYMENT.md` §2ter](./DEPLOYMENT.md). Gabarits prêts dans
  `supabase/templates/`.
  **Done** : `npm run check:mail` sort **0** (il sort 1 aujourd'hui, trois contrôles en échec) ;
  une inscription de test reçoit son email en moins d'une minute, depuis `@send.thecosmo.app`,
  **hors dossier indésirables sur Gmail ET sur Outlook** ; la limite *Emails per hour* a été
  relevée — elle ne bouge pas toute seule quand on branche un SMTP.
- [ ] **T-12** — déployer `report-bug` + `RESEND_API_KEY` · P1 · XS · A · dép. T-03
  **Done** : `list_edge_functions` liste `report-bug` ; un signalement envoyé depuis la prod
  arrive sur `contact@thecosmo.app` **sans** que le repli `mailto` s'affiche.

### SEMAINE 2 — 4 → 10 septembre · **Fermer la porte d'entrée, prouver la mesure**

**Objectif** : que l'inscription tienne debout sous trafic, et que la campagne à venir soit
mesurable.

**Pourquoi cette semaine** : l'inscription est le seul chemin entre une campagne et un
utilisateur. Elle n'a jamais été éprouvée sous volume, ni protégée des bots, ni vérifiée de bout
en bout côté attribution.

- [ ] **T-04 / T-04b** — coller les 4 gabarits, puis activer *Confirm email* · P1 · 2×XS · X
  **Done** : les quatre emails reçus sont ceux de `supabase/templates/` ; une inscription de test
  n'ouvre plus de session et affiche « Vérifiez votre boîte mail » ; le lien reçu active bien le
  compte. **Dans cet ordre** : activer les confirmations avant d'avoir le SMTP, c'est ouvrir
  l'inscription sur un expéditeur plafonné.
- [~] 🟡 **T-14** — Turnstile sur inscription et reset · P1 · S · **code livré, deux réglages restants**
  **Done** : une inscription sans jeton de challenge est refusée côté Supabase (pas seulement
  masquée côté client) ; le parcours démo → inscription reste franchissable en un essai ; un test
  E2E couvre le cas nominal.
- [x] ✅ **T-20** — audit des deux drapeaux de facturation · P0 · XS · A
  **Done** : `ENTERPRISE_BILLING_ENFORCED` lu dans `premium-config.ts` **et**
  `billing_flags.enterprise_seat_limit` lu en base sont tous deux `false`, avec la requête et sa
  date citées dans le commit. Jamais depuis un document.
- [ ] **T-15** — chaîne `?ref=` validée de bout en bout · P0 · S · X
  **Done** : `select acquisition_source from profiles where id = '<compte jetable>'` renvoie
  `test_manuel`, et le canal apparaît dans `/admin`. Puis le compte est supprimé par
  `delete-account`, ce qui teste au passage le droit à l'effacement en conditions réelles.
- [ ] **T-17** — sonde de disponibilité externe · P2 · XS · X
  **Done** : une alerte arrive sur le même canal que `OPS_ALERT_WEBHOOK_URL` quand la sonde est
  volontairement pointée sur une URL invalide.
- [ ] **T-18** — supprimer `tmp-org-price-setup` · P3 · XS · X
  **Done** : elle n'apparaît plus dans `list_edge_functions`.

> 🚦 **Fin de semaine 2 : passage du GO / NO-GO du §5.**

### SEMAINE 3 — 11 → 17 septembre · **Ouvrir l'acquisition, et regarder**

**Objectif** : les premières soumissions d'annuaires partent, et on sait enfin ce que Google voit.

**Pourquoi cette semaine** : le SEO est bloqué par l'autorité de domaine, pas par le contenu.
C'est un chantier long et manuel : plus tôt il commence, plus tôt le seuil de ~20 domaines
référents est franchi. Rien d'autre ne le remplace.

- [ ] **T-22** — état des lieux Search Console + Ahrefs · P1 · S · X
  **Done** : trois chiffres écrits dans `SEO.md` avec leur date — type de propriété, pages
  indexées, domaines référents.
- [ ] **T-21 (vague 1)** — les 5 premiers annuaires de `ACQUISITION-BACKLINKS.md` · P1 · X
  **Done** : 5 lignes remplies dans le tableau de suivi, avec la date de soumission et le statut.
- [x] ✅ **T-23 (mesure)** — instrumenter l'activation · P1 · B
  **Done** : on peut répondre par une requête à « combien de comptes créent une tâche le jour de
  leur inscription » et « combien reviennent le lendemain ». La correction vient après la mesure,
  pas avant.
- [x] ✅ **T-30** — publier les durées de conservation · P2 · XS · B
  **Done** : les trois durées sont dans la politique de confidentialité, et `RGPD.md` §6 passe le
  point 3 au vert.
- [ ] **T-28** — resserrer les seuils Lighthouse · P2 · S · A
  **Done** : chaque seuil est posé juste au-dessus de la valeur du premier run réel, et le job
  reste vert.

### SEMAINE 4 — 18 → 24 septembre · **Que les correctifs atteignent les gens**

**Objectif** : traiter le décrochage d'activation et faire en sorte qu'un déploiement change
quelque chose pour ceux qui sont déjà là.

**Pourquoi cette semaine** : les premiers utilisateurs arrivent. Or 91,5 % du trafic serveur
vient d'onglets qui exécutent un vieux bundle, et 0 compte sur 28 est actif à 7 jours. Acquérir
sans corriger ces deux points revient à remplir un seau percé.

- [ ] **T-23 (correction)** — traiter le premier écran après inscription · P1 · L · B
  **Done** : une action utile est faite par un nouveau compte dans les 60 premières secondes dans
  le parcours de recette, et la mesure de la semaine 3 est rejouée deux semaines plus tard.
- [x] ✅ **T-24** — détection de nouvelle version · P2 · M · B
  **Done** : un onglet ouvert sur l'ancien build affiche l'invitation à recharger en moins de
  5 minutes après un déploiement ; vérifié dans deux onglets réels, pas en test unitaire seul.
- [ ] **T-29** — chunk d'entrée sous 92 ko gzip · P2 · M · B
  **Done** : `npm run check:bundle` est vert **avec le plafond redescendu à 92 000**. Un plafond
  qu'on ne redescend pas n'est pas un budget.
- [ ] **T-25** — barre d'onglets entreprise sur mobile · P2 · M · B
  **Done** : les 7 destinations sont atteignables sans connaissance préalable sur un écran de
  375 px, vérifié dans le navigateur, pas déduit d'une règle.
- [ ] **T-31** — procédure de support écrite · P2 · S · X
  **Done** : un document d'une page dit qui répond, sous quel délai, et où arrivent les
  signalements.
- [ ] **T-21 (vague 2)** — annuaires 6 à 12 · X

### SEMAINE 5 — 25 septembre → 1er octobre · **Ouvrir le dossier juridique**

**Objectif** : lancer l'immatriculation, qui a un délai administratif incompressible et bloque
tout l'encaissement.

**Pourquoi cette semaine** : entre le dépôt au guichet INPI et l'obtention du SIREN il s'écoule
plusieurs semaines. Si le dossier part en semaine 7, la facturation ne peut pas être armée dans
ces 60 jours. C'est la seule tâche de la roadmap dont le délai ne dépend pas de nous.

- [ ] **T-33** — choisir et signer la domiciliation · P1 · S · X (préalable pratique à T-32)
- [ ] **T-32** — déposer l'immatriculation au guichet unique INPI · P1 · M · X
  **Done** : dossier déposé, numéro de suivi conservé. Le SIREN arrivera plus tard, ce n'est pas
  le critère.
- [ ] **T-44** — recherche d'antériorité « COSMO » · P2 · S · X
  **Done** : les résultats INPI et EUIPO en classes 9 et 42 sont copiés dans `LEGAL.md` §F1, avec
  une conclusion écrite : on garde le nom, ou on consulte un conseil.
- [ ] **T-42** — vérifier l'URL du pooler en prod · P2 · XS · A
- [ ] **T-21 (vague 3)** — annuaires 13 à 20 · X
- [ ] **T-26** — unifier les grammaires de filtre · P2 · M · B

### SEMAINE 6 — 2 → 8 octobre · **Rendre la chaîne de paiement réelle**

**Objectif** : que le jour où le SIREN arrive, il ne reste qu'un drapeau à basculer.

**Pourquoi cette semaine** : tout ce qui suit peut être préparé sans SIREN, sauf les mentions de
facture. Préparer maintenant évite de tout découvrir le jour de la bascule.

- [ ] **T-35** — configurer le portail client Stripe sur les deux comptes · P1 · XS · X
  **Done** : `GET /v1/billing_portal/configurations` renvoie une configuration active sur le
  compte test **et** sur le compte live, avec l'annulation d'abonnement autorisée. C'est la
  vérification qui a dégradé cette ligne de 🟡 à ❌ le 2026-08-26 : la refaire, ne pas la
  supposer.
- [ ] **T-34** — adhérer à un médiateur de la consommation · P1 · S · X
- [ ] **T-36** — basculer Stripe en compte live · P1 · M · X + A
  **Done** : les 4 prix mensuels live existent tous en `tax_behavior: inclusive`, l'endpoint
  webhook live est enregistré avec les 5 mêmes events, `STRIPE_SECRET_KEY` et
  `STRIPE_WEBHOOK_SECRET` sont remplacés, et un appel de fumée au webhook répond
  « Invalid signature » (donc la fonction tourne et vérifie).
- [ ] **T-41** — mesure de scalabilité à volume réel · P2 · M · A
  **Done** : `EXPLAIN (analyze, buffers)` à chaud sur une organisation de 50 membres et
  ~2 000 `team_tasks`, ratio buffers / lignes scannées inscrit dans `SCALABILITY.md` §9 en
  remplacement de la projection.

### SEMAINE 7 — 9 → 15 octobre · **Encaisser, pour de vrai**

**Objectif** : le premier euro peut être encaissé légalement et le client peut partir.

**Pourquoi cette semaine** : c'est la première semaine où le SIREN peut être arrivé. Les deux
drapeaux ne bougent qu'ici, et ensemble.

- [ ] **T-37** — mentions légales complètes + factures Stripe conformes · P1 · S · X + B · dép. T-32
- [ ] **T-38** — réarmer les deux drapeaux dans le même déploiement · P1 · XS · A
  **Done** : `ENTERPRISE_BILLING_ENFORCED = true` déployé sur Vercel **et**
  `billing_flags.enterprise_seat_limit = true` en base, vérifiés tous les deux après coup. Jamais
  l'un sans l'autre.
- [ ] **T-39** — recette de paiement avec une vraie carte · P1 · M · X + A
  **Done** : une souscription mensuelle réelle apparaît dans `org_subscriptions` avec le bon
  palier et le bon `billing_interval` ; un changement de palier depuis le portail se reflète en
  base (le palier se redérive du **price ID**, jamais des metadata) ; une résiliation fonctionne ;
  `verify_payment_chain()` renvoie vrai.
- [ ] **T-40** — poser `CRON_SECRET` · P2 · XS · X
- [ ] **T-43** — collecter les DPA · P2 · M · X
- [ ] **T-27** — frise entreprise, exclure `currentUserId` · P3 · S · B

### SEMAINE 8 — 16 → 22 octobre · **Rembourser, mesurer, décider**

**Objectif** : refermer la dette qui gêne le rythme, et prendre les deux décisions différées.

**Pourquoi cette semaine** : une fois la boucle acquisition → produit → encaissement bouclée, la
question redevient « à quelle vitesse peut-on avancer », donc la dette du socle.

- [ ] **T-45** — découper `TaskTable.tsx` · P3 · L · B
  **Done** : plus aucun fichier au-dessus de 900 lignes, et le budget de `architecture.guard`
  redescendu d'autant. Le cliquet ne descend que quand la mesure descend.
- [ ] **T-46** — `pg_dump` mensuel hors fournisseur · P3 · S · A
- [ ] **T-47** — trancher `vendor-sentry` · P3 · S · X décide
- [ ] **Revue de fin de cycle** : remesurer les dix notes d'audit, mettre à jour
  `docs/README.md`, archiver cette roadmap et en écrire une nouvelle. Une roadmap ne se met pas à
  jour, c'est un instantané — même règle que les audits.

---

## 4. Répartition sur trois pistes

### AGENT A — backend, infrastructure, sécurité, base de données

Peut travailler sans jamais toucher un composant React.

T-11 (check:drift) · T-12 (déployer `report-bug`) · T-14 côté Supabase Auth ·
T-20 (audit des drapeaux) · T-28 (seuils Lighthouse) · T-36 côté secrets et Edge Functions ·
T-38 (drapeau serveur) · T-41 (mesure à volume) · T-42 (pooler) · T-46 (`pg_dump`) ·
vérification de T-10 et de T-02.

**Contrainte permanente** : l'agent A ne **jamais** écrire en base par le MCP Supabase — lecture
seulement. Les migrations sont appliquées par Axel, vérifiées par l'agent.

### AGENT B — frontend, UX, tests, analytics, contenu produit

Peut travailler sans jamais toucher une migration.

T-04 (templates Auth) · T-14 côté formulaire · T-23 (activation, mesure puis correction) ·
T-24 (détection de nouvelle version) · T-25 (barre d'onglets mobile) · T-26 (grammaires de
filtre) · T-27 (frise) · T-29 (chunk d'entrée) · T-30 (durées de conservation) · T-37 côté
mentions légales · T-45 (`TaskTable`).

### AXEL — tout ce qui exige un humain, un compte ou une signature

**Comptes et consoles** : T-01, T-05 à T-09, T-13, T-16, T-17, T-18, T-35, T-36, T-40.
**Base de données** : T-10 (appliquer), T-19 (committer).
**Juridique et administratif** : T-32, T-33, T-34, T-43, T-44, T-37.
**Acquisition et mesure** : T-15, T-21, T-22, T-31.
**Décisions** : T-47, et l'arbitrage de tout GO / NO-GO du §5.

### Dépendances entre pistes — les quatre points de synchronisation

1. **T-03 (SMTP, Axel) bloque T-04 (agent B), T-12 (agent A) et T-14.** C'est le nœud le plus
   contraignant de la semaine 1 : rien de l'email ne peut avancer avant que le domaine soit
   vérifié.
2. **T-10 (Axel applique) bloque T-11 (agent A vérifie).** Flux habituel du dépôt : Axel applique,
   Claude vérifie.
3. **T-32 (immatriculation, Axel) bloque T-37, donc T-38, donc T-39.** Toute la piste
   monétisation est derrière un délai administratif : c'est pourquoi elle démarre en semaine 5.
4. **T-23 (mesure, agent B) doit précéder T-23 (correction).** Corriger l'activation avant de
   l'avoir mesurée, c'est deviner. La roadmap sépare volontairement les deux moitiés de deux
   semaines.

---

## 5. GO / NO-GO avant lancement

### 🔴 NO-GO — à corriger absolument

| # | Condition | Vérification |
|---|---|---|
| 1 | **PITR actif et restauration testée** (T-01, T-02) | Le chronomètre du drill est écrit dans `DEPLOYMENT.md` |
| 2 | **Emails d'authentification servis par un SMTP applicatif**, puis confirmation d'adresse activée (T-03, T-04b) | `npm run check:mail` sort 0, et une inscription de test reçoit sa confirmation hors spam sur deux fournisseurs |
| 3 | **Protection contre les mots de passe compromis + MFA admin** (T-05, T-06) | L'advisor correspondant a disparu ; la connexion admin demande un TOTP |
| 4 | **Chaîne `?ref=` prouvée de bout en bout** (T-15) | `acquisition_source` renseignée sur un compte réel créé pour l'occasion |
| 5 | **Les deux drapeaux de facturation à `false`, vérifiés séparément** (T-20) | Lecture du code **et** requête en base, datées |
| 6 | **Alerte opérationnelle branchée** (T-13, T-16) | Un incident simulé arrive dans le canal et dans Sentry |

### 🟠 Risques acceptables au lancement — assumés, à ne pas confondre avec « réglés »

| Risque | Pourquoi il est acceptable maintenant | Quand il cesse de l'être |
|---|---|---|
| **Aucune monétisation active** (les deux drapeaux à `false`, Stripe en test) | Sans SIREN, encaisser serait du travail dissimulé. Le produit est gratuit et le dit | Dès le SIREN — T-38 |
| **`report-bug` non déployé** si T-12 glisse | Le repli `mailto` fonctionne, l'utilisateur n'est jamais dans une impasse | Au premier utilisateur qui n'écrit pas parce qu'il a vu un message d'erreur |
| **Position 88 en SEO, 0 domaine référent** | C'est un état de départ, pas un défaut. La correction est manuelle et longue | Jamais bloquant, mais rien ne s'améliore sans T-21 |
| **Jamais mesuré à volume** (`team_tasks`) | 4 organisations, 8 tâches d'équipe en prod | À la première organisation de plus de 20 personnes — T-41 |
| **14 fichiers > 600 lignes** | Le cliquet empêche la croissance nette, le budget baisse à chaque passe | Jamais un bloquant produit, seulement un coût de vitesse |
| **`en` servie mais non indexable** | Choix délibéré : le contenu des pages est en français | Quand le contenu sera traduit |
| **Onglets périmés** (T-24) | 28 comptes, l'effet est mesurable mais pas coûteux | À 100 utilisateurs actifs |
| **CVE dev-only et `GHSA-qwww-vcr4-c8h2`** | Inapplicables à une SPA Vite sans RSC, verrouillé par `no-open-redirect.test.ts` | À la migration React 19 |

### 🟢 GO — conditions minimales

Les six NO-GO levés, les quatre gardes CI vertes sur `main`
(`lint-test-build`, `audit`, `e2e`, `rls-integration`, `lighthouse`), `check:drift` à zéro, et
`git status` propre. **C'est tout.** Le produit est techniquement au-dessus de ce que son trafic
exige ; ce qui manque au lancement n'est pas du code.

---

## 6. Checkpoints après lancement

### À 100 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Le chemin critique est-il toujours sous 400 ko gzip ? `check:bundle` vert sans plafond relevé |
| Coûts | Egress Supabase contre le plafond du plan ; base toujours loin de 500 Mo |
| Sécurité | `get_advisors` : aucun WARN nouveau ; les fonctions exécutables par `anon` sont-elles toujours deux ? |
| Infrastructure | Le PITR couvre-t-il toujours la fenêtre annoncée ? Un second drill a-t-il été fait ? |
| Erreurs | Taux d'erreur Sentry par session ; y a-t-il une erreur qui touche plus de 5 % des sessions ? |
| Support | Combien de signalements, quel délai de réponse médian |
| Analytics | `acquisition_source` renseignée sur quelle proportion des comptes ? Si c'est encore 0, la chaîne est cassée |
| Conversion | Taux visite démo → compte ; comparer au 74 % de juillet 2026, qui était de l'entourage |
| Rétention | Actifs à 7 jours et à 30 jours. **C'est le chiffre décisif** : il était à 0 sur 28 comptes |
| Architecture | Les 4 `refetchInterval` sont-ils toujours 4, et toujours conditionnels ? Recompter nominativement |

### À 1 000 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Rejouer le runbook `SCALABILITY.md` §10 : ratio buffers / lignes scannées sur les 5 requêtes les plus chères |
| Coûts | Première facture Supabase et Vercel réelles ; egress par utilisateur actif |
| Sécurité | Audit RLS complet sur toute nouvelle table ; les tests `e2e/rls/` couvrent-ils chaque surface d'autorisation ajoutée depuis ? |
| Infrastructure | Pooler confirmé, connexions simultanées au pic, CPU base au pic |
| Erreurs | Un budget d'erreur explicite : au-delà de X % de sessions en erreur, on arrête les features |
| Support | Le canal unique suffit-il encore ? Sinon, une FAQ avant un outil |
| Analytics | Quel canal d'acquisition produit des utilisateurs **retenus**, pas seulement inscrits |
| Conversion | Taux gratuit → payant sur les organisations qui touchent le plafond de 5 sièges |
| Rétention | Cohortes mensuelles. Une rétention à 30 jours sous 20 % rend toute acquisition non rentable |
| Architecture | Le journal `payment_records` est-il intact ? `verify_payment_chain()` doit renvoyer vrai |

### À 10 000 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Read replicas à envisager (l'app est déjà compatible, lectures et écritures sont séparées) |
| Coûts | Coût d'infrastructure par utilisateur actif, et sa tendance. C'est lui qui décide du prix |
| Sécurité | Test d'intrusion externe ; rotation des secrets ; revue des accès admin |
| Infrastructure | Plan de bascule fournisseur éprouvé, pas seulement documenté |
| Erreurs | Astreinte réelle : qui est joignable, sous quel délai. `RGPD-VIOLATION.md` recense déjà son absence |
| Support | Premier recrutement ou externalisation ; le fondateur ne peut plus être le support |
| Analytics | Attribution multi-touch, pas seulement first-touch |
| Conversion | Prix revalidé contre la valeur perçue, pas contre les coûts |
| Rétention | Rétention par palier de taille d'organisation : c'est là que se trouve le produit qui marche |
| Architecture | La question devient « quelle partie du monolithe freine », pas « comment tout découper » |

---

## 7. Quick wins — à intercaler entre deux tâches lourdes

Effort minimal, impact réel, risque nul.

| Tâche | Effort | Gain |
|---|---|---|
| **T-06** — MFA sur le compte admin | 5 min | Le meilleur rapport effort/risque de tout le dossier sécurité |
| **T-05** — leaked password protection | 2 min | Ferme le seul WARN d'authentification remonté par les advisors |
| **T-13** — `OPS_ALERT_WEBHOOK_URL` | 5 min | Transforme un no-op silencieux en alerte réelle sur les échecs Stripe et RGPD |
| **T-18** — supprimer `tmp-org-price-setup` | 2 min | Retire un artefact non versionné de la surface exposée |
| **T-19** — committer le travail en cours | 10 min | Trois tests et douze docs vérifiés qui n'existent pas tant qu'ils ne sont pas dans `main` |
| **T-30** — publier les durées de conservation | 20 min | Débloque la seule ligne RGPD qui n'attend plus que d'être écrite |
| **T-11** — `check:drift` après la 130 | 10 min | Le geste qui a manqué pendant six semaines la première fois |
| **T-42** — vérifier l'URL du pooler | 15 min | Écarte ou confirme un plafond de connexions qu'on découvrirait sous charge |
| **T-16** — vérifier `VITE_SENTRY_DSN` | 10 min | Sans lui, le monitoring est éteint sans que rien ne le dise |

---

## 8. Ce qu'il ne faut PAS faire pendant ces 60 jours

Section obligatoire, et la plus utile de ce document.

| À ne pas faire | Pourquoi |
|---|---|
| **Écrire ou approfondir des articles de blog** | Position 88 sur les requêtes non-marque. Un article de 2 000 mots en position 88 reste en position 88. Le SEO se débloque par T-21, pas par du contenu |
| **Lancer `npm audit fix`** | Il propose `react-router` 7.11.0, qui **réintroduit** l'open redirect. Aucune version ne clôt les deux familles sous React 18 |
| **Migrer vers React 19 + react-router 8** | Chantier réel, sans urgence : la CVE ouverte concerne le mode RSC, absent d'une SPA Vite. À faire en PR dédiée, hors de ces 60 jours |
| **Supprimer les 43 index inutilisés** | Décision déjà prise et documentée. Sur 18 Mo de base, leur coût d'écriture est négligeable, et certains sont des FK `ON DELETE CASCADE` |
| **Ajouter Redis, une file d'attente ou des read replicas** | YAGNI à 10 000 utilisateurs. React Query couvre le cache client, tout est synchrone, le webhook Stripe est idempotent |
| **Migrer `vendor-charts` vers visx ou chart.js** | Le grief d'origine est caduc : la landing n'importe plus Recharts, le chunk est réellement lazy |
| **Découper `PyramidTab` ou les fichiers > 600 lignes « pour la propreté »** | Le cliquet fait déjà baisser le budget à chaque passe, sans qu'aucune fonctionnalité ne soit reportée. Seul `TaskTable` mérite une coupe volontaire, et en semaine 8 |
| **Ajouter un `refetchInterval` « juste pour être sûr »** | Chaque tick est une requête pour tout le monde, en permanence. C'est la dette qui a coûté 91,5 % du trafic d'une journée |
| **Réintroduire un gate `isPremium()` sur le partage ou la collaboration** | Choix stratégique explicite : c'est le pari viral du produit |
| **Traduire le contenu des pages pour ouvrir `en` à l'indexation** | Chantier XXL sans retour tant que le domaine n'a pas d'autorité. `en` reste servie, non indexable |
| **Construire un back-office d'administration** | `/admin` répond déjà à la question qu'on se pose à ce stade : combien, qui, d'où |
| **Armer la facturation avant le SIREN** | Encaisser avant l'immatriculation est du travail dissimulé. Et le parcours actuel mène à un checkout en mode test, donc à une carte réelle refusée |
| **Faire confiance à un total sans le recompter** | Trois erreurs de comptage documentées en trois jours dans ce dépôt : les `refetchInterval`, les fichiers > 600 lignes, le tableau de `LEGAL.md`. Un total ne prouve rien |
| **Déclarer un correctif acquis sans mesure** | La règle du dépôt, écrite après deux rétractations en trois jours. Une garde rouge est coupable jusqu'à preuve du contraire, et la preuve est une mesure à un commit nommé |

---

## 9. Score de maturité au 2026-08-27

### Lancement production — **7 / 10**

Le code est prêt bien au-delà de ce que le trafic exige : 1 802 tests verts, cinq jobs CI dont un
qui rejoue toutes les migrations sur base vierge, RLS sur toutes les tables, aucun finding
exploitable, CSP stricte, budget de bundle gardé. Ce qui manque n'est pas du code : PITR absent,
emails d'authentification servis par l'expéditeur de secours de Supabase, canal de support non
déployé, chaîne d'attribution jamais éprouvée.

### 100 utilisateurs — **6 / 10**

Techniquement confortable. Le frein est produit : **0 compte actif sur 7 jours pour 28 comptes**.
Le produit n'a pas encore prouvé qu'il retient quelqu'un. S'y ajoutent l'absence de surveillance
de disponibilité, de protection anti-bot et de procédure de support.

### 1 000 utilisateurs — **5 / 10**

Les corrections de scalabilité sont réelles et bien conçues (085, 113, 117, 119, 128, 129), mais
**aucune n'a été mesurée à volume** : la prod compte 8 tâches d'équipe. Le pooler n'est pas
confirmé. Les onglets périmés font que les gains n'atteignent pas les utilisateurs les plus
assidus. Et le support repose entièrement sur une personne.

### 10 000 utilisateurs — **3 / 10**

Ce n'est pas une note technique. **Il n'existe aujourd'hui aucun moyen légal d'encaisser un
euro** : pas de structure, Stripe en compte de test, portail de résiliation non configuré,
médiateur non souscrit. Sans revenu, la question des 10 000 utilisateurs ne se pose pas. À quoi
s'ajoutent l'absence d'astreinte, de plan de sortie fournisseur éprouvé, et de mesure de coût par
utilisateur actif.

**Ce qui empêche le 10/10, en une phrase par axe** : la production n'est pas rattrapable
(PITR), l'inscription n'est pas éprouvée (SMTP), le produit n'est pas retenu (activation), la
scalabilité n'est pas mesurée (volume), et le business n'est pas légal (immatriculation).

---

## 10. Résumé exécutif

### Aujourd'hui

**Un produit d'ingénierie remarquable, et une entreprise qui n'existe pas encore.** Le dépôt est
plus rigoureux que la majorité des SaaS financés : gardes automatiques qui refusent la
régression, migrations testées sur base vierge, sécurité auditée à 86/100, documentation qui se
corrige elle-même. En face : 28 comptes, 0 actif à 7 jours, 0 € de revenu, 0 domaine référent,
aucune structure juridique. **Le goulot n'est pas technique depuis un moment déjà.**

### Pour lancer — les 8 choses qui comptent

1. Supabase Pro + PITR + drill de restauration chronométré (T-01, T-02)
2. SMTP applicatif, puis vérification d'adresse à l'inscription (T-03, T-04b) — **l'angle mort le
   plus coûteux**. Préparé côté dépôt : runbook, gabarits, front et garde `npm run check:mail`
3. Les cinq réglages de console Supabase et GitHub (T-05 à T-09)
4. Migration 130 appliquée, test RLS au vert (T-10, T-11)
5. `report-bug` déployé (T-12)
6. Alerte opérationnelle et Sentry vérifiés (T-13, T-16)
7. CAPTCHA sur l'inscription (T-14)
8. Chaîne `?ref=` prouvée sur un compte réel (T-15)

Aucune de ces huit tâches n'est du développement. Sept sont des XS.

### Dans les 30 prochains jours

Lancer, puis **regarder**. Les soumissions d'annuaires (T-21) démarrent en semaine 3 et ne
s'arrêtent plus : c'est le seul levier SEO. En parallèle, mesurer puis corriger l'activation
(T-23), parce qu'acquérir sans retenir coûte de l'argent sans rien construire. Et déposer
l'immatriculation en semaine 5, à cause de son délai administratif.

### Dans les 60 prochains jours — l'état à viser

Un produit qui **encaisse légalement** : SIREN obtenu, Stripe en compte live, portail de
résiliation qui fonctionne, mentions de facture conformes, les deux drapeaux réarmés ensemble, et
une souscription réelle passée avec une vraie carte, résiliée avec succès. Plus : une rétention à
7 jours mesurable et non nulle, une dizaine de domaines référents, et une production dont on sait
combien de temps il faut pour la restaurer.

### Pour 10 000 utilisateurs — les investissements réels

Par ordre de montant : le **temps d'acquisition** (le SEO ne se paie pas, il se travaille), la
**structure juridique et comptable** (immatriculation, médiateur, DPA, comptabilité), le **plan
Supabase Pro puis au-delà** (PITR d'abord, read replicas ensuite), et enfin le **support**, qui
est le premier poste qui ne peut plus reposer sur une personne. Le code, lui, demande peu :
mesurer à volume, et découper ce qui freine.

### Le plus gros risque

**Lancer une campagne d'acquisition sur une chaîne d'inscription non éprouvée.** Trois faiblesses
se combinent : aucune adresse n'est vérifiée à l'inscription, l'activer ferait passer chaque
inscription par un expéditeur plafonné à quelques envois par heure (AM-1), et rien ne protège le
formulaire des bots (AM-3).

Le mode d'échec est le pire qui soit, parce qu'il est **corrélé au trafic et mal étiqueté** : il
ne se déclenche qu'un jour de campagne, et l'inscrit voit « Trop de tentatives. Réessayez dans
quelques minutes. » Il n'a rien fait de trop — c'est le quota du projet, éventuellement consommé
par quelqu'un d'autre, qui est épuisé. Il réessaie, échoue, et part. Côté tableau de bord, ça
ressemble trait pour trait à une campagne qui ne convertit pas. C'est exactement le scénario que
T-03, T-04b, T-14 et T-15 existent pour rendre impossible.

### Le plus gros quick win

**Le MFA sur le compte admin (T-06), cinq minutes.** `/admin` expose toute la volumétrie business
du produit et n'est protégé aujourd'hui que par une allowlist et un mot de passe. Meilleur
rapport effort/risque du dossier — c'est `faille.md` qui l'écrit, et c'est toujours vrai.

**Et le quick win le plus rentable à moyen terme** : les soumissions d'annuaires (T-21). Zéro
euro, zéro ligne de code, et c'est la seule chose qui déplace une position 88.

---

## 11. Journal d'exécution

Une ligne par session. **On coche quand le critère « Done » est vérifié, pas quand le code est
écrit.** Les tâches cochées restent dans les tableaux ci-dessus : le fil se perd si on les retire.

### 2026-08-28 — 5 tâches fermées, 1 mesurée à moitié, 1 arbitrage rendu à Axel

| Tâche | Résultat |
|---|---|
| ✅ **T-20** | Les deux drapeaux sont à `false`, **vérifiés séparément** : `premium-config.ts` lignes 14 et 160 pour le client, `select key, enabled from billing_flags` pour le serveur (`enterprise_seat_limit` → `false`). Jamais depuis un document, c'est la règle posée après les trois bascules du 2026-08-25 |
| ✅ **T-11** | `check:drift` joué contre la prod : **aucun objet attendu ne manque**, 48 tables, 112 fonctions, 137 policies. ⚠️ Joué AVANT la mig. 130, il ne la couvre donc pas — la 130 remplace une policy de même nom, et cette garde compare des noms, pas des définitions. À rejouer après application, sans en attendre un signal sur ce point précis |
| ✅ **T-30** | Les trois durées mesurées sont publiées dans la politique de confidentialité (90 j visite démo non convertie, 400 j activité et démo convertie, 90 j marqueurs Stripe), avec la mention que le journal d'encaissement est anonymisé et non supprimé. Débloque le dernier point RGPD en attente d'un acheteur B2B |
| ✅ **T-24** | Un onglet resté ouvert sur un bundle périmé propose de recharger. `version.json` est émis au build avec le **même** identifiant que celui compilé dans le bundle, revalidé à chaque lecture (`vercel.json`). Déclenché au retour d'onglet, **étranglé à une fois par demi-heure**, jamais un minuteur permanent. Propose, ne recharge jamais d'autorité : un onglet ouvert contient souvent une saisie en cours |
| 🟡 **T-23** | **Mesure faite, correction non engagée.** Voir le tableau ci-dessous |
| ⏸️ **T-27** | **Rendu à Axel, ce n'est pas une décision technique.** Voir plus bas |

#### La ligne de base d'activation (T-23, mesurée en prod le 2026-08-28)

| Indicateur | Valeur | Lecture |
|---|---|---|
| Comptes | 28 | · |
| Ont créé au moins une tâche | **18** (64 %) | Plus d'un tiers des inscrits n'ont jamais rien créé |
| En ont créé une le jour même | **12** (43 %) | · |
| Ont au moins 5 tâches | **11** (39 %) | Le seuil au-delà duquel un compte ressemble à un usage réel |
| Revenus après J+1 | **13** (46 %) | · |
| **Ne sont jamais revenus** après leur session d'inscription | **14** (50 %) | **Le chiffre qui compte** |

> ⚠️ **Ceci corrige une lecture répétée dans les audits.** « 0 compte actif sur 7 jours » décrivait
> l'activité *récente*, et se lisait comme « personne n'a jamais rien fait ». C'est faux :
> 18 comptes sur 28 ont créé des tâches, 11 en ont au moins cinq. Le vrai défaut n'est pas que le
> produit ne serve à personne, c'est qu'**un inscrit sur deux ne revient jamais**. Ce n'est pas le
> même problème et ça n'appelle pas les mêmes corrections : le premier écran après inscription,
> pas la découverte des fonctionnalités.
>
> ⚠️ **28 comptes, dont des comptes de test.** Ces pourcentages donnent une direction, pas une
> mesure. À rejouer au-delà de 100 comptes réels avant d'en tirer une conclusion produit.

#### Défaut trouvé dans une garde, en l'exécutant (hors roadmap)

`check:drift` annonçait `get_my_habits` et `toggle_habit_completion_v2` comme **« EN TROP en prod,
héritage dashboard »** alors que les deux sont versionnées depuis les migrations 119 et 121.

Cause : le motif normal d'un changement de signature — créer la nouvelle, supprimer l'ancienne —
quand le `DROP FUNCTION nom(args)` arrive plus bas dans le même fichier (mig. 122 : `CREATE` aux
lignes 55 et 159, `DROP` aux lignes 279 et 280). Le parseur, aveugle aux signatures, retirait alors
le nom de l'ensemble attendu.

🔴 **Le symptôme était bénin, le défaut ne l'est pas : il faisait échouer la garde dans le sens
rassurant.** Si l'une de ces deux fonctions avait réellement manqué en production, le script ne
l'aurait pas signalée — il ne l'attendait plus. Corrigé, et verrouillé par trois tests dans
`scripts/migration-guards.test.mjs`, dont un **témoin** qui vérifie qu'une fonction réellement
absente est toujours détectée : sans lui, un parseur qui n'oublierait jamais rien passerait aussi.

#### L'arbitrage rendu à Axel (T-27)

Le titre incriminé par la critique UI est **déjà corrigé** : la carte dit « Prochains événements de
**l'entreprise** », vérifié dans `src/locales/fr/org.json`. Reste la seconde moitié du finding,
exclure mes propres tâches de la frise, et **je ne la prends pas seul** : les deux lectures
mènent à des produits différents.

- **Exclure** supprime la répétition avec la liste juste au-dessus — mais une frise intitulée
  « de l'entreprise » qui omet certaines échéances **devient fausse**, et le pire cas est celui où
  la prochaine échéance de l'entreprise est la mienne : la frise annoncerait alors autre chose.
- **Garder** assume la répétition, qui est le grief d'origine.

Une troisième voie existe, plus chère : garder tout et **marquer** les événements qui me sont
assignés. Trancher demande de savoir à quoi sert cette carte — un rappel personnel, ou une vue
d'ensemble de l'organisation. C'est une question produit, pas une question de code.

### 2026-08-28 (suite) — semaine 1 parcourue dans l'ordre

| Tâche | Résultat |
|---|---|
| ✅ **T-19** | Le travail vérifié du 2026-08-27 est sur `main` (`d4f1a58`) : 12 documents, 3 tests, 2 correctifs source. Le spec e2e non suivi a été **rejoué avant** d'être commité — 3/3 verts sur chromium, témoin compris. On ne pose pas un spec e2e sur `main` sans l'avoir vu passer. Reste hors index, volontairement : `.claude/settings.local.json`, `supabase/.temp/cli-latest` (suivi à tort) et `.impeccable/` |
| ✅ **T-16** | `VITE_SENTRY_DSN` **est bien posé sur Vercel**, prouvé sans accès à la console : le DSN est inliné dans le bundle servi en production (`/assets/index-*.js`). C'est une variable `VITE_`, donc compilée au build — son absence serait visible de la même façon. Le monitoring n'est donc pas éteint en silence. ⚠️ Ce qui n'est PAS vérifié : qu'une erreur remonte effectivement jusqu'au tableau de bord Sentry. Ça demande la console, côté Axel, et une erreur déclenchée volontairement |
| ✅ **T-24, vérifié en PRODUCTION** | Le mécanisme est complet et cohérent en ligne : le bundle servi porte `a516b5c`, `/version.json` renvoie `{"release":"a516b5c"}`, en `Cache-Control: public, max-age=0, must-revalidate`. La réécriture SPA ne l'avale pas — c'était le risque réel, tout ce qui n'est pas `/assets`, `/fonts` ou `/screenshots` est réécrit vers `index.html`, et Vercel ne consulte les réécritures qu'après le système de fichiers. Les deux valeurs étant identiques, **aucun bandeau ne s'affiche, et c'est le bon résultat** |

> ⚠️ **Ce qui reste à prouver sur T-24 ne peut l'être qu'au prochain déploiement** : qu'un onglet
> resté ouvert sur `a516b5c` affiche bien l'invitation quand un build plus récent est servi. Test
> gratuit et concret : laisser un onglet ouvert sur la production, pousser le commit suivant,
> revenir sur l'onglet. Le bandeau doit apparaître dans la demi-heure — l'étranglement est à
> 30 minutes, pas à l'instant.

#### Semaine 1 — ce qui reste, et c'est entièrement hors du dépôt

T-01 (plan Pro + PITR), T-02 (drill de restauration), T-03 (SMTP applicatif), T-05 à T-09 (les
cinq réglages de console), T-10 (appliquer la mig. 130) et T-13 (webhook d'alerte) sont des clics
dans les consoles Supabase, Vercel, Resend et GitHub. Aucun n'est atteignable depuis le dépôt, et
tout ce qui pouvait être préparé en amont l'est : runbook, gabarits d'email, front prêt pour la
confirmation d'adresse, garde `check:mail`.

**La semaine 1 n'attend plus une seule ligne de code.**

### 2026-08-28 (fin) — semaine 2 entamée : T-14 livré inerte, T-27 clos

| Tâche | Résultat |
|---|---|
| 🟡 **T-14** | **Cloudflare Turnstile câblé, et volontairement inerte.** Aucun script tiers n'est chargé tant que `VITE_TURNSTILE_SITE_KEY` est absente — vérifié par test, c'est le témoin du fichier. Le jeton est joint aux **trois** points d'entrée que Supabase protège : `signUp`, `signInWithPassword` et `resetPasswordForEmail`. En oublier un rendrait l'authentification inutilisable le jour de l'activation |
| ⚪ **T-27** | **Clos sans changement**, arbitrage rendu par Axel : la répétition est assumée. Le titre incriminé était déjà corrigé |

> 🔴 **Deux avertissements à lire AVANT de toucher au réglage Supabase**, tous deux dans
> `DEPLOYMENT.md` §2quater :
>
> 1. **L'ordre est impératif.** Poser la clé publique et redéployer *d'abord*, activer côté
>    Supabase *ensuite*. Inversé, GoTrue exige un jeton que personne n'envoie encore : inscription
>    **et** connexion tombent pour tout le monde. Ce n'est pas une dégradation, c'est une panne
>    totale de l'authentification.
> 2. **Activer le CAPTCHA cassera `npm run cosmo:login`.** La protection couvre aussi
>    `signInWithOtp`, qu'utilise le CLI agent, et un script Node ne peut pas résoudre un challenge.
>    Une session CLI déjà ouverte survit ; c'est la *reconnexion* qui casse.

#### Le cliquet de taille a joué une cinquième fois

Le cas captcha demandait quatre lignes dans `safeAuthError`, or `AuthContext.tsx` était à
626 lignes pour un budget qui n'avait plus **qu'une seule ligne de marge**. La garde a donc imposé
la découpe plutôt que le contournement, exactement comme les quatre fois précédentes.

`src/modules/auth/auth-errors.ts` sort la traduction d'erreurs du provider : une fonction pure,
testable sans React ni Supabase. **`AuthContext` passe de 626 à 591 lignes et QUITTE la liste des
fichiers hors budget** — le budget tombe de 10 811 à **10 185**, et le fichier est retiré de
`KNOWN_OVERSIZED`. C'est la première fois qu'une coupe fait sortir un fichier du socle et non de
`/entreprise`.

> Le classement change en conséquence : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `TaskListsBar` 615 · `friends/supabase.repository` 601. **Treize fichiers.**
