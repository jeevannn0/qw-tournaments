import { preferredScrollBehavior } from "../shared/motion.js";
import { initializeMotion } from "../shared/motion.js";
import { initializeShell, showToast } from "../shared/shell.js?v=20261006-mobile-compact-v2";

initializeShell();
initializeMotion();

const ruleDetails = [...document.querySelectorAll(".rule-disclosure")];
const sectionLinks = [...document.querySelectorAll("[data-rule-link]")];
const sections = sectionLinks.map((link) => document.querySelector(link.hash)).filter(Boolean);

function setCurrentSection(id) {
  sectionLinks.forEach((link) => link.toggleAttribute("aria-current", link.hash === `#${id}`));
  const current = sectionLinks.find((link) => link.hash === `#${id}`);
  if (current) current.setAttribute("aria-current", "location");
}

function openHashTarget(shouldScroll = false) {
  const target = document.querySelector(window.location.hash);
  if (!target?.classList.contains("rule-section")) return;
  const details = target.querySelector("details");
  if (details) details.open = true;
  setCurrentSection(target.id);
  if (shouldScroll) target.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
}

sectionLinks.forEach((link) => link.addEventListener("click", () => {
  const target = document.querySelector(link.hash);
  const details = target?.querySelector("details");
  if (details) details.open = true;
  setCurrentSection(target?.id || "");
}));

window.addEventListener("hashchange", () => openHashTarget(true));
if (window.location.hash) {
  window.addEventListener("load", () => window.requestAnimationFrame(() => openHashTarget(true)), { once: true });
} else {
  setCurrentSection(sections[0]?.id || "");
}

document.querySelector("#expandRules")?.addEventListener("click", () => {
  ruleDetails.forEach((detail) => { detail.open = true; });
  showToast("All rule sections expanded.");
});

document.querySelector("#collapseRules")?.addEventListener("click", () => {
  ruleDetails.forEach((detail) => { detail.open = false; });
  document.querySelector("#rulesContent")?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
  showToast("All rule sections collapsed.");
});

let scrollFrame = 0;
function updateCurrentFromScroll() {
  scrollFrame = 0;
  if (!sections.length) return;
  const headerHeight = document.querySelector("#siteHeader")?.getBoundingClientRect().height || 0;
  const readingLine = Math.min(window.innerHeight * 0.42, headerHeight + 220);
  let current = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= readingLine) current = section;
  });
  setCurrentSection(current.id);
}

function queueScrollUpdate() {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(updateCurrentFromScroll);
}

window.addEventListener("scroll", queueScrollUpdate, { passive: true });
window.addEventListener("resize", queueScrollUpdate);
window.requestAnimationFrame(updateCurrentFromScroll);
