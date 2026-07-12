import { User } from 'lucide-react';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';

interface MemberAvatarProps {
  avatar?: string;
  /** Nom affiché — sert au fallback initiales colorées quand pas d'avatar. */
  name?: string;
  /** Taille du cercle en px (défaut 36). */
  size?: number;
  className?: string;
}

/** Couleur déterministe (hue) dérivée du nom — stable entre rendus et appareils. */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** Initiales : première lettre des deux premiers mots (« Marie Dupont » → MD). */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Vignette d'avatar d'un membre : image (URL/data URL), emoji, initiales
 * colorées (si `name` fourni), ou fallback icône. Même logique de
 * classification que les avatars amis (lib/avatar).
 */
const MemberAvatar = ({ avatar, name, size = 36, className = '' }: MemberAvatarProps) => {
  const showInitials = !isImageAvatar(avatar) && !isEmojiAvatar(avatar) && !!name?.trim();
  return (
    <div
      className={`rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        ...(showInitials ? { backgroundColor: `hsl(${hueFromName(name!.trim())} 60% 45%)` } : {}),
      }}
    >
      {isImageAvatar(avatar) ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      ) : isEmojiAvatar(avatar) ? (
        <span style={{ fontSize: size * 0.5 }} className="leading-none" aria-hidden="true">{avatar}</span>
      ) : showInitials ? (
        <span
          style={{ fontSize: size * 0.38 }}
          className="font-bold text-white leading-none select-none"
          aria-hidden="true"
        >
          {initialsOf(name!)}
        </span>
      ) : (
        <User size={size * 0.42} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
      )}
    </div>
  );
};

export default MemberAvatar;
