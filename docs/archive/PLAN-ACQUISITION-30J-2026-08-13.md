> ⚠️ **ARCHIVE — instantané daté du 2026-08-13, non maintenu.**
> Ce document décrit l'état du projet **à cette date**. Il n'a pas été mis à jour depuis
> et ne doit **pas** être lu comme l'état courant du code.
> Sources vivantes : [`CLAUDE.md`](../../CLAUDE.md) · [`faille.md`](../../faille.md) · [`docs/`](../../docs/README.md).

# Plan d'acquisition Cosmo — 30 jours (J1 = 2026-08-14 → J30 = 2026-09-12)

> Objectif demandé : **1 000 utilisateurs Free** + **10 utilisateurs Entreprise** en 30 jours, **sans publicité payante**.
> Ce document est fait pour être transformé directement en backlog quotidien.
> Chaque chiffre est présenté sous la forme **hypothèse → calcul → résultat**. Aucun chiffre n'est gonflé.
> Quand une estimation est fragile, elle est marquée **[INCERTAIN]** avec la raison.

---

## 0. Verdict en une page (à lire avant tout le reste)

| Objectif | Verdict | Attendu réaliste | Probabilité d'atteindre la cible |
|---|---|---|---|
| **1 000 Free** | ❌ Très improbable | **220 – 350 inscriptions** | ~10 % (nécessite un hit viral externe) |
| **10 Entreprise** | ✅ Atteignable | **6 – 12 organisations** | ~55 % |

**Pourquoi ces deux verdicts sont opposés** : le mode Entreprise est aujourd'hui **gratuit** (`ENTERPRISE_BILLING_ENFORCED = false`, gratuit < 5 sièges, Stripe non finalisé). Il n'y a donc ni budget à débloquer, ni procurement, ni signature. « Closer une entreprise » = convaincre une équipe de créer une org et d'inviter 2 collègues. C'est un problème de conviction, pas de vente — et 10 conversations réussies en 30 jours, c'est faisable en solo.

Les 1 000 Free, eux, sont un problème de **volume de trafic** : il faut ~20 000 visites en 30 jours (à 5 % de conversion visite→inscription). Aujourd'hui le site en fait ~100/mois. Aucun canal organique ne produit ×200 de trafic de façon *pilotable* en 30 jours. Seuls deux leviers le peuvent, et les deux sont **probabilistes, pas exécutables** : une vidéo courte qui perce (>200k vues), ou un Product Hunt top-3 relayé par la presse tech.

**Conséquence stratégique** : ce plan maximise les deux paris probabilistes (24 vidéos + 1 PH sérieux) tout en construisant un **plancher déterministe** (annuaires, communautés, outreach assos/écoles, referral produit) qui garantit 200-300 users même si les paris échouent. Et il traite l'objectif Entreprise comme la vraie victoire atteignable des 30 jours.

**⚠️ Avertissement le plus important du document** : **0 utilisateur actif sur les 7 derniers jours.** La rétention de Cosmo n'est pas prouvée — elle est inconnue, et le seul signal disponible est mauvais. Verser 1 000 utilisateurs dans un seau dont on n'a pas mesuré les trous est le meilleur moyen de brûler 30 jours et de ne rien pouvoir en conclure. **J1-J2 sont consacrés à l'instrumentation**, avant toute acquisition. C'est non négociable et c'est le seul endroit où je m'écarte de la demande brute.

---

## 1. Ce que j'ai vérifié (faits) vs ce que je suppose (hypothèses)

### 1.1 Faits vérifiés dans le code et en base de production (2026-08-13)

| Fait | Source | Valeur |
|---|---|---|
| Utilisateurs total (lifetime) | `auth.users` prod | **27** |
| Inscriptions sur 30 j | `auth.users` prod | **4** |
| Inscriptions sur 7 j | `auth.users` prod | **0** |
| Connexions sur 7 j | `auth.users.last_sign_in_at` | **0** |
| Organisations créées | `organizations` prod | **3** (11 membres — vraisemblablement tes tests) |
| Sessions démo | `demo_devices` prod | 1 à 7 / semaine depuis fin juin |
| Tracking de source d'acquisition | grep `utm_`/`?ref=`/`acquisition_source` | **inexistant** |
| Programme de referral | grep `referral` | **inexistant** |
| Page `/invite/:token` | `src/pages/InvitePage.tsx` | **spinner + redirect nu vers `/signup`** — aucune page de conversion |
| Langues exposées | `src/i18n/locale.ts` | `fr` + **`en`** (es prêt mais non exposé) |
| Parcours signup | `SignupPage.tsx` | signup → `/dashboard` direct ; choix `business` → `/entreprise/onboarding` (**self-serve, pas de vente requise**) |
| Premium perso | `premium-config.ts` | `PREMIUM_ENFORCED = false` → **tout est gratuit** |
| Pricing entreprise (décidé, dormant) | `premium-config.ts` | gratuit < 5 sièges · 20 €/mois 5-50 · 100 €/mois 50+ · **Stripe non branché** |
| Pages publiques entreprise | `docs/ENTREPRISE-MANQUEMENTS-2026-08-12.md` | page marketing + pricing **livrées le 2026-08-12** |
| SEO | `seo-vague-3-2026-08-12` | 18 URLs, 11 articles, autorité ≈ 0 → **10-30 visites/mois attendues à 3-5 mois** |
| Pipeline vidéo | `cosmo-marketing` + hyperframes | **opérationnel** (Reel 1080×1920 rendu en ~1-3 min) |

### 1.2 Hypothèses que je pose faute d'information (à corriger si faux)

| # | Hypothèse | Impact si fausse |
|---|---|---|
| H1 | Tu pars de **zéro audience** sur TikTok / IG / YouTube / X, et d'un LinkedIn perso de **< 500 relations**, majoritairement FR | Si tu as déjà 2 000+ relations LinkedIn qualifiées, le funnel Entreprise devient beaucoup plus rapide (+3-5 orgs) |
| H2 | Tu peux consacrer **~5 h/jour ouvré + 2-3 h/jour week-end** = **~135 h sur 30 jours** | À 2 h/jour, divise tous les résultats par ~2,2 |
| H3 | Budget outils ≈ **0-80 €/mois** (pas de pub, mais outils SaaS tolérés) | Sans budget du tout, remplace Instantly/Metricool par du code + envoi manuel (−1 h/j) |
| H4 | Le marché prioritaire est **la France**, en français | Voir §5.7 pour le scénario « bascule EN » |
| H5 | Tu es **seul** (pas de cofondateur, pas de freelance) | Un renfort 10 h/sem sur le montage vidéo ≈ +30-40 % de volume vidéo |
| H6 | Tu acceptes d'apparaître à l'écran / à la voix dans les vidéos | Si non : format « screen-only + voix off » — ceiling viral divisé par ~2 |
| H7 | Les 3 orgs existantes sont **tes tests**, pas de vrais clients | Si ce sont de vrais clients, tu as déjà 3/10 et un cas client à documenter |
| H8 | Aucun analytics web fiable n'est branché (je n'ai trouvé aucune preuve de Plausible/GA/Vercel Analytics actif) | Si Vercel Analytics est actif, J1 gagne 1 h |

**Ces hypothèses sont à valider en 10 minutes à J1.** Toutes les projections en dépendent.

---

## 2. Compréhension de Cosmo

### 2.1 Le produit
Application web (React/Vite/Supabase, mobile-first, aucun téléchargement) qui réunit **quatre piliers de productivité personnelle dans un seul écosystème** :
1. **Tâches** — priorités 1-5, catégories colorées, deadlines, listes intelligentes, récurrence serveur, partage 1-à-1
2. **Habitudes** — heatmap 26 semaines type GitHub, streaks, taux de complétion
3. **Agenda** — time-blocking par glisser-déposer (jour/semaine/mois)
4. **OKR** — Objectives & Key Results avec progression auto et journal de complétions

\+ **Statistiques transverses** (temps investi par module) et un **mode démo instantané sans compte** (100 tâches, 100 habitudes, 150 événements, 8 OKR pré-remplis).

Et, depuis juillet, un **mode Entreprise** : pyramide hiérarchique, projets d'équipe, agenda managérial, statistiques d'équipe, revue hebdo, labels, sous-tâches, notifications.

### 2.2 Le problème résolu
> « J'utilise Notion pour mes notes, Todoist pour mes tâches, Google Calendar pour mon planning, et une app à part pour mes habitudes. Rien ne se parle. Je passe plus de temps à organiser mon organisation qu'à travailler. »

Cosmo répond à la **fragmentation de la stack de productivité personnelle**. C'est un problème réel et très largement ressenti — mais **c'est aussi un problème à faible douleur** : personne ne perd d'argent parce que ses habitudes sont dans une autre app. Faible douleur = faible urgence = **conversion lente et rétention fragile**. C'est la contrainte structurelle n°1 du funnel Free.

Le mode Entreprise, lui, adresse une douleur **plus forte** : « je ne sais pas ce que fait mon équipe cette semaine, et je le découvre en réunion ». Douleur hebdomadaire, ressentie par une personne qui a le pouvoir de décider. C'est le meilleur angle commercial de Cosmo — et il est aujourd'hui presque invisible dans l'acquisition.

### 2.3 Cible et personas

**Persona A — « L'étudiant surchargé » (Léa, 21 ans, L3/M1)**
Douleur : partiels, stages, associatif, sport. Utilise Notion mal configuré + un carnet.
Où elle est : TikTok, Instagram, Discord de promo, r/etudiants, groupes Facebook de fac.
Pourquoi Cosmo : gratuit, joli, mobile, la heatmap d'habitudes est un objet de statut social.
Valeur business : **volume élevé, rétention faible, monétisation nulle.**

**Persona B — « Le jeune actif / freelance » (Thomas, 28 ans, dev ou designer indé)**
Douleur : jongler clients, admin, side-project, et une hygiène perso qui saute.
Où il est : X/Twitter, LinkedIn, Reddit (r/freelance, r/developpeurs), Indie Hackers, newsletters tech FR.
Pourquoi Cosmo : OKR + time-blocking dans le même outil, gratuit, pas d'usine à gaz.
Valeur business : **volume moyen, rétention meilleure, meilleur prescripteur (il partage les outils).**

**Persona C — « Le manager d'une petite équipe » (Sonia, 35 ans, 6-15 personnes)**
Agence, studio, cabinet, asso, service dans une PME.
Douleur : Monday/Asana sont trop lourds et trop chers pour 8 personnes ; les tableurs ne tiennent pas.
Où elle est : LinkedIn, réseaux pro locaux, communautés métier, email.
Pourquoi Cosmo : **pyramide + revue hebdo + stats d'équipe, gratuit sous 5 sièges, 20 €/mois ensuite.**
Valeur business : **c'est la seule cible qui a un chemin vers du revenu.**

**Persona D — « Le responsable d'organisation étudiante » (Maxime, 22 ans, JE / BDE / asso loi 1901)**
Douleur : 15 bénévoles, zéro budget outil, un Drive en désordre, une passation annuelle catastrophique.
Où il est : LinkedIn (les JE y sont très actives), annuaire CNJE, Instagram d'asso, réseaux inter-BDE.
Pourquoi Cosmo : **gratuit, en français, et il amène 5-30 utilisateurs d'un coup.**
Valeur business : **le meilleur ratio effort/résultat des 30 jours — il coche simultanément l'objectif Free ET l'objectif Entreprise.**

