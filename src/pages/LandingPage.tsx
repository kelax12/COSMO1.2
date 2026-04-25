import React, { useState, useEffect } from 'react';
import { useAuth } from '../modules/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Calendar,
  Target,
  Zap,
  Users,
  Shield,
  Globe,
  Star,
  Sparkles,
  ChevronRight,
  Rocket,
  ArrowRight,
  X,
  Brain,
  Workflow,
  Database,
  Layers,
  Infinity as InfinityIcon,
  BarChart2,
  Eye
} from 'lucide-react';
import TaskTableShowcase from '../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../components/showcase/HabitHeatmapShowcase';
import StatsShowcase from '../components/showcase/StatsShowcase';

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'Product Manager chez Meta',
    company: 'Meta',
    content: "Cosmo a révolutionné notre façon de gérer les projets. L'interface intuitive nous fait gagner 40% de temps sur la planification.",
    rating: 5,
    avatar: '👩‍💼'
  },
  {
    name: 'Marcus Rodriguez',
    role: 'CEO & Founder',
    company: 'TechStart Inc.',
    content: "Impossible de revenir en arrière après Cosmo. L'intégration OKR nous a permis d'aligner toute l'équipe sur nos objectifs stratégiques.",
    rating: 5,
    avatar: '👨‍💻'
  },
  {
    name: 'Dr. Emily Watson',
    role: 'Directrice R&D',
    company: 'BioTech Labs',
    content: "La gestion des habitudes de Cosmo m'a aidée à maintenir un équilibre parfait entre recherche intensive et bien-être personnel.",
    rating: 5,
    avatar: '👩‍🔬'
  },
  {
    name: 'Alex Thompson',
    role: 'Lead Developer',
    company: 'Microsoft',
    content: "Les fonctionnalités de Cosmo s'adaptent parfaitement à nos sprints agiles. Un game-changer pour notre productivité.",
    rating: 5,
    avatar: '👨‍💼'
  }
];

const USE_CASES = [
  {
    profile: 'Étudiants',
    icon: '🎓',
    title: 'Excellence académique',
    description: "Gérez vos cours, devoirs et révisions avec une planification optimisée qui s'adapte à votre rythme d'apprentissage.",
    features: ['Planning de révisions optimisé', 'Suivi des notes et objectifs', 'Vision globale + réduction du stress'],
    path: '/tasks'
  },
  {
    profile: 'Professionnels',
    icon: '💼',
    title: 'Performance maximale',
    description: "Boostez votre carrière avec des outils de productivité qui transforment votre façon de travailler et d'atteindre vos objectifs.",
    features: ['Gestion de projets avancée', 'OKR et développement personnel', 'Système de priorisation efficace'],
    path: '/dashboard'
  },
  {
    profile: 'Équipes',
    icon: '👥',
    title: 'Collaboration fluide',
    description: "Synchronisez votre équipe avec des outils collaboratifs qui alignent tous les membres sur les mêmes objectifs stratégiques.",
    features: ['Partage de tâches simplifié', 'Communication intégrée', 'Tableaux de bord équipe'],
    path: '/messaging'
  },
  {
    profile: 'Entrepreneurs',
    icon: '🚀',
    title: 'Croissance accélérée',
    description: "Pilotez votre startup avec des métriques précises et des automatisations qui vous font gagner un temps précieux.",
    features: ['Organisation multi-projets avancée', 'Délégation et suivi des tâches', 'Planification stratégique intégrée'],
    path: '/okr'
  }
];

