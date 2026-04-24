Rapport — COSMO 1.2 : Features & Stratégie de Landing Page
1. Vue d'ensemble de l'app
COSMO est une suite de productivité personnelle tout-en-un qui combine gestion de tâches, suivi d'habitudes, calendrier, OKR (Objectives & Key Results), statistiques, et collaboration sociale — le tout avec un mode démo instantané et une architecture dual mode (localStorage / Supabase).

2. Inventaire complet des fonctionnalités
Tâches
Création / édition / suppression avec titre, description, priorité (1–5), catégorie, deadline, durée estimée
Filtres multi-critères : priorité, catégorie, statut, deadline, recherche textuelle
Deux vues : Liste (cartes visuelles) et Tableau (colonnes triables)
Favoris / bookmarks
Listes personnalisées (type "projets" ou "sprints")
Partage de tâches avec rôle Viewer ou Editor (Premium)
Habitudes
Fréquence Daily / Weekly / Monthly
Historique de complétion quotidien avec streaks (séries consécutives)
Heatmap 26 semaines style GitHub
Grille 7 jours sur les cartes, grille 30 jours dans le détail
Taux de complétion en % + temps investi
Couleur et icône personnalisables par habitude
Agenda / Calendrier
Vues Jour, Semaine, Mois via FullCalendar
Drag & drop des tâches dans les créneaux horaires (time blocking)
Zoom 5min → 1h
Auto-scroll sur l'heure courante
Couleur des événements héritée de la catégorie de la tâche
OKR (Objectives & Key Results)
Création d'objectifs avec Key Results (valeur cible + unité de mesure)
Progression automatique calculée sur la moyenne des KR
Journal de complétion append-only (log immuable)
Historique d'OKRs complétés
Catégories : Carrière, Santé, Apprentissage, Produit, Performance
Statistiques & Analytics
Sélecteur de période : jour, semaine, mois, année
Onglets par module : Tâches, Agenda, OKR, Habitudes
Répartition du temps de travail inter-modules
Timeline des complétion de KR
Heatmap habitudes intégrée
Graphiques Recharts (area, bar, custom tooltips)
Dashboard
Métriques du jour en stat cards
Mini bar chart 7 jours (tendance tâches)
Widget OKRs actifs avec progress bars
Habitudes du jour avec toggle rapide
Tâches prioritaires du jour
Widget requêtes d'amis (accept/reject en 1 clic)
Tâches collaboratives partagées
Collaboration & Amis (Premium)
Envoi de demandes d'amis par email
Partage de tâches avec rôle Viewer / Editor
Workflow de validation par collaborateur
Indicateurs de partage dans le tableau de tâches
Messagerie temps réel (Premium)
Chat entre amis avec Supabase Realtime
Référencement de tâche en contexte du message
Statut lu / non lu + badges de notification
Max 100 messages par conversation
Premium & Billing
Modèle token : 1 token consommé/jour de premium
Recharge via Stripe (30 tokens) ou pub (1 token)
Win streak (mois consécutifs premium)
Expiration automatique quand tokens = 0
Catégories & Listes
Catégories colorées (8 couleurs hex) assignées aux tâches et événements
Listes = collections de tâches (projets, sprints…)
Gestionnaire modal avec color picker
Mode Démo
Accessible en 1 clic, sans compte
100 tâches, 100 habitudes, ~150 événements, 8 OKRs
Toutes les features Premium débloquées
Données rechargées à chaque connexion démo
UX & Technique
Dark mode / Light mode / Auto
Framer Motion + GSAP pour les animations
Responsive mobile-first (Tailwind CSS)
Sidebar collapsible
TypeScript strict + React Query (TanStack)
RLS Supabase (sécurité row-level)
3. Les 5 piliers de l'app (pour structurer la landing)
Pilier	Ce que ça signifie
Centralisation	Tout dans un seul outil : tâches, agenda, habitudes, objectifs
Progression	Streaks, heatmaps, analytics → on voit qu'on avance
Ambition	OKR = framework des grandes entreprises (Google, Intel) adapté à l'individu
Collaboration	Partage de tâches + messagerie = productivité d'équipe
Accessibilité immédiate	Mode démo sans compte → zéro friction pour découvrir
4. Les tons à utiliser — et pourquoi
Ton 1 — Ambitieux & Inspirant (pour le Hero et l'OKR)
L'utilisateur veut se dépasser. Il ne veut pas juste "gérer ses tâches", il veut accomplir quelque chose de grand.

Exemples de formulations :

"Fixez des objectifs qui comptent. Atteignez-les."
"Les OKR ont propulsé Google. Ils peuvent propulser votre vie."
"Ne subissez plus votre agenda. Construisez-le."
Ton : direct, court, puissant. Phrases courtes. Verbes d'action.

Ton 2 — Chaleureux & Motivant (pour les Habitudes & Streaks)
L'utilisateur veut être encouragé, pas jugé. Il veut voir ses progrès comme une victoire.

Exemples :

"Chaque jour compte. Votre heatmap le prouve."
"7 jours d'affilée. Puis 30. Puis une vie."
"Vos habitudes, visualisées. Votre progression, évidente."
Ton : positif, doux, presque coach de vie. Utilise "vous" avec bienveillance.

Ton 3 — Clair & Pragmatique (pour les Tâches & Filtres)
L'utilisateur veut comprendre rapidement l'utilité. Pas de poésie ici.

Exemples :

"Filtrez par priorité, catégorie, deadline. Trouvez ce qui compte maintenant."
"Vue liste ou tableau. Vous choisissez comment vous pensez."
"Partagez une tâche. Assignez un rôle. Collaborez sans friction."
Ton : fonctionnel, économe, comme une bonne UI.

Ton 4 — Professionnel & Crédible (pour l'Analytics & OKR)
L'utilisateur veut sentir que l'outil est sérieux, qu'il peut se mesurer sur la durée.

Exemples :

"Analysez vos 12 derniers mois en un coup d'œil."
"Taux de complétion, temps investi, tendances hebdomadaires. Des données, pas des suppositions."
"La méthode OKR, utilisée par les plus grandes entreprises mondiales. Désormais dans votre poche."
Ton : sobre, data-driven, sans jargon inutile.

Ton 5 — Social & Engageant (pour la Collaboration & la Messagerie)
L'utilisateur veut sentir qu'il peut connecter son cercle, pas juste bosser seul.

Exemples :

"Partagez vos tâches avec vos amis. Construisez ensemble."
"Un projet, plusieurs têtes. Un seul outil."
"Discutez d'une tâche directement dans son contexte."
Ton : humain, moderne, proche des outils socio-collaboratifs (Notion, Linear).

Ton 6 — Frictionless & Invitant (pour le Mode Démo et le Hero CTA)
L'utilisateur hésite à s'inscrire. Il faut lever toute barrière psychologique.

Exemples :

"Aucun compte nécessaire. Essayez maintenant."
"En 1 clic, vivez l'expérience complète."
"Toutes les features, tout de suite. Décidez ensuite."
Ton : rassurant, sans pression, accueillant. Le contraire du paywall agressif.

5. Structure recommandée de la landing
Section	Ton	Angle
Hero	Ambitieux + Frictionless	Tagline forte + CTA démo 1 clic
Problème	Pragmatique	"Vous jonglent entre 5 outils. Il en faut un."
Features Tâches	Pragmatique	Clarté, filtres, vues
Features Habitudes	Chaleureux	Streaks, heatmap, progression visible
Features OKR	Professionnel	Crédibilité, méthode éprouvée
Calendrier	Pragmatique	Time blocking, drag & drop
Statistiques	Professionnel	Données, tendances, analyse
Collaboration	Social	Amis, partage, messagerie
Mode Démo CTA	Frictionless	"Testez maintenant — sans compte"
Pricing	Pragmatique + Social	Tier gratuit généreux, Premium accessible
Footer CTA	Ambitieux	Phrase finale forte
6. Messages clés à ne pas oublier
COSMO remplace 4–5 outils (Todoist + Notion + Google Calendar + Habitica + Slack partiel)
Le mode démo est une arme : montrer avant de vendre
L'OKR est le différenciateur fort : aucun concurrent mainstream ne l'intègre aussi naturellement dans un outil personnel
La heatmap habitudes est visuellement frappante — la montrer en screenshot/animation
Le modèle token est original et doit être expliqué simplement (pas effrayant)
