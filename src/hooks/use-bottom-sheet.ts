import { useRef, useCallback, useEffect } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { useIsMobile } from '@/lib/hooks/use-mobile';

export interface BottomSheetDragProps {
  drag: 'y';
  dragConstraints: { top: number; bottom: number };
  dragElastic: { top: number; bottom: number };
  dragMomentum: boolean;
  onDrag: (_: unknown, info: PanInfo) => void;
  onDragEnd: (_: unknown, info: PanInfo) => void;
}

export interface BottomSheetHook {
  sheetRef: React.RefObject<HTMLDivElement>;
  backdropOpacity: ReturnType<typeof useTransform>;
  handleBarWidth: ReturnType<typeof useTransform>;
  sheetDragProps: BottomSheetDragProps | Record<string, never>;
}

/**
 * Native iOS-style bottom-sheet drag behavior.
 *
 * - Drag > 35% height OR velocity > 500 px/s → closes (calls onClose)
 * - Smaller drag → spring snap-back
 * - Backdrop opacity fades in real-time as the sheet is pulled down
 * - Handle bar stretches subtly on drag
 *
 * Only activates on mobile (< 768px). Desktop modals are unaffected.
 */
export function useBottomSheet(onClose: () => void): BottomSheetHook {
  const isMobile = useIsMobile();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Track drag distance for visual feedback only (not actual position)
  const dragY = useMotionValue(0);

  // Backdrop base opacity: animated in on mount
  const backdropBase = useMotionValue(0);
  useEffect(() => {
    animate(backdropBase, 1, { duration: 0.2, ease: 'easeOut' });
  }, [backdropBase]);

  // Effective backdrop opacity = base × (1 - drag progress)
  const backdropOpacity = useTransform(
    [backdropBase, dragY],
    ([base, drag]: number[]) => (base as number) * Math.max(0.04, 1 - (drag as number) / 280),
  );

  // Handle bar widens slightly as the sheet is pulled — subtle haptic-like feedback
  const handleBarWidth = useTransform(dragY, [0, 80], [36, 52]);

  const onDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      dragY.set(Math.max(0, info.offset.y));
    },
    [dragY],
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const height = sheetRef.current?.offsetHeight ?? 600;
      const shouldClose =
        info.offset.y > height * 0.35 || info.velocity.y > 500;

      if (shouldClose) {
        // Leave dragY as-is — exit animation handles the backdrop fade-out
        onClose();
      } else {
        // Snap-back: restore backdrop opacity with a spring
        animate(dragY, 0, { type: 'spring', damping: 28, stiffness: 380 });
        // The sheet itself springs back via Framer Motion's dragConstraints
      }
    },
    [dragY, onClose],
  );

  if (!isMobile) {
    return {
      sheetRef,
      backdropOpacity,
      handleBarWidth,
      sheetDragProps: {},
    };
  }

  return {
    sheetRef,
    backdropOpacity,
    handleBarWidth,
    sheetDragProps: {
      drag: 'y',
      dragConstraints: { top: 0, bottom: 0 },
      dragElastic: { top: 0, bottom: 0.3 },
      dragMomentum: false,
      onDrag,
      onDragEnd,
    },
  };
}
