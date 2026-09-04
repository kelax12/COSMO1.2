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
// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { translator } from '@/i18n/useT';
// C-64 — la sortie de secours vit dans un module partage : `AppErrorBoundary`
// l'offre desormais aussi, et deux copies d'un chemin de secours divergent.
import { hardSignOut } from '@/lib/hard-sign-out';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
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
    monitoring.captureException(error, {
      level: 'fatal',
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
      // Distingue nettement, dans Sentry, « une page a planté » de « toute
      // l'app a disparu ».
      tags: { boundary: 'root' },
    });
  }

  render() {
    // Composant de CLASSE : pas de hook possible. `translator` lit la locale
    // courante a chaque appel, ce qui est exactement ce qu'il faut ici — cet
    // ecran s'affiche quand le reste de l'app n'a pas demarre.
    const { t } = translator('common');
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
          {t('rootError.title')}
        </h1>
        <p style={{ maxWidth: '420px', lineHeight: 1.6, color: '#a8a8a8', margin: 0 }}>
          {t('rootError.body')}
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
            {t('rootError.reload')}
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
            {t('rootError.signOut')}
          </button>
        </div>
        {this.state.message && (
          // Message VISIBLE, pas replié derrière un `<details>`.
          //
          // Cet écran ne s'affiche que quand tout le reste a échoué : sa seule
          // valeur restante est de dire POURQUOI. Replié, il obligeait
          // l'utilisateur à penser à déplier avant de faire une capture — et
          // une capture sans le message ne permet aucun diagnostic. Sur
          // mobile, c'est souvent le seul canal disponible.
          <pre
            style={{
              marginTop: '4px',
              maxWidth: '420px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#141416',
              border: '1px solid #2a2a2c',
              fontSize: '11px',
              lineHeight: 1.5,
              color: '#9a9a9a',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
          >
            {this.state.message}
          </pre>
        )}
      </div>
    );
  }
}

export default RootErrorBoundary;
