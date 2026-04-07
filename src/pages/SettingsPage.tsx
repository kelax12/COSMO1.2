import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, BookOpen, LogOut, Layout, Calendar,
  CheckSquare, Activity, Target, BarChart2,
  HelpCircle, Shield, Mail, Monitor, Camera, ArrowRight
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

const NAV_ITEMS = [
  {
    group: 'Compte',
    items: [
      { id: 'profile' as SettingsTab, label: 'Profil', icon: User, num: '01' },
      { id: 'security' as SettingsTab, label: 'Sécurité', icon: Shield, num: '02' },
    ],
  },
  {
    group: 'Préférences',
    items: [
      { id: 'appearance' as SettingsTab, label: 'Apparence', icon: Palette, num: '03' },
    ],
  },
  {
    group: 'Aide',
    items: [
      { id: 'guide' as SettingsTab, label: 'Guide & Aide', icon: BookOpen, num: '04' },
    ],
  },
];

const GUIDE_SECTIONS = [
  {
    title: 'Tableau de Bord',
    icon: Layout,
    description: "Le Dashboard est votre tour de contrôle. Il centralise toutes vos informations critiques pour la journée.",
    steps: [
      "Consultez vos statistiques en haut pour voir votre progression.",
      "Le widget 'À suivre' montre vos prochains événements.",
      "Utilisez l'ajout rapide pour capturer vos idées.",
    ],
  },
  {
    title: 'Agenda & Planification',
    icon: Calendar,
    description: "L'Agenda fusionne vos événements et vos tâches temporelles pour une vision claire.",
    steps: [
      "Basculez entre les vues Jour, Semaine et Mois.",
      "Glissez-déposez un bloc pour changer l'heure.",
      "Cliquez sur un créneau vide pour planifier.",
    ],
  },
  {
    title: 'Gestion des Tâches',
    icon: CheckSquare,
    description: "Organisez vos projets complexes en tâches simples et actionnables.",
    steps: [
      "Utilisez les niveaux de priorité pour focaliser votre énergie.",
      "Créez des catégories personnalisées pour séparer vos vies.",
      "Cochez une tâche pour une animation satisfaisante.",
    ],
  },
  {
    title: 'Suivi des Habitudes',
    icon: Activity,
    description: "Construisez des routines durables grâce au tracker d'habitudes intégré.",
    steps: [
      "Définissez la fréquence de votre habitude.",
      "Maintenez votre 'Streak' en complétant chaque jour.",
      "Visualisez votre historique pour rester motivé.",
    ],
  },
  {
    title: 'Objectifs & OKR',
    icon: Target,
    description: "Alignez vos actions quotidiennes avec vos visions à long terme.",
    steps: [
      "Définissez un Objectif ambitieux (ex: 'Expert React').",
      "Ajoutez des Résultats Clés mesurables.",
      "Liez vos tâches quotidiennes à vos OKR.",
    ],
  },
  {
    title: 'Productivité',
    icon: BarChart2,
    description: "Analysez vos comportements pour optimiser votre efficacité.",
    steps: [
      "Découvrez vos moments les plus productifs.",
      "Identifiez les tâches chronophages.",
      "Comparez vos performances semaine après semaine.",
    ],
  },
];

/* ─── small reusable pieces ─────────────────────────────────────── */

const monoStyle: React.CSSProperties = { fontFamily: "'Space Mono', monospace" };
const syneStyle: React.CSSProperties = { fontFamily: "'Syne', sans-serif" };

function SectionHeader({ num, group, title }: { num: string; group: string; title: string }) {
  return (
    <div className="pb-7 border-b border-[rgb(var(--color-border))]">
      <span
        style={monoStyle}
        className="text-[9px] tracking-[0.35em] text-[rgb(var(--color-accent))] uppercase block mb-3"
      >
        {num} · {group}
      </span>
      <h2
        style={syneStyle}
        className="text-[2.6rem] font-extrabold text-[rgb(var(--color-text-primary))] leading-none tracking-tight"
      >
        {title}
      </h2>
    </div>
  );
}

