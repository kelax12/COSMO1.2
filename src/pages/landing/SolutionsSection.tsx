// Section « Solutions » (use cases) de la LandingPage — extraite verbatim.
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { USE_CASES, ENTRY_OFFSETS } from './data';

interface SolutionsSectionProps {
  handleFeatureClick: (path: string) => void;
}

const SolutionsSection: React.FC<SolutionsSectionProps> = ({ handleFeatureClick }) => (
      <section id="solutions" className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Application productivité pour chaque profil
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Étudiant, professionnel, entrepreneur ou équipe — Cosmo adapte la gestion de tâches, le suivi d'habitudes et les OKR à vos besoins spécifiques
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
);

export default SolutionsSection;
