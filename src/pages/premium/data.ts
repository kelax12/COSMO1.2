// ═══════════════════════════════════════════════════════════════════
// premium/data — données statiques + variants d'animation de PremiumPage.
// Extraits verbatim (god-component refactor). Aucune logique.
// ═══════════════════════════════════════════════════════════════════
import { type Variants } from 'framer-motion';
import { BarChart3, Sparkles, type LucideIcon } from 'lucide-react';

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

export const features: Array<{ icon: LucideIcon; title: string; description: string }> = [
  {
    icon: Sparkles,
    title: 'Habitudes sans publicité',
    description: 'Accédez à vos habitudes sans la pub quotidienne',
  },
  {
    icon: BarChart3,
    title: 'Statistiques avancées',
    description: 'Analyses détaillées, heatmaps et tendances',
  },
];

// Tableau comparatif Gratuit / Pro.
export const COMPARISON_ROWS: Array<{ label: string; free: boolean | string; pro: boolean | string }> = [
  { label: 'Tâches illimitées', free: true, pro: true },
  { label: 'Habitudes illimitées', free: true, pro: true },
  { label: 'Agenda & événements', free: true, pro: true },
  { label: 'OKR & Key Results', free: true, pro: true },
  { label: 'Statistiques de base', free: true, pro: true },
  { label: 'Sync multi-appareils', free: true, pro: true },
  { label: 'Mode démo', free: true, pro: true },
  { label: 'Collaboration & partage de tâches', free: true, pro: true },
  { label: 'Habitudes sans pub quotidienne', free: false, pro: true },
  { label: 'Statistiques avancées', free: false, pro: true },
  { label: 'Sans publicité', free: false, pro: true },
  { label: 'Support prioritaire', free: false, pro: true },
];
