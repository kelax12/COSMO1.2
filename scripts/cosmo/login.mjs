// Login interactif du CLI COSMO. À lancer PAR L'UTILISATEUR :
//   npm run cosmo:login
// Le compte étant Google-only, il n'y a pas de mot de passe : on passe par un
// code OTP envoyé par email. La session obtenue est persistée dans
// ~/.cosmo/session.json et rafraîchie automatiquement ensuite.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCosmoClient, SESSION_PATH } from './client.mjs';

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

    console.log(`Code envoye a ${email}.`);
    const token = (await rl.question('Colle le code recu : ')).trim();

    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      console.error(`Code refuse : ${error.message}`);
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
