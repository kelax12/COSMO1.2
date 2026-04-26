import React, { useState } from 'react';
import { useAuth } from '../modules/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Calendar,
  Target,
  Repeat,
  ArrowRight,
  X,
  BarChart2
} from 'lucide-react';
import TaskTableShowcase from '../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../components/showcase/HabitHeatmapShowcase';
import StatsShowcase from '../components/showcase/StatsShowcase';

const USE_CASES = [
  {
    profile: 'Étudiants',
    accent: '#A78BFA',
    title: 'Excellence académique',
    description: "Gérez vos cours, devoirs et révisions avec une planification optimisée qui s'adapte à votre rythme d'apprentissage.",
    features: ['Planning de révisions optimisé', 'Suivi des notes et objectifs', 'Vision globale + réduction du stress'],
    path: '/tasks'
  },
  {
    profile: 'Professionnels',
    accent: '#60A5FA',
    title: 'Performance maximale',
    description: "Boostez votre carrière avec des outils de productivité qui transforment votre façon de travailler et d'atteindre vos objectifs.",
    features: ['Gestion de projets avancée', 'OKR et développement personnel', 'Système de priorisation efficace'],
    path: '/dashboard'
  },
  {
    profile: 'Équipes',
    accent: '#34D399',
    title: 'Collaboration fluide',
    description: "Synchronisez votre équipe avec des outils collaboratifs qui alignent tous les membres sur les mêmes objectifs stratégiques.",
    features: ['Partage de tâches simplifié', 'Communication intégrée', 'Tableaux de bord équipe'],
    path: '/messaging'
  },
  {
    profile: 'Entrepreneurs',
    accent: '#FB923C',
    title: 'Croissance accélérée',
    description: "Pilotez votre startup avec des métriques précises et des automatisations qui vous font gagner un temps précieux.",
    features: ['Organisation multi-projets avancée', 'Délégation et suivi des tâches', 'Planification stratégique intégrée'],
    path: '/okr'
  }
];

const ENTRY_OFFSETS = [
  { x: -400, y: -300, rotate: -15 },
  { x:  400, y: -300, rotate:  15 },
  { x: -400, y:  300, rotate: -15 },
  { x:  400, y:  300, rotate:  15 },
];

