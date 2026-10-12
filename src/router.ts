import type { Route } from "./types";
import { setActiveNav } from "./chrome";

export type Unmount = () => void;
export type Mount = (root: HTMLElement) => Unmount | void;

const ROUTES: Route[] = ["home", "check", "declare", "guide", "about", "dashboard", "reviews", "privacy", "terms"];

function current(): Route {
  const name = window.location.hash.replace(/^#/, "");
  return (ROUTES as string[]).includes(name) ? (name as Route) : "home";
}

/** Plain #anchors only: #home, #check, #declare, #guide, #about, #dashboard, #reviews, #privacy and #terms. */
export function startRouter(main: HTMLElement, pages: Record<Route, Mount>): void {
  let unmount: Unmount | void;
  let shown: Route | null = null;

  const show = (): void => {
    const route = current();
    if (route === shown) return;
    if (typeof unmount === "function") unmount();
    shown = route;
    main.innerHTML = "";
    main.dataset["page"] = route;
    unmount = pages[route](main);
    setActiveNav(route);
    window.scrollTo(0, 0);
  };

  window.addEventListener("hashchange", show);
  show();
}
