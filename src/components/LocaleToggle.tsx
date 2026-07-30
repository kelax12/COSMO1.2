import React from 'react';
import { localeSwitchTarget } from '@/i18n/bootstrap';
import { LOCALE_LABEL, SUPPORTED_LOCALES, persistLocale, type Locale } from '@/i18n/locale';
import { useLocale } from '@/i18n/store';
import { useT } from '@/i18n/useT';

interface LocaleToggleProps {
  className?: string;
}

/**
 * Sélecteur de langue — même contrôle segmenté que `ThemeToggle` en mode
 * `showLabel`, pour que les deux réglages d'apparence se ressemblent.
 *
 * Le changement provoque un RECHARGEMENT complet vers l'équivalent localisé du
 * chemin courant, et non une navigation SPA. Deux raisons :
 *   - `basename` est figé au montage du routeur (cf. src/i18n/bootstrap.ts) ;
 *   - un rechargement garantit que `<html lang>`, les catalogues et les locales
 *     `date-fns` sont tous cohérents. Une bascule à chaud laisserait des
 *     composants déjà montés afficher l'ancienne langue.
 *
 * Un seul choix disponible (phase 1) ⇒ le composant ne rend rien : un
 * radiogroup à une option n'est pas un choix.
 */
const LocaleToggle: React.FC<LocaleToggleProps> = ({ className = '' }) => {
  const current = useLocale();
  const { t } = useT('common');

  if (SUPPORTED_LOCALES.length < 2) return null;

  const switchTo = (locale: Locale) => {
    if (locale === current) return;
    // Persisté AVANT le rechargement : la nouvelle page lira cette préférence
    // pour toutes les visites ultérieures à la racine.
    persistLocale(locale);
    window.location.assign(localeSwitchTarget(locale));
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-0.5 p-1 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl ${className}`}
      role="radiogroup"
      aria-label={t('language.label')}
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            role="radio"
            aria-checked={active}
            // `lang` sur le bouton : le libellé est écrit dans SA langue
            // (« English » au milieu d'une page française), la synthèse vocale
            // doit changer de voix pour le prononcer correctement.
            lang={locale}
            onClick={() => switchTo(locale)}
            title={LOCALE_LABEL[locale]}
            style={{ minHeight: '36px', minWidth: '60px' }}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              active
                ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-sm border border-[rgb(var(--color-border))]'
                : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
            }`}
          >
            <span aria-hidden="true" className="uppercase tracking-wide opacity-60">
              {locale}
            </span>
            {LOCALE_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
};

export default LocaleToggle;
