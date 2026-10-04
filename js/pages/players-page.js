import {
  config,
  escapeHtml,
  formatDateTime,
  getRequestedTournament,
  getTournament,
  normalize,
  rosters,
  tournaments
} from "../shared/data.js";
import { icon, initializeShell } from "../shared/shell.js";
import { initializeMotion, transitionUpdate } from "../shared/motion.js";

const eventSelect = document.querySelector("#rosterEvent");
const search = document.querySelector("#rosterSearch");
const content = document.querySelector("#rosterContent");
const meta = document.querySelector("#rosterMeta");
const activeStatuses = new Set(["confirmed", "checked in"]);

function projectedEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    registrationId: normalize(entry.registrationId).slice(0, 40),
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
  const values = [entry.registrationId, entry.teamName, entry.displayName, entry.uid, ...entry.players.flatMap((player) => [player.displayName, player.uid])];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function emptyState(title, message) {
  return `<div class="empty-state empty-state--roster"><span class="empty-state__icon">${icon("team")}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
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

function soloTable(entries) {
  return `<div class="responsive-table"><table><thead><tr><th>Slot</th><th>Player</th><th>Free Fire UID</th><th>Reference</th><th>Status</th></tr></thead><tbody>${entries.map((entry) => `
    <tr><td data-label="Slot">${escapeHtml(entry.slot)}</td><td data-label="Player"><strong>${escapeHtml(entry.displayName)}</strong></td><td data-label="Free Fire UID"><code>${escapeHtml(entry.uid)}</code></td><td data-label="Reference">${escapeHtml(entry.registrationId)}</td><td data-label="Status">${statusBadge(entry.status)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderRoster() {
  const tournament = getTournament(eventSelect.value) || tournaments[0];
  if (!tournament) {
    meta.textContent = "No tournaments configured.";
    content.innerHTML = emptyState("No roster available", "Add a tournament before publishing players.");
    return;
  }

  const roster = rosters[tournament.id] || { published: false, entries: [] };
  const allEntries = (Array.isArray(roster.entries) ? roster.entries : []).map(projectedEntry).filter(Boolean);
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const entries = allEntries.filter((entry) => entryMatches(entry, query));
  const unit = tournament.type === "solo" ? "players" : "teams";
  const activeCount = allEntries.filter((entry) => activeStatuses.has(entry.status.toLowerCase())).length;

  const update = () => {
    meta.innerHTML = `<div><span class="eyebrow-label">Selected match</span><strong>${escapeHtml(tournament.name)}</strong></div><div class="roster-meta__end"><span>${roster.updatedAt ? escapeHtml(formatDateTime(roster.updatedAt, "long")) : "Not published"}</span><span>${activeCount} active · ${allEntries.length} total ${unit}</span></div>`;

    if (!roster.published) {
      content.innerHTML = tournament.comingSoon
        ? emptyState("Match coming soon", "Registration and roster publication are not open for this format yet.")
        : tournament.alwaysOpen
          ? emptyState("Roster not published", "Confirmed players appear here after the organizer publishes the Solo roster.")
          : emptyState("Roster not published", `Confirmed ${unit} are normally posted about ${config.rosterLeadHours} hours before ${formatDateTime(tournament.matchAt, "long")}.`);
      return;
    }
    if (!allEntries.length) {
      content.innerHTML = emptyState("Roster published — no entries", "The organizer has published this roster, but no confirmed entries are listed.");
      return;
    }
    if (!entries.length) {
      content.innerHTML = emptyState("No matching entry", "Try another squad name, player name, UID, or registration reference.");
      return;
    }

    content.innerHTML = tournament.type === "solo" ? soloTable(entries) : squadCards(entries);
    initializeMotion(content);
  };

  transitionUpdate(update);
  const url = new URL(window.location.href);
  url.searchParams.set("tournament", tournament.id);
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

function initializePlayers() {
  initializeShell();
  eventSelect.innerHTML = tournaments.map((tournament) => `<option value="${escapeHtml(tournament.id)}">${escapeHtml(tournament.name)} · ${escapeHtml(tournament.formatLabel)}</option>`).join("");
  const requested = getRequestedTournament();
  const firstPublished = tournaments.find((tournament) => rosters[tournament.id]?.published);
  eventSelect.value = (requested || firstPublished || tournaments[0])?.id || "";
  eventSelect.addEventListener("change", () => { search.value = ""; renderRoster(); });
  search.addEventListener("input", renderRoster);
  renderRoster();
  initializeMotion();
}

initializePlayers();
