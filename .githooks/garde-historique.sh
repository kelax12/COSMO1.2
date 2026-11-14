#!/bin/sh
# Garde pre-push : refuse un commit descendant de l'ancien historique (purges du
# 2026-11-13 et 2026-11-14) ou qui reintroduit les chemins purges. Lit sur l'entree standard
# les lignes d'un hook pre-push : <ref locale> <sha local> <ref distante> <sha distant>.
# Aucune variable d'environnement n'est lue. POSIX sh, executable sous Git Bash.
dir=$(dirname "$0")
liste="$dir/historique-interdit.txt"
CHEMINS="leads-50.csv docs/business-plan faille.md a-faire-manuel.md docs/RGPD-VIOLATION.md .env .claude/settings.local.json supabase/.temp docs/archive/faille-historique.md docs/archive/faille-jusqua-2026-10-11.md docs/archive/a-faire-manuel-jusqua-2026-10-11.md docs/archive/a-faire-manuel-retires-2026-10-16.md docs/archive/a-faire-manuel-retires-2026-11-05.md prompt-audit-failles-acquisition-2026-09-30.md prompt-suite-failles-2026-10-01.md docs/archive/prompts/prompt-audit-failles-acquisition-2026-09-30.md docs/archive/prompts/prompt-suite-failles-2026-10-01.md"
nul=0000000000000000000000000000000000000000
refus=0

while read -r lref lsha rref rsha; do
  [ -z "$lsha" ] && continue
  [ "$lsha" = "$nul" ] && continue

  # 1. Un commit interdit est-il ancetre du sha pousse ?
  if [ -f "$liste" ]; then
    while read -r interdit _reste; do
      case "$interdit" in ''|'#'*) continue ;; esac
      # Absent du depot local : ignore.
      git cat-file -e "$interdit^{commit}" 2>/dev/null || continue
      if git merge-base --is-ancestor "$interdit" "$lsha" 2>/dev/null; then
        echo "REFUS : $lref descend de l'ancien historique (commit interdit $interdit)." >&2
        refus=1
      fi
    done < "$liste"
  fi

  # 2. Les commits pas encore distants touchent-ils un chemin purge ?
  exclure=""
  if [ "$rsha" != "$nul" ] && git cat-file -e "$rsha^{commit}" 2>/dev/null; then exclure="$rsha"; fi
  # shellcheck disable=SC2086
  touche=$(git log --oneline "$lsha" --not --remotes $exclure -- $CHEMINS 2>/dev/null)
  if [ -n "$touche" ]; then
    echo "REFUS : $lref contient des commits qui touchent un chemin purge ($CHEMINS) :" >&2
    echo "$touche" >&2
    refus=1
  fi
done

if [ "$refus" = 1 ]; then
  cat >&2 <<'MSG'

Pourquoi : les 2026-11-13 et 2026-11-14 l'historique du depot PUBLIC a ete reecrit
pour purger les documents prives (prospects, business plan, faille.md, .env...). Pousser cette branche les remettrait en ligne.
A faire : repartir d'un worktree neuf coupe depuis origin/main, puis `git cherry-pick`
de vos seuls commits. Ne jamais rebaser une vieille branche sur origin/main.
MSG
  exit 1
fi
exit 0
