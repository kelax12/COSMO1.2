// Schémas zod pour le mode entreprise — garde UX côté client (messages FR).
// Ce n'est PAS la frontière de sécurité (RLS + RPC SECURITY DEFINER).
import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "validation.organization.nameTooShort")
    .max(80, "validation.organization.nameTooLong"),
});

// Code permanent : 'COSMO-' + 10 chars, alphabet sans ambiguïté (pas de 0/O/1/I/L).
// Les codes à 6 caractères émis avant la migration 083 restent acceptés
// (~29,7 bits) ; les nouveaux en font 10 (~49,5 bits) — cf. faille M-7.
// Exactement 6 (héritage) OU exactement 10 (nouveau) — pas les longueurs
// intermédiaires, qui ne correspondent à aucun code réellement émis.
export const JOIN_CODE_REGEX = /^COSMO-(?:[A-HJ-KM-NP-Z2-9]{6}|[A-HJ-KM-NP-Z2-9]{10})$/;

export const joinCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(JOIN_CODE_REGEX, 'validation.organization.joinCodeInvalid')),
});
