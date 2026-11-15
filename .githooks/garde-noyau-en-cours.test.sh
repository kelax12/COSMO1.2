#!/bin/sh
# Temoin de garde-noyau-en-cours.sh : gh simule par COSMO_GARDE_GH. Lancer : sh .githooks/garde-noyau-en-cours.test.sh
d=$(dirname "$0"); t=$(mktemp -d); ko=0
mk() { printf '#!/bin/sh\n%s\n' "$2" > "$t/$1"; chmod +x "$t/$1"; }
mk gh_en_cours 'echo 1'
mk gh_aucun 'echo 0'
mk gh_hors_ligne 'exit 1'
MAIN='refs/heads/x aaa refs/heads/main bbb'
NOYAU='refs/heads/x aaa refs/heads/noyau/fix bbb'
essai() { # nom attendu gh entree [env]
  out=$(printf '%s\n' "$4" | env $5 COSMO_GARDE_GH="$t/$3" sh "$d/garde-noyau-en-cours.sh" 2>&1); rc=$?
  if [ "$rc" = "$2" ]; then echo "ok   $1 (exit $rc)"; else echo "FAIL $1 : attendu $2, obtenu $rc"; ko=1; fi
}
essai "main + run en cours : refus" 1 gh_en_cours "$MAIN"
essai "main + aucun run : passe" 0 gh_aucun "$MAIN"
essai "noyau/<nom> + run en cours : passe" 0 gh_en_cours "$NOYAU"
essai "main + gh hors ligne : passe avec avertissement" 0 gh_hors_ligne "$MAIN"
essai "main + run en cours + secours : passe" 0 gh_en_cours "$MAIN" COSMO_PUSH_NOYAU_EN_COURS=1
rm -rf "$t"; exit $ko
