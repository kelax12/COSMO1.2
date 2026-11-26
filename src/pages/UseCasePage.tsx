import React from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { getUseCase } from '@/content/use-cases.mjs';
import { canonicalUrl, routeIdFromSlug, routeSlug } from '@/i18n/routes';
import { DEFAULT_LOCALE } from '@/i18n/locale';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';

// Page use-case commerciale (/pour-freelances, /pour-etudiants, /pour-managers).
// Contenu dans src/content/use-cases.mjs — même pattern que le blog.
const UseCasePage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  // ⚠️ La barre FINALE se retire aussi, et ce n'est pas de la coquetterie.
  // React Router fait bien correspondre `/pour-freelances/` à la route
  // `/pour-freelances` : la page se monte. C'est ICI que la page se perdait,
  // en cherchant la fiche du slug « pour-freelances/ », qui n'existe pas, puis
  // en renvoyant vers l'accueil. Mesuré en production :
  // `thecosmo.app/pour-freelances/` affichait la page d'accueil.
  //
  // Le cas n'est pas théorique : les annuaires normalisent presque tous les URL
  // avec une barre finale, et c'est précisément le canal d'acquisition qu'on
  // s'apprête à ouvrir (T-21). Un backlink obtenu à la main aurait envoyé son
  // visiteur ailleurs que sur la page qui le concerne.
  const slug = useLocation().pathname.replace(/^\//, '').replace(/\/$/, '');
  // 🔴 La fiche se retrouve par son `routeId`, JAMAIS par son slug. Le registre
  // était keyé sur les slugs FRANÇAIS : sous `en`, App.tsx déclare la route
  // `for-freelancers`, que `getUseCase()` ne trouvait pas, et les quatre pages
  // anglaises repartaient donc vers l'accueil. Mesuré avant correctif :
  // `getUseCase('for-freelancers')` rendait `undefined`.
  const routeId = routeIdFromSlug(slug);
  const useCase = routeId ? getUseCase(routeId) : undefined;
  // Servir le français quand la traduction manque, mais dire laquelle est rendue.
  const contentLocale = useCase?.locales[locale] ? locale : DEFAULT_LOCALE;
  const content = useCase?.locales[contentLocale];

  useSeoMeta({
    title: content ? `${content.metaTitle} | Cosmo` : 'Cosmo',
    description: content?.description,
    canonical:
      useCase && routeId
        ? canonicalUrl(`/${routeSlug(routeId, DEFAULT_LOCALE)}`, locale)
        : undefined,
  });

  if (!useCase || !content) return <Navigate to="/" replace />;

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" data-cta="cas-usage-signup-entete" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('useCasePage.signupCta')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1
          className="text-3xl sm:text-4xl font-bold leading-tight mb-5 text-slate-900 [text-wrap:balance]"
          lang={contentLocale}
        >
          {content.title}
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-10" lang={contentLocale}>
          {content.lead}
        </p>

        {/* Contenu maison (src/content/use-cases.mjs), pas de données utilisateur */}
        <div
          className="blog-prose"
          lang={contentLocale}
          dangerouslySetInnerHTML={{ __html: content.html }}
        />

        <aside className="mt-14 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 mb-2">{t('useCasePage.ctaTitle')}</p>
          <p className="text-slate-500 text-sm mb-5">
            {t('useCase.demoNote')}
          </p>
          <Link
            to="/signup"
            data-cta="cas-usage-signup-bas"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('blog.startFree')}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </main>
    </div>
  );
};

export default UseCasePage;
