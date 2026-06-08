// Accordéon d'un item FAQ de la LandingPage — extrait + mémoïsé (rendu en liste).
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FaqItemProps {
  question: string;
  answer: string;
  index: number;
}

const FaqItemBase: React.FC<FaqItemProps> = ({ question, answer, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white group-hover:text-blue-200 transition-colors leading-snug">
          {question}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-slate-400 transition-transform duration-300"
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
            <p className="pb-5 text-sm text-slate-400 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Rendu en liste (10 items) → mémoïsé pour éviter les re-rendus inutiles.
const FaqItem = React.memo(FaqItemBase);

export default FaqItem;
