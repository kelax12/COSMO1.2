import React from 'react';
import { useT } from '@/i18n/useT';
import { requestConsentReview } from '@/lib/cookie-consent';

/**
 * « Gérer les cookies » : rouvre le bandeau de consentement.
 *
 * 🔴 RGPD art. 7.3 : retirer son consentement doit être aussi simple que le
 * donner. Jusqu'au 2026-09-24, une fois « Accepter » cliqué, rien ne permettait
 * de revenir sur ce choix sinon d'effacer les données du site.
 *
 * Un `<button>` et pas un lien : il ne navigue nulle part, il ouvre une surface.
 * Le style de lien est passé par l'appelant pour se fondre dans son contexte.
 */
const ManageCookiesButton: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useT('common');
  return (
    <button type="button" onClick={requestConsentReview} className={className}>
      {t('cookies.manage')}
    </button>
  );
};

export default ManageCookiesButton;
