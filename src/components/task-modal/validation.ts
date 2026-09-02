// Logique de validation pure du formulaire TaskModal — extraite pour être
// testable indépendamment du composant (cf. task-modal/constants.ts).
// ⚠️ Ce n'est PAS la frontière de sécurité (RLS + whitelist mapToDb).
// Comportement déplacé verbatim depuis TaskModal.tsx (aucun durcissement).

import { translator } from '@/i18n/useT';

// Le formulaire n'a besoin que de ces champs pour la validation. `estimatedTime`
// peut transitoirement valoir '' (champ vidé) — géré comme dans le composant.
export interface TaskValidationInput {
  name: string;
  estimatedTime: number | string;
}

// Validation rules — calcule les messages d'erreur par champ.
export function computeValidationErrors(
  formData: TaskValidationInput
): { [key: string]: string } {
  // `translator` est appelé DANS la fonction, jamais au niveau du module : au
  // niveau du module il figerait la langue au premier import, et ces messages
  // seraient restés en français dans toute l'application anglaise.
  const { t } = translator('errors');
  const newErrors: { [key: string]: string } = {};

  if (!formData.name.trim()) {
    newErrors.name = t('validation.taskForm.nameRequired');
  } else if (formData.name.trim().length < 3) {
    newErrors.name = t('validation.taskForm.nameTooShort');
  } else if (formData.name.trim().length > 100) {
    newErrors.name = t('validation.taskForm.nameTooLong');
  }

  // Temps estimé : facultatif. Ne valide que la cohérence si une valeur
  // (autre que vide) est saisie — jamais bloquant quand vide.
  if (String(formData.estimatedTime).trim() !== '') {
    if (isNaN(Number(formData.estimatedTime))) {
      newErrors.estimatedTime = t('validation.taskForm.durationNaN');
    } else if (Number(formData.estimatedTime) < 0) {
      newErrors.estimatedTime = t('validation.taskForm.durationNegative');
    }
  }

  // Priorité ET catégorie facultatives : aucune validation bloquante.
  // Seul le nom est requis.

  // Échéance : facultative, n'est jamais bloquante (une date passée est
  // autorisée, ex. journalisation d'une tâche rétroactive).

  return newErrors;
}

// Temps estimé et échéance sont facultatifs → ne bloquent jamais.
// Seul le nom est obligatoire (priorité + catégorie facultatives).
export function isFormValid(formData: Pick<TaskValidationInput, 'name'>): boolean {
  return formData.name.length >= 1 && formData.name.length <= 100;
}

export function isStep1Valid(formData: Pick<TaskValidationInput, 'name'>): boolean {
  return formData.name.trim().length >= 1 && formData.name.trim().length <= 100;
}

// Liste des champs step 1 manquants — alimente le shake desktop.
// (échéance et temps estimé exclus : facultatifs)
export function missingStep1Fields(
  formData: Pick<TaskValidationInput, 'name'>
): string[] {
  const m: string[] = [];
  if (!(formData.name.trim().length >= 1 && formData.name.trim().length <= 100)) m.push('name');
  return m;
}