> **Décision de ciblage que je recommande** : persona **D en priorité absolue**, puis **C**, puis **A** (via la vidéo), puis **B** (via build-in-public). Un contact D réussi vaut 10 à 30 inscriptions Free **et** 1 unité Entreprise. Aucun autre canal n'a ce double rendement.

### 2.4 Positionnement
> **Cosmo, c'est Notion + Todoist + Google Calendar + un tracker d'habitudes, en une seule app, gratuite et en français.**

Contre-positionnements explicites (déjà partiellement écrits dans `llms.txt`) :
- **vs Notion** : Notion est flexible mais vide — il faut construire son système. Cosmo est structuré d'emblée.
- **vs Todoist** : pas d'habitudes, pas d'OKR, pas de time-blocking.
- **vs Monday/Asana (entreprise)** : conçus pour 50+ personnes, facturés par siège. Cosmo est un forfait, gratuit sous 5.

**À ne pas faire** : se positionner sur « gestion de projet ». C'est tranché depuis la vague 3 SEO — 84 % du volume de mots-clés mais un produit que Cosmo n'est pas, et une SERP tenue par Monday/Asana/Appvizer. Ne pas rouvrir ce front.

### 2.5 Proposition de valeur, par persona (à utiliser telle quelle dans les accroches)

| Persona | Accroche à utiliser |
|---|---|
| A — étudiant | « Tes cours, tes deadlines, tes habitudes et ton planning dans une seule app. Gratuit, en français, sans compte pour essayer. » |
| B — freelance | « Arrête de payer 3 abonnements pour t'organiser. Tâches + habitudes + agenda + OKR, en une app gratuite. » |
| C — manager | « Sache ce que fait ton équipe cette semaine sans réunion. Gratuit jusqu'à 5 personnes. » |
| D — asso/JE | « L'outil d'orga de ton asso : projets, tâches assignées, agenda commun. Gratuit, et la passation ne se perd plus. » |

