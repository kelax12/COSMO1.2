import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import AuthForm from '@/components/AuthForm';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  onSwitchMode: (mode: 'login' | 'register') => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const navigate = useNavigate();

  const handleSuccess = () => {
    onClose();
    // setTimeout 0 : laisse React commiter setUser() (loginDemo) avant que
    // ProtectedRoute vérifie isAuthenticated.
    setTimeout(() => navigate('/dashboard'), 0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            data-scroll-area
            className="bg-slate-900 border-t sm:border border-slate-700 rounded-t-[28px] sm:rounded-2xl p-6 sm:p-8 w-full sm:max-w-md relative shadow-[0_-12px_40px_rgba(0,0,0,0.4)] sm:shadow-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center -mt-3 mb-3">
              <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-600/80" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} aria-hidden="true" />
            </Button>

            <AuthForm
              mode={mode}
              onSwitchMode={onSwitchMode}
              onSuccess={handleSuccess}
              headingAs="h2"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
