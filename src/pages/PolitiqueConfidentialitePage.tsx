import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const PolitiqueConfidentialitePage: React.FC = () => {
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

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Politique de confidentialité</h1>
        <p className="text-slate-400 mb-10">Dernière mise à jour : 26 avril 2026</p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via l'application Cosmo est l'équipe Cosmo, joignable à <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Lors de votre utilisation de Cosmo, nous collectons les données suivantes :</p>
          <ul className="list-disc list-inside space-y-1 mt-2 text-slate-300">
            <li><strong className="text-white">Données d'identification :</strong> nom, adresse e-mail, mot de passe chiffré</li>
            <li><strong className="text-white">Données d'utilisation :</strong> tâches, habitudes, événements, OKR et préférences que vous créez dans l'application</li>
            <li><strong className="text-white">Données techniques :</strong> adresse IP, type de navigateur, système d'exploitation, pages visitées, durée des sessions</li>
            <li><strong className="text-white">Données de paiement :</strong> gérées directement par Stripe — Cosmo ne stocke aucune donnée bancaire</li>
          </ul>
        </Section>

        <Section title="3. Finalités du traitement">
          <p>Vos données sont utilisées pour :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Créer et gérer votre compte utilisateur</li>
            <li>Fournir les fonctionnalités de l'application (tâches, agenda, habitudes, OKR, statistiques)</li>
            <li>Traiter les paiements et gérer les abonnements Premium</li>
            <li>Améliorer l'application via l'analyse d'usage anonymisée</li>
            <li>Vous contacter en cas de problème technique ou de mise à jour importante</li>
          </ul>
        </Section>

        <Section title="4. Base légale">
          <p>Le traitement de vos données repose sur :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Exécution du contrat</strong> pour les données nécessaires au fonctionnement du service</li>
            <li><strong className="text-white">Intérêt légitime</strong> pour l'amélioration du produit et la sécurité</li>
            <li><strong className="text-white">Consentement</strong> pour les cookies non essentiels et les communications marketing</li>
          </ul>
        </Section>

        <Section title="5. Durée de conservation">
          <ul className="list-disc list-inside space-y-1">
            <li>Données de compte : conservées pendant toute la durée d'activité du compte, puis supprimées sous 90 jours après clôture</li>
            <li>Données de contenu (tâches, habitudes, OKR) : supprimées immédiatement à la demande de l'utilisateur</li>
            <li>Logs techniques : conservés 12 mois maximum</li>
            <li>Données de paiement : conservées selon les obligations légales (10 ans pour la comptabilité)</li>
          </ul>
        </Section>

        <Section title="6. Partage des données">
          <p>Vos données peuvent être partagées avec :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Supabase</strong> — stockage de la base de données (serveurs en UE)</li>
            <li><strong className="text-white">Vercel</strong> — hébergement de l'application</li>
            <li><strong className="text-white">Stripe</strong> — traitement des paiements</li>
          </ul>
          <p className="mt-3">Aucune donnée n'est vendue à des tiers. Aucun partage à des fins publicitaires.</p>
        </Section>

        <Section title="7. Vos droits (RGPD)">
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Droit d'accès</strong> — obtenir une copie de vos données</li>
            <li><strong className="text-white">Droit de rectification</strong> — corriger des données inexactes</li>
            <li><strong className="text-white">Droit à l'effacement</strong> — supprimer votre compte et toutes vos données</li>
            <li><strong className="text-white">Droit à la portabilité</strong> — exporter vos données dans un format lisible</li>
            <li><strong className="text-white">Droit d'opposition</strong> — s'opposer à certains traitements</li>
            <li><strong className="text-white">Droit à la limitation</strong> — restreindre le traitement dans certains cas</li>
          </ul>
          <p className="mt-3">Pour exercer ces droits, contactez-nous à <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>. Nous répondrons dans un délai maximum de 30 jours.</p>
          <p className="mt-2">Vous avez également le droit de déposer une réclamation auprès de la <strong className="text-white">CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">www.cnil.fr</a></p>
        </Section>

        <Section title="8. Sécurité">
          <p>
            Cosmo met en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction. Les communications sont chiffrées via HTTPS/TLS et les mots de passe sont stockés sous forme hachée.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            Cosmo utilise des cookies essentiels au fonctionnement de l'application (session, préférences) et des cookies analytiques optionnels pour améliorer l'expérience. Vous pouvez gérer vos préférences via la bannière cookie accessible à tout moment.
          </p>
        </Section>

        <Section title="10. Modifications">
          <p>
            Cette politique peut être mise à jour. En cas de modification substantielle, vous serez informé par e-mail ou via une notification dans l'application. La date de dernière mise à jour est indiquée en haut de cette page.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default PolitiqueConfidentialitePage;
