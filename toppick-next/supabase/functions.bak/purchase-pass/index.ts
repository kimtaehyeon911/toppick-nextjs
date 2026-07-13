// supabase/functions/purchase-pass/index.ts
// Deploy: supabase functions deploy purchase-pass
//
// Passes are NEVER inserted from the client (no RLS insert policy on `passes`).
// This function is the single write path: verify payment → insert pass with
// the service role. Wire Stripe (web) / StoreKit-Google Play (apps) where marked.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const PRICES: Record<string, number> = { single: 290, weekly: 990 } // cents

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const { kind, match_id } = body
    if (!['single', 'weekly'].includes(kind)) return json({ error: 'bad kind' }, 400)
    if (kind === 'single' && !match_id) return json({ error: 'single pass needs match_id' }, 400)

    // Caller identity from the user's JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthenticated' }, 401)

    // ── PAYMENT VERIFICATION GOES HERE ─────────────────────────────
    // Stripe:  confirm PaymentIntent status === 'succeeded' for this user/amount.
    // StoreKit / Play Billing: verify the signed transaction server-side.
    // Until wired, this stub grants the pass directly (dev only).
    // ───────────────────────────────────────────────────────────────

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // sport comes from the match (single) or must be provided (weekly)
    let sport = body.sport
    if (match_id) {
      const { data: m } = await admin.from('matches').select('sport').eq('id', match_id).single()
      sport = m?.sport
    }
    if (!sport) sport = 'soccer' // weekly default; front-end should pass sport explicitly

    const { error } = await admin.from('passes').insert({
      user_id: user.id,
      sport,
      kind,
      match_id: kind === 'single' ? match_id : null,
      price_cents: PRICES[kind],
      expires_at: kind === 'weekly' ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
    })
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
