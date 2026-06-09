// Logique pure de OKRModal — extraite pour être testable.
// Comportement déplacé verbatim depuis OKRModal.tsx.

export type KeyResultForm = {
  title: string;
  targetValue: string;
  currentValue: string;
  estimatedTime: string;
};

export type KeyResult = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  completed: boolean;
  estimatedTime: number;
  history?: { date: string; increment: number }[];
};

export type Objective = {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  keyResults: KeyResult[];
  completed: boolean;
  estimatedTime: number;
};

export type Category = { id: string; name: string; color: string };

export type OKRInfo = { title: string; description: string; category: string; endDate: string };

// Durée lisible entre deux dates (YYYY-MM-DD). null si incomplet, isError si
// la date de fin est antérieure au début.
export function calcOkrDuration(
  startDate: string,
  endDate: string
): { text: string; isError: boolean } | null {
  if (!startDate || !endDate) return null;
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (diff < 0) return { text: 'La date doit être dans le futur', isError: true };
  const days = Math.ceil(diff / 86400000);
  if (days < 7) return { text: `${days}j`, isError: false };
  if (days < 32) {
    const w = Math.floor(days / 7), r = days % 7;
    return { text: `${w} sem.${r ? ` ${r}j` : ''}`, isError: false };
  }
  const m = Math.floor(days / 30), r = days % 30;
  return { text: `${m} mois${r ? ` ${r}j` : ''}`, isError: false };
}

// Key results « valides » : titre non vide ET cible numérique > 0.
export function validKeyResults(keyResults: KeyResultForm[]): KeyResultForm[] {
  return keyResults.filter((kr) => kr.title.trim() && kr.targetValue && Number(kr.targetValue) > 0);
}
