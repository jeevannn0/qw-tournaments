import {
  escapeHtml,
  eventMark,
  formatCurrency,
  formatDateTime,
  formatLobbySchedule,
  formatReward,
  getCapacity,
  getEventMedia,
  getEventPresentation,
  getEventState,
  getEventTimeSlots,
  getRequestedTournament,
  getTimeSlotState,
  getTournament,
  registrationUrl,
  rosterUrl,
  rosters,
  setDocumentTitle,
  tournaments
} from "../shared/data.js?v=20261011-lifecycle";
import { hydrateTournamentOverrides } from "../shared/tournament-backend.js?v=20261011-lifecycle";
import { eventStatusBadge } from "../shared/event-card.js?v=20261011-lifecycle";
import { getCustomRoomCredentials, isCustomRoomReady, validRegistrationEmail } from "../shared/custom-room-backend.js?v=20261011-lifecycle";
import { icon, initializeShell, showToast } from "../shared/shell.js?v=20261011-lifecycle";
import { initializeMotion } from "../shared/motion.js?v=20261011-lifecycle";

const root = document.querySelector("#eventDetail");
const roomDialog = document.querySelector("#customRoomDialog");
const roomStatus = document.querySelector("#customRoomStatus");
const roomEmailForm = document.querySelector("#customRoomEmailForm");
const roomEmail = document.querySelector("#customRoomEmail");
const roomCheck = document.querySelector("#customRoomCheck");
const roomResult = document.querySelector("#customRoomResult");
const roomId = document.querySelector("#customRoomId");
const roomPassword = document.querySelector("#customRoomPassword");
let activeTournament = null;
let roomRequestGeneration = 0;
let roomReadinessTimer = 0;
let detailRefreshGeneration = 0;

function customRoomButton() {
  return `<button class="button button--quiet button--large" type="button" data-custom-room>Custom Room details ${icon("lock")}</button>`;
}

function clearCustomRoomDialog() {
  roomEmailForm.hidden = true;
  roomResult.hidden = true;
  roomEmail.value = "";
  roomId.textContent = "";
  roomPassword.textContent = "";
  roomStatus.hidden = false;
  roomStatus.innerHTML = "<strong>Checking Room details…</strong>";
}

async function openCustomRoomDialog() {
  if (!activeTournament) return;
  const tournamentId = activeTournament.id;
  const requestGeneration = ++roomRequestGeneration;
  clearCustomRoomDialog();
  if (typeof roomDialog.showModal === "function") roomDialog.showModal();
  else roomDialog.setAttribute("open", "");
  try {
    const ready = await isCustomRoomReady(tournamentId);
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open || activeTournament?.id !== tournamentId) return;
    if (!ready) {
      roomStatus.innerHTML = "<strong>Room details have not been published yet.</strong><p>Please wait for the organizer to add the Room ID and password, then try again.</p>";
      return;
    }
    roomStatus.innerHTML = "<strong>Room details are ready.</strong><p>Enter your registered email to continue.</p>";
    window.clearInterval(roomReadinessTimer);
    roomReadinessTimer = window.setInterval(refreshVisibleRoomReadiness, 5000);
    roomEmailForm.hidden = false;
    roomEmail.focus();
  } catch {
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open) return;
    roomStatus.innerHTML = "<strong>Room details are temporarily unavailable.</strong><p>Please try again shortly.</p>";
  }
}

function closeCustomRoomDialog() {
  roomRequestGeneration += 1;
  window.clearInterval(roomReadinessTimer);
  roomReadinessTimer = 0;
  clearCustomRoomDialog();
  if (typeof roomDialog.close === "function" && roomDialog.open) roomDialog.close();
  else roomDialog.removeAttribute("open");
}

