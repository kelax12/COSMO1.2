// Pied de page de la LandingPage — extrait verbatim.
import React from 'react';
import { Link } from 'react-router';
import { useT } from '@/i18n/useT';
import { CONTACT_EMAIL } from '@/lib/contact.mjs';

const LandingFooter: React.FC = () => {
  const { t } = useT('landing');
  return (
      <footer className="bg-black/40 backdrop-blur-xl border-t border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center">
                  <img src="/logo-128.webp" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain" />
                </div>
                <span className="text-lg font-bold text-white">Cosmo</span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-slate-400 text-sm hidden sm:inline">{t('footer.rights')}</span>
              </div>
              {/* Adresse de contact : écrite EN CLAIR et pas cachée derrière un
                  libellé « Contact ». Un visiteur qui cherche à qui parler doit
                  pouvoir lire l'adresse, la copier, l'ajouter à ses contacts —
                  y compris depuis la version prérendue de la page. */}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                {t('footer.contact')} : <span className="underline underline-offset-2">{CONTACT_EMAIL}</span>
              </a>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap justify-center md:justify-end">
              <Link to="/guide" className="hover:text-white transition-colors">{t('footer.guide')}</Link>
              {/* La page qui porte l'offre payante : elle mérite un lien
                  permanent, y compris depuis le parcours perso. */}
              <Link to="/entreprise-presentation" className="text-cyan-300 hover:text-cyan-200 transition-colors">
                {t('footer.enterprise')}
              </Link>
              <Link to="/blog" className="hover:text-white transition-colors">{t('footer.blog')}</Link>
              <Link to="/pour-freelances" className="hover:text-white transition-colors">{t('footer.freelancers')}</Link>
              <Link to="/pour-etudiants" className="hover:text-white transition-colors">{t('footer.students')}</Link>
              <Link to="/pour-managers" className="hover:text-white transition-colors">{t('footer.managers')}</Link>
              <Link to="/pour-equipes" className="hover:text-white transition-colors">{t('footer.teams')}</Link>
              <Link to="/a-propos" className="hover:text-white transition-colors">{t('footer.about')}</Link>
              {/* Ancre in-page (scroll vers la FAQ) — reste un <a href="#..."> */}
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <Link to="/signup" className="hover:text-white transition-colors">{t('footer.signup')}</Link>
              <Link to="/login" className="hover:text-white transition-colors">{t('footer.login')}</Link>
              <Link to="/mentions-legales" className="hover:text-white transition-colors">{t('footer.legalNotice')}</Link>
              <Link to="/politique-confidentialite" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <Link to="/cgu" className="hover:text-white transition-colors">{t('footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
  );
};

export default LandingFooter;
