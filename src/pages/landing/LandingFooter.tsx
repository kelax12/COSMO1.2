// Pied de page de la LandingPage — extrait verbatim.
import React from 'react';
import { Link } from 'react-router';
import { useT } from '@/i18n/useT';
import { CONTACT_EMAIL } from '@/lib/contact.mjs';
import { useLocalizedPath } from '@/i18n/useLocalizedPath';
import type { LandingTrack } from './use-landing-track';

interface LandingFooterProps {
  /** Le pied de page suit la colorimétrie du parcours affiché : clair en
   *  perso, graphite en entreprise. Sans ça, une page blanche se terminait
   *  par un bloc noir, et le contraste des liens s'inversait au milieu. */
  track: LandingTrack;
}

const LandingFooter: React.FC<LandingFooterProps> = ({ track }) => {
  const { t } = useT('landing');
  const isEnterprise = track === 'entreprise';
  const shell = isEnterprise
    ? 'bg-black/40 border-white/10'
    : 'bg-slate-50 border-slate-200';
  const ink = isEnterprise ? 'text-white' : 'text-slate-900';
  const muted = isEnterprise ? 'text-slate-400' : 'text-slate-600';
  const hover = isEnterprise ? 'hover:text-white' : 'hover:text-slate-900';
  // Slugs localisés : un `to=` en dur rend une 404 hors du français (voir
  // `useLocalizedPath`). C'est le seul chemin vers les pages contractuelles.
  const localizedPath = useLocalizedPath();
  return (
      <footer className={`backdrop-blur-xl border-t py-10 ${shell}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center">
                  <img src="/logo-128.webp" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain" />
                </div>
                <span className={`text-lg font-bold ${ink}`}>Cosmo</span>
                <span className={`hidden sm:inline ${isEnterprise ? 'text-slate-600' : 'text-slate-400'}`}>·</span>
                <span className={`text-sm hidden sm:inline ${muted}`}>{t('footer.rights')}</span>
              </div>
              {/* Adresse de contact : écrite EN CLAIR et pas cachée derrière un
                  libellé « Contact ». Un visiteur qui cherche à qui parler doit
                  pouvoir lire l'adresse, la copier, l'ajouter à ses contacts —
                  y compris depuis la version prérendue de la page. */}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={`text-sm transition-colors ${muted} ${hover}`}
              >
                {t('footer.contact')} : <span className="underline underline-offset-2">{CONTACT_EMAIL}</span>
              </a>
            </div>
            <div className={`flex items-center gap-6 text-sm flex-wrap justify-center md:justify-end ${muted}`}>
              <Link to="/guide" className={`${hover} transition-colors`}>{t('footer.guide')}</Link>
              {/* La page qui porte l'offre payante : elle mérite un lien
                  permanent, y compris depuis le parcours perso. */}
              <Link
                to="/entreprise-presentation"
                className={`transition-colors ${isEnterprise ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-800'}`}
              >
                {t('footer.enterprise')}
              </Link>
              <Link to="/blog" className={`${hover} transition-colors`}>{t('footer.blog')}</Link>
              <Link to="/pour-freelances" className={`${hover} transition-colors`}>{t('footer.freelancers')}</Link>
              <Link to="/pour-etudiants" className={`${hover} transition-colors`}>{t('footer.students')}</Link>
              <Link to="/pour-managers" className={`${hover} transition-colors`}>{t('footer.managers')}</Link>
              <Link to="/pour-equipes" className={`${hover} transition-colors`}>{t('footer.teams')}</Link>
              <Link to="/a-propos" className={`${hover} transition-colors`}>{t('footer.about')}</Link>
              {/* Ancre in-page (scroll vers la FAQ) — reste un <a href="#..."> */}
              <a href="#faq" className={`${hover} transition-colors`}>FAQ</a>
              <Link to="/signup" className={`${hover} transition-colors`}>{t('footer.signup')}</Link>
              <Link to="/login" className={`${hover} transition-colors`}>{t('footer.login')}</Link>
              <Link to={localizedPath('legalNotice')} className={`${hover} transition-colors`}>{t('footer.legalNotice')}</Link>
              <Link to={localizedPath('privacy')} className={`${hover} transition-colors`}>{t('footer.privacy')}</Link>
              <Link to={localizedPath('terms')} className={`${hover} transition-colors`}>{t('footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
  );
};

export default LandingFooter;
