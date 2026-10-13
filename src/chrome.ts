import type { Route } from "./types";
import { fmtDuration, ring } from "./format";
import { secondsUntilMidnight, subscribe } from "./timer";

const NAV: { route: Route; label: string }[] = [
  { route: "check", label: "Check" },
  { route: "declare", label: "Declare" },
  { route: "guide", label: "Guide" },
  { route: "reviews", label: "Reviews" },
  { route: "dashboard", label: "Dashboard" },
  { route: "about", label: "About" },
];

/** Builds the shared frame: header with the daily time ring, an empty <main>, a footer, and the lock screen. */
export function mountChrome(app: HTMLElement): HTMLElement {
  app.innerHTML =
    '<a class="skip" href="#main-content">Skip to content</a>' +
    '<header class="top"><div class="wrap top-in">' +
    '<a class="brand" href="#home" aria-label="Plainhand, home"><span>plainhand</span></a>' +
    '<nav class="nav" aria-label="Pages">' +
    NAV.map((n) => '<a href="#' + n.route + '" data-route="' + n.route + '">' + n.label + "</a>").join("") +
    "</nav>" +
    '<a class="clock" href="#dashboard" title="Free time left today. Open your dashboard."><span class="clock-ring"></span><span class="clock-text"><b id="clock-left">4h 00m</b> <small>left today</small></span></a>' +
    "</div></header>" +
    '<main id="main-content" tabindex="-1"></main>' +
    '<footer class="foot"><div class="wrap foot-in">' +
    "<p>Plainhand is a free revision aid for students who would rather write it themselves. It is not Turnitin and it is not connected to any university.</p>" +
    '<p class="foot-links"><a href="#check">Check a draft</a><a href="#guide">Guide</a><a href="#reviews">Reviews</a><a href="#dashboard">Dashboard</a><a href="#about">About</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a></p>' +
    "</div></footer>" +
    '<div class="lock" id="lock" hidden><div class="lock-in"><h2>That was your 4 hours.</h2><p id="lock-msg"></p><p class="lock-note">Your draft is saved on this device and will be here when you come back.</p></div></div>';

  const ringHost = app.querySelector<HTMLElement>(".clock-ring")!;
  const left = app.querySelector<HTMLElement>("#clock-left")!;
  const lock = app.querySelector<HTMLElement>("#lock")!;
  const lockMsg = app.querySelector<HTMLElement>("#lock-msg")!;

  subscribe((s) => {
    ringHost.innerHTML = ring(s.fraction, 26, 4);
    left.textContent = fmtDuration(s.left);
    lock.hidden = !s.locked;
    if (s.locked) {
      const mins = Math.round(secondsUntilMidnight() / 60);
      lockMsg.textContent = "Plainhand opens again at midnight, in about " + Math.floor(mins / 60) + "h " + (mins % 60) + "m.";
    }
  });

  return app.querySelector<HTMLElement>("#main-content")!;
}

export function setActiveNav(route: Route): void {
  const nav = document.querySelector<HTMLElement>(".nav");
  document.querySelectorAll<HTMLAnchorElement>(".nav a").forEach((a) => {
    if (a.dataset["route"] === route) {
      a.setAttribute("aria-current", "page");
      // On very narrow screens the menu scrolls sideways, so bring the current page into view.
      if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
    } else {
      a.removeAttribute("aria-current");
    }
  });
}
