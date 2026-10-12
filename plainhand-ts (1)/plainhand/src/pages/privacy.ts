import type { Mount } from "../router";
import { clearDraftData } from "../storage";

const UPDATED = "12 October 2026";

const HTML = `
<section class="page">
  <div class="wrap narrow legal">
    <header class="page-head">
      <h1>Privacy policy</h1>
      <p class="lead">The short version: your writing never leaves your device. Last updated ${UPDATED}.</p>
    </header>

    <h2>Who runs Plainhand</h2>
    <p>[Your name or organisation], [contact email]. Fill this in before you publish the site. This person or organisation is the "responsible party" under South Africa's Protection of Personal Information Act (POPIA) and the "controller" under the GDPR.</p>

    <h2>What we collect</h2>
    <p>Your writing is never collected. Plainhand has no accounts, no sign-up, no cookies, no analytics, no advertising and no tracking. The only information that can reach a server is a review you choose to submit (see Reviews below).</p>

    <h2>What is stored on your device</h2>
    <p>Your browser's local storage keeps four things so the site works between visits:</p>
    <ul>
      <li>The draft text you pasted or typed, and which sentences you tagged as AI-assisted.</li>
      <li>The details you typed into the Declare page (tool, purpose, course).</li>
      <li>How many seconds of today's free 4 hours you have used, by date.</li>
      <li>Your check settings, your colour choice, and any reviews you wrote, if reviews are saved on this device.</li>
    </ul>
    <p>This data never leaves your browser. It is not shared with us or anyone else. It is needed for the site to work, so no consent banner is required for it.</p>

    <h2>Third parties</h2>
    <p>This version of the site loads its typefaces from Google Fonts. When a page loads, Google receives your IP address and browser details, as it does for any site that uses Google Fonts. Your writing is never part of that request. If you host Plainhand yourself you can bundle the fonts locally and remove this dependency.</p>
    <p>Your hosting provider may keep ordinary server logs (IP address, time, page requested). We do not control or read them for this site beyond security and troubleshooting.</p>

    <h2>Reviews</h2>
    <p>Reviews are optional. A review has a rating, your review text and an optional name you choose. Do not include personal details such as your university, student number or other people's names.</p>
    <p>If the site owner has connected a shared review service, a review you send is transmitted to it and stored there. It is held until it has been checked, and is then shown publicly on the Home and Reviews pages with the name you entered and the date. The service uses your IP address only briefly in memory to limit spam and does not store it. To have a review removed, contact us at the address above and describe it. The legal basis for processing it is your consent, which you give by sending it.</p>
    <p>If no shared review service is connected, a review is saved only on your own device and no one else can see it.</p>

    <h2>Your writing and AI</h2>
    <p>Analysis runs entirely in your browser using fixed rules. Your text is not sent to any AI service, is not used to train anything, and is not compared against any database.</p>

    <h2>Your rights</h2>
    <p>You can see, change or delete your stored data at any time. The button below deletes your saved draft and declaration details from this browser. Clearing your browser's site data does the same. Your daily time record is kept so the 4-hour allowance stays fair, and it contains no personal information.</p>
    <p><button class="btn ghost" id="wipe" type="button">Delete my saved draft</button> <span class="copied" id="wiped" role="status"></span></p>
    <p>Apart from reviews you chose to send, we hold no personal information about you. To see or remove a review you sent, or if you believe we hold anything else, contact us at the address above. You may also complain to the Information Regulator (South Africa) or your local data protection authority.</p>

    <h2>Children</h2>
    <p>Plainhand is meant for students and does not knowingly collect information from anyone, including children. If you are under 18, check with a parent, guardian or your school before using any online tool.</p>

    <h2>Security</h2>
    <p>Your writing is never sent to a server, so there is no database of student work to breach. The site sets a strict content security policy, loads no third-party scripts, shows your text only as plain text, checks what it reads back from storage, and limits the size of dropped files, which are opened in your browser and never uploaded. Anyone with access to your device or browser profile can read what is stored there, so use a private window on shared computers and delete your draft when you finish.</p>

    <h2>Changes</h2>
    <p>If this policy changes, the date above changes with it. Material changes will be shown on this page.</p>

    <p class="muted small">This policy was written to describe how Plainhand actually works. Have it reviewed by a qualified lawyer before relying on it, and complete the bracketed details.</p>
  </div>
</section>
`;

export const mount: Mount = (root) => {
  root.innerHTML = HTML;
  root.querySelector<HTMLElement>("#wipe")!.addEventListener("click", () => {
    clearDraftData();
    root.querySelector<HTMLElement>("#wiped")!.textContent = "Deleted from this browser.";
  });
};