async function submitCustomRoomEmail(event) {
  event.preventDefault();
  if (!activeTournament || !validRegistrationEmail(roomEmail.value)) {
    roomStatus.innerHTML = "<strong>Enter a valid registered email.</strong>";
    roomEmail.focus();
    return;
  }
  const tournamentId = activeTournament.id;
  const requestGeneration = ++roomRequestGeneration;
  roomCheck.disabled = true;
  roomCheck.textContent = "Checking registration…";
  roomId.textContent = "";
  roomPassword.textContent = "";
  roomResult.hidden = true;
  try {
    const credentials = await getCustomRoomCredentials(tournamentId, roomEmail.value);
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open || activeTournament?.id !== tournamentId) return;
    if (!credentials) {
      roomStatus.innerHTML = "<strong>No confirmed registration found for this email.</strong><p>Use the exact email entered for this match, or wait until the organizer confirms your registration.</p>";
      return;
    }
    roomStatus.innerHTML = "<strong>Confirmed registration matched.</strong>";
    roomId.textContent = credentials.roomId;
    roomPassword.textContent = credentials.roomPassword;
    roomResult.hidden = false;
  } catch {
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open) return;
    roomStatus.innerHTML = "<strong>Room access could not be checked.</strong><p>Please try again shortly.</p>";
  } finally {
    if (requestGeneration === roomRequestGeneration) {
      roomCheck.disabled = false;
      roomCheck.textContent = "Show Room ID and password";
    }
  }
}

async function refreshVisibleRoomReadiness() {
  if (!roomDialog.open || !activeTournament) return;
  const tournamentId = activeTournament.id;
  const requestGeneration = ++roomRequestGeneration;
  try {
    const ready = await isCustomRoomReady(tournamentId);
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open || activeTournament?.id !== tournamentId) return;
    if (!ready) {
      window.clearInterval(roomReadinessTimer);
      roomReadinessTimer = 0;
      roomId.textContent = "";
      roomPassword.textContent = "";
      roomResult.hidden = true;
      roomStatus.innerHTML = "<strong>Room details are no longer available.</strong><p>The organizer may be updating the lobby. Check again shortly.</p>";
    }
  } catch {
    if (requestGeneration === roomRequestGeneration) {
      roomId.textContent = "";
      roomPassword.textContent = "";
      roomResult.hidden = true;
    }
  }
}

