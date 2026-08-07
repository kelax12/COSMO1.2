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

// ═══════════════════════════════════════════════════════════════════
// AUD-04 — Stockage de l'avatar dans Supabase Storage, plus en data URL
//
// L'ancien chemin écrivait `canvas.toDataURL()` (10–30 Ko de base64) dans
// `auth.user_metadata`. Or user_metadata est EMBARQUÉ DANS LE JWT : chaque
// requête PostgREST repartait avec un en-tête `Authorization` de plusieurs
// dizaines de Ko — au-delà de la limite usuelle des proxys (8 Ko par header),
// l'API devient inaccessible (431 Request Header Fields Too Large). Le même
// blob était aussi dupliqué dans `profiles.avatar_url` et dans localStorage.
//
// Désormais : upload dans le bucket `avatars` (mig. 084), et seule l'URL
// publique — courte, sur l'hôte Storage du projet — est persistée. C'est ce
// qui rend applicable l'allowlist d'hôte posée par la mig. 084 sur
// `profiles.avatar_url` (AUD-03).
// ═══════════════════════════════════════════════════════════════════

/** Bucket public créé par la migration 084. */
export const AVATAR_BUCKET = 'avatars';

/** Convertit le canvas de re-encodage en Blob JPEG (qualité 0.85). */
export function canvasToAvatarBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

type MinimalStorageClient = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Blob,
        opts: { upsert: boolean; contentType: string; cacheControl: string },
      ): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
};

/**
 * Uploade l'avatar de `userId` et retourne son URL publique, ou `null` si
 * l'upload échoue.
 *
 * Le chemin est `<userId>/avatar.jpg` : les policies Storage de la mig. 084
 * n'autorisent l'écriture que dans le dossier dont le nom vaut `auth.uid()`.
 * `upsert: true` écrase la version précédente (pas d'accumulation d'orphelins).
 * Le cache-buster `?v=` est indispensable : l'URL étant stable, un navigateur
 * qui a déjà l'ancienne image en cache ne verrait jamais la nouvelle.
 */
export async function uploadAvatar(
  client: MinimalStorageClient,
  userId: string,
  blob: Blob,
): Promise<string | null> {
  const path = `${userId}/avatar.jpg`;
  const bucket = client.storage.from(AVATAR_BUCKET);
  const { error } = await bucket.upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  });
  if (error) return null;
  const { data } = bucket.getPublicUrl(path);
  return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
}
