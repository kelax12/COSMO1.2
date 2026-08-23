// ═══════════════════════════════════════════════════════════════════
// RootErrorBoundary — le dernier filet, AU-DESSUS de tout le reste
// ═══════════════════════════════════════════════════════════════════
//
// POURQUOI CE COMPOSANT EXISTE
//
// `AppErrorBoundary` protège les PAGES : il est monté à l'intérieur de
// `AppRoutes`, donc sous `AuthProvider` / `ActiveOrgProvider` /
// `BillingProvider`. Tout ce qui casse AU-DESSUS de lui — un provider, le
// routeur, un chunk périmé du Layout — remontait jusqu'à la racine React,
// démontait l'arbre entier, et laissait le `<body>` seul à l'écran.
//
// C'est exactement le symptôme remonté : « écran noir » en thème sombre,
// « page blanche » en thème clair. Ce n'est pas deux bugs, c'est le même
// arbre vide sous deux fonds.
//
// Le pire n'était pas l'écran vide : c'était l'impasse. Sans interface, plus
// aucun bouton de déconnexion — et comme la session Supabase survit au
// rechargement, chaque nouvelle visite retombait sur le même vide. Un
// utilisateur ne pouvait littéralement plus sortir de son propre compte.
//
// CONTRAINTES
//
// Ce composant est monté PLUS HAUT que tous les contextes. Il ne peut donc
// utiliser ni `useT`, ni `useAuth`, ni le thème React : styles en ligne,
// textes en dur, et une déconnexion qui parle directement au localStorage
// plutôt qu'à `AuthContext` (qui n'existe peut-être plus à cet instant).

import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

/**
 * Purge tout ce qui pourrait ramener l'utilisateur dans l'état cassé, puis
 * repart sur la racine par un rechargement complet.
 *
 * On efface les clés de session Supabase (`sb-*-auth-token`) ET nos propres
 * caches (`cosmo*`). On ne touche à RIEN d'autre : le localStorage de
 * l'origine peut contenir des données étrangères à l'app.
 */
function hardSignOut(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || key.startsWith('cosmo')) doomed.push(key);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* navigation privée stricte — on tente quand même la redirection */
  }
  // `location.replace` et pas `assign` : l'écran cassé ne doit pas rester
  // dans l'historique, sinon le bouton retour y ramène.
  window.location.replace('/');
}

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, {
      level: 'fatal',
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
      // Distingue nettement, dans Sentry, « une page a planté » de « toute
      // l'app a disparu ».
      tags: { boundary: 'root' },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '32px',
          textAlign: 'center',
          // Pas de token CSS : si le plantage vient du bootstrap, le thème
          // n'a peut-être jamais été posé. Ce couple noir/blanc reste lisible
          // dans tous les cas.
          background: '#0b0b0d',
          color: '#f2f2f2',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: '44px' }} aria-hidden="true">
          ⚠️
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
          COSMO n'a pas pu démarrer
        </h1>
        <p style={{ maxWidth: '420px', lineHeight: 1.6, color: '#a8a8a8', margin: 0 }}>
          Une erreur a interrompu le chargement de l'application. Rechargez la
          page&nbsp;; si l'écran reste vide, déconnectez-vous pour repartir
          d'une session propre.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '11px 22px',
              background: '#f0f0f0',
              color: '#080808',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Recharger
          </button>
          <button
            type="button"
            onClick={hardSignOut}
            style={{
              padding: '11px 22px',
              background: 'transparent',
              color: '#f2f2f2',
              border: '1px solid #3a3a3a',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Se déconnecter
          </button>
        </div>
        {this.state.message && (
          // Le message brut aide au diagnostic quand l'utilisateur envoie une
          // capture. `<details>` pour ne pas en faire le sujet de l'écran.
          <details style={{ marginTop: '4px', maxWidth: '420px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#6e6e6e' }}>
              Détail technique
            </summary>
            <pre
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#8a8a8a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}
            >
              {this.state.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

export default RootErrorBoundary;
