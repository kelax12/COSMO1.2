import { User } from 'lucide-react';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';

interface MemberAvatarProps {
  avatar?: string;
  /** Taille du cercle en px (défaut 36). */
  size?: number;
  className?: string;
}

/**
 * Vignette d'avatar d'un membre : image (URL/data URL), emoji, ou fallback icône.
 * Même logique de classification que les avatars amis (lib/avatar).
 */
const MemberAvatar = ({ avatar, size = 36, className = '' }: MemberAvatarProps) => (
  <div
    className={`rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden ${className}`}
    style={{ width: size, height: size }}
  >
    {isImageAvatar(avatar) ? (
      <img src={avatar} alt="" className="w-full h-full object-cover" />
    ) : isEmojiAvatar(avatar) ? (
      <span style={{ fontSize: size * 0.5 }} className="leading-none" aria-hidden="true">{avatar}</span>
    ) : (
      <User size={size * 0.42} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
    )}
  </div>
);

export default MemberAvatar;
