// Section « Fonctionnalités » de la LandingPage — extraite verbatim.
import React, { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Target, Repeat, ArrowRight, BarChart2 } from 'lucide-react';
import TaskTableShowcase from '../../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../../components/showcase/HabitHeatmapShowcase';
import {
  TaskCardMobileShowcase,
  AgendaMobileShowcase,
  HabitMobileShowcase,
  OKRMobileShowcase,
  StatsMobileShowcase,
} from '../../components/showcase/MobileShowcases';

// Audit perf 2026-05-29 — StatsShowcase pulls Recharts (≈ 320 kB). Landing
// page should never block on it: lazy-load with a lightweight skeleton so
// the page renders instantly and the chart streams in once Recharts arrives.
const StatsShowcase = lazy(() => import('../../components/showcase/StatsShowcase'));
const ShowcaseSkeleton = () => (
  <div className="w-full rounded-2xl bg-slate-800/80 border border-white/10 shadow-2xl p-5 h-[340px] animate-pulse" />
);

interface FeaturesSectionProps {
  isMobile: boolean;
  handleFeatureClick: (path: string) => void;
}

const FeaturesSection: React.FC<FeaturesSectionProps> = ({ isMobile, handleFeatureClick }) => (
      <section id="features" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl lg:text-5xl font-bold mb-6"
            >
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Tâches, habitudes, agenda et OKR
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                dans un seul outil
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-400 max-w-3xl mx-auto"
            >
              Chaque module est conçu pour être puissant et intuitif — gestionnaire de tâches, tracker d'habitudes, agenda avec time-blocking et méthode OKR réunis
            </motion.p>
          </div>

          <div className="space-y-36">

            {/* ── Section 1 : Tâches ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-lg shadow-blue-500/30">
                  <CheckCircle size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Gestion de tâches<br /><span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">nouvelle génération</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Centralisez toutes vos tâches avec priorités, catégories colorées et deadlines. Filtrez en un clic pour vous concentrer sur l'essentiel.</p>
                <div className="space-y-3">
                  {['Filtrez par priorité, catégorie, deadline en un clic', "Ajoutez des catégories pour visualiser votre travail en un coup d'œil", 'Créez des listes de tâches pour mieux vous organiser', 'Partagez vos tâches en équipe'].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/tasks')} className="group bg-gradient-to-r from-blue-600 to-cyan-600 hover:shadow-lg hover:shadow-blue-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Essayer les tâches <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <TaskCardMobileShowcase /> : <TaskTableShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 2 : Agenda ── */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
              <motion.div
                className="space-y-6 px-4 lg:px-0"
                style={{ flex: '0 1 45%' }}
                initial={{ opacity: 0, x: 60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl shadow-lg shadow-red-500/30">
                  <Calendar size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Agenda intégré<br /><span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">avec time-blocking</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Glissez vos tâches directement dans votre calendrier pour bloquer du temps. Vues jour, semaine, mois avec zoom granulaire.</p>
                <div className="space-y-3">
                  {[
                    'Glissez une tâche depuis la sidebar vers un créneau : un événement est créé instantanément',
                    'Couleur de l\'événement = couleur de la catégorie de la tâche, pour repérer vos priorités d\'un coup d\'œil',
                    'Créez, déplacez ou redimensionnez les événements à la souris : la tâche associée se met à jour automatiquement',
                    'Vues jour / semaine / mois avec basculement en un clic et navigation rapide entre les périodes',
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-red-500 to-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/agenda')} className="group bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-lg hover:shadow-red-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Ouvrir l'agenda <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="w-full px-4 lg:px-0" style={{ perspective: 1200, flex: '0 1 55%' }}>
                <motion.div
                  initial={{ rotateY: -48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <AgendaMobileShowcase /> : <AgendaShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 3 : OKR ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-lg shadow-green-500/30">
                  <Target size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">OKR & Objectifs<br /><span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">à la Google</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">La méthode OKR utilisée par Google, Intel et Netflix — maintenant dans votre poche. Définissez des objectifs ambitieux et mesurez chaque résultat clé.</p>
                <div className="space-y-3">
                  {["Définissez des objectifs ambitieux avec des résultats clés chiffrés", "Votre progression est calculée automatiquement", "Visualisez l'avancée de vos objectifs en temps réel", 'Découpez vos objectifs en résultats clés pour passer de "un jour" à "maintenant"'].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/okr')} className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg hover:shadow-green-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Voir les OKRs <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <OKRMobileShowcase /> : <OKRCardShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 4 : Habitudes ── */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: 60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl shadow-lg shadow-yellow-500/30">
                  <Repeat size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Habitudes & Streaks<br /><span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">visualisés en heatmap</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Construisez des routines durables avec un suivi complet. La heatmap 26 semaines révèle vos patterns et récompense votre régularité.</p>
                <div className="space-y-3">
                  {["Mesurez votre régularité grâce au système de tableau de suivi.", "Restez motivé avec le système de série de jours d'affilée (streak)", "Tableau de suivi global : visualisez toutes vos habitudes en un coup d'œil", "Taux de complétion et temps investi : mesurez votre régularité réelle"].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/habits')} className="group bg-gradient-to-r from-yellow-500 to-amber-500 hover:shadow-lg hover:shadow-yellow-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Suivre mes habitudes <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: -48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <HabitMobileShowcase /> : <HabitHeatmapShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 5 : Statistiques ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/30">
                  <BarChart2 size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Statistiques<br /><span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">multi-modules</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Analysez votre temps investi sur tous vos modules — tâches, agenda, OKR, habitudes. Des données précises pour des décisions éclairées.</p>
                <div className="space-y-3">
                  {["Répartition du temps sur tâches, agenda, OKR et habitudes pour une meilleure clarté", "Vues jour, semaine, mois, année — zoomez où vous voulez", "Suivez vos progrès depuis une unique page", "Visualisez votre productivité en un coup d'œil"].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/statistics')} className="group bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg hover:shadow-violet-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Voir mes stats <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-violet-500/20 to-purple-600/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <StatsMobileShowcase /> : (
                      <Suspense fallback={<ShowcaseSkeleton />}>
                        <StatsShowcase />
                      </Suspense>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>

          </div>
        </div>
      </section>
);

export default FeaturesSection;
