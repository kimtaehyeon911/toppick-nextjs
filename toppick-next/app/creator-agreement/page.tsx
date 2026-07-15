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
        <strong>Notice Period and Final Payouts:</strong> Either party may
        terminate this agreement at any time by providing fifteen (15) days&rsquo;
        written notice to the other party. Upon termination, any undisputed
        finalized revenue share accrued prior to the termination date will be
        paid out. However, Top Pick reserves the right to hold this final payout
        for up to sixty (60) days to clear any pending user refunds or
        chargebacks.
      </p>
      <h2>7. Clawback and forfeiture</h2>
      <p>
        Top Pick reserves the right to withhold, suspend, or clawback (reverse)
        any revenue share payments, or deduct amounts from future payouts, if we
        reasonably determine that:
      </p>
      <p>
        (a) such revenue was generated through fraudulent activity, automated
        bots, or manipulation of the platform;<br />
        (b) you have materially breached the Terms of Service; or<br />
        (c) the underlying content sales resulted in user chargebacks, disputes,
        or refunds processed by our Merchant of Record (Paddle).
      </p>
    </LegalPage>
  )
}