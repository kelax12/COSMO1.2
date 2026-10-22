/**
 * `react-hooks/exhaustive-deps` ne se désarme pas sans dire pourquoi.
 *
 * 🔴 D'OÙ ÇA VIENT (C-06). Le dépôt portait **31 désarmements dans 25
 * fichiers**, et ce ne sont pas 31 bugs : ce sont 31 endroits NON ÉPROUVÉS.
 * Chacun est une dépendance retirée à la main, donc une fermeture
 * potentiellement périmée — la famille de défaut qui produit un écran qui ne se
 * rafraîchit pas, en silence. Ce dépôt en a déjà rencontré plusieurs, dont
 * `FirstRunSetup`, dont la garde d'entrée se refermait sous les doigts de la
 * personne parce que `useCreateTask` écrivait dans le cache React Query.
 *
 * La règle ne compte pas les désarmements et ne les interdit pas : elle exige
 * que chacun **dise pourquoi la dépendance manquante ne peut pas périmer la
 * valeur**. Conséquence voulue : le nombre ne remonte plus sans qu'on ait dû
 * formuler l'argument, et un désarmement dont l'argument ne s'écrit pas est un
 * désarmement qui n'aurait pas dû être posé.
 *
 * La justification passe par la syntaxe NATIVE d'ESLint, `--` :
 *
 *     // eslint-disable-next-line react-hooks/exhaustive-deps -- init à
 *     // l'ouverture seulement : ajouter `task` réécrirait le formulaire sous
 *     // la personne à chaque refetch.
 *
 * ❌ Pourquoi pas « un commentaire quelque part au-dessus » : le dépôt en avait
 * déjà, et ils décrivaient l'INTENTION de l'effet, pas la sûreté du retrait.
 * Un commentaire voisin se déplace, se périme et se confond avec le commentaire
 * du bloc ; la description `--` est attachée au désarmement lui-même.
 */
const RULE = 'react-hooks/exhaustive-deps';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Tout `eslint-disable` de react-hooks/exhaustive-deps doit porter une '
        + 'description `--` expliquant pourquoi la dépendance retirée ne peut '
        + 'pas périmer la valeur.',
    },
    schema: [
      {
        type: 'object',
        properties: { minLength: { type: 'integer', minimum: 0 } },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        'Desarmer {{rule}} sans justification est interdit (C-06). Ecrire la '
        + 'raison apres `--`, dans le commentaire de desarmement lui-meme, et '
        + 'repondre a UNE question : pourquoi la dependance retiree ne peut-elle '
        + 'pas perimer la valeur ? Si la reponse ne s ecrit pas, le desarmement '
        + 'n a pas lieu d etre : rendre la dependance honnete, ou passer par une '
        + 'ref.',
      tooShort:
        'La justification de {{rule}} fait {{len}} caracteres, il en faut au '
        + 'moins {{min}} (C-06). « ok », « voulu » ou « cf. plus haut » ne sont '
        + 'pas des raisons : dire pourquoi la dependance retiree ne peut pas '
        + 'perimer la valeur.',
    },
  },
  create(context) {
    const min = context.options[0]?.minLength ?? 25;
    const source = context.sourceCode ?? context.getSourceCode();
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          const text = comment.value;
          if (!/eslint-disable(-next-line|-line)?\b/.test(text)) continue;
          // Le nom de la regle doit apparaitre AVANT le `--` : apres, il est
          // dans la prose de la justification, pas dans la liste des regles.
          const cut = text.indexOf('--');
          const listed = cut === -1 ? text : text.slice(0, cut);
          if (!listed.includes(RULE)) continue;
          if (cut === -1) {
            context.report({ node: comment, messageId: 'missing', data: { rule: RULE } });
            continue;
          }
          const reason = text.slice(cut + 2).replace(/\s+/g, ' ').trim();
          if (reason.length < min) {
            context.report({
              node: comment,
              messageId: 'tooShort',
              data: { rule: RULE, len: String(reason.length), min: String(min) },
            });
          }
        }
      },
    };
  },
};
