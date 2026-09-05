// ═══════════════════════════════════════════════════════════════════
// Ce qu'on peut faire à SON COMPTE depuis les réglages
//
// Enregistrer son profil, changer son mot de passe, retirer sa photo,
// se déconnecter, supprimer son compte. Cinq gestes, une seule boîte de
// confirmation, et trois drapeaux « en cours » — ils ne parlaient qu'entre
// eux au milieu de la page.
//
// FRONTIÈRE : ce hook ne rend rien et ne connaît aucun onglet, aucune carte,
// aucune préférence d'affichage. Il reçoit l'identité et rend des gestes.
//
// 🔴 Deux règles de sécurité vivent ici, et nulle part ailleurs :
//   • changer un mot de passe VÉRIFIE l'ancien (`signInWithPassword`) —
//     `updateUser` ne l'exige pas, et sans cette étape une session volée
//     suffit à verrouiller le compte (faille B8) ;
//   • puis RÉVOQUE les autres sessions (`scope: 'others'`, R-17) — sinon
//     l'intrus garde son jeton jusqu'à expiration, ce qui vide la manœuvre
//     de son seul usage.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import type { User } from '@/modules/auth/AuthContext';
import type { Translator } from '@/i18n/useT';

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  variant: 'default' | 'destructive';
  showInput?: boolean;
  confirmationText?: string;
}

interface Params {
  /**
   * `null` pendant le premier rendu : la page rend `null` dans ce cas, mais un
   * hook ne peut pas être appelé conditionnellement — les deux gestes qui
   * touchent à l'identité s'abstiennent plutôt que d'être court-circuités.
   */
  user: User | null;
  isDemo: boolean;
  /** Un compte OAuth gère son adresse chez son fournisseur : pas de changement ici. */
  isThirdParty: boolean;
  logout: () => void | Promise<void>;
  navigate: (path: string) => void;
  updateDemoProfile: (patch: { name: string; email: string }) => void;
  /** Retire la référence ET le fichier (R-03) — cf. `useAvatarActions`. */
  removeAvatarEverywhere: () => Promise<boolean>;
  t: Translator<'settings'>['t'];
}

