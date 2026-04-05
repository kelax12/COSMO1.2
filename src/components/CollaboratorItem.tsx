import React from 'react';
import { UserPlus, Trash2, X, Mail } from 'lucide-react';

interface CollaboratorItemProps {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  isSelected?: boolean;
  isPending?: boolean;
  onAction: () => void;
  variant: 'add' | 'remove' | 'toggle';
}

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
  variant
}) => {
  const isEmoji = avatar && avatar.length <= 2;

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
        <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-semibold text-sm ${
          isPending
            ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white'
            : isEmoji 
              ? 'text-2xl' 
              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
        }`} style={isEmoji && !isPending ? { backgroundColor: 'rgb(var(--color-hover))' } : {}}>
          {isPending ? <Mail size={16} /> : avatar ? (isEmoji ? avatar : <img src={avatar} alt={name} className="w-full h-full rounded-full object-cover" />) : getInitials(name || id)}
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{name || id}</p>
          {isPending ? (
            <p className="text-xs text-orange-500">⏳ Demande d'ami envoyée</p>
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
