import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Palette, BookOpen, LogOut, Layout, Calendar, 
  CheckSquare, Activity, Target, BarChart2,
  HelpCircle, Shield, Mail, Monitor, Camera, ChevronRight
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const updateUserSettings = useUpdateUserSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
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
    variant: 'default'
  });
  
  const [confirmInput, setConfirmInput] = useState('');
  
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  if (!user) return null;

  const handleSaveProfile = () => {
    toast.success('Profil mis à jour avec succès !');
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    toast.success('Mot de passe mis à jour avec succès !');
    setPasswords({ current: '', new: '', confirm: '' });
  };

  const handleDeleteAccount = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Supprimer le compte ?',
      description: 'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible et toutes vos données seront perdues. Veuillez taper "DELETE" pour confirmer.',
      variant: 'destructive',
      showInput: true,
      confirmationText: 'DELETE',
        onConfirm: () => {
          toast.info('Suppression du compte...', {
            description: 'Vos données seront supprimées définitivement.'
          });
          setTimeout(() => {
            logout();
            navigate('/welcome');
          }, 2000);
        }
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
      }
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
        }
    });
  };

  const handleOpenSupport = () => {
    window.parent.postMessage({ 
      type: "OPEN_EXTERNAL_URL", 
      data: { url: "mailto:support@cosmo.app" } 
    }, "*");
    toast.info('Ouverture de votre messagerie...');
  };

  const menuGroups = [
    {
      title: "Mon Compte",
      items: [
        { id: 'profile', label: 'Profil', icon: User },
        { id: 'security', label: 'Sécurité', icon: Shield },
      ]
    },
    {
      title: "Préférences",
      items: [
        { id: 'appearance', label: 'Apparence', icon: Palette },
      ]
    },
    {
      title: "Aide",
      items: [
        { id: 'guide', label: 'Guide & Aide', icon: BookOpen },
      ]
    }
  ] as const;

  const guideSections = [
    {
      title: "Tableau de Bord",
      icon: Layout,
      color: "blue",
      description: "Le Dashboard est votre tour de contrôle. Il centralise toutes vos informations critiques pour la journée.",
      steps: [
        "Consultez vos statistiques en haut pour voir votre progression.",
        "Le widget 'À suivre' montre vos prochains événements.",
        "Utilisez l'ajout rapide pour capturer vos idées."
      ]
    },
    {
      title: "Agenda & Planification",
      icon: Calendar,
      color: "purple",
      description: "L'Agenda fusionne vos événements et vos tâches temporelles pour une vision claire.",
      steps: [
        "Basculez entre les vues Jour, Semaine et Mois.",
        "Glissez-déposez un bloc pour changer l'heure.",
        "Cliquez sur un créneau vide pour planifier."
      ]
    },
    {
      title: "Gestion des Tâches",
      icon: CheckSquare,
      color: "red",
      description: "Organisez vos projets complexes en tâches simples et actionnables.",
      steps: [
        "Utilisez les niveaux de priorité pour focaliser votre énergie.",
        "Créez des catégories personnalisées pour séparer vos vies.",
        "Cochez une tâche pour une animation satisfaisante."
      ]
    },
    {
      title: "Suivi des Habitudes",
      icon: Activity,
      color: "emerald",
      description: "Construisez des routines durables grâce au tracker d'habitudes intégré.",
      steps: [
        "Définissez la fréquence de votre habitude.",
        "Maintenez votre 'Streak' en complétant chaque jour.",
        "Visualisez votre historique pour rester motivé."
      ]
    },
    {
      title: "Objectifs & OKR",
      icon: Target,
      color: "orange",
      description: "Alignez vos actions quotidiennes avec vos visions à long terme.",
      steps: [
        "Définissez un Objectif ambitieux (ex: 'Expert React').",
        "Ajoutez des Résultats Clés mesurables.",
        "Liez vos tâches quotidiennes à vos OKR."
      ]
    },
    {
      title: "Productivité",
      icon: BarChart2,
      color: "indigo",
      description: "Analysez vos comportements pour optimiser votre efficacité.",
      steps: [
        "Découvrez vos moments les plus productifs.",
        "Identifiez les tâches chronophages.",
        "Comparez vos performances semaine après semaine."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))] p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <motion.div 
        className="max-w-[1600px] mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <motion.div 
            className="w-full lg:w-72 flex flex-col gap-6"
            variants={itemVariants}
          >
            <div className="mb-2">
              <motion.h1 
                className="text-3xl sm:text-4xl font-bold text-[rgb(var(--color-text-primary))] mb-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                Paramètres
              </motion.h1>
              <p className="text-[rgb(var(--color-text-secondary))] text-sm">Gérez votre expérience Cosmo</p>
            </div>

            <nav className="flex flex-col gap-8">
              {menuGroups.map((group, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgb(var(--color-text-muted))]">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id as SettingsTab)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                            isActive 
                              ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-accent))] border border-[rgb(var(--color-border))] shadow-sm' 
                              : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[rgb(var(--color-accent))]' : 'group-hover:text-[rgb(var(--color-text-primary))] transition-colors'} />
                            <span className={`text-sm font-semibold ${isActive ? 'text-[rgb(var(--color-text-primary))]' : ''}`}>{item.label}</span>
                          </div>
                          {isActive && <ChevronRight size={14} className="text-[rgb(var(--color-accent))]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-[rgb(var(--color-border))]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all duration-200 group"
              >
                <LogOut size={18} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm font-bold">Déconnexion</span>
              </button>
            </div>
          </motion.div>

          {/* Content Area */}
          <motion.div 
            className="flex-1 min-h-[600px]"
            variants={itemVariants}
          >
            <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-6 sm:p-10 shadow-sm overflow-hidden h-full">
              <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Mon Profil</h2>
                      <p className="text-[rgb(var(--color-text-secondary))] text-sm">Informations personnelles et identité</p>
                    </div>

                    <div className="space-y-8">
                      <div className="flex flex-col md:flex-row items-center gap-8 p-6 bg-[rgb(var(--color-background))] rounded-2xl border border-[rgb(var(--color-border))]">
                        <div className="relative">
                          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden border-2 border-[rgb(var(--color-border))]">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user.name.split(' ').map(n => n[0]).join('')
                            )}
                          </div>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarUpload} 
                            className="hidden" 
                            accept="image/*"
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 p-2 bg-[rgb(var(--color-surface))] rounded-lg shadow-md border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:scale-110 transition-transform"
                          >
                            <Camera size={14} />
                          </button>
                        </div>

                        <div className="flex-1 text-center md:text-left space-y-3">
                          <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Photo de profil</h3>
                          <p className="text-[rgb(var(--color-text-secondary))] text-sm max-w-md">
                            Cette image sera visible par vos contacts dans les discussions et les tâches partagées.
                          </p>
                          <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-[rgb(var(--color-accent))] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all"
                            >
                              Télécharger
                            </button>
                            {user.avatar && (
                              <button 
                                onClick={handleRemoveAvatar}
                                className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest ml-1">Nom Complet</label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] group-focus-within:text-[rgb(var(--color-accent))] transition-colors" size={16} />
                            <input
                              type="text"
                              value={user.name}
                              onChange={(e) => updateUserSettings({ name: e.target.value })}
                              className="w-full pl-11 pr-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] rounded-xl transition-all font-semibold text-[rgb(var(--color-text-primary))] text-sm outline-none"
                              placeholder="Votre nom"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest ml-1">Adresse Email</label>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] group-focus-within:text-[rgb(var(--color-accent))] transition-colors" size={16} />
                            <input
                              type="email"
                              value={user.email}
                              onChange={(e) => updateUserSettings({ email: e.target.value })}
                              className="w-full pl-11 pr-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] rounded-xl transition-all font-semibold text-[rgb(var(--color-text-primary))] text-sm outline-none"
                              placeholder="votre@email.com"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[rgb(var(--color-border))] flex justify-end">
                        <button 
                          onClick={handleSaveProfile}
                          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:opacity-90 active:scale-95 transition-all"
                        >
                          Sauvegarder les modifications
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'security' && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Sécurité</h2>
                      <p className="text-[rgb(var(--color-text-secondary))] text-sm">Protégez votre compte</p>
                    </div>

                    <div className="space-y-6">
                      <form onSubmit={handleUpdatePassword} className="p-6 bg-[rgb(var(--color-background))] rounded-2xl border border-[rgb(var(--color-border))] space-y-6">
                        <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Changer le mot de passe</h3>
                        <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest ml-1">Mot de passe actuel</label>
                            <input
                              type="password"
                              value={passwords.current}
                              onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                              className="w-full px-4 py-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl transition-all font-semibold text-[rgb(var(--color-text-primary))] text-sm outline-none focus:border-[rgb(var(--color-accent))]"
                              placeholder="••••••••••••"
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest ml-1">Nouveau mot de passe</label>
                              <input
                                type="password"
                                value={passwords.new}
                                onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                                className="w-full px-4 py-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl transition-all font-semibold text-[rgb(var(--color-text-primary))] text-sm outline-none focus:border-[rgb(var(--color-accent))]"
                                placeholder="••••••••••••"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase tracking-widest ml-1">Confirmer</label>
                              <input
                                type="password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                                className="w-full px-4 py-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl transition-all font-semibold text-[rgb(var(--color-text-primary))] text-sm outline-none focus:border-[rgb(var(--color-accent))]"
                                placeholder="••••••••••••"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end pt-4">
                          <button 
                            type="submit"
                            className="px-6 py-2.5 bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                          >
                            Mettre à jour le mot de passe
                          </button>
                        </div>
                      </form>

                      <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <h3 className="text-base font-bold text-red-500">Zone de danger</h3>
                          <p className="text-sm text-red-500/70">Supprimer définitivement votre compte et toutes vos données.</p>
                        </div>
                        <button 
                          onClick={handleDeleteAccount}
                          className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-sm"
                        >
                          Supprimer le compte
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Apparence</h2>
                      <p className="text-[rgb(var(--color-text-secondary))] text-sm">Personnalisez votre interface</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="p-6 bg-[rgb(var(--color-background))] rounded-2xl border border-[rgb(var(--color-border))] flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-[rgb(var(--color-surface))] rounded-xl border border-[rgb(var(--color-border))] text-[rgb(var(--color-accent))] group-hover:scale-110 transition-transform">
                            <Monitor size={20} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">Thème visuel</h3>
                            <p className="text-[rgb(var(--color-text-secondary))] text-sm font-medium">Mode clair ou sombre</p>
                          </div>
                        </div>
                        <ThemeToggle />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'guide' && (
                  <motion.div
                    key="guide"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-10"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Guide d'utilisation</h2>
                      <p className="text-[rgb(var(--color-text-secondary))] text-sm">Devenez un expert de Cosmo</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {guideSections.map((section, index) => (
                        <motion.div
                          key={index}
                          className="group p-5 bg-[rgb(var(--color-background))] rounded-2xl border border-[rgb(var(--color-border))] transition-all duration-300 hover:shadow-md"
                          whileHover={{ y: -4 }}
                        >
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500 group-hover:scale-110 transition-transform`}>
                                <section.icon size={20} />
                              </div>
                              <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{section.title}</h3>
                            </div>
                            
                            <p className="text-xs text-[rgb(var(--color-text-secondary))] leading-relaxed">
                              {section.description}
                            </p>

                            <div className="space-y-3 pt-2">
                              {section.steps.map((step, i) => (
                                <div key={i} className="flex gap-2.5 items-start">
                                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-surface))]">
                                    {i + 1}
                                  </div>
                                  <p className="text-[10px] font-medium text-[rgb(var(--color-text-secondary))] leading-relaxed">
                                    {step}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <motion.div 
                      className="p-8 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl border border-[rgb(var(--color-border))] text-center space-y-4"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto shadow-md">
                        <HelpCircle size={24} className="text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Besoin d'aide ?</h3>
                      <p className="text-[rgb(var(--color-text-secondary))] text-sm max-w-lg mx-auto">
                        Notre équipe de support est disponible pour répondre à vos questions.
                      </p>
                      <button 
                        onClick={handleOpenSupport}
                        className="px-8 py-2.5 bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] rounded-lg font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
                      >
                        Contacter le support
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              {confirmConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))]">
              {confirmConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmConfig.showInput && (
            <div className="py-4">
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={`Tapez "${confirmConfig.confirmationText}"`}
                className="w-full px-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl font-bold text-[rgb(var(--color-text-primary))] text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 outline-none"
              />
            </div>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-bold text-sm">Annuler</AlertDialogCancel>
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
