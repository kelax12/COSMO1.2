import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  User, LogOut,
  HelpCircle, Camera,
  Mail, ChevronRight, BarChart3,
} from 'lucide-react';
import { useTimezonePref, clampOffsetHours } from '@/lib/timezone';
import { ShortcutsList } from '../components/keyboard-shortcuts';
import { useIsAdmin } from '@/modules/admin';
import { useHabitReminderPref } from '@/modules/ui-states';
import { useNavigate } from 'react-router';
import { useAuth } from '../modules/auth/AuthContext';
import { useUpdateUserSettings } from '../modules/user';
import ThemeToggle from '../components/ThemeToggle';
import LocaleToggle from '../components/LocaleToggle';
import { SUPPORTED_LOCALES } from '@/i18n/locale';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
import { validateAvatarFile, computeAvatarDimensions, canvasToAvatarBlob, uploadAvatar } from '@/lib/avatar-upload';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

// Atomes présentationnels + nav extraits dans ./settings/primitives.
// Onglet « Mes données » extrait dans ./settings/DataTab.
import {
  type SettingsTab,
  NAV_GROUPS,
  LabeledInput,
  PrimaryButton,
  SectionCard,
} from './settings/primitives';
import { DataTab } from './settings/DataTab';
import OrganizationSettingsCard from '@/components/organization/OrganizationSettingsCard';
import { PageHeading } from '@/components/ui/typography';

