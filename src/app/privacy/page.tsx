import { LegalPage } from "@/components/landing/legal";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="18 October 2026">
      <section>
        <h2>What ParcelProof stores</h2>
        <ul>
          <li><strong>Account:</strong> your Google name, email address and profile image, plus session records, via Auth.js.</li>
          <li><strong>Cases:</strong> the details you enter (order reference, dates, your description and any customer reference you choose to add).</li>
          <li><strong>Evidence:</strong> the original files you upload and the text extracted from them, in MongoDB Atlas (GridFS).</li>
          <li><strong>Analyses, reviews, briefings and audio</strong> you create, and daily usage counters.</li>
          <li><strong>Audit events:</strong> minimal records of actions (for example “case deleted”), without file contents.</li>
        </ul>
      </section>
      <section>
        <h2>Who else receives data</h2>
        <ul>
          <li><strong>Google (Gemini API, Gemma model):</strong> when you choose “Analyse evidence”, the extracted text of that case’s evidence and the case details are sent to Google’s hosted API. Processing is not local or offline.</li>
          <li><strong>ElevenLabs:</strong> when you generate audio, the briefing transcript is sent to ElevenLabs. Your files are not.</li>
          <li><strong>Hosting:</strong> the app runs on Render; data is stored on MongoDB Atlas.</li>
          <li>Text recognition (OCR) and PDF reading run on the ParcelProof server. OCR language data is downloaded from a public CDN.</li>
        </ul>
        <p className="mt-3">These providers process data under their own terms. Avoid uploading information you are not permitted to share with them.</p>
      </section>
      <section>
        <h2>Customer information</h2>
        <p>Evidence often contains a customer’s details. Upload only what the dispute needs, prefer order IDs or pseudonyms over names, and redact addresses or phone numbers where they aren’t relevant.</p>
      </section>
      <section>
        <h2>Access</h2>
        <p>Files and case data are served only to the signed-in account that owns them, through authenticated routes. There are no public links to your files.</p>
      </section>
      <section>
        <h2>Deletion</h2>
        <p>Deleting a case removes its files, extracted text, analyses, briefings and audio. Settings → Delete account data removes everything you own, including your sign-in record. Provider-side retention is governed by Google’s and ElevenLabs’ policies.</p>
      </section>
    </LegalPage>
  );
}
