# Export des data démo — état 2026-08-21

Généré pour revue avant réécriture. Source = seeds FR (`src/modules/*/local.repository.ts`
et `src/modules/{events,okrs}/repository.ts`). Chaque item a un overlay EN à mettre à jour en
parallèle si on change le FR.

Constat : le persona actuel est **quasi 100% "salarié tech en entreprise"** (sprint review,
Coursera ML, Lighthouse score, NPS, DevFest...). Aucune trace de freelance (facturation, clients
multiples, TJM), d'étudiant (cours, examens, stage), ou de particulier hors contexte tech.

---

## Catégories (`src/modules/categories/repository.ts`)

| id | FR | EN |
|---|---|---|
| cat-1 | Travail | Work |
| cat-2 | Personnel | Personal |
| cat-3 | Santé | Health |
| cat-4 | Apprentissage | Learning |
| cat-5 | Projets | Projects |

---

## Tâches — `src/modules/tasks/local.repository.ts` (13 tâches)

| id | Catégorie | Nom FR | Description FR |
|---|---|---|---|
| t001 | Travail | Bilan annuel 2025 | Revue complète + plan 2026 |
| t002 | Travail | Préparer présentation Q1 2026 | Résultats 3 mois + projections |
| t013 | Travail | Envoyer facture client Dupont | Facture en retard, relance client |
| t003 | Projets | Audit sécurité Q1 2026 | Pentest + correctifs CVE |
| t004 | Projets | Mettre à jour dépendances npm | Màj majeure + breaking changes |
| t005 | Apprentissage | Lire "Accelerate" | Forsgren, DevOps metrics DORA |
| t006 | Apprentissage | Cours deep learning Coursera | Réseaux neuronaux + CNN + RNN |
| t007 | Personnel | Préparer dossier crédit immo | Documents + simulation + banques |
| t008 | Personnel | Chercher nouvel appartement | Critères + visites + budget max |
| t009 | Santé | Rendez-vous médecin annuel 2026 | Check-up + vaccins + renouvellements |
| t010 | Santé | Programme stretching quotidien | Mobilité + récupération post-sport |
| t011 | Projets (assignée, collab) | Réviser le pitch deck | Intégrer les retours avant lundi — sharedBy Marie Dupont |
| t012 | Projets (assignée, collab) | Tester le prototype mobile | Flow onboarding + feedback UX — sharedBy Jean Martin |
| shared-001 | Travail (partagée) | Réviser le rapport mensuel | Vérifier les chiffres et commenter — sharedBy Marie Dupont |
| shared-002 | Projets (partagée) | Préparer la réunion de lancement | Agenda + présentation + invitations — sharedBy Jean Martin |

**Biais** : que du "salarié" (facture client, audit sécu, npm, deep learning, crédit immo).
Rien pour un freelance (multi-clients, devis), un étudiant (cours/examens), ou un particulier
générique (famille, admin, loisirs non-tech).

---

## Habitudes — `src/modules/habits/local.repository.ts` (10 habitudes)

| id | Catégorie thématique | Nom FR | Description FR | icône |
|---|---|---|---|---|
| h001 | Bien-être mental | Méditation | 15 min de pleine conscience | 🧘 |
| h002 | Bien-être mental | Journaling | Écrire mes pensées du jour | ✏️ |
| h003 | Santé physique | Course à pied | 30 min de running | 🏃 |
| h004 | Santé physique | Marche quotidienne | 8000 pas minimum | 👟 |
| h005 | Alimentation | Hydratation 2L | Boire 2 litres d'eau par jour | 💧 |
| h006 | Alimentation | 5 fruits & légumes | Minimum 5 portions par jour | 🥦 |
| h007 | Productivité | Technique Pomodoro | 4 sessions x 25 min de focus | ⏱️ |
| h008 | Productivité | Revue agenda matin | Planifier la journée en 5 min | 📅 |
| h009 | Apprentissage | Duolingo | 15 min de pratique linguistique | 🌍 |
| h010 | Apprentissage | Veille technologique | Lire Hacker News + Reddit tech | 🔭 |

**Biais** : plutôt neutre/généraliste dans l'ensemble (le seul vraiment "tech" est h010 Hacker
News/Reddit). C'est la liste la plus facile à garder telle quelle ou à peine retoucher.

---

## Événements — `src/modules/events/repository.ts`

### Ponctuels notables (23 events, `ONE_TIME_EVENTS`)

| id | Titre FR | Description FR |
|---|---|---|
| event-1 | Réunion d'équipe | Point hebdomadaire (créé par un collègue, avatar visible) |
| event-2 | Déjeuner client | Restaurant Le Petit Bistrot |
| event-3 | Formation React | Module avancé sur les hooks |
| event-4 | Sport | Séance de running |
| event-fut-1 | Sprint Review Q2 | Démo des fonctionnalités du sprint |
| event-fut-2 | Entretien candidat | Poste développeur front-end |
| event-fut-3 | DevFest 2026 | Conférence tech — talk React |
| event-conf-1 | DevFest Paris 2025 | Talk React architecture — 300 participants |
| event-conf-2 | React Summit 2025 | Amsterdam — remote |
| event-conf-3 | Paris Web 2025 | Conférence accessibilité + perf |
| event-launch-1 | 🚀 Lancement COSMO v1.0 | Premier déploiement public — 67 beta users |
| event-launch-2 | 🚀 Lancement COSMO v2.0 | Nouvelles fonctionnalités majeures |
| event-tb-1 | Team Building Q2 2025 | Escape room + dîner |
| event-tb-2 | Team Building Q4 2025 | Karting + restaurant |
| event-train-1 | Formation SQL avancé | Window functions + optimisation |
| event-train-2 | Workshop Design Thinking | 2 jours avec l'équipe produit |
| event-train-3 | Formation Sécurité OWASP | Top 10 vulnérabilités web |
| event-train-4 | Formation Leadership | Communication et gestion d'équipe |
| event-health-1 | Bilan médecin annuel | Check-up complet |
| event-health-2 | Dentiste | Détartrage + contrôle |
| event-health-3 | Bilan médecin annuel | Check-up annuel 2026 |
| event-plan-1 | Définition OKRs 2026 | Session stratégique annuelle |
| event-plan-2 | Présentation investisseurs | Pitch + métriques croissance |
| event-plan-3 | Kickoff projet COSMO | Lancement officiel du projet |