export function useAccountActions({
  user,
  isDemo,
  isThirdParty,
  logout,
  navigate,
  updateDemoProfile,
  removeAvatarEverywhere,
  t,
}: Params) {
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false, title: '', description: '', onConfirm: () => {}, variant: 'default',
  });
  const [confirmInput, setConfirmInput] = useState('');

  const closeConfirm = () => setConfirmConfig((prev) => ({ ...prev, isOpen: false }));

  const saveProfile = async (draft: { name: string; email: string }) => {
    if (!user) return;
    const name = draft.name.trim();
    // sanitizeEmail strips copy-paste invisible chars (zero-width, NBSP, BOM)
    // that would otherwise make a visually-correct address fail validation.
    const email = sanitizeEmail(draft.email);
    if (!name) { toast.error(t('profile.nameEmpty')); return; }
    if (!email) { toast.error(t('profile.emailEmpty')); return; }
    // Validate the format before the round-trip when the email is actually
    // changing, so the user gets an instant, explicit message instead of a
    // generic failure coming back from Supabase (error_code email_address_invalid).
    if (!isThirdParty && email !== user.email && !isValidEmail(email)) {
      toast.error(t('profile.invalidEmail'));
      return;
    }
    setSavingProfile(true);
    try {
      if (isDemo) {
        // La démo n'a pas de backend : la mutation passe par AuthContext, qui
        // EST la source lue par cet écran. L'ancien chemin écrivait dans
        // `cosmo_user`, que plus personne ne relisait depuis que `useAuth` est
        // devenu la source de vérité — le toast s'affichait, rien ne changeait.
        updateDemoProfile({ name, email });
        toast.success(t('profile.updatedDemo'));
        return;
      }
      const payload: { data: { name: string }; email?: string } = { data: { name } };
      // Never attempt an email change on a third-party (OAuth) account — its
      // email is owned by the provider. Defensive: the input is also disabled.
      if (!isThirdParty && email !== user.email) payload.email = email;
      const { error } = await supabase.auth.updateUser(payload);
      if (error) {
        console.error('[SettingsPage] updateUser:', error);
        // Map known Supabase auth error codes to explicit, safe French copy.
        // We never surface the raw error.message in the UI (faille V7).
        const code = (error as { code?: string }).code;
        const status = (error as { status?: number }).status;
        let message = t('profile.updateFailed');
        if (code === 'email_exists' || status === 422) {
          message = t('profile.emailTaken');
        } else if (code === 'email_address_invalid') {
          message = t('profile.invalidEmail');
        } else if (code === 'over_email_send_rate_limit' || status === 429) {
          message = t('profile.tooManyAttempts');
        }
        toast.error(message);
        return;
      }
      toast.success(payload.email ? t('profile.updatedCheckMail') : t('profile.updated'));
    } catch { toast.error(t('security.unexpectedError')); }
    finally { setSavingProfile(false); }
  };

  /** Rend `true` quand le mot de passe a changé — l'appelant vide alors ses champs. */
  const updatePassword = async (passwords: { current: string; new: string; confirm: string }) => {
    if (!user) return false;
    if (!passwords.current || !passwords.new || !passwords.confirm) { toast.error(t('security.fillAllFields')); return false; }
    if (passwords.new !== passwords.confirm) { toast.error(t('security.passwordsDiffer')); return false; }
    if (passwords.new.length < MIN_PASSWORD_LENGTH) { toast.error(t('security.tooShort', { count: MIN_PASSWORD_LENGTH })); return false; }
    if (passwords.current === passwords.new) { toast.error(t('security.mustDiffer')); return false; }
    setSavingPassword(true);
    try {
      if (!supabase) { toast.error(t('security.serviceUnavailable')); return false; }
      if (isDemo) { toast.info(t('security.demoDisabled')); return false; }
      // Verify the current password before rotating. supabase.auth.updateUser
      // does NOT enforce knowledge of the current password — without this step
      // anyone with a hijacked session can lock the user out. Faille B8.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwords.current,
      });
      if (reauthError) {
        toast.error(t('security.wrongCurrentPassword'));
        return false;
      }
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) { console.error('[SettingsPage] password update:', error); toast.error(t('security.updateError')); return false; }
      // R-17 — Révoquer les AUTRES sessions. Sans ça, changer son mot de passe
      // après un accès non autorisé n'expulsait pas l'intrus : son jeton
      // restait valide jusqu'à expiration, ce qui vide la manœuvre de son
      // seul usage. `scope: 'others'` préserve la session courante.
      const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' });
      if (revokeError) console.error('[SettingsPage] revoke other sessions:', revokeError);
      toast.success(t('security.updated'));
      return true;
    } catch { toast.error(t('security.unexpectedError')); return false; }
    finally { setSavingPassword(false); }
  };

  const deleteAccount = () => {
    setConfirmConfig({
      isOpen: true, title: t('security.deleteAccountTitle'),
      description: t('security.deleteAccountBody'),
      variant: 'destructive', showInput: true, confirmationText: 'DELETE',
      onConfirm: async () => {
        setDeletingAccount(true);
        try {
          if (isDemo) {
            toast.success(t('security.demoAccountCleared'));
            await logout();
            navigate('/');
            return;
          }
          // Call the `delete-account` Edge Function (uses service_role to
          // remove the auth user + all user-owned rows). Falls back to a
          // support-email message if the function isn't deployed yet —
          // honest copy rather than silently doing nothing. Faille B9.
          const { error } = await supabase.functions.invoke('delete-account');
          if (error) {
            toast.error(t('security.deleteFailed'), { description: t('security.deleteFailedHint') });
            return;
          }
          toast.success(t('security.accountDeleted'));
          await logout();
          navigate('/');
        } catch {
          toast.error(t('security.networkError'), { description: t('security.networkErrorHint') });
        } finally {
          setDeletingAccount(false);
        }
      },
    });
    setConfirmInput('');
  };

  const removeAvatar = () => {
    setConfirmConfig({
      isOpen: true, title: t('profile.deletePhotoTitle'),
      description: t('profile.deletePhotoBody'),
      variant: 'destructive',
      onConfirm: async () => {
        // Le FICHIER part avec la référence (R-03) : cf. `useAvatarActions`.
        if (await removeAvatarEverywhere()) toast.success(t('profile.photoDeleted'));
      },
    });
  };

  const confirmLogout = () => {
    setConfirmConfig({
      isOpen: true, title: t('logout.title'), description: t('logout.body'),
      variant: 'default',
      onConfirm: () => { logout(); toast.success(t('logout.success')); navigate('/'); },
    });
  };

  return {
    savingProfile,
    savingPassword,
    deletingAccount,
    confirmConfig,
    closeConfirm,
    confirmInput,
    setConfirmInput,
    saveProfile,
    updatePassword,
    deleteAccount,
    removeAvatar,
    confirmLogout,
  };
}
