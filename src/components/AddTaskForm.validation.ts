// Logique de validation pure du wizard AddTaskForm — extraite pour être
// testable indépendamment du composant (même pattern que
// task-modal/validation.ts). ⚠️ Ce n'est PAS la frontière de sécurité
// (RLS + whitelist mapToDb + zod côté mutation). Comportement déplacé
// VERBATIM depuis AddTaskForm.tsx — règles volontairement plus strictes que
// TaskModal (création : temps estimé + catégorie obligatoires, deadline
// passée refusée) ; ne pas fusionner les deux modules.

export interface AddTaskFormValidationInput {
  name: string;
  estimatedTime: number | string;
  category: string;
  deadline: string; // '' = pas d'échéance
}

/** Messages d'erreur par champ (vide = formulaire valide). `now` injectable pour les tests. */
export function computeAddTaskErrors(
  formData: AddTaskFormValidationInput,
  now: Date = new Date(),
): { [key: string]: string } {
  const newErrors: { [key: string]: string } = {};
  if (!formData.name.trim()) newErrors.name = 'Le nom de la tâche est obligatoire';
  else if (formData.name.trim().length < 3) newErrors.name = 'Le nom doit contenir au moins 3 caractères';

  if (String(formData.estimatedTime).trim() === '') newErrors.estimatedTime = 'Le temps estimé est obligatoire';
  else if (isNaN(Number(formData.estimatedTime)) || Number(formData.estimatedTime) < 0) newErrors.estimatedTime = 'Veuillez entrer un nombre valide';

  // Priorité facultative : aucune validation bloquante.
  if (!formData.category) newErrors.category = 'Veuillez choisir une catégorie';

  if (formData.deadline) {
    const deadlineDate = new Date(formData.deadline);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (deadlineDate < today) newErrors.deadline = 'La date limite ne peut pas être dans le passé';
  }

  return newErrors;
}

/** Gate du bouton submit (plus permissif sur le nom : 1 car suffit, le strict est dans computeAddTaskErrors). */
export function isAddTaskFormValid(formData: AddTaskFormValidationInput): boolean {
  const nameValid = formData.name.length >= 1 && formData.name.length <= 100;
  const timeValid = String(formData.estimatedTime).trim() !== '' && !isNaN(Number(formData.estimatedTime)) && Number(formData.estimatedTime) > 0;
  // Priorité facultative : ne bloque pas la validation du formulaire.
  const categoryValid = !!formData.category;
  return nameValid && timeValid && categoryValid;
}
