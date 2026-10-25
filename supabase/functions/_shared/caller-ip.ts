// ═══════════════════════════════════════════════════════════════════
// L'adresse de l'appelant d'une Edge Function (audit serveur 2026-10-24, SV-3)
// Module PUR, exécuté par vitest (`src/edge-audit-serveur.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 La version d'avant prenait la PREMIÈRE entrée de `x-forwarded-for`, en
// la disant « réécrite par le gateway ». Or Supabase est derrière Cloudflare
// (les journaux `edge_logs` portent `cf_connecting_ip`), et Cloudflare AJOUTE
// l'adresse vue à un `x-forwarded-for` déjà présent au lieu de le remplacer :
// la première entrée est celle que le client a écrite. Un en-tête différent à
// chaque appel changeait de seau à chaque appel, et le plafond « 10 par jour
// et par IP » de `report-bug`, seul plafond d'un appelant anonyme, ne
// refusait plus rien.
//
// `cf-connecting-ip` est posé par Cloudflare lui-même, qui écrase toute
// valeur envoyée par le client : c'est la seule des deux que le client ne
// choisit pas. `x-forwarded-for` ne reste qu'en repli (stack locale, autre
// frontal), et le plafond GLOBAL de `report-bug` borne ce repli.

interface HeaderSource {
  headers: { get(name: string): string | null }
}

export function callerIp(req: HeaderSource): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const first = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
  return first || 'unknown'
}
