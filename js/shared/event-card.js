import {
  config,
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  formatDateTime,
  getCapacity,
  getEventMedia,
  getEventState,
  officialWallpaperSource,
  registrationUrl
} from "./data.js";
import { icon } from "./shell.js";

export function eventStatusBadge(tournament) {
  const state = getEventState(tournament);
  return `<span class="status-badge status-badge--${escapeHtml(state.key)}"><span aria-hidden="true"></span>${escapeHtml(state.label)}</span>`;
}

export function eventCard(tournament, options = {}) {
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const compact = Boolean(options.compact);
  const classes = ["event-card", tournament.featured ? "event-card--featured" : "", compact ? "event-card--compact" : ""].filter(Boolean).join(" ");
  const action = state.open
    ? `<a class="button button--primary" href="${registrationUrl(tournament)}">${escapeHtml(state.action)} ${icon("arrow")}</a>`
    : `<a class="button button--quiet" href="${eventUrl(tournament)}">${escapeHtml(state.action)} ${icon("arrow")}</a>`;

  return `
    <article class="${classes}" data-reveal data-spotlight>
      <a class="event-card__art" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details">
        <img class="event-card__image" src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" loading="lazy" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="event-card__shade" aria-hidden="true"></span>
        <span class="event-card__grid" aria-hidden="true"></span>
        <span class="event-card__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <span class="event-card__topline">${eventStatusBadge(tournament)}${config.demoMode ? '<span class="demo-chip">Sample</span>' : ""}</span>
        <span class="event-card__code">${escapeHtml(tournament.shortCode)}</span>
      </a>
      <div class="event-card__body">
        <a class="media-credit" href="${officialWallpaperSource}" target="_blank" rel="noopener noreferrer">Official Free Fire wallpaper · Garena</a>
        <div>
          <p class="event-card__format">${escapeHtml(tournament.formatLabel)} · ${escapeHtml(tournament.server || "India")}</p>
          <h3><a href="${eventUrl(tournament)}">${escapeHtml(tournament.name)}</a></h3>
          <p class="event-card__tagline">${escapeHtml(tournament.tagline || tournament.description || "Competitive community match")}</p>
        </div>
        <dl class="event-card__facts">
          <div><dt>${icon("calendar")} Starts</dt><dd><time datetime="${escapeHtml(tournament.matchAt)}">${escapeHtml(formatDateTime(tournament.matchAt))}</time></dd></div>
          <div><dt>${icon("crown")} Prize</dt><dd>${escapeHtml(formatCurrency(tournament.prizePool))}</dd></div>
          <div><dt>${icon("team")} Available</dt><dd>${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}</dd></div>
          <div><dt>₹ Entry</dt><dd>${escapeHtml(formatCurrency(tournament.entryFee))} ${escapeHtml(tournament.feeUnit)}</dd></div>
        </dl>
        <div class="capacity-meter" aria-label="${capacity.percent}% of slots filled"><span style="width:${capacity.percent}%"></span></div>
        <div class="event-card__actions">
          ${action}
          <a class="button button--text" href="${eventUrl(tournament)}">Intel</a>
        </div>
      </div>
    </article>`;
}
