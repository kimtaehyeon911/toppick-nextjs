import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="July 15, 2026">
      <h2>1. What Top Pick is</h2>
      <p>
        Top Pick is a skill market and content platform for sports predictions.
        Users cast free predictions and build a verified track record measured
        against crowd consensus. Top Pick is <strong>not a betting platform</strong>:
        there are no stakes, no odds, no wagers, and no payouts for outcomes.
      </p>

      <h2>2. Eligibility (18+)</h2>
      <p>
        You must be at least 18 years old (or the age of majority in your
        jurisdiction, if higher) to use Top Pick. By using the service you
        represent that you meet this requirement.
      </p>

      <h2>3. Paid content (Star Picks)</h2>
      <p>
        Certain analytical content ("Star Picks") is available for purchase as a
        single-match pass or a weekly pass. What you purchase is
        <strong> access to analytical content</strong>, not a wager or a stake.
      </p>

      <h2>4. No guarantee of accuracy — Disclaimer</h2>
      <p>
        Predictions and analytical content on Top Pick are opinions. We do not
        guarantee their accuracy. <strong>Top Pick is not liable for any
        financial loss</strong> arising from reliance on this content, including
        but not limited to losses incurred if you place actual bets on any other
        platform based on information found here. Nothing on Top Pick is a
        recommendation to gamble.
      </p>

      <h2>5. Accounts</h2>
      <p>
        You may use Top Pick anonymously or link a Google account to preserve
        your track record. You are responsible for activity under your account.
      </p>

      <h2>6. Prohibited conduct</h2>
      <p>
        You may not manipulate consensus through fake accounts, automate
        predictions, or misrepresent yourself. We may suspend accounts that do.
      </p>

      <h2>7. Payments</h2>
      <p>
        Payments are processed by Paddle.com as Merchant of Record. Refunds are
        governed by our <a href="/refund">Refund Policy</a>.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these terms. Continued use after changes constitutes
        acceptance.
      </p>

<h2>9. Governing law & dispute resolution</h2>
      <p>
        These terms are governed by the laws of the United States and the State
        of Delaware.
      </p>
      <p>
        <strong>Binding Arbitration and Class Action Waiver:</strong> Any
        dispute, claim, or controversy arising out of or relating to these Terms
        or the breach, termination, enforcement, interpretation, or validity
        thereof, including the determination of the scope or applicability of
        this agreement to arbitrate, shall be determined by binding arbitration
        in Wilmington, Delaware before one arbitrator. The arbitration shall be
        administered by JAMS pursuant to its Comprehensive Arbitration Rules and
        Procedures.
      </p>
      <p>
        <strong>CLASS ACTION WAIVER:</strong> YOU AND TOP PICK AGREE THAT EACH
        MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL
        CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS,
        CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. The arbitrator may not
        consolidate more than one person&rsquo;s claims and may not otherwise
        preside over any form of a representative or class proceeding.
      </p>
    </LegalPage>
  )
}