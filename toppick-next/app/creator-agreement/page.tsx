import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'Creator Revenue Share Agreement' }

export default function CreatorAgreementPage() {
  return (
    <LegalPage title="Creator Revenue Share Agreement" updated="July 15, 2026">
      <h2>1. Who this applies to</h2>
      <p>
        This agreement applies to analysts who reach Star tier (top 1% skill in a
        sport) and whose picks are included in paid content.
      </p>

      <h2>2. Independent contractor</h2>
      <p>
        You participate as an <strong>independent contractor</strong>, not an
        employee. Nothing here creates an employment, partnership, or agency
        relationship. You are responsible for your own taxes.
      </p>

      <h2>3. How revenue share works</h2>
      <p>
        Reaching Star tier is a <strong>qualification</strong> to have your picks
        included in paid content — it is not a prize or a reward for outcomes.
        <strong> 10% of each content sale is shared equally among the analysts
        whose picks are included in that content.</strong> Payment tracks
        content sales, not the accuracy of any prediction.
      </p>

      <h2>4. Payouts, identity & tax</h2>
      <p>
        Before any payout, you must complete identity verification and provide
        tax documentation (<strong>W-9</strong> for U.S. persons or
        <strong> W-8BEN</strong> for non-U.S. persons), as required by U.S.
        anti-money-laundering and IRS rules. Payouts cannot be released until
        this is complete.
      </p>

      <h2>5. Taxes are yours</h2>
      <p>
        Revenue share is reported as contractor income / royalty (e.g.,
        1099-NEC or W-8BEN), not gambling winnings. You are solely responsible
        for taxes on amounts you receive.
      </p>

      <h2>6. Termination</h2>
      <p>
        Either party may end this arrangement. [PLACEHOLDER: notice period,
        final-payout handling, and clawback terms per attorney review.]
      </p>
    </LegalPage>
  )
}