function UnderlineField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2" style={monoStyle}>
        <span className="text-[rgb(var(--color-accent))] leading-none select-none">—</span>
        <span className="text-[8px] tracking-[0.32em] uppercase text-[rgb(var(--color-text-muted))]">
          {label}
        </span>
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className="w-full pb-2.5 pt-1 bg-transparent border-b border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))] text-sm font-medium outline-none transition-colors placeholder:text-[rgb(var(--color-text-muted))] disabled:cursor-not-allowed"
      />
    </div>
  );
}

function ActionButton({
  onClick,
  type = 'button',
  children,
}: {
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={monoStyle}
      className="group inline-flex items-center gap-2 px-6 py-3 bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-85 active:scale-95 transition-all"
    >
      {children}
      <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}

/* ─── main component ─────────────────────────────────────────────── */

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: 'default' | 'destructive';
    showInput?: boolean;
    confirmationText?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'default',
  });

  const [confirmInput, setConfirmInput] = useState('');

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  if (!user) return null;

  /* ── handlers ── */
  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({ data: { name: user?.name } });
      if (error) { toast.error(error.message); return; }
      toast.success('Profil mis à jour avec succès !');
    } catch {
      toast.error('Une erreur inattendue est survenue');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    try {
      if (!supabase) { toast.error('Service non disponible'); return; }
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) { toast.error(error.message || 'Erreur lors de la mise à jour du mot de passe'); return; }
      toast.success('Mot de passe mis à jour avec succès !');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch {
      toast.error('Une erreur inattendue est survenue');
    }
  };

  const handleDeleteAccount = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Supprimer le compte ?',
      description: 'Cette action est irréversible. Toutes vos données seront perdues. Tapez "DELETE" pour confirmer.',
      variant: 'destructive',
      showInput: true,
      confirmationText: 'DELETE',
      onConfirm: async () => {
        try {
          toast.info('Demande de suppression enregistrée', {
            description: 'Vos données seront supprimées. Contactez support@cosmo.app si nécessaire.',
          });
        } finally {
          await logout();
          navigate('/welcome');
        }
      },
    });
    setConfirmInput('');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateUserSettings({ avatar: reader.result as string });
        toast.success('Photo de profil mise à jour');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Supprimer la photo ?',
      description: 'Êtes-vous sûr de vouloir supprimer votre photo de profil ?',
      variant: 'destructive',
      onConfirm: () => {
        updateUserSettings({ avatar: undefined });
        toast.success('Photo de profil supprimée');
      },
    });
  };

  const handleLogout = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Déconnexion ?',
      description: 'Voulez-vous vraiment vous déconnecter de votre session ?',
      variant: 'default',
      onConfirm: () => {
        logout();
        toast.success('Déconnexion réussie');
        navigate('/welcome');
      },
    });
  };

  const handleOpenSupport = () => {
    window.parent.postMessage({ type: 'OPEN_EXTERNAL_URL', data: { url: 'mailto:support@cosmo.app' } }, '*');
    toast.info('Ouverture de votre messagerie...');
  };

  /* ── render ── */
  return (
    <div
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      className="min-h-screen bg-[rgb(var(--color-background))] transition-colors duration-300"
    >
      {/* ── Top breadcrumb bar ── */}
      <div className="border-b border-[rgb(var(--color-border))] px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span style={monoStyle} className="text-[9px] tracking-[0.3em] uppercase text-[rgb(var(--color-text-muted))]">
            COSMO
          </span>
          <span className="text-[rgb(var(--color-border))] text-xs select-none">/</span>
          <span style={monoStyle} className="text-[9px] tracking-[0.3em] uppercase text-[rgb(var(--color-text-secondary))]">
            Paramètres
          </span>
        </div>
        {/* mini avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold select-none">
          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-49px)]">
        {/* ── Sidebar ── */}
        <motion.aside
          className="w-60 shrink-0 border-r border-[rgb(var(--color-border))] flex flex-col py-10 px-5 sticky top-0 h-[calc(100vh-49px)] overflow-y-auto"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* title */}
          <div className="mb-10 pl-4">
            <h1 style={syneStyle} className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] leading-tight">
              Paramètres
            </h1>
            <p style={monoStyle} className="text-[8px] tracking-[0.28em] uppercase text-[rgb(var(--color-text-muted))] mt-1">
              v1.2 · Configuration
            </p>
          </div>

          {/* nav groups */}
          <nav className="flex flex-col gap-7 flex-1">
            {NAV_ITEMS.map((group) => (
              <div key={group.group}>
                <p
                  style={monoStyle}
                  className="text-[7.5px] tracking-[0.32em] uppercase text-[rgb(var(--color-text-muted))] mb-2 pl-4"
                >
                  {group.group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-left group ${
                          isActive
                            ? 'text-[rgb(var(--color-text-primary))]'
                            : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                        }`}
                      >
                        {/* animated left bar */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              layoutId="navBar"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[rgb(var(--color-accent))] rounded-r-full"
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              exit={{ scaleY: 0 }}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                        </AnimatePresence>

                        {/* subtle bg on active */}
                        {isActive && (
                          <span className="absolute inset-0 rounded-lg bg-[rgb(var(--color-accent))]/[0.07]" />
                        )}

                        <span
                          style={monoStyle}
                          className={`text-[9px] relative z-10 ${isActive ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'}`}
                        >
                          {item.num}
                        </span>
                        <Icon
                          size={13}
                          className={`relative z-10 transition-colors ${
                            isActive
                              ? 'text-[rgb(var(--color-accent))]'
                              : 'text-[rgb(var(--color-text-muted))] group-hover:text-[rgb(var(--color-text-primary))]'
                          }`}
                        />
                        <span className="text-[12px] font-semibold relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* logout */}
          <div className="mt-6 pt-5 border-t border-[rgb(var(--color-border))]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-all duration-200 group text-left"
            >
              <LogOut size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[12px] font-semibold">Déconnexion</span>
            </button>
          </div>
        </motion.aside>

        {/* ── Content ── */}
        <main className="flex-1 py-12 px-10 lg:px-16 max-w-3xl">
          <AnimatePresence mode="wait">

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-10"
              >
                <SectionHeader num="01" group="Compte" title="Mon Profil" />

                {/* Avatar block */}
                <div className="flex items-center gap-8">
                  <div className="relative group/av">
                    {/* outer ring */}
                    <div className="absolute -inset-1 rounded-full border border-[rgb(var(--color-accent))]/25 group-hover/av:border-[rgb(var(--color-accent))]/60 transition-colors duration-300" />
                    <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-white text-2xl font-bold select-none">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span style={syneStyle}>
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      )}
                    </div>
                    {/* hover overlay */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Camera size={15} className="text-white" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>

                  <div>
                    <p style={syneStyle} className="text-base font-bold text-[rgb(var(--color-text-primary))]">
                      {user.name}
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{user.email}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={monoStyle}
                        className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 border border-[rgb(var(--color-border))] rounded-md text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] transition-all"
                      >
                        Modifier photo
                      </button>
                      {user.avatar && (
                        <button
                          onClick={handleRemoveAvatar}
                          style={monoStyle}
                          className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 border border-red-500/20 rounded-md text-red-500/60 hover:border-red-500 hover:text-red-500 transition-all"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <UnderlineField
                    label="Nom complet"
                    value={user.name}
                    onChange={(e) => updateUserSettings({ name: e.target.value })}
                    placeholder="Votre nom"
                  />
                  <UnderlineField
                    label="Adresse email"
                    type="email"
                    value={user.email}
                    onChange={(e) => updateUserSettings({ email: e.target.value })}
                    placeholder="votre@email.com"
                  />
                </div>

                <div className="pt-2">
                  <ActionButton onClick={handleSaveProfile}>Sauvegarder</ActionButton>
                </div>
              </motion.div>
            )}

            {/* ── SECURITY ── */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-10"
              >
                <SectionHeader num="02" group="Compte" title="Sécurité" />

                <form onSubmit={handleUpdatePassword} className="space-y-8">
                  <div>
                    <p style={monoStyle} className="text-[8px] tracking-[0.3em] uppercase text-[rgb(var(--color-text-muted))] mb-6">
                      Changer le mot de passe
                    </p>
                    <div className="space-y-6">
                      {([
                        { label: 'Mot de passe actuel', key: 'current' },
                        { label: 'Nouveau mot de passe', key: 'new' },
                        { label: 'Confirmer le nouveau', key: 'confirm' },
                      ] as const).map((field) => (
                        <UnderlineField
                          key={field.key}
                          label={field.label}
                          type="password"
                          value={passwords[field.key]}
                          onChange={(e) => setPasswords(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder="••••••••••••"
                        />
                      ))}
                    </div>
                  </div>
                  <ActionButton type="submit">Mettre à jour</ActionButton>
                </form>

                {/* Danger zone */}
                <div className="pt-8 border-t border-red-500/10">
                  <p style={monoStyle} className="text-[8px] tracking-[0.3em] uppercase text-red-500/50 mb-5">
                    Zone de danger
                  </p>
                  <div className="flex items-center justify-between gap-4 p-5 border border-red-500/15 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-red-500">Supprimer le compte</p>
                      <p className="text-xs text-red-500/55 mt-0.5">
                        Action irréversible — toutes vos données seront perdues
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      style={monoStyle}
                      className="shrink-0 px-4 py-2 border border-red-500/25 text-red-500/80 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── APPEARANCE ── */}
            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-10"
              >
                <SectionHeader num="03" group="Préférences" title="Apparence" />

                <div className="space-y-3">
                  <p style={monoStyle} className="text-[8px] tracking-[0.3em] uppercase text-[rgb(var(--color-text-muted))]">
                    Thème de l'interface
                  </p>
                  <div className="flex items-center justify-between p-5 border border-[rgb(var(--color-border))] rounded-xl hover:border-[rgb(var(--color-accent))]/35 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-lg bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] group-hover:scale-105 transition-transform">
                        <Monitor size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Thème visuel</p>
                        <p style={monoStyle} className="text-[8.5px] text-[rgb(var(--color-text-muted))] mt-0.5 tracking-wider">
                          Clair · Sombre · Monochrome · Glass
                        </p>
                      </div>
                    </div>
                    <ThemeToggle showLabel />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── GUIDE ── */}
            {activeTab === 'guide' && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-10"
              >
                <SectionHeader num="04" group="Aide" title="Guide" />

                <div className="space-y-3">
                  {GUIDE_SECTIONS.map((section, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="border border-[rgb(var(--color-border))] rounded-xl overflow-hidden hover:border-[rgb(var(--color-accent))]/30 transition-colors group"
                    >
                      <div className="flex items-start gap-5 p-5">
                        {/* icon + number */}
                        <div className="shrink-0 flex flex-col items-center gap-2 pt-0.5">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] group-hover:scale-105 transition-transform">
                            <section.icon size={15} />
                          </div>
                          <span style={monoStyle} className="text-[8px] text-[rgb(var(--color-text-muted))]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 style={syneStyle} className="text-[13px] font-bold text-[rgb(var(--color-text-primary))] mb-1.5">
                            {section.title}
                          </h3>
                          <p className="text-xs text-[rgb(var(--color-text-secondary))] leading-relaxed mb-4">
                            {section.description}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {section.steps.map((step, i) => (
                              <div key={i} className="flex gap-2.5 items-start">
                                <span
                                  style={monoStyle}
                                  className="text-[rgb(var(--color-accent))] text-[9px] mt-[2px] shrink-0"
                                >
                                  {i + 1}.
                                </span>
                                <p className="text-[11px] text-[rgb(var(--color-text-muted))] leading-relaxed">
                                  {step}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Support CTA */}
                <div className="flex items-center justify-between gap-4 p-6 border border-[rgb(var(--color-border))] rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shrink-0">
                      <HelpCircle size={17} className="text-white" />
                    </div>
                    <div>
                      <p style={syneStyle} className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
                        Besoin d'aide ?
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))]">
                        Notre équipe est disponible pour vous.
                      </p>
                    </div>
                  </div>
                  <ActionButton onClick={handleOpenSupport}>Contact</ActionButton>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* ── Confirm dialog ── */}
      <AlertDialog
        open={confirmConfig.isOpen}
        onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}
      >
        <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle style={syneStyle} className="text-xl font-bold">
              {confirmConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
              {confirmConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmConfig.showInput && (
            <div className="py-3">
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Tapez "${confirmConfig.confirmationText}"`}
                style={monoStyle}
                className="w-full px-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl font-bold text-[rgb(var(--color-text-primary))] text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 outline-none"
              />
            </div>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-bold text-sm">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmConfig.showInput && confirmInput !== confirmConfig.confirmationText}
              onClick={() => {
                confirmConfig.onConfirm();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
              }}
              className="rounded-lg font-bold text-sm bg-red-500 hover:bg-red-600 text-white"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
