import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'16px', padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:'48px' }}>⚠️</div>
          <h2 style={{ fontSize:'20px', fontWeight:600 }}>Une erreur inattendue s'est produite</h2>
          <p style={{ color:'#666', maxWidth:'400px' }}>Veuillez rafraîchir la page. Si le problème persiste, contactez le support.</p>
          <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', background:'#3b82f6', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
            Rafraîchir la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
