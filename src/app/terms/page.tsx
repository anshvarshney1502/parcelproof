import { LegalPage } from "@/components/landing/legal";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="18 October 2026">
      <section>
        <h2>What the service does</h2>
        <p>ParcelProof helps you organise and review evidence for delivery and parcel disputes. It extracts text, suggests findings using an AI model, checks that cited quotations exist in your files, and generates briefings and reports you can edit.</p>
      </section>
      <section>
        <h2>What it does not do</h2>
        <ul>
          <li>It does not give legal advice or act on your behalf.</li>
          <li>It does not guarantee any refund, chargeback or dispute outcome.</li>
          <li>It does not determine whether anyone committed fraud or acted dishonestly.</li>
          <li>Statuses such as “supported” or “conflicting” describe what the uploaded records show; they are not legal findings.</li>
        </ul>
      </section>
      <section>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Review every finding, briefing and report before relying on it or sending it to anyone.</li>
          <li>Upload only material you have the right to use and share with the processors described in the privacy notice.</li>
          <li>Do not upload malicious files or attempt to access other users’ data.</li>
        </ul>
      </section>
      <section>
        <h2>Limits and availability</h2>
        <p>The service relies on free or limited tiers of third-party providers. Daily usage limits apply, and analysis or voice generation can be unavailable when a provider is down or a quota is reached. Your cases and evidence remain accessible when that happens.</p>
      </section>
      <section>
        <h2>AI output</h2>
        <p>AI-generated text can be wrong or incomplete even when its quotations are verified. You remain responsible for the final interpretation and anything you submit.</p>
      </section>
    </LegalPage>
  );
}
