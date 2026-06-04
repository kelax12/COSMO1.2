import React from 'react';
import { UserPlus, Trash2, X, Mail } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';

interface CollaboratorItemProps {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isSelected?: boolean;
  isPending?: boolean;
  onAction: () => void;
  variant: 'add' | 'remove' | 'toggle';
  /** Compact 2-column card: hides email, smaller avatar */
  compact?: boolean;
  /** Lecture seule : aucun bouton d'action (vue destinataire d'un partage). */
  readOnly?: boolean;
  /** Badge optionnel sous le nom (ex. « Propriétaire »). */
  badge?: string;
  /** Affiche une pastille « Envoyé » : le destinataire n'a pas encore accepté. */
  sentBadge?: boolean;
}

const SentPill = () => (
  <span className="ml-1 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
    Envoyé
  </span>
);

const getInitials = (value: string) => {
  if (!value) return '?';
  const parts = value.split(/\s|@/).filter(Boolean);
  const firstTwo = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return firstTwo.join('') || value.charAt(0).toUpperCase();
};

const CollaboratorItem: React.FC<CollaboratorItemProps> = ({
  id,
  name,
  email,
  avatar,
  isSelected,
  isPending,
  onAction,
  variant,
  compact = false,
  readOnly = false,
  badge,
  sentBadge = false,
}) => {
  const isEmoji = isEmojiAvatar(avatar);
  const isImage = isImageAvatar(avatar);

  if (readOnly) {
    return (
      <div
        className="flex items-center gap-2 p-2.5 rounded-xl border"
        style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
      >
        <Avatar className="size-8 shrink-0">
          {!isPending && isImage && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback className={
            isEmoji
              ? 'bg-[rgb(var(--color-hover))] text-base'
              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs'
          }>
            {isEmoji ? avatar : getInitials(name || id)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{name || id}</p>
          {badge && <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{badge}</p>}
        </div>
      </div>
    );
  }

  if (compact) {
    // 2-column card: avatar + name + action, no email
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction(); }}
        className={`w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))]'
        }`}
        aria-label={variant === 'remove' ? `Retirer ${name}` : `Ajouter ${name}`}
      >
        <Avatar className="size-8 shrink-0">
          {!isPending && isImage && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback className={
            isPending
              ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white text-xs'
              : isEmoji
                ? 'bg-[rgb(var(--color-hover))] text-base'
                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs'
          }>
            {isPending ? <Mail size={12} /> : isEmoji ? avatar : getInitials(name || id)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {name || id}
        </span>
        {sentBadge && <SentPill />}
        {isSelected
          ? <X size={14} className="shrink-0 text-blue-500" />
          : <UserPlus size={14} className="shrink-0 text-blue-500 opacity-60" />
        }
      </button>
    );
  }

  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl border transition-all shadow-sm group"
      style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgb(var(--color-accent))';
        e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgb(var(--color-border))';
        e.currentTarget.style.backgroundColor = 'rgb(var(--color-surface))';
      }}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Avatar className="size-10 shrink-0">
          {!isPending && isImage && <AvatarImage src={avatar} alt={name} />}
          <AvatarFallback className={
            isPending
              ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white'
              : isEmoji
                ? 'bg-[rgb(var(--color-hover))] text-2xl'
                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-sm'
          }>
            {isPending ? <Mail size={16} /> : isEmoji ? avatar : getInitials(name || id)}
          </AvatarFallback>
        </Avatar>
        <div className="overflow-hidden">
          <p className="text-sm font-semibold truncate flex items-center" style={{ color: 'rgb(var(--color-text-primary))' }}>
            <span className="truncate">{name || id}</span>
            {sentBadge && <SentPill />}
          </p>
          {isPending ? (
            <p className="text-xs text-orange-500">⏳ Demande d'ami envoyée</p>
          ) : sentBadge ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">En attente d'acceptation</p>
          ) : email && (
            <div className="flex items-center gap-1.5 text-xs truncate" style={{ color: 'rgb(var(--color-text-muted))' }}>
              <Mail size={12} className="shrink-0" />
              <span className="truncate">{email}</span>
            </div>
          )}</div>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAction();
        }}
        className={`p-2.5 rounded-lg transition-all ${
          variant === 'remove'
            ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
            : variant === 'toggle' && isSelected
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30'
        }`}
        aria-label={variant === 'remove' ? 'Retirer' : 'Ajouter'}
      >
        {variant === 'remove' && <Trash2 size={18} />}
        {variant === 'add' && <UserPlus size={18} />}
        {variant === 'toggle' && (isSelected ? <X size={18} /> : <UserPlus size={18} />)}
      </button>
    </div>
  );
};

export default CollaboratorItem;
