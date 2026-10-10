import React from 'react';
import { ChevronLeft, ChevronRight, Shield, Database, Palette, Globe, Clock, Building2, BookOpen, LogOut, Check } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useLocale } from '@/i18n/store';
import { LOCALE_LABEL, SUPPORTED_LOCALES } from '@/i18n/locale';
import { useTimezonePref } from '@/lib/timezone';
import type { Theme } from '@/lib/theme';
import type { KeyOf } from '@/i18n/catalog';
import type { SettingsTab } from './primitives';

/** Sous-pages de l'accueil mobile : les onglets, plus deux qui n'en étaient pas. */
export type MobileSettingsPage = SettingsTab | 'timezone' | 'org';

const THEME_LABEL: Record<Theme, KeyOf<'common'>> = {
  light: 'theme.light',
  dark: 'theme.dark',
  gris: 'theme.grey',
  noir: 'theme.black',
};

interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface Props {
  user: User;
  initials: string;
  hasOrganization: boolean;
  onOpen: (page: MobileSettingsPage) => void;
  onLogout: () => void;
}

const Row: React.FC<{ icon: React.ElementType; label: string; value?: string; onClick: () => void }> = ({ icon: Icon, label, value, onClick }) => (
  <li className="border-b last:border-b-0 border-[rgb(var(--color-border))]">
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 min-h-touch py-2 text-left active:bg-[rgb(var(--color-hover))]">
      <Icon size={19} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
      <span className="flex-1 min-w-0 truncate text-body text-[rgb(var(--color-text-primary))]">{label}</span>
      {value && <span className="shrink-0 text-body text-[rgb(var(--color-text-secondary))]">{value}</span>}
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
    </button>
  </li>
);

const Group: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mt-5">
    {title && <h2 className="px-1 pb-1.5 text-label font-semibold text-[rgb(var(--color-text-muted))]">{title}</h2>}
    <ul className="rounded-2xl bg-[rgb(var(--color-surface))] px-4">{children}</ul>
  </section>
);

/**
 * Accueil des Paramètres sur MOBILE (maquettes 205 à 214, 2026-10-10).
 *
 * Les onglets défilaient en pastilles et le quatrième était coupé au bord
 * (« M… ») ; « Guide » et la déconnexion étaient hors champ. C'est désormais
 * une liste groupée, à la façon des réglages iOS : chaque ligne ouvre sa page,
 * et les valeurs courantes (thème, langue, fuseau) se lisent sans y entrer.
 * Fuseau horaire et Entreprise, qui vivaient au pied du Profil, ont leur ligne.
 */
const MobileSettingsHome: React.FC<Props> = ({ user, initials, hasOrganization, onOpen, onLogout }) => {
  const { t } = useT('settings');
  const { t: tCommon } = useT('common');
  const { theme } = useDarkMode();
  const locale = useLocale();
  const { pref } = useTimezonePref();
  const tzValue = pref.mode === 'default'
    ? t('mobile.timezoneAuto')
    : `UTC${pref.offsetHours < 0 ? '−' : '+'}${Math.abs(pref.offsetHours)}`;

  return (
    <div className="pb-6">
      {/* Maquette 207 : le profil en une ligne, avatar rond. */}
      <ul className="rounded-2xl bg-[rgb(var(--color-surface))] px-4">
        <li>
          <button type="button" onClick={() => onOpen('profile')} className="w-full flex items-center gap-3 min-h-[64px] py-2 text-left">
            <span className="size-11 shrink-0 overflow-hidden rounded-full bg-[rgb(var(--color-border))] flex items-center justify-center text-label font-semibold text-[rgb(var(--color-text-secondary))]">
              {user.avatar ? <img src={user.avatar} alt="" className="size-full object-cover" /> : initials}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-body font-semibold text-[rgb(var(--color-text-primary))]">{user.name}</span>
              <span className="block truncate text-label text-[rgb(var(--color-text-muted))]">{user.email}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
          </button>
        </li>
      </ul>

      <Group title={t('nav.account')}>
        <Row icon={Shield} label={t('nav.security')} onClick={() => onOpen('security')} />
        <Row icon={Database} label={t('nav.myData')} onClick={() => onOpen('data')} />
      </Group>

      <Group title={t('nav.preferences')}>
        <Row icon={Palette} label={t('mobile.theme')} value={tCommon(THEME_LABEL[theme])} onClick={() => onOpen('appearance')} />
        {SUPPORTED_LOCALES.length > 1 && (
          <Row icon={Globe} label={tCommon('language.label')} value={LOCALE_LABEL[locale]} onClick={() => onOpen('appearance')} />
        )}
        <Row icon={Clock} label={t('timezone.heading')} value={tzValue} onClick={() => onOpen('timezone')} />
      </Group>

      {hasOrganization && (
        <Group title={t('mobile.organization')}>
          <Row icon={Building2} label={t('mobile.organizationRow')} onClick={() => onOpen('org')} />
        </Group>
      )}

      <Group title={t('nav.help')}>
        <Row icon={BookOpen} label={t('nav.guide')} onClick={() => onOpen('guide')} />
      </Group>

      {/* Déconnexion en rouge, comme dans la feuille « Plus » (la maquette 221,
          qui la passait en neutre, n'a pas été retenue). */}
      <ul className="mt-5 rounded-2xl bg-[rgb(var(--color-surface))] px-4">
        <li>
          <button type="button" onClick={onLogout} className="w-full flex items-center gap-3 min-h-touch text-left text-body text-[rgb(var(--color-danger-text))]">
            <LogOut size={19} aria-hidden="true" className="shrink-0" />
            {t('page.logout')}
          </button>
        </li>
      </ul>
    </div>
  );
};

/** Retour à l'accueil des Paramètres, en tête d'une sous-page mobile. */
export const MobileSettingsBack: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useT('settings');
  return (
    <button type="button" onClick={onBack} className="-ml-2 mb-3 inline-flex items-center gap-1 min-h-touch pr-3 text-body text-[rgb(var(--color-accent))]">
      <ChevronLeft size={20} aria-hidden="true" />
      {t('page.title')}
    </button>
  );
};

/**
 * Maquette 209 : les quatre thèmes en liste nommée, cochée, avec un aperçu de
 * couleur. Le segmenté 2 × 2 passait à la ligne et son texte d'aide oubliait
 * « Gris ».
 */
export const MobileThemeList: React.FC = () => {
  const { t } = useT('common');
  const { theme, setTheme } = useDarkMode();
  const swatches: Record<Theme, string> = { light: '#ffffff', dark: '#1e293b', gris: '#2b3137', noir: '#080808' };
  return (
    <ul role="radiogroup" aria-label={t('theme.label')} className="rounded-2xl bg-[rgb(var(--color-surface))] px-4">
      {(Object.keys(THEME_LABEL) as Theme[]).map((id) => (
        <li key={id} className="border-b last:border-b-0 border-[rgb(var(--color-border))]">
          <button
            type="button"
            role="radio"
            aria-checked={theme === id}
            onClick={() => setTheme(id)}
            className="w-full flex items-center gap-3 min-h-touch text-left"
          >
            <span className="size-5 shrink-0 rounded-full border border-[rgb(var(--color-border-strong))]" style={{ backgroundColor: swatches[id] }} aria-hidden="true" />
            <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">{t(THEME_LABEL[id])}</span>
            {theme === id && <Check size={18} aria-hidden="true" className="text-[rgb(var(--color-accent))]" />}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default MobileSettingsHome;
