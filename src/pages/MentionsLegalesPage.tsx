import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const MentionsLegalesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/welcome')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">Mentions légales</h1>
        <p className="text-slate-400 mb-10">Dernière mise à jour : 26 avril 2026</p>

        <Section title="1. Éditeur du site">
          <p>Le site et l'application <strong className="text-white">Cosmo</strong> sont édités par :</p>
          <ul className="list-none space-y-1 mt-2">
            <li><span className="text-slate-400">Dénomination :</span> Cosmo</li>
            <li><span className="text-slate-400">Adresse e-mail :</span> contact@cosmo.app</li>
            <li><span className="text-slate-400">Directeur de la publication :</span> L'équipe Cosmo</li>
          </ul>
        </Section>

        <Section title="2. Hébergement">
          <p>L'application Cosmo est hébergée par :</p>
          <ul className="list-none space-y-1 mt-2">
            <li><span className="text-slate-400">Frontend :</span> Vercel Inc. — 340 Pine Street, Suite 701, San Francisco, CA 94104, USA</li>
            <li><span className="text-slate-400">Base de données :</span> Supabase Inc. — 970 Toa Payoh North, #07-04, Singapore 318992</li>
          </ul>
        </Section>

        <Section title="3. Propriété intellectuelle">
          <p>
            L'ensemble des contenus présents sur Cosmo (textes, graphismes, logotypes, icônes, images, sons, données) est la propriété exclusive de Cosmo ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
          </p>
          <p>
            Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation préalable écrite de Cosmo.
          </p>
        </Section>

        <Section title="4. Responsabilité">
          <p>
            Cosmo s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur l'application. Toutefois, Cosmo ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition.
          </p>
          <p>
            Cosmo ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation de l'application ou de l'impossibilité d'y accéder.
          </p>
        </Section>

        <Section title="5. Droit applicable">
          <p>
            Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
          </p>
        </Section>

        <Section title="6. Contact">
          <p>
            Pour toute question relative aux présentes mentions légales, vous pouvez nous contacter à l'adresse suivante : <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>
          </p>
        </Section>
      </div>
    </div>
  );
};

export default MentionsLegalesPage;
