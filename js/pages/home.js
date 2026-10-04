import {
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  getCapacity,
  getEventMedia,
  getEventState,
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
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(tournament.entryFee))} ${icon("arrow")}</a>`
    : `<a class="button button--quiet button--large" href="${eventUrl(tournament)}">View preview ${icon("arrow")}</a>`;

  mount.innerHTML = `
    <article class="feature-event">
      <div class="feature-event__content" data-reveal>
        <div class="inline-badges">${eventStatusBadge(tournament)}</div>
        <p class="kicker">Live solo match · ${escapeHtml(tournament.shortCode)}</p>
        <h2>${escapeHtml(tournament.name)}</h2>
        <p class="feature-event__lead">${escapeHtml(tournament.tagline)}</p>
        <div class="reward-strip reward-strip--feature" aria-label="Solo match rewards">
          <span><strong>${escapeHtml(formatCurrency(tournament.entryFee))}</strong><small>entry</small></span>
          <span><strong>${escapeHtml(formatCurrency(tournament.killReward))}</strong><small>per confirmed kill</small></span>
          <span><strong>${escapeHtml(formatCurrency(tournament.booyahBonus))}</strong><small>Booyah bonus</small></span>
        </div>
        <dl class="feature-event__facts">
          <div><dt>Registration</dt><dd>Always open</dd></div>
          <div><dt>Map</dt><dd>${escapeHtml(tournament.map)}</dd></div>
          <div><dt>Open</dt><dd>${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}</dd></div>
        </dl>
        <progress class="capacity-meter capacity-meter--large" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress>
        <div class="button-row">${mainAction}<a class="button button--quiet button--large" href="${eventUrl(tournament)}">Rules and how to join</a></div>
      </div>
      <div class="feature-event__visual" data-reveal>
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" loading="lazy" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="feature-event__shade" aria-hidden="true"></span>
        <span class="feature-event__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <a class="feature-event__hit" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details"></a>
        <span class="feature-event__caption"><small>${escapeHtml(tournament.stage)}</small><strong>${escapeHtml(tournament.formatLabel)}</strong></span>
        <span class="feature-event__scan" aria-hidden="true"></span>
        <span class="feature-event__glitch" aria-hidden="true"></span>
      </div>
    </article>`;
}

function renderEventPreview() {
  const grid = document.querySelector("#homeEventGrid");
  if (!grid) return;
  const ordered = [...tournaments].sort((a, b) => Number(getEventState(b).open) - Number(getEventState(a).open));
  grid.innerHTML = ordered.length
    ? ordered.map((tournament, index) => eventCard(tournament, { compact: true, eager: index === 0 })).join("")
    : '<div class="empty-state"><h2>No matches published</h2><p>The next match will appear here when its schedule is ready.</p></div>';
}

function renderLiveFacts() {
  const solo = tournaments.find((tournament) => tournament.type === "solo" && !tournament.comingSoon);
  document.querySelector("#homeEventCount").textContent = String(tournaments.filter((tournament) => getEventState(tournament).open).length).padStart(2, "0");
  document.querySelector("#homeKillReward").textContent = formatCurrency(solo?.killReward);
  document.querySelector("#homeBooyahBonus").textContent = formatCurrency(solo?.booyahBonus);
}

function initializeHome() {
  initializeShell();
  const featured = tournaments.find((tournament) => tournament.featured) || tournaments.find((tournament) => getEventState(tournament).open) || tournaments[0];
  renderEventPreview();
  renderFeaturedEvent(featured);
  renderLiveFacts();
  const support = document.querySelector("#homeSupportLink");
  const supportHref = supportUrl("joining the Solo Survival match");
  if (support && supportHref) support.href = supportHref;
  initializeMotion();
}

initializeHome();
