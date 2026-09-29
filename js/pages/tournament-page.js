import {
  config,
  escapeHtml,
  eventMark,
  formatCurrency,
  formatDateTime,
  getCapacity,
  getEventMedia,
  getEventState,
  getRequestedTournament,
  getTournament,
  officialWallpaperSource,
  registrationUrl,
  rosterUrl,
  rosters,
  setDocumentTitle,
  tournaments
} from "../shared/data.js";
import { eventStatusBadge } from "../shared/event-card.js";
import { icon, initializeShell } from "../shared/shell.js";
import { initializeMotion } from "../shared/motion.js";

const root = document.querySelector("#eventDetail");

function prizePodium(tournament) {
  const prizes = Array.isArray(tournament.prizeBreakdown) ? tournament.prizeBreakdown : [];
  return prizes.map((prize, index) => `
    <article class="prize-place prize-place--${index + 1}" data-reveal>
      <span>${escapeHtml(prize.place)}</span>
      ${icon(index === 0 ? "crown" : "trophy", "prize-place__icon")}
      <strong>${escapeHtml(formatCurrency(prize.amount))}</strong>
    </article>`).join("");
}

function renderNotFound() {
  setDocumentTitle("Tournament not found");
  root.innerHTML = `
    <section class="not-found shell">
      <span class="not-found__code">404</span>
      <p class="kicker">Signal lost</p>
      <h1>Match not found</h1>
      <p>The event code may be outdated or the lobby has moved.</p>
      <a class="button button--primary" href="tournaments.html">Return to match board ${icon("arrow")}</a>
    </section>`;
}

