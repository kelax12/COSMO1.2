// Palette nominée des listes + résolution couleur (hex perso OU nom de palette).
// Partagé entre TasksPage, TaskListsBar et ListActionsSheet.
export const colorOptions = [
  { value: 'blue', color: '#3B82F6', name: 'Bleu' },
  { value: 'red', color: '#EF4444', name: 'Rouge' },
  { value: 'green', color: '#10B981', name: 'Vert' },
  { value: 'purple', color: '#8B5CF6', name: 'Violet' },
  { value: 'orange', color: '#F97316', name: 'Orange' },
  { value: 'yellow', color: '#F59E0B', name: 'Jaune' },
  { value: 'pink', color: '#EC4899', name: 'Rose' },
  { value: 'indigo', color: '#6366F1', name: 'Indigo' },
];

// Résout la couleur affichée : si c'est un hex personnalisé (#RRGGBB),
// on l'utilise tel quel. Sinon on cherche dans la palette nominée.
export const resolveListColor = (color: string): string => {
  if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  return colorOptions.find(c => c.value === color)?.color || '#3B82F6';
};
