import { useEffect, useRef } from 'react';
import { useCreateOkr, useOkrs } from '@/modules/okrs';
import { reprendre, versCreateInput } from '@/lib/okr-import';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';

/**
 * Crée les OKR mis de côté par une page publique (modèle de la galerie,
 * générateur d'OKR : `src/lib/okr-import.ts`), une fois, quand la liste des
 * OKR est chargée. Démo et compte : même mutation que la saisie.
 */
export function useImportOkrEnAttente(): void {
  const { isSuccess } = useOkrs();
  const createOkr = useCreateOkr();
  const { tp } = useT('okr');
  const fait = useRef(false);
  useEffect(() => {
    if (!isSuccess || fait.current) return;
    fait.current = true;
    const brouillons = reprendre();
    if (brouillons.length === 0) return;
    const now = new Date();
    Promise.all(brouillons.map((o) => createOkr.mutateAsync(versCreateInput(o, now))))
      .then(() => toast.success(tp('import.done', brouillons.length)))
      .catch(() => {
        // L'échec est déjà annoncé par le toast d'erreur de useCreateOkr.
      });
  }, [isSuccess, createOkr, tp]);
}
