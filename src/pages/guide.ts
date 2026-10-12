import type { Mount } from "../router";

const HTML = `
<section class="page">
  <div class="wrap">
    <header class="page-head">
      <h1>Make it sound like you</h1>
      <p class="lead">Marked sentences are usually fixed by the same few moves. Here they are, with before and after examples we made up for the purpose.</p>
    </header>

    <div class="moves">
      <article class="move">
        <h2>Start with the point</h2>
        <p>Throat-clearing openers add words and no information. If you delete the first half of the sentence and nothing is lost, delete it.</p>
        <div class="ba">
          <div><span class="tag-b">Before</span><p class="read">In today's fast-paced world, social media plays a crucial role in the lives of teenagers.</p></div>
          <div><span class="tag-a">After</span><p class="read">Most of my class checks Instagram before they check the time.</p></div>
        </div>
      </article>

      <article class="move">
        <h2>Use a detail only you have</h2>
        <p>A name, a number, a place, a smell. Generic claims could be about anyone, which is exactly why they read as machine-made.</p>
        <div class="ba">
          <div><span class="tag-b">Before</span><p class="read">Many students face challenges when balancing work and study.</p></div>
          <div><span class="tag-a">After</span><p class="read">I work Thursday to Sunday at the garage and read for exams on the taxi home.</p></div>
        </div>
      </article>

      <article class="move">
        <h2>Let sentences be different sizes</h2>
        <p>People write a long one, then a short one. Three sentences of the same length in a row sound like a metronome.</p>
        <div class="ba">
          <div><span class="tag-b">Before</span><p class="read">The survey covered five schools. The results showed a clear pattern. The pattern suggested a funding gap.</p></div>
          <div><span class="tag-a">After</span><p class="read">The survey covered five schools, and the pattern was hard to miss. Funding.</p></div>
        </div>
      </article>

      <article class="move">
        <h2>Say it the way you would say it</h2>
        <p>If you would never say the word to a classmate, it probably should not be in your essay either. A few swaps:</p>
        <ul class="swaps">
          <li><s>leverage</s> <span>use</span></li>
          <li><s>multifaceted</s> <span>has several sides</span></li>
          <li><s>foster</s> <span>help grow</span></li>
          <li><s>navigate</s> <span>deal with</span></li>
          <li><s>pivotal</s> <span>turning point</span></li>
        </ul>
      </article>

      <article class="move">
        <h2>Drop the wrap-up that repeats the paragraph</h2>
        <p>"In conclusion, X is an important issue" tells your marker nothing new. End on your sharpest point instead, or on the thing you would test next.</p>
      </article>
    </div>
  </div>

  <div class="band">
    <div class="wrap two">
      <div>
        <h2 class="band-title">Keep your evidence</h2>
        <p>Your process is the best proof the work is yours. It costs nothing to keep.</p>
      </div>
      <ul class="plain-list">
        <li>Turn on version history in Word or Google Docs and leave it on.</li>
        <li>Keep your outline, notes and early drafts with their dates.</li>
        <li>Save links and page numbers as you read, not afterwards.</li>
        <li>Photograph handwritten plans. A messy page is fine.</li>
      </ul>
    </div>
  </div>

  <div class="wrap">
    <section class="flagged">
      <h2>If a detector flags you anyway</h2>
      <p>Detectors get honest work wrong, especially formal writing and writing by people who learned English as a second language. If it happens to you:</p>
      <ol class="plain-list ordered">
        <li>Stay calm and ask for the full report and your university's process.</li>
        <li>Share your drafts, notes and version history.</li>
        <li>Offer to talk your marker through the argument. You will know it better than anyone.</li>
        <li>Use the appeals process your university has. Student support offices handle this regularly.</li>
      </ol>
      <p class="muted">Plainhand does not help hide AI-written text from detectors. If you used AI, say so, and let your institution's policy decide what happens next.</p>
    </section>
  </div>
</section>
`;

export const mount: Mount = (root) => {
  root.innerHTML = HTML;
};
