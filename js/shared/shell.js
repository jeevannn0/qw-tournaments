import { config, escapeHtml, supportUrl } from "./data.js";

const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z"/><path d="M5 21h14"/>',
  gamepad: '<path d="M8.5 6h7a6.5 6.5 0 0 1 6.2 8.4l-1 3.1a2.5 2.5 0 0 1-4.1 1.1L14 16h-4l-2.6 2.6a2.5 2.5 0 0 1-4.1-1.1l-1-3.1A6.5 6.5 0 0 1 8.5 6Z"/><path d="M7 10v4M5 12h4M17 11h.01M19 13h.01"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  moon: '<path d="M20.7 15.2A8.5 8.5 0 0 1 8.8 3.3 8.5 8.5 0 1 0 20.7 15.2Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  shield: '<path d="M12 3 5 6v5c0 4.6 2.9 8.4 7 10 4.1-1.6 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.4-6 6-6s6 2 6 6M15 14c3 0 5 1.8 5 5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
  whatsapp: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.3L3 20.3l1.4-5a8.4 8.4 0 1 1 16.1-3.7Z"/><path d="M8.1 7.5c.2-.4.4-.5.8-.5.3 0 .5 0 .7.5l1 2.2c.1.3.1.5-.1.7l-.7.8c-.2.2-.2.4-.1.7.6 1.1 1.5 2 2.6 2.6.3.2.5.2.7-.1l.9-1c.2-.3.5-.3.8-.2l2.1 1c.4.2.5.3.5.5 0 .9-.5 1.8-1.1 2.3-.6.5-1.5.8-2.3.7-1.2-.1-2.8-.6-4.5-2-1.4-1.1-2.5-2.5-3.2-4-.5-1.1-.5-2.2.1-3.2.4-.6.8-1 1-1Z"/>'
};

export function icon(name, className = "icon") {
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
}

const navItems = [
  { key: "home", label: "Home", href: "index.html" },
  { key: "tournaments", label: "Tournaments", href: "tournaments.html" },
  { key: "players", label: "Players", href: "players.html" },
  { key: "rules", label: "Rules", href: "rules.html" }
];

let toastTimer;
let toastMessage = "";

function navLinks(activePage, className) {
  return navItems.map((item) => {
    const current = item.key === activePage ? ' aria-current="page"' : "";
    return `<a class="${className}" href="${item.href}"${current}>${item.label}</a>`;
  }).join("");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const next = theme === "dark" ? "light" : "dark";
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-label", `Switch to ${next} theme`);
    button.setAttribute("title", `Switch to ${next} theme`);
    button.innerHTML = theme === "dark" ? icon("sun") : icon("moon");
  });
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(next);
  try {
    window.localStorage.setItem("qw-theme", next);
  } catch {
    // Theme persistence is optional.
  }
}

function closeDrawer(drawer, opener) {
  if (!drawer) return;
  if (typeof drawer.close === "function" && drawer.open) drawer.close();
  else drawer.removeAttribute("open");
  document.body.classList.remove("drawer-open");
  if (opener && document.activeElement !== opener) opener.focus();
}

function initializeDrawer() {
  const drawer = document.querySelector("#navDrawer");
  const opener = document.querySelector("#navDrawerOpen");
  const closeButton = document.querySelector("#navDrawerClose");
  if (!drawer || !opener || !closeButton) return;

  opener.addEventListener("click", () => {
    document.body.classList.add("drawer-open");
    if (typeof drawer.showModal === "function") drawer.showModal();
    else drawer.setAttribute("open", "");
    window.requestAnimationFrame(() => closeButton.focus());
  });

  closeButton.addEventListener("click", () => closeDrawer(drawer, opener));
  drawer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDrawer(drawer, opener);
  });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer(drawer, opener);
  });
  drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => closeDrawer(drawer)));
}

function scheduleToastClose(duration) {
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, duration);
}

export function hideToast() {
  const toast = document.querySelector("#siteToast");
  if (!toast) return;
  toast.hidden = true;
  toastMessage = "";
  window.clearTimeout(toastTimer);
}

export function showToast(message, duration = 4200) {
  const toast = document.querySelector("#siteToast");
  const text = document.querySelector("#siteToastText");
  if (!toast || !text) return;
  toastMessage = String(message);
  text.textContent = toastMessage;
  toast.hidden = false;
  scheduleToastClose(duration);
}

