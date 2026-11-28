import type { ChangeEvent, RefObject } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Camera } from 'lucide-react';
import type { User } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';
import { type SettingsTab, NAV_GROUPS } from './primitives';

interface SettingsSidebarProps {
  user: User;
  initials: string;
  /** Le champ fichier vit ici ; l'onglet Profil l'ouvre aussi. */
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  activeTab: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
  onLogout: () => void;
}

/** Barre latérale desktop (`lg`) : avatar, navigation groupée, déconnexion. */
export function SettingsSidebar({ user, initials, fileInputRef, onAvatarUpload, activeTab, onSelect, onLogout }: SettingsSidebarProps) {
  const { t } = useT('settings');
  return (
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
        <input type="file" ref={fileInputRef} onChange={onAvatarUpload} className="hidden" accept="image/*" />
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
                  <button key={item.id} onClick={() => onSelect(item.id)} style={{ minHeight: '44px' }}
                    className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                      active ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent-text))]'
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
        <button onClick={onLogout} style={{ minHeight: '44px' }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-red-500/8 hover:text-red-500 transition-all duration-150 group">
          <LogOut size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          {t('page.logout')}
        </button>
      </div>
    </motion.aside>
  );
}

/**
 * Onglets en pilules, entre `md` et `lg` (maquette 83) : la bande commune à
 * /tasks, /okr, /statistics et l'espace entreprise, hauteur 36 px, cible
 * tactile 44 portée par `TAP_AREA_44_Y`.
 * ❌ Ne pas remettre de conteneur bordé : c'est lui qui donnait l'impression
 * d'un cadre dont le contenu dépasse.
 */
export function SettingsTabPills({ activeTab, onSelect }: { activeTab: SettingsTab; onSelect: (tab: SettingsTab) => void }) {
  const { t } = useT('settings');
  return (
    <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto hide-scrollbar -mx-gutter px-gutter">
      {NAV_GROUPS.flatMap(g => g.items).map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button key={item.id} onClick={() => onSelect(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`${TAP_AREA_44_Y} shrink-0 flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-label font-medium transition-colors ${
              active
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]'}`}>
            <Icon size={14} aria-hidden="true" />
            {t(item.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
