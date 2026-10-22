import type { TeamOKR } from '@/modules/team-okrs';

/** Les objectifs qui PEUVENT être parents : tous, sauf soi-même et ses descendants (le trigger refuse un cycle). */
export const parentCandidates = (okrs: TeamOKR[], selfId: string | undefined): TeamOKR[] => {
  if (!selfId) return okrs;
  const blocked = new Set<string>([selfId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const o of okrs) {
      if (o.parentOkrId && blocked.has(o.parentOkrId) && !blocked.has(o.id)) { blocked.add(o.id); grew = true; }
    }
  }
  return okrs.filter((o) => !blocked.has(o.id));
};