function initializeToast() {
  const toast = document.querySelector("#siteToast");
  if (!toast) return;
  toast.querySelector("[data-toast-close]")?.addEventListener("click", hideToast);
  toast.addEventListener("mouseenter", () => window.clearTimeout(toastTimer));
  toast.addEventListener("mouseleave", () => {
    if (toastMessage) scheduleToastClose(2400);
  });
  toast.addEventListener("focusin", () => window.clearTimeout(toastTimer));
  toast.addEventListener("focusout", () => {
    if (toastMessage) scheduleToastClose(2400);
  });
}

export function initializeShell() {
  const activePage = document.body.dataset.page || "home";
  const headerMount = document.querySelector("#siteHeader");
  const footerMount = document.querySelector("#siteFooter");
  const safeBrand = escapeHtml(config.brandName);
  const helpLink = supportUrl("a QW tournament");

  if (headerMount) {
    headerMount.innerHTML = `
      ${config.demoMode ? `<div class="demo-ribbon" role="status"><div class="shell"><span class="status-dot" aria-hidden="true"></span><strong>Demo mode</strong><span>Sample schedule and prizes — do not pay until confirmed in WhatsApp.</span></div></div>` : ""}
      <header class="app-header">
        <div class="shell app-header__inner">
          <a class="wordmark" href="index.html" aria-label="${safeBrand} home">
            <span class="wordmark__symbol" aria-hidden="true">QW</span>
            <span class="wordmark__text"><strong>QW</strong><small>Tournaments</small></span>
          </a>
          <nav class="desktop-nav" aria-label="Primary navigation">${navLinks(activePage, "desktop-nav__link")}</nav>
          <div class="app-header__actions">
            <button class="icon-button" type="button" data-theme-toggle aria-label="Switch color theme"></button>
            <a class="button button--primary header-register" href="register.html">Join tournament</a>
            <button class="icon-button nav-open" id="navDrawerOpen" type="button" aria-label="Open navigation" aria-haspopup="dialog">${icon("menu")}</button>
          </div>
        </div>
      </header>
      <dialog class="nav-drawer" id="navDrawer" aria-labelledby="navDrawerTitle">
        <div class="nav-drawer__panel">
          <div class="nav-drawer__header">
            <div><span class="kicker">Menu</span><h2 id="navDrawerTitle">Navigate QW</h2></div>
            <button class="icon-button" id="navDrawerClose" type="button" aria-label="Close navigation">${icon("close")}</button>
          </div>
          <nav class="drawer-nav" aria-label="Mobile navigation">${navLinks(activePage, "drawer-nav__link")}</nav>
          <div class="nav-drawer__footer">
            <a class="button button--primary button--full" href="register.html">Join a tournament ${icon("arrow")}</a>
            <a class="button button--quiet button--full" href="${helpLink}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")} Ask the organizer</a>
          </div>
        </div>
      </dialog>`;
  }

  if (footerMount) {
    footerMount.innerHTML = `
      <footer class="site-footer">
        <div class="shell site-footer__grid">
          <div class="site-footer__brand">
            <a class="wordmark wordmark--footer" href="index.html"><span class="wordmark__symbol" aria-hidden="true">QW</span><span class="wordmark__text"><strong>QW</strong><small>Tournaments</small></span></a>
            <p>Community-run Free Fire matches with clear rules, private registration, and human confirmation.</p>
          </div>
          <div><h2>Explore</h2>${navLinks(activePage, "footer-link")}<a class="footer-link" href="register.html">Register</a></div>
          <div><h2>Support</h2><a class="footer-link" href="${helpLink}" target="_blank" rel="noopener noreferrer">${config.whatsappDisplay}</a><span>${escapeHtml(config.supportHours)}</span><span>India · ${escapeHtml(config.timezoneLabel)}</span></div>
        </div>
        <div class="shell site-footer__bottom"><span>© ${new Date().getFullYear()} ${safeBrand}</span><span>Independent community event · Not affiliated with or endorsed by Garena.</span></div>
      </footer>
      <div class="toast" id="siteToast" role="status" aria-live="polite" aria-atomic="true" hidden>
        <span id="siteToastText"></span>
        <button type="button" data-toast-close aria-label="Dismiss message">${icon("close")}</button>
      </div>`;
  }

  setTheme(document.documentElement.dataset.theme || "light");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => button.addEventListener("click", toggleTheme));
  initializeDrawer();
  initializeToast();
  document.body.classList.add("shell-ready");
}
