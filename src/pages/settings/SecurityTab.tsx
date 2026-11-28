import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { LabeledInput, PrimaryButton, SectionCard } from './primitives';
import { tabMotion } from './tab-motion';

export interface PasswordsDraft {
  current: string;
  new: string;
  confirm: string;
}

interface SecurityTabProps {
  reduced: boolean | null;
  passwords: PasswordsDraft;
  onPasswordsChange: Dispatch<SetStateAction<PasswordsDraft>>;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  onDeleteAccount: () => void;
}

/** Onglet Sécurité : changement de mot de passe, zone de suppression du compte. */
export default function SecurityTab({ reduced, passwords, onPasswordsChange, onSubmit, saving, onDeleteAccount }: SecurityTabProps) {
  const { t: tCommon } = useT('common');
  const { t } = useT('settings');
  return (
    <motion.div {...tabMotion(reduced)} className="max-w-2xl flex flex-col gap-5">
      <SectionCard>
        <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{t('security.heading')}</h2>
        <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-5">{t('security.hint')}</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <LabeledInput label="Mot de passe actuel" showToggle showPasswordLabel={tCommon('auth.showPassword')} hidePasswordLabel={tCommon('auth.hidePassword')} value={passwords.current} onChange={(e) => onPasswordsChange(p => ({ ...p, current: e.target.value }))} placeholder="••••••••••••" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledInput label={t('security.newPasswordLabel')} showToggle showPasswordLabel={tCommon('auth.showPassword')} hidePasswordLabel={tCommon('auth.hidePassword')} value={passwords.new} onChange={(e) => onPasswordsChange(p => ({ ...p, new: e.target.value }))} placeholder="••••••••••••" />
            <LabeledInput label="Confirmer" showToggle showPasswordLabel={tCommon('auth.showPassword')} hidePasswordLabel={tCommon('auth.hidePassword')} value={passwords.confirm} onChange={(e) => onPasswordsChange(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••••••" />
          </div>
          <div className="flex justify-end pt-1">
            <PrimaryButton type="submit" loading={saving}>{saving ? t('security.updating') : t('security.update')}</PrimaryButton>
          </div>
        </form>
      </SectionCard>
      {/* Maquette 212 : sur mobile, une ligne en texte rouge ; la
          confirmation (saisie du mot) porte le poids. */}
      <button type="button" onClick={onDeleteAccount} className="md:hidden w-full min-h-touch rounded-2xl bg-[rgb(var(--color-surface))] text-body text-[rgb(var(--color-danger-text))]">
        {t('security.deleteAccount')}
      </button>
      <div className="hidden md:block bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-red-600 dark:text-red-500">{t('security.dangerZone')}</h2>
            <p className="text-xs text-red-500/70 mt-1">{t('security.dangerHint')}</p>
          </div>
          <button onClick={onDeleteAccount} style={{ minHeight: '44px' }}
            className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-[0.97] transition-all duration-150">
            {t('security.deleteAccount')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
