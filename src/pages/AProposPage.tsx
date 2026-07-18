import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const AProposPage: React.FC = () => {
  useSeoMeta({
    title: 'À propos de Cosmo — qui sommes-nous ?',
    description:
      "Pourquoi Cosmo existe : une application de productivité française, gratuite, qui réunit tâches, habitudes, agenda et OKR dans un seul écosystème.",
    canonical: 'https://thecosmo.app/a-propos',
  });
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">À propos de Cosmo</h1>
        <p className="text-slate-400 mb-10">Une app de productivité française, gratuite, tout-en-un.</p>

        <Section title="Pourquoi Cosmo existe">
          <p>
            S'organiser en 2026 ressemble trop souvent à ça : une todo-list quelque part, une application
            d'habitudes ailleurs, un agenda dans un troisième outil, et des objectifs de début d'année…
            dans un tableur qu'on n'ouvre plus jamais. Chaque outil est bon, mais rien ne se parle.
          </p>
          <p>
            Cosmo part d'une conviction simple : <strong className="text-white">la productivité personnelle repose
            sur quatre piliers — les tâches, les habitudes, le temps et les objectifs</strong> — et ils ne
            fonctionnent vraiment que connectés. Une tâche se planifie dans l'agenda, une habitude nourrit
            un objectif, et le tout se mesure au même endroit.
          </p>
        </Section>

        <Section title="Ce qu'on croit">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">Gratuit d'abord.</strong> Les fonctionnalités principales sont gratuites, sans limite artificielle. On préfère convaincre que verrouiller.</li>
            <li><strong className="text-white">Essayer avant de s'inscrire.</strong> La démo s'ouvre sans compte ni email, pré-remplie avec 12 mois de données réalistes. Jugez sur pièce.</li>
            <li><strong className="text-white">Le français n'est pas une traduction.</strong> Cosmo est conçu en français, pour un public francophone — pas localisé après coup.</li>
            <li><strong className="text-white">Vos données vous appartiennent.</strong> Stockage sécurisé avec Row Level Security, et en mode démo, rien ne quitte votre navigateur.</li>
          </ul>
        </Section>

        <Section title="Qui est derrière ?">
          <p>
            Cosmo est un produit indépendant, développé en France par une très petite équipe — pas de
            levée de fonds, pas de growth hacking agressif, juste un produit qu'on améliore chaque semaine
            en écoutant les retours des utilisateurs.
          </p>
          <p>
            Une question, un bug, une idée ? Écrivez-nous :{' '}
            <a href="mailto:axellongattepro@gmail.com" className="text-blue-400 hover:underline">
              axellongattepro@gmail.com
            </a>
            . On répond vite.
          </p>
        </Section>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold mb-2">Découvrez Cosmo en 2 minutes</p>
          <p className="text-slate-400 text-sm mb-5">Tâches, habitudes, agenda et OKR — démo instantanée, sans inscription.</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
          >
            Commencer gratuitement
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AProposPage;
