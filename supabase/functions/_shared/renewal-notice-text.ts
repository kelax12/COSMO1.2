// ═══════════════════════════════════════════════════════════════════
// Texte de l'avis de reconduction L215-1 (`renewal-notice`). Module PUR,
// exécuté par vitest (`src/edge-audit-serveur.guard.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 SV-5 (audit serveur du 2026-10-24) : la partie HTML recopiait chaque
// ligne telle quelle, nom de l'organisation compris. Ce nom est écrit par
// n'importe quel admin de l'organisation, et l'avis part au PROPRIÉTAIRE,
// signé par notre domaine : un admin pouvait y glisser un lien (« réglez ici
// votre renouvellement ») que le propriétaire recevait de nous. Le HTML est
// donc échappé, comme dans `send-org-invite` et `inactivity-notice`.

export interface RenewalNoticeOrg {
  org_name: string
  period_end: string
}

export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function renewalNoticeMail(org: RenewalNoticeOrg, appUrl: string): { subject: string; text: string; html: string } {
  const date = frenchDate(org.period_end)
  const manage = `${appUrl}/entreprise?tab=billing`
  const lines = [
    `Bonjour,`,
    ``,
    `Votre abonnement Cosmo Entreprise pour l'organisation « ${org.org_name} » arrive a echeance le ${date}.`,
    ``,
    `Conformement a l'article L215-1 du Code de la consommation, nous vous informons que vous pouvez, si vous le souhaitez, NE PAS le reconduire.`,
    ``,
    `- Pour ne pas reconduire : resiliez depuis votre espace entreprise, ${manage}. La resiliation prend effet au terme de la periode deja payee, sans frais ni justification.`,
    `- Pour continuer : vous n'avez rien a faire, l'abonnement se reconduira automatiquement le ${date}.`,
    ``,
    `Si vous ne resiliez pas et que vous n'aviez pas recu cette information, la loi vous permettrait de resilier a tout moment apres la reconduction. Nous vous l'adressons donc dans les delais prevus.`,
    ``,
    `L'equipe Cosmo`,
  ]
  return {
    subject: `Votre abonnement Cosmo se reconduit le ${date}`,
    text: lines.join('\n'),
    html: lines
      .map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`))
      .join(''),
  }
}
