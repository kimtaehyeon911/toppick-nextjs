// paddle-webhook — Paddle calls this when a transaction completes.
// It's the ONLY writer of `passes` (service role). We verify Paddle's
// signature so nobody can forge a paid pass.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET')!

const PRICE_CENTS: Record<string, number> = {
  single: 290,
  weekly: 990,
}

Deno.serve(async (req) => {
  const raw = await req.text()
  const sig = req.headers.get('Paddle-Signature') ?? ''

  // verify signature (HMAC-SHA256 over "ts:body")
  const ok = await verify(raw, sig, WEBHOOK_SECRET)
  if (!ok) {
    console.error('bad signature')
    return new Response('invalid signature', { status: 400 })
  }

  const event = JSON.parse(raw)
  if (event.event_type !== 'transaction.completed') {
    return new Response('ignored', { status: 200 })
  }

  const cd = event.data?.custom_data ?? {}
  const uid = cd.user_id
  const kind = cd.kind as 'single' | 'weekly'
  const sport = cd.sport
  const matchId = cd.match_id

  if (!uid || !kind) {
    console.error('missing custom_data', cd)
    return new Response('missing custom_data', { status: 200 }) // 200 so Paddle stops retrying
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // weekly passes expire in 7 days; single passes don't expire (match ends anyway)
  const expiresAt = kind === 'weekly'
    ? new Date(Date.now() + 7 * 86400e3).toISOString()
    : null

  const { error } = await db.from('passes').insert({
    user_id: uid,
    sport,
    kind,
    match_id: kind === 'single' ? matchId : null,
    price_cents: PRICE_CENTS[kind],
    expires_at: expiresAt,
  })

  if (error) {
    console.error('insert pass failed', error)
    return new Response('db error', { status: 500 }) // 500 → Paddle retries
  }

  return new Response('ok', { status: 200 })
})

// Paddle signature: header is "ts=...;h1=...", signed value is "ts:rawBody"
async function verify(body: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      sigHeader.split(';').map(kv => kv.split('=') as [string, string]))
    const ts = parts['ts']; const h1 = parts['h1']
    if (!ts || !h1) return false

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const mac = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(`${ts}:${body}`))
    const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')

    // constant-time-ish compare
    return hex.length === h1.length &&
      hex.split('').every((c, i) => c === h1[i])
  } catch (e) {
    console.error('verify error', e)
    return false
  }
}