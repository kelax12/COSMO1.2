// ═══════════════════════════════════════════════════════════════════
// Signalement de bug — règles partagées client / Edge Function
// ═══════════════════════════════════════════════════════════════════
//
// Les mêmes bornes sont revérifiées côté serveur (`supabase/functions/
// report-bug/index.ts`) : ce fichier n'est qu'une garde UX, jamais la
// frontière de sécurité (même convention que `src/lib/validation/`).

/** Bornes de saisie. Alignées sur celles de l'Edge Function. */
export const BUG_REPORT_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 5000,
  /** Taille du fichier AVANT encodage base64 (l'encodage ajoute ~33 %). */
  attachmentMaxBytes: 3 * 1024 * 1024,
} as const;

/**
 * Types de pièce jointe acceptés : capture d'écran, PDF, texte ou log.
 * Pas d'archive ni d'exécutable — une pièce jointe de support n'a aucune
 * raison d'être ouvrable.
 */
export const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain';

const ALLOWED_ATTACHMENT_TYPES = new Set(ATTACHMENT_ACCEPT.split(','));

export type BugReportField = 'title' | 'description' | 'attachment';

export interface BugReportInput {
  title: string;
  description: string;
  attachment?: File | null;
}

/**
 * Retourne le premier champ invalide, ou `null` si la saisie est complète.
 * On renvoie une CLÉ de champ et pas un message : le message est traduit par
 * l'appelant (une erreur identifiée par son texte français est intraduisible).
 */
export function validateBugReport(input: BugReportInput): BugReportField | null {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < BUG_REPORT_LIMITS.titleMin || title.length > BUG_REPORT_LIMITS.titleMax) {
    return 'title';
  }
  if (
    description.length < BUG_REPORT_LIMITS.descriptionMin ||
    description.length > BUG_REPORT_LIMITS.descriptionMax
  ) {
    return 'description';
  }
  const file = input.attachment;
  if (file) {
    if (file.size > BUG_REPORT_LIMITS.attachmentMaxBytes) return 'attachment';
    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) return 'attachment';
  }
  return null;
}

/**
 * Encode un fichier en base64 SANS le préfixe `data:` — c'est le format
 * attendu par l'API Resend côté Edge Function.
 *
 * `FileReader` plutôt qu'un `btoa(String.fromCharCode(...))` sur le buffer :
 * ce dernier explose la pile d'appels dès quelques centaines de Ko.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Contexte technique joint au rapport : c'est ce qui différencie un bug
 * reproductible d'un « ça marche pas ». Aucune donnée personnelle ici —
 * l'identité de l'auteur vient du JWT, côté serveur.
 */
export function collectBugContext(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  };
}
