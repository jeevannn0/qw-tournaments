import { getEventState, isTdm, normalize, tournaments } from "../shared/data.js";
import { eventCard } from "../shared/event-card.js";
import { initializeShell } from "../shared/shell.js";
import { initializeMotion, transitionUpdate } from "../shared/motion.js";

const grid = document.querySelector("#eventCatalog");
const count = document.querySelector("#eventResultCount");
const search = document.querySelector("#eventSearch");
const sort = document.querySelector("#eventSort");
const filters = [...document.querySelectorAll('input[name="eventFilter"]')];

function matchesFormat(tournament, filter) {
  if (filter === "all") return true;
  if (filter === "solo") return tournament.type === "solo";
  if (filter === "tdm") return isTdm(tournament);
  if (filter === "squad") return tournament.type === "squad" && !isTdm(tournament);
  return true;
}

function getVisibleEvents() {
  const filter = filters.find((input) => input.checked)?.value || "all";
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const visible = tournaments.filter((tournament) => {
    const haystack = [tournament.name, tournament.shortCode, tournament.mode, tournament.formatLabel, tournament.map, tournament.server].join(" ").toLowerCase();
    return matchesFormat(tournament, filter) && (!query || haystack.includes(query));
  });

  return visible.sort((a, b) => {
    if (sort.value === "prize") return Number(b.prizePool) - Number(a.prizePool);
    if (sort.value === "fee") return Number(a.entryFee) - Number(b.entryFee);
    return Number(getEventState(b).open) - Number(getEventState(a).open);
  });
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
  transitionUpdate(() => {
    count.textContent = `${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"} shown`;
    grid.innerHTML = visible.length
      ? visible.map((tournament) => eventCard(tournament, { eager: true })).join("")
      : '<div class="empty-state"><span class="empty-state__mark" aria-hidden="true">0</span><h2>No matching tournaments</h2><p>Clear the search or choose another format.</p><button class="button button--quiet" type="button" id="clearEventFilters">Clear filters</button></div>';
    document.querySelector("#clearEventFilters")?.addEventListener("click", clearFilters);
    initializeMotion(grid);
  });
}

initializeShell();
filters.forEach((input) => input.addEventListener("change", renderCatalog));
search.addEventListener("input", renderCatalog);
sort.addEventListener("change", renderCatalog);
renderCatalog();
initializeMotion();
