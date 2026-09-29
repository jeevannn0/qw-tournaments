import { initializeMotion } from "../shared/motion.js";
import { initializeShell, showToast } from "../shared/shell.js";

initializeShell();
initializeMotion();

const ruleDetails = [...document.querySelectorAll(".rule-disclosure")];
const expandButton = document.querySelector("#expandRules");
const collapseButton = document.querySelector("#collapseRules");

expandButton?.addEventListener("click", () => {
  ruleDetails.forEach((detail) => { detail.open = true; });
  showToast("All rule sections expanded.");
});

collapseButton?.addEventListener("click", () => {
  ruleDetails.forEach((detail) => { detail.open = false; });
  document.querySelector("#rulesContent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("All rule sections collapsed.");
});

const sectionLinks = [...document.querySelectorAll("[data-rule-link]")];
const sections = sectionLinks.map((link) => document.querySelector(link.hash)).filter(Boolean);

if ("IntersectionObserver" in window && sections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    sectionLinks.forEach((link) => {
      if (link.hash === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-20% 0px -65%", threshold: [0, 0.2, 0.6] });
  sections.forEach((section) => observer.observe(section));
}
