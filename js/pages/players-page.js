import {
  config,
  escapeHtml,
  formatDateTime,
  getRequestedTournament,
  getTimeSlotState,
  getTournament,
  normalize,
  rosters,
  tournaments
} from "../shared/data.js?v=20261006-match-complete";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js";
import { icon, initializeShell } from "../shared/shell.js?v=20261006-mobile-compact-v2";
import { initializeMotion, transitionUpdate } from "../shared/motion.js";

const eventSelect = document.querySelector("#rosterEvent");
const lobbySelect = document.querySelector("#rosterLobby");
const search = document.querySelector("#rosterSearch");
const content = document.querySelector("#rosterContent");
const meta = document.querySelector("#rosterMeta");
const activeStatuses = new Set(["confirmed", "checked in"]);
const supabaseRosterCache = new Map();
const supabaseRosterRequests = new Map();
let renderRequest = 0;

function projectedEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    registrationId: normalize(entry.registrationId || entry.reference).slice(0, 40),
    timeSlotId: normalize(entry.timeSlotId).slice(0, 64),
    timeSlotLabel: normalize(entry.timeSlotLabel).slice(0, 40),
    timeSlotAt: entry.timeSlotAt || null,
    slot: Number.isFinite(Number(entry.slot)) ? Number(entry.slot) : "—",
    teamName: normalize(entry.teamName).slice(0, 40),
    displayName: normalize(entry.displayName).slice(0, 40),
    uid: normalize(entry.uid).slice(0, 20),
    status: normalize(entry.status || "Confirmed").slice(0, 24),
    players: Array.isArray(entry.players) ? entry.players.slice(0, 4).map((player) => ({
      displayName: normalize(player?.displayName).slice(0, 40),
      uid: normalize(player?.uid).slice(0, 20)
    })) : []
  };
}

