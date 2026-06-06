# Landing Page — Features & stratégie de copy — COSMO 1.2

> **Type** : doc de référence **copy / tone of voice + inventaire features** pour la landing. Non lié au code, non audité.
> Utiliser pour rédiger/réviser le contenu de `LandingPage`. Pour les showcases (composants), voir CLAUDE.md §Showcases.

---

## 1. Vue d'ensemble

COSMO est une suite de productivité personnelle tout-en-un : gestion de tâches, suivi d'habitudes, calendrier,
OKR (Objectives & Key Results), statistiques et collaboration sociale — avec un mode démo instantané et une
architecture dual mode (localStorage / Supabase).

---

## 2. Inventaire complet des fonctionnalités

**Tâches** — création/édition/suppression (titre, description, priorité 1–5, catégorie, deadline, durée estimée) ·
filtres multi-critères (priorité, catégorie, statut, deadline, recherche textuelle) · deux vues Liste (cartes) /
Tableau (colonnes triables) · favoris/bookmarks · listes personnalisées (projets/sprints) · partage avec rôle
Viewer/Editor (Premium).

**Habitudes** — fréquence Daily/Weekly/Monthly · historique de complétion quotidien avec streaks · heatmap 26 semaines
style GitHub · grille 7 jours sur les cartes, 30 jours en détail · taux de complétion % + temps investi · couleur et
icône personnalisables.

**Agenda / Calendrier** — vues Jour/Semaine/Mois (FullCalendar) · drag & drop des tâches dans les créneaux (time blocking) ·
zoom 5 min → 1 h · auto-scroll sur l'heure courante · couleur des événements héritée de la catégorie de la tâche.

**OKR** — objectifs avec Key Results (valeur cible + unité) · progression auto sur la moyenne des KR · journal de
complétion append-only (log immuable) · historique d'OKRs complétés · catégories Carrière/Santé/Apprentissage/Produit/Performance.

**Statistiques & Analytics** — sélecteur de période jour/semaine/mois/année · onglets par module (Tâches/Agenda/OKR/Habitudes) ·
répartition du temps de travail inter-modules · timeline des complétions de KR · heatmap habitudes intégrée ·
graphiques Recharts (area, bar, custom tooltips).

**Dashboard** — métriques du jour en stat cards · mini bar chart 7 jours (tendance tâches) · widget OKRs actifs avec
progress bars · habitudes du jour avec toggle rapide · tâches prioritaires du jour · widget requêtes d'amis (accept/reject
en 1 clic) · tâches collaboratives partagées.

**Collaboration & Amis (Premium)** — demandes d'amis par email · partage de tâches Viewer/Editor · workflow de validation
par collaborateur · indicateurs de partage dans le tableau.

**Messagerie temps réel (Premium)** — chat entre amis (Supabase Realtime) · référencement de tâche en contexte du message ·
statut lu/non lu + badges · max 100 messages par conversation.

**Premium & Billing** — modèle token (1 token consommé/jour de premium) · recharge via Stripe (30 tokens) ou pub (1 token) ·
win streak (mois consécutifs premium) · expiration auto quand tokens = 0.

**Catégories & Listes** — catégories colorées (8 couleurs hex) assignées aux tâches/événements · listes = collections
(projets, sprints) · gestionnaire modal avec color picker.

**Mode Démo** — accessible en 1 clic sans compte · 100 tâches, 100 habitudes, ~150 événements, 8 OKRs · toutes les
features Premium débloquées · données rechargées à chaque connexion démo.

**UX & Technique** — dark / light / auto · animations Framer Motion (⚠️ GSAP **supprimé** 2026-05-30, cf. `audit-perf.md` P-1) ·
responsive mobile-first (Tailwind) · sidebar collapsible · TypeScript strict + React Query (TanStack) · RLS Supabase.

---

## 3. Les 5 piliers (pour structurer la landing)

