// ═══════════════════════════════════════════════════════════════════
// La durée estimée, au pas de 5 minutes (mobile)
//
// FRONTIÈRE : un nombre de minutes, deux boutons, un rappel. Ce composant ne
// sait pas ce qu'il mesure — ni tâche, ni formulaire, ni modale.
//
// ⚠️ Les deux `aria-label` étaient écrits EN DUR en français, alors que les
// clés existaient déjà (`fields.decrease5` / `fields.increase5`) : un
// lecteur d'écran anglophone entendait « Diminuer de 5 minutes ». Corrigé
// en passant ici.
//
// Le petit rebond vertical du chiffre indique le SENS du changement (+ ou −)
// quand on appuie vite : sans lui, deux appuis rapprochés sur des boutons
// voisins donnent le même retour visuel.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface DurationStepperProps {
  /** Minutes. `0` (ou une saisie vide) s'affiche « · ». */
  value: number | string;
  onChange: (minutes: number) => void;
  label: string;
}

const STEP = 5;
const BUTTON_CLASS =
  'w-7 h-7 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center text-[rgb(var(--color-text-secondary))]';

const DurationStepper = ({ value, onChange, label }: DurationStepperProps) => {
  const { t } = useT('taskModal');
  const [direction, setDirection] = useState<1 | -1 | 0>(0);

  const step = (delta: 1 | -1) => {
    const current = typeof value === 'number' ? value : 0;
    onChange(Math.max(0, current + delta * STEP));
    setDirection(delta);
    setTimeout(() => setDirection(0), 80);
  };

  return (
    <div className="flex items-center justify-between px-4 min-h-11">
      <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => step(-1)} className={BUTTON_CLASS} aria-label={t('fields.decrease5')}>
          <Minus size={14} />
        </button>
        <motion.span
          key={String(value)}
          initial={{ y: direction * -4, opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.08 }}
          className="text-[15px] text-blue-500 w-16 text-center"
        >
          {value ? `${value} min` : '·'}
        </motion.span>
        <button type="button" onClick={() => step(1)} className={BUTTON_CLASS} aria-label={t('fields.increase5')}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

export default DurationStepper;
