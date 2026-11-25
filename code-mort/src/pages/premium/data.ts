// ═══════════════════════════════════════════════════════════════════
// premium/data — données statiques + variants d'animation de PremiumPage.
// Extraits verbatim (god-component refactor). Aucune logique.
// ═══════════════════════════════════════════════════════════════════
import { type Variants } from 'framer-motion';
import { BarChart3, Heart, type LucideIcon } from 'lucide-react';
import type { KeyOf } from '@/i18n/catalog';

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

// ⚠️ Des CLÉS, pas des phrases. Une constante de module qui porte du texte
// traduit fige la langue au premier import : ces deux tableaux sont restés
// entièrement en français alors que la page autour d'eux était traduite.
// La traduction a lieu au rendu, dans `PremiumPage`.
type PremiumKey = KeyOf<'premium'>;

export const features: Array<{ icon: LucideIcon; titleKey: PremiumKey; descriptionKey: PremiumKey }> = [
  { icon: BarChart3, titleKey: 'table.featureStatsTitle', descriptionKey: 'table.featureStatsDesc' },
  { icon: Heart, titleKey: 'table.featureSupportTitle', descriptionKey: 'table.featureSupportDesc' },
];

// Tableau comparatif Gratuit / Pro.
export const COMPARISON_ROWS: Array<{ labelKey: PremiumKey; free: boolean | string; pro: boolean | string }> = [
  { labelKey: 'table.rowTasks', free: true, pro: true },
  { labelKey: 'table.rowHabits', free: true, pro: true },
  { labelKey: 'table.rowAgenda', free: true, pro: true },
  { labelKey: 'table.rowOkr', free: true, pro: true },
  { labelKey: 'table.rowStatsBasic', free: true, pro: true },
  { labelKey: 'table.rowSync', free: true, pro: true },
  { labelKey: 'table.rowDemo', free: true, pro: true },
  { labelKey: 'table.rowCollab', free: true, pro: true },
  { labelKey: 'table.rowStatsAdvanced', free: false, pro: true },
  { labelKey: 'table.rowSupport', free: false, pro: true },
];
