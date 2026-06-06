// ═══════════════════════════════════════════════════════════════════
// AVATAR — classification d'une chaîne `avatar` (image vs emoji)
// ═══════════════════════════════════════════════════════════════════
//
// Le champ `avatar` peut contenir :
//   - une image : URL distante (`https://…`, stockage Supabase) OU data URL
//     (`data:image/jpeg;base64,…` — c'est ce que SettingsPage écrit après
//     re-encodage canvas, cf. `handleAvatarUpload`), voire `blob:` / chemin
//     relatif `/…`.
//   - un emoji choisi comme avatar (ex. « 🦊 »), longueur courte.
//   - rien → on retombe sur les initiales.
//
// Historiquement chaque composant ré-implémentait sa propre heuristique
// (`startsWith('http')` ici, `length <= 2` là), ce qui faisait que les
// photos de profil uploadées (data URLs) ne s'affichaient JAMAIS dans les
// avatars de collaborateurs / tâches collaboratives (elles ne commencent
// pas par `http`). On centralise ici pour une détection cohérente partout.

/**
 * Vrai si `avatar` désigne une image affichable dans un `<img>` / `AvatarImage`.
 * Couvre les URLs distantes, les data URLs, les blobs et les chemins relatifs.
 */
export function isImageAvatar(avatar?: string | null): boolean {
  if (!avatar) return false;
  return /^(https?:|data:image\/|blob:|\/)/i.test(avatar.trim());
}

/**
 * Vrai si `avatar` est un emoji (ou caractère court) à afficher tel quel dans
 * le fallback. On utilise `Array.from` pour compter les vrais code points
 * (les emojis composés comme « 👨‍💻 » ont une `.length` > 2 mais peu de
 * code points) et on exclut explicitement les images.
 */
export function isEmojiAvatar(avatar?: string | null): avatar is string {
  if (!avatar || isImageAvatar(avatar)) return false;
  return Array.from(avatar.trim()).length <= 4;
}
