// Schémas zod pour le mode entreprise — garde UX côté client (messages FR).
// Ce n'est PAS la frontière de sécurité (RLS + RPC SECURITY DEFINER).
import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'entreprise doit faire au moins 2 caractères")
    .max(80, "Nom d'entreprise trop long (80 caractères max)"),
});

// Code permanent : 'COSMO-' + 6 chars, alphabet sans ambiguïté (pas de 0/O/1/I/L).
export const JOIN_CODE_REGEX = /^COSMO-[A-HJ-KM-NP-Z2-9]{6}$/;

export const joinCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(JOIN_CODE_REGEX, 'Code invalide (format attendu : COSMO-XXXXXX)')),
});