**Biais fort** : conférences dev (DevFest, React Summit, Paris Web), pitch investisseurs,
lancement produit — narratif très "startup tech B2B SaaS", pas du tout "freelance / étudiant /
particulier".

### Récurrents générés par fonction (104 occurrences au total, mêmes titres répétés)

| Générateur | Titre FR | Fréquence | Occurrences |
|---|---|---|---|
| `weeklyMeetings` | Réunion d'équipe | hebdo | 62 |
| `monthlyRetros` | Rétrospective mensuelle | mensuel | 14 |
| `biweekly1on1` | 1:1 avec le manager | bimensuel | 28 |

### Agendas membres mode entreprise (`seedMemberEvents`, par membre)

| Titre FR | Couleur |
|---|---|
| Point équipe | bleu |
| Session de travail | violet |
| Revue de code | vert |
| Atelier design | rose |
| 1:1 manager | orange |
| Rétro sprint | rouge |

---

## OKRs — `src/modules/okrs/repository.ts` (8 OKRs, 24 Key Results)

### En cours

**okr-1 — Améliorer ma productivité Q2 2026** (Personnel, 55%)
- Compléter 90% des tâches planifiées — 90/90%
- Réduire les distractions de 50% — 30/50%
- Méthode Pomodoro quotidiennement — 55/90 jours

**okr-2 — Maîtriser le machine learning** (Apprentissage, 50%)
- Terminer la spécialisation Coursera — 5/5 cours
- Créer 2 projets ML en production — 1/2 projets
- Kaggle competitions top 20% — 1/3 compétitions

**okr-3 — Santé et bien-être 2026** (Santé, 78%)
- Sport 4x par semaine — 52/52 séances
- Dormir 7h30+ par nuit — 58/90 nuits
- 5 fruits/légumes par jour — 90/90 jours

### Récents complétés

**okr-4 — Lancer COSMO v1.2 en production** (Projets, 100%)
- Livrer les 5 nouvelles features — 5/5
- Déployer sur Vercel — 1/1
- Atteindre 100 utilisateurs beta — 112/100

**okr-5 — Optimisation performances app** (Travail, 100%)
- Score Lighthouse > 90 — 94/90
- Réduire bundle size de 30% — 33/30%
- TTI < 2s sur mobile — 1.8/2.0 sec

**okr-6 — Croissance utilisateurs COSMO v1** (Projets, 100%)
- Atteindre 200 utilisateurs actifs — 234/200
- NPS score supérieur à 40 — 47/40
- Rétention J30 > 40% — 43/40%

### Anciens complétés

**okr-7 — Excellence technique Q3 2025** (Travail, 100%)
- Couverture de tests > 80% — 84/80%
- Temps de chargement < 1.5s — 1.2/1.5 sec
- Zéro vulnérabilité critique — 0/0

**okr-8 — Bien-être et santé H1 2025** (Santé, 100%)
- Sport 3x/semaine pendant 6 mois — 72/72 séances
- 5000 pages lues en 6 mois — 5240/5000 pages
- Méditation quotidienne, streak 90j — 94/90 jours

**Biais fort** : 3 des 8 OKRs sont littéralement "faire grandir COSMO l'app" (v1.2 launch, perf,
croissance users) — ça n'a de sens que si l'utilisateur EST l'équipe fondatrice de COSMO. Pour
un persona freelance/étudiant/particulier générique, ces 3 OKRs sont à remplacer entièrement.

---

## Pistes de correction (à discuter, rien n'est fait)

1. **OKRs** : okr-4/5/6 ("lancer COSMO", "perf app", "croissance COSMO") ne représentent aucun
   persona cible — à remplacer par des objectifs freelance (ex: "Diversifier mon portefeuille
   clients"), étudiant (ex: "Réussir mon semestre"), ou particulier (ex: "Préparer un déménagement").
2. **Events** : les conférences dev (DevFest, React Summit, Paris Web) et le vocabulaire startup
   (pitch investisseurs, sprint review, team building) sur-représentent un seul persona. Un
   freelance aurait plutôt rdv clients / devis / compta ; un étudiant aurait cours / partiels / TP.
3. **Tasks** : ok dans l'ensemble mais 100% "salarié" (npm, audit sécu, crédit immo). Ajouter au
   moins une tâche freelance (facture/devis à un 2e client, relance paiement) et une tâche
   étudiante (rendu de dossier, révisions examen).
4. **Habits** : la liste la plus neutre — seule h010 (Hacker News/Reddit tech) est très dev-centric,
   pourrait devenir plus généraliste ("Veille pro" par ex.) sans perdre le fond.

Dis-moi quels éléments tu veux changer (et vers quel persona) et je modifie directement les
fichiers `local.repository.ts` / `repository.ts` + leurs overlays `_EN`.
