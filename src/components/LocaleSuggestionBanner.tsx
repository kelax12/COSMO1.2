import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { detectLocale, persistLocale, readStoredLocale, type Locale } from '@/i18n/locale';
import { localeSwitchTarget, suggestedLocale } from '@/i18n/bootstrap';
import { LOCALE_SUGGESTION } from '@/content/locale-suggestion.mjs';

// Propose la langue du navigateur au lieu d'y rediriger (cf. src/i18n/bootstrap.ts) :
// la page reste celle de son URL, pour les visiteurs comme pour Googlebot.
// Calculé après le montage : le prérendu ne le peint jamais.
const CLE_FERME = 'cosmo_locale_suggestion_fermee';

const LocaleSuggestionBanner: React.FC = () => {
  const { locale } = useT('landing');
  const [cible, setCible] = useState<Locale | null>(null);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CLE_FERME)) return;
    } catch {
      // sessionStorage refusé : le bandeau peut s'afficher, sa fermeture vaudra pour la page.
    }
    setCible(suggestedLocale(locale, readStoredLocale(), detectLocale()));
  }, [locale]);

  const texte = cible ? LOCALE_SUGGESTION[cible] : undefined;
  if (!cible || !texte) return null;

  const fermer = () => {
    setCible(null);
    try {
      window.sessionStorage.setItem(CLE_FERME, '1');
    } catch {
      // sans stockage, la fermeture ne vaut que pour cette page
    }
  };
  const basculer = () => {
    persistLocale(cible);
    window.location.assign(localeSwitchTarget(cible));
  };

  return (
    <div role="region" aria-label={texte.message} lang={cible} className="fixed inset-x-0 bottom-0 z-[70] p-3 print:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-slate-900/10 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-lg backdrop-blur">
        <span className="flex-1">{texte.message}</span>
        <button type="button" data-cta={`suggestion-langue-${cible}`} onClick={basculer} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">
          {texte.action}
        </button>
        <button type="button" onClick={fermer} aria-label={texte.fermer} className="rounded-lg p-1 text-slate-400 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default LocaleSuggestionBanner;
