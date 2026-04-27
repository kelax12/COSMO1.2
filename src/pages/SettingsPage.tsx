import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, BookOpen, LogOut,
  HelpCircle, Shield, Monitor, Camera,
  Eye, EyeOff, Loader2, Mail, ChevronRight,
  CheckSquare, Calendar, Activity, Target, BarChart2, Crown, ArrowUpRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/auth/AuthContext';
import { useUpdateUserSettings } from '../modules/user';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
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

type SettingsTab = 'profile' | 'appearance' | 'security' | 'guide';

/* ─── font loader ──────────────────────────────────────────────── */
function useFonts() {
  useEffect(() => {
    const id = 'settings-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

/* ─── nav config ───────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Compte',
    items: [
      { id: 'profile' as SettingsTab, icon: User, label: 'Profil' },
      { id: 'security' as SettingsTab, icon: Shield, label: 'Sécurité' },
    ],
  },
  {
    label: 'Préférences',
    items: [{ id: 'appearance' as SettingsTab, icon: Palette, label: 'Apparence' }],
  },
  {
    label: 'Aide',
    items: [{ id: 'guide' as SettingsTab, icon: BookOpen, label: 'Guide' }],
  },
];




/* ─── reusable: LabeledInput ───────────────────────────────────── */
function LabeledInput({
  label, type = 'text', value, onChange, placeholder, icon: Icon, showToggle,
}: {
  label: string; type?: string; value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; icon?: React.ElementType; showToggle?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const inputType = showToggle ? (visible ? 'text' : 'password') : type;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] tracking-wide">{label}</label>
      <div className="relative group">
        {Icon && (
          <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] group-focus-within:text-[rgb(var(--color-accent))] transition-colors pointer-events-none" />
        )}
        <input
          type={inputType} value={value} onChange={onChange} placeholder={placeholder}
          style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '48px' }}
          className={`w-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all duration-150 focus:border-[rgb(var(--color-accent))] focus:ring-2 focus:ring-[rgb(var(--color-accent))]/15 ${Icon ? 'pl-10' : 'pl-4'} ${showToggle ? 'pr-11' : 'pr-4'} py-3`}
        />
        {showToggle && (
          <button type="button" tabIndex={-1} onClick={() => setVisible(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors p-1"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── reusable: PrimaryButton ──────────────────────────────────── */
function PrimaryButton({ onClick, type = 'button', loading = false, children }: {
  onClick?: () => void; type?: 'button' | 'submit'; loading?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} type={type} disabled={loading}
      style={{ minHeight: '44px', fontFamily: "'DM Sans', sans-serif" }}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] rounded-xl text-sm font-semibold hover:opacity-85 active:scale-[0.97] transition-all duration-150 disabled:opacity-50">
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ─── reusable: SectionCard ────────────────────────────────────── */
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-5 flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}

/* ─── main component ───────────────────────────────────────────── */
const SettingsPage: React.FC = () => {
  useFonts();

  const { user, logout } = useAuth();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; title: string; description: string; onConfirm: () => void;
    variant: 'default' | 'destructive'; showInput?: boolean; confirmationText?: string;
  }>({ isOpen: false, title: '', description: '', onConfirm: () => {}, variant: 'default' });
  const [confirmInput, setConfirmInput] = useState('');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: user?.name } });
      if (error) { toast.error(error.message); return; }
      toast.success('Profil mis à jour !');
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingProfile(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) { toast.error('Veuillez remplir tous les champs'); return; }
    if (passwords.new !== passwords.confirm) { toast.error('Les nouveaux mots de passe ne correspondent pas'); return; }
    if (passwords.new.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return; }
    setSavingPassword(true);
    try {
      if (!supabase) { toast.error('Service non disponible'); return; }
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) { toast.error(error.message || 'Erreur lors de la mise à jour'); return; }
      toast.success('Mot de passe mis à jour !');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch { toast.error('Une erreur inattendue est survenue'); }
    finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer le compte ?',
      description: 'Cette action est irréversible. Toutes vos données seront perdues. Tapez "DELETE" pour confirmer.',
      variant: 'destructive', showInput: true, confirmationText: 'DELETE',
      onConfirm: async () => {
        try { toast.info('Demande enregistrée', { description: 'Contactez support@cosmo.app si nécessaire.' }); }
        finally { await logout(); navigate('/welcome'); }
      },
    });
    setConfirmInput('');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { updateUserSettings({ avatar: reader.result as string }); toast.success('Photo de profil mise à jour'); };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setConfirmConfig({
      isOpen: true, title: 'Supprimer la photo ?',
      description: 'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
      variant: 'destructive',
      onConfirm: () => { updateUserSettings({ avatar: undefined }); toast.success('Photo supprimée'); },
    });
  };

  const handleLogout = () => {
    setConfirmConfig({
      isOpen: true, title: 'Déconnexion ?', description: 'Voulez-vous vraiment vous déconnecter ?',
      variant: 'default',
      onConfirm: () => { logout(); toast.success('Déconnexion réussie'); navigate('/welcome'); },
    });
  };

  const handleOpenSupport = () => {
    window.parent.postMessage({ type: 'OPEN_EXTERNAL_URL', data: { url: 'mailto:support@cosmo.app' } }, '*');
    toast.info('Ouverture de votre messagerie...');
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      className="min-h-screen bg-[rgb(var(--color-background))] transition-colors duration-300 flex">

      {/* ──────── SIDEBAR ──────── */}
      <motion.aside
        className="hidden lg:flex w-72 shrink-0 border-r border-[rgb(var(--color-border))] flex-col sticky top-0 h-screen overflow-y-auto"
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
                  : <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{initials}</span>}
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
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            className="text-3xl font-extrabold text-[rgb(var(--color-text-primary))] tracking-tight">
            Paramètres
          </h1>
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
                  active ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm'
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
                        : <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{initials}</span>}
                    </div>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-2xl bg-black/45 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={18} className="text-white" />
                    </button>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{user.name}</h3>
                    <p className="text-sm text-[rgb(var(--color-text-muted))] mt-0.5">{user.email}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      <button onClick={() => fileInputRef.current?.click()} style={{ minHeight: '36px', fontFamily: "'DM Sans', sans-serif" }}
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
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-5">Informations personnelles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LabeledInput label="Nom complet" icon={User} value={user.name} onChange={(e) => updateUserSettings({ name: e.target.value })} placeholder="Votre nom" />
                  <LabeledInput label="Adresse email" type="email" icon={Mail} value={user.email} onChange={(e) => updateUserSettings({ email: e.target.value })} placeholder="votre@email.com" />
                </div>
                <div className="flex justify-end mt-5">
                  <PrimaryButton onClick={handleSaveProfile} loading={savingProfile}>{savingProfile ? 'Sauvegarde…' : 'Sauvegarder'}</PrimaryButton>
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* ── SÉCURITÉ ── */}
          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-2xl flex flex-col gap-5">
              <SectionCard>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Changer le mot de passe</h3>
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
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-sm font-bold text-red-600 dark:text-red-500">Zone de danger</h3>
                    <p className="text-xs text-red-500/70 mt-1">Supprimer définitivement votre compte et toutes vos données.</p>
                  </div>
                  <button onClick={handleDeleteAccount} style={{ minHeight: '44px', fontFamily: "'DM Sans', sans-serif" }}
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
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-bold text-[rgb(var(--color-text-primary))] mb-1">Thème de l'interface</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-5">Choisissez l'apparence qui vous convient le mieux.</p>
                <div style={{ minHeight: '72px' }}
                  className="flex items-center justify-between px-4 py-3.5 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/40 transition-colors group">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] group-hover:scale-105 transition-transform">
                      <Monitor size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Mode d'affichage</p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">Clair · Sombre · Monochrome · Glass</p>
                    </div>
                  </div>
                  <ThemeToggle showLabel />
                </div>
              </SectionCard>
            </motion.div>
          )}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
            <motion.div key="guide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="max-w-3xl flex flex-col gap-4">

              <div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1">
                  Guide d'utilisation
                </h2>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  Tout ce qu'il faut savoir pour maîtriser chaque fonctionnalité de Cosmo.
                </p>
              </div>

              {/* ── hero card ── */}
              <div className="relative overflow-hidden rounded-2xl border border-[rgb(var(--color-border))]">
                {/* gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 via-indigo-600/85 to-violet-700/90" />
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(139,92,246,0.4) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(59,130,246,0.3) 0%, transparent 40%)' }} />

                <div className="relative p-6 flex flex-col gap-5">
                  {/* top row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                        <BookOpen size={20} className="text-white" />
                      </div>
                      <div>
                        <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-base font-extrabold text-white leading-tight">Guide complet</p>
                        <p className="text-white/65 text-xs mt-0.5">8 sections · toutes les fonctionnalités</p>
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-white text-[10px] font-bold tracking-wide backdrop-blur-sm">
                      Interactif
                    </span>
                  </div>

                  {/* feature pills */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: CheckSquare, label: 'Tâches',       color: 'rgba(59,130,246,0.35)'  },
                      { icon: Calendar,    label: 'Agenda',        color: 'rgba(239,68,68,0.35)'   },
                      { icon: Activity,    label: 'Habitudes',     color: 'rgba(234,179,8,0.35)'   },
                      { icon: Target,      label: 'OKR',           color: 'rgba(34,197,94,0.35)'   },
                      { icon: BarChart2,   label: 'Statistiques',  color: 'rgba(139,92,246,0.35)'  },
                      { icon: Crown,       label: 'Premium',       color: 'rgba(217,119,6,0.35)'   },
                    ].map(({ icon: Icon, label, color }) => (
                      <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white border border-white/15 backdrop-blur-sm" style={{ background: color }}>
                        <Icon size={10} />
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => navigate('/guide')}
                    style={{ minHeight: '46px', fontFamily: "'DM Sans', sans-serif" }}
                    className="group inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-white/90 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-black/20"
                  >
                    Ouvrir le guide
                    <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* support card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
                    <HelpCircle size={15} className="text-white" />
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Besoin d'aide ?</p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">Notre équipe répond sous 24h.</p>
                  </div>
                </div>
                <button onClick={handleOpenSupport} style={{ minHeight: '40px', fontFamily: "'DM Sans', sans-serif" }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
                  Contacter le support <ChevronRight size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── confirm dialog ── */}
      <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent style={{ fontFamily: "'DM Sans', sans-serif" }}
          className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} className="text-xl font-bold">{confirmConfig.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">{confirmConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirmConfig.showInput && (
            <div className="py-2">
              <input type="text" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Tapez "${confirmConfig.confirmationText}"`}
                style={{ minHeight: '48px', fontFamily: "'DM Sans', sans-serif" }}
                className="w-full px-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl font-semibold text-[rgb(var(--color-text-primary))] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 outline-none" />
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmConfig.showInput && confirmInput !== confirmConfig.confirmationText}
              onClick={() => { confirmConfig.onConfirm(); setConfirmConfig(prev => ({ ...prev, isOpen: false })); }}
              className="rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
