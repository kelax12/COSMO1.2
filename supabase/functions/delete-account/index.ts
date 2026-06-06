// ═══════════════════════════════════════════════════════════════════
// delete-account Edge Function
//
// Deletes the calling user's account and all user-owned rows. Required
// because Supabase doesn't expose `auth.admin.deleteUser` to clients —
// only the service_role can drop an auth.users row.
//
// Trust model:
// - Authenticates the caller via their JWT (anon client).
// - Uses service_role internally to (a) DELETE rows in every user-owned
//   table and (b) `auth.admin.deleteUser(user.id)`.
// - The caller can only delete THEIR OWN account: the user id we delete is
//   the id resolved from the JWT, never an id sent in the request body.
//
// Deployment: `supabase functions deploy delete-account --no-verify-jwt=false`
// then add it to the project's Edge Functions environment. Without this, the
// UI's "Supprimer le compte" button falls back to a support-email message.
// Faille B9.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

// Allowlist of origins permitted to call this function. Same defense-in-depth
// as stripe-create-checkout (faille N7): never echo back a wildcard for an
// authenticated, destructive endpoint.
const ALLOWED_ORIGINS = new Set([APP_URL])

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

// Tables owned by the user. Order matters where FKs without ON DELETE CASCADE
// exist. `auth.admin.deleteUser` will cascade through `auth.users` references
// where they exist; we explicitly clean tables that store `user_id` as a UUID
// column rather than an FK to auth.users.
// NOTE: `shared_tasks` is intentionally NOT in this list — its columns are
// `friend_id` / `shared_by`, not `user_id`. It's handled separately below.
// NOTE: `chat_messages` was removed (2026-06-07). The table does not exist in
// the database (verified via schema inspection — no messages/chat/inbox table
// exists; the "inbox" UI is derived from friend_requests/shared_tasks). The
// stray entry made every DELETE loop hit a non-existent relation → PostgREST
// error → `failedTables` → 500 `cleanup_failed`, which permanently BLOCKED
// account deletion (RGPD article 17 + regression of fix B9). The loop below is
// also now resilient to a missing table so this class of bug can't recur.
const USER_OWNED_TABLES = [
  'kr_completions',
  'key_results',
  'okrs',
  'friends',
  'friend_requests',
  'tasks',
  'habits',
  'events',
  'categories',
  'lists',
  'subscriptions',
] as const

// PostgREST / Postgres error signals for "table does not exist". Treated as a
// no-op (nothing to delete) rather than a cleanup failure.
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  if (code === '42P01' || code === 'PGRST205') return true
  return /does not exist|find the table/i.test(error.message ?? '')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // M-6 — Defense-in-depth: validate the resolved user id is a UUID before
    // template-interpolating it into PostgREST `.or()` filters. The id comes
    // from a verified JWT so it should always be valid, but the contract is
    // "never inline string into PostgREST filters without a guard".
    if (!UUID_RE.test(user.id)) {
      return new Response(JSON.stringify({ error: 'Invalid user id' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Track per-table failures so we can abort BEFORE deleting the auth row
    // if any cleanup leaves orphans (RGPD article 17 — right to erasure).
    const failedTables: string[] = []

    // Friend-request rows reference the user by either sender_id or
    // receiver_id; clean both before the main loop.
    {
      const { error } = await supabaseAdmin.from('friend_requests').delete().or(
        `sender_id.eq.${user.id},receiver_id.eq.${user.id}`,
      )
      if (error) {
        console.error('delete-account: failed to clean friend_requests:', error.message)
        failedTables.push('friend_requests')
      }
    }

    // M-6 — shared_tasks uses `friend_id` / `shared_by`, NOT `user_id`.
    // The previous `.eq('user_id', uid)` was a silent no-op leaving every
    // share this user issued (and received) in the database after deletion.
    {
      const { error } = await supabaseAdmin.from('shared_tasks').delete().or(
        `friend_id.eq.${user.id},shared_by.eq.${user.id}`,
      )
      if (error) {
        console.error('delete-account: failed to clean shared_tasks:', error.message)
        failedTables.push('shared_tasks')
      }
    }

    for (const table of USER_OWNED_TABLES) {
      if (table === 'friend_requests') continue
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', user.id)
      if (error) {
        if (isMissingTableError(error)) {
          // Table absent from this project → nothing to purge. Do NOT fail the
          // whole deletion (would brick RGPD erasure for every user).
          console.warn(`delete-account: table ${table} absent, skipping`)
          continue
        }
        console.error(`delete-account: failed to clean ${table}:`, error.message)
        failedTables.push(table)
      }
    }

    // M-6 — If any cleanup failed, refuse to drop the auth row. Otherwise we
    // permanently lose the user's identity and orphan data becomes impossible
    // to purge later (RGPD violation). The client can retry; the function is
    // idempotent (DELETE … WHERE on already-empty tables is a no-op).
    if (failedTables.length > 0) {
      return new Response(
        JSON.stringify({ error: 'cleanup_failed', tables: failedTables }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (authDeleteError) {
      console.error('delete-account: failed to drop auth user:', authDeleteError.message)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('delete-account error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
