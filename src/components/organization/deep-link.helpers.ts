// ═══════════════════════════════════════════════════════════════════
// Deep-links de l'espace entreprise
//
// `?tab=` ouvrait déjà le bon onglet ; `?task=` / `?project=` / `?member=`
// ouvrent en plus la bonne entité. C'est ce qui rend une tâche collable dans
// une conversation — sans ça, « regarde cette tâche » se termine toujours par
// « cherche-la dans l'onglet Projets ».
// ═══════════════════════════════════════════════════════════════════

/** Entités adressables par l'URL de /entreprise. */
export type EntityParam = 'task' | 'project' | 'member';

/**
 * Un id vient toujours d'un UUID Supabase. On borne longueur et alphabet : la
 * valeur finit dans un `find()` puis dans du JSX, et une URL est une entrée
 * non fiable comme une autre.
 */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Lit un id d'entité dans l'URL, ou null si absent / malformé. */
export const readEntityParam = (
  params: URLSearchParams,
  key: EntityParam,
): string | null => {
  const raw = params.get(key);
  if (!raw || !ID_RE.test(raw)) return null;
  return raw;
};

/** Construit un lien /entreprise (onglet + entité optionnelle). */
export const buildOrgLink = (
  tab: string,
  entity?: Partial<Record<EntityParam, string>>,
): string => {
  const params = new URLSearchParams();
  if (tab && tab !== 'overview') params.set('tab', tab);
  for (const [key, value] of Object.entries(entity ?? {})) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/entreprise?${qs}` : '/entreprise';
};
