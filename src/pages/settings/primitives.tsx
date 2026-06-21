// ═══════════════════════════════════════════════════════════════════
// settings/primitives — atomes présentationnels + nav + font loader de
// SettingsPage. Extraits verbatim (god-component refactor).
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { User, Palette, BookOpen, Shield, Database, Eye, EyeOff, Loader2 } from 'lucide-react';

export type SettingsTab = 'profile' | 'appearance' | 'security' | 'data' | 'guide';

/* ─── font loader ──────────────────────────────────────────────── */
export function useFonts() {
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
export const NAV_GROUPS = [
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
    label: 'Données',
    items: [{ id: 'data' as SettingsTab, icon: Database, label: 'Mes données' }],
  },
  {
    label: 'Aide',
    items: [{ id: 'guide' as SettingsTab, icon: BookOpen, label: 'Guide' }],
  },
];

/* ─── reusable: LabeledInput ───────────────────────────────────── */
export function LabeledInput({
  label, type = 'text', value, onChange, placeholder, icon: Icon, showToggle, disabled, hint,
}: {
  label: string; type?: string; value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; icon?: React.ElementType; showToggle?: boolean;
  disabled?: boolean; hint?: string;
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
          type={inputType} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
          style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '48px' }}
          className={`w-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all duration-150 focus:border-[rgb(var(--color-accent))] focus:ring-2 focus:ring-[rgb(var(--color-accent))]/15 ${Icon ? 'pl-10' : 'pl-4'} ${showToggle ? 'pr-11' : 'pr-4'} py-3 ${disabled ? 'opacity-60 cursor-not-allowed bg-[rgb(var(--color-hover))]' : ''}`}
        />
        {showToggle && (
          <button type="button" tabIndex={-1} onClick={() => setVisible(v => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors p-1"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {hint && (
        <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">{hint}</p>
      )}
    </div>
  );
}

/* ─── reusable: PrimaryButton ──────────────────────────────────── */
export function PrimaryButton({ onClick, type = 'button', loading = false, children }: {
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
export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-5 flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}