function entryMatches(entry, query) {
  if (!query) return true;
  const values = [entry.registrationId, entry.timeSlotLabel, entry.teamName, entry.displayName, entry.uid, ...entry.players.flatMap((player) => [player.displayName, player.uid])];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function emptyState(title, message, action = "") {
  const actions = {
    clear: '<button class="button button--quiet" type="button" data-roster-action="clear">Clear filters</button>',
    retry: '<button class="button button--quiet" type="button" data-roster-action="retry">Retry loading</button>'
  };
  return `<div class="empty-state empty-state--roster"><span class="empty-state__icon">${icon("team")}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${actions[action] || ""}</div>`;
}

function statusBadge(status) {
  const normalized = status.toLowerCase();
  const key = activeStatuses.has(normalized) ? "open" : "closed";
  return `<span class="status-badge status-badge--${key}"><i aria-hidden="true"></i>${escapeHtml(status)}</span>`;
}

function squadCards(entries) {
  return `<div class="roster-grid">${entries.map((entry) => `
    <article class="roster-card" data-reveal>
      <header><div><span>Slot ${escapeHtml(entry.slot)} · ${escapeHtml(entry.registrationId)}</span><h2>${escapeHtml(entry.teamName || "Unnamed squad")}</h2></div>${statusBadge(entry.status)}</header>
      <ol>${entry.players.map((player, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(player.displayName || "Player")}</strong><code>${escapeHtml(player.uid || "UID unavailable")}</code>${index === 0 ? "<small>Captain</small>" : ""}</li>`).join("")}</ol>
    </article>`).join("")}</div>`;
}

function playerRow(entry) {
  const playerNumber = typeof entry.slot === "number" ? String(entry.slot).padStart(2, "0") : entry.slot;
  return `<li class="roster-player">
    <div class="roster-player__number"><small>No.</small><strong>${escapeHtml(playerNumber)}</strong></div>
    <div class="roster-player__identity"><strong>${escapeHtml(entry.displayName || "Player")}</strong><span>Free Fire UID <code>${escapeHtml(entry.uid || "Unavailable")}</code></span></div>
    <div class="roster-player__reference"><small>Registration</small><code>${escapeHtml(entry.registrationId)}</code></div>
  </li>`;
}

function soloLobbyBoards(allEntries, visibleEntries, tournament, selectedLobby, query) {
  const configuredSlots = Array.isArray(tournament.timeSlots) ? tournament.timeSlots : [];
  const slots = configuredSlots.length
    ? configuredSlots
    : [...new Map(allEntries.map((entry) => [entry.timeSlotId, {
      id: entry.timeSlotId,
      label: entry.timeSlotLabel,
      startsAt: entry.timeSlotAt,
      capacity: 50
    }])).values()];
  const shownSlots = selectedLobby === "all" ? slots : slots.filter((slot) => slot.id === selectedLobby);

  return `<div class="lobby-board-list">${shownSlots.map((slot, index) => {
    const lobbyNumber = Math.max(1, slots.findIndex((candidate) => candidate.id === slot.id) + 1);
    const matchState = getTimeSlotState(tournament, slot);
    const confirmed = allEntries.filter((entry) => entry.timeSlotId === slot.id);
    const visible = visibleEntries.filter((entry) => entry.timeSlotId === slot.id);
    const emptyMessage = query
      ? "No confirmed player in this lobby matches your search."
      : "No players have been confirmed for this lobby yet.";
    return `<section class="lobby-board" aria-labelledby="lobbyBoardTitle${index}" data-reveal>
      <header class="lobby-board__header">
        <div><span class="lobby-board__signal">Lobby ${String(lobbyNumber).padStart(2, "0")}</span><span class="status-badge status-badge--${escapeHtml(matchState.key)}"><i aria-hidden="true"></i>${escapeHtml(matchState.label)}</span><h2 id="lobbyBoardTitle${index}">${escapeHtml(slot.label)}</h2><time datetime="${escapeHtml(slot.startsAt || "")}">${escapeHtml(formatDateTime(slot.startsAt, "long"))}</time></div>
        <div class="lobby-board__capacity"><strong>${confirmed.length}</strong><span>of ${Number(slot.capacity) || 50}<br>confirmed</span></div>
      </header>
      <div class="roster-player__head" aria-hidden="true"><span>Player no.</span><span>Player identity</span><span>Registration reference</span></div>
      ${visible.length ? `<ol class="roster-player-list">${visible.map(playerRow).join("")}</ol>` : `<p class="lobby-board__empty">${escapeHtml(emptyMessage)}</p>`}
    </section>`;
  }).join("")}</div>`;
}

function syncLobbyOptions(tournament) {
  const slots = Array.isArray(tournament?.timeSlots) ? tournament.timeSlots : [];
  lobbySelect.innerHTML = `<option value="all">All lobbies</option>${slots.map((slot) => {
    const state = getTimeSlotState(tournament, slot);
    return `<option value="${escapeHtml(slot.id)}">${escapeHtml(slot.label)} · ${escapeHtml(state.label)}</option>`;
  }).join("")}`;
  lobbySelect.value = window.matchMedia("(max-width: 43.74rem)").matches && slots.length ? slots[0].id : "all";
  lobbySelect.disabled = !slots.length;
}

async function supabaseRoster(tournament) {
  if (!isSupabaseConfigured() || tournament.comingSoon) return null;
  if (supabaseRosterCache.has(tournament.id)) return supabaseRosterCache.get(tournament.id);
  if (supabaseRosterRequests.has(tournament.id)) return supabaseRosterRequests.get(tournament.id);

  const request = (async () => {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("public_players")
      .select("reference, time_slot_id, time_slot_label, time_slot_at, slot, display_name, ff_uid, status")
      .eq("tournament_id", tournament.id)
      .order("time_slot_at", { ascending: true })
      .order("slot", { ascending: true });
    if (error) throw error;
    const entries = (data || [])
      .map((row) => projectedEntry({
        reference: row.reference,
        timeSlotId: row.time_slot_id,
        timeSlotLabel: row.time_slot_label,
        timeSlotAt: row.time_slot_at,
        slot: row.slot,
        displayName: row.display_name,
        uid: row.ff_uid,
        status: row.status
      }))
      .filter(Boolean);
    const roster = { published: true, updatedAt: null, entries, live: true };
    supabaseRosterCache.set(tournament.id, roster);
    return roster;
  })();

  supabaseRosterRequests.set(tournament.id, request);
  try {
    return await request;
  } finally {
    supabaseRosterRequests.delete(tournament.id);
  }
}

function renderLoading(tournament) {
  meta.innerHTML = `<div><span class="eyebrow-label">Selected match</span><strong>${escapeHtml(tournament.name)}</strong></div><span class="roster-meta__loading">Loading public roster…</span>`;
  content.setAttribute("aria-busy", "true");
  content.innerHTML = '<div class="roster-loading" aria-hidden="true"><span></span><span></span><span></span></div>';
}

async function renderRoster() {
  const request = ++renderRequest;
  const tournament = getTournament(eventSelect.value) || tournaments[0];
  if (!tournament) {
    meta.textContent = "No tournaments configured.";
    content.innerHTML = emptyState("No roster available", "Add a tournament before publishing players.");
    return;
  }

  let roster = rosters[tournament.id] || { published: false, entries: [] };
  if (isSupabaseConfigured() && !tournament.comingSoon && !supabaseRosterCache.has(tournament.id)) {
    renderLoading(tournament);
  }

  try {
    roster = await supabaseRoster(tournament) || roster;
  } catch {
    if (request !== renderRequest) return;
    content.removeAttribute("aria-busy");
    meta.innerHTML = `<div><span class="eyebrow-label">Selected match</span><strong>${escapeHtml(tournament.name)}</strong></div><span>Roster unavailable</span>`;
    content.innerHTML = emptyState("Could not load the roster", "Check your connection and retry. Your registration data is not affected.", "retry");
    return;
  }
  if (request !== renderRequest) return;
  content.removeAttribute("aria-busy");

  const allEntries = (Array.isArray(roster.entries) ? roster.entries : []).map(projectedEntry).filter(Boolean);
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const selectedLobby = lobbySelect.value || "all";
  const visibleEntries = allEntries.filter((entry) => (selectedLobby === "all" || entry.timeSlotId === selectedLobby) && entryMatches(entry, query));
  const unit = tournament.type === "solo" ? "players" : "teams";

  const update = () => {
    const sourceLabel = roster.live ? "Public roster" : roster.updatedAt ? formatDateTime(roster.updatedAt, "long") : "Not published";
    meta.innerHTML = `<div><span class="eyebrow-label">Selected match</span><strong>${escapeHtml(tournament.name)}</strong></div><div class="roster-meta__end"><span>${escapeHtml(sourceLabel)}</span><strong>${visibleEntries.length} shown · ${allEntries.length} confirmed ${unit}</strong><button class="button button--quiet roster-refresh" type="button" data-roster-action="refresh">Refresh</button></div>`;

    if (!roster.published) {
      content.innerHTML = tournament.comingSoon
        ? emptyState("Match coming soon", "Registration and roster publication are not open for this format yet.")
        : emptyState("Roster not published", `Confirmed ${unit} appear here after organizer verification.`);
      return;
    }
    if (!allEntries.length) {
      content.innerHTML = emptyState("No confirmed players yet", "Complete registrations appear here only after the organizer verifies payment and assigns a player number.");
      return;
    }
    if (!visibleEntries.length && (query || selectedLobby !== "all")) {
      content.innerHTML = emptyState("No matching player", "Clear the search or show all lobbies to return to the confirmed roster.", "clear");
      return;
    }

    content.innerHTML = tournament.type === "solo"
      ? soloLobbyBoards(allEntries, visibleEntries, tournament, selectedLobby, query)
      : squadCards(visibleEntries);
    initializeMotion(content);
  };

  transitionUpdate(update);
  const url = new URL(window.location.href);
  url.searchParams.set("tournament", tournament.id);
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function clearRosterFilters() {
  search.value = "";
  lobbySelect.value = "all";
  search.focus();
  renderRoster();
}

function refreshRoster() {
  const tournament = getTournament(eventSelect.value);
  if (tournament) supabaseRosterCache.delete(tournament.id);
  renderRoster();
}

function handleRosterAction(event) {
  const action = event.target.closest("[data-roster-action]")?.dataset.rosterAction;
  if (action === "clear") clearRosterFilters();
  if (action === "retry" || action === "refresh") refreshRoster();
}

function initializePlayers() {
  initializeShell();
  eventSelect.innerHTML = tournaments.map((tournament) => `<option value="${escapeHtml(tournament.id)}">${escapeHtml(tournament.name)} · ${escapeHtml(tournament.formatLabel)}</option>`).join("");
  const requested = getRequestedTournament();
  const firstPublished = tournaments.find((tournament) => rosters[tournament.id]?.published);
  eventSelect.value = (requested || firstPublished || tournaments[0])?.id || "";
  syncLobbyOptions(getTournament(eventSelect.value));

  eventSelect.addEventListener("change", () => {
    search.value = "";
    syncLobbyOptions(getTournament(eventSelect.value));
    renderRoster();
  });
  lobbySelect.addEventListener("change", renderRoster);
  search.addEventListener("input", renderRoster);
  meta.addEventListener("click", handleRosterAction);
  content.addEventListener("click", handleRosterAction);
  renderRoster();
  initializeMotion();
}

initializePlayers();
