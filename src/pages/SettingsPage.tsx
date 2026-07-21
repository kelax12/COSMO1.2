import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, LogOut,
  HelpCircle, Monitor, Camera,
  Mail, ChevronRight, Repeat, BarChart3, Keyboard, Clock,
} from 'lucide-react';
import { useTimezonePref, clampOffsetHours } from '@/lib/timezone';
import { ShortcutsList } from '../components/keyboard-shortcuts';
import { useIsAdmin } from '@/modules/admin';
import { useHabitReminderPref } from '@/modules/ui-states';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { useUpdateUserSettings } from '../modules/user';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { sanitizeEmail, isValidEmail } from '@/lib/email';
import { validateAvatarFile, computeAvatarDimensions } from '@/lib/avatar-upload';
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

  const { user, logout, isDemo } = useAuth();
  const { pref: tzPref, setMode: setTzMode, setOffsetHours: setTzOffset } = useTimezonePref();
  const isAdmin = useIsAdmin();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
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
    if (!name) { toast.error('Le nom ne peut pas être vide'); return; }
    if (!email) { toast.error("L'email ne peut pas être vide"); return; }
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
        toast.success('Profil mis à jour (mode démo)');
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
        let message = 'Impossible de mettre à jour le profil';
        if (code === 'email_exists' || status === 422) {
          message = 'Cette adresse email est déjà utilisée par un autre compte.';
        } else if (code === 'email_address_invalid') {
          message = "Cette adresse email n'est pas valide.";
        } else if (code === 'over_email_send_rate_limit' || status === 429) {
          message = 'Trop de tentatives. Réessayez dans quelques minutes.';
        }
        toast.error(message);
        return;
      }
      if (payload.email) {
        toast.success('Profil mis à jour — vérifiez votre boîte mail pour confirmer le changement d\'email.');
      } else {
        toast.success('Profil mis à jour !');
      }
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingProfile(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) { toast.error('Veuillez remplir tous les champs'); return; }
    if (passwords.new !== passwords.confirm) { toast.error('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (passwords.new.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return; }
    if (passwords.current === passwords.new) { toast.error('Le nouveau mot de passe doit différer de l\'actuel'); return; }
    setSavingPassword(true);
    try {
      if (!supabase) { toast.error('Service non disponible'); return; }
      if (isDemo) { toast.info('Changement de mot de passe désactivé en mode démo'); return; }
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
      if (error) { console.error('[SettingsPage] password update:', error); toast.error('Erreur lors de la mise à jour du mot de passe'); return; }
      toast.success('Mot de passe mis à jour !');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer le compte ?',
      description: 'Cette action est irréversible. Toutes vos données (tâches, habitudes, OKRs, événements, amis) seront supprimées définitivement. Tapez "DELETE" pour confirmer.',
      variant: 'destructive', showInput: true, confirmationText: 'DELETE',
      onConfirm: async () => {
        setDeletingAccount(true);
        try {
          if (isDemo) {
            toast.success('Compte démo effacé');
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
            toast.error('La suppression automatique a échoué', {
              description: 'Contactez axellongattepro@gmail.com — votre demande sera traitée manuellement.',
            });
            return;
          }
          toast.success('Compte supprimé');
          await logout();
          navigate('/');
        } catch {
          toast.error('Erreur réseau', {
            description: 'Réessayez ou contactez axellongattepro@gmail.com.',
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
        toast.error('Format non supporté', { description: 'Utilisez JPEG, PNG, WebP ou GIF.' });
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
        const dataUrl = ctx
          ? (ctx.drawImage(img, 0, 0, canvas.width, canvas.height), canvas.toDataURL('image/jpeg', 0.85))
          : result;
        // Persist avatar to the same source the UI reads from. In demo mode
        // that's localStorage via useUpdateUserSettings; in prod that's the
        // Supabase user_metadata. The old path always wrote to localStorage
        // which `useAuth` never reads → silent loss on reload. Faille B7.
        if (isDemo) {
          updateUserSettings({ avatar: dataUrl });
        } else {
          const { error } = await supabase.auth.updateUser({ data: { avatar_url: dataUrl } });
          if (error) { toast.error('Impossible de mettre à jour la photo'); return; }
          // Mirror to `profiles` so other users can see the updated avatar
          // (auth.user_metadata is private and not visible to other users).
          await supabase.from('profiles').upsert({
            id: (await supabase.auth.getUser()).data.user?.id,
            email: (await supabase.auth.getUser()).data.user?.email,
            avatar_url: dataUrl,
          });
        }
        toast.success('Photo de profil mise à jour');
      };
      img.onerror = () => toast.error('Image illisible');
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer la photo ?',
      description: 'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
      variant: 'destructive',
      onConfirm: async () => {
        if (isDemo) {
          updateUserSettings({ avatar: undefined });
        } else {
          const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
          if (error) { toast.error('Impossible de supprimer la photo'); return; }
          // Also clear in profiles so friends see the removal immediately.
          await supabase.from('profiles').upsert({
            id: (await supabase.auth.getUser()).data.user?.id,
            email: (await supabase.auth.getUser()).data.user?.email,
            avatar_url: null,
          });
        }
        toast.success('Photo supprimée');
      },
    });
  };

  const handleLogout = () => {
    setConfirmConfig({
      isOpen: true, title: 'Déconnexion ?', description: 'Voulez-vous vraiment vous déconnecter ?',
      variant: 'default',
      onConfirm: () => { logout(); toast.success('Déconnexion réussie'); navigate('/'); },
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
        className="hidden lg:flex w-72 shrink-0 border-r border-[rgb(var(--color-border))] flex-col sticky top-0 h-full max-h-full overflow-y-auto"
        style={{ background: 'rgb(var(--color-surface))' }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="p-5 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 group/av cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold select-none">
                {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  : <span>{initials}</span>}
              </div>
              <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))] truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--color-text-muted))]">{group.label}</p>
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
                      {item.label}
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
            Déconnexion
          </button>
        </div>
      </motion.aside>

      {/* ──────── MAIN CONTENT ──────── */}
      <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-12">
        <div className="mb-8 max-w-3xl">
          <PageHeading variant="standard" className="tracking-tight">
            Paramètres
          </PageHeading>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            Gérez votre compte, sécurité et préférences.
          </p>
        </div>

        {/* mobile nav tabs */}
        <div className="lg:hidden flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl mb-6 overflow-x-auto">
          {NAV_GROUPS.flatMap(g => g.items).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ minHeight: '36px' }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  active ? 'bg-[rgb(var(--color-accent))] text-white monochrome:text-zinc-900 shadow-sm'
                    : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'}`}>
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── PROFIL ── */}
          {activeTab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="relative group/av shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm select-none">
                      {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        : <span>{initials}</span>}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={18} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{user.name}</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      <button onClick={() => fileInputRef.current?.click()} style={{ minHeight: '36px' }}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-[rgb(var(--color-border))] rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] transition-all duration-150">
                        <Camera size={12} /> Changer la photo
                      </button>
                      {user.avatar && (
                        <button onClick={handleRemoveAvatar} style={{ minHeight: '36px' }}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-red-200 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all duration-150">
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
              <SectionCard>
                <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-5">Informations personnelles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LabeledInput label="Nom complet" icon={User} value={profileDraft.name} onChange={(e) => setProfileDraft(p => ({ ...p, name: e.target.value }))} placeholder="Votre nom" />
                  <LabeledInput label="Adresse email" type="email" icon={Mail} value={profileDraft.email} onChange={(e) => setProfileDraft(p => ({ ...p, email: e.target.value }))} placeholder="votre@email.com" disabled={isThirdParty} hint={isThirdParty ? 'Email géré par votre connexion externe — non modifiable ici.' : undefined} />
                </div>
                <div className="flex justify-end mt-5">
                  <PrimaryButton onClick={handleSaveProfile} loading={savingProfile}>{savingProfile ? 'Sauvegarde…' : 'Sauvegarder'}</PrimaryButton>
                </div>
              </SectionCard>

              {/* ── Fuseau horaire d'affichage ── */}
              <SectionCard>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={16} className="text-[rgb(var(--color-accent))]" aria-hidden="true" />
                  <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">Fuseau horaire</h3>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-4">
                  Choisissez le fuseau utilisé pour afficher les heures de l'agenda et de vos événements.
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
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Heure par défaut</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">Fuseau automatique de votre appareil</p>
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
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Heure personnalisée</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">Fixez un décalage UTC</p>
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
                        <label htmlFor="tz-offset" className="text-sm text-[rgb(var(--color-text-secondary))]">Décalage :</label>

                        {/* Toggle du signe : UTC+ (est de Greenwich) / UTC- (ouest) */}
                        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden" role="group" aria-label="Signe du décalage">
                          <button
                            type="button"
                            onClick={() => applySign('+')}
                            aria-pressed={sign === '+'}
                            className={`px-3 py-2 text-sm font-semibold transition-colors ${
                              sign === '+'
                                ? 'bg-[rgb(var(--color-accent))] text-white'
                                : 'bg-[rgb(var(--color-background))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                            }`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => applySign('-')}
                            aria-pressed={sign === '-'}
                            className={`px-3 py-2 text-sm font-semibold border-l border-[rgb(var(--color-border))] transition-colors ${
                              sign === '-'
                                ? 'bg-[rgb(var(--color-accent))] text-white'
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
                            className="w-16 px-3 py-2 bg-[rgb(var(--color-background))] text-sm font-semibold text-[rgb(var(--color-text-primary))] outline-none"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </SectionCard>

              {/* Mode entreprise : carte info (membre) ou conversion (particulier). */}
              <SectionCard>
                <OrganizationSettingsCard />
              </SectionCard>
            </motion.div>
          )}

          {/* ── SÉCURITÉ ── */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Changer le mot de passe</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-5">Minimum 8 caractères. Utilisez un mélange de lettres, chiffres et symboles.</p>
                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                  <LabeledInput label="Mot de passe actuel" showToggle value={passwords.current} onChange={(e) => setPasswords(p => ({ ...p, current: e.target.value }))} placeholder="••••••••••••" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <LabeledInput label="Nouveau mot de passe" showToggle value={passwords.new} onChange={(e) => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder="••••••••••••" />
                    <LabeledInput label="Confirmer" showToggle value={passwords.confirm} onChange={(e) => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••••••" />
                  </div>
                  <div className="flex justify-end pt-1">
                    <PrimaryButton type="submit" loading={savingPassword}>{savingPassword ? 'Mise à jour…' : 'Mettre à jour'}</PrimaryButton>
                  </div>
                </form>
              </SectionCard>
              <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-red-600 dark:text-red-500">Zone de danger</h3>
                    <p className="text-xs text-red-500/70 mt-1">Supprimer définitivement votre compte et toutes vos données.</p>
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
            <motion.div key="appearance" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl">
              <SectionCard>
                <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Thème de l'interface</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-5">Choisissez l'apparence qui vous convient le mieux.</p>
                <div style={{ minHeight: '72px' }}
                  className="flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] group-hover:scale-105 transition-transform">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Mode d'affichage</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">{user?.email?.endsWith('@thecosmo.app') ? 'Clair · Sombre · Noir · Test' : 'Clair · Sombre · Noir'}</p>
                    </div>
                  </div>
                  <ThemeToggle showLabel />
                </div>

                {/* Rappel habitudes du soir (#24) — opt-in */}
                <div style={{ minHeight: '72px' }}
                  className="mt-3 flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                      <Repeat size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Rappel habitudes du soir</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">Après 18 h, un bandeau signale les habitudes non cochées</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={habitReminderEnabled}
                    aria-label="Activer le rappel habitudes du soir"
                    onClick={() => setHabitReminderEnabled(!habitReminderEnabled)}
                    className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      habitReminderEnabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md transition-all duration-200"
                      style={{ left: habitReminderEnabled ? 'calc(100% - 29px)' : '2px' }}
                    />
                  </button>
                </div>
              </SectionCard>

              {/* Raccourcis clavier — copie du contenu du popup « ? »,
                  consultable sans avoir à ouvrir la palette. Source partagée
                  (components/keyboard-shortcuts) pour ne jamais diverger. */}
              <SectionCard className="mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Keyboard size={16} className="text-[rgb(var(--color-accent))]" aria-hidden="true" />
                  <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">Raccourcis clavier</h3>
                </div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] -mt-2 mb-3">
                  Aussi accessibles à tout moment avec la touche <kbd className="px-1.5 py-0.5 rounded border text-[11px]" style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-hover))' }}>?</kbd>.
                </p>
                <ShortcutsList compact />
              </SectionCard>
            </motion.div>
          )}

          {/* ── DONNÉES ── */}
          {activeTab === 'data' && <DataTab />}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-3xl flex flex-col gap-4">

              <div>
                <h2 className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1">
                  Guide d'utilisation
                </h2>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Tout ce qu'il faut savoir pour maîtriser chaque fonctionnalité de Cosmo.
                </p>
              </div>

              <div
                className="flex flex-col gap-6 p-6 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)' }}
              >
                <div>
                  <p className="text-base font-bold text-[rgb(var(--color-text-primary))]">Guide complet</p>
                  <p className="text-sm text-[rgb(var(--color-text-muted))] mt-0.5">Tâches, Agenda, Habitudes, OKR, Statistiques, Premium — tout y est.</p>
                </div>
                <button
                  onClick={() => navigate('/guide')}
                  style={{ minHeight: '48px' }}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold active:scale-[0.97] transition-all duration-150"
                >
                  Ouvrir le guide <ChevronRight size={15} />
                </button>
              </div>

              {/* support card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
                    <HelpCircle size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Besoin d'aide ?</p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">Notre équipe répond sous 24h.</p>
                  </div>
                </div>
                <button onClick={handleOpenSupport} style={{ minHeight: '40px' }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
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
                      <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Stats COSMO</p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))]">Croissance, activité et conversion — réservé admin.</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/admin')} style={{ minHeight: '40px' }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
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
            <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">Annuler</AlertDialogCancel>
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
