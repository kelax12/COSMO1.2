import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { useIsAdmin } from '@/modules/admin';
import { useNavigate } from 'react-router';
import { useAuth, type User } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Atomes présentationnels + nav dans ./settings/primitives ; un fichier par
// onglet (./settings/*Tab) et pour la navigation (./settings/SettingsNav).
import { type SettingsTab, SectionCard } from './settings/primitives';
import { DataTab } from './settings/DataTab';
import ProfileTab, { type ProfileDraft } from './settings/ProfileTab';
import SecurityTab, { type PasswordsDraft } from './settings/SecurityTab';
import AppearanceTab from './settings/AppearanceTab';
import GuideTab from './settings/GuideTab';
import { SettingsSidebar, SettingsTabPills } from './settings/SettingsNav';
import TimezoneSection from './settings/TimezoneSection';
import MobileSettingsHome, { MobileSettingsBack, type MobileSettingsPage } from './settings/MobileSettingsHome';
import { useAvatarActions } from './settings/useAvatarUpload';
import { useAccountActions, type ConfirmConfig } from './settings/useAccountActions';
import OrganizationSettingsCard from '@/components/organization/OrganizationSettingsCard';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import { CONTACT_EMAIL } from '@/lib/contact.mjs';

/** Compte OAuth (fournisseur autre que l'email), hors démo. */
const isThirdPartyAccount = (user: User | null, isDemo: boolean) =>
  !isDemo && !!user?.provider && user.provider !== 'email';

/* ─── main component ───────────────────────────────────────────── */
const SettingsPage: React.FC = () => {
  const { t } = useT('settings');
  const { user, logout, isDemo, updateDemoProfile } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  // Mobile (maquette 205) : `null` = l'accueil en liste groupée.
  const [mobilePage, setMobilePage] = useState<MobileSettingsPage | null>(null);
  const openMobile = (page: MobileSettingsPage | null) => {
    setMobilePage(page);
    if (page && page !== 'timezone' && page !== 'org') setActiveTab(page);
    window.scrollTo(0, 0);
  };
  const showTabContent = !isMobile || (mobilePage !== null && mobilePage !== 'timezone' && mobilePage !== 'org');
  // Sous prefers-reduced-motion, l'exit d'un onglet ne signale jamais sa fin
  // à AnimatePresence (bug Framer Motion) : le panneau sortant reste dans le
  // DOM (invisible mais toujours focusable) et bloque le nouvel onglet en
  // mode="wait". Sans `exit`/`initial`, le montage/démontage redevient
  // synchrone — comportement identique à un rendu conditionnel classique.
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { handleAvatarUpload, removeAvatarEverywhere } = useAvatarActions({
    isDemo,
    updateDemoProfile,
    t,
  });

  // Third-party (OAuth) accounts manage their email upstream (e.g. Google) —
  // editing it here is locked. Native email/password (and demo) accounts can
  // change their email inline. `provider` comes from Supabase app_metadata.
  const isThirdParty = isThirdPartyAccount(user, isDemo);

  // Les cinq gestes qui touchent au compte, et l'unique boîte de confirmation
  // qu'ils partagent — cf. `useAccountActions` pour les deux règles de sécurité
  // qu'ils portent (vérification de l'ancien mot de passe, révocation des
  // autres sessions).
  const {
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
  } = useAccountActions({
    user,
    isDemo,
    isThirdParty,
    logout,
    navigate,
    updateDemoProfile,
    removeAvatarEverywhere,
    t,
  });

  const [passwords, setPasswords] = useState<PasswordsDraft>({ current: '', new: '', confirm: '' });

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await updatePassword(passwords)) setPasswords({ current: '', new: '', confirm: '' });
  };

  // Local edit state for the profile form. The inputs are now controlled
  // independently from `user.*` (which is the Supabase session truth) so
  // typing has a visible effect, and we push the change to Supabase on save
  // rather than to a localStorage key the production identity never reads.
  // Faille B7.
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ name: '', email: '' });
  useEffect(() => {
    if (user) setProfileDraft({ name: user.name, email: user.email });
    // Deps primitives volontaires (plus précises que l'objet user entier).
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    deps primitives plutot que l objet `user` entier : strictement PLUS
       precises que ce qu ESLint demande. Les trois champs lus (`id`, `name`,
       `email`) y figurent nommement, aucun ne peut perimer ; l objet, lui,
       churne a chaque rafraichissement de session. */
  }, [user?.id, user?.name, user?.email]);

  if (!user) return null;

  const handleOpenSupport = () => {
    window.location.href = `mailto:${CONTACT_EMAIL}`;
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const pickPhoto = () => fileInputRef.current?.click();

  return (
    // pb mobile : 64px tab bar + 88px pour que le FAB quick-add ne masque
    // jamais le bouton « Sauvegarder » en bas de page (parité HabitsPage).
    <div
      className="min-h-[100dvh] lg:h-full lg:min-h-0 bg-[rgb(var(--color-background))] transition-colors duration-300 flex pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-0">

      {/* ──────── SIDEBAR ──────── */}
      <SettingsSidebar
        user={user}
        initials={initials}
        fileInputRef={fileInputRef}
        onAvatarUpload={handleAvatarUpload}
        activeTab={activeTab}
        onSelect={setActiveTab}
        onLogout={confirmLogout}
      />

      {/* ──────── MAIN CONTENT ──────── */}
      <main className="flex-1 min-w-0 pt-4 pb-10 md:py-10 px-gutter sm:px-8 lg:px-12">
        <SettingsMobileShell isMobile={isMobile} page={mobilePage} user={user} initials={initials} onOpen={openMobile} onLogout={confirmLogout} />
        <div className="mb-8 max-w-3xl hidden md:block">
          <PageHeading variant="standard" className="tracking-tight">
            {t('page.title')}
          </PageHeading>
        </div>

        {/* Entre `md` et `lg` : la bande de pilules commune (maquette 83). */}
        {!isMobile && <SettingsTabPills activeTab={activeTab} onSelect={setActiveTab} />}

        {/* `mode="wait"` retiré : sous prefers-reduced-motion, l'exit de
            l'onglet sortant ne signale jamais sa fin à AnimatePresence (bug
            Framer Motion), donc le nouvel onglet ne montait jamais — les
            onglets restaient bloqués sur Profil. Sans `wait`, le nouvel
            onglet monte immédiatement ; l'ancien continue son exit en
            parallèle (ou reste figé sans bloquer l'affichage si son
            exit-complete ne se déclenche pas). */}
        {showTabContent && <AnimatePresence mode={prefersReducedMotion ? undefined : 'wait'}>

          {/* ── PROFIL ── */}
          {activeTab === 'profile' && (
            <ProfileTab
              key="profile"
              reduced={prefersReducedMotion}
              user={user}
              initials={initials}
              onPickPhoto={pickPhoto}
              onRemoveAvatar={removeAvatar}
              draft={profileDraft}
              onDraftChange={setProfileDraft}
              isThirdParty={isThirdParty}
              onSave={() => saveProfile(profileDraft)}
              saving={savingProfile}
              isMobile={isMobile}
            />
          )}

          {/* ── SÉCURITÉ ── */}
          {activeTab === 'security' && (
            <SecurityTab key="security" reduced={prefersReducedMotion} passwords={passwords} onPasswordsChange={setPasswords} onSubmit={handleUpdatePassword} saving={savingPassword} onDeleteAccount={deleteAccount} />
          )}

          {/* ── APPARENCE ── */}
          {activeTab === 'appearance' && (
            <AppearanceTab key="appearance" reduced={prefersReducedMotion} isMobile={isMobile} email={user.email} />
          )}

          {/* ── DONNÉES ── */}
          {activeTab === 'data' && <DataTab />}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
            <GuideTab key="guide" reduced={prefersReducedMotion} isAdmin={isAdmin} onOpenGuide={() => navigate('/guide')} onOpenAdmin={() => navigate('/admin')} onOpenSupport={handleOpenSupport} />
          )}
        </AnimatePresence>}
      </main>

      <SettingsConfirmDialog
        config={confirmConfig}
        onClose={closeConfirm}
        input={confirmInput}
        onInputChange={setConfirmInput}
        deletingAccount={deletingAccount}
      />
    </div>
  );
};

