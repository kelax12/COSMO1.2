// src/components/perso-guide/PersoGuideHost.tsx
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '@/i18n/useT';
import { useGuideDemo, type GuideT } from '@/components/org-guide/use-guide-demo';
import { PersoGuideDrawer } from './PersoGuideDrawer';

interface Props { open: boolean; onClose: () => void }

/** Chargé au premier clic sur la boussole, avec le catalogue `persoGuide`. */
export default function PersoGuideHost({ open, onClose }: Props) {
  const { t } = useT('persoGuide');
  const tx: GuideT = useCallback((key, vars) => t(key as Parameters<typeof t>[0], vars), [t]);
  const navigate = useNavigate();
  const goSection = useCallback((section: string) => navigate(`/${section}`), [navigate]);
  const { start, layer } = useGuideDemo({ t: tx, navigate: goSection, onStart: onClose });

  return (
    <>
      <PersoGuideDrawer open={open} t={tx} onClose={onClose} onStart={start} />
      {layer}
    </>
  );
}
