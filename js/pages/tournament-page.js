import {
  escapeHtml,
  eventMark,
  formatCurrency,
  formatDateTime,
  formatReward,
  getCapacity,
  getEventMedia,
  getEventState,
  getRequestedTournament,
  getTournament,
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

function rewardCards(tournament) {
  if (tournament.comingSoon) {
    return '<div class="coming-soon-panel"><span aria-hidden="true">⌁</span><h3>Reward terms are coming soon</h3><p>No entry payment will be accepted until the schedule, fee, and rewards are published here.</p></div>';
  }
  const rewards = Array.isArray(tournament.prizeBreakdown) ? tournament.prizeBreakdown : [];
  return rewards.map((reward, index) => {
    const isBooyah = /booyah/i.test(reward.place);
    return `<article class="prize-place prize-place--${index + 1} ${isBooyah ? "prize-place--booyah" : ""}" data-reveal><span>${escapeHtml(reward.place)}</span>${icon(isBooyah ? "crown" : "trophy", "prize-place__icon")}<strong>${escapeHtml(formatCurrency(reward.amount))}</strong>${reward.variable ? "<small>Paid for every verified elimination</small>" : "<small>Added to any kill rewards</small>"}</article>`;
  }).join("");
}

function scheduleContent(tournament) {
  if (tournament.comingSoon) {
    return '<div class="coming-soon-panel"><span aria-hidden="true">⌁</span><h3>Schedule not announced</h3><p>Registration remains disabled. Match details will appear here before entries open.</p></div>';
  }
  if (tournament.alwaysOpen) {
    return '<ol class="timeline" data-reveal><li><span>01</span><div><small>Register anytime</small><strong>No closing time</strong><p>Complete the Solo entry whenever registration is available.</p></div></li><li><span>02</span><div><small>Join the match group</small><strong>Group opens after registration</strong><p>Paste the copied in-game name, UID, and reference.</p></div></li><li><span>03</span><div><small>Receive lobby details</small><strong>Announcement in WhatsApp</strong><p>The organizer shares the lobby and check-in instructions in the group.</p></div></li></ol>';
  }
  return `<ol class="timeline" data-reveal><li><span>01</span><div><small>Registration closes</small><strong>${escapeHtml(formatDateTime(tournament.registrationClosesAt, "long"))}</strong><p>Send the complete entry before this time.</p></div></li><li><span>02</span><div><small>Check-in</small><strong>${escapeHtml(formatDateTime(tournament.checkInAt, "long"))}</strong><p>Report ready in the organizer chat.</p></div></li><li><span>03</span><div><small>Match starts</small><strong>${escapeHtml(formatDateTime(tournament.matchAt, "long"))}</strong><p>Be in the assigned slot before launch.</p></div></li></ol>`;
}

function renderNotFound(hasConfiguredEvents = true) {
  setDocumentTitle(hasConfiguredEvents ? "Tournament not found" : "No tournaments configured");
  root.innerHTML = `<section class="not-found shell"><span class="not-found__code">${hasConfiguredEvents ? "404" : "00"}</span><p class="kicker">${hasConfiguredEvents ? "Match unavailable" : "Schedule empty"}</p><h1>${hasConfiguredEvents ? "Match not found" : "No tournaments configured"}</h1><p>${hasConfiguredEvents ? "The event code may be outdated or the match was removed." : "Publish a tournament before opening this page."}</p><a class="button button--primary" href="tournaments.html">Open match board ${icon("arrow")}</a></section>`;
}

function renderTournament(tournament) {
  setDocumentTitle(tournament.name);
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const roster = rosters[tournament.id] || { published: false, entries: [] };
  const rosterCount = Array.isArray(roster.entries) ? roster.entries.length : 0;
  const comingSoon = tournament.comingSoon === true;
  const alwaysOpen = tournament.alwaysOpen === true;
  const rosterLabel = tournament.type === "solo" ? "Player roster" : "Squad roster";
  const primaryAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(tournament.entryFee))} ${icon("arrow")}</a>`
    : `<span class="button button--disabled button--large" aria-disabled="true">Coming soon</span>`;
  const secondaryAction = comingSoon
    ? '<a class="button button--quiet button--large" href="tournaments.html">Match board</a>'
    : `<a class="button button--quiet button--large" href="${rosterUrl(tournament)}">${rosterLabel}</a>`;
  const registrationLabel = comingSoon ? "Schedule" : alwaysOpen ? "Registration" : "Starts";
  const registrationValue = comingSoon ? "Pending" : alwaysOpen ? "Always open" : formatDateTime(tournament.matchAt);
  const capacityValue = comingSoon ? `${capacity.capacity} ${capacity.unit} planned` : `${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}`;

  root.innerHTML = `
    <section class="event-hero ${comingSoon ? "event-hero--coming-soon" : ""}">
      <div class="shell">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="tournaments.html">Match board</a><span aria-hidden="true">/</span><span>${escapeHtml(tournament.shortCode)}</span></nav>
        <div class="event-hero__layout">
          <div class="event-hero__copy" data-reveal><div class="inline-badges">${eventStatusBadge(tournament)}</div><p class="kicker">${escapeHtml(tournament.stage)} · ${escapeHtml(tournament.server)}</p><h1>${escapeHtml(tournament.name)}</h1><p>${escapeHtml(tournament.description)}</p><div class="button-row">${primaryAction}${secondaryAction}</div></div>
          <figure class="event-poster" data-reveal data-parallax><img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" fetchpriority="high" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}"><span class="event-poster__shade" aria-hidden="true"></span><span class="event-poster__scan" aria-hidden="true"></span><span class="event-poster__glitch" aria-hidden="true"></span><span class="event-poster__code" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span><figcaption><span>${escapeHtml(tournament.shortCode)}</span><strong>${escapeHtml(tournament.formatLabel)}</strong></figcaption></figure>
        </div>
        <dl class="event-fact-bar" data-reveal><div><dt>${registrationLabel}</dt><dd>${escapeHtml(registrationValue)}</dd></div><div><dt>Entry</dt><dd>${escapeHtml(formatCurrency(tournament.entryFee))}</dd></div><div><dt>Reward</dt><dd>${escapeHtml(formatReward(tournament))}</dd></div><div><dt>Format</dt><dd>${escapeHtml(tournament.rounds)}</dd></div><div><dt>${comingSoon ? "Capacity" : "Open"}</dt><dd>${escapeHtml(capacityValue)}</dd></div></dl>
      </div>
    </section>
    <nav class="event-local-nav" aria-label="Tournament sections"><div class="shell"><a href="#overview">Overview</a><a href="#prizes">Rewards</a><a href="#schedule">How to join</a><a href="#ruleset">Rules</a></div></nav>
    <section class="section" id="overview"><div class="shell event-overview"><div data-reveal><p class="kicker">Current status</p><h2>${comingSoon ? "This format is preparing." : "Know the match before joining."}</h2><p class="section-lead">${comingSoon ? "No registration or payment is available for this event yet." : "Registration has no closing time. Check the payout and join whenever you are ready."}</p></div><div class="event-status-panel" data-reveal><div class="event-status-panel__top"><div>${eventStatusBadge(tournament)}<h3>${state.open ? "Solo registration open" : state.label}</h3></div><span class="event-status-panel__index">01</span></div><p>${state.open ? `Registration is always open. Each verified kill pays ${escapeHtml(formatCurrency(tournament.killReward))}, and Booyah adds ${escapeHtml(formatCurrency(tournament.booyahBonus))}.` : escapeHtml(state.reason)}</p>${comingSoon ? "" : `<div class="capacity-block"><div><span>Lobby occupancy</span><strong>${capacity.filled} filled · ${capacity.spotsLeft} open</strong></div><progress class="capacity-meter capacity-meter--large" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress></div>`}<ul class="mini-checks"><li>${icon("check")} Organizer verifies ${comingSoon ? "all published terms" : "kills and Booyah"}</li><li>${icon("check")} Written reply confirms the slot</li><li>${icon("lock")} Room credentials stay private</li></ul></div><div class="event-info-grid"><article data-reveal><span class="info-icon">${icon("gamepad")}</span><small>Mode</small><strong>${escapeHtml(tournament.mode)}</strong><p>${escapeHtml(tournament.platform)} · ${escapeHtml(tournament.server)}</p></article><article data-reveal><span class="info-icon">${icon("team")}</span><small>Entry unit</small><strong>${tournament.type === "solo" ? "1 player" : "4 players"}</strong><p>${comingSoon ? "Registration not open" : "Join anytime"}</p></article><article data-reveal><span class="info-icon">${icon("shield")}</span><small>Roster</small><strong>${comingSoon ? "Not open" : roster.published ? `${rosterCount} ${capacity.unit}` : "Not published"}</strong><p>${comingSoon ? "Available after registration opens" : `Published after organizer confirmation`}</p></article></div></div></section>
    <section class="section section--surface" id="prizes"><div class="shell"><div class="section-heading section-heading--split" data-reveal><div><p class="kicker">${comingSoon ? "Rewards pending" : "Solo payout"}</p><h2>${comingSoon ? "Coming soon." : "Kills pay. Booyah adds more."}</h2></div><p>${comingSoon ? "No fee or reward amount has been published for this format." : `${formatCurrency(tournament.killReward)} for each organizer-verified elimination, plus an additional ${formatCurrency(tournament.booyahBonus)} for the Booyah winner.`}</p></div><div class="prize-podium prize-podium--rewards">${rewardCards(tournament)}</div></div></section>
    <section class="section" id="schedule"><div class="shell detail-columns"><div data-reveal><p class="kicker">${comingSoon ? "Schedule" : "How to join"}</p><h2>${comingSoon ? "Announcement pending." : "No closing time."}</h2><p class="section-lead">${comingSoon ? "Follow the match board for the announcement." : "Register anytime; lobby details are announced in the WhatsApp group."}</p></div>${scheduleContent(tournament)}</div></section>
    <section class="section section--surface" id="ruleset"><div class="shell detail-columns"><div data-reveal><p class="kicker">Rules</p><h2>${comingSoon ? "Terms publish before entry." : "Every payout is verified."}</h2><p class="section-lead">${comingSoon ? "Coming-soon formats cannot accept payment or registration." : "The organizer verifies eliminations, Booyah, check-in, disputes, and payouts."}</p><a class="button button--quiet" href="rules.html">Read all rules ${icon("arrow")}</a></div><div><div class="rule-chip-grid">${(tournament.ruleHighlights || []).map((rule, index) => `<article data-reveal><span>0${index + 1}</span><strong>${escapeHtml(rule)}</strong></article>`).join("")}</div><div class="map-list" data-reveal><span>Map</span>${(tournament.maps || [tournament.map]).map((map) => `<strong>${escapeHtml(map)}</strong>`).join("")}</div></div></div></section>
    <section class="event-final-cta section"><div class="shell event-final-cta__inner" data-reveal><div><p class="kicker">${escapeHtml(tournament.shortCode)}</p><h2>${state.open ? "Ready for Solo?" : "This match is coming soon."}</h2></div>${state.open ? primaryAction : '<a class="button button--primary button--large" href="tournaments.html">View match board</a>'}</div></section>`;
  initializeMotion(root);
}

initializeShell();
const queryId = new URLSearchParams(window.location.search).get("tournament");
const tournament = queryId ? getTournament(queryId) : getRequestedTournament() || tournaments.find((item) => item.featured) || tournaments[0];
if (queryId && !tournament) renderNotFound(Boolean(tournaments.length));
else if (tournament) renderTournament(tournament);
else renderNotFound(false);
