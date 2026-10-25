// @vitest-environment jsdom
// Non-régression (A-6, 2026-09-03) : Input doit accepter un ref. Sous React 18
// il fallait un `forwardRef`, sans lui React avertissait « Function components
// cannot be given refs » ET, le vrai coût, le ref n'était jamais attaché :
// AdminMfaGate pose `ref={inputRef}` sur ce composant pour autofocus le champ
// de code TOTP au montage (`inputRef.current?.focus()`). Depuis React 19
// (2026-10-23) `ref` est une prop ordinaire. Même classe de bug que `Button`.
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  it('attache le ref au <input> réel, sans avertissement React', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);

    const refWarnings = consoleSpy.mock.calls.filter(args =>
      typeof args[0] === 'string' &&
      args[0].includes('cannot be given refs'),
    );
    expect(refWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('le ref permet un focus programmatique (cas AdminMfaGate)', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});
