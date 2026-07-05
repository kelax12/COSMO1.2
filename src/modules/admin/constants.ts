// Clés React Query du module admin.
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  isAdmin: () => [...adminKeys.all, 'is-admin'] as const,
};
