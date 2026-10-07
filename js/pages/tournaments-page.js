import { getEventPresentation, isTdm, normalize, tournaments } from "../shared/data.js?v=20261011-lifecycle";
import { hydrateTournamentOverrides } from "../shared/tournament-backend.js?v=20261011-lifecycle";
import { eventCard } from "../shared/event-card.js?v=20261011-lifecycle";
import { initializeShell } from "../shared/shell.js?v=20261011-lifecycle";
import { initializeMotion, transitionUpdate } from "../shared/motion.js?v=20261011-lifecycle";

const grid = document.querySelector("#eventCatalog");
const count = document.querySelector("#eventResultCount");
const mobileCount = document.querySelector("#eventMobileResultCount");
const search = document.querySelector("#eventSearch");
const sort = document.querySelector("#eventSort");
const filters = [...document.querySelectorAll('input[name="eventFilter"]')];
const validFormats = new Set(filters.map((input) => input.value));
const validSorts = new Set([...sort.options].map((option) => option.value));

function matchesFormat(tournament, filter) {
  if (filter === "all") return true;
  if (filter === "solo") return tournament.type === "solo";
  if (filter === "tdm") return isTdm(tournament);
  if (filter === "squad") return tournament.type === "squad" && !isTdm(tournament);
  return true;
}

function currentFilter() {
  return filters.find((input) => input.checked)?.value || "all";
}

function getVisibleEvents() {
  const filter = currentFilter();
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const visible = tournaments.filter((tournament) => {
    const haystack = [tournament.name, tournament.shortCode, tournament.mode, tournament.formatLabel, tournament.map, tournament.server].join(" ").toLowerCase();
    return matchesFormat(tournament, filter) && (!query || haystack.includes(query));
  });

  return visible.sort((a, b) => {
    if (sort.value === "prize") return Number(b.prizePool) - Number(a.prizePool);
    if (sort.value === "fee") return Number(a.entryFee) - Number(b.entryFee);
    return Number(getEventPresentation(b).state.open) - Number(getEventPresentation(a).state.open);
  });
}

function syncUrl() {
  const url = new URL(window.location.href);
  const query = normalize(search.value).slice(0, 80);
  const filter = currentFilter();
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  if (filter !== "all") url.searchParams.set("format", filter);
  else url.searchParams.delete("format");
  if (sort.value !== "date") url.searchParams.set("sort", sort.value);
  else url.searchParams.delete("sort");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  search.value = normalize(params.get("q") || "").slice(0, 80);
  const format = params.get("format") || "all";
  const filter = filters.find((input) => input.value === format && validFormats.has(format)) || filters[0];
  filter.checked = true;
  const requestedSort = params.get("sort") || "date";
  sort.value = validSorts.has(requestedSort) ? requestedSort : "date";
}

function clearFilters() {
  filters[0].checked = true;
  search.value = "";
  sort.value = "date";
  search.focus();
  renderCatalog();
}

function renderCatalog() {
  const visible = getVisibleEvents();
  const message = `${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"} shown`;
  syncUrl();
  transitionUpdate(() => {
    count.textContent = message;
    if (mobileCount) mobileCount.textContent = message;
    grid.innerHTML = visible.length
      ? visible.map((tournament, index) => eventCard(tournament, { eager: index === 0 })).join("")
      : '<div class="empty-state"><span class="empty-state__mark" aria-hidden="true">0</span><h2>No matching tournaments</h2><p>Clear the search or choose another format.</p><button class="button button--quiet" type="button" id="clearEventFilters">Clear filters</button></div>';
    document.querySelector("#clearEventFilters")?.addEventListener("click", clearFilters);
    initializeMotion(grid);
  });
}

let presentationRefreshTimer;
let boardRefreshGeneration = 0;

function scheduleCardPresentationRefresh() {
  window.clearTimeout(presentationRefreshTimer);
  const now = Date.now();
  const nextRollover = tournaments
    .map((tournament) => getEventPresentation(tournament, now).rolloverAt)
    .filter((rolloverAt) => Number.isFinite(rolloverAt) && rolloverAt > now)
    .sort((a, b) => a - b)[0];
  if (!nextRollover) return;
  const delay = Math.min(nextRollover - now + 100, 2_147_483_647);
  presentationRefreshTimer = window.setTimeout(() => {
    renderCatalog();
    scheduleCardPresentationRefresh();
  }, Math.max(100, delay));
}

async function refreshTournamentBoard({ force = false } = {}) {
  const refreshGeneration = ++boardRefreshGeneration;
  await hydrateTournamentOverrides({ force });
  if (refreshGeneration !== boardRefreshGeneration) return;
  renderCatalog();
  scheduleCardPresentationRefresh();
}

async function initializeTournaments() {
  initializeShell();
  await hydrateTournamentOverrides();
  hydrateFromUrl();
  filters.forEach((input) => input.addEventListener("change", renderCatalog));
  search.addEventListener("input", renderCatalog);
  sort.addEventListener("change", renderCatalog);
  window.addEventListener("popstate", () => {
    hydrateFromUrl();
    renderCatalog();
  });
  renderCatalog();
  scheduleCardPresentationRefresh();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshTournamentBoard({ force: true });
  });
  window.addEventListener("pageshow", () => refreshTournamentBoard({ force: true }));
  initializeMotion();
}

initializeTournaments();
