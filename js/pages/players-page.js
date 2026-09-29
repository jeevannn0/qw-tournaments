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

function entryMatches(entry, query) {
  if (!query) return true;
  const values = [entry.registrationId, entry.teamName, entry.displayName, entry.uid, ...(entry.players || []).flatMap((player) => [player.displayName, player.uid])];
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function emptyState(title, message) {
  return `<div class="empty-state empty-state--roster"><span class="empty-state__icon">${icon("team")}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>`;
}

function squadCards(entries) {
  return `<div class="roster-grid">${entries.map((entry) => `
    <article class="roster-card" data-reveal data-spotlight>
      <header><div><span>Slot ${escapeHtml(entry.slot)} · ${escapeHtml(entry.registrationId)}</span><h2>${escapeHtml(entry.teamName)}</h2></div><span class="status-badge status-badge--open"><i aria-hidden="true"></i>${escapeHtml(entry.status || "Confirmed")}</span></header>
      <ol>${(entry.players || []).map((player, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(player.displayName)}</strong><code>${escapeHtml(player.uid)}</code>${index === 0 ? "<small>Captain</small>" : ""}</li>`).join("")}</ol>
    </article>`).join("")}</div>`;
}

function soloTable(entries) {
  return `<div class="responsive-table"><table><thead><tr><th>Slot</th><th>Player</th><th>Free Fire UID</th><th>Reference</th><th>Status</th></tr></thead><tbody>${entries.map((entry) => `
    <tr><td data-label="Slot">${escapeHtml(entry.slot)}</td><td data-label="Player"><strong>${escapeHtml(entry.displayName)}</strong></td><td data-label="Free Fire UID"><code>${escapeHtml(entry.uid)}</code></td><td data-label="Reference">${escapeHtml(entry.registrationId)}</td><td data-label="Status"><span class="status-badge status-badge--open"><i aria-hidden="true"></i>${escapeHtml(entry.status || "Confirmed")}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function renderRoster() {
  const tournament = getTournament(eventSelect.value) || tournaments[0];
  if (!tournament) {
    meta.textContent = "No tournaments configured.";
    content.innerHTML = emptyState("No roster available", "Add a tournament before publishing players.");
    return;
  }

  const roster = rosters[tournament.id] || { published: false, entries: [] };
  const allEntries = Array.isArray(roster.entries) ? roster.entries : [];
  const query = normalize(search.value).toLowerCase();
  const entries = allEntries.filter((entry) => entryMatches(entry, query));
  const unit = tournament.type === "solo" ? "players" : "teams";

  const update = () => {
    meta.innerHTML = `<div><span class="eyebrow-label">Selected event</span><strong>${escapeHtml(tournament.name)}</strong></div><div class="roster-meta__end">${roster.isSample ? '<span class="demo-chip">Sample roster</span>' : ""}<span>${roster.updatedAt ? escapeHtml(formatDateTime(roster.updatedAt, "long")) : "Not published"}</span><span>${allEntries.length} confirmed ${unit}</span></div>`;

    if (!roster.published || !allEntries.length) {
      content.innerHTML = emptyState("Roster not published yet", `The confirmed ${unit} list is planned about ${config.rosterLeadHours} hours before ${formatDateTime(tournament.matchAt, "long")}.`);
      return;
    }
    if (!entries.length) {
      content.innerHTML = emptyState("No matching entry", "Try another team name, player name, UID, or registration reference.");
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
