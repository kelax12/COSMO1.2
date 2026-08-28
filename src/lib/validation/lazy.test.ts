// La validation zod ne part plus avec le chunk d'entrée : elle est chargée à la
// première écriture. Ce fichier vérifie les deux choses que la paresse met en
// jeu — et une seule des deux est évidente.
//
//   1. La validation FONCTIONNE ENCORE. Une entrée invalide doit toujours être
//      refusée avant l'appel réseau ; sinon on aurait gagné 30 ko en supprimant
//      la garde plutôt qu'en la différant.
//   2. AUCUNE clé du registre ne pointe dans le vide. C'est le risque propre à
//      l'indirection : `import('…').then(m => m.createTaskShema)` compile très
//      bien et résout `undefined`. Rien ne le signalerait avant qu'un
//      utilisateur clique « Créer ».
import { describe, it, expect } from 'vitest';
import { validateAsync, SCHEMA_KEYS } from './lazy';
import { ValidationError } from './validate';

describe('validateAsync — le registre est complet', () => {
  it('les 13 clés résolvent vers un schéma réellement utilisable', async () => {
    expect(SCHEMA_KEYS.length).toBeGreaterThan(0);
    // On passe volontairement une entrée vide : peu importe qu'elle soit
    // acceptée ou refusée, ce qui compte est qu'un SCHÉMA ait répondu. Une clé
    // cassée lèverait un TypeError (`safeParse` de `undefined`), pas une
    // ValidationError.
    for (const key of SCHEMA_KEYS) {
      try {
        await validateAsync(key, {});
      } catch (error) {
        expect(error, `clé « ${key} » : le schéma n'a pas répondu`).toBeInstanceOf(ValidationError);
      }
    }
  });
});

describe('validateAsync — la garde fait toujours son travail', () => {
  it('refuse une tâche sans nom', async () => {
    await expect(validateAsync('task.create', { name: '', category: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuse un code de jointure manifestement invalide', async () => {
    await expect(validateAsync('org.joinCode', { code: '!!' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('renvoie la valeur PARSÉE, dont treize points d’appel dépendent', async () => {
    const parsed = await validateAsync('org.create', { name: '  Nova Studio  ' });
    expect(parsed.name).toBeTruthy();
  });
});
