import "./styles.css";
import { initAppearance } from "./appearance";
import { mountChrome } from "./chrome";
import { startRouter } from "./router";
import { startAllowance } from "./timer";
import { mount as home } from "./pages/home";
import { mount as check } from "./pages/check";
import { mount as declare } from "./pages/declare";
import { mount as guide } from "./pages/guide";
import { mount as about } from "./pages/about";
import { mount as dashboard } from "./pages/dashboard";
import { mount as reviews } from "./pages/reviews";
import { mount as privacy } from "./pages/privacy";
import { mount as terms } from "./pages/terms";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app element");

initAppearance();
const main = mountChrome(app);
startAllowance();
startRouter(main, { home, check, declare, guide, about, dashboard, reviews, privacy, terms });
