// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout Session for a viewing pass.
// Deploy:  supabase functions deploy create-checkout
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... SITE_URL=https://toppick.vercel.app
//
// Flow: client invokes this -> gets session.url -> redirects to Stripe.
// The pass itself is granted ONLY by the stripe-webhook function after
// `checkout.session.completed` — never trust the redirect back.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@16'

const PRICES: Record<string, { cents: number; name: string }> = {
  single: { cents: 290,  name: 'Top Pick — Single viewing pass' },
  weekly: { cents: 990, name: 'Top Pick — Weekly viewing pass' },
}

Deno.serve(async (req) => {
  try {
    const { kind, sport, match_id } = await req.json()
    if (!PRICES[kind]) return json({ error: 'bad kind' }, 400)
    if (!['soccer', 'baseball', 'basketball', 'ufc'].includes(sport)) return json({ error: 'bad sport' }, 400)
    if (kind === 'single' && !match_id) return json({ error: 'single pass needs match_id' }, 400)

    // identify the buyer from their JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthenticated' }, 401)

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
    const site = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: PRICES[kind].cents,
          product_data: { name: PRICES[kind].name },
        },
      }],
      // webhook uses this metadata to grant the pass to the right user
      metadata: {
        user_id: user.id,
        kind,
        sport,
        match_id: match_id ? String(match_id) : '',
        price_cents: String(PRICES[kind].cents),
      },
      success_url: `${site}/?pass=success`,
      cancel_url: `${site}/?pass=cancelled`,
    })

    return json({ url: session.url })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
