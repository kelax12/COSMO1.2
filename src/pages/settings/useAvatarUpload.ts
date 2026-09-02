// ═══════════════════════════════════════════════════════════════════
// DÉPÔT ET RETRAIT DE LA PHOTO DE PROFIL
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `SettingsPage` le 2026-09-02. Motif : le cliquet d'architecture
// (`src/architecture.guard.test.ts`) est un budget de lignes qui ne remonte
// jamais, et les correctifs R-02, R-07 et R-08 l'ont dépassé de 13 lignes. La
// réponse documentée du dépôt n'est pas de relever le plafond, c'est de
// compenser par un découpage. Ce bloc était le bon candidat : lecture du
// fichier, re-encodage canvas, dépôt dans le Storage et écriture-miroir, une
// séquence qui ne parle qu'à elle-même.
//
// Les comportements sont repris à l'identique, y compris les deux raisons
// d'être des étapes qui paraissent redondantes :
//
//   - le re-encodage par canvas NEUTRALISE une charge utile éventuelle
//     (faille V5) : ce n'est pas un simple redimensionnement ;
//   - on ne persiste que l'URL publique, jamais la data URL (AUD-04) : elle
//     finissait sinon dans le JWT envoyé à chaque requête.
//
// ⚠️ R-03 : le retrait supprime aussi le FICHIER. Le bucket `avatars` est
// public, donc s'arrêter à `avatar_url = null` laissait la photo accessible
// sans authentification à une URL stable et devinable.

import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { mirrorAvatarToProfile } from '@/modules/user/profile.repository';
import {
  validateAvatarFile,
  computeAvatarDimensions,
  canvasToAvatarBlob,
  uploadAvatar,
  removeAvatar,
} from '@/lib/avatar-upload';
import type { Translator } from '@/i18n/useT';

interface AvatarDeps {
  isDemo: boolean;
  /** Seul chemin d'écriture du profil en mode démo (cf. CLAUDE.md, faille B7). */
  updateDemoProfile: (patch: { avatar?: string }) => void;
  t: Translator<'settings'>['t'];
}

export function useAvatarActions({ isDemo, updateDemoProfile, t }: AvatarDeps) {
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation pure et testée (`lib/avatar-upload.ts`, faille V5).
    const verdict = validateAvatarFile(file);
    if (!verdict.ok) {
      if (verdict.reason === 'type') {
        toast.error(t('profile.unsupportedFormat'), { description: t('profile.unsupportedFormatHint') });
      } else {
        toast.error(t('profile.tooLarge'), { description: t('profile.tooLargeHint') });
      }
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) {
        toast.error(t('profile.invalidFile'));
        return;
      }
      const img = new Image();
      img.onload = async () => {
        const dims = computeAvatarDimensions(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = dims.width;
        canvas.height = dims.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { toast.error(t('profile.photoUpdateFailed')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (isDemo) {
          // La démo n'a pas de backend : la data URL reste locale et ne part
          // dans aucun JWT — le problème AUD-04 ne s'y pose pas.
          updateDemoProfile({ avatar: canvas.toDataURL('image/jpeg', 0.85) });
        } else {
          const blob = await canvasToAvatarBlob(canvas);
          if (!blob) { toast.error(t('profile.photoUpdateFailed')); return; }
          const authUser = await getCurrentUser();
          if (!authUser) { toast.error(t('profile.photoUpdateFailed')); return; }

          const publicUrl = await uploadAvatar(supabase, authUser.id, blob);
          if (!publicUrl) { toast.error(t('profile.photoUpdateFailed')); return; }

          const { error } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
          if (error) { toast.error(t('profile.photoUpdateFailed')); return; }
          // Écriture-miroir dans `profiles` : `auth.user_metadata` est privé,
          // donc sans elle les AUTRES utilisateurs gardent l'ancienne photo.
          await mirrorAvatarToProfile(authUser.id, publicUrl);
        }
        toast.success(t('profile.photoUpdated'));
      };
      img.onerror = () => toast.error(t('profile.unreadableImage'));
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  /** Retire la photo : la référence ET le fichier (R-03). */
  const removeAvatarEverywhere = async (): Promise<boolean> => {
    if (isDemo) {
      updateDemoProfile({ avatar: undefined });
      return true;
    }
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
    if (error) { toast.error(t('profile.photoDeleteFailed')); return false; }
    const authUser = await getCurrentUser();
    if (authUser) {
      await mirrorAvatarToProfile(authUser.id, null);
      // Le bucket étant public, s'arrêter à `avatar_url = null` laissait la
      // photo accessible sans authentification (R-03, RGPD art. 17).
      await removeAvatar(supabase, authUser.id);
    }
    return true;
  };

  return { handleAvatarUpload, removeAvatarEverywhere };
}