| Pilier | Ce que ça signifie |
|---|---|
| Centralisation | Tout dans un seul outil : tâches, agenda, habitudes, objectifs |
| Progression | Streaks, heatmaps, analytics → on voit qu'on avance |
| Ambition | OKR = framework des grandes entreprises (Google, Intel) adapté à l'individu |
| Collaboration | Partage de tâches + messagerie = productivité d'équipe |
| Accessibilité immédiate | Mode démo sans compte → zéro friction pour découvrir |

---

## 4. Les 6 tons à utiliser — et pourquoi

**Ton 1 — Ambitieux & Inspirant** (Hero, OKR) — l'utilisateur veut se dépasser, accomplir quelque chose de grand.
Direct, court, puissant, verbes d'action.
> « Fixez des objectifs qui comptent. Atteignez-les. » · « Les OKR ont propulsé Google. Ils peuvent propulser votre vie. » ·
> « Ne subissez plus votre agenda. Construisez-le. »

**Ton 2 — Chaleureux & Motivant** (Habitudes, Streaks) — encourager, pas juger ; progrès = victoire. Positif, doux, coach bienveillant.
> « Chaque jour compte. Votre heatmap le prouve. » · « 7 jours d'affilée. Puis 30. Puis une vie. » ·
> « Vos habitudes, visualisées. Votre progression, évidente. »

**Ton 3 — Clair & Pragmatique** (Tâches, Filtres) — comprendre vite l'utilité, pas de poésie. Fonctionnel, économe.
> « Filtrez par priorité, catégorie, deadline. Trouvez ce qui compte maintenant. » · « Vue liste ou tableau. Vous choisissez
> comment vous pensez. » · « Partagez une tâche. Assignez un rôle. Collaborez sans friction. »

**Ton 4 — Professionnel & Crédible** (Analytics, OKR) — outil sérieux, mesurable sur la durée. Sobre, data-driven, sans jargon.
> « Analysez vos 12 derniers mois en un coup d'œil. » · « Taux de complétion, temps investi, tendances hebdomadaires.
> Des données, pas des suppositions. » · « La méthode OKR, utilisée par les plus grandes entreprises. Désormais dans votre poche. »

**Ton 5 — Social & Engageant** (Collaboration, Messagerie) — connecter son cercle, pas bosser seul. Humain, moderne (Notion/Linear).
> « Partagez vos tâches avec vos amis. Construisez ensemble. » · « Un projet, plusieurs têtes. Un seul outil. » ·
> « Discutez d'une tâche directement dans son contexte. »

**Ton 6 — Frictionless & Invitant** (Mode Démo, Hero CTA) — lever toute barrière psychologique. Rassurant, sans pression.
> « Aucun compte nécessaire. Essayez maintenant. » · « En 1 clic, vivez l'expérience complète. » ·
> « Toutes les features, tout de suite. Décidez ensuite. »

---

## 5. Structure recommandée de la landing

| Section | Ton | Angle |
|---|---|---|
| Hero | Ambitieux + Frictionless | Tagline forte + CTA démo 1 clic |
| Problème | Pragmatique | « Vous jonglez entre 5 outils. Il en faut un. » |
| Features Tâches | Pragmatique | Clarté, filtres, vues |
| Features Habitudes | Chaleureux | Streaks, heatmap, progression visible |
| Features OKR | Professionnel | Crédibilité, méthode éprouvée |
| Calendrier | Pragmatique | Time blocking, drag & drop |
| Statistiques | Professionnel | Données, tendances, analyse |
| Collaboration | Social | Amis, partage, messagerie |
| Mode Démo CTA | Frictionless | « Testez maintenant — sans compte » |
| Pricing | Pragmatique + Social | Tier gratuit généreux, Premium accessible |
| Footer CTA | Ambitieux | Phrase finale forte |

---

## 6. Messages clés à ne pas oublier

- COSMO remplace 4–5 outils (Todoist + Notion + Google Calendar + Habitica + Slack partiel).
- Le mode démo est une arme : montrer avant de vendre.
- L'OKR est le différenciateur fort : aucun concurrent mainstream ne l'intègre aussi naturellement dans un outil personnel.
- La heatmap habitudes est visuellement frappante — la montrer en screenshot/animation.
- Le modèle token est original et doit être expliqué simplement (pas effrayant).
