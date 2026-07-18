// Pied de page de la LandingPage — extrait verbatim.
import React from 'react';

const LandingFooter: React.FC = () => (
      <footer className="bg-black/40 backdrop-blur-xl border-t border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center">
                <img src="/logo.png" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-white">Cosmo</span>
              <span className="text-slate-600 hidden sm:inline">—</span>
              <span className="text-slate-400 text-sm hidden sm:inline">© 2026 Tous droits réservés.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap justify-center md:justify-end">
              <a href="/guide" className="hover:text-white transition-colors">Guide d'utilisation</a>
              <a href="/blog" className="hover:text-white transition-colors">Blog</a>
              <a href="/a-propos" className="hover:text-white transition-colors">À propos</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <a href="/signup" className="hover:text-white transition-colors">Inscription gratuite</a>
              <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</a>
              <a href="/politique-confidentialite" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="/cgu" className="hover:text-white transition-colors">CGU</a>
            </div>
          </div>
        </div>
      </footer>
);

export default LandingFooter;
