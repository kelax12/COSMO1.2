import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { appModeStore } from '@/lib/app-mode.store';
import { getTranslator } from '@/i18n/useT';
import { localeStore } from '@/i18n/store';

interface Props {
  children: ReactNode;
  /** Rendu de repli custom — `null` pour échouer silencieusement (widget
   *  secondaire non essentiel) au lieu de l'écran d'erreur plein cadre par
   *  défaut, prévu pour une PAGE entière. */
  fallback?: ReactNode;
}
interface State { hasError: boolean; error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
      tags: { mode: appModeStore.isDemo ? 'demo' : 'prod' },
    });
  }

  render() {
    if (this.state.hasError) {
      if ('fallback' in this.props) return this.props.fallback;
      // Composant CLASSE : pas de hooks, donc pas de `useT`. On lit la locale
      // dans le store au moment du rendu — c'est exactement le cas d'usage de
      // `getTranslator`. Résoudre au niveau du module figerait la langue au
      // premier import, et ce composant est monté au tout début de l'app.
      const { t } = getTranslator('common', localeStore.locale);
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'16px', padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:'48px' }}>⚠️</div>
          <h2 style={{ fontSize:'20px', fontWeight:600 }}>{t('errorBoundary.title')}</h2>
          <p style={{ color:'#666', maxWidth:'400px' }}>{t('errorBoundary.body')}</p>
          <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', background:'#3b82f6', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
            {t('errorBoundary.refresh')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
