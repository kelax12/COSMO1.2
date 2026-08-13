import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { TutorialStep } from './types';
import { useT } from '@/i18n/useT';

interface TutorialCardProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  visibleSteps: TutorialStep[];
  accentColor: string;
  /** Couleur du fond du bouton "Suivant" (texte blanc dessus) — AA-safe, peut différer de accentColor. */
  buttonColor: string;
  cardStyle: React.CSSProperties;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const CARD_W = 320;

// Carte info du tutoriel (titre, description, progress dots, navigation).
const TutorialCard: React.FC<TutorialCardProps> = ({
  step,
  stepIndex,
  totalSteps,
  visibleSteps,
  accentColor,
  buttonColor,
  cardStyle,
  onClose,
  onPrev,
  onNext,
}) => {
  const { t } = useT('common');
  const { t: tTut } = useT('tutorials');
  return (
    <motion.div
      key={`card-${stepIndex}`}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 24, stiffness: 320 }}
      className="absolute pointer-events-auto bg-[rgb(var(--color-surface))] rounded-2xl shadow-2xl p-5 border-2"
      style={{
        ...cardStyle,
        width: CARD_W,
        borderColor: accentColor,
      }}
      role="dialog"
      aria-labelledby="tut-card-title"
    >
      {/* Skip button */}
      <button
        onClick={onClose}
        aria-label={t('tutorial.skip')}
        className="absolute top-2 right-2 min-w-touch min-h-touch sm:min-w-9 sm:min-h-9 flex items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{ outlineColor: accentColor }}
      >
        <X size={16} />
      </button>

      <h3
        id="tut-card-title"
        className="text-base sm:text-lg font-bold mb-1 pr-8 text-[rgb(var(--color-text-primary))]"
      >
        {tTut(step.titleKey)}
      </h3>
      <p className="text-sm leading-relaxed text-[rgb(var(--color-text-secondary))]">
        {tTut(step.descriptionKey)}
      </p>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mt-4 mb-3">
        {visibleSteps.map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === stepIndex ? 22 : 7,
              backgroundColor: i === stepIndex ? accentColor : 'rgb(203 213 225)',
            }}
          />
        ))}
        <span className="ml-auto text-xs font-semibold text-[rgb(var(--color-text-muted))]">
          {stepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Boutons */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-lg font-medium text-sm text-[rgb(var(--color-text-secondary))] disabled:opacity-30 hover:bg-[rgb(var(--color-hover))] transition-colors disabled:cursor-not-allowed"
        >
          {t('tutorial.previous')}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-4 min-h-touch sm:min-h-0 sm:py-2 rounded-lg font-bold text-sm text-white shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-transform flex items-center gap-1.5"
          style={{ backgroundColor: buttonColor }}
        >
          {stepIndex === totalSteps - 1 ? t('tutorial.done') : t('tutorial.next')}
          {stepIndex < totalSteps - 1 && <ArrowRight size={14} />}
        </button>
      </div>
    </motion.div>
  );
};

export default TutorialCard;
