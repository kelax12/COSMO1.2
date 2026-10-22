// Accordéon d'un item FAQ de la LandingPage — extrait + mémoïsé (rendu en liste).
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FaqItemProps {
  question: string;
  answer: string;
  index: number;
  /** DA du parcours porteur — `light` (perso, défaut) ou `dark` (entreprise). */
  theme?: 'light' | 'dark';
}

const FaqItemBase: React.FC<FaqItemProps> = ({ question, answer, index, theme = 'light' }) => {
  const [open, setOpen] = useState(false);
  const isDark = theme === 'dark';
  return (
    <div className={isDark ? 'border-b border-white/[0.08] last:border-0' : 'border-b border-slate-200 last:border-0'}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span
          className={
            isDark
              ? 'text-base font-medium text-white group-hover:text-[#22D3EE] transition-colors leading-snug'
              : 'text-base font-medium text-slate-900 group-hover:text-blue-700 transition-colors leading-snug'
          }
        >
          {question}
        </span>
        <ChevronDown
          size={18}
          className={isDark ? 'shrink-0 text-white/50 transition-transform duration-300' : 'shrink-0 text-slate-500 transition-transform duration-300'}
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={`faq-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className={isDark ? 'pb-5 text-sm text-white/70 leading-relaxed' : 'pb-5 text-sm text-slate-600 leading-relaxed'}>
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Rendu en liste (10 items) → mémoïsé pour éviter les re-rendus inutiles.
const FaqItem = React.memo(FaqItemBase);

export default FaqItem;