function renderTournament(tournament) {
  setDocumentTitle(tournament.name);
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const roster = rosters[tournament.id] || { published: false, entries: [] };
  const rosterCount = Array.isArray(roster.entries) ? roster.entries.length : 0;
  const registerAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Enter lobby ${icon("arrow")}</a>`
    : `<span class="button button--disabled button--large" aria-disabled="true">${escapeHtml(state.label)}</span>`;

  root.innerHTML = `
    <section class="event-hero event-hero--combat">
      <div class="event-hero__mesh" aria-hidden="true"></div>
      <div class="shell">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="tournaments.html">Match board</a><span aria-hidden="true">/</span><span>${escapeHtml(tournament.shortCode)}</span></nav>
        <div class="event-hero__layout">
          <div class="event-hero__copy" data-reveal>
            <div class="inline-badges">${eventStatusBadge(tournament)}${config.demoMode ? '<span class="demo-chip">Demo match</span>' : ""}</div>
            <p class="kicker">${escapeHtml(tournament.stage)} // ${escapeHtml(tournament.server)} server</p>
            <h1>${escapeHtml(tournament.name)}</h1>
            <p>${escapeHtml(tournament.description)}</p>
            <div class="button-row">${registerAction}<a class="button button--quiet button--large" href="${rosterUrl(tournament)}">Squad roster</a></div>
          </div>
          <figure class="event-poster" data-reveal data-parallax>
            <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
            <span class="event-poster__shade" aria-hidden="true"></span>
            <span class="event-poster__scan" aria-hidden="true"></span>
            <span class="event-poster__code" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
            <figcaption><span>${escapeHtml(tournament.shortCode)}</span><strong>${escapeHtml(tournament.formatLabel)}</strong><a href="${officialWallpaperSource}" target="_blank" rel="noopener noreferrer">Official art · Garena</a></figcaption>
          </figure>
        </div>
        <dl class="event-fact-bar" data-reveal>
          <div><dt>Battle starts</dt><dd><time datetime="${escapeHtml(tournament.matchAt)}">${escapeHtml(formatDateTime(tournament.matchAt))}</time></dd></div>
          <div><dt>Entry</dt><dd>${escapeHtml(formatCurrency(tournament.entryFee))}</dd></div>
          <div><dt>Bounty</dt><dd>${escapeHtml(formatCurrency(tournament.prizePool))}</dd></div>
          <div><dt>Combat format</dt><dd>${escapeHtml(tournament.rounds)}</dd></div>
          <div><dt>Open slots</dt><dd>${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}</dd></div>
        </dl>
      </div>
    </section>

    <nav class="event-local-nav" aria-label="Match intel sections">
      <div class="shell"><a href="#overview">Mission brief</a><a href="#prizes">Bounty</a><a href="#schedule">Battle clock</a><a href="#ruleset">Ruleset</a></div>
    </nav>

    <section class="section" id="overview">
      <div class="shell event-overview">
        <div data-reveal>
          <p class="kicker">Mission brief</p>
          <h2>Know the fight before you drop.</h2>
          <p class="section-lead">Check the live event state before sending player or payment information.</p>
        </div>
        <div class="event-status-panel" data-reveal data-spotlight>
          <div class="event-status-panel__top"><div>${eventStatusBadge(tournament)}<h3>Current objective</h3></div><span class="event-status-panel__index">01</span></div>
          <p>${state.open ? `Deploy a complete lineup before ${escapeHtml(formatDateTime(tournament.registrationClosesAt))}. Your message does not reserve a slot.` : `Registration is not open. You can still inspect the match and published roster.`}</p>
          <div class="capacity-block">
            <div><span>Lobby occupancy</span><strong>${capacity.filled} held · ${capacity.spotsLeft} open</strong></div>
            <div class="capacity-meter capacity-meter--large"><span style="width:${capacity.percent}%"></span></div>
          </div>
          <ul class="mini-checks"><li>${icon("check")} Organizer verifies incoming payment</li><li>${icon("check")} Written reply locks the slot</li><li>${icon("lock")} Room code stays private</li></ul>
        </div>
        <div class="event-info-grid">
          <article data-reveal><span class="info-icon">${icon("gamepad")}</span><small>Combat mode</small><strong>${escapeHtml(tournament.mode)}</strong><p>${escapeHtml(tournament.platform)} · ${escapeHtml(tournament.server)} server</p></article>
          <article data-reveal><span class="info-icon">${icon("team")}</span><small>Unit size</small><strong>${tournament.type === "solo" ? "1 lone fighter" : "4-player fireteam"}</strong><p>${tournament.type === "solo" ? "Individual entry and check-in" : "Captain handles squad check-in"}</p></article>
          <article data-reveal><span class="info-icon">${icon("shield")}</span><small>Confirmed roster</small><strong>${roster.published ? `${rosterCount} ${capacity.unit}` : "Classified"}</strong><p>Publishes about ${config.rosterLeadHours} hours before battle</p></article>
        </div>
      </div>
    </section>

    <section class="section section--surface" id="prizes">
      <div class="shell">
        <div class="section-heading section-heading--split" data-reveal><div><p class="kicker">Bounty split</p><h2>Take the podium.</h2></div><p>Sample amounts stay marked in demo mode. Final rewards must be confirmed before entry payment opens.</p></div>
        <div class="prize-podium">${prizePodium(tournament)}</div>
      </div>
    </section>

    <section class="section" id="schedule">
      <div class="shell detail-columns">
        <div data-reveal><p class="kicker">Battle clock</p><h2>Three critical checkpoints.</h2><p class="section-lead">All times use ${escapeHtml(config.timezoneLabel)}. WhatsApp can clarify logistics but cannot quietly change fees or prizes.</p></div>
        <ol class="timeline" data-reveal>
          <li><span>01</span><div><small>Entry closes</small><strong>${escapeHtml(formatDateTime(tournament.registrationClosesAt, "long"))}</strong><p>Deploy the complete lineup before this time.</p></div></li>
          <li><span>02</span><div><small>Check-in</small><strong>${escapeHtml(formatDateTime(tournament.checkInAt, "long"))}</strong><p>Report ready in the existing organizer chat.</p></div></li>
          <li><span>03</span><div><small>Drop time</small><strong>${escapeHtml(formatDateTime(tournament.matchAt, "long"))}</strong><p>Occupy the assigned slot before launch.</p></div></li>
        </ol>
      </div>
    </section>

    <section class="section section--surface" id="ruleset">
      <div class="shell detail-columns">
        <div data-reveal><p class="kicker">Combat rules</p><h2>Win clean or don't win.</h2><p class="section-lead">The complete rules page controls scoring, check-in, disputes, and refunds.</p><a class="button button--quiet" href="rules.html">Open full ruleset ${icon("arrow")}</a></div>
        <div><div class="rule-chip-grid">${(tournament.ruleHighlights || []).map((rule, index) => `<article data-reveal><span>0${index + 1}</span><strong>${escapeHtml(rule)}</strong></article>`).join("")}</div><div class="map-list" data-reveal><span>Battlefields</span>${(tournament.maps || [tournament.map]).map((map) => `<strong>${escapeHtml(map)}</strong>`).join("")}</div></div>
      </div>
    </section>

    <section class="event-final-cta section"><div class="shell event-final-cta__inner" data-reveal><div><p class="kicker">${escapeHtml(tournament.shortCode)} // READY</p><h2>${state.open ? "Deploy your lineup." : "Track the next battle."}</h2></div>${registerAction}</div></section>`;

  initializeMotion(root);
}

initializeShell();
const queryId = new URLSearchParams(window.location.search).get("tournament");
const tournament = queryId ? getTournament(queryId) : getRequestedTournament() || tournaments.find((item) => item.featured) || tournaments[0];
if (queryId && !tournament) renderNotFound();
else if (tournament) renderTournament(tournament);
else renderNotFound();
