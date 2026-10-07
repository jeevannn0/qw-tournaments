import {
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  formatLobbySchedule,
  getCapacity,
  getEventMedia,
  getEventPresentation,
  getEventState,
  getOpenTimeSlots,
  registrationUrl,
  supportUrl,
  tournaments
} from "../shared/data.js?v=20261011-lifecycle";
import { hydrateTournamentOverrides } from "../shared/tournament-backend.js?v=20261011-lifecycle";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js?v=20261011-lifecycle";
import { eventCard, eventStatusBadge } from "../shared/event-card.js?v=20261011-lifecycle";
import { icon, initializeShell, showToast } from "../shared/shell.js?v=20261011-lifecycle";
import { initializeMotion } from "../shared/motion.js?v=20261011-lifecycle";

function renderFeaturedEvent(tournament) {
  const mount = document.querySelector("#featuredEvent");
  if (!mount || !tournament) return;
  const presentation = getEventPresentation(tournament);
  const state = presentation.state;
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const mainAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(presentation.entryFee))} ${icon("arrow")}</a>`
    : `<a class="button button--quiet button--large" href="${eventUrl(tournament)}">View ${presentation.comingSoon ? "preview" : "details"} ${icon("arrow")}</a>`;
  const announcementFacts = `<dl class="feature-event__facts"><div><dt>Schedule</dt><dd>${escapeHtml(presentation.schedule)}</dd></div><div><dt>Reward</dt><dd>${escapeHtml(presentation.reward)}</dd></div><div><dt>Entry</dt><dd>${escapeHtml(presentation.entry)}</dd></div><div><dt>Capacity</dt><dd>${escapeHtml(presentation.capacityLabel)}</dd></div></dl>`;
  const canonicalFacts = `<div class="reward-strip reward-strip--feature" aria-label="Solo match rewards"><span><strong>${escapeHtml(formatCurrency(tournament.entryFee))}</strong><small>entry</small></span><span><strong>${escapeHtml(formatCurrency(tournament.killReward))}</strong><small>per confirmed kill</small></span><span><strong>${escapeHtml(formatCurrency(tournament.booyahBonus))}</strong><small>Booyah bonus</small></span></div><dl class="feature-event__facts"><div><dt>Lobbies</dt><dd>${escapeHtml(formatLobbySchedule(tournament))}</dd></div><div><dt>Map</dt><dd>${escapeHtml(tournament.map)}</dd></div><div><dt>Capacity</dt><dd>50 players per lobby</dd></div></dl><progress class="capacity-meter capacity-meter--large" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress>`;

  mount.innerHTML = `
    <article class="feature-event ${presentation.hasOverride ? `feature-event--announcement feature-event--${presentation.mode}` : ""}">
      <div class="feature-event__content" data-reveal>
        <div class="inline-badges">${eventStatusBadge(tournament, state)}</div>
        <p class="kicker">${presentation.hasOverride ? "Match announcement" : `Two scheduled Solo lobbies · ${escapeHtml(tournament.shortCode)}`}</p>
        <h2>${escapeHtml(tournament.name)}</h2>
        <p class="feature-event__lead">${escapeHtml(tournament.tagline)}</p>
        ${presentation.hasOverride ? announcementFacts : canonicalFacts}
        <div class="button-row">${mainAction}<a class="button button--quiet button--large" href="${eventUrl(tournament)}">${presentation.hasOverride ? "Announcement details" : "Rules and how to join"}</a></div>
      </div>
      <div class="feature-event__visual" data-reveal>
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" loading="lazy" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="feature-event__shade" aria-hidden="true"></span><span class="feature-event__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <a class="feature-event__hit" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details"></a>
        <span class="feature-event__caption"><small>${escapeHtml(state.label)}</small><strong>${escapeHtml(tournament.formatLabel)}</strong></span>
        <span class="feature-event__scan" aria-hidden="true"></span><span class="feature-event__glitch" aria-hidden="true"></span>
      </div>
    </article>`;
}

function renderEventPreview() {
  const grid = document.querySelector("#homeEventGrid");
  if (!grid) return;
  const ordered = [...tournaments].sort((a, b) => Number(getEventPresentation(b).state.open) - Number(getEventPresentation(a).state.open));
  grid.innerHTML = ordered.length ? ordered.map((tournament, index) => eventCard(tournament, { compact: true, eager: index === 0 })).join("") : '<div class="empty-state"><h2>No matches published</h2><p>The next match will appear here when its schedule is ready.</p></div>';
}

function renderLiveFacts() {
  const tournament = tournaments.find((item) => getEventPresentation(item).state.open)
    || tournaments.find((item) => item.featured)
    || tournaments[0];
  if (!tournament) return;
  const presentation = getEventPresentation(tournament);
  const openTimeSlots = getOpenTimeSlots(tournament);
  const state = getEventState(tournament);
  const heroSchedule = document.querySelector("#homeHeroSchedule");
  const matchStatusCopy = document.querySelector("#homeMatchStatusCopy");
  const heroSignal = document.querySelector("#homeHeroSignal");
  heroSchedule.textContent = presentation.comingSoon
    ? "The next match schedule and terms are pending."
    : `${presentation.schedule} · ${presentation.capacityLabel}.`;
  matchStatusCopy.textContent = state.open
    ? `${tournament.name} registration is open. Choose the lobby and submit the complete entry.`
    : state.key === "complete"
      ? `${tournament.name} is completed. Check the confirmed roster and published results.`
      : `${tournament.name} is ${state.label.toLowerCase()}. ${state.reason || "Registration is closed."}`;
  heroSignal.innerHTML = `<i></i> ${escapeHtml(state.label.toUpperCase())}`;

  const existingAction = document.querySelector("#homeHeroActions .button--primary, #homeHeroActions .button--disabled");
  if (!existingAction) return;
  if (state.open) {
    const registerAction = document.createElement("a");
    registerAction.className = "button button--primary button--large";
    registerAction.href = registrationUrl(tournament);
    registerAction.innerHTML = `Register for ${escapeHtml(presentation.entry)} ${icon("arrow")}`;
    existingAction.replaceWith(registerAction);
  } else {
    const disabledAction = document.createElement("span");
    disabledAction.className = "button button--disabled button--large";
    disabledAction.setAttribute("aria-disabled", "true");
    disabledAction.textContent = state.label;
    existingAction.replaceWith(disabledAction);
  }

  if (state.open && openTimeSlots.length) {
    heroSchedule.textContent = `${openTimeSlots[0].label} · ${presentation.capacityLabel}.`;
  }
}

async function announcePublishedWinner() {
  if (!isSupabaseConfigured()) return;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.from("match_results").select("display_name, time_slot_label, published_at").eq("published", true).order("published_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return;
    showToast(`Latest winner: ${String(data.display_name || "New winner").trim().slice(0, 32)} · ${String(data.time_slot_label || "match").trim().slice(0, 40)}.`, 15000, { label: "Check winner", href: "booyah.html" });
  } catch {
    // Winner announcements are optional; Home remains usable if Supabase is unavailable.
  }
}

let presentationRefreshTimer;
let homeRefreshGeneration = 0;
function renderPresentationSurfaces() {
  const featured = tournaments.find((tournament) => getEventPresentation(tournament).state.open) || tournaments.find((tournament) => tournament.featured) || tournaments[0];
  renderEventPreview();
  renderFeaturedEvent(featured);
  renderLiveFacts();
}
function scheduleCardPresentationRefresh() {
  window.clearTimeout(presentationRefreshTimer);
  const now = Date.now();
  const nextRollover = tournaments.map((tournament) => getEventPresentation(tournament, now).rolloverAt).filter((rolloverAt) => Number.isFinite(rolloverAt) && rolloverAt > now).sort((a, b) => a - b)[0];
  if (!nextRollover) return;
  presentationRefreshTimer = window.setTimeout(() => { renderPresentationSurfaces(); scheduleCardPresentationRefresh(); }, Math.max(100, Math.min(nextRollover - now + 100, 2_147_483_647)));
}

async function refreshHomePresentation({ force = false } = {}) {
  const refreshGeneration = ++homeRefreshGeneration;
  await hydrateTournamentOverrides({ force });
  if (refreshGeneration !== homeRefreshGeneration) return;
  renderPresentationSurfaces();
  scheduleCardPresentationRefresh();
}

async function initializeHome() {
  initializeShell();
  await refreshHomePresentation();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshHomePresentation({ force: true });
  });
  window.addEventListener("pageshow", () => refreshHomePresentation({ force: true }));
  announcePublishedWinner();
  const support = document.querySelector("#homeSupportLink");
  const supportHref = supportUrl("joining an open tournament");
  if (support && supportHref) support.href = supportHref;
  initializeMotion();
}

initializeHome();
