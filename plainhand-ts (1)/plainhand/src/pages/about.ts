import type { Mount } from "../router";
import { SIGNALS } from "../analyzer";
import { esc, fmtDuration } from "../format";
import { clearDraftData } from "../storage";
import { ALLOWANCE_SECONDS, subscribe } from "../timer";

export const mount: Mount = (root) => {
  const signals = Object.values(SIGNALS)
    .map((s) => "<li><h3>" + esc(s.name) + "</h3><p>" + esc(s.looksFor) + "</p></li>")
    .join("");

  root.innerHTML = `
  <section class="page">
    <div class="wrap">
      <header class="page-head">
        <h1>Straight talk</h1>
        <p class="lead">What Plainhand does, what it can't, and where it will be wrong.</p>
      </header>

      <div class="about-grid">
        <section>
          <h2>What it looks at</h2>
          <p>Plainhand counts a handful of writing habits that machine-generated text leans on. A sentence with enough of them gets marked yellow. That is all it does. It does not compare your text with any database and it does not call any AI service.</p>
          <ul class="signals">${signals}</ul>
        </section>

        <section>
          <h2>Where it goes wrong</h2>
          <p>It will mark some sentences you wrote yourself, especially formal academic phrasing, templates your department gave you, and writing in a second language. It will also miss AI text that happens to avoid these habits. Treat a mark as a question: does this sound like me?</p>
          <p>Short texts give less to go on. Under a couple of hundred words the results are shaky.</p>

          <h2>It is not Turnitin</h2>
          <p>There is no connection to Turnitin or any other university system, and no honest tool can promise what your institution's detector will report. Plainhand is for revising, not for predicting a score.</p>

          <h2>Your draft stays with you</h2>
          <p>Everything runs in this browser. Your text is saved on this device only, so you can come back to it, and it is never sent anywhere.</p>
          <button class="btn ghost" id="wipe" type="button">Delete my saved draft</button> <span class="copied" id="wiped" role="status"></span>

          <h2>The 4 hours</h2>
          <p>Use is free for up to 4 hours a day. The clock runs whenever Plainhand is open in front of you and stops when you leave or switch tabs. It resets at midnight. Today you have used <b id="used">0h 00m</b>.</p>
        </section>
      </div>
    </div>
  </section>`;

  const used = root.querySelector<HTMLElement>("#used")!;
  root.querySelector<HTMLElement>("#wipe")!.addEventListener("click", () => {
    clearDraftData();
    root.querySelector<HTMLElement>("#wiped")!.textContent = "Deleted. The sample will load next time.";
  });
  return subscribe((s) => {
    used.textContent = fmtDuration(Math.min(ALLOWANCE_SECONDS, s.used));
  });
};
