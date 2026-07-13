// supabase/functions/stripe-webhook/index.ts
// The ONLY path that grants passes in production.
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Stripe dashboard: add endpoint
//   https://<project>.functions.supabase.co/stripe-webhook
//   event: checkout.session.completed
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@16'

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    // verify the event really came from Stripe
    event = await stripe.webhooks.constructEventAsync(
      await req.text(), sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (e) {
    return new Response(`signature verification failed: ${e}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session
    const md = s.metadata ?? {}
    if (s.payment_status === 'paid' && md.user_id && md.kind && md.sport) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { error } = await admin.from('passes').insert({
        user_id: md.user_id,
        sport: md.sport,
        kind: md.kind,
        match_id: md.kind === 'single' && md.match_id ? Number(md.match_id) : null,
        price_cents: Number(md.price_cents ?? 0),
        expires_at: md.kind === 'weekly' ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
      })
      if (error) {
        console.error('pass insert failed:', error.message)
        // 500 -> Stripe retries automatically; the user WILL get their pass
        return new Response('insert failed', { status: 500 })
      }
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
})
