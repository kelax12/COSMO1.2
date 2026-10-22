// ═══════════════════════════════════════════════════════════════════
// sentry-scrub — ce qui est retiré d'un évènement Sentry AVANT son départ.
//
// `sendDefaultPii: false` retire l'IP et les cookies collectés par le SDK. Il
// ne touche ni aux textes (un message d'erreur Supabase porte souvent un
// e-mail ou un UUID), ni aux ADRESSES DE PAGE. Or ces adresses portent des
// secrets : `/invite/<jeton>`, `/org-invite/<jeton>`, `?code=` du retour
// OAuth, `#access_token=` d'un lien de réinitialisation. Jusqu'au 2026-10-13,
// seuls les textes étaient nettoyés : les URLs partaient telles quelles, dans
// `request.url`, le nom de transaction et les fils d'Ariane de navigation.
//
// Sorti de `main.tsx` pour être TESTÉ : un nettoyage RGPD qu'aucun test ne
// rejoue est une promesse de la politique de confidentialité sans preuve.
// ═══════════════════════════════════════════════════════════════════

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** `/invite/<jeton>` et `/org-invite/<jeton>` : le segment suivant est un secret. */
const SECRET_PATH = /(\/(?:org-)?invite\/)[^/?#\s]+/gi;

/** Paramètres de requête ou de fragment qui portent un secret. */
const SECRET_PARAMS = /([?&#](?:token|code|access_token|refresh_token|provider_token|token_hash|state)=)[^&#\s]*/gi;

export function scrubText(s: string): string {
  return s.replace(EMAIL_RE, '[email]').replace(UUID_RE, '[uuid]');
}

/**
 * Nettoie une adresse, absolue ou relative, sans jamais jeter : une URL
 * illisible repart nettoyée comme un texte.
 */
export function scrubUrl(url: string): string {
  const withoutParams = url.replace(SECRET_PARAMS, '$1[filtré]');
  const masked = withoutParams.replace(SECRET_PATH, '$1[jeton]');
  return scrubText(masked);
}

interface ScrubbableBreadcrumb {
  message?: string;
  data?: { [key: string]: unknown };
}

interface ScrubbableEvent {
  message?: string;
  transaction?: string;
  request?: { url?: string; query_string?: unknown };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: ScrubbableBreadcrumb[];
}

const URL_KEYS = ['url', 'from', 'to'] as const;

export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(crumb: T): T {
  if (crumb.message) crumb.message = scrubText(crumb.message);
  if (crumb.data) {
    for (const key of URL_KEYS) {
      const value = crumb.data[key];
      if (typeof value === 'string') crumb.data[key] = scrubUrl(value);
    }
  }
  return crumb;
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    // La chaîne de requête est déjà dans `url` ; en double, elle échapperait
    // au nettoyage. On la retire plutôt que de la nettoyer une seconde fois.
    if (event.request.query_string !== undefined) delete event.request.query_string;
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubText(ex.value);
    }
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) scrubBreadcrumb(crumb);
  }
  return event;
}
