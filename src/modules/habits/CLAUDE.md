# Habitudes (`src/modules/habits`)

**Quand lire** : en touchant `src/modules/habits/**`, `get_my_habits`, `streak.ts`. Fuseau et clés de jour gelées : [`src/lib/CLAUDE.md`](../../lib/CLAUDE.md) § Fuseau horaire. **Fait foi** : le code.
Règles transversales : [`../CLAUDE.md`](../CLAUDE.md).

## `completions` borné à la lecture (mig. 119)

`habits.completions` est un JSONB qui gagne une entrée par jour et par habitude (~12,7 o/jour).

```typescript
supabase.from('habits').select('*')                       // ❌ payload sans borne
supabase.rpc('get_my_habits', { p_days: 400 })            // ✅ mig. 119
```

- ✅ La RPC rend `completions` filtré aux 400 derniers jours (plafond 3 650 quoi qu'on demande) ET quatre agrégats serveur sur tout l'historique : `streak_current`, `streak_best`, `completions_total`, `first_completion_date`. La table n'est pas modifiée.
- 🔴 Le serveur ne juge JAMAIS « aujourd'hui » : la base est en UTC, les clés sont en date locale (`toLocaleDateString('en-CA')`). Toute fonction raisonnant sur un jour prend `p_today` du client (`get_my_habits`, `toggle_habit_completion_v2`). `CURRENT_DATE` a donné une série à zéro en Amérique du Nord (19 h à minuit) et un compteur qui baisse en cochant (00 h à 02 h en France), corrigé par la mig. 122.
- ❌ Dériver une série ou un total de `habit.completions` : `habitStreak(habit)` (`streak.ts`), `habit.completionsTotal`, `habit.firstCompletionDate` (sur la fenêtre, une série de trois ans plafonne à 400).
- ❌ Compter les complétions dans un export (RGPD art. 20) : `completionsTotal`.
- ⚠️ Les agrégats sont absents en démo et en local (le repository local a toute la donnée) : garder le repli JS de chaque helper.
- ⚠️ Élargir la fenêtre réintroduit le problème proportionnellement.

## `habit_completions` (mig. 248, DAT-02)

Table commitée, **pas appliquée en prod** : vérifier le ledger avant de l'affirmer (`supabase/migration/CLAUDE.md`). Une ligne par habitude et par jour COCHÉ (date locale, mêmes clés que le JSON) ; `get_my_habits`, `toggle_habit_completion_v2`, `get_work_time_stats` gardent signature et forme.

- 🔴 La carte `completions` ne porte que les jours cochés : décocher RETIRE la clé (`toggleCompletionDay`, `streak.ts`), en démo comme en cache optimiste. Jamais `false`.
- ⚠️ Transition : `habits.completions` reste exacte (le toggle v2 recopie ; le trigger `habit_completions_mirror` recopie toute autre écriture). Lecteurs restants : CLI agent (`scripts/cosmo/api.mjs`), export CSV, `getPage`, `e2e/real/habits.spec.ts`. ❌ Retirer la colonne avant de les avoir basculés.
