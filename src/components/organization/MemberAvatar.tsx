import { User } from 'lucide-react';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import { textOnColor } from '@/lib/category-colors';

interface MemberAvatarProps {
  avatar?: string;
  /** Nom affiché — sert au fallback initiales colorées quand pas d'avatar. */
  name?: string;
  /** Taille du cercle en px (défaut 36). */
  size?: number;
  className?: string;
  neutral?: boolean;
}

/** Couleur déterministe (hue) dérivée du nom — stable entre rendus et appareils. */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/** `hsl(h 60% 45%)` en hex, pour choisir un texte lisible dessus (AM-5). */
function hexFromHue(h: number): string {
  const s = 0.6;
  const l = 0.45;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
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
// `neutral` (maquette 248, 2026-10-10) : initiales sur fond gris, sans teinte
// tirée du nom, là où huit pastilles colorées se disputaient l'œil.
const MemberAvatar = ({ avatar, name, size = 36, className = '', neutral = false }: MemberAvatarProps) => {
  const showInitials = !isImageAvatar(avatar) && !isEmojiAvatar(avatar) && !!name?.trim();
  // AM-5 (2026-10-22) : le blanc tombait à 2,1:1 sur les teintes jaunes et
  // vertes. Même teinte qu'avant, texte choisi pour tenir 4,5:1.
  const tint = showInitials && !neutral ? hexFromHue(hueFromName(name!.trim())) : null;
  return (
    <div
      className={`rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        ...(tint ? { backgroundColor: tint } : {}),
      }}
    >
      {isImageAvatar(avatar) ? (
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      ) : isEmojiAvatar(avatar) ? (
        <span style={{ fontSize: size * 0.5 }} className="leading-none" aria-hidden="true">{avatar}</span>
      ) : showInitials ? (
        <span
          className={`font-bold leading-none select-none ${neutral ? 'text-[rgb(var(--color-text-secondary))]' : ''}`}
          style={{ fontSize: size * 0.38, ...(tint ? { color: textOnColor(tint) } : {}) }}
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