const ADVANCED_FEATURES = [
  {
    icon: Brain,
    title: 'Organisation avancée',
    description: "Système de catégorisation et de priorisation avancé qui vous aide à structurer vos tâches et projets efficacement"
  },
  {
    icon: Workflow,
    title: 'Adaptable à tous vos besoins',
    description: "Que ce soit pour gérer vos projets personnels, organiser vos études, suivre vos objectifs professionnels ou planifier vos loisirs, Cosmo s'adapte à votre style de vie"
  },
  {
    icon: Database,
    title: 'Synchronisation multi-appareils',
    description: "Accédez à vos données depuis n'importe quel appareil avec une synchronisation en temps réel et hors ligne"
  },
  {
    icon: Layers,
    title: 'Vues personnalisables',
    description: "Liste, Kanban, Calendrier, Gantt, Timeline - adaptez l'interface à votre style de travail unique"
  },
  {
    icon: Shield,
    title: 'Sauvegarde automatique',
    description: "Vos données sont automatiquement sauvegardées et protégées contre toute perte accidentelle"
  },
  {
    icon: InfinityIcon,
    title: 'Collaboration simplifiée',
    description: "Partagez vos projets et collaborez facilement avec votre équipe grâce aux fonctionnalités de partage intégrées"
  }
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
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [userCount, setUserCount] = useState(12847);

  useEffect(() => {
    const interval = setInterval(() => {
      setUserCount(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const stats = [
    { number: userCount.toLocaleString(), label: 'Utilisateurs actifs', icon: Users },
    { number: '99.9%', label: 'Uptime garanti', icon: Shield },
    { number: '150+', label: 'Pays utilisateurs', icon: Globe },
    { number: '4.9/5', label: 'Note moyenne', icon: Star }
  ];

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
              <a href="#testimonials" className="text-slate-300 hover:text-white font-medium transition-all duration-200 hover:scale-105 transform text-sm lg:text-base whitespace-nowrap">
                Témoignages
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
                  <a href="#testimonials" onClick={() => setShowMobileMenu(false)} className="text-slate-300 hover:text-white font-medium transition-colors py-2">
                    Témoignages
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
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-xl border border-blue-500/30 rounded-full px-4 py-2 mb-8 cursor-default hover:bg-white/5 transition-colors"
            >
              <Sparkles size={16} className="text-blue-400" />
              <span className="text-sm font-medium text-blue-200">Nouveau : Organisation avancée intégrée</span>
              <ChevronRight size={14} className="text-blue-400" />
            </motion.div>

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
              className="flex flex-col sm:flex-row gap-6 justify-center mb-16"
            >
              <button
                onClick={handleRegisterClick}
                className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center gap-3"
              >
                <Rocket size={24} />
                Commencer gratuitement
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-8 text-slate-400"
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['👨‍💼', '👩‍💻', '👨‍🎓', '👩‍🔬'].map((avatar, i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm border-2 border-slate-800">
                      {avatar}
                    </div>
                  ))}
                </div>
                <span className="font-medium">
                  Déjà adopté par <span className="text-blue-400 font-bold">{userCount.toLocaleString()}+</span> utilisateurs
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} className="text-yellow-400 fill-current" />
                ))}
                <span className="ml-2 font-medium">4.9/5 sur toutes les plateformes</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-black/20 backdrop-blur-xl border-y border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center group"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon size={24} className="text-blue-400" />
                </div>
                <div className="text-3xl lg:text-4xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-slate-400 font-medium">{stat.label}</div>
              </motion.div>
            ))}
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-blue-600/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      <Eye size={11} /> Aperçu live
                    </div>
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      <Eye size={11} /> Aperçu live
                    </div>
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-green-600/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      <Eye size={11} /> Aperçu live
                    </div>
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
                  <Zap size={28} className="text-white" />
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-amber-500/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      <Eye size={11} />
                    </div>
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-violet-600/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
                      <Eye size={11} /> Aperçu live
                    </div>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {USE_CASES.map((useCase, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                className="group bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-slate-700/80 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10"
              >
                <div className="flex flex-col items-center gap-4 mb-6 text-center">
                  <div className="text-5xl mb-2">{useCase.icon}</div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{useCase.profile}</h3>
                    <p className="text-blue-400 font-semibold">{useCase.title}</p>
                  </div>
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed text-center">{useCase.description}</p>
                <div className="space-y-3 mb-8 flex flex-col items-center">
                  {useCase.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                      <span className="text-slate-300 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleFeatureClick(useCase.path)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  En savoir plus
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform text-blue-400" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Ils transforment leur productivité
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Découvrez comment les leaders de l'industrie utilisent Cosmo pour atteindre leurs objectifs les plus ambitieux
            </p>
          </div>

          <div className="relative">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center overflow-hidden min-h-[400px] flex flex-col justify-center">
              <div className="flex justify-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={24} className="text-yellow-400 fill-current" />
                ))}
              </div>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTestimonial}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                >
                  <blockquote className="text-2xl lg:text-3xl font-medium text-white mb-8 leading-relaxed">
                    "{TESTIMONIALS[currentTestimonial].content}"
                  </blockquote>
                  
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-4xl bg-white/10 p-2 rounded-full w-16 h-16 flex items-center justify-center">{TESTIMONIALS[currentTestimonial].avatar}</div>
                    <div className="text-left">
                      <div className="text-xl font-bold text-white">{TESTIMONIALS[currentTestimonial].name}</div>
                      <div className="text-blue-400 font-semibold">{TESTIMONIALS[currentTestimonial].role}</div>
                      <div className="text-slate-400">{TESTIMONIALS[currentTestimonial].company}</div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex justify-center gap-2 mt-8">
              {TESTIMONIALS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentTestimonial 
                      ? 'bg-blue-500 w-8' 
                      : 'bg-white/20 hover:bg-white/40 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Technologies de pointe
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Conçu pour l'entreprise moderne, Cosmo intègre les dernières innovations technologiques
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ADVANCED_FEATURES.map((feature, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="group bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 hover:bg-slate-700/80 transition-all duration-300 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                  <feature.icon size={32} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-slate-300 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
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
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleRegisterClick}
                  className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-5 rounded-2xl font-bold text-lg transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center gap-3"
                >
                  <Rocket size={24} />
                  Commencer maintenant
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
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
