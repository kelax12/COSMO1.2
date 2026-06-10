// ═══════════════════════════════════════════════════════════════════
// AVATAR UPLOAD — validation pure d'un fichier avatar + calcul de
// redimensionnement. Extrait de SettingsPage.handleAvatarUpload (audit
// 2026-06-10, phase extractions) pour testabilité.
//
// Règles sécurité (faille V5, CLAUDE.md « Uploads de fichiers ») :
// - Whitelist MIME stricte — JAMAIS image/svg+xml (peut embarquer du JS).
// - Cap de taille 500 Ko.
// - Le re-encodage canvas (neutralisation de payload) reste dans le
//   composant (DOM), mais ses dimensions sont calculées ici.
// ═══════════════════════════════════════════════════════════════════

export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const AVATAR_MAX_BYTES = 500_000;
export const AVATAR_MAX_DIM = 256;

export type AvatarFileVerdict =
  | { ok: true }
  | { ok: false; reason: 'type' | 'size' };

/** Valide type MIME + taille d'un fichier avatar (structurel uniquement). */
export function validateAvatarFile(file: { type: string; size: number }): AvatarFileVerdict {
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true };
}

/**
 * Dimensions cibles du canvas de re-encodage : downscale proportionnel vers
 * maxDim (jamais d'upscale — scale plafonné à 1).
 */
export function computeAvatarDimensions(
  width: number,
  height: number,
  maxDim: number = AVATAR_MAX_DIM,
): { width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
