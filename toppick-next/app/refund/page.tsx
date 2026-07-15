import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'Refund Policy' }

export default function RefundPage() {
  return (
    <LegalPage title="Refund Policy" updated="July 15, 2026">
      <h2>1. Digital content — no refund after access</h2>
      <p>
        Star Picks are digital analytical content delivered immediately. Once you
        have <strong>viewed the content unlocked by a pass, that purchase is
        non-refundable</strong>, because the content cannot be returned.
      </p>

      <h2>2. Cancelled or postponed matches</h2>
      <p>
        If a match covered by a single-match pass is cancelled before you have
        viewed the associated Star Picks, you may request a refund for that pass.
        Postponed matches are honored when rescheduled.
      </p>

      <h2>3. Weekly passes</h2>
      <p>
        Weekly passes renew automatically each week. You may cancel at any time
        to stop future renewals; the current period remains active until it
        expires. Partial-period refunds are not provided.
      </p>

      <h2>4. How to request</h2>
      <p>
        Refund requests are handled through Paddle.com, our Merchant of Record.
        [PLACEHOLDER: support contact and request window per attorney review.]
      </p>
    </LegalPage>
  )
}