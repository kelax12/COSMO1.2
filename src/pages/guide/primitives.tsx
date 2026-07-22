// ═══════════════════════════════════════════════════════════════════
// guide/primitives — atomes présentationnels + nav + schémas SEO de GuidePage.
// Extraits verbatim de GuidePage.tsx (god-component refactor). Purement
// présentationnel/statique, aucun état de page.
// ═══════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import {
  CheckSquare, Calendar, Repeat, Target, BarChart2,
  Rocket, Star, Lightbulb, CircleDot, List,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────
export type SectionId = 'demarrage' | 'taches' | 'listes' | 'agenda' | 'habitudes' | 'okr' | 'statistiques' | 'premium';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  color: string;
}

// Couleurs identiques à Layout.tsx (CHART_COLORS + hoverColor)
export const NAV_ITEMS: NavItem[] = [
  { id: 'demarrage',    label: 'Prise en main',  icon: <Rocket size={16} />,      color: '#94a3b8' },
  { id: 'taches',       label: 'Tâches',          icon: <CheckSquare size={16} />, color: '#3b82f6' },
  { id: 'listes',       label: 'Listes',           icon: <List size={16} />,        color: '#3b82f6' },
  { id: 'agenda',       label: 'Agenda',           icon: <Calendar size={16} />,    color: '#ef4444' },
  { id: 'habitudes',    label: 'Habitudes',        icon: <Repeat size={16} />,      color: '#eab308' },
  { id: 'okr',          label: 'OKR',              icon: <Target size={16} />,      color: '#22c55e' },
  { id: 'statistiques', label: 'Statistiques',     icon: <BarChart2 size={16} />,   color: '#8b5cf6' },
  { id: 'premium',      label: 'Premium',          icon: <Star size={16} />,        color: '#eab308' },
];

// ─── Sub-components ───────────────────────────────────────────────────

export const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 bg-[rgb(var(--color-accent-solid))]/10 border border-[rgb(var(--color-accent-solid))]/20 rounded-xl p-4 mt-6">
    <Lightbulb size={16} className="text-blue-400 shrink-0 mt-0.5" />
    <p className="text-sm text-blue-200 leading-relaxed">{children}</p>
  </div>
);

export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-3 bg-slate-700/40 border border-white/8 rounded-xl p-4 mt-4">
    <CircleDot size={15} className="text-slate-400 shrink-0 mt-0.5" />
    <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
  </div>
);

export const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[rgb(var(--color-accent-solid))] flex items-center justify-center text-xs font-bold text-white mt-0.5">
      {n}
    </div>
    <div>
      <h3 className="font-semibold text-white mb-1 text-base">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
    </div>
  </div>
);

export const FeatureRow: React.FC<{ icon: React.ReactNode; label: string; desc: string }> = ({ icon, label, desc }) => (
  <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
    <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0 text-slate-300">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </div>
  </div>
);

export const SectionHeader: React.FC<{ id: SectionId; icon: React.ReactNode; color: string; title: string; subtitle: string }> = ({ id, icon, color, title, subtitle }) => (
  <div id={id} className="flex items-start gap-4 mb-8 pt-2">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 mt-1">{subtitle}</p>
    </div>
  </div>
);

// ─── SEO schemas (JSON-LD) ────────────────────────────────────────────

export function useGuideSchemas() {
  useEffect(() => {
    // Pages pré-rendues (prerender.mjs) : les schémas sont déjà en statique
    // dans le <head>. Ne pas dupliquer côté client.
    if (document.getElementById('guide-breadcrumb')) return;
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://thecosmo.app/' },
        { '@type': 'ListItem', position: 2, name: "Guide d'utilisation", item: 'https://thecosmo.app/guide' },
      ],
    };
    const article = {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: "Guide d'utilisation Cosmo – Tâches, habitudes, OKR et agenda",
      description: "Guide complet pour utiliser Cosmo : gestion de tâches, suivi d'habitudes avec heatmap, agenda time-blocking et méthode OKR.",
      url: 'https://thecosmo.app/guide',
      inLanguage: 'fr-FR',
      datePublished: '2025-01-01',
      dateModified: '2026-05-31',
      author: { '@type': 'Organization', name: 'Cosmo', url: 'https://thecosmo.app' },
      publisher: { '@type': 'Organization', name: 'Cosmo', url: 'https://thecosmo.app' },
      mainEntityOfPage: 'https://thecosmo.app/guide',
      articleSection: ['Prise en main', 'Tâches', 'Habitudes', 'Agenda', 'OKR', 'Statistiques'],
    };

    const bc = document.createElement('script');
    bc.type = 'application/ld+json';
    bc.id = 'guide-breadcrumb';
    bc.textContent = JSON.stringify(breadcrumb);
    document.head.appendChild(bc);

    const art = document.createElement('script');
    art.type = 'application/ld+json';
    art.id = 'guide-article';
    art.textContent = JSON.stringify(article);
    document.head.appendChild(art);

    return () => {
      document.getElementById('guide-breadcrumb')?.remove();
      document.getElementById('guide-article')?.remove();
    };
  }, []);
}
