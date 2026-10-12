import type { Mount } from "../router";
import { EMPTY_HTML, LIMITS, cards, listReviews, removeLocalReview, submitReview, summary } from "../reviews";

const HTML = `
<section class="page">
  <div class="wrap">
    <header class="page-head">
      <h1>Reviews</h1>
      <p class="lead">What students say after using Plainhand. Every review here was written by a real person who chose to send it.</p>
    </header>

    <div class="rv-grid">
      <div>
        <div id="rv-summary"></div>
        <div id="rv-notice"></div>
        <div id="rv-list" aria-live="polite"><p class="muted">Loading reviews…</p></div>
      </div>

      <form class="card rv-form" id="rv-form" novalidate autocomplete="off">
        <h2>Leave a review</h2>
        <fieldset class="rv-rate">
          <legend>Your rating</legend>
          <div class="rate-row" id="rate-row">
            ${[5, 4, 3, 2, 1]
              .map((n) => `<input type="radio" name="rating" id="rate-${n}" value="${n}"><label for="rate-${n}"><span aria-hidden="true">★</span><span class="sr">${n} out of 5</span></label>`)
              .join("")}
          </div>
        </fieldset>
        <div class="field"><label for="rv-name">Name <small>(optional, shown publicly)</small></label><input id="rv-name" type="text" maxlength="${LIMITS.nameMax}" placeholder="First name or a nickname"></div>
        <div class="field"><label for="rv-text">Your review</label><textarea id="rv-text" class="rv-textarea" maxlength="${LIMITS.textMax}" rows="5" placeholder="What did you use it for, and did it help?"></textarea><small id="rv-count" class="muted">0 / ${LIMITS.textMax}</small></div>
        <div class="hp" aria-hidden="true"><label for="rv-site">Leave this empty</label><input id="rv-site" type="text" tabindex="-1" autocomplete="off"></div>
        <p class="muted small">Please do not include personal details such as your university, student number or anyone else's name.</p>
        <button class="btn" type="submit" id="rv-send">Send review</button>
        <p class="rv-msg" id="rv-msg" role="status"></p>
      </form>
    </div>
  </div>
</section>
`;

export const mount: Mount = (root) => {
  root.innerHTML = HTML;
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const list = $<HTMLElement>("#rv-list");
  const sum = $<HTMLElement>("#rv-summary");
  const notice = $<HTMLElement>("#rv-notice");
  const msg = $<HTMLElement>("#rv-msg");
  const text = $<HTMLTextAreaElement>("#rv-text");
  const count = $<HTMLElement>("#rv-count");
  let alive = true;

  async function refresh(): Promise<void> {
    const data = await listReviews();
    if (!alive) return;
    sum.innerHTML = summary(data.reviews);
    notice.innerHTML = !data.shared
      ? '<p class="rv-note">Reviews on this site are saved on this device only for now, so other visitors will not see them. A shared review service has not been connected yet.</p>'
      : data.failed
        ? '<p class="rv-note">Reviews could not be loaded right now. Please try again in a moment.</p>'
        : "";
    list.innerHTML = data.reviews.length ? cards(data.reviews) : data.failed ? "" : EMPTY_HTML;
    if (!data.shared && data.reviews.length) {
      list.insertAdjacentHTML("beforeend", '<p class="muted small"><button class="link-btn" type="button" id="rv-clear">Delete my reviews from this device</button></p>');
    }
  }

  list.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id !== "rv-clear") return;
    void listReviews().then((d) => {
      d.reviews.forEach((r) => removeLocalReview(r.id));
      return refresh();
    });
  });

  text.addEventListener("input", () => {
    count.textContent = text.value.length + " / " + LIMITS.textMax;
  });

  $<HTMLFormElement>("#rv-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const rating = Number(root.querySelector<HTMLInputElement>('input[name="rating"]:checked')?.value ?? 0);
    const btn = $<HTMLButtonElement>("#rv-send");
    btn.disabled = true;
    msg.textContent = "Sending…";
    void submitReview($<HTMLInputElement>("#rv-name").value, rating, text.value, $<HTMLInputElement>("#rv-site").value).then((r) => {
      btn.disabled = false;
      if (!r.ok) {
        msg.textContent = r.message;
        return;
      }
      msg.textContent = r.pending
        ? "Thank you. Your review will appear once it has been checked."
        : "Thank you. Your review is saved on this device.";
      text.value = "";
      count.textContent = "0 / " + LIMITS.textMax;
      root.querySelectorAll<HTMLInputElement>('input[name="rating"]').forEach((i) => (i.checked = false));
      void refresh();
    });
  });

  void refresh();
  return () => {
    alive = false;
  };
};
