import React from 'react';
import { motion } from 'framer-motion';
import { Repeat, Target, CheckSquare, Calendar, Zap, Award, Leaf } from 'lucide-react';
import { useUser } from '@/modules/user';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useOkrs } from '@/modules/okrs';
import { useEvents } from '@/modules/events';
import DashboardChart from '../components/DashboardChart';
import TodayHabits from '../components/TodayHabits';
import TodayTasks from '../components/TodayTasks';
import CollaborativeTasks from '../components/CollaborativeTasks';
import ActiveOKRs from '../components/ActiveOKRs';
import TextType from '../components/TextType';

const DashboardPage: React.FC = () => {
  // Use new module for tasks (read-only)
  const { data: tasks = [] } = useTasks();
  // Use new module for okrs (read-only)
  const { data: okrs = [] } = useOkrs();
  // Use new module for events (read-only)
  const { data: events = [] } = useEvents();
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { data: habits = [] } = useHabits();

  // Default user for demo mode — prefer real auth user over demo context user
  const displayUser = authUser || user || { id: 'demo', name: 'Utilisateur', email: 'demo@cosmo.app' };

  // Calculer les statistiques du jour
  const today = new Date().toISOString().split('T')[0];
  const todayHabits = habits.filter(habit => habit.completions[today]);
  const todayTasks = tasks.filter(task => 
    !task.completed && 
    new Date(task.deadline).toDateString() === new Date().toDateString()
  );
  
  const totalHabitsTime = todayHabits.reduce((sum, habit) => sum + habit.estimatedTime, 0);
  const totalTasksTime = todayTasks.reduce((sum, task) => sum + task.estimatedTime, 0);
  // Total work time calculated but not displayed in current UI
  void (totalHabitsTime + totalTasksTime);

  const completedTasksToday = tasks.filter(task =>
    task.completed && 
    task.completedAt &&
    new Date(task.completedAt).toDateString() === new Date().toDateString()
  ).length;

    const activeOKRs = okrs.filter(okr => !okr.completed);

    // Calculer les événements d'aujourd'hui
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.start).toDateString();
      return eventDate === new Date().toDateString();
    });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

    const statCards = [
      {
        icon: CheckSquare,
        label: 'Tâches complétées',
        value: completedTasksToday,
        subtitle: "Aujourd'hui",
        color: 'blue'
      },
      {
        icon: Calendar,
        label: 'Agenda',
        value: todayEvents.length,
        subtitle: "Événements aujourd'hui",
        color: 'blue'
      },
      {
        icon: Target,
        label: 'OKR actifs',
        value: activeOKRs.length,
        subtitle: 'En cours',
        color: 'blue'
      },
      {
        icon: Repeat,
        label: 'Habitudes',
        value: todayHabits.length,
        subtitle: 'Réalisées',
        color: 'blue'
      }
    ];

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <motion.div 
        className="max-w-[1600px] mx-auto space-y-6 lg:space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header avec salutation */}
          <motion.div 
            variants={itemVariants}
          >
            <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[rgb(var(--color-text-primary))] mb-2 lg:mb-3">
                  <span>Bonjour, </span>
                <TextType
                        text={displayUser.name}
                        typingSpeed={80}
                        pauseDuration={5000}
                        deletingSpeed={50}
                        loop={false}
                        showCursor={true}
                        cursorCharacter="|"
                        cursorClassName="text-blue-500 monochrome:text-white"
                        textClassName="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-blue-400 dark:via-purple-400 dark:to-blue-400 monochrome:from-white monochrome:via-zinc-300 monochrome:to-white bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                      />
                </h1>
              <motion.p 
                className="text-[rgb(var(--color-text-secondary))] text-base lg:text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Voici votre tableau de bord pour aujourd'hui
              </motion.p>
            </div>
          </motion.div>

        {/* Statistiques rapides */}
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6"
            variants={containerVariants}
          >
                {statCards.map((stat, index) => (
                  <motion.div
                    key={index}
                    className="relative overflow-hidden group cursor-pointer"
                    variants={itemVariants}
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                      <div className="p-5 lg:p-6 h-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl transition-all duration-300 group-hover:shadow-xl group-hover:border-[rgb(var(--color-accent)/0.5)] group-hover:bg-[rgb(var(--color-accent)/0.02)] monochrome:group-hover:border-white/20 monochrome:group-hover:bg-white/[0.02]">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <p className="text-sm text-[rgb(var(--color-text-secondary))] font-bold group-hover:text-[rgb(var(--color-accent))] transition-colors monochrome:group-hover:text-white">
                              {stat.label}
                            </p>
                            <motion.p 
                              className="text-3xl lg:text-4xl font-black text-[rgb(var(--color-text-primary))]"
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: index * 0.1 + 0.2, type: "spring" }}
                            >
                              {stat.value}
                            </motion.p>
                            <p className="text-xs text-[rgb(var(--color-text-muted))] flex items-center gap-1.5 font-medium group-hover:text-[rgb(var(--color-text-secondary))]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent))] monochrome:bg-white" />
                              {stat.subtitle}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-[rgb(var(--color-accent)/0.15)] border border-[rgb(var(--color-accent)/0.3)] group-hover:bg-[rgb(var(--color-accent))] group-hover:text-white transition-all duration-300 monochrome:bg-white/10 monochrome:border-white/20 monochrome:group-hover:bg-white monochrome:group-hover:text-zinc-900">
                          <stat.icon size={22} className="group-hover:text-white transition-colors monochrome:group-hover:text-zinc-900" strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                </motion.div>
              ))}
        </motion.div>

        {/* Contenu principal en grille */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
          variants={containerVariants}
        >
          {/* Colonne gauche - Graphique */}
          <motion.div 
            className="lg:col-span-2"
            variants={itemVariants}
          >
            <DashboardChart />
          </motion.div>
          
          {/* Colonne droite - Habitudes du jour */}
          <motion.div 
            className="lg:col-span-1"
            variants={itemVariants}
          >
            <TodayHabits />
          </motion.div>
        </motion.div>

        {/* Deuxième rangée */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8"
          variants={containerVariants}
        >
          {/* OKR en cours */}
          <motion.div variants={itemVariants}>
            <ActiveOKRs />
          </motion.div>
          
          {/* Mini To-Do List du jour */}
          <motion.div variants={itemVariants}>
            <TodayTasks />
          </motion.div>
        </motion.div>

        {/* Section Tâches collaboratives */}
        <motion.div variants={itemVariants}>
          <CollaborativeTasks />
        </motion.div>

        {/* Floating action button for quick add */}
          <motion.button
            className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 monochrome:from-white monochrome:to-zinc-200 rounded-full shadow-2xl shadow-blue-500/30 dark:shadow-blue-400/20 monochrome:shadow-white/10 flex items-center justify-center text-white monochrome:text-zinc-900 z-50 hover:shadow-blue-500/50 dark:hover:shadow-blue-400/30 monochrome:hover:shadow-white/20 transition-shadow duration-300"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
          >
            <Zap size={24} />
          </motion.button>
      </motion.div>
    </div>
  );
};

export default DashboardPage;

