import { motion } from 'framer-motion';
import { ShortcutsList } from '@/components/keyboard-shortcuts';
import ThemeToggle from '@/components/ThemeToggle';
import LocaleToggle from '@/components/LocaleToggle';
import { SUPPORTED_LOCALES } from '@/i18n/locale';
import { useT } from '@/i18n/useT';
import { SectionCard } from './primitives';
import { MobileThemeList } from './MobileSettingsHome';
import { tabMotion } from './tab-motion';

interface AppearanceTabProps {
  reduced: boolean | null;
  isMobile: boolean;
  /** Email du compte : les comptes de test voient la liste de thèmes de test. */
  email: string | undefined;
}

/** Onglet Apparence : thème, langue, raccourcis clavier (desktop). */
export default function AppearanceTab({ reduced, isMobile, email }: AppearanceTabProps) {
  const { t: tCommon } = useT('common');
  const { t } = useT('settings');
  return (
    <motion.div {...tabMotion(reduced)} className="max-w-2xl">
      {isMobile && <MobileThemeList />}
      <SectionCard className="hidden md:flex">
        <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{t('appearance.heading')}</h2>
        <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-5">{t('appearance.hint')}</p>
        <div style={{ minHeight: '72px' }}
          className="flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('appearance.displayMode')}</p>
            <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{email?.endsWith('@thecosmo.app') ? t('appearance.themeListTest') : t('appearance.themeList')}</p>
          </div>
          <ThemeToggle showLabel />
        </div>
      </SectionCard>

      {/* ── Langue ──────────────────────────────────────────────
          Section à part entière, et non une ligne de la carte
          « Thème » : la langue n'est pas un réglage d'apparence, et
          elle y était introuvable.

          Masquée tant qu'une seule langue est servie — un radiogroup
          à une option n'est pas un choix. La condition porte sur la
          SECTION et pas seulement sur `LocaleToggle` (qui rend `null`
          seul), sinon on afficherait un titre au-dessus du vide. */}
      {SUPPORTED_LOCALES.length > 1 && (
        <SectionCard className="mt-4">
          <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{tCommon('language.label')}</h2>
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-3">
            {tCommon('language.sectionSubtitle')}
          </p>
          <div style={{ minHeight: '72px' }}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{tCommon('language.description')}</p>
              <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{tCommon('language.reloadNotice')}</p>
            </div>
            <LocaleToggle />
          </div>
        </SectionCard>
      )}

      {/* Raccourcis clavier — copie du contenu du popup « ? »,
          consultable sans avoir à ouvrir la palette. Source partagée
          (components/keyboard-shortcuts) pour ne jamais diverger.
          Masqué en mobile : une liste de raccourcis clavier sur un
          écran sans clavier n'est que du remplissage. */}
      {!isMobile && (
        <SectionCard className="mt-4">
          <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{t('appearance.shortcuts')}</h2>
          <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-3">
            {t('appearance.shortcutsHint')} <kbd className="px-1.5 py-0.5 rounded border text-caption" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-hover))' }}>?</kbd>.
          </p>
          <ShortcutsList compact />
        </SectionCard>
      )}
    </motion.div>
  );
}