### 2.6 Parcours d'inscription (état réel)
1. `/welcome` (landing) → CTA « Essayer la démo gratuite » **ou** « S'inscrire »
2. **Démo** : `/dashboard` pré-rempli, aucun compte, aucun email → **fuite majeure : rien ne ramène vers l'inscription**
3. **Signup** : email + mot de passe → `/dashboard` immédiat (pas de mur de confirmation email — bon point)
4. Choix `business` au signup → `/entreprise/onboarding` (création d'org **self-serve**)
5. Onboarding modules (`ModuleOnboarding`) au 1er login réel

**Les 3 fuites identifiées, par ordre de coût :**
- 🔴 **Démo → compte : aucun pont.** Un visiteur intéressé teste, aime, ferme l'onglet. C'est le trou n°1 du seau, et il est bon marché à colmater.
- 🔴 **`/invite/:token` → `/signup` nu.** Un invité arrive sur un formulaire sans savoir qui l'invite, à quoi, ni ce qu'est Cosmo. C'est le canal viral principal du produit, et il est cassé au sens conversion.
- 🟠 **Aucun email post-inscription.** Pas de séquence, pas de relance J1/J3/J7 → l'inactivité à 7 jours (constatée : 0 actif) n'est jamais combattue.

### 2.7 Parcours Free → Entreprise
Aujourd'hui : **il n'existe pas**. Le choix `business` se fait *au signup*, ou jamais. Un utilisateur Free qui prend un poste de manager 3 semaines plus tard n'a aucune invitation à créer une org.
→ **Dev P1** : bannière contextuelle « Vous travaillez en équipe ? Créez votre organisation » dans Réglages + Dashboard, déclenchée au 3ᵉ partage de tâche.

### 2.8 Mécanismes de viralité existants
| Mécanisme | État | Coefficient viral estimé |
|---|---|---|
| Partage de tâche 1-à-1 (gratuit, par design) | ✅ existe | **k ≈ 0,05-0,15** [INCERTAIN — jamais mesuré] |
| Invitation d'organisation (code + lien) | ✅ existe | **k ≈ 2-8 par org** (le meilleur multiplicateur du produit) |
| Partage de liste | ✅ existe (2026-07) | faible |
| Referral avec récompense | ❌ inexistant | à créer (voir CODE-P1) |
| Partage social d'un artefact (heatmap, bilan hebdo) | ❌ inexistant | fort potentiel, voir CODE-P1 |

> **Le meilleur levier viral de Cosmo n'est pas le partage de tâche : c'est l'invitation d'organisation.** Une org = 5 à 30 comptes créés en une action. C'est *encore* une raison de prioriser le persona D.

### 2.9 Canaux les plus naturels pour Cosmo
✅ **Oui** : vidéo courte FR (produit très visuel), annuaires/directories, Product Hunt, communautés étudiantes et assos, LinkedIn (persona C/D), Reddit FR, referral produit, outreach écoles/JE.
⚠️ **Peu** : SEO (compounding, hors fenêtre 30 j), X (audience nulle, ROI très lent), presse.
❌ **Non** : cold email B2C (illégal en France sans consentement — RGPD/LCEN), affiliation (rien à rémunérer sans revenu), marketplaces/intégrations (aucune API publique Cosmo aujourd'hui), webinars (aucune audience à convoquer).

---

## 3. Définitions et compteurs (à figer avant J1)

Sans définitions figées, le pilotage est impossible et le bilan à J30 sera invérifiable.

| Terme | Définition exacte | Requête de comptage |
|---|---|---|
| **Utilisateur Free** | Ligne dans `auth.users` créée entre J1 et J30, email ≠ tes adresses de test, ayant complété au moins 1 connexion | `count(*) from auth.users where created_at between … and email not in (…)` |
| **Free activé (AHA)** | A créé ≥ 3 tâches **ou** ≥ 1 habitude **ou** ≥ 1 événement dans les 48 h suivant l'inscription | jointure `tasks`/`habits`/`events` |
| **Free retenu D7** | A une entrée `user_activity_days` ≥ J+5 après inscription | `user_activity_days` |
| **Compte Entreprise (unité de l'objectif)** | **Une organisation créée entre J1 et J30, avec ≥ 3 membres distincts ayant chacun ≥ 1 connexion, dont le propriétaire n'est pas toi** | `organizations` ⨝ `organization_members` |
| **MQL Entreprise** | Un contact ICP qui a **répondu positivement** (démo demandée, ou lien démo cliqué + réponse) | CRM |
| **SQL Entreprise** | MQL + équipe ≥ 3 personnes confirmée + décideur identifié + créneau démo posé | CRM |
| **Opportunité** | Démo réalisée, org créée, en cours d'invitation des membres | CRM |
| **CAC en temps** | (heures totales d'acquisition) ÷ (utilisateurs Free acquis) | dashboard |

> ⚠️ Compte **« org avec ≥ 3 membres »**, pas « org créée ». Une org à 1 membre est un compte Free avec un chapeau. Si tu comptes les orgs vides, tu peux « atteindre » 10 en une soirée et n'avoir rien appris.

---

## 4. FUNNEL FREE — objectif 1 000, attendu 220-350

### 4.1 Le calcul de contrainte (le chiffre qui commande tout)

```
Hypothèse : conversion visite unique → inscription = 5 %
  (fourchette 3-8 % ; produit gratuit, sans CB, mais concurrencé par la démo
   sans compte qui capte une partie des visiteurs motivés)

Calcul : 1 000 inscriptions ÷ 5 % = 20 000 visites uniques en 30 jours
       = ~667 visites/jour, tous les jours

État actuel : ~100 visites/mois estimées → ~3/jour
Facteur requis : ×200
```

**Aucun canal organique pilotable ne produit ×200 en 30 jours.** Ce qui suit maximise donc (a) le plancher certain et (b) les tickets de loterie.

**Levier alternatif souvent sous-estimé** : améliorer le taux de 5 % → 8 % réduit le trafic nécessaire de 20 000 à 12 500. C'est pourquoi les 3 devs de conversion (§7 CODE-P0) valent plus que 3 jours de posting.

### 4.2 Allocation par canal (scénario réaliste central)

| Canal | Volume d'actions sur 30 j | Visites attendues | Inscriptions | Confiance | Difficulté | Vitesse | Temps | Dépendances | Potentiel LT |
|---|---|---|---|---|---|---|---|---|---|
| **Outreach assos / JE / BDE / écoles** | 180 emails + 60 DM | — (effet direct) | **60 – 140** | Moyenne | Moyenne | 7-20 j | 22 h | Base de contacts (CODE-P1) | Moyen |
| **Vidéo courte FR** (TikTok+Reels+Shorts) | 24 vidéos × 3 plateformes | 150 – 1 200 | **10 – 70** | **Faible** (variance ×20) | Élevée | 3-25 j | 34 h | Pipeline hyperframes ✅ | **Très fort** |
| **Product Hunt** (1 lancement, J23) | 1 launch + 40 pré-DM | 400 – 1 200 | **25 – 90** | Moyenne | Élevée | 1 j | 14 h | EN complet ✅, assets, hunters | Moyen |
| **Reddit** (FR + EN) | 12 posts + 60 commentaires | 400 – 1 500 | **20 – 75** | Moyenne | Moyenne | 1-3 j | 12 h | Karma préalable ⚠️ | Faible |
| **LinkedIn** (build in public + persona C/D) | 20 posts + 600 connexions | 300 – 900 | **20 – 60** | Moyenne | Faible | 5-20 j | 20 h | Aucune | Fort |
| **Annuaires / directories** (28 soumissions) | 28 fiches | 300 – 900 | **15 – 50** | **Forte** | Faible | 2-14 j | 8 h | Assets (logo, screens, EN) | Moyen (SEO) |
| **Discord / Slack / groupes FB FR** | 15 communautés | 200 – 600 | **12 – 45** | Moyenne | Moyenne | 2-10 j | 10 h | Présence préalable ⚠️ | Faible |
| **Referral produit** (in-app) | dev + activation | — | **+8-15 % du total** | Moyenne | Moyenne | 10-30 j | 8 h dev | CODE-P1 | **Fort** |
| **Newsletters / partenariats FR** | 12 pitchs → 3-5 placements | 200 – 800 | **8 – 40** | Faible | Moyenne | 10-25 j | 9 h | Réponse de tiers | Moyen |
| **X / Twitter build in public** | 60 posts | 100 – 400 | **3 – 20** | Faible | Faible | 15-30 j | 8 h | Aucune | Moyen |
| **PR / presse indie FR** | 8 pitchs | 0 – 500 | **0 – 25** | **Faible** | Élevée | 10-30 j | 5 h | Angle news | Faible |
| **SEO** | acquis (18 URLs) | 20 – 60 | **1 – 4** | Forte (que c'est faible) | — | 3-12 mois | 2 h | Autorité | **Très fort** |
| **TOTAL brut (milieux de fourchette)** | | ~3 500 – 6 500 | **~404** | | | **~152 h** | | |
| **× facteur d'exécution 0,65** *(solo, 30 j, tout démarre de zéro simultanément)* | | | **≈ 260** | | | | | |

> **Le facteur d'exécution 0,65 n'est pas de la prudence décorative.** Un plan solo à 12 canaux simultanés n'est jamais exécuté à 100 % : maladie, bug prod, un canal qui prend 3× le temps prévu, un ban Reddit. Historiquement, les plans multi-canaux solo tournent entre 0,5 et 0,8 de leur volume théorique.

### 4.3 Détail des calculs par canal principal

**Outreach assos / JE / BDE** *(le canal le plus rentable — à traiter en premier)*
```
180 organisations contactées (JE via annuaire CNJE, BDE, assos loi 1901, clubs)
× 22 % de taux de réponse          → 40 réponses
   (hyp. haute vs cold email classique : cible non sollicitée, gratuite,
    étudiante, très réactive sur LinkedIn/Insta)
× 45 % de réponses positives        → 18 organisations intéressées
× 55 % qui testent réellement       → 10 organisations qui adoptent
× 8 membres invités en moyenne      → 80 inscriptions
Fourchette :  6 orgs × 5 = 30   …   14 orgs × 12 = 168
Retenu : 60 – 140   [INCERTAIN sur le nb moyen de membres : 5 à 15 selon le type d'asso]
```

**Vidéo courte** *(le pari principal)*
```
24 vidéos publiées sur 3 plateformes = 72 publications
Distribution réaliste sans audience :
  - 60 publications à 200-800 vues       → ~30 000 vues cumulées… non :
    60 × 400 = 24 000 vues
  - 10 publications à 2 000-8 000 vues   → 10 × 4 000 = 40 000 vues
  -  2 publications à 20 000-60 000 vues → 2 × 35 000 = 70 000 vues  [OPTIONNEL — n'arrive pas toujours]
Scénario central SANS percée : ~30 000 vues cumulées
× 1,5 % de clics vers le lien bio       → 450 visites
× 6 % d'inscription (trafic tiède)      → 27 inscriptions
Scénario AVEC une vidéo à 300k vues :
  300 000 × 1,2 % = 3 600 visites × 6 % = 216 inscriptions (sur cette seule vidéo)
```
> **C'est ici que se joue l'écart entre 300 et 1 000.** Une seule vidéo qui perce fait plus que 20 jours de tout le reste. Elle n'est pas planifiable — seulement rendue plus probable par le volume et l'itération sur les hooks.

**Product Hunt**
```
Lancement sans audience, produit FR, catégorie Productivity (très concurrentielle)
Rang attendu : #8-20 du jour   → 60-200 upvotes
   (top-5 = 250+ upvotes : nécessite un réseau que H1 dit que tu n'as pas)
→ 400-1 200 visites sur 48 h
× 6 % (trafic PH = qualifié mais très volatil, beaucoup de "lookers")
= 25 – 72 inscriptions
Bonus si top-5 : ×3 sur le trafic + reprises newsletters → 150-250 inscriptions  [~15 % de probabilité]
```

**Reddit**
```
12 posts sur 30 j répartis sur r/productivite, r/france (⚠️ règles strictes),
r/etudiants, r/developpeurs, r/freelance, r/EnfrançaisSVP, r/SideProject (EN),
r/productivity (EN), r/selfhosted (non — pas self-hostable)
Réalité statistique : 8 posts font <500 vues, 3 font 2 000-8 000, 1 fait 20 000+
Vues cumulées : ~45 000  × 2 % clic = 900 visites × 5 % = 45 inscriptions
⚠️ Risque : 2-4 posts supprimés par les modérateurs (promotion). Prévois-le.
```

**Annuaires / directories** — plancher le plus fiable
```
28 fiches soumises → ~20 publiées (72 % d'acceptation)
× 25 visites/mois en moyenne par fiche vivante (très dispersé : 2 à 300)
= 500 visites × 6 % = 30 inscriptions
Confiance FORTE parce que c'est déterministe : tu soumets, ça publie, ça reste.
Bénéfice caché : backlinks → c'est aussi le meilleur levier SEO 30 j (autorité).
```

### 4.4 Contraintes majeures du funnel Free
1. **Le mode démo cannibalise l'inscription** — c'est un choix produit excellent pour l'essai, coûteux pour le compteur. Colmater par CODE-P0-3.
2. **Aucune preuve sociale** — 27 users, 0 avis, 0 témoignage. Chaque page de conversion démarre à froid. → produire 3 témoignages en semaine 2.
3. **Rétention non prouvée** — 0 actif à 7 j. Acquérir sans corriger = gaspillage.
4. **Un seul exécutant** — la vidéo (34 h) et l'outreach (22 h) se disputent le même créneau.
5. **Reddit et les Discord détectent la promotion** — le ratio contribution/promotion doit rester ≥ 5:1, sinon ban et perte sèche du canal.
6. **Product Hunt ne se relance pas** — un lancement raté est définitif (relaunch mal vu). D'où la préparation sur 3 semaines et le lancement à J23, pas à J3.

---

## 5. FUNNEL ENTREPRISE — objectif 10, attendu 6-12

> **Ne pas mélanger avec le funnel Free.** Cible différente, message différent, canal différent, rythme différent, KPI différent.

### 5.1 Définition du lead et critères de qualification

**Unité comptée** : une **organisation créée avec ≥ 3 membres distincts connectés au moins une fois**, propriétaire ≠ toi, entre J1 et J30.

**ICP primaire (à travailler en priorité)**
| Critère | Valeur cible |
|---|---|
| Type | Junior-Entreprise, BDE, association loi 1901, club sportif, collectif de freelances |
| Taille | 5 – 30 personnes actives |
| Budget outil | **0 €** (c'est un avantage, pas un obstacle : Cosmo est gratuit sous 5 sièges et à 20 €/mois ensuite) |
| Décideur | Président / VP / responsable pôle — **joignable directement**, décide seul |
| Signal d'intention | Utilise déjà Trello/Notion/Drive/WhatsApp pour s'organiser, s'en plaint publiquement |
| Cycle | **3 – 12 jours** |

**ICP secondaire**
| Critère | Valeur cible |
|---|---|
| Type | Agence, studio, cabinet, startup pre-seed, service dans une PME |
| Taille | 5 – 20 personnes |
| Décideur | Fondateur, dirigeant, head of |
| Signal | Recrute (= grossit), poste sur LinkedIn à propos d'orga/process |
| Cycle | **3 – 8 semaines** → ⚠️ **la plupart ne closeront PAS dans la fenêtre 30 j** |

**Disqualification immédiate** : > 50 personnes (Cosmo n'a pas le Gantt / la charge d'équipe qu'ils exigeront), besoin d'un SSO/SLA/DPA formel, secteur réglementé exigeant un hébergement dédié, équipe déjà sous contrat Monday/Asana annuel.

### 5.2 Le modèle chiffré

**Canal 1 — Cold email B2B (base légale : intérêt légitime, contacts pro nominatifs, opt-out en 1 clic)**
```
420 organisations ciblées et enrichies
× 1,4 contact/org                                  → 590 emails envoyés (séquence 3 touches)
× 9 % de taux de réponse                           → 53 réponses
   (fourchette 5-14 % ; haut de fourchette sur les JE/assos, bas sur les PME)
× 38 % de réponses positives                       → 20 conversations qualifiées
× 60 % qui acceptent un créneau de 20 min          → 12 démos
× 55 % qui créent une org + invitent ≥ 2 personnes → 6,6 organisations
────────────────────────────────────────────────────────────────
Résultat central : ≈ 6 organisations   (fourchette 3 – 11)
```

**Canal 2 — Outbound LinkedIn (persona C et D)**
```
600 demandes de connexion ciblées (20/j, plafond de sécurité)
× 32 % d'acceptation                               → 192 connexions
× 45 % de messages de suivi effectivement lus      → 86
×  9 % qui engagent une conversation               → 8 conversations
× 50 % → démo                                      → 4 démos
× 55 % → org avec ≥ 3 membres                      → 2,2 organisations
────────────────────────────────────────────────────────────────
Résultat central : ≈ 2 organisations   (fourchette 1 – 4)
```

**Canal 3 — Inbound (page /pour-equipes + posts LinkedIn + démo publique)**
```
~700 visites sur les pages entreprise sur 30 j
× 3 % de demandes de contact / essais org         → 21 signups business
× 25 % qui atteignent ≥ 3 membres                 → 5,2 … trop optimiste sans nurturing.
Correction (aucun email de relance en place au départ) : × 12 % → 2,5
────────────────────────────────────────────────────────────────
Résultat central : ≈ 2 organisations   (fourchette 0 – 4)
```

**Canal 4 — Réseau personnel et direct (le plus sous-estimé)**
```
40 personnes de ton réseau réel (ex-collègues, école, clients, amis fondateurs)
× 55 % de réponse (réseau chaud)                  → 22
× 30 % qui ont une équipe pertinente              → 6,6
× 45 % qui testent avec leur équipe               → 3 organisations
────────────────────────────────────────────────────────────────
Résultat central : ≈ 3 organisations   (fourchette 1 – 5)
```
> ⚠️ **Ne saute pas ce canal parce qu'il n'est pas « scalable ».** Sur 30 jours et 10 unités, c'est mathématiquement le meilleur : taux de réponse ×6 et cycle divisé par 3. Les 3 premières orgs viendront presque certainement de là.

**Total Entreprise**
| Canal | Central | Fourchette |
|---|---|---|
| Cold email B2B | 6 | 3 – 11 |
| Outbound LinkedIn | 2 | 1 – 4 |
| Inbound | 2 | 0 – 4 |
| Réseau direct | 3 | 1 – 5 |
| **Somme brute** | **13** | 5 – 24 |
| **× 0,7 (chevauchement, no-show, orgs qui restent à 1 membre)** | **≈ 9** | **4 – 17** |

**Attendu final : 6 – 12 organisations.** L'objectif de 10 est dans la fourchette haute du réaliste.

### 5.3 Nombre de conversations nécessaires
Pour 10 orgs à 55 % de conversion démo→org : **≈ 18 démos**, donc **≈ 30 conversations qualifiées**, donc **≈ 80 réponses**, donc **≈ 1 000 contacts touchés** sur 30 jours. Soit **~35 contacts touchés par jour ouvré**, tous canaux confondus. C'est le rythme à tenir.

### 5.4 Durée du cycle de vente
| Segment | Cycle | Closable en 30 j ? |
|---|---|---|
| Réseau direct | 2 – 7 j | ✅ oui |
| JE / BDE / asso | 3 – 12 j | ✅ oui |
| Freelances / collectif | 5 – 15 j | ✅ oui |
| Agence / studio 5-15 p. | 3 – 8 semaines | ⚠️ la moitié seulement |
| PME > 20 p. | 6 – 16 semaines | ❌ non |

> **Décision** : sur ces 30 jours, **n'investis pas plus de 20 % du temps outbound sur les PME > 20 personnes.** Elles ne closeront pas dans la fenêtre. Elles alimentent le mois suivant — ce qui est légitime, mais ne doit pas être compté dans l'objectif.

### 5.5 Actions manuelles indispensables (non automatisables)
1. **La démo de 20 min** — 18 démos × 35 min (prépa + call + suivi) = **10,5 h**
2. **La qualification en live** — comprendre la structure d'équipe réelle
3. **L'aide à l'invitation des membres** — accompagner le propriétaire pendant qu'il invite (c'est LE moment où ça casse : une org à 1 membre ne compte pas)
4. **La réponse aux objections confidentialité** (« mes salariés vont croire que je les surveille ») — la FAQ y répond, mais la conviction se fait en voix
5. **La relance J+3 post-démo si l'org est restée à 1 membre**

### 5.6 Le risque n°1 du funnel Entreprise
**Une org créée mais jamais peuplée.** C'est le mode d'échec le plus probable : le décideur crée l'org pendant la démo, dit « je fais suivre à l'équipe », et rien ne se passe.
**Parade** : ne jamais terminer une démo sans que **2 invitations soient parties en direct pendant l'appel**. C'est une règle absolue. Elle change la conversion de ~30 % à ~55 %.

### 5.7 Scénario alternatif : bascule sur l'anglais
L'anglais est exposé (`SUPPORTED_LOCALES = ['fr','en']`). Passer le funnel Free en EN multiplie le marché adressable par ~15 sur Reddit/PH/directories — mais divise le taux de conversion (concurrence féroce, aucune différenciation « app française »).
**Recommandation** : **FR pour l'outreach et les communautés, EN pour Product Hunt et les directories internationaux.** C'est ce que fait le plan J1-J30.

---

## 6. La machine d'acquisition Cosmo (système de bout en bout)

```
┌─ SOURCING ────────────┐   ┌─ QUALIFICATION ───────┐   ┌─ PERSONNALISATION ────┐
│ CNJE (annuaire JE)    │   │ Scoring ICP 0-100      │   │ 1re ligne générée par │
│ Annuaire assos (RNA)  │──▶│ • taille équipe  40 pts│──▶│ LLM à partir d'un     │
│ Pappers (SIRET, NAF)  │   │ • type d'orga    30 pts│   │ signal réel (post,    │
│ LinkedIn Sales Nav    │   │ • signal récent  20 pts│   │ recrutement, site)    │
│ (manuel/semi)         │   │ • email trouvé   10 pts│   │ + variante A/B        │
└───────────────────────┘   └────────────────────────┘   └───────────┬───────────┘
                                                                     │ REVIEW (toi)
┌─ CRM ─────────────────┐   ┌─ CONTACT ─────────────┐                ▼
│ Notion/Airtable       │◀──│ Instantly (email ×3)   │◀── file d'envoi validée
│ statut, source, next  │   │ LinkedIn (manuel 20/j) │
│ step, date            │──▶│ Relance J+3 / J+7      │
└──────────┬────────────┘   └───────────┬───────────┘
           │                            │ réponse
           │                            ▼
           │                ┌─ TRIAGE LLM ──────────┐
           │                │ positif / négatif /   │
           │                │ plus tard / OOO       │──▶ notification Slack/Discord
           │                └───────────┬───────────┘     si "positif" → toi sous 2 h
           ▼                            ▼
┌─ ACTIVATION ──────────┐   ┌─ DÉMO (MANUEL) ───────┐
│ Séquence Brevo J0/J1/ │   │ 20 min + création org  │
│ J3/J7 selon persona   │   │ + 2 invitations EN     │
│ Trigger : webhook     │   │ DIRECT pendant l'appel │
│ Supabase auth.users   │   └───────────┬───────────┘
└──────────┬────────────┘               │
           ▼                            ▼
┌─ CONVERSION ──────────┐   ┌─ REFERRAL ────────────┐
│ Free activé (AHA 48 h)│──▶│ lien /r/:code in-app  │
│ Org ≥ 3 membres       │   │ + partage heatmap     │──┐
└──────────┬────────────┘   └───────────────────────┘  │ boucle
           ▼                                            │
┌─ REPORTING ───────────────────────────────────────────┘
│ Cron 08:00 : SQL Supabase + analytics → digest quotidien
│ Attribution par source (?ref=) · alertes de seuil
└────────────────────────────────────────────────────────
```

**Le maillon qui n'existe pas encore et qui casse toute la chaîne : l'attribution (`?ref=`).** Sans lui, la boucle « mesurer → arrêter ou doubler » du §12 est inopérante : tu sauras que 260 personnes se sont inscrites, jamais d'où elles viennent, donc jamais quoi doubler. **C'est le dev n°1, avant toute publication.**

---

## 7. AUTOMATISATIONS MARKETING (catégorie AUTO)

Format : **Trigger → Traitement → Sortie → Outil → Intervention humaine**

| # | Automatisation | Trigger | Traitement | Sortie | Outil | Humain | Fréquence |
|---|---|---|---|---|---|---|---|
| A1 | **Digest KPI quotidien** | Cron 08:00 | Requête SQL Supabase (inscriptions, orgs, activation, par source) + Vercel Analytics | Message formaté | n8n (self-host) ou Make | Lecture 5 min | 1×/j |
| A2 | **Alerte inscription temps réel** | Webhook Supabase `auth.users` INSERT | Enrichit (source, domaine email) | Notif Discord/Slack | Supabase DB Webhook → n8n | Aucune (lecture) | temps réel |
| A3 | **Séquence d'activation email** | Nouvel utilisateur | Branche selon persona (domaine .edu / pro / autre) : J0 bienvenue, J1 « crée tes 3 premières tâches », J3 « la heatmap d'habitudes », J7 « invite ton équipe » | 4 emails | Brevo (gratuit < 300 envois/j) | Rédaction initiale, puis rien | temps réel |
| A4 | **Séquence cold email 3 touches** | Ajout d'un lead validé dans la liste | J0 accroche, J+3 relance courte, J+7 « je clos le dossier » | Emails + désinscription | Instantly / lemlist / Brevo | **REVIEW du lot avant envoi** | 1 lot/j |
| A5 | **Triage des réponses par LLM** | Réponse reçue en boîte | Classifie positif / négatif / plus tard / absence | Tag CRM + notif si positif | n8n + API Claude | Répond aux positifs **sous 2 h** | temps réel |
| A6 | **Programmation des posts sociaux** | Lot validé le dimanche | Publie LinkedIn / X / IG aux heures fixées | Posts publiés | Metricool ou Buffer (gratuits) | REVIEW hebdo du lot | 1×/sem |
| A7 | **Veille de mots-clés communautés** | Cron 2×/j | Cherche « alternative Todoist », « app habitudes », « m'organiser » sur Reddit + HN | Liste de threads à commenter | n8n + API Reddit (gratuite) | **Écrit le commentaire lui-même** | 2×/j |
| A8 | **Génération des premiers jets** | Manuel / cron | Brief → 5 hooks vidéo + 3 posts LinkedIn + 1 script | Brouillons | API Claude (script CLI) | **REVIEW systématique** | 1×/j |
| A9 | **Rendu des Reels** | Script validé | hyperframes render 1080×1920 | MP4 | `cosmo-marketing` (opérationnel) | Validation visuelle | 2×/j |
| A10 | **Sync CRM ↔ base** | Nouvelle org créée | Match domaine email ↔ leads du CRM | Statut « converti » | n8n + Supabase | Aucune | temps réel |
| A11 | **Rapport hebdo** | Dimanche 18:00 | Agrège la semaine, calcule par canal, compare aux seuils du §11 | Document + alertes | n8n + API Claude | **Décisions stop/double** | 1×/sem |
| A12 | **Relance des orgs à 1 membre** | Org > 48 h avec < 3 membres | Email au propriétaire + tâche CRM | Email + notif | n8n | Appel si toujours bloqué à J+5 | 1×/j |

> **Ce qu'il faut surveiller sur A4** : la délivrabilité. Une nouvelle adresse d'envoi qui part à 50 mails/jour finit en spam. **Warm-up obligatoire J1-J7 (10-15 mails/j max), montée progressive, domaine d'envoi distinct de `thecosmo.app`** (ex. `hello@cosmo-app.fr`) pour ne jamais brûler la réputation du domaine principal.

> **Cadre légal — à ne pas contourner** : cold email **B2B uniquement** (contacts pro nominatifs, message en lien avec leur fonction, opt-out visible, mentions d'identité) — c'est licite en France sous intérêt légitime. **Cold email B2C : interdit sans consentement préalable.** L'automatisation LinkedIn par bot viole les CGU et fait bannir le compte : les 20 connexions/jour restent **manuelles ou semi-manuelles**.

---

## 8. CE QUI MÉRITE D'ÊTRE CODÉ (catégorie CODE)

Priorisé par ROI réel, pas par intérêt technique.

### 🔴 P0 — à faire J1-J3, avant toute acquisition

**CODE-P0-1 — Attribution de source d'acquisition (`?ref=` / UTM)**
- **Valeur business** : sans ça, aucune décision d'allocation n'est possible pendant 30 jours. C'est le prérequis de tout le §12.
- **Logique** : au premier chargement, si `?ref=` ou `utm_source` présent → stocker en `localStorage` (`cosmo_first_touch`, first-touch, TTL 30 j) ; à l'inscription, envoyer la valeur dans `raw_user_meta_data` ; un trigger la copie dans `profiles.acquisition_source` ; exposer l'agrégat dans `get_admin_stats`.
- **Entrées** : query string. **Sorties** : colonne `acquisition_source`, `acquisition_campaign`, `first_seen_at`.
- **Architecture** :
  ```
  src/lib/attribution.ts      → captureFirstTouch() appelé dans main.tsx
  AuthContext.register()      → options.data = { acquisition_source, acquisition_campaign }
  migration NNN_acquisition.sql → ALTER TABLE profiles ADD COLUMN … ;
                                  handle_new_user_profile() copie les meta
  get_admin_stats()           → + agrégat GROUP BY acquisition_source
  ```
- **Limites / risques** : navigation privée et ITP Safari peuvent perdre le localStorage (sous-comptage de 10-20 %) ; ne jamais mettre de donnée personnelle dans l'URL ; valider/whitelister la valeur côté serveur (max 40 car., `[a-z0-9_-]`) pour éviter le stockage de contenu arbitraire.
- **Temps** : 4-6 h · **Priorité P0** · **ROI : très élevé** (rend les 29 jours suivants pilotables)

**CODE-P0-2 — Page de conversion `/invite/:token`**
- **Valeur business** : c'est le canal viral principal (org + partage de tâche) et il aboutit aujourd'hui sur un formulaire nu. Conversion estimée actuelle 15-25 %, cible 45-60 %.
- **Logique** : résoudre le token côté public (RPC `SECURITY DEFINER` exposant **uniquement** prénom de l'inviteur + titre de la tâche/nom de l'org — jamais l'email), afficher « **Marie vous invite à rejoindre « Refonte du site » sur Cosmo** » + 3 bénéfices + CTA, puis `/signup` avec le token conservé.
- **Risque** : fuite de données via la RPC publique. **Whitelist stricte des colonnes retournées**, rate-limit sur le token.
- **Temps** : 3-4 h · **ROI : élevé**

**CODE-P0-3 — Pont démo → compte**
- **Valeur business** : le trou n°1 du seau. Tous les canaux de ce plan y déversent leur trafic.
- **Logique** : après 90 s d'usage démo **ou** à la 3ᵉ action de création, afficher un bandeau non bloquant « Vous aimez ? Créez votre compte, vos données démo restent, et vous repartez de zéro proprement » ; à l'inscription depuis la démo, marquer `acquisition_source = 'demo'`.
- **Attention** : **ne pas casser les fixtures E2E** (`loginDemo()` + parcours Playwright). Bandeau dismissible, flag `localStorage`, et exclu quand `import.meta.env.MODE === 'test'`.
- **Temps** : 3-4 h · **ROI : très élevé**

### 🟠 P1 — semaine 1-2

**CODE-P1-4 — Moteur de sourcing + scoring ICP (script Node local)**
- **Valeur** : produit la matière première des 1 000 contacts du §5.3. Fait à la main, c'est 25 h ; codé, c'est 8 h une fois.
- **Architecture** :
  ```
  scripts/growth/
    sources/cnje.mjs      → annuaire des Junior-Entreprises (public)
    sources/rna.mjs       → répertoire national des associations (open data data.gouv)
    sources/pappers.mjs   → API Pappers (SIRET, effectif, NAF) — freemium
    enrich.mjs            → devine l'email pro (patterns) + vérifie MX
    score.mjs             → ICP 0-100 (taille 40 / type 30 / signal 20 / email 10)
    generate.mjs          → 1re ligne personnalisée via API Claude (batch)
    export.mjs            → CSV pour Instantly + upsert CRM
  ```
- **Entrées** : sources publiques. **Sorties** : CSV `{org, contact, email, score, ligne_1, source}`.
- **Fréquence** : 1 run/jour, 40 leads.
- **Limites/risques** : robots.txt et CGU à respecter source par source (le RNA et le CNJE sont des données publiques ; ne **pas** scraper LinkedIn — CGU + risque de ban) ; taux de bounce si les emails sont devinés → **vérifier les MX et rester sous 3 % de bounce**, sinon la délivrabilité s'effondre.
- **Temps** : 8-10 h · **ROI : élevé**

**CODE-P1-5 — Referral in-app**
- **Logique** : `profiles.referral_code` (8 car.), route `/r/:code` → pose la source et redirige, compteur de filleuls activés, récompense = badge + « Premium à vie » (gratuit aujourd'hui de toute façon → coût réel nul, valeur perçue non nulle).
- **Risque** : auto-referral. Compter uniquement les filleuls **activés** (AHA 48 h) et dédupliquer par device (`demo_devices` existe déjà).
- **Temps** : 6-8 h + 1 migration · **ROI : moyen sur 30 j, élevé à 6 mois**

**CODE-P1-6 — Bilan hebdo partageable (l'objet viral)**
- **Logique** : une image générée (heatmap d'habitudes + tâches terminées + streak) téléchargeable en un clic, au format story 1080×1920, avec un discret « fait avec Cosmo · thecosmo.app ». Rendu client (canvas) ou via le pipeline hyperframes existant.
- **Valeur** : c'est le seul mécanisme qui transforme un utilisateur en canal. La heatmap style GitHub est déjà l'objet le plus « montrable » du produit.
- **Temps** : 6-8 h · **ROI : moyen-élevé**, **[INCERTAIN]** — dépend entièrement du nombre d'utilisateurs actifs, donc à ne lancer qu'à partir de ~150 users.

**CODE-P1-7 — Dashboard growth quotidien**
- Étendre `get_admin_stats` (inscriptions par source/jour, activation 48 h, orgs par taille, cohortes D1/D7) et l'afficher dans `/admin` + digest A1.
- **Temps** : 4-5 h · **ROI : élevé** (c'est l'instrument de pilotage)

### 🟡 P2 — seulement si le temps le permet

| # | Idée | Valeur | Temps | ROI |
|---|---|---|---|---|
| CODE-P2-8 | Veille communautés (Reddit/HN keywords → digest) | moyenne | 3-4 h | moyen |
| CODE-P2-9 | Bannière contextuelle Free → Entreprise (au 3ᵉ partage) | moyenne | 2-3 h | moyen |
| CODE-P2-10 | Détection d'intention (utilisateur qui invite 2× → alerte commerciale) | moyenne | 3 h | moyen |
| CODE-P2-11 | Génération auto des variantes de screenshots pour les directories | faible | 4 h | faible |

### ❌ Ne code pas ça pendant ces 30 jours
Un CRM maison (Notion/Airtable suffit) · un outil d'emailing maison (délivrabilité = métier à part entière) · un bot LinkedIn (ban) · un système d'attribution multi-touch (over-engineering à 260 users) · une API publique / des intégrations Zapier (zéro demande, sans base d'utilisateurs c'est du vide).

---

## 9. CE QUI DOIT RESTER HUMAIN (catégorie MANUEL)

| Tâche | Pourquoi | Comment | Durée | Fréquence |
|---|---|---|---|---|
| **Démo Entreprise 20 min** | Il faut lire la structure d'équipe réelle et lever l'objection surveillance en direct. Aucun LLM ne fait ça. | Visio, écran partagé, **création de l'org + 2 invitations pendant l'appel** | 35 min | 4-6 / sem |
| **Réponses Reddit / Discord** | Un message généré se repère en 3 secondes et fait bannir le canal | Réponse utile, mention de Cosmo seulement si pertinente, ratio 5:1 | 20 min | 2×/j |
| **DM aux créateurs / partenaires** | La relation vaut plus que le message | 5 DM/j, personnalisés à partir d'un contenu réel de la personne | 25 min | 1×/j |
| **Partenariats & newsletters** | Négociation, réciprocité, contexte | Email personnel, jamais de séquence | 30 min | 3×/sem |
| **Face caméra / voix** | C'est le produit d'un développeur solo : l'humain EST l'angle | Tournage batch 6 vidéos | 2 h | 2×/sem |
| **Réponse aux 20 premiers utilisateurs** | Chacun est un témoignage potentiel. À 27 users lifetime, chaque personne compte | Email perso sous 24 h après inscription | 10 min | quotidien |
| **Décisions stop/double** | Arbitrage stratégique | Revue du dimanche | 45 min | 1×/sem |
| **Product Hunt le jour J** | Il faut répondre à chaque commentaire en < 30 min pendant 14 h | Journée bloquée | 8 h | 1× |
| **Objections confidentialité** | Sujet sensible : une mauvaise réponse tue le deal et la réputation | À la voix, avec la FAQ comme appui | 10 min | à la demande |

---

## 10. PLAN JOUR PAR JOUR — J1 → J30

### 10.0 Rituels quotidiens (à ne PAS répéter dans chaque journée)

| Code | Rituel | Créneau | Durée | Catégorie |
|---|---|---|---|---|
| **R1** | Lire le digest KPI (A1), noter les 3 chiffres du jour dans le tableau de bord | 08:30 | 10 min | REVIEW |
| **R2** | Répondre à toute réponse entrante (email/LinkedIn/Reddit/DM) — **SLA 2 h** | 09:00 + 17:00 | 30 min | MANUEL |
| **R3** | 20 demandes de connexion LinkedIn ICP + 10 messages de suivi | 09:30 | 30 min | MANUEL |
| **R4** | Publier 1 post LinkedIn + 2 posts X (programmés la veille) | 08:00 (auto) | 0 min | AUTO |
| **R5** | Publier 1 vidéo courte sur les 3 plateformes | 12:00 + 18:30 | 15 min | AUTO/REVIEW |
| **R6** | Répondre à 100 % des commentaires sous 2 h | continu | 20 min | MANUEL |
| **R7** | Valider le lot d'emails du lendemain (40 leads) | 18:00 | 20 min | REVIEW |
| **R8** | Écrire l'email perso à chaque nouvel inscrit du jour | 18:30 | 10 min | MANUEL |
| **R9** | Mettre le CRM à jour (statuts, next steps) | 19:00 | 15 min | MANUEL |

**Charge des rituels : ~2 h 30/jour.** Les blocs ci-dessous s'ajoutent.

---

### SEMAINE 1 — Instrumenter, armer, amorcer (J1-J7)
**Objectif de semaine : 25-45 Free · 1-2 orgs · toute la machine debout**

---
#### **J1 — Jeudi 14/08 — Instrumentation (aucune acquisition aujourd'hui)**
- **Objectif** : rendre les 29 jours suivants mesurables.
- **Actions**
  1. **[CODE-P0-1]** Attribution `?ref=`/UTM — dev + migration + déploiement · **4-6 h**
  2. **[MANUEL]** Vérifier les 8 hypothèses du §1.2 (10 min) — surtout H1 (audience) et H8 (analytics)
  3. **[AUTO]** Brancher un analytics : Vercel Analytics (1 clic) ou Plausible · 20 min
  4. **[MANUEL]** Créer le CRM (Notion ou Airtable) avec les colonnes : `org, contact, rôle, email, LinkedIn, source, score ICP, statut, next step, date, notes`
  5. **[MANUEL]** Créer le tableau de bord du §11 (Sheets ou Notion), y saisir la baseline : 27 users, 4/30j, 3 orgs
- **Métriques** : aucune (jour 0)
- **À valider par toi** : le schéma de la table d'attribution, avant migration
- **Résultat attendu** : chaque visite est désormais attribuable

#### **J2 — Vendredi 15/08 — Colmater les fuites**
- **Actions**
  1. **[CODE-P0-3]** Pont démo → compte · **3-4 h**
  2. **[CODE-P0-2]** Page de conversion `/invite/:token` · **3-4 h**
  3. **[MANUEL]** Écrire les 4 emails de la séquence d'activation (J0/J1/J3/J7) · 1 h
  4. **[AUTO]** Brancher Brevo + webhook Supabase `auth.users` (A3) · 45 min
- **À valider** : le texte des 4 emails avant activation
- **Résultat attendu** : conversion visite→inscription attendue de 5 % → 7-8 %

#### **J3 — Samedi 16/08 — Assets & munitions**
- **Actions**
  1. **[MANUEL/REVIEW]** Kit d'assets : 8 screenshots (4 FR / 4 EN), logo 240×240, GIF 15 s, one-liner FR + EN, description 60/160/400 caractères · 2 h
  2. **[AUTO+REVIEW]** Générer 30 hooks vidéo via A8, en garder 24 · 1 h
  3. **[MANUEL]** Écrire les 6 scripts des vidéos de la semaine 1 · 1 h
  4. **[MANUEL]** Lister **40 personnes de ton réseau réel** ayant une équipe (canal 4 du §5.2) · 45 min
- **Résultat attendu** : 30 jours de munitions prêtes

#### **J4 — Dimanche 17/08 — Tournage batch + premier envoi réseau**
- **Actions**
  1. **[MANUEL]** Tourner 6 vidéos (batch) · 2 h · puis **[AUTO A9]** rendu hyperframes
  2. **[MANUEL]** Envoyer les **40 messages au réseau personnel** — un par un, personnalisés, **jamais en copie** · 1 h 30
     > Modèle : « Salut X, j'ai passé 8 mois à coder Cosmo, une app d'orga perso et d'équipe. Je cherche 5 équipes pour la tester avant de la sortir vraiment. Tu connais quelqu'un — ou toi ? 2 min pour regarder : [lien démo]. »
  3. **[MANUEL]** Créer les 3 comptes sociaux (TikTok / IG / YouTube) avec bio + lien tracké `?ref=tiktok` etc.
- **Métriques** : réponses réseau (attendu 15-25 sur 40 en 72 h)
- **Résultat attendu** : **2-5 conversations Entreprise amorcées** — ce sont tes meilleures

#### **J5 — Lundi 18/08 — Ouverture des vannes**
- Rituels R1-R9
- **Actions**
  1. **[AUTO/REVIEW]** Première vidéo publiée ×3 plateformes
  2. **[MANUEL]** Premier post LinkedIn « build in public » : *« 8 mois, 90 000 lignes, 27 utilisateurs. Je raconte tout pendant 30 jours. »* — le format « transparence radicale » est le seul qui performe sans audience
  3. **[MANUEL]** Soumettre les **8 premiers annuaires** : BetaList, SaaSHub, AlternativeTo, Uneed, Peerlist, Startupbase, LaunchingNext, Indie Hackers · 1 h 30
  4. **[CODE-P1-4]** Démarrer le moteur de sourcing (partie CNJE) · 2 h
- **Résultat attendu** : 3-8 inscriptions

#### **J6 — Mardi 19/08**
- Rituels
- **Actions**
  1. **[CODE-P1-4]** Finir sourcing + scoring + génération · 3 h → **premier lot de 40 leads JE/assos**
  2. **[MANUEL]** Configurer le domaine d'envoi secondaire + SPF/DKIM/DMARC + **démarrer le warm-up à 10 mails/j** · 1 h
  3. **[MANUEL]** Rejoindre 8 communautés (Discord étudiants, Slack freelances FR, groupes FB) — **participer sans rien promouvoir**
  4. **[MANUEL]** 8 annuaires suivants
- **Résultat attendu** : machine outbound prête, 40 leads en file

#### **J7 — Mercredi 20/08 — Premier envoi outbound + revue**
- Rituels
- **Actions**
  1. **[REVIEW]** Valider les 40 premières accroches **une par une** (semaine 1 = revue à 100 %) · 45 min
  2. **[AUTO A4]** Envoyer les 10 premiers (warm-up) · auto
  3. **[MANUEL]** Premier post Reddit — **r/SideProject en EN**, format « j'ai codé ça en 8 mois, 27 users, roastez-moi » (le format le plus toléré par les modérateurs)
  4. **[MANUEL] REVUE S1** : remplir le tableau, vérifier les seuils du §11
- **Résultat attendu semaine 1** : **25-45 Free · 1-2 orgs · 0 € dépensé · ~35 h**

---

### SEMAINE 2 — Volume et premiers signaux (J8-J14)
**Objectif : +50-90 Free (cumul 75-135) · +2-3 orgs (cumul 3-5)**

#### **J8 — Jeudi 21/08**
- Rituels · **[AUTO]** 20 emails · **[MANUEL]** Tournage batch 6 vidéos (2 h)
- **[MANUEL]** Post LinkedIn #2 : « Les 3 erreurs de mon onboarding, chiffres à l'appui »
- **[MANUEL]** 6 annuaires (cumul 22)

#### **J9 — Vendredi 22/08**
- Rituels · **[AUTO]** 30 emails
- **[CODE-P1-7]** Dashboard growth quotidien · 4 h
- **[MANUEL]** Post Reddit FR #1 — r/productivite ou r/EnFrancaisSVP, angle « comment je me suis organisé » (valeur d'abord, lien en commentaire)

#### **J10 — Samedi 23/08 — ⚠️ Premier point de décision vidéo**
- **[REVIEW] Contrôle du seuil V1** : si aucune des 6 premières vidéos ne dépasse **5 000 vues** → **changer d'angle** (pas de volume aveugle). Alternatives dans l'ordre : (1) face caméra + histoire perso, (2) « J'ai comparé Notion/Todoist/Cosmo » comparatif, (3) « je code en direct la feature que vous demandez »
- **[MANUEL]** Tournage batch 6 vidéos selon l'angle retenu · 2 h
- **[MANUEL]** Contacter 6 créateurs FR productivité/étudiants (5-50k abonnés) — proposer un accès, pas un partenariat rémunéré

#### **J11 — Dimanche 24/08**
- **[MANUEL]** Programmer tous les posts de la semaine (A6) · 45 min
- **[CODE-P1-5]** Referral in-app · 4 h
- **[MANUEL]** Préparer le Product Hunt : page, galerie, first comment, teaser · 2 h

#### **J12 — Lundi 25/08**
- Rituels · **[AUTO]** 40 emails/j (régime de croisière)
- **[MANUEL]** Post LinkedIn #4 orienté **persona C** : « Pourquoi Monday coûte 900 €/an à une équipe de 8 qui n'en utilise que 10 % »
- **[MANUEL]** **Premières démos Entreprise** (2-3 attendues cette semaine) · 35 min chacune
  > Règle absolue : **2 invitations envoyées PENDANT l'appel**

#### **J13 — Mardi 26/08**
- Rituels · **[MANUEL]** Tournage batch · **[MANUEL]** 6 annuaires (cumul 28 — terminé)
- **[MANUEL]** Pitcher 6 newsletters FR (productivité, tech, étudiantes, no-code)

#### **J14 — Mercredi 27/08 — REVUE S2**
- **[REVIEW]** Contrôles de seuils :
  - Cold email < 4 % de réponse sur 150 envois → **changer l'ICP ou l'accroche**
  - Inscription/visite < 3 % sur 500 visites → **stopper 1 jour d'acquisition et corriger la landing**
  - Activation 48 h < 20 % → **stopper l'acquisition, corriger l'onboarding** (voir §11)
- **[MANUEL]** Solliciter **3 témoignages** auprès des utilisateurs les plus actifs
- **Résultat attendu cumul** : **75-135 Free · 3-5 orgs**

---

### SEMAINE 3 — Amplification + préparation PH (J15-J21)
**Objectif : +60-110 Free (cumul 135-245) · +2-3 orgs (cumul 5-8)**

#### **J15 — Jeudi 28/08**
- Rituels · **[CODE-P1-6]** Bilan hebdo partageable · 4 h (uniquement si ≥ 120 users, sinon reporter)
- **[MANUEL]** Post LinkedIn : « 2 semaines, X utilisateurs, voici les chiffres bruts » (les posts à chiffres réels sont ceux qui percent)

#### **J16 — Vendredi 29/08**
- Rituels · **[MANUEL]** Reddit EN : r/productivity (angle « I built the app I couldn't find »)
- **[MANUEL]** Relancer les 40 du réseau qui n'ont pas répondu (relance unique, courte)

#### **J17 — Samedi 30/08** · Tournage batch 6 vidéos · **[MANUEL]** DM à 10 responsables de BDE via Instagram (canal totalement sous-exploité pour le persona D)

#### **J18 — Dimanche 31/08**
- **[MANUEL]** **Répétition du Product Hunt** : page finalisée, 40 personnes à prévenir listées, first comment écrit, GIF prêt, version EN de la landing relue mot à mot
- **[MANUEL]** Programmer la semaine

#### **J19 — Lundi 01/09 — Rentrée : la meilleure fenêtre des 30 jours**
> **Le 1er septembre est le pic annuel d'intention sur « s'organiser ».** Concentre ici le meilleur contenu.
- **[MANUEL]** Post LinkedIn + vidéo + Reddit sur l'angle **rentrée** : « La rentrée, c'est dans 6 jours. Voilà comment je m'organise. »
- **[AUTO]** Relancer les 180 contacts assos/JE — **la rentrée est LEUR moment de recrutement et de réorganisation**
- **Résultat attendu** : meilleur jour du mois, 15-40 inscriptions

#### **J20 — Mardi 02/09** · Rituels · 3-4 démos Entreprise · post LinkedIn persona D « Comment une Junior-Entreprise de 18 personnes s'organise sans budget »

#### **J21 — Mercredi 03/09 — REVUE S3 + gel du produit**
- **[REVIEW]** Réallocation : **doubler le budget-temps du canal n°1, couper le canal le plus faible** (voir §12)
- **[MANUEL]** **Gel du code** jusqu'à J24 — aucun déploiement risqué avant le Product Hunt
- **Cumul attendu** : **135-245 Free · 5-8 orgs**

---

### SEMAINE 4 — Product Hunt + conversion (J22-J30)
**Objectif : +85-155 Free (cumul 220-350) · +2-4 orgs (cumul 7-12)**

#### **J22 — Jeudi 04/09 — Veille de lancement**
- **[MANUEL]** Prévenir les 40 personnes de la liste PH (**message perso, jamais « upvote-moi »** — c'est contraire aux règles PH ; dis « je lance demain, voilà le lien »)
- **[MANUEL]** Vérifier prod : perf, mobile, EN, mode démo, formulaire d'inscription. **Teste l'inscription toi-même sur mobile en 4G.**
- Coucher tôt : J23 démarre à 06:00

#### **J23 — Vendredi 05/09 — PRODUCT HUNT (journée bloquée, 8-10 h)**
- 06:00 **[MANUEL]** Publication (PH bascule à 00:01 PT = 09:01 Paris ; publier tôt maximise l'exposition sur la journée)
- 06:15 **[MANUEL]** First comment : l'histoire, les chiffres réels, ce qui ne marche pas encore (l'honnêteté performe sur PH)
- 07:00-22:00 **[MANUEL]** Répondre à **100 %** des commentaires en < 30 min · relayer sur LinkedIn/X/Reddit/communautés
- **[AUTO]** Surveiller le digest en temps réel (A2)
- **Attendu** : 400-1 200 visites, **25-90 inscriptions**, rang #8-20

#### **J24 — Samedi 06/09** · **[MANUEL]** Post-mortem PH publié en public (le contenu « voilà ce que mon lancement PH a vraiment donné » performe souvent mieux que le lancement lui-même) · relancer les commentateurs PH intéressés

#### **J25 — Dimanche 07/09** · Tournage batch final · programmation

#### **J26-J28 — Lundi 08 → Mercredi 10/09 — Conversion pure**
> **Change de mode : arrête d'ouvrir de nouveaux canaux.** Les 5 derniers jours servent à convertir ce qui est déjà entamé.
- **[MANUEL]** Relancer **toutes** les conversations Entreprise en cours (attendu 15-25 dans le CRM)
- **[MANUEL]** Appeler tous les propriétaires d'orgs restées **< 3 membres** — c'est là que sont tes dernières unités
- **[AUTO A12]** Relance auto des orgs à 1 membre
- **[MANUEL]** Séquence de réactivation vers **tous** les inscrits inactifs depuis 7 j

#### **J29 — Jeudi 11/09** · Dernières démos · derniers closings · **[MANUEL]** Post LinkedIn « bilan des 30 jours » avec les vrais chiffres (**c'est le post qui recrutera le mois suivant**)

#### **J30 — Vendredi 12/09 — Bilan**
- **[AUTO A11 + REVIEW]** Rapport final : par canal, inscriptions, CAC en temps, activation D7, orgs ≥ 3 membres
- **[MANUEL]** Décider les 3 canaux à garder pour les 30 jours suivants et **abandonner tous les autres**

---

## 11. DASHBOARD DE PILOTAGE

### 11.1 À relever chaque jour (10 min, R1)

| Métrique | Source | Cible/jour (scénario réaliste) |
|---|---|---|
| Visiteurs uniques | Analytics | 60-120 |
| Sessions démo | `demo_devices` | 15-30 |
| **Inscriptions Free** | `auth.users` | **8-12** |
| Inscriptions **par source** | `profiles.acquisition_source` | ventilation |
| Activation 48 h | requête AHA | ≥ 35 % |
| Rétention D7 | `user_activity_days` | ≥ 25 % |
| Emails envoyés / réponses | Instantly | 40 / 3-4 |
| Connexions LinkedIn / acceptées | manuel | 20 / 6 |
| MQL Entreprise | CRM | 0-2 |
| SQL Entreprise | CRM | 0-1 |
| Démos réalisées | CRM | 0-1 |
| **Orgs ≥ 3 membres (cumul)** | SQL | **+0,3/j** |
| Contenus publiés | manuel | 1 vidéo + 1 LinkedIn + 2 X |
| Vues cumulées vidéo | plateformes | 800-2 500 |
| Temps passé | chrono | ≤ 5 h |
| **CAC en temps** | calcul | ≤ 0,5 h/user |

### 11.2 Seuils d'alerte — règles de décision automatiques

| # | Condition | Décision **obligatoire** |
|---|---|---|
| S1 | **Activation 48 h < 20 %** sur 50 inscrits | 🛑 **STOP acquisition 1 journée entière.** Corrige l'onboarding. Acquérir plus est du gaspillage pur. |
| S2 | Inscription/visite **< 3 %** sur 500 visites | 🛑 Stop 1 jour → refonte du CTA et du above-the-fold |
| S3 | Après **8 vidéos**, aucune > 5 000 vues | 🔄 Changer d'angle (pas de volume). Si après 8 de plus toujours rien → **couper à 1 vidéo/j** et réallouer sur l'outreach |
| S4 | Cold email < **4 %** de réponse sur 150 envois | 🔄 Changer l'ICP **ou** l'accroche (une variable à la fois). < 2 % sur 300 → **couper le canal** |
| S5 | Cold email bounce > **5 %** | 🛑 **Stop immédiat** — la délivrabilité se dégrade, vérifier les MX |
| S6 | LinkedIn : < 20 % d'acceptation sur 100 demandes | 🔄 Le ciblage est faux — resserrer l'ICP |
| S7 | Un canal < **5 inscriptions après 10 h** investies | ❌ Couper, réallouer sur le canal n°1 |
| S8 | Un canal > **40 inscriptions en 10 h** | ✅ **Doubler le temps** dès le lendemain |
| S9 | Un post/thread supprimé par des modérateurs 2× sur la même plateforme | ❌ Arrêter d'y poster 14 jours |
| S10 | **Orgs ≥ 3 membres < 3 à J15** | 🔄 Bascule : 2 h/j de vidéo → outbound Entreprise |
| S11 | Rétention D7 < 15 % | ⚠️ **Signal produit majeur.** Le mois suivant doit être un mois produit, pas un mois growth |
| S12 | Temps quotidien > 7 h sur 3 jours d'affilée | 🛑 Couper le canal le plus coûteux — le plan doit tenir 30 jours |

---

## 12. SYSTÈME D'EXPÉRIMENTATION

**Boucle : hypothèse → expérience → seuil minimum → décision (stop / double / modifie) → réallocation.** Décision prise **le mercredi**, appliquée le jeudi.

### Semaine 1
| Hypothèse | Expérience | Métrique | Seuil min | Décision |
|---|---|---|---|---|
| H1.1 : le réseau perso convertit mieux que tout | 40 messages | réponses | ≥ 12 | < 12 → l'ICP Entreprise est mal défini, revoir avant d'envoyer 600 emails |
| H1.2 : l'angle « dev solo, 27 users » attire | 3 posts transparence | vues + inscriptions | ≥ 1 500 vues cumulées | < 1 500 → passer à l'angle produit/comparatif |
| H1.3 : les annuaires sont un plancher fiable | 22 soumissions | visites à J14 | ≥ 150 | < 150 → couper, ne pas soumettre les 6 derniers |

### Semaine 2
| Hypothèse | Expérience | Métrique | Seuil min | Décision |
|---|---|---|---|---|
| H2.1 : l'ICP « asso/JE » répond mieux que « PME » | 2 lots de 75 emails | taux de réponse | écart ≥ 4 pts | Mettre **80 % du volume** sur le gagnant |
| H2.2 : la vidéo peut décoller sans audience | 12 vidéos, 3 angles | vues médianes | ≥ 800 | < 800 → passer de 1 vidéo/j à 3/semaine |
| H2.3 : la démo sans compte cannibalise | comparer sessions démo vs inscriptions | ratio | démo/inscription < 4:1 | > 4:1 → durcir le pont démo→compte |

### Semaine 3
| Hypothèse | Expérience | Métrique | Seuil min | Décision |
|---|---|---|---|---|
| H3.1 : la rentrée crée un pic | contenu rentrée J19 | inscriptions J19-J21 | ≥ 2× la moyenne | Si oui → tout le contenu de S4 sur cet angle |
| H3.2 : LinkedIn produit des orgs, pas des Free | attribution | orgs issues de LI | ≥ 2 | < 2 → réallouer LinkedIn vers le cold email |
| H3.3 : le referral fonctionne | activer CODE-P1-5 | filleuls activés | ≥ 8 % des inscriptions | < 8 % → ne pas y investir davantage |

### Semaine 4
| Hypothèse | Expérience | Métrique | Seuil min | Décision |
|---|---|---|---|---|
| H4.1 : PH vaut ses 14 h | lancement | inscriptions à 48 h | ≥ 30 | < 30 → ne jamais relancer un produit sur PH sans audience préalable |
| H4.2 : relancer convertit mieux qu'acquérir | J26-J28 en conversion pure | orgs closes | ≥ 2 | Établit la règle pour le mois suivant |

---

## 13. JOURNÉE TYPE

### Jour ouvré — **5 h 00** (dont 2 h 30 de rituels)
| Horaire | Bloc | Catégorie |
|---|---|---|
| 08:30-08:45 | Digest KPI, saisie du tableau de bord (R1) | REVIEW |
| 08:45-09:15 | Réponses entrantes — SLA 2 h (R2) | MANUEL |
| 09:15-09:45 | LinkedIn : 20 connexions + 10 suivis (R3) | MANUEL |
| 09:45-11:15 | **Bloc profond** : dev CODE du jour, ou démo Entreprise, ou tournage | MANUEL/CODE |
| 11:15-12:00 | Communautés : Reddit/Discord, contribution utile (R6) | MANUEL |
| 12:00-12:15 | Publication vidéo #1 (R5) | AUTO |
| — pause — | | |
| 14:00-15:00 | **Bloc du jour** (annuaires / outreach / partenariats / contenu — voir §10) | variable |
| 15:00-15:30 | Réponses aux commentaires (R6) | MANUEL |
| 17:00-17:30 | 2ᵉ passe de réponses entrantes (R2) | MANUEL |
| 18:00-18:20 | Validation du lot d'emails du lendemain (R7) | REVIEW |
| 18:20-18:35 | Publication vidéo #2 + emails perso aux nouveaux inscrits (R5, R8) | AUTO/MANUEL |
| 18:35-18:50 | Mise à jour CRM (R9) | MANUEL |

### Week-end — **3 h 00** (samedi tournage batch 2 h + dimanche programmation/prépa 1 h)

### Charge totale
```
22 jours ouvrés × 5 h        = 110 h
 8 jours de week-end × 3 h   =  24 h
Journée Product Hunt (+5 h)  =   5 h
──────────────────────────────────────
TOTAL                        ≈ 139 h sur 30 jours (≈ 4 h 40/jour en moyenne)
```
> **Si tu ne peux pas tenir ~4 h 40/jour**, dis-le maintenant : à 2 h/jour, l'attendu réaliste tombe à **100-160 Free et 3-6 orgs**, et il faut supprimer la vidéo (34 h) qui est le poste le plus lourd et le plus incertain.

---

## 14. PRIORISATION — Impact × Effort × Vitesse

| Action | Impact | Effort | Vitesse | Score |
|---|---|---|---|---|
| Attribution `?ref=` | 🟢 Élevé | 🟢 Faible | 🟢 Immédiat | **9,5** |
| 40 messages au réseau perso | 🟢 Élevé | 🟢 Faible | 🟢 3 j | **9,4** |
| Pont démo → compte | 🟢 Élevé | 🟢 Faible | 🟢 Immédiat | **9,2** |
| Outreach assos/JE/BDE | 🟢 Élevé | 🟡 Moyen | 🟢 7-15 j | **8,8** |
| Page `/invite/:token` | 🟡 Moyen | 🟢 Faible | 🟢 Immédiat | **8,3** |
| 28 annuaires | 🟡 Moyen | 🟢 Faible | 🟡 14 j | **8,0** |
| Séquence d'activation email | 🟡 Moyen | 🟢 Faible | 🟡 7 j | **7,8** |
| Product Hunt | 🟡 Moyen | 🔴 Élevé | 🟢 1 j | **7,0** |
| Vidéo courte (24) | 🟢 Élevé* | 🔴 Élevé | 🔴 Lent/aléatoire | **6,5** |
| Posts LinkedIn | 🟡 Moyen | 🟡 Moyen | 🟡 15 j | **6,4** |
| Cold email PME | 🟡 Moyen | 🟡 Moyen | 🔴 Lent | **5,5** |
| Referral in-app | 🟡 Moyen | 🟡 Moyen | 🔴 30 j+ | **5,0** |
| X / Twitter | 🔴 Faible | 🟢 Faible | 🔴 Lent | **3,2** |
| SEO (nouveau contenu) | 🟢 Élevé | 🔴 Élevé | 🔴 3-12 mois | **2,5** (hors fenêtre) |

\* impact élevé **en espérance**, avec une variance qui rend le résultat individuel imprévisible.

### ⚡ Les 5 à faire immédiatement (J1-J4)
1. **Attribution `?ref=`/UTM** — sans elle, 30 jours en aveugle
2. **Les 40 messages au réseau personnel** — meilleur taux de réponse disponible, tes 3 premières orgs
3. **Pont démo → compte** — le plus gros trou du seau
4. **Analytics + CRM + tableau de bord** — 1 h qui rend tout le reste mesurable
5. **28 annuaires** — le plancher déterministe, et des backlinks pour le SEO

### 🤖 Les 5 à automatiser immédiatement
1. Digest KPI quotidien (A1)
2. Séquence d'activation email J0/J1/J3/J7 (A3)
3. Séquence cold email 3 touches (A4)
4. Triage LLM des réponses + notification (A5)
5. Programmation des posts sociaux (A6)

### 💻 Les 5 à coder
1. **P0-1** Attribution de source (4-6 h)
2. **P0-3** Pont démo → compte (3-4 h)
3. **P0-2** Page de conversion `/invite/:token` (3-4 h)
4. **P1-4** Sourcing + scoring ICP + génération d'accroches (8-10 h)
5. **P1-7** Dashboard growth quotidien (4-5 h)

### 🚫 Les 5 à NE SURTOUT PAS faire pendant ces 30 jours
1. **Écrire de nouveaux articles SEO** — 0 résultat dans la fenêtre. Le SEO se prépare, il ne se récolte pas en 30 jours. (Exception : les backlinks d'annuaires, qui sont déjà dans le plan.)
2. **Finaliser Stripe / activer le premium** — mettre un prix maintenant, c'est diviser l'acquisition. Le gratuit *est* la stratégie d'acquisition de ce mois.
3. **Refondre le produit / ajouter des fonctionnalités** — sauf les 3 devs de conversion. Chaque feature est du temps volé à la distribution, et Cosmo n'a pas de problème de fonctionnalités : il a un problème de personnes.
4. **Cibler les PME > 20 personnes** — cycle 3-4 mois, elles ne closeront pas, et elles demanderont un Gantt que Cosmo n'a pas.
5. **Construire un bot LinkedIn / scraper LinkedIn** — ban de compte, et le compte est ton principal actif sur le funnel Entreprise.

---

## 15. TROIS SCÉNARIOS

### 🔴 Pessimiste (~25 % de probabilité)
| | |
|---|---|
| **Free** | **90 – 150** |
| **Orgs ≥ 3 membres** | **3 – 5** |
| MQL / démos | 20 / 6 |
| Volume d'actions | 500 emails, 15 vidéos, 12 posts LI, 20 annuaires |
| Hypothèses | Aucune vidéo > 3 000 vues · PH #25+ (< 300 visites) · cold email à 4 % · 2 posts Reddit supprimés · exécution à 50 % (imprévus, bug prod) |
| Signal | Rétention D7 < 15 % → **le mois suivant doit être produit, pas growth** |

### 🟡 Réaliste (~50 %) — **le scénario que je considère le plus probable**
| | |
|---|---|
| **Free** | **220 – 350** |
| **Orgs ≥ 3 membres** | **6 – 12** |
| MQL / démos / closings | 45 / 14 / 9 |
| Volume d'actions | 590 emails, 24 vidéos, 20 posts LI, 60 posts X, 12 Reddit, 28 annuaires, 600 connexions LI |
| Hypothèses | 2-3 vidéos entre 8k et 40k vues, aucune virale · PH #8-20 → 45 inscriptions · cold email 9 % · 3 orgs du réseau perso · exécution à 65 % · pic de rentrée confirmé |
| Verdict | **22-35 % de l'objectif Free · 60-120 % de l'objectif Entreprise** |

### 🟢 Optimiste (~25 %, dont ~10 % pour le vrai scénario à 1 000)
| | |
|---|---|
| **Free** | **600 – 950** |
| **Orgs ≥ 3 membres** | **13 – 20** |
| MQL / démos / closings | 80 / 25 / 16 |
| Hypothèses | **1 vidéo à 200-500k vues** (le facteur décisif) · PH top-5 + reprise par 2 newsletters · 2 créateurs FR relaient · 3 grosses assos amènent 25+ membres chacune · exécution à 85 % |
| Note | Même ici, **1 000 n'est pas garanti** : il faut la vidéo virale **et** un PH réussi **et** l'effet assos. Trois succès simultanés. |

---

## 16. RÉPONSE HONNÊTE À LA QUESTION FINALE

> **« 1 000 Free + 10 Entreprise en 30 jours, en organique pur, sans pub — est-ce réellement atteignable ? »**

### Mon estimation
**Non pour les 1 000 Free. Oui, probablement, pour les 10 Entreprise.**

- **1 000 Free : ~10 % de probabilité.** Il faut passer de ~3 visites/jour à ~667/jour. Aucune combinaison de canaux organiques *exécutables* ne produit ça en 30 jours à partir de zéro audience. La seule voie est un événement à queue de distribution — une vidéo qui perce — qu'on peut rendre plus probable (24 tentatives, itération sur les hooks) mais jamais planifier. Attendu central : **220-350**.
- **10 Entreprise : ~55 % de probabilité.** Et pour une raison contre-intuitive : **il n'y a rien à vendre.** Gratuit sous 5 sièges, Stripe non branché, création d'org self-serve. Le seul obstacle est la conviction et l'invitation des membres — ce qui se règle en 18 démos bien menées. Attendu central : **6-12**.

### Les hypothèses critiques (celles qui feraient basculer le verdict)
1. **~4 h 40/jour disponibles, 30 jours d'affilée.** À 2 h/jour, tout est divisé par ~2,2.
2. **H1 — zéro audience.** Si tu as en réalité une audience (2 000+ relations LinkedIn qualifiées, une communauté existante), le plancher monte de 100-200 inscriptions et le verdict Free devient « difficile mais possible ».
3. **La conversion visite→inscription à 5 %.** Elle n'a **jamais été mesurée** sur Cosmo. Si elle est à 2 %, il faut 50 000 visites — le plan devient impossible. C'est pourquoi J1-J2 sont non négociables.
4. **La rétention.** 0 actif sur 7 jours. Si la rétention D7 est réellement < 15 %, alors même 1 000 inscriptions ne produiraient ~150 utilisateurs réels, et l'objectif lui-même serait mal posé.

### Les principaux risques
| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| La vidéo ne décolle jamais | **Élevée (60 %)** | −40 % du plafond Free | Seuil S3 : changer d'angle à J10, couper à J20 |
| Bannissements Reddit/Discord | Moyenne | −40 inscriptions | Ratio contribution/promo 5:1, jamais le même lien 2× |
| Épuisement à J18-J22 | **Élevée** | −30 % global | Seuil S12, week-ends allégés, batch |
| Délivrabilité email effondrée | Moyenne | −6 orgs | Warm-up, domaine secondaire, bounce < 3 % |
| Orgs créées mais jamais peuplées | **Élevée** | −50 % Entreprise | **2 invitations pendant l'appel**, règle absolue |
| Bug prod pendant le PH | Faible | −60 % du PH | Gel du code J21-J24 |
| Rétention réellement nulle | Moyenne | rend le mois inutile | S1/S11 : arrêter et corriger |

### Ce qui peut faire exploser les résultats
1. **Une seule vidéo à 300k+ vues** → +200 à +400 inscriptions à elle seule. C'est le seul chemin réaliste vers 1 000.
2. **Une grosse asso ou école qui adopte** (BDE d'une fac de 2 000 étudiants, réseau de JE) → 50-200 inscriptions **et** 1-3 unités Entreprise d'un coup. C'est le levier le plus sous-estimé du plan, et le seul qui coche les deux objectifs.
3. **Un créateur FR productivité (30-100k) qui parle du produit** → 100-500 visites très qualifiées.
4. **PH top-5** → reprises par des newsletters, ×3 sur le trafic.
5. **La rentrée du 1er septembre** — pic annuel d'intention sur « s'organiser », tombe pile au J19.

### Ce qui peut faire échouer le plan
1. **Acquérir sans avoir instrumenté** — 30 jours d'effort dont on ne saura rien. C'est le risque n°1 et il est entièrement évitable.
2. **Étaler l'effort sur 12 canaux sans jamais couper** — 12 canaux médiocres valent moins que 3 canaux doublés. Les seuils du §11 existent pour ça.
3. **Coder au lieu de distribuer** — Cosmo n'a pas un problème de fonctionnalités, il a un problème de personnes qui savent qu'il existe. Après J3, la seule ligne de code autorisée est une ligne de conversion.
4. **Terminer une démo sans invitation envoyée.**
5. **Poursuivre les 1 000 au détriment des 10.** Les 1 000 Free gratuits ne prouvent rien sur la viabilité de Cosmo. 10 équipes réelles qui l'utilisent chaque semaine, oui.

### Les 5 leviers que je prioriserais personnellement
1. **Les 40 messages au réseau personnel, dès J4.** Meilleur taux de réponse disponible, cycle le plus court, source la plus probable de tes 3 premières orgs. Coût : 1 h 30.
2. **Les assos / JE / BDE, avec la rentrée comme prétexte.** Seul levier à double rendement (Free ET Entreprise), cible non sollicitée, sans budget, très réactive, et le 1er septembre est *leur* moment.
3. **Les 3 devs de conversion (P0-1, P0-2, P0-3), avant toute publication.** 12 h de dev qui augmentent le rendement de chacun des 27 jours restants.
4. **La vidéo courte, mais avec un seuil de sortie assumé.** 24 tentatives parce que c'est le seul chemin vers 1 000 — et une décision ferme à J10 et J20 pour ne pas y laisser 34 h en pure perte.
5. **Les 28 annuaires.** Peu glorieux, ~8 h, mais c'est le seul canal *certain* du plan, et il construit l'autorité SEO qui rendra le mois 3 possible.

### Ce que je changerais dans l'objectif lui-même
Si je pouvais reformuler la cible des 30 jours, ce serait :
> **« 250 utilisateurs Free dont 40 % activés à 48 h et 25 % encore actifs à J7, + 10 organisations de ≥ 3 membres, + une attribution fiable par canal permettant de désigner les 3 canaux du mois suivant. »**

Cette cible-là est atteignable à ~65 %, elle est mesurable, et elle laisse un actif exploitable au 1er octobre. « 1 000 inscriptions » n'en laisse aucun s'il n'y a ni attribution, ni rétention, ni équipes réelles derrière.

---

## 17. OUTILS, MCP ET SKILLS RECOMMANDÉS

### Outils externes
| Besoin | Outil | Coût | Pourquoi |
|---|---|---|---|
| Analytics web | **Vercel Analytics** (déjà hébergé) ou Plausible | 0 € / 9 € | 1 clic, RGPD-friendly, pas de bandeau cookie |
| CRM | **Notion** ou Airtable | 0 € | 15 min de setup, suffisant pour 1 000 leads |
| Automatisation | **n8n self-host** (ou Make gratuit) | 0 € | 12 automatisations du §7, appels SQL/HTTP natifs |
| Cold email | **Instantly** ou lemlist | 30-50 € | Warm-up intégré — c'est *le* poste où l'outil paye |
| Emails produit | **Brevo** | 0 € < 300/j | Français, RGPD, webhook Supabase |
| Programmation sociale | **Metricool** ou Buffer | 0 € | Multi-plateformes |
| Données d'entreprise FR | **Pappers API** + **data.gouv (RNA)** + annuaire CNJE | 0-20 € | Sources publiques, légales, françaises |
| Vidéo | **hyperframes** (`cosmo-marketing`) | 0 € | ✅ déjà opérationnel |
| Visio démo | Google Meet | 0 € | Aucun frottement pour l'invité |

### Skills et MCP disponibles ici
- ✅ **`marketing:draft-content`, `marketing:email-sequence`, `marketing:campaign-plan`, `marketing:competitive-brief`** — utilisables tout de suite pour les premiers jets (posts, séquences, battlecards).
- ✅ **`design`** — assets Product Hunt, visuels d'annuaires, bannières.
- ✅ **MCP Supabase** — lecture des KPI (c'est ainsi que la baseline de ce document a été établie).
- ⚠️ **MCP non authentifiés dans cette session** : `ahrefs`, `similarweb`, `hubspot`, `notion`, `slack`, `klaviyo`, `amplitude`, `canva`, `figma`, `supermetrics`. Ils sont installés mais **inutilisables tant que tu ne les autorises pas** — pour les connecteurs claude.ai via les réglages de connecteurs, pour les autres via `claude mcp` ou `/mcp` **dans une session interactive**. Je ne peux pas lancer le flux OAuth ici.
  → Les plus utiles pour ce plan : **Notion** (CRM piloté par agent) et **Slack** (destination des digests).

### À développer côté agent
Un dossier `scripts/growth/` (cf. CODE-P1-4) et une commande `npm run growth -- daily` qui, en une exécution : source 40 leads, les score, génère les accroches, exporte le CSV, et écrit le digest KPI. **C'est le seul développement custom qui vaut vraiment ses 10 h sur ce mois.**

---

## 18. RÉCAPITULATIF EXÉCUTABLE

**Aujourd'hui (avant J1)** : valide les 8 hypothèses du §1.2 et confirme ta disponibilité horaire réelle. Tout le reste en dépend.

**J1-J3** : ne publie rien. Instrumente (attribution, analytics, CRM, tableau de bord) et colmate les 3 fuites. 12 h de dev qui rendent les 27 jours suivants rentables.

**J4** : envoie les 40 messages au réseau personnel. C'est l'action au meilleur rendement des 30 jours.

**J5-J21** : régime de croisière — 40 emails/jour, 20 connexions LinkedIn, 1 vidéo, 1 post, communautés. Coupe sans état d'âme selon les seuils du §11.

**J19** : concentre le meilleur contenu sur la rentrée.

**J23** : Product Hunt, journée entière bloquée.

**J26-J30** : arrête d'acquérir, convertis. Appelle chaque org restée sous 3 membres.

**J30** : garde 3 canaux, abandonne les autres, et recommence avec l'attribution qui, elle, ne mentira pas.
