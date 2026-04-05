// ═══════════════════════════════════════════════════════════════════
// TEST UTILITIES - React Query Test Wrapper
// ═══════════════════════════════════════════════════════════════════

import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Creates a fresh QueryClient for each test
 * Disables retries and caching for predictable tests
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

/**
 * Wrapper component for testing hooks that use React Query
 */
export const createWrapper = () => {
  const queryClient = createTestQueryClient();
  
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  
  return { Wrapper, queryClient };
};

/**
 * Mock localStorage for tests
 */
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get store() { return store; },
  };
};

/**
 * Wait for a condition to be true (async helper)
 */
export const waitFor = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitFor timeout');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

/**
 * Flush all pending promises
 */
export const flushPromises = () => 
  new Promise(resolve => setTimeout(resolve, 0));
