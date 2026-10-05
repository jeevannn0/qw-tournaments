import {
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  formatDateTime,
  formatLobbySchedule,
  formatReward,
  getCapacity,
  getEventMedia,
  getEventState,
  getEventTimeSlots,
  registrationUrl
} from "./data.js?v=20261006-lobbies";
import { icon } from "./shell.js";

export function eventStatusBadge(tournament) {
  const state = getEventState(tournament);
  return `<span class="status-badge status-badge--${escapeHtml(state.key)}"><span aria-hidden="true"></span>${escapeHtml(state.label)}</span>`;
}

function eventFacts(tournament, capacity) {
  const comingSoon = tournament.comingSoon === true;
  const timeSlots = getEventTimeSlots(tournament);
  const alwaysOpen = tournament.alwaysOpen === true;
  const firstLabel = comingSoon ? "Schedule" : timeSlots.length ? "Lobbies" : alwaysOpen ? "Registration" : "Starts";
  const firstValue = comingSoon
    ? "Pending"
    : timeSlots.length
      ? escapeHtml(formatLobbySchedule(tournament))
      : alwaysOpen
        ? "Always open"
        : `<time datetime="${escapeHtml(tournament.matchAt)}">${escapeHtml(formatDateTime(tournament.matchAt))}</time>`;
  const availability = comingSoon
    ? `${capacity.capacity} ${capacity.unit} planned`
    : timeSlots.length
      ? `${timeSlots.length} × 50-player lobbies`
      : `${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}`;
  return `
    <dl class="event-card__facts">
      <div><dt>${firstLabel}</dt><dd>${firstValue}</dd></div>
      <div><dt>Reward</dt><dd>${escapeHtml(formatReward(tournament))}</dd></div>
      <div><dt>Entry</dt><dd>${escapeHtml(formatCurrency(tournament.entryFee))}</dd></div>
      <div><dt>${comingSoon ? "Capacity" : "Open"}</dt><dd>${escapeHtml(availability)}</dd></div>
    </dl>`;
}

function rewardStrip(tournament) {
  if (tournament.comingSoon) {
    return '<div class="coming-soon-strip"><strong>Coming soon</strong><span>Schedule and entry details will be announced here.</span></div>';
  }
  return `<div class="reward-strip" aria-label="Solo match rewards"><span><strong>${escapeHtml(formatCurrency(tournament.killReward))}</strong><small>per confirmed kill</small></span><span><strong>${escapeHtml(formatCurrency(tournament.booyahBonus))}</strong><small>Booyah bonus</small></span></div>`;
}

export function eventCard(tournament, options = {}) {
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const compact = Boolean(options.compact);
  const comingSoon = tournament.comingSoon === true;
  const classes = ["event-card", tournament.featured ? "event-card--featured" : "", compact ? "event-card--compact" : "", comingSoon ? "event-card--coming-soon" : ""].filter(Boolean).join(" ");
  const primaryAction = state.open
    ? `<a class="button button--primary" href="${registrationUrl(tournament)}">Register for ₹10 ${icon("arrow")}</a>`
    : `<span class="button button--disabled" aria-disabled="true">${escapeHtml(state.label)}</span>`;
  const secondaryAction = `<a class="button button--text" href="${eventUrl(tournament)}">${comingSoon ? "Preview" : "Details"}</a>`;

  return `
    <article class="${classes}" data-reveal>
      <a class="event-card__art" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details">
        <img class="event-card__image" src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" loading="${options.eager ? "eager" : "lazy"}" decoding="async" ${options.eager ? 'fetchpriority="high"' : ""} style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="event-card__shade" aria-hidden="true"></span>
        <span class="event-card__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <span class="event-card__topline">${eventStatusBadge(tournament)}</span>
        <span class="event-card__code">${escapeHtml(tournament.shortCode)}</span>
      </a>
      <div class="event-card__body">
        <div class="event-card__identity">
          <p class="event-card__format">${escapeHtml(tournament.formatLabel)} · ${escapeHtml(tournament.server || "India")}</p>
          <h3><a href="${eventUrl(tournament)}">${escapeHtml(tournament.name)}</a></h3>
          <p class="event-card__tagline">${escapeHtml(tournament.tagline || tournament.description || "Competitive community match")}</p>
        </div>
        ${rewardStrip(tournament)}
        ${eventFacts(tournament, capacity)}
        ${comingSoon ? "" : `<progress class="capacity-meter" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress>`}
        <div class="event-card__actions">${primaryAction}${secondaryAction}</div>
      </div>
    </article>`;
}
