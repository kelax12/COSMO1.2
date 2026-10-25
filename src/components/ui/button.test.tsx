// @vitest-environment jsdom
// Non-régression : Button doit attacher le ref qu'on lui passe.
// `CalendarDayButton` (ui/calendar.tsx) s'en sert pour poser le focus sur le
// jour survolé au clavier. Sous React 18 il fallait un `forwardRef` ; depuis
// React 19 (2026-10-23) `ref` est une prop ordinaire.
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('attache le ref au <button> réel, sans avertissement React', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>OK</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.type).toBe('button');

    const refWarnings = consoleSpy.mock.calls.filter(args =>
      typeof args[0] === 'string' &&
      args[0].includes('cannot be given refs'),
    );
    expect(refWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('le ref permet un focus programmatique (cas CalendarDayButton)', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>OK</Button>);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});
