import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

interface ParentMessage {
  type: string;
  error?: {
    message: string;
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    source: string;
  };
  timestamp: number;
}

if (typeof window !== 'undefined') {
  const sendToParent = (data: ParentMessage) => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(data, '*');
      }
    } catch { /* ignore postMessage errors */ }
  };

  window.addEventListener('error', (event) => {
    sendToParent({
      type: 'ERROR_CAPTURED',
      error: {
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'window.onerror',
      },
      timestamp: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | string | { message?: string; stack?: string };
    const message =
      typeof reason === 'object' && reason?.message
        ? String(reason.message)
        : String(reason);
    const stack = typeof reason === 'object' ? (reason as Error)?.stack : undefined;

    sendToParent({
      type: 'ERROR_CAPTURED',
      error: {
        message,
        stack,
        filename: undefined,
        lineno: undefined,
        colno: undefined,
        source: 'unhandledrejection',
      },
      timestamp: Date.now(),
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
