import type { Mount } from "../router";

const UPDATED = "12 October 2026";

const HTML = `
<section class="page">
  <div class="wrap narrow legal">
    <header class="page-head">
      <h1>Terms of use</h1>
      <p class="lead">Plain rules for a free tool. Last updated ${UPDATED}.</p>
    </header>

    <h2>What Plainhand is</h2>
    <p>A free revision aid that marks passages in your writing that read as generic or machine-like, explains why, and helps you write an AI-use declaration. It is not Turnitin, it is not connected to any university or detector, and it does not decide whether work is AI-generated.</p>

    <h2>What you agree to</h2>
    <ul>
      <li>You are responsible for your own work and for following your institution's academic integrity and AI policies.</li>
      <li>You will not use Plainhand to disguise AI-generated text so it passes as your own, or to help anyone else do that.</li>
      <li>You will only paste in writing you have the right to use.</li>
      <li>You will not try to break the site, overload it, or get around the daily time allowance by automated means.</li>
    </ul>

    <h2>No guarantees</h2>
    <p>Results are estimates based on simple writing patterns. They will sometimes mark human writing and sometimes miss machine writing. A mark or a clean result does not prove who wrote something and does not predict any detector's score or any marker's decision. Use your own judgement.</p>
    <p>The tool is provided as is, without warranties of any kind. To the extent the law allows, we are not liable for loss arising from using it, including academic outcomes.</p>

    <h2>Free use and the daily allowance</h2>
    <p>Use is free for up to 4 hours per day, counted in your browser whenever the page is open and in front of you. The allowance may change, and we may limit or stop the service at any time.</p>

    <h2>Your content</h2>
    <p>Your writing stays yours. It is stored only on your device and is never sent to us, so we claim no rights to it and cannot see it.</p>

    <h2>Reviews</h2>
    <p>Reviews must be your own honest experience of using Plainhand. Do not post fake reviews, reviews on behalf of others, abuse, personal information, or anything unlawful. We may hold back or remove any review, and we do not pay for or edit reviews to change their meaning. By sending a review you agree that it may be shown publicly with the name you entered.</p>

    <h2>Declarations</h2>
    <p>The declaration text Plainhand builds is a convenience. You are responsible for checking that it is accurate and meets your institution's requirements before you submit it.</p>

    <h2>Changes and law</h2>
    <p>We may update these terms and will change the date above when we do. These terms are governed by the laws of [your country or province], and its courts have jurisdiction, except where consumer law gives you other rights.</p>

    <h2>Contact</h2>
    <p>[Your name or organisation], [contact email]. See also the <a href="#privacy">privacy policy</a>.</p>

    <p class="muted small">Have these terms reviewed by a qualified lawyer and complete the bracketed details before you publish.</p>
  </div>
</section>
`;

export const mount: Mount = (root) => {
  root.innerHTML = HTML;
};
