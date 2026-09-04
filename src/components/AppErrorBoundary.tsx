import React, { Component, ReactNode } from 'react';
// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { appModeStore } from '@/lib/app-mode.store';
import { getTranslator } from '@/i18n/useT';
import { localeStore } from '@/i18n/store';
import { hardSignOut } from '@/lib/hard-sign-out';

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
    monitoring.captureException(error, {
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
      // 🔴 C-64 — ce repli n'offrait QUE « Rafraichir la page ». Quand la cause
      // est deterministe (une valeur de stockage, une reponse mise en cache,
      // une preference), le rechargement ramene le MEME ecran : mesure sur
      // C-61, trois entrees, trois fois la meme impasse. `RootErrorBoundary`
      // porte une sortie de secours depuis son ecriture ; cette frontiere-ci
      // est PLUS BAS dans l'arbre, donc elle attrape EN PREMIER, et c'est donc
      // elle qu'on rencontre.
      //
      // Les couleurs viennent des tokens de theme, plus des deux hexadecimaux
      // qui etaient ecrits en dur ici : le theme EST pose a ce niveau de
      // l'arbre (contrairement a la racine, dont le couple noir/blanc est un
      // choix explique). Cet ecran etait la seule surface du produit a ignorer
      // le theme choisi.
      return (
        <div role="alert" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'16px', padding:'32px', textAlign:'center', color:'rgb(var(--color-text-primary))' }}>
          <div style={{ fontSize:'48px' }} aria-hidden="true">⚠️</div>
          <h2 style={{ fontSize:'20px', fontWeight:600 }}>{t('errorBoundary.title')}</h2>
          <p style={{ color:'rgb(var(--color-text-secondary))', maxWidth:'400px' }}>{t('errorBoundary.body')}</p>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', justifyContent:'center' }}>
            <button type="button" onClick={() => window.location.reload()} style={{ padding:'10px 24px', background:'rgb(var(--color-accent-solid))', color:'rgb(var(--color-accent-solid-foreground))', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:600 }}>
              {t('errorBoundary.refresh')}
            </button>
            <button type="button" onClick={hardSignOut} style={{ padding:'10px 24px', background:'transparent', color:'rgb(var(--color-text-primary))', border:'1px solid rgb(var(--color-border))', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
              {t('rootError.signOut')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
