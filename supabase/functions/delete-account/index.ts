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
const USER_OWNED_TABLES = [
  'kr_completions',
  'key_results',
  'okrs',
  'shared_tasks',
  'friends',
  'friend_requests',
  'tasks',
  'habits',
  'events',
  'categories',
  'lists',
  'subscriptions',
  'chat_messages',
] as const

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

    // Friend-request rows reference the user by either sender_id or
    // receiver_id; clean both before the main loop.
    await supabaseAdmin.from('friend_requests').delete().or(
      `sender_id.eq.${user.id},receiver_id.eq.${user.id}`,
    )

    for (const table of USER_OWNED_TABLES) {
      if (table === 'friend_requests') continue
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', user.id)
      if (error) {
        console.error(`delete-account: failed to clean ${table}:`, error.message)
        // Continue best-effort — we'd rather drop the auth user than leave
        // a half-deleted account that the user can't retry.
      }
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
