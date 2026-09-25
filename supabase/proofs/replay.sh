#!/bin/bash
# Rejoue TOUTES les migrations de `supabase/migration/` sur un Postgres local
# vierge, derrière un shim minimal de Supabase (`supabase-shim.sql` : rôles,
# `auth.uid()` lu dans `request.jwt.claim.sub`, `cron.*` et `storage.*` factices),
# puis lance une preuve en transaction annulée.
#
#   PGHOST=/tmp PGPORT=55432 PGUSER=postgres ./supabase/proofs/replay.sh 190-193.proof.sql
#
# ⚠️ Ce n'est PAS la production : le shim imite ce que la plateforme fournit.
# Une preuve verte ici dit que la SQL s'exécute et que les règles tiennent
# entre acteurs ; elle ne remplace ni la relecture du ledger ni la preuve en
# prod avant application (`supabase/migration/CLAUDE.md`).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DB="${PROOF_DB:-proof}"
psql -qc "DROP DATABASE IF EXISTS $DB" postgres
psql -qc "CREATE DATABASE $DB" postgres
psql -q -d "$DB" -f "$HERE/supabase-shim.sql" >/dev/null 2>&1
fail=0
for f in $(ls "$HERE/../migration/"*.sql | sort); do
  # `pg_cron` n'existe pas hors Supabase : son CREATE EXTENSION est retiré,
  # le schéma `cron` du shim prend les appels.
  out=$(sed -E 's/^\s*CREATE EXTENSION IF NOT EXISTS pg_cron[^;]*;//I' "$f" \
        | psql -d "$DB" -v ON_ERROR_STOP=1 -q 2>&1 | grep -E "ERROR" | head -2 || true)
  if [ -n "$out" ]; then echo "✖ $(basename "$f"): $out"; fail=1; fi
done
[ "$fail" = 0 ] && echo "✓ migrations rejouées"
if [ "${1:-}" != "" ]; then
  psql -d "$DB" -q -f "$HERE/$1" 2>&1 | grep -E "NOTICE:  ok|ÉCHEC|ERROR" || true
fi
exit "$fail"
