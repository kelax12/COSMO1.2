// ═══════════════════════════════════════════════════════════════════
// EventModalForm — wrapper (mobile iOS + desktop) de EventModal
// ═══════════════════════════════════════════════════════════════════
// Possède le useBottomSheet(onClose) + useIsMobile() + le motion.div externe
// commun, puis délègue le corps à EventModalFormMobile / EventModalFormDesktop
// selon le viewport. Les deux corps reçoivent l'intégralité des props + la
// largeur animée du drag handle.
import React from 'react';
import { motion } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import EventModalFormMobile from './EventModalFormMobile';
import EventModalFormDesktop from './EventModalFormDesktop';
import type { EventModalFormProps } from './event-modal-form.types';

export type { EventModalFormProps } from './event-modal-form.types';

const EventModalForm: React.FC<EventModalFormProps> = (props) => {
  const { onClose } = props;
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const isMobile = useIsMobile();

  return (
    <motion.div
      ref={sheetRef}
      {...sheetDragProps}
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
      className="rounded-t-[28px] md:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:shadow-2xl w-full md:max-w-4xl lg:max-w-5xl h-[92vh] md:h-auto md:max-h-[90vh] lg:max-h-[85vh] overflow-hidden flex flex-col"
      style={{ backgroundColor: "rgb(var(--color-surface))", paddingBottom: isMobile ? 0 : 'env(safe-area-inset-bottom)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile ? (
        <EventModalFormMobile {...props} handleBarWidth={handleBarWidth} />
      ) : (
        <EventModalFormDesktop {...props} handleBarWidth={handleBarWidth} />
      )}
    </motion.div>
  );
};

export default EventModalForm;
