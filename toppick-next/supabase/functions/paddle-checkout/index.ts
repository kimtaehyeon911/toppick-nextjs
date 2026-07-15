// paddle-checkout — creates a Paddle transaction and returns its id.
// The frontend opens Paddle.js overlay with that transaction id.
// Called by an authenticated user (anon or Google); we read their uid
// from the JWT so the webhook can attribute the pass back to them.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const PADDLE_API = 'https://sandbox-api.paddle.com'   // sandbox
const PADDLE_KEY = Deno.env.get('PADDLE_API_SECRET')!

// price ids from the Paddle catalog
const PRICES: Record<string, string> = {
  single:            'pri_01kxj9mqdakk2ekx4m2wkkg0db',
  weekly_football:   'pri_01kxj9t85wr22d4bjadge5qykk',
  weekly_basketball: 'pri_01kxj9w6zpz12xspyc9qst72wb',
  weekly_baseball:   'pri_01kxj9x005tyeatkrsvb38zd51',
  weekly_soccer:     'pri_01kxj9xhk1q914b6z285n0q62j',
  weekly_ufc:        'pri_01kxja1np33szk0avweq6p08sg',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'no auth' }, 401)

    // resolve the caller's uid from their JWT
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return json({ error: 'invalid session' }, 401)

    const { kind, sport, matchId } = await req.json()
    //   kind: 'single' | 'weekly'
    //   sport: 'football' | ... (required for weekly)
    //   matchId: number (required for single)

    const priceKey = kind === 'single' ? 'single' : `weekly_${sport}`
    const priceId = PRICES[priceKey]
    if (!priceId) return json({ error: `unknown price: ${priceKey}` }, 400)

    // custom_data flows through to the webhook so we can write the pass
    const body = {
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: {
        user_id: user.id,
        kind,
        sport: sport ?? null,
        match_id: matchId ?? null,
      },
    }

    const res = await fetch(`${PADDLE_API}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PADDLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('paddle error', data)
      return json({ error: 'paddle transaction failed', detail: data }, 502)
    }

    return json({ transactionId: data.data.id })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
}