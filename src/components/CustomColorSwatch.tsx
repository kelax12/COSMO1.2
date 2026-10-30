// ═══════════════════════════════════════════════════════════════════
// Pastille « couleur personnalisée » en fin de palette (2026-10-29).
//
// Chaque palette de COSMO propose quelques teintes fixes ; cette pastille
// ouvre le sélecteur de couleur du système pour en choisir une autre.
// Un `<input type="color">` rend toujours `#rrggbb` en minuscules, le format
// qu'acceptent tous les CHECK de couleur en base (mig. 093, 197, 203, 219).
//
// Sélectionnée = la valeur courante n'est aucune des teintes de la palette :
// elle prend alors cette couleur, l'arc-en-ciel sinon.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface CustomColorSwatchProps {
  /** Couleur courante du champ (hex, ou clé de palette). */
  value: string;
  /** Valeurs de la palette affichée à côté, dans le même format que `value`. */
  palette: readonly string[];
  onChange: (hex: string) => void;
  /** Classes de taille et de forme, pour s'aligner sur les pastilles voisines. */
  className?: string;
}

const RAINBOW = 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)';
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

const CustomColorSwatch: React.FC<CustomColorSwatchProps> = ({ value, palette, onChange, className = 'w-6 h-6 rounded-full' }) => {
  const { t } = useT('common');
  const lower = palette.map((p) => p.toLowerCase());
  const custom = !!value && !lower.includes(value.toLowerCase()) && isHex(value);

  return (
    <label
      title={t('customColor')}
      className={`relative inline-flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-110 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-1 ${custom ? 'ring-2 ring-offset-1 ring-[rgb(var(--color-text-primary))]' : ''} ${className}`}
      style={{ background: custom ? value : RAINBOW }}
    >
      {!custom && <Plus size={12} strokeWidth={3} className="text-white drop-shadow" aria-hidden="true" />}
      <input
        type="color"
        value={custom ? value : '#3b82f6'}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('customColor')}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );
};

export default CustomColorSwatch;
