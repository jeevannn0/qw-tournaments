import {
  config,
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  formatDateTime,
  galleryMedia,
  getCapacity,
  getEventMedia,
  getEventState,
  officialWallpaperSource,
  registrationUrl,
  supportUrl,
  tournaments
} from "../shared/data.js";
import { eventCard, eventStatusBadge } from "../shared/event-card.js";
import { icon, initializeShell } from "../shared/shell.js";
import { initializeMotion } from "../shared/motion.js";

function renderFeaturedEvent(tournament) {
  const mount = document.querySelector("#featuredEvent");
  if (!mount || !tournament) return;
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const mainAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Enter this lobby ${icon("arrow")}</a>`
    : `<a class="button button--primary button--large" href="${eventUrl(tournament)}">Open match intel ${icon("arrow")}</a>`;

  mount.innerHTML = `
    <article class="feature-event" data-spotlight>
      <div class="feature-event__content" data-reveal>
        <div class="inline-badges">${eventStatusBadge(tournament)}${config.demoMode ? '<span class="demo-chip">Demo match</span>' : ""}</div>
        <p class="kicker">Priority drop // ${escapeHtml(tournament.shortCode)}</p>
        <h2>${escapeHtml(tournament.name)}</h2>
        <p class="feature-event__lead">${escapeHtml(tournament.tagline)}</p>
        <dl class="feature-event__facts">
          <div><dt>Drop time</dt><dd>${escapeHtml(formatDateTime(tournament.matchAt))}</dd></div>
          <div><dt>Bounty</dt><dd>${escapeHtml(formatCurrency(tournament.prizePool))}</dd></div>
          <div><dt>Open slots</dt><dd>${capacity.spotsLeft} / ${capacity.capacity} ${capacity.unit}</dd></div>
        </dl>
        <div class="button-row">${mainAction}<a class="button button--quiet button--large" href="${eventUrl(tournament)}">Match intel</a></div>
      </div>
      <div class="feature-event__visual" data-reveal data-parallax>
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="feature-event__shade" aria-hidden="true"></span>
        <span class="feature-event__grid" aria-hidden="true"></span>
        <span class="feature-event__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <span class="feature-event__crosshair" aria-hidden="true"><i></i><i></i></span>
        <a class="feature-event__hit" href="${eventUrl(tournament)}" aria-label="Open ${escapeHtml(tournament.name)} match intel"></a>
        <span class="feature-event__caption"><small>${escapeHtml(tournament.stage)}</small><strong>${escapeHtml(tournament.formatLabel)}</strong></span>
        <a class="media-credit media-credit--image" href="${officialWallpaperSource}" target="_blank" rel="noopener noreferrer">Official Free Fire wallpaper · Garena</a>
      </div>
    </article>`;
}

function renderEventPreview() {
  const grid = document.querySelector("#homeEventGrid");
  if (!grid) return;
  const ordered = [...tournaments].sort((a, b) => Date.parse(a.matchAt) - Date.parse(b.matchAt));
  grid.innerHTML = ordered.slice(0, 3).map((tournament) => eventCard(tournament, { compact: true })).join("");
}

function renderCombatGallery() {
  const gallery = document.querySelector("#combatGallery");
  if (!gallery) return;
  gallery.innerHTML = galleryMedia.map((media, index) => `
    <figure class="combat-shot combat-shot--${index + 1}" data-reveal data-parallax>
      <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" loading="lazy" decoding="async">
      <span class="combat-shot__overlay" aria-hidden="true"></span>
      <figcaption><span>0${index + 1}</span><strong>${escapeHtml(media.label)}</strong><a href="${officialWallpaperSource}" target="_blank" rel="noopener noreferrer">Garena wallpaper</a></figcaption>
    </figure>`).join("");
}

function renderLiveFacts() {
  const openEvents = tournaments.filter((tournament) => getEventState(tournament).open).length;
  const modes = new Set(tournaments.map((tournament) => tournament.formatLabel)).size;
  const totalPrize = tournaments.reduce((sum, tournament) => sum + (Number(tournament.prizePool) || 0), 0);
  document.querySelector("#homeEventCount").textContent = String(openEvents).padStart(2, "0");
  document.querySelector("#homeModeCount").textContent = String(modes).padStart(2, "0");
  document.querySelector("#homePrizeTotal").textContent = formatCurrency(totalPrize);
}

function initializeHome() {
  initializeShell();
  const featured = tournaments.find((tournament) => tournament.featured) || tournaments[0];
  renderFeaturedEvent(featured);
  renderEventPreview();
  renderCombatGallery();
  renderLiveFacts();

  const support = document.querySelector("#homeSupportLink");
  if (support) support.href = supportUrl("joining a Free Fire tournament");
  initializeMotion();
}

initializeHome();
