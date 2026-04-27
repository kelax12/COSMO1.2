import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, Calendar, Repeat, Target, BarChart2,
  Rocket, Star, Lightbulb, ArrowRight, ChevronRight,
  BookOpen, Clock, Flag, Bookmark, Users, TrendingUp,
  Flame, CircleDot, Layers, Filter, Bell, List,
  GripVertical, PlayCircle
} from 'lucide-react';
import TaskTableShowcase from '../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../components/showcase/HabitHeatmapShowcase';
import StatsShowcase from '../components/showcase/StatsShowcase';

// ─── Types ────────────────────────────────────────────────────────────
type SectionId = 'demarrage' | 'taches' | 'listes' | 'agenda' | 'habitudes' | 'okr' | 'statistiques' | 'premium';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  color: string;
}

// Couleurs identiques à Layout.tsx (CHART_COLORS + hoverColor)
const NAV_ITEMS: NavItem[] = [
  { id: 'demarrage',    label: 'Prise en main',  icon: <Rocket size={16} />,      color: '#94a3b8' },
  { id: 'taches',       label: 'Tâches',          icon: <CheckSquare size={16} />, color: '#3b82f6' },
  { id: 'listes',       label: 'Listes',           icon: <List size={16} />,        color: '#3b82f6' },
  { id: 'agenda',       label: 'Agenda',           icon: <Calendar size={16} />,    color: '#ef4444' },
  { id: 'habitudes',    label: 'Habitudes',        icon: <Repeat size={16} />,      color: '#eab308' },
  { id: 'okr',          label: 'OKR',              icon: <Target size={16} />,      color: '#22c55e' },
  { id: 'statistiques', label: 'Statistiques',     icon: <BarChart2 size={16} />,   color: '#8b5cf6' },
  { id: 'premium',      label: 'Premium',          icon: <Star size={16} />,        color: '#eab308' },
];

// ─── Sub-components ───────────────────────────────────────────────────

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-6">
    <Lightbulb size={16} className="text-blue-400 shrink-0 mt-0.5" />
    <p className="text-sm text-blue-200 leading-relaxed">{children}</p>
  </div>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 bg-slate-700/40 border border-white/8 rounded-xl p-4 mt-4">
    <CircleDot size={15} className="text-slate-400 shrink-0 mt-0.5" />
    <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
  </div>
);

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white mt-0.5">
      {n}
    </div>
    <div>
      <p className="font-semibold text-white mb-1">{title}</p>
      <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
    </div>
  </div>
);

const FeatureRow: React.FC<{ icon: React.ReactNode; label: string; desc: string }> = ({ icon, label, desc }) => (
  <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0 text-slate-300">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </div>
  </div>
);

