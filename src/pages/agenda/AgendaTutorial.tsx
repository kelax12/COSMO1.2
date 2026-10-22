// Tutoriel de l'Agenda, chargé à part (cf. `lazy-overlays.tsx`).
//
// Les étapes des deux variantes (desktop, mobile) voyageaient dans le chunk de
// la page alors qu'elles ne servent qu'à la première visite, ou quand on rejoue
// le tutoriel depuis les Réglages. Elles partent désormais avec ce module, qui
// n'est demandé qu'à la première ouverture du tutoriel.
import React from 'react';
import PageTutorial from '@/components/tutorial/PageTutorial';
import { agendaTutorialStepsDesktop } from '@/tutorials/agenda.desktop';
import { agendaTutorialStepsMobile } from '@/tutorials/agenda.mobile';

interface AgendaTutorialProps {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const AgendaTutorial: React.FC<AgendaTutorialProps> = ({ isMobile, isOpen, onClose }) => (
  <PageTutorial
    steps={isMobile ? agendaTutorialStepsMobile : agendaTutorialStepsDesktop}
    isOpen={isOpen}
    onClose={onClose}
    accentColor="#EF4444"
  />
);

export default AgendaTutorial;
