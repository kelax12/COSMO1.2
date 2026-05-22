import { RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  pullY: number;
  isRefreshing: boolean;
  threshold: number;
}

/**
 * Indicateur visuel de pull-to-refresh. À placer au plus haut niveau d'une page
 * mobile (juste sous le tab bar/safe-area top). Position fixed top, ne pousse
 * pas le contenu.
 */
export function PullToRefreshIndicator({ pullY, isRefreshing, threshold }: Props) {
  if (pullY === 0 && !isRefreshing) return null;
  const progress = Math.min(pullY / threshold, 1);
  const ready = progress >= 1;

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-40 pointer-events-none flex justify-center"
      initial={false}
      animate={{ y: isRefreshing ? 16 : Math.min(pullY - 32, 56) }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      aria-hidden
    >
      <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-full shadow-lg w-10 h-10 flex items-center justify-center">
        <RefreshCw
          size={18}
          className={`text-[rgb(var(--color-accent))] transition-transform ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            opacity: ready || isRefreshing ? 1 : 0.5 + progress * 0.5,
          }}
        />
      </div>
    </motion.div>
  );
}

export default PullToRefreshIndicator;
