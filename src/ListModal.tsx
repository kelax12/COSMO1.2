import React from 'react';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import ListManager from './components/ListManager';
import { X } from 'lucide-react';

interface ListModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNested?: boolean;
}

const ListModal: React.FC<ListModalProps> = ({ isOpen, onClose, isNested }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent 
          showCloseButton={false} 
            className={`p-0 border-0 sm:bg-transparent sm:shadow-none w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ${
              isNested ? 'sm:max-w-5xl z-[80]' : 'sm:max-w-6xl'
            }`}
        >

        <DialogTitle className="sr-only">Gestion des listes</DialogTitle>
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-lg transition-colors z-10"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-accent))';
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
          <ListManager isNested={isNested} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListModal;