const MockLoginModal = ({ isOpen, onClose, mode }: { isOpen: boolean; onClose: () => void; mode: 'login' | 'register' }) => {
  const { login, register, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || 'Email ou mot de passe incorrect.');
        } else {
          navigate('/dashboard');
        }
      } else {
        const result = await register(name || 'Nouvel Utilisateur', email, password);
        if (!result.success) {
          setError(result.error || "Erreur lors de l'inscription");
        } else {
          navigate('/dashboard');
        }
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    loginDemo();
    toast.success('Bienvenue dans la démo !');
    onClose();
    setTimeout(() => navigate('/dashboard'), 0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-800 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-400">Nom</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom" 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@cosmo.app" 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-400">Mot de passe</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : "S'inscrire")}
          </button>

          {mode === 'login' && (
            <button 
              type="button"
              onClick={handleDemoLogin}
              className="w-full bg-slate-700/50 text-slate-300 font-medium py-2 rounded-xl hover:bg-slate-700 transition-all border border-slate-600"
            >
              Mode Démo (Connexion rapide)
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginDemo } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleFeatureClick = (path: string) => {
    loginDemo();
    navigate(path);
  };

  const handleLoginClick = () => {
    setLoginMode('login');
    setShowLoginModal(true);
  };

  const handleRegisterClick = () => {
    setLoginMode('register');
    setShowLoginModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden scroll-smooth">
      <AnimatePresence>
        {showLoginModal && (
          <MockLoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} mode={loginMode} />
        )}
      </AnimatePresence>

      <header className="relative z-50 bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              <div className="relative group">
                <div className="w-10 h-10 overflow-hidden rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform group-hover:scale-105">
                  <img src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/b4ddfaeb-2a04-4c84-84c7-5a56cde957c5/image-1767984831202.png?width=8000&height=8000&resize=contain" alt="Cosmo" className="w-full h-full object-contain bg-white/10" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-lg opacity-30 animate-pulse"></div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Cosmo
              </span>
            </div>

            <nav className="hidden md:flex items-center justify-between w-80 lg:w-96 xl:w-[28rem]">
              <a href="#features" className="text-slate-300 hover:text-white font-medium transition-all duration-200 hover:scale-105 transform text-sm lg:text-base whitespace-nowrap">
                Fonctionnalités
              </a>
              <a href="#solutions" className="text-slate-300 hover:text-white font-medium transition-all duration-200 hover:scale-105 transform text-sm lg:text-base whitespace-nowrap">
                Solutions
              </a>
              <a href="#why" className="text-slate-300 hover:text-white font-medium transition-all duration-200 hover:scale-105 transform text-sm lg:text-base whitespace-nowrap">
                Pourquoi Cosmo
              </a>
            </nav>

            <div className="flex items-center gap-3 lg:gap-4">
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 text-slate-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
              
              <button
                onClick={handleLoginClick}
                className="hidden sm:block text-slate-300 hover:text-white font-medium transition-colors text-sm lg:text-base whitespace-nowrap"
              >
                Se connecter
              </button>
              <button
                onClick={handleRegisterClick}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2.5 lg:px-6 lg:py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform text-sm lg:text-base whitespace-nowrap"
              >
                <span className="lg:hidden">Commencer</span>
                <span className="hidden lg:inline">Commencer gratuitement</span>
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {showMobileMenu && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden mt-4 pt-4 border-t border-white/10 overflow-hidden"
              >
                <nav className="flex flex-col space-y-3 pb-4">
                  <a href="#features" onClick={() => setShowMobileMenu(false)} className="text-slate-300 hover:text-white font-medium transition-colors py-2">
                    Fonctionnalités
                  </a>
                  <a href="#solutions" onClick={() => setShowMobileMenu(false)} className="text-slate-300 hover:text-white font-medium transition-colors py-2">
                    Solutions
                  </a>
                  <a href="#why" onClick={() => setShowMobileMenu(false)} className="text-slate-300 hover:text-white font-medium transition-colors py-2">
                    Pourquoi Cosmo
                  </a>
                  <button
                    onClick={() => { handleLoginClick(); setShowMobileMenu(false); }}
                    className="text-slate-300 hover:text-white font-medium transition-colors py-2 text-left"
                  >
                    Se connecter
                  </button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-5xl lg:text-7xl font-bold mb-8 leading-tight"
            >
              <span className="bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                Une seule application
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                pour tout organiser
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl lg:text-2xl text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed"
            >
              Révolutionnez votre productivité avec une organisation optimisée. Gérez vos tâches, agenda, objectifs et habitudes 
              dans un écosystème unifié qui s'adapte à votre rythme.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <button
                onClick={() => {
                  loginDemo();
                  setTimeout(() => navigate('/dashboard'), 0);
                }}
                className="group bg-slate-200 hover:bg-slate-300 text-slate-900 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform flex items-center justify-center gap-3"
              >
                Essayer la démo
              </button>
              <button
                onClick={handleRegisterClick}
                className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center"
              >
                Commencer gratuitement
              </button>
            </motion.div>

          </div>
        </div>
      </section>

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
                Voyez l'application
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                en action
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-400 max-w-3xl mx-auto"
            >
              Chaque module est conçu pour être puissant et intuitif — voici un aperçu réel de l'interface
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
                  {['Filtrez par priorité, catégorie, deadline en un clic', 'Ajoutez des catégories pour visualiser votre travail en un coup d oeil', 'Créez des listes de tâches pour mieux vous organiser', 'Partagez vos tâches en équipe'].map((b, i) => (
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
                    <TaskTableShowcase />
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
                    <AgendaShowcase />
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
                  {['Définissez des objectifs ambitieux avec des résultats clés chiffrés', 'Votre progression est calculée automatiquement', 'Visualisez l avancée de vos objectifs', 'Découpez vos objectifs en résultats clés pour passer de "un jour" à "maintenant" '].map((b, i) => (
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
                    <OKRCardShowcase />
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
                  {['Mesurez votre régularité grace au système de tableau de suivi.', 'Restez motivé avec le système de série de jour d affilé', 'Tableau de suivi global pour visualiser votre régularité sur toutes vos habitudes en une fois', 'Taux de complétion et temps investi : mesurez votre régularité réelle'].map((b, i) => (
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
                    <HabitHeatmapShowcase />
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
                  {['Répartition du temps sur tâches, agenda, OKR et habitudes pour une meilleure clareté', 'Vues jour, semaine, mois, année — zoomez où vous voulez', 'Suivez vas progrés depuis une unique page', 'Visualisez votre productivité en un coup d oeil'].map((b, i) => (
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
                    <StatsShowcase />
                  </div>
                </motion.div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="solutions" className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Solutions pour chaque profil
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Que vous soyez étudiant, professionnel, entrepreneur ou que vous dirigiez une équipe, 
              Cosmo s'adapte parfaitement à vos besoins spécifiques
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {USE_CASES.map((useCase, index) => {
              const num = String(index + 1).padStart(2, '0');
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.6, ...ENTRY_OFFSETS[index] }}
                  whileInView={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{
                    type: 'spring',
                    stiffness: 65,
                    damping: 14,
                    mass: 1,
                    delay: 0.1 + index * 0.05,
                  }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden p-8 lg:p-10"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                  }}
                >
                  {/* Top hairline accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px transition-all duration-500 group-hover:h-[3px]"
                    style={{ backgroundColor: useCase.accent, opacity: 0.6 }}
                  />

                  {/* Watermark index */}
                  <div
                    className="absolute -top-2 -right-2 select-none pointer-events-none font-bold tabular-nums leading-none transition-colors duration-500"
                    style={{
                      fontSize: '8rem',
                      color: 'rgba(148, 163, 184, 0.06)',
                      letterSpacing: '-0.05em',
                    }}
                  >
                    {num}
                  </div>

                  {/* Kicker row */}
                  <div className="relative flex items-baseline gap-3 mb-6">
                    <span
                      className="text-xs font-mono tabular-nums tracking-widest"
                      style={{ color: useCase.accent }}
                    >
                      {num}
                    </span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: useCase.accent }}
                    >
                      {useCase.profile}
                    </span>
                    <span
                      className="flex-1 h-px"
                      style={{ backgroundColor: useCase.accent, opacity: 0.25 }}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="relative text-3xl lg:text-4xl font-semibold text-white mb-5 leading-[1.1] tracking-tight">
                    {useCase.title}
                  </h3>

                  {/* Description */}
                  <p className="relative text-base text-slate-400 leading-relaxed mb-8 max-w-md">
                    {useCase.description}
                  </p>

                  {/* Features as em-dash list */}
                  <ul className="relative space-y-2.5 mb-10">
                    {useCase.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed"
                      >
                        <span
                          className="select-none mt-[2px]"
                          style={{ color: useCase.accent }}
                        >
                          —
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Editorial link */}
                  <button
                    onClick={() => handleFeatureClick(useCase.path)}
                    className="relative inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-all duration-300 hover:gap-3"
                    style={{ color: useCase.accent }}
                  >
                    En savoir plus
                    <ArrowRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="why" className="py-24 bg-black/20 backdrop-blur-xl relative overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-xs font-mono tracking-[0.3em] uppercase text-blue-400 mb-5 block">
              — Ce qui change tout —
            </span>
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-[1.05] tracking-tight">
              <span className="text-white">Pas une app de plus.</span>
              <br />
              <span className="text-slate-500">Un système connecté.</span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Là où les autres apps font une chose, Cosmo fait dialoguer vos tâches, votre agenda,
              vos objectifs et vos habitudes. Une seule boucle, plus de copier-coller mental.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(220px,auto)]">

            {/* HERO 1 — Time blocking (col-span-4) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.05 }}
              whileHover={{ y: -3 }}
              className="md:col-span-4 md:row-span-2 relative overflow-hidden p-8 lg:p-10 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-blue-400/40 group-hover:h-[3px] transition-all duration-500" />

              {/* Mini agenda visual */}
              <div className="absolute bottom-0 right-0 w-[70%] h-[55%] opacity-90 pointer-events-none" style={{ maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <div className="absolute inset-4 grid grid-cols-5 grid-rows-6 gap-[2px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="border border-white/[0.04] rounded-[2px]" />
                  ))}
                  {/* Existing event */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white/90 px-1.5 py-1"
                    style={{
                      backgroundColor: '#8B5CF6',
                      left: '20%',
                      top: '16.66%',
                      width: '20%',
                      height: '33%',
                    }}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                  >
                    Réunion
                  </motion.div>
                  {/* Dropped task */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white px-1.5 py-1 shadow-2xl"
                    style={{
                      backgroundColor: '#F97316',
                      left: '60%',
                      top: '50%',
                      width: '20%',
                      height: '25%',
                    }}
                    initial={{ opacity: 0, x: -200, y: -120, scale: 1.1 }}
                    whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.8 }}
                  >
                    Pitch deck
                  </motion.div>
                </div>
              </div>

              <div className="relative z-10 max-w-md">
                <span className="text-[10px] font-mono tracking-[0.25em] text-blue-400 uppercase">// 01 · Time blocking</span>
                <h3 className="text-3xl lg:text-4xl font-semibold text-white mt-4 mb-4 leading-[1.1] tracking-tight">
                  Glissez. Bloquez.<br />Avancez.
                </h3>
                <p className="text-slate-400 leading-relaxed text-base">
                  Glissez une tâche dans votre calendrier — l'événement se crée, la tâche reste liée.
                  Plus de double saisie, plus de blocs orphelins. Votre planification devient une vraie
                  intention de temps.
                </p>
              </div>
            </motion.div>

            {/* TILE — Heatmap (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.15 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-amber-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">// 02 · Discipline</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Vos habitudes,<br />sur 26 semaines.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Une case par jour. Un streak par victoire. Le pattern se révèle tout seul.
              </p>
              {/* Mini heatmap */}
              <div className="flex gap-[3px]">
                {Array.from({ length: 14 }).map((_, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, d) => {
                      const seed = (w * 7 + d) * 9301 + 49297;
                      const r = ((seed % 233280) / 233280);
                      const intensity = r > 0.55 ? (r > 0.85 ? 1 : r > 0.7 ? 0.7 : 0.4) : 0;
                      return (
                        <div
                          key={d}
                          className="w-2.5 h-2.5 rounded-[2px]"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(245, 158, 11, ${intensity})`
                              : 'rgba(255,255,255,0.05)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — OKR (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.25 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-emerald-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-emerald-400 uppercase">// 03 · OKR</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                La méthode Google,<br />sans le tableur.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Objectifs ambitieux, résultats clés mesurables. La progression se calcule pendant que vous travaillez.
              </p>
              {/* Mini circular progress */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="transform -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                    <motion.circle
                      cx="32" cy="32" r="26"
                      stroke="#34D399" strokeWidth="6" fill="none" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                      whileInView={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.68) }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">68%</div>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">3 200 / 10 000 users</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">NPS 38 → 50</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">Rétention 71%</span></div>
                </div>
              </div>
            </motion.div>

            {/* HERO 2 — Stats consolidées (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-violet-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-violet-400 uppercase">// 04 · Vue consolidée</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Où passe votre temps ?
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-md">
                Tâches, agenda, OKR, habitudes — tout converge dans une seule vue.
                Vous arrêtez de deviner. Vous voyez.
              </p>
              {/* Mini bar chart */}
              <div className="flex items-end gap-2 h-20">
                {[
                  { label: 'Tâches', h: 75, c: '#3B82F6' },
                  { label: 'Agenda', h: 95, c: '#EF4444' },
                  { label: 'OKR', h: 55, c: '#10B981' },
                  { label: 'Habitudes', h: 70, c: '#F59E0B' },
                  { label: 'Lecture', h: 35, c: '#8B5CF6' },
                  { label: 'Autres', h: 25, c: '#64748B' },
                ].map((bar, i) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <motion.div
                      className="w-full rounded-t-sm origin-bottom"
                      style={{ backgroundColor: bar.c }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${bar.h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + i * 0.07 }}
                    />
                    <span className="text-[9px] text-slate-500 tracking-wider truncate w-full text-center">{bar.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — Mode démo (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.45 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-cyan-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase">// 05 · Zéro friction</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Pas d'inscription.<br />Juste essayer.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-md">
                Un mode démo pré-rempli avec 12 mois de données réalistes. Vous testez
                le vrai Cosmo, pas une vidéo. Pas un email demandé.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ backgroundColor: 'rgba(34, 211, 238, 0.08)', color: '#67E8F9', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  100 tâches · 100 habitudes · 150 events
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 to-purple-500/5 z-0"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Prêt à révolutionner
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  votre productivité ?
                </span>
              </h2>
              <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                Rejoignez des milliers de professionnels qui ont déjà transformé leur façon de travailler avec Cosmo
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    loginDemo();
                    setTimeout(() => navigate('/dashboard'), 0);
                  }}
                  className="group bg-slate-200 hover:bg-slate-300 text-slate-900 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform flex items-center justify-center gap-3"
                >
                  Essayer la démo
                </button>
                <button
                  onClick={handleRegisterClick}
                  className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center"
                >
                  Commencer maintenant
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="bg-black/40 backdrop-blur-xl border-t border-white/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 overflow-hidden rounded-xl flex items-center justify-center">
                  <img src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/b4ddfaeb-2a04-4c84-84c7-5a56cde957c5/image-1767984831202.png?width=8000&height=8000&resize=contain" alt="Cosmo" className="w-full h-full object-contain bg-white/10" />
                </div>
                <span className="text-2xl font-bold text-white">Cosmo</span>
              </div>
              <p className="text-slate-400">
                La plateforme de productivité nouvelle génération qui transforme votre façon de travailler.
              </p>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Produit</h3>
              <div className="space-y-2">
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Fonctionnalités</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Intégrations</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">API</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Sécurité</a>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Support</h3>
              <div className="space-y-2">
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Centre d'aide</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Contact</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Statut</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Communauté</a>
              </div>
            </div>
            
            <div>
              <h3 className="text-white font-bold mb-4">Entreprise</h3>
              <div className="space-y-2">
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">À propos</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Carrières</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Presse</a>
                <a href="#" className="block text-slate-400 hover:text-white transition-colors">Partenaires</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-slate-400 text-sm mb-4 md:mb-0">
              © 2025 Cosmo. Tous droits réservés.
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">Conditions</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
