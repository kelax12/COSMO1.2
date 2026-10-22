// src/components/org-guide/OrgGuideHost.tsx
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '@/i18n/useT';
import { orgSectionPath } from '@/components/organization/deep-link.helpers';
import { DIRECTORY_PARAMS } from '@/components/organization/member-directory.filters';
import { emitOrgGuideDemo } from './guide-demo-signal';
import { OrgGuideDrawer } from './OrgGuideDrawer';
import { useGuideDemo, type GuideT } from './use-guide-demo';
import type { GuideViewer } from './guide-types';

interface Props { open: boolean; onClose: () => void; viewer: GuideViewer }

export default function OrgGuideHost({ open, onClose, viewer }: Props) {
  const { t } = useT('orgGuide');
  const tx: GuideT = useCallback((key, vars) => t(key as Parameters<typeof t>[0], vars), [t]);
  const navigate = useNavigate();
  const goSection = useCallback((section: string) => navigate(orgSectionPath(section)), [navigate]);
  const { start, layer } = useGuideDemo({ t: tx, navigate: goSection, onPhase: emitOrgGuideDemo, onStart: onClose });

  const seeAdmins = () => {
    onClose();
    navigate(`${orgSectionPath('members')}?${DIRECTORY_PARAMS.role}=admin`);
  };

  return (
    <>
      <OrgGuideDrawer open={open} viewer={viewer} onClose={onClose} onStart={start} onSeeAdmins={seeAdmins} />
      {layer}
    </>
  );
}
