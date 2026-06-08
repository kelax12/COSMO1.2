// Section FAQ de la LandingPage — extraite verbatim.
import React from 'react';
import { motion } from 'framer-motion';
import { FAQ_ITEMS } from './data';
import FaqItem from './FaqItem';

const FaqSection: React.FC = () => (
      <section id="faq" className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xs font-mono tracking-[0.3em] uppercase text-blue-400 mb-4 block"
            >
              — Questions fréquentes —
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl lg:text-4xl font-bold text-white mb-4"
            >
              Tout ce que vous voulez savoir
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                sur Cosmo
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-slate-400 text-lg"
            >
              Méthode OKR, habitudes, time-blocking, mode démo, sécurité... on répond à tout.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/60 border border-white/8 rounded-2xl px-6 sm:px-8"
          >
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} question={item.question} answer={item.answer} index={i} />
            ))}
          </motion.div>

          <p className="text-center text-slate-500 text-sm mt-8">
            Une question non listée ?{' '}
            <a
              href="mailto:contact@cosmo.app"
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              Écrivez-nous
            </a>
          </p>
        </div>
      </section>
);

export default FaqSection;
