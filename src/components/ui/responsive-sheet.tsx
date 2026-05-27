import * as React from 'react';
import { Drawer as VaulDrawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * <ResponsiveSheet> — iOS-style bottom drawer on mobile (via vaul, full-surface
 * swipe-to-dismiss with velocity-aware scroll arbitration), centered dialog on
 * desktop (motion.div + AnimatePresence, no swipe needed).
 *
 * Why vaul on mobile: iOS Safari steals touches landing in `overflow-y-auto`
 * and emits `pointercancel` before any JS drag handler can lock in. Custom
 * Framer Motion drag hooks (handle-only, full-sheet with useDragControls,
 * pointermove arming) all fail under that constraint. Vaul implements the
 * arbitration in native touch handlers and is the only reliable way to ship
 * the Apple-Calendar UX on the web.
 *
 * Usage:
 *   <ResponsiveSheet isOpen={open} onClose={close} ariaLabel="Mon modal">
 *     <Header />
 *     <Body className="flex-1 overflow-y-auto" />
 *     <Footer />
 *   </ResponsiveSheet>
 */
export interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Classes additionnelles sur le conteneur du sheet. */
  className?: string;
  /** Classes additionnelles sur le backdrop overlay. */
  overlayClassName?: string;
  /** Hauteur max desktop (default '90vh'). */
  desktopMaxHeight?: string;
  /** Max-width desktop. Default 'sm:max-w-md'. */
  desktopMaxWidth?: string;
  /** z-index du backdrop. Le content est zIndex+1. Default 50. */
  zIndex?: number;
  /** Affiche la handle bar mobile (default true). */
  showHandle?: boolean;
  /** Label accessibilité — requis par vaul. */
  ariaLabel: string;
  /** Désactive le swipe-to-dismiss mobile (rare, ex. modal critique). */
  dismissible?: boolean;
}

export function ResponsiveSheet({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  desktopMaxHeight = '90vh',
  desktopMaxWidth = 'sm:max-w-md',
  zIndex = 50,
  showHandle = true,
  ariaLabel,
  dismissible = true,
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <VaulDrawer.Root
        open={isOpen}
        onOpenChange={(o) => { if (!o) onClose(); }}
        dismissible={dismissible}
      >
        <VaulDrawer.Portal>
          <VaulDrawer.Overlay
            className={cn('fixed inset-0 bg-black/40 backdrop-blur-md', overlayClassName)}
            style={{ zIndex }}
          />
          <VaulDrawer.Content
            aria-label={ariaLabel}
            className={cn(
              'fixed bottom-0 left-0 right-0 outline-none',
              'flex flex-col max-h-[92dvh]',
              'rounded-t-[28px]',
              'shadow-[0_-12px_40px_rgba(0,0,0,0.18)]',
              'bg-[rgb(var(--color-surface))]',
              className,
            )}
            style={{ zIndex: zIndex + 1, paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <VaulDrawer.Title className="sr-only">{ariaLabel}</VaulDrawer.Title>
            <VaulDrawer.Description className="sr-only">{ariaLabel}</VaulDrawer.Description>
            {showHandle && (
              <div className="flex justify-center pt-2 pb-1 shrink-0" aria-hidden>
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}
            {children}
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>
    );
  }

  // Desktop: centered dialog (no swipe needed)
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={cn(
            'fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md p-4',
            overlayClassName,
          )}
          style={{ zIndex }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full bg-[rgb(var(--color-surface))] rounded-2xl shadow-2xl flex flex-col',
              desktopMaxWidth,
              className,
            )}
            style={{ maxHeight: desktopMaxHeight, zIndex: zIndex + 1 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ResponsiveSheet;