const SectionHeader: React.FC<{ id: SectionId; icon: React.ReactNode; color: string; title: string; subtitle: string }> = ({ id, icon, color, title, subtitle }) => (
  <div id={id} className="flex items-start gap-4 mb-8 pt-2">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 mt-1">{subtitle}</p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────

const GuidePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('demarrage');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) {
        sectionRefs.current[id] = el;
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/welcome" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <img src="/logo.png" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-semibold text-white">Cosmo</span>
            </Link>
            <ChevronRight size={14} className="text-slate-600" />
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <BookOpen size={14} />
              Guide d'utilisation
            </span>
          </div>
          <Link
            to="/welcome"
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            Retour à l'accueil
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-12">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Sommaire</p>
              <nav className="space-y-1">
                {NAV_ITEMS.map(({ id, label, icon, color }) => {
                  const isActive = activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
                      style={{
                        backgroundColor: isActive ? color + '15' : 'transparent',
                        color: isActive ? color : '#94A3B8',
                      }}
                    >
                      <span style={{ color: isActive ? color : '#64748B' }}>{icon}</span>
                      {label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Content ── */}
          <main className="flex-1 min-w-0 space-y-24">

            {/* ══ PRISE EN MAIN ══════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="demarrage"
                icon={<Rocket size={24} />}
                color="#94a3b8"
                title="Prise en main"
                subtitle="Créer votre compte et découvrir l'application en 2 minutes."
              />

              <div className="space-y-6">
                <Step n={1} title="Créer un compte ou essayer la démo">
                  Rendez-vous sur la page d'accueil. Cliquez sur <strong className="text-white">Commencer gratuitement</strong> pour créer un compte avec votre e-mail, ou sur <strong className="text-white">Essayer la démo</strong> pour accéder immédiatement à une version pré-remplie sans inscription.
                </Step>
                <Step n={2} title="Se connecter via Google">
                  Depuis la fenêtre de connexion, cliquez sur <strong className="text-white">Continuer avec Google</strong> pour vous authentifier en un clic avec votre compte Google existant.
                </Step>
                <Step n={3} title="Naviguer dans l'application">
                  La barre latérale gauche donne accès à toutes les fonctionnalités : Dashboard, Tâches, Agenda, Habitudes, OKR, Statistiques. Le menu se réduit automatiquement pour laisser plus de place à votre contenu.
                </Step>
              </div>

              <Tip>
                Le <strong>mode démo</strong> est idéal pour explorer toutes les fonctionnalités avec des données réalistes avant de créer votre vrai compte. Vos données de démo ne sont pas sauvegardées.
              </Tip>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: <Layers size={18} />, label: 'Dashboard', desc: 'Vue d\'ensemble de toute votre activité' },
                  { icon: <Bell size={18} />, label: 'Notifications', desc: 'Alertes sur vos tâches et collaborations' },
                  { icon: <Flag size={18} />, label: 'Paramètres', desc: 'Thème, compte, préférences' },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-800/60 border border-white/8 rounded-xl p-4">
                    <div className="text-slate-400 mb-2">{item.icon}</div>
                    <p className="font-semibold text-white text-sm">{item.label}</p>
                    <p className="text-slate-400 text-xs mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ══ TÂCHES ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="taches"
                icon={<CheckSquare size={24} />}
                color="#3b82f6"
                title="Tâches"
                subtitle="Organisez, priorisez et suivez tout ce que vous avez à faire."
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <TaskTableShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title="Créer une tâche">
                  Cliquez sur le bouton <strong className="text-white">+ Nouvelle tâche</strong> en haut de la page. Renseignez le nom, la deadline, la durée estimée et la catégorie. La tâche apparaît immédiatement dans le tableau.
                </Step>
                <Step n={2} title="Définir la priorité">
                  Chaque tâche reçoit un niveau de priorité de <strong className="text-white">1 (faible)</strong> à <strong className="text-white">5 (critique)</strong>. Les tâches priorité 5 apparaissent en rouge, priorité 4 en orange. Utilisez ce système pour vous concentrer sur ce qui compte vraiment.
                </Step>
                <Step n={3} title="Marquer comme terminée">
                  Cochez le cercle à gauche de la tâche. Elle passe en mode barré et est archivée. Vous pouvez filtrer les tâches terminées via le bouton <strong className="text-white">Terminées</strong> dans la barre de filtres.
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<Bookmark size={15} />}   label="Favoris"        desc="Mettez en favori une tâche importante — elle apparaît en surbrillance dorée et dans le filtre Favoris." />
                <FeatureRow icon={<Clock size={15} />}      label="Durée estimée"  desc="Renseignez le temps estimé pour chaque tâche. Le Dashboard vous affiche votre charge de travail totale." />
                <FeatureRow icon={<Filter size={15} />}     label="Filtres"        desc="Filtrez par Favoris, Terminées, En retard ou Collaboratives. Les filtres se combinent." />
                <FeatureRow icon={<Users size={15} />}      label="Collaboration"  desc="Partagez une tâche avec un ami via l'icône de partage. Il peut la voir et la valider depuis son compte." />
                <FeatureRow icon={<Flag size={15} />}       label="Catégories"     desc="Associez chaque tâche à une catégorie colorée (Travail, Personnel, Santé...) pour mieux visualiser votre temps." />
              </div>
            </section>

            {/* ══ LISTES ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="listes"
                icon={<List size={24} />}
                color="#3b82f6"
                title="Listes"
                subtitle="Regroupez vos tâches par projet ou contexte pour une organisation sans effort."
              />

              <div className="space-y-6">
                <Step n={1} title="Créer une liste">
                  Dans la barre latérale gauche de la page Tâches, cliquez sur <strong className="text-white">+ Nouvelle liste</strong>. Donnez-lui un nom et une couleur. La liste apparaît instantanément dans le panneau de navigation.
                </Step>
                <Step n={2} title="Ajouter des tâches à une liste">
                  Lors de la création ou de l'édition d'une tâche, sélectionnez la liste à laquelle elle appartient dans le champ prévu à cet effet. Une tâche peut appartenir à une seule liste.
                </Step>
                <Step n={3} title="Filtrer par liste">
                  Cliquez sur une liste dans le panneau latéral pour n'afficher que les tâches qu'elle contient. Le compteur à droite du nom indique le nombre de tâches actives dans la liste.
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<List size={15} />}       label="Vue par liste"    desc="Chaque liste affiche uniquement ses tâches, avec ses propres filtres et tri." />
                <FeatureRow icon={<Flag size={15} />}       label="Couleur de liste" desc="Attribuez une couleur distinctive à chaque liste pour les différencier visuellement." />
                <FeatureRow icon={<Filter size={15} />}     label="Toutes les tâches" desc="La vue 'Toutes les tâches' regroupe l'ensemble des tâches toutes listes confondues." />
              </div>

              <Tip>
                Utilisez les listes pour séparer vos projets : une liste <strong>Travail</strong>, une liste <strong>Personnel</strong>, une liste par client ou par projet actif. Cela évite de mélanger des contextes différents dans une vue unique.
              </Tip>
            </section>

            {/* ══ AGENDA ═════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="agenda"
                icon={<Calendar size={24} />}
                color="#ef4444"
                title="Agenda"
                subtitle="Planifiez vos événements et visualisez votre semaine d'un coup d'œil."
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <AgendaShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title="Créer un événement">
                  Cliquez sur un créneau horaire dans la vue semaine, ou sur le bouton <strong className="text-white">+ Événement</strong>. Définissez le titre, la date, l'heure de début et de fin, et la catégorie.
                </Step>
                <Step n={2} title="Déplacer par glisser-déposer">
                  Saisissez un événement existant et faites-le glisser vers un autre créneau ou une autre journée directement dans la grille. Relâchez pour confirmer le déplacement — la sauvegarde est automatique.
                </Step>
                <Step n={3} title="Changer de vue">
                  Basculez entre la vue <strong className="text-white">Jour</strong>, <strong className="text-white">Semaine</strong> ou <strong className="text-white">Mois</strong> via les boutons en haut à droite. La vue Semaine offre le meilleur équilibre entre détail et vue d'ensemble.
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<GripVertical size={15} />} label="Drag & drop"             desc="Glissez-déposez n'importe quel événement pour le reprogrammer en quelques secondes sans ouvrir de formulaire." />
                <FeatureRow icon={<Repeat size={15} />}       label="Événements récurrents"   desc="Créez un événement hebdomadaire ou quotidien une seule fois — il se répète automatiquement." />
                <FeatureRow icon={<Flag size={15} />}         label="Catégories couleur"      desc="Chaque catégorie a sa couleur. Votre agenda devient un tableau de bord visuel de votre temps." />
                <FeatureRow icon={<Clock size={15} />}        label="Vue compressée"          desc="Les créneaux sans événements sont réduits automatiquement pour maximiser la lisibilité." />
              </div>

              <Tip>
                Bloquez du temps dans votre agenda pour vos tâches importantes (time blocking). Cela évite la surcharge et rend vos journées plus prévisibles.
              </Tip>

              <Note>
                L'agenda et les tâches sont indépendants. Un événement agenda n'est pas une tâche — utilisez les tâches pour les actions à cocher, l'agenda pour les rendez-vous et créneaux de travail.
              </Note>
            </section>

            {/* ══ HABITUDES ══════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="habitudes"
                icon={<Repeat size={24} />}
                color="#eab308"
                title="Habitudes"
                subtitle="Construisez des routines durables et suivez votre progression jour après jour."
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <HabitHeatmapShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title="Créer une habitude">
                  Cliquez sur <strong className="text-white">+ Nouvelle habitude</strong>. Donnez-lui un nom, une couleur, une durée estimée et une fréquence (quotidienne, hebdomadaire, jours spécifiques). L'habitude apparaît dans le tableau de suivi.
                </Step>
                <Step n={2} title="Valider au quotidien">
                  Chaque jour, cochez les habitudes réalisées en cliquant sur la case correspondante dans le tableau. La case devient bleue et votre série (streak) s'incrémente.
                </Step>
                <Step n={3} title="Lire le tableau de suivi">
                  Le tableau affiche les 7 derniers jours par défaut. Basculez en vue <strong className="text-white">Mois</strong> ou <strong className="text-white">Tout</strong> pour analyser vos tendances sur le long terme.
                </Step>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame size={16} className="text-orange-400" />
                    <p className="font-semibold text-white text-sm">Série (streak)</p>
                  </div>
                  <p className="text-xs text-slate-400">Le compteur en orange indique le nombre de jours consécutifs où vous avez réalisé l'habitude. La série se remet à zéro si vous manquez un jour.</p>
                </div>
                <div className="bg-slate-800/40 border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-green-400" />
                    <p className="font-semibold text-white text-sm">Taux de complétion</p>
                  </div>
                  <p className="text-xs text-slate-400">Visible dans les statistiques, il mesure le pourcentage de jours où vous avez validé l'habitude sur la période sélectionnée.</p>
                </div>
              </div>

              <Tip>
                Commencez par <strong>2 à 3 habitudes maximum</strong>. Il est plus facile de construire sur des petites victoires régulières que de s'épuiser sur une longue liste dès le départ.
              </Tip>
            </section>

            {/* ══ OKR ════════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="okr"
                icon={<Target size={24} />}
                color="#22c55e"
                title="OKR — Objectifs & Résultats Clés"
                subtitle="Définissez des objectifs ambitieux et mesurez votre progression avec des indicateurs concrets."
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <OKRCardShowcase />
              </div>

              <div className="mb-8 bg-slate-800/40 border border-white/8 rounded-2xl p-5">
                <p className="text-sm font-semibold text-white mb-3">C'est quoi un OKR ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-400 font-medium mb-1">O — Objectif</p>
                    <p className="text-slate-400">Une ambition qualitative et inspirante. Ex : <em>"Accélérer la croissance produit"</em></p>
                  </div>
                  <div>
                    <p className="text-blue-400 font-medium mb-1">KR — Résultat Clé</p>
                    <p className="text-slate-400">Un indicateur mesurable qui prouve que l'objectif est atteint. Ex : <em>"Atteindre 10 000 utilisateurs actifs"</em></p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Step n={1} title="Créer un objectif">
                  Cliquez sur <strong className="text-white">+ Nouvel objectif</strong>. Définissez un titre, une description, une catégorie, une date de début et une date de fin (généralement un trimestre).
                </Step>
                <Step n={2} title="Ajouter des résultats clés">
                  Dans l'objectif, cliquez sur <strong className="text-white">+ Résultat clé</strong>. Donnez-lui un titre et une valeur cible chiffrée. Vous pouvez en ajouter plusieurs par objectif (3 est une bonne pratique).
                </Step>
                <Step n={3} title="Mettre à jour la progression">
                  Chaque fois que vous progressez, mettez à jour la valeur actuelle d'un résultat clé. La progression globale de l'objectif se calcule automatiquement. Quand un KR atteint sa cible, il passe en vert.
                </Step>
              </div>

              <div className="mt-8 space-y-0 bg-slate-800/40 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/5">
                <FeatureRow icon={<TrendingUp size={15} />} label="Indicateur de santé"  desc="Cosmo compare votre progression au temps écoulé. Si vous avancez plus vite que le temps, l'indicateur est vert." />
                <FeatureRow icon={<Clock size={15} />}      label="Jours restants"       desc="Un badge indique combien de jours il reste avant la date de fin de l'objectif." />
                <FeatureRow icon={<Flag size={15} />}       label="Catégories"           desc="Classez vos OKR par catégorie (Produit, Personnel, Équipe) pour une meilleure organisation." />
              </div>

              <Tip>
                Un bon résultat clé est <strong>binaire ou mesurable</strong> : soit on peut le chiffrer (ex : 10 000 utilisateurs), soit il est atteint ou non. Évitez les formulations vagues comme "Améliorer la qualité".
              </Tip>
            </section>

            {/* ══ STATISTIQUES ═══════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="statistiques"
                icon={<BarChart2 size={24} />}
                color="#8b5cf6"
                title="Statistiques"
                subtitle="Analysez votre productivité et identifiez vos points d'amélioration."
              />

              <div className="mb-8 rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <StatsShowcase />
              </div>

              <div className="space-y-6">
                <Step n={1} title="Choisir la période">
                  En haut de la page, sélectionnez la période d'analyse : <strong className="text-white">7 jours</strong>, <strong className="text-white">30 jours</strong>, <strong className="text-white">90 jours</strong> ou une plage personnalisée. Tous les graphiques se mettent à jour automatiquement.
                </Step>
                <Step n={2} title="Lire les graphiques">
                  Chaque graphique représente une dimension de votre activité — tâches complétées, habitudes respectées, OKR progressés, temps total investi. Passez votre curseur sur les barres pour voir les détails.
                </Step>
                <Step n={3} title="Identifier les tendances">
                  Comparez semaine après semaine. Une baisse régulière dans un domaine est un signal pour ajuster vos objectifs ou vos habitudes.
                </Step>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { color: '#3b82f6', label: 'Tâches',    desc: 'Nombre de tâches complétées par période' },
                  { color: '#ef4444', label: 'Agenda',    desc: 'Temps passé sur des événements planifiés' },
                  { color: '#22c55e', label: 'OKR',       desc: 'Résultats clés validés dans la période' },
                  { color: '#eab308', label: 'Habitudes', desc: 'Taux de complétion moyen des habitudes actives' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 bg-slate-800/40 border border-white/8 rounded-xl p-4">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Note>
                Les statistiques sont calculées en temps réel à partir de vos données. Plus vous utilisez Cosmo régulièrement, plus les graphiques sont représentatifs de vos vraies habitudes de travail.
              </Note>
            </section>

            {/* ══ PREMIUM ════════════════════════════════════════════════ */}
            <section>
              <SectionHeader
                id="premium"
                icon={<Star size={24} />}
                color="#eab308"
                title="Premium"
                subtitle="Obtenez l'accès Premium gratuitement en quelques secondes."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  {
                    icon: <PlayCircle size={18} />,
                    label: 'Accès par visionnage de publicité',
                    desc: 'Regardez une courte publicité depuis la page Premium pour obtenir immédiatement une journée d\'accès Premium. Renouvelable à volonté, sans aucun paiement.',
                    highlight: true,
                  },
                  {
                    icon: <Users size={18} />,
                    label: 'Collaboration',
                    desc: 'Partagez des tâches avec vos amis et travaillez ensemble en temps réel.',
                    highlight: false,
                  },
                  {
                    icon: <Star size={18} />,
                    label: 'Priorité au support',
                    desc: 'Assistance prioritaire en cas de problème.',
                    highlight: false,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 rounded-xl p-4 border"
                    style={{
                      backgroundColor: item.highlight ? 'rgba(234,179,8,0.08)' : 'rgba(30,41,59,0.4)',
                      borderColor: item.highlight ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: item.highlight ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.08)',
                        color: '#eab308',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <Step n={1} title="Accéder à la page Premium">
                  Dans la barre latérale, cliquez sur l'icône <strong className="text-white">Couronne</strong> (Premium). Vous y trouverez les détails de l'offre et le bouton d'activation.
                </Step>
                <Step n={2} title="Obtenir une journée Premium gratuitement">
                  Cliquez sur <strong className="text-white">Obtenir 1 jour Premium</strong> puis regardez la publicité jusqu'à la fin. L'accès Premium est activé immédiatement pour 24 heures. Vous pouvez répéter l'opération autant de fois que vous le souhaitez.
                </Step>
                <Step n={3} title="Gérer votre accès">
                  Depuis la page Premium, vous pouvez consulter votre statut actuel et le temps restant. Renouvelez votre accès à tout moment en visionnant une nouvelle publicité.
                </Step>
              </div>
            </section>

            {/* ── Footer guide ── */}
            <div className="border-t border-white/10 pt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-slate-500 text-sm">Une question ? Contactez-nous à <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a></p>
              <Link
                to="/welcome"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              >
                Commencer gratuitement
                <ArrowRight size={15} />
              </Link>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
