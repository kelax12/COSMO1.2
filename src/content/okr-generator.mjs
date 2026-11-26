// Banque du générateur d'OKR (plan SEO C7) : objectifs types et résultats clés
// proposés par domaine, rédigés à la main (aucune IA). ESM pur, lu par la page
// `OkrGeneratorPage`. Chaque résultat clé : libellé, unité, départ et cible
// indicatifs, à ajuster par le visiteur. `hr` retombe sur `en`.
export const OKR_DOMAINES = [
  {
    id: 'forme',
    fr: { nom: 'Santé et forme', objectifs: ['Retrouver une vraie forme physique', 'Dormir mieux et avoir plus d’énergie'],
      kr: [['Séances de sport réalisées', 'séances', '0', '30'], ['Distance courue sans s’arrêter', 'km', '2', '8'], ['Nuits d’au moins 7 h par semaine', 'nuits', '3', '5'], ['Pas quotidiens en moyenne', 'pas', '4000', '8000'], ['Jours sans alcool par semaine', 'jours', '3', '5'], ['Repas préparés maison par semaine', 'repas', '5', '10']] },
    en: { nom: 'Health and fitness', objectifs: ['Get genuinely fit again', 'Sleep better and have more energy'],
      kr: [['Workouts completed', 'workouts', '0', '30'], ['Distance run without stopping', 'km', '2', '8'], ['Nights of at least 7 h per week', 'nights', '3', '5'], ['Average daily steps', 'steps', '4000', '8000'], ['Alcohol-free days per week', 'days', '3', '5'], ['Home-cooked meals per week', 'meals', '5', '10']] },
  },
  {
    id: 'etudes',
    fr: { nom: 'Études', objectifs: ['Réussir mon semestre sans rush final', 'Devenir à l’aise dans la matière qui me bloque'],
      kr: [['Moyenne générale', 'points', '11', '12,5'], ['Heures de révision par semaine', 'h', '3', '8'], ['Annales faites par matière', 'annales', '0', '3'], ['Fiches de révision terminées', 'fiches', '0', '20'], ['Cours relus le jour même', '%', '20', '80'], ['Questions posées aux enseignants', 'questions', '0', '6']] },
    en: { nom: 'Studies', objectifs: ['Pass my semester without a final rush', 'Get comfortable with the subject that holds me back'],
      kr: [['Overall average', 'points', '11', '12.5'], ['Revision hours per week', 'h', '3', '8'], ['Past papers done per subject', 'papers', '0', '3'], ['Revision sheets finished', 'sheets', '0', '20'], ['Lectures reviewed the same day', '%', '20', '80'], ['Questions asked to teachers', 'questions', '0', '6']] },
  },
  {
    id: 'freelance',
    fr: { nom: 'Activité de freelance', objectifs: ['Remplir mon carnet de commandes', 'Mieux gagner ma vie sans travailler plus'],
      kr: [['Prises de contact qualifiées par semaine', 'contacts', '0', '5'], ['Nouveaux clients signés', 'clients', '0', '2'], ['Chiffre d’affaires mensuel moyen', '€', '4000', '5000'], ['Part du temps facturable', '%', '50', '65'], ['Tarif journalier moyen', '€', '350', '420'], ['Livraisons dans les délais', '%', '85', '95']] },
    en: { nom: 'Freelance business', objectifs: ['Fill my pipeline', 'Earn a better living without working more'],
      kr: [['Qualified outreach contacts per week', 'contacts', '0', '5'], ['New clients signed', 'clients', '0', '2'], ['Average monthly revenue', '€', '4000', '5000'], ['Share of billable time', '%', '50', '65'], ['Average day rate', '€', '350', '420'], ['On-time deliveries', '%', '85', '95']] },
  },
  {
    id: 'carriere',
    fr: { nom: 'Carrière', objectifs: ['Décrocher le poste que je vise', 'Devenir une référence dans mon équipe'],
      kr: [['Candidatures personnalisées envoyées', 'candidatures', '0', '20'], ['Entretiens obtenus', 'entretiens', '0', '4'], ['Personnes de mon secteur rencontrées', 'rencontres', '0', '8'], ['Heures de formation suivies', 'h', '0', '20'], ['Présentations données en interne', 'présentations', '0', '2'], ['Projets livrés dont je suis responsable', 'projets', '0', '2']] },
    en: { nom: 'Career', objectifs: ['Land the role I am aiming for', 'Become a go-to person in my team'],
      kr: [['Tailored applications sent', 'applications', '0', '20'], ['Interviews obtained', 'interviews', '0', '4'], ['People in my field met', 'meetings', '0', '8'], ['Training hours completed', 'h', '0', '20'], ['Internal presentations given', 'presentations', '0', '2'], ['Projects delivered that I own', 'projects', '0', '2']] },
  },
  {
    id: 'argent',
    fr: { nom: 'Argent', objectifs: ['Mettre mes finances en ordre', 'Constituer une vraie épargne de précaution'],
      kr: [['Épargne de précaution', 'mois de dépenses', '0,5', '1,5'], ['Abonnements inutiles résiliés', 'abonnements', '0', '4'], ['Mois avec un budget tenu', 'mois', '0', '3'], ['Dépenses notées chaque semaine', 'semaines', '0', '12'], ['Montant épargné chaque mois', '€', '50', '200'], ['Dettes à la consommation remboursées', '%', '0', '50']] },
    en: { nom: 'Money', objectifs: ['Get my finances in order', 'Build a real emergency fund'],
      kr: [['Emergency fund', 'months of expenses', '0.5', '1.5'], ['Unused subscriptions cancelled', 'subscriptions', '0', '4'], ['Months within budget', 'months', '0', '3'], ['Weeks with spending tracked', 'weeks', '0', '12'], ['Amount saved each month', '€', '50', '200'], ['Consumer debt repaid', '%', '0', '50']] },
  },
  {
    id: 'marketing',
    fr: { nom: 'Équipe marketing', objectifs: ['Remplir le pipeline commercial', 'Convertir mieux nos visiteurs'],
      kr: [['Demandes de démo qualifiées par mois', 'demandes', '40', '70'], ['Coût par demande qualifiée', '€', '120', '95'], ['Taux visite → inscription', '%', '1,8', '3'], ['Sites tiers qui nous citent avec un lien', 'sites', '5', '15'], ['Articles en première page sur nos requêtes cibles', 'articles', '0', '3'], ['Taux d’ouverture de la newsletter', '%', '25', '35']] },
    en: { nom: 'Marketing team', objectifs: ['Fill the sales pipeline', 'Convert our visitors better'],
      kr: [['Qualified demo requests per month', 'requests', '40', '70'], ['Cost per qualified request', '€', '120', '95'], ['Visit to sign-up rate', '%', '1.8', '3'], ['Third-party sites linking to us', 'sites', '5', '15'], ['Articles on page one for target queries', 'articles', '0', '3'], ['Newsletter open rate', '%', '25', '35']] },
  },
  {
    id: 'produit',
    fr: { nom: 'Produit et startup', objectifs: ['Prouver que le marché veut le produit', 'Rendre le produit indispensable'],
      kr: [['Clients payants actifs', 'clients', '12', '30'], ['Rétention à 3 mois', '%', '45', '60'], ['Utilisateurs actifs chaque semaine / inscrits', '%', '20', '35'], ['Délai avant la première valeur', 'minutes', '15', '5'], ['Entretiens utilisateurs menés', 'entretiens', '0', '15'], ['Note de satisfaction moyenne', '/10', '7', '8,5']] },
    en: { nom: 'Product and startup', objectifs: ['Prove the market wants the product', 'Make the product indispensable'],
      kr: [['Active paying customers', 'customers', '12', '30'], ['3-month retention', '%', '45', '60'], ['Weekly active users / sign-ups', '%', '20', '35'], ['Time to first value', 'minutes', '15', '5'], ['User interviews held', 'interviews', '0', '15'], ['Average satisfaction score', '/10', '7', '8.5']] },
  },
  {
    id: 'equipe',
    fr: { nom: 'Management d’équipe', objectifs: ['Construire une équipe autonome', 'Livrer sans épuiser l’équipe'],
      kr: [['Rituels d’équipe tenus', '%', '60', '90'], ['Entretiens individuels réalisés', 'entretiens', '0', '12'], ['Décisions prises sans moi', 'décisions', '2', '10'], ['Livraisons dans les délais', '%', '70', '90'], ['Heures supplémentaires par personne et par semaine', 'h', '6', '2'], ['Score d’engagement de l’équipe', '/10', '6,5', '8']] },
    en: { nom: 'Team management', objectifs: ['Build a self-reliant team', 'Deliver without burning the team out'],
      kr: [['Team rituals held', '%', '60', '90'], ['One-to-ones held', 'meetings', '0', '12'], ['Decisions made without me', 'decisions', '2', '10'], ['On-time deliveries', '%', '70', '90'], ['Overtime per person per week', 'h', '6', '2'], ['Team engagement score', '/10', '6.5', '8']] },
  },
];
