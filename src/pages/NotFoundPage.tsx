import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, MapPinOff } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';

// Vraie page 404 (au lieu d'un Navigate vers la home qui produisait des
// soft-404 : toute URL inconnue renvoyait la home en HTTP 200). Le statut
// HTTP reste 200 (SPA + rewrite Vercel), mais le meta robots noindex posé
// ci-dessous suffit à Google (qui rend le JS) pour exclure ces URLs.
const NotFoundPage: React.FC = () => {
  const { t } = useT('common');
  // Titre et description viennent du catalogue `seo`, comme toutes les autres
  // pages : ils etaient en dur en francais, donc servis tels quels en anglais.
  const { t: tSeo } = useT('seo');
  useSeoMeta({
    title: tSeo('notFound.title'),
    description: tSeo('notFound.description'),
  });

  // noindex le temps de la 404, restauré au démontage (la valeur par défaut
  // d'index.html est "index, follow, ...").
  useEffect(() => {
    const el = document.querySelector('meta[name="robots"]');
    const previous = el?.getAttribute('content') ?? null;
    el?.setAttribute('content', 'noindex');
    return () => {
      if (el && previous) el.setAttribute('content', previous);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 max-md:bg-none max-md:bg-[rgb(var(--color-background))] text-white max-md:text-[rgb(var(--color-text-primary))] flex items-center justify-center px-4">
      {/* Maquettes 365 à 368 (2026-10-11) : sur mobile, le fond uni du thème, une
        icône discrète, le bouton à l'accent et le guide en dessous. */}
      <div className="text-center max-w-md">
        <p className="max-md:hidden text-7xl font-bold text-slate-700 mb-4">404</p>
        <MapPinOff size={28} aria-hidden="true" className="md:hidden mx-auto mb-4 text-[rgb(var(--color-text-muted))]" />
        <h1 className="text-2xl max-md:text-title sm:text-3xl font-bold mb-3">{t('notFound.title')}</h1>
        <p className="text-slate-400 max-md:text-[rgb(var(--color-text-secondary))] mb-8">
          {t('notFound.body')}
        </p>
        <div className="flex max-md:flex-col items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 max-md:bg-[rgb(var(--color-accent-solid))] max-md:text-[rgb(var(--color-accent-solid-foreground))] font-semibold hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} aria-hidden="true" className="max-md:hidden" />
            {t('notFound.home')}
          </Link>
          <Link to="/guide" className="text-slate-400 max-md:text-[rgb(var(--color-accent))] hover:text-white transition-colors">
            {t('notFound.guide')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
