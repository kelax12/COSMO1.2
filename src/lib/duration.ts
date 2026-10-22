// Une seule écriture des durées dans toute l'app (maquette 139, 2026-10-10).
//
// Avant : « 3h56min » sur l'accueil, « 1 h 30 min » sur Tâches, « 7h56 » sur
// Statistiques, « 1h30min » dans la fiche d'événement, « 300min » dans les
// OKR — cinq formateurs, quatre formes pour la même grandeur.
//
// Forme retenue : « 45 min », « 2 h », « 1 h 30 » (minutes sur deux chiffres
// après les heures, sans « min » derrière : la forme horaire suffit).
//
// ⚠️ Ce formateur ne décide PAS de ce qu'on affiche pour « rien » : 0 rend
// « 0 min ». Chaque appelant garde sa convention de vide ('' ou '—'), parce
// qu'elle dit des choses différentes (pas d'estimation / estimation nulle).

/** Minutes → « 45 min » / « 2 h » / « 1 h 30 ». Minutes arrondies, négatif ramené à 0. */
export function formatDurationMinutes(minutes: number): string {
  const total = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}
