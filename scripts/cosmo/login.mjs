// Login interactif du CLI COSMO. À lancer PAR L'UTILISATEUR :
//   npm run cosmo:login
// Le compte étant Google-only, il n'y a pas de mot de passe : on passe par un
// code OTP envoyé par email. La session obtenue est persistée dans
// ~/.cosmo/session.json et rafraîchie automatiquement ensuite.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCosmoClient, SESSION_PATH, parseVerificationInput } from './client.mjs';

async function main() {
  const rl = readline.createInterface({ input, output });
  const client = createCosmoClient();

  try {
    const email = (await rl.question('Email du compte COSMO : ')).trim();
    if (!email) {
      console.error('Email vide, abandon.');
      process.exitCode = 1;
      return;
    }

    // shouldCreateUser: false — sans ça, une faute de frappe dans l'email
    // creerait silencieusement un nouveau compte.
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      console.error(`Envoi du code impossible : ${otpError.message}`);
      console.error(
        'Si le message parle de provider desactive, active Email dans Supabase > Authentication > Providers.'
      );
      process.exitCode = 1;
      return;
    }

    console.log(`Email envoye a ${email}.`);
    console.log('Selon le template Supabase, tu recois soit un code a 6 chiffres,');
    console.log('soit un lien « Log In ». Dans le second cas : copie le LIEN sans le');
    console.log('cliquer (appui long > Copier l adresse du lien) et colle-le ici.');

    const answer = await rl.question('Code ou lien : ');

    // parseVerificationInput lève une CosmoAuthError explicite si la saisie
    // n'est ni un code ni une URL — inutile de deviner ici.
    const parsed = parseVerificationInput(answer);

    const { data, error } =
      parsed.kind === 'otp'
        ? await client.auth.verifyOtp({ email, token: parsed.token, type: 'email' })
        : await client.auth.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type });

    if (error) {
      console.error(`Verification refusee : ${error.message}`);
      console.error('Un lien deja ouvert dans un navigateur est consomme : relance la commande');
      console.error('pour en recevoir un nouveau, et copie-le sans le cliquer.');
      process.exitCode = 1;
      return;
    }

    console.log(`Connecte en tant que ${data.user.email}.`);
    console.log(`Session enregistree dans ${SESSION_PATH}`);
    console.log('Tu peux maintenant lancer : npm run cosmo -- tasks list');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
