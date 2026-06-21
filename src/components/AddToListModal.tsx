import React from 'react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { AddToListModalProps } from './add-to-list/shared';
import DesktopAddToList from './add-to-list/DesktopAddToList';
import MobileAddToList from './add-to-list/MobileAddToList';

// ════════════════════════════════════════════════════════════════════════
// Dispatch desktop ↔ mobile selon viewport.
// ════════════════════════════════════════════════════════════════════════

const AddToListModal: React.FC<AddToListModalProps> = (props) => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileAddToList {...props} /> : <DesktopAddToList {...props} />;
};

export default AddToListModal;
