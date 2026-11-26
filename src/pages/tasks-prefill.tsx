import React, { useEffect, useState } from 'react';
import TaskModal from '@/components/TaskModal';
import { useSearchParams } from 'react-router';
import { useT } from '@/i18n/useT';

// Paramètres de l'extension « Ajouter à Cosmo » (extension/), lus par TasksPage.
// Bornés : un lien forgé ne peut ni injecter un nom démesuré ni une source
// autre qu'une adresse web.
export interface Prefill { name: string; source: string | null }

export function lirePrefill(params: URLSearchParams): Prefill | null {
  const name = (params.get('ajouter') ?? '').trim().slice(0, 140);
  if (!name) return null;
  const brute = (params.get('source') ?? '').trim().slice(0, 500);
  const source = /^https?:\/\/[^\s]+$/.test(brute) ? brute : null;
  return { name, source };
}

/**
 * `?ajouter=<titre>&source=<url>` (extension « Ajouter à Cosmo ») : ouvre la
 * création de tâche pré-remplie, puis retire les paramètres de l'URL.
 * Rend les données initiales du formulaire, `undefined` sans paramètre.
 */
export function useExtensionPrefill(
  ouvrir: (ouvert: boolean) => void,
): { name: string; description: string } | undefined {
  const { t } = useT('tasks');
  const [params, setParams] = useSearchParams();
  const [donnees, setDonnees] = useState<{ name: string; description: string }>();
  useEffect(() => {
    const p = lirePrefill(params);
    if (!p) return;
    setDonnees({ name: p.name, description: p.source ? t('fromExtension.source', { url: p.source }) : '' });
    ouvrir(true);
    setParams({}, { replace: true });
  }, [params, setParams, ouvrir, t]);
  return donnees;
}

/** Formulaire de création de tâche de la page Tâches, pré-rempli par l'extension s'il y a lieu. */
export const CreateTaskModal: React.FC<{ isOpen: boolean; setOpen: (ouvert: boolean) => void }> = ({ isOpen, setOpen }) => {
  const prefill = useExtensionPrefill(setOpen);
  return <TaskModal isOpen={isOpen} onClose={() => setOpen(false)} isCreating={true} initialData={prefill} />;
};
