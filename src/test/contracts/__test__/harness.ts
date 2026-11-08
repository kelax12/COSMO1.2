// ═══════════════════════════════════════════════════════════════════
// Suites de contrat des repositories (V12.2, constat ARC-01)
// ═══════════════════════════════════════════════════════════════════
//
// La démo reste sur `localStorage` (décision d'Axel, V12.1) : la
// parité ne se garantit donc pas par une démo sur vraie base, mais par UNE suite
// de cas par interface, jouée contre les DEUX implémentations.
//
//   · démo      : `src/test/contracts/demo.contract.test.ts` (Vitest, jsdom) ;
//   · Supabase  : `e2e/rls/contrats.test.ts` (Vitest d'intégration, vraie base
//                 locale, migrations rejouées sur base vierge, utilisateur de
//                 test AUTHENTIFIÉ, donc la RLS exercée).
//
// Une divergence trouvée n'est pas maquillée : si la démo a tort, on corrige la
// démo ; si la production a tort, le cas est déclaré dans `divergences` du côté
// Supabase avec l'identifiant du constat, et joué en `it.fails`. Le jour où la
// production est corrigée, `it.fails` rougit : c'est le signal de retirer la
// déclaration. Mode d'emploi : `docs/TESTING.md` § « Suites de contrat ».
// ═══════════════════════════════════════════════════════════════════
import { it } from 'vitest';

export interface ContractOptions {
  /** Cas connu pour diverger de ce côté : nom du cas → identifiant du constat. Joué en `it.fails`. */
  divergences?: Record<string, string>;
  /** Cas sans objet de ce côté : nom du cas → raison. Joué en `it.skip`. */
  skip?: Record<string, string>;
}

/** Déclare un cas de contrat, en tenant compte des divergences déclarées. */
export function contractCase(
  opts: ContractOptions | undefined,
  name: string,
  fn: () => Promise<void>,
  timeout?: number,
): void {
  const skip = opts?.skip?.[name];
  const divergence = opts?.divergences?.[name];
  if (skip) it.skip(`${name} [sans objet : ${skip}]`, fn, timeout);
  else if (divergence) it.fails(`${name} [divergence ${divergence}]`, fn, timeout);
  else it(name, fn, timeout);
}

/** Vérifie qu'une promesse est rejetée, sans présumer du message (il vient d'un catalogue traduit). */
export async function rejects(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

/** Libellé unique, pour qu'un cas ne lise jamais la donnée d'un autre (ni un seed de démo). */
let n = 0;
export const unique = (prefix: string): string => `${prefix} ${Date.now().toString(36)}-${(n++).toString(36)}`;

/** Jour local 'YYYY-MM-DD' à `offset` jours d'aujourd'hui. */
export function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
