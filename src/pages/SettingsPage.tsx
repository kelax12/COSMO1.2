import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, BookOpen, LogOut, Layout, Calendar,
  CheckSquare, Activity, Target, BarChart2,
  HelpCircle, Shield, Monitor, Camera,
  Eye, EyeOff, Loader2, Mail, ChevronRight,
  Users, Star, Crown, ArrowRight, Zap,
  Tag, Repeat, TrendingUp, Bell, Filter, MessageCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { useUpdateUserSettings } from '../modules/user';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

type SettingsTab = 'profile' | 'appearance' | 'security' | 'guide';
type GuideId = 'dashboard' | 'tasks' | 'agenda' | 'habits' | 'okrs' | 'stats' | 'friends' | 'premium';

/* ─── font loader ──────────────────────────────────────────────── */
function useFonts() {
  useEffect(() => {
    const id = 'settings-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

/* ─── nav config ───────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Compte',
    items: [
      { id: 'profile' as SettingsTab, icon: User, label: 'Profil' },
      { id: 'security' as SettingsTab, icon: Shield, label: 'Sécurité' },
    ],
  },
  {
    label: 'Préférences',
    items: [{ id: 'appearance' as SettingsTab, icon: Palette, label: 'Apparence' }],
  },
  {
    label: 'Aide',
    items: [{ id: 'guide' as SettingsTab, icon: BookOpen, label: 'Guide' }],
  },
];

/* ─── guide nav ─────────────────────────────────────────────────── */
const GUIDE_NAV: { id: GuideId; icon: React.ElementType; label: string; color: string }[] = [
  { id: 'dashboard', icon: Layout,      label: 'Dashboard',    color: '#3b82f6' },
  { id: 'tasks',     icon: CheckSquare, label: 'To do list',   color: '#3b82f6' },
  { id: 'agenda',    icon: Calendar,    label: 'Agenda',       color: '#ef4444' },
  { id: 'habits',    icon: Activity,    label: 'Habitudes',    color: '#eab308' },
  { id: 'okrs',      icon: Target,      label: 'OKR',          color: '#22c55e' },
  { id: 'stats',     icon: BarChart2,   label: 'Statistiques', color: '#8b5cf6' },
  { id: 'friends',   icon: Users,       label: 'Amis',         color: '#6366f1' },
  { id: 'premium',   icon: Crown,       label: 'Premium',      color: '#d97706' },
];

/* ─── guide data ────────────────────────────────────────────────── */
type GuideData = {
  id: GuideId;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  gradient: string;
  description: string;
  features: { icon: React.ElementType; label: string; desc: string }[];
  steps: { title: string; desc: string }[];
  tips: string[];
};

const GUIDE_DATA: GuideData[] = [
  {
    id: 'dashboard',
    icon: Layout,
    title: 'Tableau de Bord',
    subtitle: 'Vue d\'ensemble de votre productivité',
    badge: 'Vue principale',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-600',
    description: 'Le Tableau de Bord est votre point de départ quotidien. Il agrège en temps réel les données de tous vos modules — tâches, habitudes, événements, OKRs — pour vous donner une vision instantanée et actionnable de votre journée.',
    features: [
      { icon: BarChart2,    label: 'Statistiques globales',   desc: 'Tâches complétées, streak d\'habitudes, OKRs actifs — tout en un coup d\'œil.' },
      { icon: Calendar,     label: 'Événements du jour',      desc: 'Widget latéral listant vos prochains rendez-vous et rappels.' },
      { icon: CheckSquare,  label: 'Tâches urgentes',         desc: 'Vos tâches prioritaires du jour affichées directement sur le dashboard.' },
      { icon: Zap,          label: 'Ajout rapide',            desc: 'Bouton "+" flottant pour capturer une idée ou une tâche en 2 secondes.' },
      { icon: TrendingUp,   label: 'Graphique d\'activité',   desc: 'Courbe de productivité sur 7 jours pour voir vos tendances.' },
    ],
    steps: [
      { title: 'Vérifiez vos stats', desc: 'Regardez les 4 cartes de statistiques en haut pour évaluer votre semaine en cours.' },
      { title: 'Consultez l\'agenda du jour', desc: 'Le widget latéral vous montre vos événements à venir triés chronologiquement.' },
      { title: 'Traitez vos tâches urgentes', desc: 'Les tâches à haute priorité sont remontées automatiquement sur le dashboard.' },
      { title: 'Utilisez l\'ajout rapide', desc: 'Cliquez sur "+" pour créer une tâche ou un événement sans quitter la page.' },
    ],
    tips: [
      'Cliquez sur une carte de statistiques pour naviguer directement vers la section correspondante.',
      'Le dashboard se rafraîchit automatiquement — pas besoin de recharger la page.',
      'Cochez une habitude ou une tâche directement depuis le dashboard sans changer de page.',
    ],
  },
  {
    id: 'tasks',
    icon: CheckSquare,
    title: 'To do list',
    subtitle: 'Organisez chaque action de votre vie',
    badge: 'Core',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'La gestion des tâches est le cœur de Cosmo. Créez, organisez et suivez toutes vos actions avec un système de priorités, catégories et deadlines. Transformez vos projets complexes en actions simples et actionnables.',
    features: [
      { icon: Star,         label: '5 niveaux de priorité',   desc: 'De Critique à Optionnel — hiérarchisez pour focaliser votre énergie sur ce qui compte.' },
      { icon: Tag,          label: 'Catégories personnalisées', desc: 'Créez des catégories colorées (Pro, Perso, Sport…) pour séparer vos univers.' },
      { icon: Calendar,     label: 'Deadlines & alertes',      desc: 'Fixez des dates limites et repérez les tâches en retard d\'un coup d\'œil.' },
      { icon: Star,         label: 'Favoris',                  desc: 'Marquez vos tâches importantes pour les retrouver instantanément en tête de liste.' },
      { icon: Users,        label: 'Collaboration',            desc: 'Partagez une tâche avec un ami en mode Lecteur ou Éditeur.' },
      { icon: Filter,       label: 'Filtres avancés',          desc: 'Filtrez par priorité, catégorie, statut, deadline pour afficher exactement ce dont vous avez besoin.' },
    ],
    steps: [
      { title: 'Créez une tâche', desc: 'Cliquez sur "+" et renseignez le nom, la priorité, la deadline et le temps estimé.' },
      { title: 'Assignez une catégorie', desc: 'Choisissez ou créez une catégorie colorée pour organiser vos tâches par domaine.' },
      { title: 'Filtrez et triez', desc: 'Utilisez les filtres en haut de liste pour afficher uniquement les tâches pertinentes.' },
      { title: 'Cochez et progressez', desc: 'Marquez une tâche comme terminée — une animation satisfaisante confirme votre victoire.' },
    ],
    tips: [
      'Assignez toujours une priorité dès la création — cela change radicalement l\'efficacité du tri.',
      'Les tâches avec deadline dépassée apparaissent en rouge : traitez-les avant les nouvelles.',
      'Utilisez le temps estimé pour planifier votre journée sans vous surcharger.',
    ],
  },
  {
    id: 'agenda',
    icon: Calendar,
    title: 'Agenda & Planification',
    subtitle: 'Visualisez votre temps, maîtrisez votre vie',
    badge: 'Planification',
    color: '#ef4444',
    gradient: 'from-red-500 to-red-600',
    description: 'L\'Agenda fusionne vos événements et vos tâches planifiées en une vue calendrier unifiée. Naviguez entre les vues Jour, Semaine et Mois pour avoir exactement le niveau de détail dont vous avez besoin.',
    features: [
      { icon: Layout,       label: '3 vues calendrier',        desc: 'Vue Jour pour le détail heure par heure, Semaine pour l\'organisation, Mois pour la vision long terme.' },
      { icon: Zap,          label: 'Création rapide',          desc: 'Cliquez sur n\'importe quel créneau pour créer un événement instantanément.' },
      { icon: ArrowRight,   label: 'Glisser-déposer',          desc: 'Déplacez un événement dans le calendrier en le faisant glisser vers le nouveau créneau.' },
      { icon: CheckSquare,  label: 'Liaison tâche ↔ événement', desc: 'Associez un événement à une tâche pour un suivi complet de vos engagements.' },
      { icon: Tag,          label: 'Code couleur',             desc: 'Chaque événement a sa propre couleur pour identifier vos catégories d\'activités.' },
      { icon: Repeat,       label: 'Événements récurrents',    desc: 'Créez des événements qui se répètent quotidiennement, hebdomadairement ou mensuellement.' },
    ],
    steps: [
      { title: 'Choisissez votre vue', desc: 'Sélectionnez Jour, Semaine ou Mois selon l\'horizon temporel que vous souhaitez visualiser.' },
      { title: 'Créez un événement', desc: 'Cliquez sur un créneau vide dans le calendrier pour ouvrir le formulaire de création.' },
      { title: 'Personnalisez', desc: 'Ajoutez titre, heure de début/fin, couleur, description et liez-le à une tâche si besoin.' },
      { title: 'Gérez votre planning', desc: 'Faites glisser les événements pour les reprogrammer sans ouvrir le formulaire.' },
    ],
    tips: [
      'La vue Semaine est idéale pour la planification du lundi — vous voyez d\'un coup les 7 prochains jours.',
      'Créez un événement "bloc de travail" lié à une tâche pour vous garantir du temps dédié.',
      'Utilisez des couleurs différentes par type d\'activité (Pro = bleu, Perso = vert, Santé = rouge).',
    ],
  },
  {
    id: 'habits',
    icon: Activity,
    title: 'Suivi des Habitudes',
    subtitle: 'Construisez des routines qui durent',
    badge: 'Routines',
    color: '#eab308',
    gradient: 'from-yellow-500 to-yellow-600',
    description: 'Le tracker d\'habitudes vous aide à construire des routines solides grâce au suivi de streak. Définissez vos habitudes, cochez-les chaque jour et visualisez votre progression sur des semaines et des mois.',
    features: [
      { icon: Repeat,       label: 'Fréquences flexibles',     desc: 'Habitudes quotidiennes, hebdomadaires ou mensuelles — choisissez le rythme adapté.' },
      { icon: Zap,          label: 'Streak motivant',          desc: 'Compteur de jours consécutifs qui vous pousse à ne jamais briser la chaîne.' },
      { icon: Tag,          label: 'Icônes & couleurs',        desc: 'Personnalisez chaque habitude avec une icône et une couleur distinctive.' },
      { icon: TrendingUp,   label: 'Historique complet',       desc: 'Visualisez votre historique de complétion sur 30, 60 ou 90 jours.' },
      { icon: Calendar,     label: 'Temps estimé',             desc: 'Renseignez la durée de l\'habitude pour la prendre en compte dans votre planning.' },
    ],
    steps: [
      { title: 'Créez une habitude', desc: 'Cliquez sur "+" et renseignez nom, fréquence, icône et couleur.' },
      { title: 'Choisissez la fréquence', desc: 'Quotidien pour les routines clés, Hebdomadaire pour les activités régulières, Mensuel pour les bilans.' },
      { title: 'Cochez chaque jour', desc: 'Validez l\'habitude dès que vous la réalisez — votre streak augmente de 1.' },
      { title: 'Consultez l\'historique', desc: 'Cliquez sur une habitude pour voir votre calendrier de complétion et vos statistiques.' },
    ],
    tips: [
      'Commencez avec seulement 3-5 habitudes — mieux vaut les tenir toutes que d\'en rater la moitié.',
      'Cochez l\'habitude dans l\'instant, pas à la fin de la journée, pour ne jamais oublier.',
      'Le streak visible sur chaque habitude est votre meilleur outil de motivation — protégez-le.',
    ],
  },
  {
    id: 'okrs',
    icon: Target,
    title: 'Objectifs & OKR',
    subtitle: 'Alignez vos actions sur vos ambitions',
    badge: 'Stratégie',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-600',
    description: 'Le module OKR (Objectives & Key Results) structure vos ambitions à long terme. Définissez des objectifs inspirants et des résultats clés mesurables pour transformer vos aspirations en plans concrets et suivables.',
    features: [
      { icon: Target,       label: 'Objectifs catégorisés',   desc: 'Organisez vos OKRs par domaine : Personnel, Professionnel, Santé, Finances…' },
      { icon: TrendingUp,   label: 'Résultats Clés mesurables', desc: 'Chaque KR a une valeur cible, une unité et une progression calculée automatiquement.' },
      { icon: BarChart2,    label: 'Progression automatique', desc: 'La progression de l\'OKR se calcule depuis les KRs — pas besoin de la saisir manuellement.' },
      { icon: Calendar,     label: 'Dates de début et fin',   desc: 'Définissez un cadre temporel pour chaque objectif (Q1, semestre, année…).' },
      { icon: CheckSquare,  label: 'Liaison tâches ↔ OKRs',  desc: 'Connectez vos actions quotidiennes à vos objectifs pour mesurer l\'impact de chaque tâche.' },
    ],
    steps: [
      { title: 'Définissez un Objectif', desc: 'Rédigez un objectif ambitieux et inspirant, ex: "Devenir expert React en Q3".' },
      { title: 'Ajoutez des Résultats Clés', desc: 'Créez 2-4 KRs mesurables, ex: "Finir 5 projets = 0/5" ou "100% cours complétés".' },
      { title: 'Mettez à jour régulièrement', desc: 'Incrémentez la valeur de vos KRs chaque semaine pour suivre votre progression réelle.' },
      { title: 'Célébrez la complétion', desc: 'Marquez un OKR comme terminé pour le voir archivé avec sa date d\'atteinte.' },
    ],
    tips: [
      'La règle d\'or : 1 objectif = 2 à 4 Résultats Clés maximum. Au-delà, c\'est ingérable.',
      'Revoyez vos OKRs chaque lundi matin pour mettre à jour les valeurs et rester dans le flow.',
      'Un bon OKR doit être légèrement inconfortable — si c\'est trop facile, relevez le niveau.',
    ],
  },
  {
    id: 'stats',
    icon: BarChart2,
    title: 'Statistiques',
    subtitle: 'Comprenez vos patterns, optimisez votre énergie',
    badge: 'Analyse',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-violet-600',
    description: 'La page Statistiques analyse vos données sur la durée pour révéler des patterns dans votre productivité. Identifiez vos meilleurs moments, vos catégories fortes et les axes d\'amélioration concrets.',
    features: [
      { icon: TrendingUp,   label: 'Taux de complétion',      desc: 'Pourcentage de tâches terminées sur 7, 30 ou 90 jours — avec tendance haussière ou baissière.' },
      { icon: Bell,         label: 'Pic de productivité',     desc: 'Graphique horaire qui révèle à quel moment de la journée vous êtes le plus efficace.' },
      { icon: Tag,          label: 'Analyse par catégorie',   desc: 'Répartition de vos tâches et habitudes par domaine de vie.' },
      { icon: Activity,     label: 'Suivi des streaks',       desc: 'Évolution de vos streaks d\'habitudes dans le temps pour voir votre constance.' },
      { icon: BarChart2,    label: 'Comparaison semaine/semaine', desc: 'Comparez automatiquement votre semaine actuelle à la précédente.' },
      { icon: Target,       label: 'Progression OKR',         desc: 'Vue synthétique de la progression de tous vos objectifs actifs.' },
    ],
    steps: [
      { title: 'Choisissez la période', desc: 'Sélectionnez 7 jours, 30 jours ou 90 jours selon l\'analyse que vous souhaitez faire.' },
      { title: 'Lisez votre pic d\'activité', desc: 'Le graphique horaire montre vos heures de pointe — planifiez les tâches difficiles à ce moment.' },
      { title: 'Identifiez les déséquilibres', desc: 'Regardez la répartition par catégorie — une catégorie négligée mérite votre attention.' },
      { title: 'Fixez des objectifs basés sur les données', desc: 'Utilisez votre moyenne historique pour fixer des targets réalistes la semaine suivante.' },
    ],
    tips: [
      'Consultez les stats chaque lundi — 5 minutes d\'analyse change la qualité de toute la semaine.',
      'Si votre pic est à 10h, bloquez ce créneau pour votre travail le plus difficile et exigeant.',
      'Une catégorie à 0% sur 30 jours est un signal : c\'est peut-être une priorité mal définie.',
    ],
  },
  {
    id: 'friends',
    icon: Users,
    title: 'Amis & Messagerie',
    subtitle: 'Collaborez et avancez ensemble',
    badge: 'Collaboration',
    color: '#6366f1',
    gradient: 'from-indigo-500 to-violet-600',
    description: 'Le module Amis & Collaboration vous permet de travailler avec vos proches sur des projets communs. Partagez des tâches, suivez la progression ensemble et échangez via la messagerie directe intégrée.',
    features: [
      { icon: Users,        label: 'Ajout par email',          desc: 'Invitez n\'importe quel utilisateur Cosmo en renseignant son adresse email.' },
      { icon: CheckSquare,  label: 'Partage de tâches',        desc: 'Partagez une tâche en mode Lecteur (visualise) ou Éditeur (peut compléter).' },
      { icon: Users,        label: 'Validation collaborative', desc: 'Sur les tâches partagées, chaque participant peut valider sa propre contribution.' },
      { icon: MessageCircle, label: 'Messagerie directe',      desc: 'Discutez en temps réel avec vos amis sans quitter Cosmo.' },
      { icon: Bell,         label: 'Notifications',            desc: 'Recevez une notification à chaque invitation, partage ou message reçu.' },
    ],
    steps: [
      { title: 'Ajoutez un ami', desc: 'Allez dans la section Amis, cliquez "Inviter" et renseignez l\'email de votre contact.' },
      { title: 'Acceptez les demandes', desc: 'Les demandes reçues apparaissent dans votre inbox — acceptez pour commencer la collaboration.' },
      { title: 'Partagez une tâche', desc: 'Ouvrez une tâche, cliquez "Partager", choisissez un ami et son rôle (Lecteur ou Éditeur).' },
      { title: 'Communiquez', desc: 'Utilisez la messagerie pour discuter directement autour des tâches partagées.' },
    ],
    tips: [
      'Le rôle "Éditeur" permet à votre ami de cocher la tâche — parfait pour les projets en duo.',
      'Utilisez la messagerie directement depuis une tâche partagée pour garder le contexte.',
      'Les demandes d\'amis non acceptées expirent après 30 jours — pensez à relancer si besoin.',
    ],
  },
  {
    id: 'premium',
    icon: Crown,
    title: 'Premium',
    subtitle: 'Déverrouillez tout le potentiel de Cosmo',
    badge: 'Abonnement',
    color: '#d97706',
    gradient: 'from-amber-500 to-yellow-500',
    description: 'Le plan Premium déverrouille toutes les fonctionnalités avancées de Cosmo sans restriction. Profitez d\'analyses approfondies, de la synchronisation multi-appareils et d\'un accès illimité à tous les modules.',
    features: [
      { icon: Zap,          label: 'Accès illimité',           desc: 'Plus de limites sur le nombre de tâches, habitudes, OKRs ou événements créés.' },
      { icon: BarChart2,    label: 'Statistiques avancées',    desc: 'Rapports détaillés, historique long terme et exports de données (PDF, CSV).' },
      { icon: Users,        label: 'Collaboration étendue',    desc: 'Jusqu\'à 10 collaborateurs par tâche et historique de messages illimité.' },
      { icon: Monitor,      label: 'Thèmes exclusifs',         desc: 'Accédez aux thèmes Monochrome et Glass réservés aux membres Premium.' },
      { icon: Star,         label: 'Support prioritaire',      desc: 'Accès au support dédié avec réponse garantie en moins de 24h.' },
      { icon: Bell,         label: 'Notifications avancées',   desc: 'Rappels intelligents, alertes de streak et notifications de deadline personnalisables.' },
    ],
    steps: [
      { title: 'Accédez à la page Premium', desc: 'Cliquez sur "Premium" dans le menu de navigation principal ou depuis les paramètres.' },
      { title: 'Choisissez votre plan', desc: 'Optez pour le plan Mensuel ou Annuel (économie de 20%) selon vos besoins.' },
      { title: 'Paiement sécurisé', desc: 'Complétez le paiement via Stripe — votre abonnement est actif immédiatement.' },
      { title: 'Profitez sans limites', desc: 'Toutes les fonctionnalités Premium sont déverrouillées instantanément après paiement.' },
    ],
    tips: [
      'L\'abonnement annuel revient à 20% moins cher — idéal si vous utilisez Cosmo quotidiennement.',
      'L\'abonnement peut être annulé à tout moment depuis cette page, sans frais ni engagement.',
      'Vos données restent accessibles même en cas d\'annulation — vous ne perdez rien.',
    ],
  },
];

/* ─── SVG Illustrations ─────────────────────────────────────────── */

function DashboardIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const colors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b'];
  const labels = ['Tâches','Habitudes','Streak','OKRs'];
  const vals = ['24','7','12j','3'];
  const bars = [45,72,38,85,60,78,52];
  const days = ['L','M','M','J','V','S','D'];
  const events = [
    { color:'#3b82f6', title:'Réunion équipe', time:'14h00' },
    { color:'#22c55e', title:'Sport', time:'18h30' },
    { color:'#8b5cf6', title:'Lecture', time:'20h00' },
  ];
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      {colors.map((c, i) => (
        <g key={i}>
          <rect x={10+i*82} y="8" width="74" height="44" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
          <rect x={18+i*82} y="16" width="8" height="8" rx="2" fill={c} opacity="0.85" />
          <text x={30+i*82} y="23" fontSize="7" style={{fill: muted}} fontFamily="sans-serif">{labels[i]}</text>
          <text x={18+i*82} y="43" fontSize="15" fontWeight="700" fill={c} fontFamily="sans-serif">{vals[i]}</text>
        </g>
      ))}
      <rect x="10" y="62" width="198" height="118" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="20" y="78" fontSize="7" fontWeight="600" style={{fill: muted}} fontFamily="sans-serif">ACTIVITÉ SEMAINE</text>
      {bars.map((h, i) => (
        <g key={i}>
          <rect x={24+i*27} y={148-h*0.62} width="16" height={h*0.62} rx="3" fill="#3b82f6" opacity={0.25+i*0.09} />
          <text x={32+i*27} y="168" fontSize="6" textAnchor="middle" style={{fill: muted}} fontFamily="sans-serif">{days[i]}</text>
        </g>
      ))}
      <line x1="18" y1="149" x2="200" y2="149" style={{stroke: border, strokeWidth: 0.5}} />
      <rect x="218" y="62" width="112" height="118" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="228" y="78" fontSize="7" fontWeight="600" style={{fill: muted}} fontFamily="sans-serif">À VENIR</text>
      {events.map(({color, title, time}, i) => (
        <g key={i}>
          <rect x="226" y={90+i*26} width="3" height="20" rx="1.5" fill={color} />
          <text x="234" y={103+i*26} fontSize="7.5" fontWeight="500" style={{fill: text}} fontFamily="sans-serif">{title}</text>
          <text x="234" y={113+i*26} fontSize="6.5" style={{fill: muted}} fontFamily="sans-serif">{time}</text>
        </g>
      ))}
    </svg>
  );
}

function TasksIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const tasks = [
    { color:'#ef4444', label:'Critique', name:'Préparer présentation client', done:false, cat:'Pro', deadline:'Aujourd\'hui' },
    { color:'#f59e0b', label:'Haute',    name:'Réviser le rapport Q2',         done:false, cat:'Pro', deadline:'Demain' },
    { color:'#3b82f6', label:'Moyenne',  name:'Appel avec l\'équipe design',   done:true,  cat:'Réunion', deadline:'Mer 28' },
    { color:'#22c55e', label:'Basse',    name:'Lire article sur React 19',     done:false, cat:'Perso', deadline:'Cette sem.' },
  ];
  const accent = '#3b82f6';
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="320" height="32" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <rect x="20" y="17" width="50" height="14" rx="4" fill={accent} opacity="0.15" />
      <text x="45" y="27" fontSize="7.5" textAnchor="middle" fill={accent} fontWeight="600" fontFamily="sans-serif">Toutes</text>
      {['Pro','Perso','Sport'].map((cat, i) => (
        <g key={i}>
          <rect x={78+i*68} y="17" width="52" height="14" rx="4" style={{fill: bg, stroke: border, strokeWidth: 1}} />
          <text x={104+i*68} y="27" fontSize="7" textAnchor="middle" style={{fill: muted}} fontFamily="sans-serif">{cat}</text>
        </g>
      ))}
      {tasks.map(({color, name, done, cat, deadline}, i) => (
        <g key={i}>
          <rect x="10" y={50+i*34} width="320" height="30" rx="7" style={{fill: surface, stroke: border, strokeWidth: 1}} />
          <rect x="10" y={50+i*34} width="4" height="30" rx="2" fill={color} style={{borderRadius:'7px 0 0 7px'}} />
          <circle cx="30" cy={65+i*34} r="7" fill={done ? color : 'none'} stroke={color} strokeWidth="1.5" opacity={done ? 0.9 : 0.7} />
          {done && <path d={`M26 ${65+i*34} L29 ${68+i*34} L34 ${62+i*34}`} stroke="white" strokeWidth="1.5" fill="none" />}
          <text x="44" y={68+i*34} fontSize="8" style={{fill: done ? muted : text, textDecoration: done ? 'line-through' : 'none'}} fontFamily="sans-serif">{name}</text>
          <rect x="44" y={72+i*34} width={cat.length*5+6} height="10" rx="3" fill={color} opacity="0.12" />
          <text x={47+cat.length*2.5} y={79+i*34} fontSize="6" fill={color} textAnchor="middle" fontFamily="sans-serif">{cat}</text>
          <text x={240+cat.length*5} y={79+i*34} fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{deadline}</text>
        </g>
      ))}
    </svg>
  );
}

function AgendaIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const events = [
    { day:0, start:20, h:28, color:'#3b82f6', title:'Standup' },
    { day:1, start:48, h:20, color:'#22c55e', title:'Sport' },
    { day:2, start:20, h:56, color:'#8b5cf6', title:'Deep Work' },
    { day:3, start:36, h:20, color:'#f59e0b', title:'Réunion' },
    { day:4, start:20, h:36, color:'#ef4444', title:'Présentation' },
    { day:5, start:60, h:28, color:'#06b6d4', title:'Détente' },
  ];
  const colW = 44;
  const colStart = 52;
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="320" height="24" rx="6" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      {['Jour','Semaine','Mois'].map((v, i) => (
        <g key={i}>
          <rect x={20+i*66} y="12" width="58" height="16" rx="4" fill={i===1 ? '#ef4444' : 'transparent'} opacity={i===1 ? 0.2 : 1} />
          <text x={49+i*66} y="23" textAnchor="middle" fontSize="7.5" fill={i===1 ? '#ef4444' : undefined} style={i!==1 ? {fill: muted} : undefined} fontWeight={i===1 ? '600' : '400'} fontFamily="sans-serif">{v}</text>
        </g>
      ))}
      {days.map((d, i) => (
        <text key={i} x={colStart+i*colW+colW/2} y="46" textAnchor="middle" fontSize="7" fontWeight="600" style={{fill: i===2 ? '#ef4444' : muted}} fontFamily="sans-serif">{d}</text>
      ))}
      <line x1="10" y1="50" x2="330" y2="50" style={{stroke: border, strokeWidth: 0.5}} />
      {[8,10,12,14,16,18].map((h, i) => (
        <g key={i}>
          <text x="38" y={66+i*22} textAnchor="end" fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{h}h</text>
          <line x1="42" y1={62+i*22} x2="330" y2={62+i*22} style={{stroke: border, strokeWidth: 0.3}} />
        </g>
      ))}
      {events.map(({day, start, h, color, title}, i) => (
        <g key={i}>
          <rect x={colStart+day*colW+2} y={55+start} width={colW-6} height={h} rx="4" fill={color} opacity="0.25" />
          <rect x={colStart+day*colW+2} y={55+start} width="3" height={h} rx="1.5" fill={color} />
          <text x={colStart+day*colW+8} y={55+start+Math.min(h/2+4, 12)} fontSize="6.5" fontWeight="600" fill={color} fontFamily="sans-serif">{title}</text>
        </g>
      ))}
    </svg>
  );
}

function HabitsIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const habits = [
    { color:'#eab308', icon:'🏃', name:'Course', streak:12, rate:0.85, freq:'Quotidien' },
    { color:'#eab308', icon:'📚', name:'Lecture', streak:7, rate:0.70, freq:'Quotidien' },
    { color:'#eab308', icon:'🧘', name:'Méditation', streak:21, rate:0.95, freq:'Quotidien' },
    { color:'#eab308', icon:'💪', name:'Musculation', streak:5, rate:0.60, freq:'Hebdo' },
    { color:'#eab308', icon:'🥗', name:'Alimentation', streak:3, rate:0.75, freq:'Quotidien' },
    { color:'#eab308', icon:'😴', name:'Sommeil', streak:9, rate:0.90, freq:'Quotidien' },
  ];
  const r = 16;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      {habits.map(({color, icon, name, streak, rate, freq}, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = 56 + col * 110;
        const cy = 50 + row * 88;
        const dashOffset = circumference * (1 - rate);
        return (
          <g key={i}>
            <rect x={cx-48} y={cy-38} width="96" height="72" rx="10" style={{fill: surface, stroke: border, strokeWidth: 1}} />
            <circle cx={cx} cy={cy-10} r={r+3} fill={color} opacity="0.08" />
            <circle cx={cx} cy={cy-10} r={r} fill="none" stroke={color} strokeWidth="2.5" opacity="0.2" />
            <circle cx={cx} cy={cy-10} r={r} fill="none" stroke={color} strokeWidth="2.5"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy-10})`} />
            <text x={cx} y={cy-5} textAnchor="middle" fontSize="13" fontFamily="sans-serif">{icon}</text>
            <text x={cx} y={cy+18} textAnchor="middle" fontSize="7.5" fontWeight="600" style={{fill: 'rgb(var(--color-text-secondary))'}} fontFamily="sans-serif">{name}</text>
            <text x={cx-10} y={cy+29} textAnchor="middle" fontSize="7" fill={color} fontWeight="700" fontFamily="sans-serif">{streak}j</text>
            <text x={cx+16} y={cy+29} textAnchor="middle" fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{freq}</text>
          </g>
        );
      })}
    </svg>
  );
}

function OKRsIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const krs = [
    { label:'Finir 5 projets React',   current:3, target:5, color:'#22c55e', unit:'projets' },
    { label:'100 heures de formation', current:67, target:100, color:'#22c55e', unit:'heures' },
    { label:'Obtenir 4 certifications', current:2, target:4, color:'#22c55e', unit:'certifs' },
  ];
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="320" height="50" rx="10" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <rect x="18" y="16" width="6" height="32" rx="3" fill="#22c55e" />
      <text x="30" y="26" fontSize="8" fontWeight="700" style={{fill: text}} fontFamily="sans-serif">Devenir Expert React en Q3 2025</text>
      <text x="30" y="37" fontSize="7" style={{fill: muted}} fontFamily="sans-serif">Professionnel · Jan → Sep 2025</text>
      <rect x="30" y="42" width="180" height="8" rx="4" style={{fill: bg, stroke: border, strokeWidth: 1}} />
      <rect x="30" y="42" width={180*(3/3*0.6+0.1)} height="8" rx="4" fill="#22c55e" opacity="0.7" />
      <text x="218" y="50" fontSize="7" fill="#22c55e" fontFamily="sans-serif">60%</text>
      <text x="30" y="60" fontSize="6.5" style={{fill: muted}} fontFamily="sans-serif">3 Résultats Clés</text>
      <rect x="290" y="14" width="32" height="14" rx="5" fill="#22c55e" opacity="0.15" />
      <text x="306" y="24" textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="600" fontFamily="sans-serif">Actif</text>
      {krs.map(({label, current, target, color, unit}, i) => {
        const pct = current / target;
        return (
          <g key={i}>
            <rect x="10" y={70+i*38} width="320" height="32" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
            <circle cx="24" cy={86+i*38} r="7" fill={color} opacity="0.15" />
            <text x="24" y={89+i*38} textAnchor="middle" fontSize="7" fill={color} fontFamily="sans-serif">◎</text>
            <text x="38" y={84+i*38} fontSize="7.5" fontWeight="500" style={{fill: text}} fontFamily="sans-serif">{label}</text>
            <text x="38" y={94+i*38} fontSize="6.5" style={{fill: muted}} fontFamily="sans-serif">{current} / {target} {unit}</text>
            <rect x="160" y={82+i*38} width="130" height="7" rx="3.5" style={{fill: bg, stroke: border, strokeWidth: 1}} />
            <rect x="160" y={82+i*38} width={130*pct} height="7" rx="3.5" fill={color} opacity="0.75" />
            <text x="297" y={90+i*38} fontSize="6.5" fill={color} fontWeight="700" fontFamily="sans-serif">{Math.round(pct*100)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function StatsIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const weeks = [62,78,55,85,71,90,68];
  const days = ['L','M','M','J','V','S','D'];
  const hours = [2,4,8,12,16,10,6,3,1];
  const maxH = Math.max(...hours);
  const cats = [
    { label:'Pro', w:120, color:'#8b5cf6' },
    { label:'Perso', w:80, color:'#8b5cf6' },
    { label:'Sport', w:55, color:'#8b5cf6' },
    { label:'Santé', w:40, color:'#8b5cf6' },
  ];
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="200" height="110" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="20" y="24" fontSize="7" fontWeight="600" style={{fill: muted}} fontFamily="sans-serif">COMPLÉTION PAR JOUR</text>
      {weeks.map((v, i) => {
        const h = v * 0.7;
        return (
          <g key={i}>
            <rect x={24+i*27} y={95-h} width="18" height={h} rx="3" fill="#8b5cf6" opacity={0.2+i*0.07} />
            <text x={33+i*27} y="108" textAnchor="middle" fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{days[i]}</text>
            <text x={33+i*27} y={91-h} textAnchor="middle" fontSize="5.5" fill="#8b5cf6" fontFamily="sans-serif">{v}%</text>
          </g>
        );
      })}
      <line x1="18" y1="96" x2="202" y2="96" style={{stroke: border, strokeWidth: 0.5}} />
      <rect x="220" y="8" width="110" height="110" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="230" y="24" fontSize="7" fontWeight="600" style={{fill: muted}} fontFamily="sans-serif">PIC D'ACTIVITÉ</text>
      {hours.map((v, i) => {
        const h = (v / maxH) * 60;
        return (
          <g key={i}>
            <rect x={228+i*12} y={90-h} width="9" height={h} rx="2"
              fill={i===4 ? '#f59e0b' : '#06b6d4'} opacity={i===4 ? 0.9 : 0.4} />
            {i===4 && <text x={232+i*12} y={86-h} textAnchor="middle" fontSize="5.5" fill="#f59e0b" fontWeight="700" fontFamily="sans-serif">pic</text>}
          </g>
        );
      })}
      <line x1="226" y1="91" x2="324" y2="91" style={{stroke: border, strokeWidth: 0.5}} />
      <rect x="10" y="128" width="320" height="52" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="20" y="144" fontSize="7" fontWeight="600" style={{fill: muted}} fontFamily="sans-serif">PAR CATÉGORIE</text>
      {cats.map(({label, w, color}, i) => (
        <g key={i}>
          <text x="20" y={158+i*10} fontSize="7" style={{fill: text}} fontFamily="sans-serif">{label}</text>
          <rect x="70" y={152+i*10} width="200" height="7" rx="3.5" style={{fill: bg, stroke: border, strokeWidth: 1}} />
          <rect x="70" y={152+i*10} width={w} height="7" rx="3.5" fill={color} opacity="0.7" />
          <text x="276" y={159+i*10} fontSize="6.5" fill={color} fontFamily="sans-serif">{Math.round(w/200*100)}%</text>
        </g>
      ))}
    </svg>
  );
}

function FriendsIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const friends = [
    { initials:'AL', color:'#3b82f6', name:'Alice Lambert', status:'En ligne', tasks:3 },
    { initials:'MR', color:'#22c55e', name:'Marc Rousseau', status:'Hors ligne', tasks:1 },
    { initials:'SD', color:'#8b5cf6', name:'Sophie Dupont', status:'En ligne', tasks:2 },
  ];
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="180" height="170" rx="10" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="20" y="26" fontSize="8" fontWeight="700" style={{fill: text}} fontFamily="sans-serif">Mes Amis</text>
      <rect x="130" y="14" width="50" height="18" rx="5" fill="#3b82f6" opacity="0.15" />
      <text x="155" y="26" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600" fontFamily="sans-serif">+ Inviter</text>
      {friends.map(({initials, color, name, status, tasks}, i) => (
        <g key={i}>
          <rect x="18" y={36+i*42} width="164" height="36" rx="8" style={{fill: bg, stroke: border, strokeWidth: 1}} />
          <circle cx="34" cy={54+i*42} r="12" fill={color} opacity="0.85" />
          <text x="34" y={58+i*42} textAnchor="middle" fontSize="7" fontWeight="700" fill="white" fontFamily="sans-serif">{initials}</text>
          <circle cx="43" cy={43+i*42} r="4" fill={status === 'En ligne' ? '#22c55e' : '#94a3b8'} />
          <text x="52" y={50+i*42} fontSize="8" fontWeight="600" style={{fill: text}} fontFamily="sans-serif">{name}</text>
          <text x="52" y={61+i*42} fontSize="6.5" style={{fill: muted}} fontFamily="sans-serif">{tasks} tâches partagées</text>
          <text x="165" y={61+i*42} textAnchor="end" fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{status}</text>
        </g>
      ))}
      <rect x="200" y="8" width="130" height="80" rx="10" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="210" y="24" fontSize="8" fontWeight="700" style={{fill: text}} fontFamily="sans-serif">Tâche partagée</text>
      <rect x="210" y="30" width="110" height="48" rx="6" style={{fill: bg, stroke: border, strokeWidth: 1}} />
      <rect x="210" y="30" width="3" height="48" rx="1.5" fill="#3b82f6" />
      <text x="220" y="43" fontSize="7.5" fontWeight="500" style={{fill: text}} fontFamily="sans-serif">Préparer slides</text>
      <text x="220" y="54" fontSize="6.5" style={{fill: muted}} fontFamily="sans-serif">Partagée avec Alice</text>
      <rect x="220" y="58" width="38" height="12" rx="4" fill="#3b82f6" opacity="0.15" />
      <text x="239" y="67" textAnchor="middle" fontSize="6.5" fill="#3b82f6" fontFamily="sans-serif">Éditeur</text>
      <rect x="200" y="98" width="130" height="80" rx="10" style={{fill: surface, stroke: border, strokeWidth: 1}} />
      <text x="210" y="114" fontSize="8" fontWeight="700" style={{fill: text}} fontFamily="sans-serif">Messages</text>
      {[
        { from:'AL', msg:'T\'as fini la partie UX ?', time:'14:32', align:'left' as const },
        { from:'Moi', msg:'Oui, je t\'envoie !', time:'14:35', align:'right' as const },
        { from:'AL', msg:'Super, merci 👌', time:'14:35', align:'left' as const },
      ].map(({msg, align}, i) => (
        <g key={i}>
          {align === 'left' ? (
            <>
              <rect x="210" y={120+i*22} width={msg.length*4.2} height="14" rx="5" fill="#3b82f6" opacity="0.12" />
              <text x="215" y={130+i*22} fontSize="6" fill="#3b82f6" fontFamily="sans-serif">{msg}</text>
            </>
          ) : (
            <>
              <rect x={322-msg.length*4.2} y={120+i*22} width={msg.length*4.2} height="14" rx="5" fill="#8b5cf6" opacity="0.15" />
              <text x={317} y={130+i*22} textAnchor="end" fontSize="6" style={{fill: muted}} fontFamily="sans-serif">{msg}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function PremiumIllustration() {
  const bg = 'rgb(var(--color-background))';
  const surface = 'rgb(var(--color-surface))';
  const border = 'rgb(var(--color-border))';
  const muted = 'rgb(var(--color-text-muted))';
  const text = 'rgb(var(--color-text-secondary))';
  const features = [
    { icon:'∞', label:'Accès illimité', color:'#d97706' },
    { icon:'📊', label:'Stats avancées', color:'#3b82f6' },
    { icon:'🔒', label:'Thèmes exclusifs', color:'#8b5cf6' },
    { icon:'⚡', label:'Support prioritaire', color:'#22c55e' },
    { icon:'👥', label:'Collab étendue', color:'#6366f1' },
    { icon:'📤', label:'Export données', color:'#06b6d4' },
  ];
  return (
    <svg viewBox="0 0 340 190" className="w-full rounded-xl" style={{maxHeight:190}}>
      <defs>
        <linearGradient id="premGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="340" height="190" rx="12" style={{fill: bg}} />
      <rect x="10" y="8" width="320" height="68" rx="12" fill="url(#premGrad)" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.3" />
      <text x="170" y="28" textAnchor="middle" fontSize="22" fontFamily="sans-serif">👑</text>
      <text x="170" y="48" textAnchor="middle" fontSize="12" fontWeight="800" fill="#d97706" fontFamily="sans-serif">COSMO PREMIUM</text>
      <text x="170" y="62" textAnchor="middle" fontSize="7.5" style={{fill: muted}} fontFamily="sans-serif">Déverrouillez tout le potentiel de Cosmo</text>
      {features.map(({icon, label, color}, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 14 + col * 108;
        const y = 86 + row * 46;
        return (
          <g key={i}>
            <rect x={x} y={y} width="100" height="38" rx="8" style={{fill: surface, stroke: border, strokeWidth: 1}} />
            <rect x={x} y={y} width="100" height="38" rx="8" fill={color} opacity="0.04" />
            <circle cx={x+18} cy={y+19} r="12" fill={color} opacity="0.12" />
            <text x={x+18} y={y+23} textAnchor="middle" fontSize="12" fontFamily="sans-serif">{icon}</text>
            <text x={x+34} y={y+17} fontSize="7.5" fontWeight="600" style={{fill: text}} fontFamily="sans-serif">{label.split(' ')[0]}</text>
            <text x={x+34} y={y+27} fontSize="7" style={{fill: muted}} fontFamily="sans-serif">{label.split(' ').slice(1).join(' ')}</text>
            <circle cx={x+88} cy={y+12} r="5" fill={color} opacity="0.2" />
            <path d={`M${x+86} ${y+12} L${x+88} ${y+14} L${x+91} ${y+10}`} stroke={color} strokeWidth="1.2" fill="none" />
          </g>
        );
      })}
    </svg>
  );
}

const ILLUSTRATIONS: Record<GuideId, React.FC> = {
  dashboard: DashboardIllustration,
  tasks:     TasksIllustration,
  agenda:    AgendaIllustration,
  habits:    HabitsIllustration,
  okrs:      OKRsIllustration,
  stats:     StatsIllustration,
  friends:   FriendsIllustration,
  premium:   PremiumIllustration,
};

/* ─── reusable: LabeledInput ───────────────────────────────────── */
function LabeledInput({
  label, type = 'text', value, onChange, placeholder, icon: Icon, showToggle,
}: {
  label: string; type?: string; value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; icon?: React.ElementType; showToggle?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const inputType = showToggle ? (visible ? 'text' : 'password') : type;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] tracking-wide">{label}</label>
      <div className="relative group">
        {Icon && (
          <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] group-focus-within:text-[rgb(var(--color-accent))] transition-colors pointer-events-none" />
        )}
        <input
          type={inputType} value={value} onChange={onChange} placeholder={placeholder}
          style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '48px' }}
          className={`w-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all duration-150 focus:border-[rgb(var(--color-accent))] focus:ring-2 focus:ring-[rgb(var(--color-accent))]/15 ${Icon ? 'pl-10' : 'pl-4'} ${showToggle ? 'pr-11' : 'pr-4'} py-3`}
        />
        {showToggle && (
          <button type="button" tabIndex={-1} onClick={() => setVisible(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors p-1"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── reusable: PrimaryButton ──────────────────────────────────── */
function PrimaryButton({ onClick, type = 'button', loading = false, children }: {
  onClick?: () => void; type?: 'button' | 'submit'; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <button type={type} onClick={onClick} disabled={loading}
      style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '44px' }}
      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[rgb(var(--color-accent))] text-white rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 shadow-sm shadow-[rgb(var(--color-accent))]/20">
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/* ─── reusable: SectionCard ────────────────────────────────────── */
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

/* ─── GuideFeatureCard ──────────────────────────────────────────── */
function GuideFeatureCard({ data }: { data: GuideData }) {
  const Icon = data.icon;
  const Illustration = ILLUSTRATIONS[data.id];

  return (
    <motion.div
      key={data.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col gap-0 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl overflow-hidden"
    >
      {/* header */}
      <div className={`bg-gradient-to-r ${data.gradient} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                className="text-lg font-extrabold text-white leading-tight">{data.title}</h3>
              <p className="text-white/75 text-xs mt-0.5">{data.subtitle}</p>
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wide backdrop-blur-sm">
            {data.badge}
          </span>
        </div>
      </div>

      {/* illustration */}
      <div className="p-4 bg-[rgb(var(--color-background))] border-b border-[rgb(var(--color-border))]">
        <Illustration />
      </div>

      {/* description + features */}
      <div className="p-5 flex flex-col gap-5">
        <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-relaxed">{data.description}</p>

        <div>
          <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))] mb-3">
            Fonctionnalités
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.features.map((f, i) => {
              const FIcon = f.icon;
              return (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))]">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: `${data.color}18` }}>
                    <FIcon size={13} style={{ color: data.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] leading-tight">{f.label}</p>
                    <p className="text-[11px] text-[rgb(var(--color-text-muted))] leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* steps */}
        <div>
          <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--color-text-muted))] mb-3">
            Comment utiliser
          </p>
          <div className="flex flex-col gap-2">
            {data.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ background: data.color }}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))]">{step.title}</p>
                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] leading-relaxed mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* tips */}
        <div className="rounded-xl p-4 border" style={{ background: `${data.color}08`, borderColor: `${data.color}25` }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-base">💡</span>
            <p className="text-xs font-bold" style={{ color: data.color }}>Conseils d'utilisation</p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-[rgb(var(--color-text-secondary))] leading-relaxed">
                <ChevronRight size={11} className="shrink-0 mt-0.5" style={{ color: data.color }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── main component ───────────────────────────────────────────── */
const SettingsPage: React.FC = () => {
  useFonts();

  const { user, logout } = useAuth();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [guideSection, setGuideSection] = useState<GuideId>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; description: string; onConfirm: () => void;
    variant: 'default' | 'destructive'; showInput?: boolean; confirmationText?: string;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {}, variant: 'default' });
  const [confirmInput, setConfirmInput] = useState('');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: user?.name } });
      if (error) { toast.error(error.message); return; }
      toast.success('Profil mis à jour !');
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingProfile(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) { toast.error('Veuillez remplir tous les champs'); return; }
    if (passwords.new !== passwords.confirm) { toast.error('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (passwords.new.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return; }
    setSavingPassword(true);
    try {
      if (!supabase) { toast.error('Service non disponible'); return; }
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) { toast.error(error.message || 'Erreur lors de la mise à jour'); return; }
      toast.success('Mot de passe mis à jour !');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer le compte ?',
      description: 'Cette action est irréversible. Toutes vos données seront perdues. Tapez "DELETE" pour confirmer.',
      variant: 'destructive', showInput: true, confirmationText: 'DELETE',
      onConfirm: async () => {
        try { toast.info('Demande enregistrée', { description: 'Contactez support@cosmo.app si nécessaire.' }); }
        finally { await logout(); navigate('/welcome'); }
      },
    });
    setConfirmInput('');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { updateUserSettings({ avatar: reader.result as string }); toast.success('Photo de profil mise à jour'); };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer la photo ?',
      description: 'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
      variant: 'destructive',
      onConfirm: () => { updateUserSettings({ avatar: undefined }); toast.success('Photo supprimée'); },
    });
  };

  const handleLogout = () => {
    setConfirmConfig({
      isOpen: true, title: 'Déconnexion ?', description: 'Voulez-vous vraiment vous déconnecter ?',
      variant: 'default',
      onConfirm: () => { logout(); toast.success('Déconnexion réussie'); navigate('/welcome'); },
    });
  };

  const handleOpenSupport = () => {
    window.parent.postMessage({ type: 'OPEN_EXTERNAL_URL', data: { url: 'mailto:support@cosmo.app' } }, '*');
    toast.info('Ouverture de votre messagerie...');
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const activeGuideData = GUIDE_DATA.find(g => g.id === guideSection)!;
  const activeGuideIdx = GUIDE_NAV.findIndex(g => g.id === guideSection);

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      className="min-h-screen bg-[rgb(var(--color-background))] transition-colors duration-300 flex">

      {/* ──────── SIDEBAR ──────── */}
      <motion.aside
        className="hidden lg:flex w-72 shrink-0 border-r border-[rgb(var(--color-border))] flex-col sticky top-0 h-screen overflow-y-auto"
        style={{ background: 'rgb(var(--color-surface))' }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="p-5 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 group/av cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold select-none">
                {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  : <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{initials}</span>}
              </div>
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))] truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--color-text-muted))]">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ minHeight: '44px' }}
                      className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                        active ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))]'
                          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-primary))]'}`}>
                      <Icon size={15} className={active ? 'text-[rgb(var(--color-accent))]' : ''} strokeWidth={active ? 2.5 : 2} />
                      {item.label}
                      {active && (
                        <motion.span layoutId="pill"
                          className="absolute inset-0 rounded-xl bg-[rgb(var(--color-accent))]/10"
                          style={{ zIndex: -1 }} transition={{ duration: 0.18, ease: 'easeOut' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[rgb(var(--color-border))]">
          <button onClick={handleLogout} style={{ minHeight: '44px' }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-red-500/8 hover:text-red-500 transition-all duration-150 group">
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Déconnexion
          </button>
        </div>
      </motion.aside>

      {/* ──────── MAIN CONTENT ──────── */}
      <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-12">
        <div className="mb-8 max-w-3xl">
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            className="text-3xl font-extrabold text-[rgb(var(--color-text-primary))] tracking-tight">
            Paramètres
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            Gérez votre compte, sécurité et préférences.
          </p>
        </div>

        {/* mobile nav tabs */}
        <div className="lg:hidden flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl mb-6 overflow-x-auto">
          {NAV_GROUPS.flatMap(g => g.items).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ minHeight: '36px' }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  active ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm'
                    : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'}`}>
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── PROFIL ── */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="relative group/av shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm select-none">
                      {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        : <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{initials}</span>}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={18} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{user.name}</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      <button onClick={() => fileInputRef.current?.click()} style={{ minHeight: '36px', fontFamily: "'DM Sans', sans-serif" }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-[rgb(var(--color-border))] rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] transition-all duration-150">
                        <Camera size={12} /> Changer la photo
                      </button>
                      {user.avatar && (
                        <button onClick={handleRemoveAvatar} style={{ minHeight: '36px' }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-red-200 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-150">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
              <SectionCard>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-5">Informations personnelles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LabeledInput label="Nom complet" icon={User} value={user.name} onChange={(e) => updateUserSettings({ name: e.target.value })} placeholder="Votre nom" />
                  <LabeledInput label="Adresse email" type="email" icon={Mail} value={user.email} onChange={(e) => updateUserSettings({ email: e.target.value })} placeholder="votre@email.com" />
                </div>
                <div className="flex justify-end mt-5">
                  <PrimaryButton onClick={handleSaveProfile} loading={savingProfile}>{savingProfile ? 'Sauvegarde…' : 'Sauvegarder'}</PrimaryButton>
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* ── SÉCURITÉ ── */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Changer le mot de passe</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-5">Minimum 8 caractères. Utilisez un mélange de lettres, chiffres et symboles.</p>
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                  <LabeledInput label="Mot de passe actuel" showToggle value={passwords.current} onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))} placeholder="••••••••••••" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <LabeledInput label="Nouveau mot de passe" showToggle value={passwords.new} onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder="••••••••••••" />
                    <LabeledInput label="Confirmer" showToggle value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••••••" />
                  </div>
                  <div className="flex justify-end pt-1">
                    <PrimaryButton type="submit" loading={savingPassword}>{savingPassword ? 'Mise à jour…' : 'Mettre à jour'}</PrimaryButton>
                  </div>
                </form>
              </SectionCard>
              <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-sm font-bold text-red-600 dark:text-red-500">Zone de danger</h3>
                    <p className="text-xs text-red-500/70 mt-1">Supprimer définitivement votre compte et toutes vos données.</p>
                  </div>
                  <button onClick={handleDeleteAccount} style={{ minHeight: '44px', fontFamily: "'DM Sans', sans-serif" }}
                    className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-[0.97] transition-all duration-150">
                    Supprimer le compte
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── APPARENCE ── */}
          {activeTab === 'appearance' && (
            <motion.div key="appearance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl">
              <SectionCard>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Thème de l'interface</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-5">Choisissez l'apparence qui vous convient le mieux.</p>
                <div style={{ minHeight: '72px' }}
                  className="flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] group-hover:scale-105 transition-transform">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Mode d'affichage</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">Clair · Sombre · Monochrome · Glass</p>
                    </div>
                  </div>
                  <ThemeToggle showLabel />
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-3xl flex flex-col gap-5">

              {/* header */}
              <div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1">
                  Guide d'utilisation
                </h2>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Tout ce qu'il faut savoir pour maîtriser chaque fonctionnalité de Cosmo.
                </p>
              </div>

              {/* section nav */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" style={{scrollbarWidth:'none'}}>
                {GUIDE_NAV.map((nav) => {
                  const NavIcon = nav.icon;
                  const active = guideSection === nav.id;
                  return (
                    <button key={nav.id} onClick={() => setGuideSection(nav.id)}
                      style={{ minHeight: '36px', borderColor: active ? nav.color : undefined, color: active ? nav.color : undefined, background: active ? `${nav.color}12` : undefined }}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 border whitespace-nowrap ${
                        active ? 'shadow-sm' : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))]/40 hover:text-[rgb(var(--color-text-primary))] bg-[rgb(var(--color-surface))]'
                      }`}>
                      <NavIcon size={13} />
                      {nav.label}
                    </button>
                  );
                })}
              </div>

              {/* rich guide card */}
              <AnimatePresence mode="wait">
                <GuideFeatureCard key={guideSection} data={activeGuideData} />
              </AnimatePresence>

              {/* prev / next */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setGuideSection(GUIDE_NAV[Math.max(0, activeGuideIdx - 1)].id)}
                  disabled={activeGuideIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-[rgb(var(--color-surface))]">
                  ← {activeGuideIdx > 0 ? GUIDE_NAV[activeGuideIdx - 1].label : 'Précédent'}
                </button>
                <span className="text-[11px] text-[rgb(var(--color-text-muted))] tabular-nums">
                  {activeGuideIdx + 1} / {GUIDE_NAV.length}
                </span>
                <button
                  onClick={() => setGuideSection(GUIDE_NAV[Math.min(GUIDE_NAV.length - 1, activeGuideIdx + 1)].id)}
                  disabled={activeGuideIdx === GUIDE_NAV.length - 1}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-[rgb(var(--color-surface))]">
                  {activeGuideIdx < GUIDE_NAV.length - 1 ? GUIDE_NAV[activeGuideIdx + 1].label : 'Suivant'} →
                </button>
              </div>

              {/* support card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[rgb(var(--color-border))]"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)' }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
                    <HelpCircle size={17} className="text-white" />
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Besoin d'aide ?</p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">Notre équipe est disponible pour vous aider.</p>
                  </div>
                </div>
                <button onClick={handleOpenSupport} style={{ minHeight: '44px', fontFamily: "'DM Sans', sans-serif" }}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] rounded-xl text-sm font-semibold hover:opacity-85 active:scale-[0.97] transition-all duration-150 shrink-0">
                  Contacter le support <ChevronRight size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── confirm dialog ── */}
      <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent style={{ fontFamily: "'DM Sans', sans-serif" }}
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-xl font-bold">{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">{confirmConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmConfig.showInput && (
            <div className="py-2">
              <input type="text" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Tapez "${confirmConfig.confirmationText}"`}
                style={{ minHeight: '48px', fontFamily: "'DM Sans', sans-serif" }}
                className="w-full px-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl font-semibold text-[rgb(var(--color-text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 outline-none" />
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmConfig.showInput && confirmInput !== confirmConfig.confirmationText}
              onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(prev => ({ ...prev, isOpen: false })); }}
              className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
