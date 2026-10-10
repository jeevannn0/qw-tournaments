import {
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  getCapacity,
  getEventMedia,
  getEventPresentation,
  getEventState,
  registrationUrl
} from "./data.js?v=20261013-squad-results";
import { icon } from "./shell.js?v=20261013-squad-results";

export function eventStatusBadge(tournament, providedState = null) {
  const state = providedState || getEventState(tournament);
  return `<span class="status-badge status-badge--${escapeHtml(state.key)}"><span aria-hidden="true"></span>${escapeHtml(state.label)}</span>`;
}

function eventFacts(presentation) {
  return `
    <dl class="event-card__facts">
      <div><dt>Schedule</dt><dd>${escapeHtml(presentation.schedule)}</dd></div>
      <div><dt>Reward</dt><dd>${escapeHtml(presentation.reward)}</dd></div>
      <div><dt>Entry</dt><dd>${escapeHtml(presentation.entry)}</dd></div>
      <div><dt>Capacity</dt><dd>${escapeHtml(presentation.capacityLabel)}</dd></div>
    </dl>`;
}

function presentationStrip(tournament, presentation) {
  if (presentation.comingSoon) return '<div class="coming-soon-strip"><strong>Coming soon</strong><span>Schedule and entry details will be announced here.</span></div>';
  if (presentation.hasOverride) {
    const copy = presentation.mode === "registration_open"
      ? `Choose the lobby and register your ${tournament.type === "solo" ? "player" : "four-player squad"}.`
      : presentation.mode === "completed"
        ? "This match has finished; registration is closed."
        : "Match facts announced; registration remains closed.";
    return `<div class="announcement-strip announcement-strip--${escapeHtml(presentation.mode)}"><strong>${escapeHtml(presentation.state.label)}</strong><span>${escapeHtml(copy)}</span></div>`;
  }
  return `<div class="reward-strip" aria-label="Solo match rewards"><span><strong>${escapeHtml(formatCurrency(tournament.killReward))}</strong><small>per confirmed kill</small></span><span><strong>${escapeHtml(formatCurrency(tournament.booyahBonus))}</strong><small>Booyah bonus</small></span></div>`;
}

export function eventCard(tournament, options = {}) {
  const presentation = getEventPresentation(tournament);
  const state = presentation.state;
  const canonicalCapacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const compact = Boolean(options.compact);
  const classes = [
    "event-card",
    tournament.featured ? "event-card--featured" : "",
    compact ? "event-card--compact" : "",
    presentation.comingSoon ? "event-card--coming-soon" : "",
    presentation.hasOverride ? `event-card--announcement event-card--${presentation.mode}` : ""
  ].filter(Boolean).join(" ");
  const primaryAction = state.open
    ? `<a class="button button--primary" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(presentation.entryFee))} ${icon("arrow")}</a>`
    : `<span class="button button--disabled" aria-disabled="true">${escapeHtml(state.label)}</span>`;
  const secondaryAction = `<a class="button button--text" href="${eventUrl(tournament)}">${presentation.comingSoon ? "Preview" : "Details"}</a>`;
  const tagline = presentation.rolledOver ? "The next schedule and match terms will be announced here." : tournament.tagline || tournament.description || "Competitive community match";

  return `
    <article class="${classes}" data-reveal${Number.isFinite(presentation.rolloverAt) ? ` data-presentation-rollover="${presentation.rolloverAt}"` : ""}>
      <a class="event-card__art" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details">
        <img class="event-card__image" src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" loading="${options.eager ? "eager" : "lazy"}" decoding="async" ${options.eager ? 'fetchpriority="high"' : ""} style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="event-card__shade" aria-hidden="true"></span><span class="event-card__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span><span class="event-card__topline">${eventStatusBadge(tournament, state)}</span><span class="event-card__code">${escapeHtml(tournament.shortCode)}</span>
      </a>
      <div class="event-card__body">
        <div class="event-card__identity"><p class="event-card__format">${escapeHtml(tournament.formatLabel)} · ${escapeHtml(tournament.server || "India")}</p><h3><a href="${eventUrl(tournament)}">${escapeHtml(tournament.name)}</a></h3><p class="event-card__tagline">${escapeHtml(tagline)}</p></div>
        ${presentationStrip(tournament, presentation)}
        ${eventFacts(presentation)}
        ${presentation.hasOverride || presentation.comingSoon ? "" : `<progress class="capacity-meter" max="${canonicalCapacity.capacity || 1}" value="${canonicalCapacity.filled}" aria-label="${canonicalCapacity.filled} of ${canonicalCapacity.capacity} ${canonicalCapacity.unit} filled">${canonicalCapacity.percent}%</progress>`}
        <div class="event-card__actions">${primaryAction}${secondaryAction}</div>
      </div>
    </article>`;
}
