import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge ne connaît que les noms d'échelle par défaut. Nos tailles de
 * texte mobile (`text-display`, `text-body`, `text-caption`…) lui sont
 * inconnues : il les range alors dans le groupe « couleur de texte » et les
 * SUPPRIME dès qu'une vraie couleur suit dans le même `cn()`.
 *
 * Symptôme observé : `cn('… text-caption …', 'text-[rgb(var(--color-text-muted))]')`
 * dans MobileTabBar produisait un libellé à 16px (taille par défaut du
 * navigateur) au lieu de 11px — la classe de taille avait purement disparu du
 * DOM, sans erreur ni avertissement.
 *
 * On déclare donc explicitement ces noms dans le groupe `font-size`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'title', 'headline', 'body', 'label', 'caption'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
