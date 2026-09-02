import React from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { getUseCase } from '@/content/use-cases.mjs';
import { useT } from '@/i18n/useT';

// Page use-case commerciale (/pour-freelances, /pour-etudiants, /pour-managers).
// Contenu dans src/content/use-cases.mjs — même pattern que le blog.
const UseCasePage: React.FC = () => {
  const { t } = useT('landing');
  // ⚠️ La barre FINALE se retire aussi, et ce n'est pas de la coquetterie.
  // React Router fait bien correspondre `/pour-freelances/` à la route
  // `/pour-freelances` : la page se monte. C'est ICI que la page se perdait,
  // en cherchant la fiche du slug « pour-freelances/ », qui n'existe pas, puis
  // en renvoyant vers l'accueil. Mesuré en production le 2026-08-29 :
  // `thecosmo.app/pour-freelances/` affichait la page d'accueil.
  //
  // Le cas n'est pas théorique : les annuaires normalisent presque tous les URL
  // avec une barre finale, et c'est précisément le canal d'acquisition qu'on
  // s'apprête à ouvrir (T-21). Un backlink obtenu à la main aurait envoyé son
  // visiteur ailleurs que sur la page qui le concerne.
  const slug = useLocation().pathname.replace(/^\//, '').replace(/\/$/, '');
  const useCase = getUseCase(slug);

  useSeoMeta({
    title: useCase ? `${useCase.metaTitle} | Cosmo` : 'Cosmo',
    description: useCase?.description,
    canonical: useCase ? `https://thecosmo.app/${useCase.slug}` : undefined,
  });

  if (!useCase) return <Navigate to="/" replace />;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-white">Cosmo</span>
          </Link>
          <Link to="/signup" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
            {t('useCasePage.signupCta')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-5 text-white [text-wrap:balance]">
          {useCase.title}
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed mb-10">{useCase.lead}</p>

        {/* Contenu maison (src/content/use-cases.mjs), pas de données utilisateur */}
        <div className="blog-prose" dangerouslySetInnerHTML={{ __html: useCase.html }} />

        <aside className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold text-white mb-2">{t('useCasePage.ctaTitle')}</p>
          <p className="text-slate-400 text-sm mb-5">
            {t('useCase.demoNote')}
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
          >
            Commencer gratuitement
            <ArrowRight size={16} />
          </Link>
        </aside>
      </main>
    </div>
  );
};

export default UseCasePage;