async function copyRoomValue(element, label) {
  if (!element?.textContent || !activeTournament || !roomDialog.open) return;
  const tournamentId = activeTournament.id;
  const requestGeneration = ++roomRequestGeneration;
  try {
    const ready = await isCustomRoomReady(tournamentId);
    if (requestGeneration !== roomRequestGeneration || !roomDialog.open || activeTournament?.id !== tournamentId) return;
    if (!ready) {
      window.clearInterval(roomReadinessTimer);
      roomReadinessTimer = 0;
      roomId.textContent = "";
      roomPassword.textContent = "";
      roomResult.hidden = true;
      roomStatus.innerHTML = "<strong>Room details are no longer available.</strong><p>The organizer may be updating the lobby. Check again shortly.</p>";
      return;
    }
    const value = element.textContent;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied.`);
  } catch {
    showToast(`Copy unavailable. Reopen the Room details and try again.`);
  }
}

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
  const timeSlots = getEventTimeSlots(tournament);
  if (timeSlots.length) {
    return `<ol class="timeline" data-reveal>${timeSlots.map((timeSlot, index) => {
      const timeSlotState = getTimeSlotState(tournament, timeSlot);
      const instruction = timeSlotState.key === "complete"
        ? "This lobby has finished accepting players. View the confirmed roster or Booyah results."
        : "Choose this 50-player lobby during registration and use the player number assigned by the organizer.";
      return `<li><span>0${index + 1}</span><div><small>${escapeHtml(timeSlot.label)} · ${escapeHtml(timeSlotState.label)}</small><strong>${escapeHtml(formatDateTime(timeSlot.startsAt, "long"))}</strong><p>${escapeHtml(instruction)}</p></div></li>`;
    }).join("")}</ol>`;
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

function renderAnnouncementTournament(tournament, presentation) {
  setDocumentTitle(tournament.name);
  const media = getEventMedia(tournament);
  const secondaryHref = tournament.type === "solo" ? rosterUrl(tournament) : "tournaments.html";
  const secondaryLabel = tournament.type === "solo" ? "Player roster" : "Match board";
  const registrationOpen = presentation.state.open;
  const primaryAction = registrationOpen
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(presentation.entry)} ${icon("arrow")}</a>`
    : '<span class="button button--disabled button--large" aria-disabled="true">Registration closed</span>';
  const lifecycleCopy = presentation.mode === "registration_open"
    ? `Registration is open for one ${tournament.type === "solo" ? "player" : "four-player squad"} lobby. At match time the card changes to Completed for three hours.`
    : presentation.mode === "scheduled"
      ? "This match is announced and registration remains closed. At match time the card changes to Completed for three hours."
      : presentation.mode === "completed"
        ? "The announced match has completed. This card will return to Coming soon three hours after match time."
        : "Unpublished schedule, entry, and reward terms stay hidden until the organizer schedules the next match.";
  root.innerHTML = `
    <section class="event-hero event-hero--announcement event-hero--${escapeHtml(presentation.mode)}">
      <div class="shell"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="tournaments.html">Match board</a><span aria-hidden="true">/</span><span>${escapeHtml(tournament.shortCode)}</span></nav>
        <div class="event-hero__layout">
          <div class="event-hero__copy" data-reveal><div class="inline-badges">${eventStatusBadge(tournament, presentation.state)}</div><p class="kicker">Match announcement · ${escapeHtml(tournament.server)}</p><h1>${escapeHtml(tournament.name)}</h1><p>${escapeHtml(tournament.description)}</p><div class="button-row">${primaryAction}<a class="button button--quiet button--large" href="${secondaryHref}">${secondaryLabel}</a>${customRoomButton()}</div></div>
          <figure class="event-poster" data-reveal><img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" fetchpriority="high" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}"><span class="event-poster__shade" aria-hidden="true"></span><span class="event-poster__scan" aria-hidden="true"></span><span class="event-poster__code" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span><figcaption><span>${escapeHtml(presentation.state.label)}</span><strong>${escapeHtml(tournament.formatLabel)}</strong></figcaption></figure>
        </div>
        <dl class="event-fact-bar" data-reveal><div><dt>Schedule</dt><dd>${escapeHtml(presentation.schedule)}</dd></div><div><dt>Entry</dt><dd>${escapeHtml(presentation.entry)}</dd></div><div><dt>Reward</dt><dd>${escapeHtml(presentation.reward)}</dd></div><div><dt>Format</dt><dd>${escapeHtml(tournament.rounds)}</dd></div><div><dt>Capacity</dt><dd>${escapeHtml(presentation.capacityLabel)}</dd></div></dl>
      </div>
    </section>
    <nav class="event-local-nav" aria-label="Tournament sections"><div class="shell"><a href="#overview">Overview</a><a href="#match-facts">Match facts</a><a href="#ruleset">Safety</a></div></nav>
    <section class="section" id="overview"><div class="shell detail-columns"><div data-reveal><p class="kicker">${escapeHtml(presentation.state.label)}</p><h2>${presentation.comingSoon ? "The next match is preparing." : "Match details are published."}</h2><p class="section-lead">${escapeHtml(lifecycleCopy)}</p></div><div class="event-status-panel" data-reveal><div class="event-status-panel__top"><div>${eventStatusBadge(tournament, presentation.state)}<h3>${registrationOpen ? "Registration and payment open" : "Announcement only"}</h3></div><span class="event-status-panel__index">01</span></div><p>${registrationOpen ? `The published schedule, fee, reward, and ${tournament.type === "solo" ? "player" : "team"} capacity are enforced by the registration service.` : "Registration and payment remain closed for this state. Historical lobbies, rosters, payments, and results stay unchanged."}</p><ul class="mini-checks"><li>${icon("check")} Organizer-published match facts</li><li>${icon(registrationOpen ? "check" : "lock")} ${registrationOpen ? "Server-validated registration" : "Registration remains closed"}</li><li>${icon("lock")} Room credentials stay private</li></ul></div></div></section>
    <section class="section section--surface" id="match-facts"><div class="shell"><div class="section-heading" data-reveal><p class="kicker">Public facts</p><h2>${escapeHtml(presentation.state.label)}.</h2></div><dl class="event-fact-bar" data-reveal><div><dt>Schedule</dt><dd>${escapeHtml(presentation.schedule)}</dd></div><div><dt>Entry</dt><dd>${escapeHtml(presentation.entry)}</dd></div><div><dt>Reward</dt><dd>${escapeHtml(presentation.reward)}</dd></div><div><dt>Map</dt><dd>${escapeHtml(tournament.map)}</dd></div><div><dt>Capacity</dt><dd>${escapeHtml(presentation.capacityLabel)}</dd></div></dl></div></section>
    <section class="section" id="ruleset"><div class="shell detail-columns"><div data-reveal><p class="kicker">Registration safety</p><h2>${registrationOpen ? "Submit the complete entry." : "Wait for registration to open."}</h2><p class="section-lead">${registrationOpen ? "Pay only the displayed fee through the registration page. The organizer verifies the incoming payment before assigning a number." : "Do not send payment until this page explicitly shows Registration open and provides the registration action."}</p></div><div class="coming-soon-panel" data-reveal><span aria-hidden="true">⌁</span><h3>${registrationOpen ? "Registration open" : "Registration closed"}</h3><p>${registrationOpen ? "Complete the lineup and private payment proof before the match begins." : "This state has no registration or payment action."}</p><a class="button button--quiet" href="rules.html">Read all rules ${icon("arrow")}</a></div></div></section>
    <section class="event-final-cta section"><div class="shell event-final-cta__inner" data-reveal><div><p class="kicker">${escapeHtml(tournament.shortCode)}</p><h2>${escapeHtml(presentation.state.label)}</h2></div>${registrationOpen ? primaryAction : `<a class="button button--primary button--large" href="${secondaryHref}">${secondaryLabel}</a>`}</div></section>`;
  initializeMotion(root);
}

function renderTournament(tournament) {
  const presentation = getEventPresentation(tournament);
  if (presentation.hasOverride) {
    renderAnnouncementTournament(tournament, presentation);
    return;
  }
  setDocumentTitle(tournament.name);
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const roster = rosters[tournament.id] || { published: false, entries: [] };
  const rosterCount = Array.isArray(roster.entries) ? roster.entries.length : 0;
  const comingSoon = tournament.comingSoon === true;
  const timeSlots = getEventTimeSlots(tournament);
  const alwaysOpen = tournament.alwaysOpen === true;
  const rosterLabel = tournament.type === "solo" ? "Player roster" : "Squad roster";
  const primaryAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(tournament.entryFee))} ${icon("arrow")}</a>`
    : `<span class="button button--disabled button--large" aria-disabled="true">${escapeHtml(state.label)}</span>`;
  const secondaryAction = comingSoon
    ? '<a class="button button--quiet button--large" href="tournaments.html">Match board</a>'
    : `<a class="button button--quiet button--large" href="${rosterUrl(tournament)}">${rosterLabel}</a>`;
  const registrationLabel = comingSoon ? "Schedule" : timeSlots.length ? "Lobbies" : alwaysOpen ? "Registration" : "Starts";
  const registrationValue = comingSoon ? "Pending" : timeSlots.length ? formatLobbySchedule(tournament) : alwaysOpen ? "Always open" : formatDateTime(tournament.matchAt);
  const capacityValue = comingSoon ? `${capacity.capacity} ${capacity.unit} planned` : timeSlots.length ? "50 players per lobby" : `${capacity.spotsLeft}/${capacity.capacity} ${capacity.unit}`;

  root.innerHTML = `
    <section class="event-hero ${comingSoon ? "event-hero--coming-soon" : ""}">
      <div class="shell">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="tournaments.html">Match board</a><span aria-hidden="true">/</span><span>${escapeHtml(tournament.shortCode)}</span></nav>
        <div class="event-hero__layout">
          <div class="event-hero__copy" data-reveal><div class="inline-badges">${eventStatusBadge(tournament)}</div><p class="kicker">${escapeHtml(tournament.stage)} · ${escapeHtml(tournament.server)}</p><h1>${escapeHtml(tournament.name)}</h1><p>${escapeHtml(tournament.description)}</p><div class="button-row">${primaryAction}${secondaryAction}${customRoomButton()}</div></div>
          <figure class="event-poster" data-reveal data-parallax><img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" fetchpriority="high" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}"><span class="event-poster__shade" aria-hidden="true"></span><span class="event-poster__scan" aria-hidden="true"></span><span class="event-poster__glitch" aria-hidden="true"></span><span class="event-poster__code" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span><figcaption><span>${escapeHtml(tournament.shortCode)}</span><strong>${escapeHtml(tournament.formatLabel)}</strong></figcaption></figure>
        </div>
        <dl class="event-fact-bar" data-reveal><div><dt>${registrationLabel}</dt><dd>${escapeHtml(registrationValue)}</dd></div><div><dt>Entry</dt><dd>${escapeHtml(formatCurrency(tournament.entryFee))}</dd></div><div><dt>Reward</dt><dd>${escapeHtml(formatReward(tournament))}</dd></div><div><dt>Format</dt><dd>${escapeHtml(tournament.rounds)}</dd></div><div><dt>${comingSoon ? "Capacity" : "Open"}</dt><dd>${escapeHtml(capacityValue)}</dd></div></dl>
      </div>
    </section>
    <nav class="event-local-nav" aria-label="Tournament sections"><div class="shell"><a href="#overview">Overview</a><a href="#prizes">Rewards</a><a href="#schedule">How to join</a><a href="#ruleset">Rules</a></div></nav>
    <section class="section" id="overview"><div class="shell event-overview"><div data-reveal><p class="kicker">Current status</p><h2>${comingSoon ? "This format is preparing." : "Know the match before joining."}</h2><p class="section-lead">${comingSoon ? "No registration or payment is available for this event yet." : timeSlots.length ? "Choose the 7:30 PM or 9:00 PM IST lobby. Each lobby holds 50 players." : "Check the payout and availability before joining."}</p></div><div class="event-status-panel" data-reveal><div class="event-status-panel__top"><div>${eventStatusBadge(tournament)}<h3>${state.open ? "Solo registration open" : state.label}</h3></div><span class="event-status-panel__index">01</span></div><p>${state.open ? timeSlots.length ? `Choose one of the two 50-player lobbies. Each verified kill pays ${escapeHtml(formatCurrency(tournament.killReward))}, and Booyah adds ${escapeHtml(formatCurrency(tournament.booyahBonus))}.` : `Registration is open. Each verified kill pays ${escapeHtml(formatCurrency(tournament.killReward))}, and Booyah adds ${escapeHtml(formatCurrency(tournament.booyahBonus))}.` : escapeHtml(state.reason)}</p>${comingSoon ? "" : `<div class="capacity-block"><div><span>${timeSlots.length ? "Lobby capacity" : "Lobby occupancy"}</span><strong>${timeSlots.length ? "50 players in each of 2 lobbies" : `${capacity.filled} filled · ${capacity.spotsLeft} open`}</strong></div><progress class="capacity-meter capacity-meter--large" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress></div>`}<ul class="mini-checks"><li>${icon("check")} Organizer verifies ${comingSoon ? "all published terms" : "kills and Booyah"}</li><li>${icon("check")} Written reply confirms the slot</li><li>${icon("lock")} Room credentials stay private</li></ul></div><div class="event-info-grid"><article data-reveal><span class="info-icon">${icon("gamepad")}</span><small>Mode</small><strong>${escapeHtml(tournament.mode)}</strong><p>${escapeHtml(tournament.platform)} · ${escapeHtml(tournament.server)}</p></article><article data-reveal><span class="info-icon">${icon("team")}</span><small>Entry unit</small><strong>${tournament.type === "solo" ? "1 player" : "4 players"}</strong><p>${comingSoon ? "Registration not open" : timeSlots.length ? "Choose one lobby time" : "Registration open"}</p></article><article data-reveal><span class="info-icon">${icon("shield")}</span><small>Roster</small><strong>${comingSoon ? "Not open" : roster.published ? `${rosterCount} ${capacity.unit}` : "Not published"}</strong><p>${comingSoon ? "Available after registration opens" : `Published after organizer confirmation`}</p></article></div></div></section>
    <section class="section section--surface" id="prizes"><div class="shell"><div class="section-heading section-heading--split" data-reveal><div><p class="kicker">${comingSoon ? "Rewards pending" : "Solo payout"}</p><h2>${comingSoon ? "Coming soon." : "Kills pay. Booyah adds more."}</h2></div><p>${comingSoon ? "No fee or reward amount has been published for this format." : `${formatCurrency(tournament.killReward)} for each organizer-verified elimination, plus an additional ${formatCurrency(tournament.booyahBonus)} for the Booyah winner.`}</p></div><div class="prize-podium prize-podium--rewards">${rewardCards(tournament)}</div></div></section>
    <section class="section" id="schedule"><div class="shell detail-columns"><div data-reveal><p class="kicker">${comingSoon ? "Schedule" : "How to join"}</p><h2>${comingSoon ? "Announcement pending." : timeSlots.length ? "Two times. One required choice." : "Follow the published schedule."}</h2><p class="section-lead">${comingSoon ? "Follow the match board for the announcement." : timeSlots.length ? "Select 7:30 PM or 9:00 PM IST during registration. Each lobby holds 50 players." : "Complete registration before the published deadline."}</p></div>${scheduleContent(tournament)}</div></section>
    <section class="section section--surface" id="ruleset"><div class="shell detail-columns"><div data-reveal><p class="kicker">Rules</p><h2>${comingSoon ? "Terms publish before entry." : "Every payout is verified."}</h2><p class="section-lead">${comingSoon ? "Coming-soon formats cannot accept payment or registration." : "The organizer verifies eliminations, Booyah, check-in, disputes, and payouts."}</p><a class="button button--quiet" href="rules.html">Read all rules ${icon("arrow")}</a></div><div><div class="rule-chip-grid">${(tournament.ruleHighlights || []).map((rule, index) => `<article data-reveal><span>0${index + 1}</span><strong>${escapeHtml(rule)}</strong></article>`).join("")}</div><div class="map-list" data-reveal><span>Map</span>${(tournament.maps || [tournament.map]).map((map) => `<strong>${escapeHtml(map)}</strong>`).join("")}</div></div></div></section>
    <section class="event-final-cta section"><div class="shell event-final-cta__inner" data-reveal><div><p class="kicker">${escapeHtml(tournament.shortCode)}</p><h2>${state.open ? "Choose your Solo lobby." : escapeHtml(state.label)}</h2></div>${state.open ? primaryAction : '<a class="button button--primary button--large" href="tournaments.html">View match board</a>'}</div></section>`;
  initializeMotion(root);
}

let presentationRefreshTimer;
function schedulePresentationRefresh(tournament) {
  window.clearTimeout(presentationRefreshTimer);
  const rolloverAt = getEventPresentation(tournament).rolloverAt;
  if (!Number.isFinite(rolloverAt) || rolloverAt <= Date.now()) return;
  presentationRefreshTimer = window.setTimeout(() => {
    renderTournament(tournament);
    schedulePresentationRefresh(tournament);
  }, Math.max(100, Math.min(rolloverAt - Date.now() + 100, 2_147_483_647)));
}

async function refreshTournamentPresentation({ force = false } = {}) {
  const refreshGeneration = ++detailRefreshGeneration;
  await hydrateTournamentOverrides({ force });
  if (refreshGeneration !== detailRefreshGeneration) return;
  const queryId = new URLSearchParams(window.location.search).get("tournament");
  const tournament = queryId ? getTournament(queryId) : getRequestedTournament() || tournaments.find((item) => item.featured) || tournaments[0];
  activeTournament = tournament || null;
  if (queryId && !tournament) renderNotFound(Boolean(tournaments.length));
  else if (tournament) {
    renderTournament(tournament);
    schedulePresentationRefresh(tournament);
  } else renderNotFound(false);
}

async function initializeTournament() {
  initializeShell();
  await refreshTournamentPresentation();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && roomDialog.open) closeCustomRoomDialog();
    if (document.visibilityState === "visible") {
      refreshTournamentPresentation({ force: true });
      refreshVisibleRoomReadiness();
    }
  });
  window.addEventListener("pageshow", () => refreshTournamentPresentation({ force: true }));
}

root.addEventListener("click", (event) => {
  if (event.target.closest("[data-custom-room]")) openCustomRoomDialog();
});
document.querySelector("#customRoomClose").addEventListener("click", closeCustomRoomDialog);
roomDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeCustomRoomDialog(); });
roomDialog.addEventListener("click", (event) => { if (event.target === roomDialog) closeCustomRoomDialog(); });
roomEmailForm.addEventListener("submit", submitCustomRoomEmail);
document.querySelector("#copyCustomRoomId").addEventListener("click", () => copyRoomValue(roomId, "Room ID"));
document.querySelector("#copyCustomRoomPassword").addEventListener("click", () => copyRoomValue(roomPassword, "Password"));

initializeTournament();
