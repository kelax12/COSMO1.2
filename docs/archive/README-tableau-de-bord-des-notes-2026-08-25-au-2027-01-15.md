> ⚠️ **ARCHIVE : tableau de bord des notes /100, mesures de la passe du 2026-11-06 et liste des restes (2026-08-25 → 2027-01-15), extrait de `docs/README.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/README.md`](../README.md). Les notes /100 ont cessé (ADR 0012) : l'état de santé se lit dans [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## 📊 Tableau de bord des notes · dernière notation : 2026-11-06 (964 / 1100)

Chaque note se justifie dans son document, par une entrée datée en tête de sa section « Note ».
La notation précédente (2026-10-25, 968) et ses motifs se relisent au commit `a99df915` ; le journal
des notations du 2026-08-25 au 2026-10-25 est archivé :
[`archive/README-journal-des-notes-2026-08-25-au-10-25.md`](../README-journal-des-notes-2026-08-25-au-10-25.md).

| Audit | 10-25 | **11-06** | Δ | Ce qui l'a décidé |
|---|---|---|---|---|
| Sécurité (`faille.md`, hors dépôt) | 84 | **87** | **+3** | SV-1, SV-2, SV-3, SV-8 en production (+4) ; CodeQL n° 19 `high` sans décision (−1). Advisors `24 / 87 / 2 / 1`, les objets d'affiliation relus au catalogue et légitimes |
| [Tests / CI](../TESTING.md) | 96 | **94** | **−2** | `main` rouge 56 runs sur 75 depuis le 10-26 (−1) ; `Sabotages` rouge, cinq témoins non rejoués (−1) ; `Mutation` enfin joué (+1, AM-3) puis rouge à 90,78 % sous 99 (−1) |
| [Performance](../PERFORMANCE.md) | 97 | **97** | 0 | plafonds `legalTerms` (14 000) et `legal` (3 800) relevés sur arbitrage écrit d'Axel, texte légal sur un chunk paresseux ; `check:bundle` et `lighthouse` verts |
| [Accessibilité](../ACCESSIBILITY.md) | 84 | **84** | 0 | échéances des lecteurs d'écran tenues (2026-12-15, 2027-01-15) ; `e2e` vert à `ba169ba1` |
| [UI / UX](../UI-PATTERNS.md) | 87 | **86** | **−1** | `Visual` rouge huit jours (10-29 → 11-06) pendant la nav, deux vagues entreprise, le thème Noir et la facturation ; 14 références régénérées d'un geste, sans revue tracée |
| [Architecture](../ARCHITECTURE.md) | 94 | **94** | 0 | gardes de structure vertes à `074aa8c8`, module `affiliation` déclaré dans `MODULES.md` |
| [Scalabilité](../SCALABILITY.md) | 91 | **91** | 0 | 90 tables, base à 30 Mo ; `scalability-volume` vert le 11-03 ; `unused_index` 75 → 57 |
| [RGPD](../RGPD.md) | 88 | **86** | **−2** | affiliation absente du registre art. 30 (−1) ; signal du détecteur de violation du 10-26 (82 839 lignes lues par un compte en 24 h) jamais trié (−1) |
| [i18n](../I18N.md) | 90 | **89** | **−1** | `No new hardcoded strings` rouge à `HEAD` (écran de démarrage, `c3294936` et `d938bc6e`) |
| [SEO](../SEO.md) | 79 | **78** | **−1** | articles du blog à deux `<h1>` et `/guide/` à 682 mots servis (−2) ; `Signaux SEO` joué (+1, AM-4) |
| [Mobile / DA](../MOBILE.md) | 78 | **78** | 0 | `e2e` mobile vert ; toujours aucune mesure sur appareil réel |

**968 → 964.** Une note monte, celle qui attendait un déploiement. Les cinq qui baissent ont un
point commun : un instrument qui a parlé sans que personne ne le reprenne (`main`, `Visual`,
`Sabotages`, `Mutation`, le détecteur de violation). [`OBSERVABILITE.md`](../OBSERVABILITE.md) reste
**non noté**.

### Mesures de la passe (2026-11-06, `c3294936` puis `d938bc6e`)

