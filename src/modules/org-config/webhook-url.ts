// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : validation d'URL de webhook, partagée par l'écran et la démo.
//
// Sortie de `local.repository.ts` (V12.3) : `index.ts` la
// réexportait depuis le dépôt de démo, ce qui embarquait toute la démo
// d'org-config dans l'écran d'intégrations, en production comme en démo.
// ═══════════════════════════════════════════════════════════════════

/**
 * Miroir du CHECK `org_webhooks_url` (mig. 207) : HTTPS vers un NOM DNS à TLD
 * alphabétique, jamais une adresse écrite en clair (quelle que soit sa
 * notation), jamais un TLD interne. Le refus des noms qui RÉSOLVENT vers une
 * adresse privée se fait à l'envoi, dans `org-webhook-dispatch`.
 */
export function webhookUrlIsAllowed(url: string): boolean {
  const u = url.trim();
  return u.length <= 500
    && /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:[0-9]{1,5})?(\/.*)?$/i.test(u)
    && !/^https:\/\/[^/:]*\.(localhost|local|internal|localdomain|lan|home|corp|intranet|private|arpa|test|invalid|example|onion)(:[0-9]{1,5})?(\/.*)?$/i.test(u);
}