/* ─── main component ───────────────────────────────────────────── */
const SettingsPage: React.FC = () => {
  const { habitReminderEnabled, setHabitReminderEnabled } = useHabitReminderPref();

  // `tCommon` et non `t` : le reste de cette page n'est pas encore extrait,
  // le nom explicite évite toute ambiguïté quand elle le sera.
  const { t: tCommon } = useT('common');
  const { t } = useT('settings');
  const { user, logout, isDemo } = useAuth();
  const { pref: tzPref, setMode: setTzMode, setOffsetHours: setTzOffset } = useTimezonePref();
  const isAdmin = useIsAdmin();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  // Sous prefers-reduced-motion, l'exit d'un onglet ne signale jamais sa fin
  // à AnimatePresence (bug Framer Motion) : le panneau sortant reste dans le
  // DOM (invisible mais toujours focusable) et bloque le nouvel onglet en
  // mode="wait". Sans `exit`/`initial`, le montage/démontage redevient
  // synchrone — comportement identique à un rendu conditionnel classique.
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; description: string; onConfirm: () => void;
    variant: 'default' | 'destructive'; showInput?: boolean; confirmationText?: string;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {}, variant: 'default' });
  const [confirmInput, setConfirmInput] = useState('');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  // Local edit state for the profile form. The inputs are now controlled
  // independently from `user.*` (which is the Supabase session truth) so
  // typing has a visible effect, and we push the change to Supabase on save
  // rather than to a localStorage key the production identity never reads.
  // Faille B7.
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '' });
  useEffect(() => {
    if (user) setProfileDraft({ name: user.name, email: user.email });
    // Deps primitives volontaires (plus précises que l'objet user entier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.name, user?.email]);

  if (!user) return null;

  // Third-party (OAuth) accounts manage their email upstream (e.g. Google) —
  // editing it here is locked. Native email/password (and demo) accounts can
  // change their email inline. `provider` comes from Supabase app_metadata.
  const isThirdParty = !isDemo && !!user.provider && user.provider !== 'email';

  const handleSaveProfile = async () => {
    const name = profileDraft.name.trim();
    // sanitizeEmail strips copy-paste invisible chars (zero-width, NBSP, BOM)
    // that would otherwise make a visually-correct address fail validation.
    const email = sanitizeEmail(profileDraft.email);
    if (!name) { toast.error(t('profile.nameEmpty')); return; }
    if (!email) { toast.error(t('profile.emailEmpty')); return; }
    // Validate the format before the round-trip when the email is actually
    // changing, so the user gets an instant, explicit message instead of a
    // generic failure coming back from Supabase (error_code email_address_invalid).
    if (!isThirdParty && email !== user.email && !isValidEmail(email)) {
      toast.error("Cette adresse email n'est pas valide.");
      return;
    }
    setSavingProfile(true);
    try {
      if (isDemo) {
        // Demo mode: persist locally so the UI reflects the change for the
        // session. Real users go through Supabase.
        updateUserSettings({ name, email });
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
          message = "Cette adresse email n'est pas valide.";
        } else if (code === 'over_email_send_rate_limit' || status === 429) {
          message = t('profile.tooManyAttempts');
        }
        toast.error(message);
        return;
      }
      if (payload.email) {
        toast.success(t('profile.updatedCheckMail'));
      } else {
        toast.success(t('profile.updated'));
      }
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingProfile(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) { toast.error('Veuillez remplir tous les champs'); return; }
    if (passwords.new !== passwords.confirm) { toast.error('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (passwords.new.length < MIN_PASSWORD_LENGTH) { toast.error(t('security.tooShort', { count: MIN_PASSWORD_LENGTH })); return; }
    if (passwords.current === passwords.new) { toast.error(t('security.mustDiffer')); return; }
    setSavingPassword(true);
    try {
      if (!supabase) { toast.error('Service non disponible'); return; }
      if (isDemo) { toast.info(t('security.demoDisabled')); return; }
      // Verify the current password before rotating. supabase.auth.updateUser
      // does NOT enforce knowledge of the current password — without this step
      // anyone with a hijacked session can lock the user out. Faille B8.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwords.current,
      });
      if (reauthError) {
        toast.error('Mot de passe actuel incorrect');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) { console.error('[SettingsPage] password update:', error); toast.error(t('security.updateError')); return; }
      toast.success(t('security.updated'));
      setPasswords({ current: '', new: '', confirm: '' });
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = () => {
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
            toast.error(t('security.deleteFailed'), {
              description: t('security.deleteFailedHint'),
            });
            return;
          }
          toast.success(t('security.accountDeleted'));
          await logout();
          navigate('/');
        } catch {
          toast.error(t('security.networkError'), {
            description: t('security.networkErrorHint'),
          });
        } finally {
          setDeletingAccount(false);
        }
      },
    });
    setConfirmInput('');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation extraite dans lib/avatar-upload.ts (pur, testé — faille V5).
    const verdict = validateAvatarFile(file);
    if (!verdict.ok) {
      if (verdict.reason === 'type') {
        toast.error(t('profile.unsupportedFormat'), { description: t('profile.unsupportedFormatHint') });
      } else {
        toast.error('Image trop grande', { description: 'Taille maximale : 500 Ko.' });
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        toast.error('Fichier invalide');
        return;
      }
      const img = new Image();
      img.onload = async () => {
        const dims = computeAvatarDimensions(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { toast.error(t('profile.photoUpdateFailed')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Persist avatar to the same source the UI reads from. In demo mode
        // that's localStorage via useUpdateUserSettings; in prod that's le
        // bucket Storage `avatars`. L'ancien chemin écrivait toujours dans
        // localStorage, que `useAuth` ne lit jamais → perte silencieuse au
        // rechargement. Faille B7.
        if (isDemo) {
          // La démo n'a pas de backend : la data URL reste locale et ne part
          // dans aucun JWT — le problème AUD-04 ne s'y pose pas.
          updateUserSettings({ avatar: canvas.toDataURL('image/jpeg', 0.85) });
        } else {
          // AUD-04 — on n'écrit PLUS la data URL dans user_metadata (elle
          // finissait dans le JWT de chaque requête). On uploade dans Storage
          // et on ne persiste que l'URL publique, courte et sur un hôte
          // autorisé par l'allowlist serveur d'AUD-03 (mig. 084).
          const blob = await canvasToAvatarBlob(canvas);
          if (!blob) { toast.error(t('profile.photoUpdateFailed')); return; }
          const authUser = await getCurrentUser();
          if (!authUser) { toast.error(t('profile.photoUpdateFailed')); return; }

          const publicUrl = await uploadAvatar(supabase, authUser.id, blob);
          if (!publicUrl) { toast.error(t('profile.photoUpdateFailed')); return; }

          const { error } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
          if (error) { toast.error(t('profile.photoUpdateFailed')); return; }
          // Mirror to `profiles` so other users can see the updated avatar
          // (auth.user_metadata is private and not visible to other users).
          // `profiles.id` / `.email` / `.account_type` sont verrouillés côté
          // serveur (mig. 083, faille H-1) : seul l'avatar est modifiable ici.
          // La ligne existe toujours (créée par le trigger sur auth.users).
          await supabase.from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', authUser.id);
        }
        toast.success(t('profile.photoUpdated'));
      };
      img.onerror = () => toast.error('Image illisible');
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setConfirmConfig({
      isOpen: true, title: t('profile.deletePhotoTitle'),
      description: t('profile.deletePhotoBody'),
      variant: 'destructive',
      onConfirm: async () => {
        if (isDemo) {
          updateUserSettings({ avatar: undefined });
        } else {
          const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
          if (error) { toast.error('Impossible de supprimer la photo'); return; }
          // Also clear in profiles so friends see the removal immediately.
          // Idem : colonnes d'identité verrouillées (mig. 083, faille H-1).
          const authUser = await getCurrentUser();
          if (authUser) {
            await supabase.from('profiles')
              .update({ avatar_url: null })
              .eq('id', authUser.id);
          }
        }
        toast.success(t('profile.photoDeleted'));
      },
    });
  };

  const handleLogout = () => {
    setConfirmConfig({
      isOpen: true, title: t('logout.title'), description: t('logout.body'),
      variant: 'default',
      onConfirm: () => { logout(); toast.success(t('logout.success')); navigate('/'); },
    });
  };

  const handleOpenSupport = () => {
    window.location.href = 'mailto:axellongattepro@gmail.com';
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    // pb mobile : 64px tab bar + 88px pour que le FAB quick-add ne masque
    // jamais le bouton « Sauvegarder » en bas de page (parité HabitsPage).
    <div
      className="min-h-[100dvh] lg:h-full lg:min-h-0 bg-[rgb(var(--color-background))] transition-colors duration-300 flex pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-0">

      {/* ──────── SIDEBAR ──────── */}
      <motion.aside
        className="hidden lg:flex w-72 shrink-0 border-r border-[rgb(var(--color-border))] flex-col sticky top-0"
        style={{ background: 'rgb(var(--color-surface))' }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="p-5 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 group/av cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-violet-600 flex items-center justify-center text-[rgb(var(--color-accent-solid-foreground))] text-sm font-bold select-none">
                {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  : <span>{initials}</span>}
              </div>
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-[rgb(var(--color-text-secondary))] truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey}>
              <p className="px-3 mb-1.5 text-caption font-bold uppercase tracking-[0.18em] text-[rgb(var(--color-text-secondary))]">{t(group.labelKey)}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ minHeight: '44px' }}
                      className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                        active ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))]'
                          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] hover:text-[rgb(var(--color-text-primary))]'}`}>
                      <Icon size={15} className={active ? 'text-[rgb(var(--color-accent))]' : ''} strokeWidth={active ? 2.5 : 2} />
                      {t(item.labelKey)}
                      {active && (
                        <motion.span layoutId="pill"
                          className="absolute inset-0 rounded-xl bg-[rgb(var(--color-accent))]/10"
                          style={{ zIndex: -1 }} transition={{ duration: 0.18, ease: 'easeOut' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[rgb(var(--color-border))]">
          <button onClick={handleLogout} style={{ minHeight: '44px' }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-red-500/8 hover:text-red-500 transition-all duration-150 group">
            <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            {t('page.logout')}
          </button>
        </div>
      </motion.aside>

      {/* ──────── MAIN CONTENT ──────── */}
      <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-12">
        <div className="mb-8 max-w-3xl">
          <PageHeading variant="standard" className="tracking-tight">
            {t('page.title')}
          </PageHeading>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            {t('page.subtitle')}
          </p>
        </div>

        {/* mobile nav tabs */}
        <div className="lg:hidden flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl mb-6 overflow-x-auto">
          {NAV_GROUPS.flatMap(g => g.items).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 min-h-touch rounded-lg text-xs font-semibold transition-all duration-150 ${
                  active ? 'bg-[#1f6feb] text-white shadow-sm' // #58a6ff ne passe pas le contraste AA (2.5:1) avec du texte blanc
                    : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'}`}>
                <Icon size={13} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>

        {/* `mode="wait"` retiré : sous prefers-reduced-motion, l'exit de
            l'onglet sortant ne signale jamais sa fin à AnimatePresence (bug
            Framer Motion), donc le nouvel onglet ne montait jamais — les
            onglets restaient bloqués sur Profil. Sans `wait`, le nouvel
            onglet monte immédiatement ; l'ancien continue son exit en
            parallèle (ou reste figé sans bloquer l'affichage si son
            exit-complete ne se déclenche pas). */}
        <AnimatePresence mode={prefersReducedMotion ? undefined : 'wait'}>

          {/* ── PROFIL ── */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              // Deux colonnes à partir de `lg` : le groupe Entreprise vit à
              // DROITE des cartes d'identité, pas empilé sous le fuseau
              // horaire où il fallait scroller pour le trouver. `items-start`
              // pour que la colonne courte ne s'étire pas à la hauteur de
              // l'autre. Une seule colonne sous `lg` (ordre inchangé).
              className="max-w-2xl lg:max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-5 items-start">
              <div className="flex flex-col gap-5">
              <SectionCard>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="relative group/av shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-violet-600 flex items-center justify-center text-[rgb(var(--color-accent-solid-foreground))] text-2xl font-bold shadow-sm select-none">
                      {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        : <span>{initials}</span>}
                    </div>
                    {/* Overlay icon-only : sans aria-label, axe-core le remonte
                        en violation `button-name` d'impact CRITICAL (WCAG 4.1.2)
                        et le guard a11y CI casse. */}
                    <button onClick={() => fileInputRef.current?.click()}
                      aria-label="Changer la photo de profil"
                      className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={18} className="text-white" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{user.name}</h2>
                    <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      <button onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-[36px] border border-[rgb(var(--color-border))] rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] transition-all duration-150">
                        <Camera size={12} /> Changer la photo
                      </button>
                      {user.avatar && (
                        <button onClick={handleRemoveAvatar}
                          className="inline-flex items-center gap-1.5 px-4 min-h-touch sm:min-h-[36px] border border-red-200 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-150">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
              <SectionCard>
                <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-5">{t('profile.heading')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LabeledInput label="Nom complet" icon={User} value={profileDraft.name} onChange={(e) => setProfileDraft(p => ({ ...p, name: e.target.value }))} placeholder="Votre nom" />
                  <LabeledInput label={t('profile.emailLabel')} type="email" icon={Mail} value={profileDraft.email} onChange={(e) => setProfileDraft(p => ({ ...p, email: e.target.value }))} placeholder={t('profile.emailPlaceholder')} disabled={isThirdParty} hint={isThirdParty ? t('profile.emailManaged') : undefined} />
                </div>
                <div className="flex justify-end mt-5">
                  <PrimaryButton onClick={handleSaveProfile} loading={savingProfile}>{savingProfile ? 'Sauvegarde…' : 'Sauvegarder'}</PrimaryButton>
                </div>
              </SectionCard>

              {/* ── Fuseau horaire d'affichage ── */}
              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))]">{t('timezone.heading')}</h2>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-4">
                  {t('timezone.description')}
                </p>
                <div className="flex flex-col gap-2.5">
                  {/* Option : heure par défaut (locale) */}
                  <button
                    type="button"
                    onClick={() => setTzMode('default')}
                    style={{ minHeight: '56px' }}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      tzPref.mode === 'default'
                        ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/8'
                        : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/40'
                    }`}
                    aria-pressed={tzPref.mode === 'default'}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('timezone.defaultTitle')}</p>
                      <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{t('timezone.defaultHint')}</p>
                    </div>
                    <span className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                      tzPref.mode === 'default'
                        ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]'
                        : 'border-[rgb(var(--color-border))]'
                    }`} />
                  </button>

                  {/* Option : heure personnalisée (UTC+N) */}
                  <button
                    type="button"
                    onClick={() => setTzMode('manual')}
                    style={{ minHeight: '56px' }}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      tzPref.mode === 'manual'
                        ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/8'
                        : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/40'
                    }`}
                    aria-pressed={tzPref.mode === 'manual'}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('timezone.customTitle')}</p>
                      <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{t('timezone.customHint')}</p>
                    </div>
                    <span className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                      tzPref.mode === 'manual'
                        ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]'
                        : 'border-[rgb(var(--color-border))]'
                    }`} />
                  </button>

                  {tzPref.mode === 'manual' && (() => {
                    // Signe + magnitude dérivés du décalage signé stocké (ex. -5 →
                    // signe '-', magnitude 5). L'utilisateur choisit le signe via
                    // un toggle +/− et la magnitude via le champ numérique ; les
                    // deux se recombinent en un offsetHours signé unique.
                    const sign: '+' | '-' = tzPref.offsetHours < 0 ? '-' : '+';
                    const magnitude = Math.abs(tzPref.offsetHours);
                    const applySign = (nextSign: '+' | '-') =>
                      setTzOffset(clampOffsetHours(nextSign === '-' ? -magnitude : magnitude));
                    const applyMagnitude = (nextMagnitude: number) =>
                      setTzOffset(clampOffsetHours(sign === '-' ? -nextMagnitude : nextMagnitude));
                    return (
                      <div className="flex items-center gap-2 pl-1 pt-1">
                        <label htmlFor="tz-offset" className="text-sm text-[rgb(var(--color-text-secondary))]">{t('timezone.offsetLabel')}</label>

                        {/* Toggle du signe : UTC+ (est de Greenwich) / UTC- (ouest) */}
                        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden" role="group" aria-label={t('timezone.offsetSign')}>
                          <button
                            type="button"
                            onClick={() => applySign('+')}
                            aria-pressed={sign === '+'}
                            className={`px-3 min-h-touch sm:min-h-9 text-sm font-semibold transition-colors ${
                              sign === '+'
                                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                                : 'bg-[rgb(var(--color-background))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                            }`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => applySign('-')}
                            aria-pressed={sign === '-'}
                            className={`px-3 min-h-touch sm:min-h-9 text-sm font-semibold border-l border-[rgb(var(--color-border))] transition-colors ${
                              sign === '-'
                                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                                : 'bg-[rgb(var(--color-background))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                            }`}
                          >
                            −
                          </button>
                        </div>

                        <div className="inline-flex items-stretch rounded-lg border border-[rgb(var(--color-border))] overflow-hidden focus-within:ring-2 focus-within:ring-[rgb(var(--color-accent))]/30">
                          <span className="inline-flex items-center px-3 bg-[rgb(var(--color-hover))] text-sm font-semibold text-[rgb(var(--color-text-primary))] select-none">
                            UTC{sign}
                          </span>
                          <input
                            id="tz-offset"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={sign === '-' ? 12 : 14}
                            step={1}
                            value={magnitude}
                            onChange={(e) => applyMagnitude(Number(e.target.value))}
                            className="w-16 px-3 min-h-touch sm:min-h-9 bg-[rgb(var(--color-background))] text-sm font-semibold text-[rgb(var(--color-text-primary))] outline-none"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </SectionCard>

              </div>

              {/* Mode entreprise : carte info (membre) ou conversion (particulier). */}
              <div className="flex flex-col gap-5">
                <SectionCard>
                  <OrganizationSettingsCard />
                </SectionCard>
              </div>
            </motion.div>
          )}

          {/* ── SÉCURITÉ ── */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{t('security.heading')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-5">{t('security.hint')}</p>
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                  <LabeledInput label="Mot de passe actuel" showToggle value={passwords.current} onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))} placeholder="••••••••••••" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <LabeledInput label="Nouveau mot de passe" showToggle value={passwords.new} onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder="••••••••••••" />
                    <LabeledInput label="Confirmer" showToggle value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••••••" />
                  </div>
                  <div className="flex justify-end pt-1">
                    <PrimaryButton type="submit" loading={savingPassword}>{savingPassword ? t('security.updating') : t('security.update')}</PrimaryButton>
                  </div>
                </form>
              </SectionCard>
              <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-red-600 dark:text-red-500">{t('security.dangerZone')}</h2>
                    <p className="text-xs text-red-500/70 mt-1">{t('security.dangerHint')}</p>
                  </div>
                  <button onClick={handleDeleteAccount} style={{ minHeight: '44px' }}
                    className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-[0.97] transition-all duration-150">
                    Supprimer le compte
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── APPARENCE ── */}
          {activeTab === 'appearance' && (
            <motion.div key="appearance" initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl">
              <SectionCard>
                <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">{t('appearance.heading')}</h2>
                <p className="text-xs text-[rgb(var(--color-text-secondary))] mb-5">{t('appearance.hint')}</p>
                <div style={{ minHeight: '72px' }}
                  className="flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('appearance.displayMode')}</p>
                    <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{user?.email?.endsWith('@thecosmo.app') ? t('appearance.themeListTest') : t('appearance.themeList')}</p>
                  </div>
                  <ThemeToggle showLabel />
                </div>

                {/* Rappel habitudes du soir (#24) — opt-in */}
                <div style={{ minHeight: '72px' }}
                  className="mt-3 flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('appearance.eveningReminder')}</p>
                    <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">{t('appearance.eveningReminderHint')}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={habitReminderEnabled}
                    aria-label="Activer le rappel habitudes du soir"
                    onClick={() => setHabitReminderEnabled(!habitReminderEnabled)}
                    className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      habitReminderEnabled ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md transition-all duration-200"
                      style={{ left: habitReminderEnabled ? 'calc(100% - 29px)' : '2px' }}
                    />
                  </button>
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
          )}

          {/* ── DONNÉES ── */}
          {activeTab === 'data' && <DataTab />}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
            <motion.div key="guide" initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-3xl flex flex-col gap-4">

              <div>
                <h2 className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1">
                  Guide d'utilisation
                </h2>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {t('help.intro')}
                </p>
              </div>

              <div
                className="flex flex-col gap-6 p-6 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)' }}
              >
                <div>
                  <p className="text-base font-bold text-[rgb(var(--color-text-primary))]">{t('help.guideTitle')}</p>
                  <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">{t('help.guideHint')}</p>
                </div>
                <button
                  onClick={() => navigate('/guide')}
                  style={{ minHeight: '48px' }}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] rounded-xl text-sm font-semibold active:scale-[0.97] transition-all duration-150"
                >
                  Ouvrir le guide <ChevronRight size={15} />
                </button>
              </div>

              {/* support card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-violet-600 flex items-center justify-center shrink-0">
                    <HelpCircle size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('help.supportTitle')}</p>
                    <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('help.supportHint')}</p>
                  </div>
                </div>
                <button onClick={handleOpenSupport}
                  className="inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-[40px] rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
                  Contacter le support <ChevronRight size={12} />
                </button>
              </div>

              {/* admin card — visible uniquement pour l'allowlist admin_users
                  (useIsAdmin). Le vrai gate reste la RPC get_admin_stats. */}
              {isAdmin && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                      <BarChart3 size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('help.adminTitle')}</p>
                      <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('help.adminHint')}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/admin')}
                    className="inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-[40px] rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
                    Ouvrir le dashboard <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── confirm dialog ── */}
      <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">{confirmConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmConfig.showInput && (
            <div className="py-2">
              <input type="text" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Tapez "${confirmConfig.confirmationText}"`}
                style={{ minHeight: '48px' }}
                className="w-full px-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl font-semibold text-[rgb(var(--color-text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 outline-none" />
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">{t('page.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                deletingAccount ||
                (confirmConfig.showInput && confirmInput !== confirmConfig.confirmationText)
              }
              onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(prev => ({ ...prev, isOpen: false })); }}
              className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {deletingAccount ? 'Suppression…' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;

