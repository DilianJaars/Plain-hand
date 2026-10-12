import type { Mount } from "../router";
import { fmtDuration, ring } from "../format";
import { subscribe } from "../timer";
import { EMPTY_HTML, cards, listReviews, summary } from "../reviews";

const HTML = `
<section class="hero">
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="sticker">Free. 4 hours a day.</p>
      <h1>Write it yourself. <span class="hl">Check it</span> before anyone else does.</h1>
      <p class="lead">Plainhand reads your draft the way a tired marker might, and points at the sentences that sound like nobody in particular. You fix them in your own words. If AI did help somewhere, you say so in one clear paragraph.</p>
      <div class="actions">
        <a class="btn" href="#check">Check a draft</a>
        <a class="btn ghost" href="#guide">Read the guide</a>
      </div>
    </div>

    <div class="hero-art" aria-hidden="true">
      <div class="card-back"></div>
      <div class="paper tilt">
        <p class="read">
          <span class="s s-2">In today's fast-paced world, time management plays a crucial role in student success.<sup class="mk">1</sup></span>
          On Tuesdays I have a 7 am lab, a shift at the garage and a tutorial I always run late for.
          <span class="s s-1">Moreover, effective strategies can foster resilience.<sup class="mk">2</sup></span>
        </p>
        <p class="hand note-a">starts like every essay ever</p>
        <p class="hand note-b">this one sounds like you</p>
        <svg class="scribble" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 8 C 40 4, 70 20, 96 46 M96 46 l-14 -2 M96 46 l-3 -14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <h2 class="band-title">Three small steps, no account.</h2>
    <ol class="steps">
      <li class="step">
        <span class="step-no">1</span>
        <h3>Paste your draft</h3>
        <p>Type it, paste it, or drop in a Word, PDF or text file. Nothing is uploaded anywhere. It stays in this browser.</p>
      </li>
      <li class="step">
        <span class="step-no">2</span>
        <h3>Read the marks</h3>
        <p>Yellow means a sentence reads generic or machine-made. Every mark comes with a reason and a nudge, in plain words.</p>
      </li>
      <li class="step">
        <span class="step-no">3</span>
        <h3>Own it, or declare it</h3>
        <p>Rewrite the marked sentences in your voice. If you used AI for any part, tag it and copy a short declaration for your marker.</p>
      </li>
    </ol>
  </div>
</section>

<section class="split">
  <div class="wrap split-in">
    <div class="split-a">
      <div class="big-ring" id="home-ring"></div>
      <div>
        <h2>Free means free.</h2>
        <p>You get 4 hours of use a day. The clock runs whenever Plainhand is open in front of you, and it starts fresh at midnight. Right now you have <b id="home-left">4h 00m</b> left.</p>
      </div>
    </div>
    <div class="split-b">
      <h2>It isn't Turnitin.</h2>
      <p>Plainhand cannot see your university's report and cannot promise what its detector will say. Think of it as a second pair of eyes before you hand in, one that explains itself.</p>
      <p><a class="textlink" href="#about">What it looks at, and where it gets things wrong</a></p>
    </div>
  </div>
</section>

<section class="rv-band">
  <div class="wrap">
    <div class="rv-head">
      <h2>What students say</h2>
      <a class="btn ghost" href="#reviews">Read all and add yours</a>
    </div>
    <div id="home-rv-sum"></div>
    <div id="home-rv" aria-live="polite"></div>
  </div>
</section>

<section class="closer">
  <div class="wrap closer-in">
    <h2>Got a draft? Go on, paste something in.</h2>
    <a class="btn" href="#check">Open the checker</a>
  </div>
</section>
`;

export const mount: Mount = (root) => {
  root.innerHTML = HTML;
  const ringHost = root.querySelector<HTMLElement>("#home-ring")!;
  const left = root.querySelector<HTMLElement>("#home-left")!;
  const rvSum = root.querySelector<HTMLElement>("#home-rv-sum")!;
  const rv = root.querySelector<HTMLElement>("#home-rv")!;
  let alive = true;
  void listReviews().then((d) => {
    if (!alive) return;
    rvSum.innerHTML = summary(d.reviews);
    rv.innerHTML = d.reviews.length
      ? cards(d.reviews.slice(0, 3)) + (d.shared ? "" : '<p class="muted small">Reviews are saved on this device only until a shared review service is connected.</p>')
      : d.failed
        ? '<p class="muted">Reviews could not be loaded right now.</p>'
        : EMPTY_HTML;
  });
  const stop = subscribe((s) => {
    ringHost.innerHTML = ring(s.fraction, 96, 9);
    left.textContent = fmtDuration(s.left);
  });
  return () => {
    alive = false;
    stop();
  };
};
