// Section « Pourquoi » (bento grid) de la LandingPage — extraite verbatim.
import React from 'react';
import { motion } from 'framer-motion';

const WhySection: React.FC = () => (
      <section id="why" className="py-24 bg-black/20 backdrop-blur-xl relative overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-xs font-mono tracking-[0.3em] uppercase text-blue-400 mb-5 block">
              — Ce qui change tout —
            </span>
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-[1.05] tracking-tight">
              <span className="text-white">Pas une app de plus.</span>
              <br />
              <span className="text-slate-500">Un système connecté.</span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Là où les autres apps font une chose, Cosmo fait dialoguer vos tâches, votre agenda,
              vos objectifs et vos habitudes. Une seule boucle, plus de copier-coller mental.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(220px,auto)]">

            {/* HERO 1 — Time blocking (col-span-4) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.05 }}
              whileHover={{ y: -3 }}
              className="md:col-span-4 md:row-span-2 relative overflow-hidden p-8 lg:p-10 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-blue-400/40 group-hover:h-[3px] transition-all duration-500" />

              {/* Mini agenda visual */}
              <div className="absolute bottom-0 right-0 w-[70%] h-[55%] opacity-90 pointer-events-none" style={{ maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <div className="absolute inset-4 grid grid-cols-5 grid-rows-6 gap-[2px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="border border-white/[0.04] rounded-[2px]" />
                  ))}
                  {/* Existing event */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white/90 px-1.5 py-1"
                    style={{
                      backgroundColor: '#8B5CF6',
                      left: '20%',
                      top: '16.66%',
                      width: '20%',
                      height: '33%',
                    }}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                  >
                    Réunion
                  </motion.div>
                  {/* Dropped task */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white px-1.5 py-1 shadow-2xl"
                    style={{
                      backgroundColor: '#F97316',
                      left: '60%',
                      top: '50%',
                      width: '20%',
                      height: '25%',
                    }}
                    initial={{ opacity: 0, x: -200, y: -120, scale: 1.1 }}
                    whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.8 }}
                  >
                    Pitch deck
                  </motion.div>
                </div>
              </div>

              <div className="relative z-10 max-w-md">
                <span className="text-[10px] font-mono tracking-[0.25em] text-blue-400 uppercase">// 01 · Time blocking</span>
                <h3 className="text-3xl lg:text-4xl font-semibold text-white mt-4 mb-4 leading-[1.1] tracking-tight">
                  Glissez. Bloquez.<br />Avancez.
                </h3>
                <p className="text-slate-400 leading-relaxed text-base">
                  Glissez une tâche dans votre calendrier — l'événement se crée, la tâche reste liée.
                  Plus de double saisie, plus de blocs orphelins. Votre planification devient une vraie
                  intention de temps.
                </p>
              </div>
            </motion.div>

            {/* TILE — Heatmap (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.15 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-amber-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">// 02 · Discipline</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Vos habitudes,<br />sur 26 semaines.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Une case par jour. Un streak par victoire. Le pattern se révèle tout seul.
              </p>
              {/* Mini heatmap */}
              <div className="flex gap-[3px]">
                {Array.from({ length: 14 }).map((_, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, d) => {
                      const seed = (w * 7 + d) * 9301 + 49297;
                      const r = ((seed % 233280) / 233280);
                      const intensity = r > 0.55 ? (r > 0.85 ? 1 : r > 0.7 ? 0.7 : 0.4) : 0;
                      return (
                        <div
                          key={d}
                          className="w-2.5 h-2.5 rounded-[2px]"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(245, 158, 11, ${intensity})`
                              : 'rgba(255,255,255,0.05)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — OKR (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.25 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-emerald-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-emerald-400 uppercase">// 03 · OKR</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                La méthode Google,<br />sans le tableur.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Objectifs ambitieux, résultats clés mesurables. La progression se calcule pendant que vous travaillez.
              </p>
              {/* Mini circular progress */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="transform -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                    <motion.circle
                      cx="32" cy="32" r="26"
                      stroke="#34D399" strokeWidth="6" fill="none" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                      whileInView={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.68) }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">68%</div>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">3 200 / 10 000 users</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">NPS 38 → 50</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">Rétention 71%</span></div>
                </div>
              </div>
            </motion.div>

            {/* HERO 2 — Stats consolidées (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-violet-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-violet-400 uppercase">// 04 · Vue consolidée</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Où passe votre temps ?
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-md">
                Tâches, agenda, OKR, habitudes — tout converge dans une seule vue.
                Vous arrêtez de deviner. Vous voyez.
              </p>
              {/* Mini bar chart */}
              <div className="flex items-end gap-2 h-20">
                {[
                  { label: 'Tâches', h: 75, c: '#3B82F6' },
                  { label: 'Agenda', h: 95, c: '#EF4444' },
                  { label: 'OKR', h: 55, c: '#10B981' },
                  { label: 'Habitudes', h: 70, c: '#F59E0B' },
                  { label: 'Lecture', h: 35, c: '#8B5CF6' },
                  { label: 'Autres', h: 25, c: '#64748B' },
                ].map((bar, i) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <motion.div
                      className="w-full rounded-t-sm origin-bottom"
                      style={{ backgroundColor: bar.c }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${bar.h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + i * 0.07 }}
                    />
                    <span className="text-[9px] text-slate-500 tracking-wider truncate w-full text-center">{bar.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — Mode démo (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.45 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-cyan-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase">// 05 · Zéro friction</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Pas d'inscription.<br />Juste essayer.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-md">
                Un mode démo pré-rempli avec 12 mois de données réalistes. Vous testez
                le vrai Cosmo, pas une vidéo. Pas un email demandé.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ backgroundColor: 'rgba(34, 211, 238, 0.08)', color: '#67E8F9', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  100 tâches · 100 habitudes · 150 events
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
);

export default WhySection;
