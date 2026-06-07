// Vitest global setup. Registers DOM cleanup after each test so that
// @testing-library/react renders don't accumulate in document.body across
// tests in the same file. The dynamic import keeps node-environment tests
// (the vast majority — pure logic) from loading react-dom needlessly.
import { afterEach } from 'vitest';

afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