/**
 * Accueil mobile (maquette 205) et pages qui ne sont pas des onglets :
 * `null` = l'accueil en liste groupée, sinon un retour au-dessus de la page.
 */
function SettingsMobileShell({ isMobile, page, user, initials, onOpen, onLogout }: {
  isMobile: boolean;
  page: MobileSettingsPage | null;
  user: User;
  initials: string;
  onOpen: (page: MobileSettingsPage | null) => void;
  onLogout: () => void;
}) {
  const { t } = useT('settings');
  return (
    <>
      {/* Maquette 206 : plus de sous-titre générique sur mobile. */}
      {(!isMobile || page === null) && <MobileHeader title={t('page.title')} />}
      {isMobile && page === null && (
        <MobileSettingsHome user={user} initials={initials} hasOrganization onOpen={onOpen} onLogout={onLogout} />
      )}
      {isMobile && page !== null && <MobileSettingsBack onBack={() => onOpen(null)} />}
      {isMobile && page === 'timezone' && <TimezoneSection />}
      {isMobile && page === 'org' && <SectionCard><OrganizationSettingsCard /></SectionCard>}
    </>
  );
}

/** L'unique boîte de confirmation des gestes du compte (cf. `useAccountActions`). */
function SettingsConfirmDialog({ config: confirmConfig, onClose: closeConfirm, input: confirmInput, onInputChange: setConfirmInput, deletingAccount }: {
  config: ConfirmConfig;
  onClose: () => void;
  input: string;
  onInputChange: (value: string) => void;
  deletingAccount: boolean;
}) {
  const { t } = useT('settings');
  return (
    <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => { if (!open) closeConfirm(); }}>
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
            onClick={() => { confirmConfig.onConfirm(); closeConfirm(); }}
            className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
            {deletingAccount ? 'Suppression…' : 'Confirmer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SettingsPage;

