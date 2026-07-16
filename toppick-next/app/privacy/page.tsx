import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 15, 2026">
      <h2>1. What we collect</h2>
      <p>
        Anonymous session identifiers; if you link Google, your email and basic
        profile; your predictions and activity; payment records (processed by
        Paddle — we do not store card numbers).
      </p>

      <h2>2. How we use it</h2>
      <p>
        To operate the service: compute skill scores, deliver purchased content,
        and prevent abuse. We do not sell your personal information.
      </p>

      <h2>3. California residents (CCPA)</h2>
      <p>
        If you are a California resident, you have the right to access, delete,
        and opt out of the sale of your personal information. We do not sell
        personal information. To exercise these rights, contact us at
        privacy@jointoppick.com.
      </p>
      <p>
        <strong>Do Not Sell or Share My Personal Information:</strong> Top Pick
        does not sell your personal information for monetary consideration. We do
        not offer financial incentives, or price or service differences, in
        exchange for the retention or sale of your personal information.
      </p>
      <p>
        <strong>Protection of Minors (Children&rsquo;s Privacy):</strong> Our
        Services are strictly for individuals aged 18 and older. We do not
        knowingly collect, maintain, or use personal information from children
        under the age of 18. If we discover that a user under 18 has provided us
        with personal information, we will take immediate steps to delete such
        information and terminate the account.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We retain your data while your account is active. Deleting your account
        removes derived data on our standard cleanup cycle.
      </p>

      <h2>5. Third parties</h2>
      <p>
        We use Supabase (infrastructure), Vercel (hosting), Paddle (payments),
        and Google (optional sign-in). Each processes data under its own terms.
      </p>

<h2>6. Contact</h2>
      <p>
        For any privacy-related inquiries or to exercise your rights, please
        contact us at privacy@jointoppick.com.
      </p>
    </LegalPage>
  )
}