| Source | Verdict | Ce qu'elle dit |
|---|---|---|
| `CI` de `main` | 🔴 | 56 runs rouges sur 75 depuis le 2026-10-26 ; vert à `074aa8c8`, rouge à `c3294936` et `d938bc6e` (`No new hardcoded strings`) ; dernier `e2e` complet vert à `ba169ba1` |
| `Edge deploy drift` | 🔴 | `stripe-webhook`, `stripe-org-subscription`, `stripe-org-refund`, `seat-alert`, `renewal-notice` en retard sur les commits du 2026-11-03 ; `edge-deploy.yml` ne déploie que sur une CI verte |
| `Visual` | ✅ | vert à `c3294936` (relance) et `d938bc6e`, après huit jours rouge |
| `Mutation` | 🔴 | 90,78 % sous le seuil 99 (2026-11-04) ; vert le 2026-10-28 |
| `Sabotages` | 🔴 | cinq témoins non rejoués (2026-11-02) |
| `Posture` | 🔴 | `unused_index` 57 contre 75 : une amélioration ; recalage = geste d'Axel ([`SECURITY.md`](../SECURITY.md) AM-7) |
| `Secrets age` | 🔴 | rouge depuis sa pose (2026-10-26) : 9 dates de rotation inconnues, une trentaine de secrets hors registre |
| `restore-drill` | ⚪ | dernier run le 2026-10-15, sans confirmation |
| `Migration coverage`, `Grille Stripe`, `Erreurs de prod`, `Signaux SEO`, `db-backup`, `Uptime`, `Deploy SHA drift`, `inactive-accounts`, `renewal-notice` | ✅ | |
| Alertes GitHub | 🟠 | CodeQL **3** (n° 19 `high`, n° 15 et 18 `medium`), Dependabot **1** (développement), secret scanning : la n° 1, connue |
| Production | | 90 tables toutes sous RLS, 205 policies, ledger 192 (mig. `241`), base 30 Mo ; 2 abonnements d'organisation et 3 lignes au journal de paiement |
| PR ouvertes | 🟠 | n° 164 (historique KR coupé à 500, COSMO-40 ; 401 sur `get_my_tasks`) depuis le 2026-10-26 et n° 167 (calendrier des échéances) depuis le 2026-10-29, jamais fusionnées ; n° 125 (détecteur de violation) depuis le 2026-10-23 |

### Ce qui reste, et qui le porte

Chaque item qui ne demande que du code part dans une session dédiée, trois à la fois au plus
(au-delà, ce poste de 8 Go sature). Les autres attendent qu'une place se libère.

| Item | Domaine | Porté par | Modèle · effort |
|---|---|---|---|
| Double `<h1>` des articles, `/guide/` à 682 mots, JSON-LD de l'accueil | SEO | session `seo-regressions` (2026-11-06) | Sonnet 5.5 · high |
| CodeQL n° 15, 18, 19 et Dependabot `minimatch` | Sécurité | session `codeql-triage` (2026-11-06) | Opus 5.5 · high |
| `Mutation` remonté au-dessus de 99 sans exclure | Tests | session `mutation-score` (2026-11-06) | Sonnet 5.5 · high |
| `Sabotages` : cinq témoins à rebrancher ; retirer `tmp-webkit-repeat.yml` | Tests | en file d'attente | Sonnet 5.5 · medium |
| Registre de `Secrets age` : déclarer les secrets présents, retirer les absents | Sécurité | en file d'attente | Sonnet 5.5 · medium |
| PR n° 164 et n° 167 : vérifier, rebaser, porter sur `main` | Tests, UI | en file d'attente | Sonnet 5.5 · high |
| `No new hardcoded strings` (écran de démarrage) | i18n | la session voisine qui l'a poussé, prévenue | |

**Gestes d'Axel** (pas du code ; liste tenue, avec ce qui est déjà automatisé, dans
[`CONTINUITE.md`](../CONTINUITE.md) § « Inventaire des gestes de production », relue le 2026-11-08) : recaler `Posture` (`gh workflow run posture.yml -f regenerer=true`) ;
dater les rotations des 9 secrets ; trier le signal du détecteur du 2026-10-26 et décider du sort de
la PR n° 125 ; arbitrer le périmètre de l'affiliation au registre art. 30, qu'une session pourra
ensuite rédiger depuis la mig. `236` ; jouer `restore-drill` ; les séances VoiceOver (avant le
2026-12-15) et NVDA (avant le 2027-01-15).

---
