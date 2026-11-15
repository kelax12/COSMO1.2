#!/bin/sh
# Garde pre-push : refuse une poussee partant du checkout principal (PRO-03).
# Un worktree lie a un --git-dir different du --git-common-dir ; le checkout principal les a egaux.
# Sortie de secours, pour Axel seul : COSMO_PUSH_CHECKOUT_PRINCIPAL=1 git push ...
gd=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
cd_=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[ "$gd" != "$cd_" ] && exit 0
[ "$COSMO_PUSH_CHECKOUT_PRINCIPAL" = "1" ] && exit 0
cat >&2 <<MSG
Poussee refusee : elle part du checkout principal.
Une session = un worktree = une branche (CLAUDE.md, section Git).
Creer un worktree et pousser depuis lui :
  git worktree add ../mon-worktree -b ma-branche origin/main
Sortie de secours, Axel seul :
  COSMO_PUSH_CHECKOUT_PRINCIPAL=1 git push ...
MSG
exit 1
