#!/bin/sh
# Garde pre-push : refuse une poussee vers main tant qu'un run `CI noyau` est en cours sur main (PRO-02).
# Deux sessions qui poussent a quelques minutes d'ecart rendent le noyau rouge ; on attend le verdict du run.
# Lit l'entree standard du hook ; ne concerne que refs/heads/main (noyau/<nom> et les autres branches passent).
# gh absent, hors ligne ou illisible : on laisse passer avec un avertissement (la garde « main rouge » reste la frontiere).
# Sortie de secours, Axel seul : COSMO_PUSH_NOYAU_EN_COURS=1 git push ...
# COSMO_GARDE_GH remplace la commande gh (temoin .githooks/garde-noyau-en-cours.test.sh).
vers_main=0
while read -r _ _ rref _; do
  [ "$rref" = "refs/heads/main" ] && vers_main=1
done
[ "$vers_main" = "1" ] || exit 0
[ "$COSMO_PUSH_NOYAU_EN_COURS" = "1" ] && exit 0
gh_=${COSMO_GARDE_GH:-gh}
n=$("$gh_" run list --workflow ci-noyau.yml --branch main --limit 20 --json status \
  --jq '[.[] | select(.status=="queued" or .status=="in_progress" or .status=="waiting" or .status=="pending")] | length' 2>/dev/null)
case "$n" in
  ''|*[!0-9]*)
    echo "pre-push : avertissement, run CI noyau en cours illisible (gh absent, hors ligne ou non authentifie) ; garde sautee." >&2
    exit 0 ;;
esac
[ "$n" -eq 0 ] && exit 0
cat >&2 <<MSG
Poussee refusee : $n run(s) CI noyau en cours sur main.
Une poussee qui demarre pendant le run d'une autre rend le noyau rouge.
Attendre la fin du run, puis rejouer la poussee :
  gh run list --workflow ci-noyau.yml --branch main --limit 3
Sortie de secours, Axel seul :
  COSMO_PUSH_NOYAU_EN_COURS=1 git push ...
MSG
exit 1
