import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const CGUPage: React.FC = () => {
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

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">Conditions Générales d'Utilisation</h1>
        <p className="text-slate-400 mb-10">Dernière mise à jour : 26 avril 2026</p>

        <Section title="1. Objet">
          <p>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application <strong className="text-white">Cosmo</strong>, plateforme de gestion de tâches, habitudes, objectifs (OKR) et agenda disponible sur le web.
          </p>
          <p>
            En créant un compte ou en utilisant Cosmo, vous acceptez sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser l'application.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p>Cosmo est accessible :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>En <strong className="text-white">mode démo</strong> sans inscription, avec des données exemples</li>
            <li>En <strong className="text-white">mode standard (gratuit)</strong> après création d'un compte</li>
            <li>En <strong className="text-white">mode Premium</strong> après souscription d'un abonnement payant</li>
          </ul>
          <p className="mt-2">
            L'inscription nécessite une adresse e-mail valide et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants.
          </p>
        </Section>

        <Section title="3. Compte utilisateur">
          <p>
            Chaque utilisateur ne peut disposer que d'un seul compte. Vous vous engagez à fournir des informations exactes lors de l'inscription et à les maintenir à jour.
          </p>
          <p>
            Cosmo se réserve le droit de suspendre ou supprimer un compte en cas de violation des présentes CGU, sans préavis ni indemnité.
          </p>
        </Section>

        <Section title="4. Utilisation acceptable">
          <p>En utilisant Cosmo, vous vous engagez à ne pas :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Utiliser l'application à des fins illégales ou frauduleuses</li>
            <li>Tenter de compromettre la sécurité de l'application ou des serveurs</li>
            <li>Extraire, copier ou redistribuer le contenu de l'application sans autorisation</li>
            <li>Créer plusieurs comptes pour contourner des restrictions</li>
            <li>Partager votre compte avec d'autres personnes (hors fonctionnalités collaboratives prévues)</li>
            <li>Utiliser des robots ou scripts automatisés pour interagir avec l'application</li>
          </ul>
        </Section>

        <Section title="5. Abonnement Premium">
          <p>
            Certaines fonctionnalités avancées sont accessibles via un abonnement Premium. Les tarifs et modalités sont présentés dans l'application.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Le paiement est traité de manière sécurisée via <strong className="text-white">Stripe</strong></li>
            <li>L'abonnement est renouvelé automatiquement selon la période choisie (mensuelle ou annuelle)</li>
            <li>Vous pouvez annuler votre abonnement à tout moment depuis les paramètres de votre compte</li>
            <li>Conformément à la législation française, vous disposez d'un droit de rétractation de 14 jours après la souscription initiale</li>
          </ul>
        </Section>

        <Section title="6. Propriété des données">
          <p>
            Les données que vous créez dans Cosmo (tâches, habitudes, objectifs, événements) vous appartiennent. Cosmo n'y accède que dans le cadre de la fourniture du service.
          </p>
          <p>
            Vous pouvez demander l'export ou la suppression de vos données à tout moment via les paramètres ou en contactant <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>.
          </p>
        </Section>

        <Section title="7. Propriété intellectuelle">
          <p>
            L'application Cosmo, son code source, son design, ses marques et logos sont la propriété exclusive de Cosmo. Toute reproduction ou exploitation non autorisée est strictement interdite.
          </p>
        </Section>

        <Section title="8. Disponibilité du service">
          <p>
            Cosmo s'efforce d'assurer une disponibilité maximale du service. Toutefois, des interruptions peuvent survenir pour maintenance ou en cas de force majeure. Cosmo ne garantit pas une disponibilité ininterrompue et décline toute responsabilité pour les pertes éventuelles résultant d'une indisponibilité.
          </p>
        </Section>

        <Section title="9. Limitation de responsabilité">
          <p>
            Cosmo est fourni "tel quel", sans garantie d'adéquation à un usage particulier. Cosmo ne saurait être tenu responsable des dommages indirects, pertes de données ou manque à gagner résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
          </p>
          <p>
            La responsabilité de Cosmo est en tout état de cause limitée au montant des sommes versées par l'utilisateur au cours des 12 derniers mois.
          </p>
        </Section>

        <Section title="10. Résiliation">
          <p>
            Vous pouvez supprimer votre compte à tout moment depuis les paramètres de l'application. La suppression entraîne l'effacement définitif de toutes vos données dans un délai de 90 jours.
          </p>
          <p>
            Cosmo peut résilier votre accès en cas de violation des CGU, après notification par e-mail sauf urgence.
          </p>
        </Section>

        <Section title="11. Modifications des CGU">
          <p>
            Cosmo se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication. En cas de modification substantielle, vous serez informé par e-mail avec un préavis de 30 jours.
          </p>
          <p>
            La poursuite de l'utilisation du service après modification vaut acceptation des nouvelles CGU.
          </p>
        </Section>

        <Section title="12. Droit applicable et juridiction">
          <p>
            Les présentes CGU sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux compétents de Paris seront seuls compétents.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Pour toute question relative aux présentes CGU : <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>
          </p>
        </Section>
      </div>
    </div>
  );
};

export default CGUPage;
