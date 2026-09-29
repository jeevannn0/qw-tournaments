import { isTdm, normalize, tournaments } from "../shared/data.js";
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
  const query = normalize(search.value).toLowerCase();
  const visible = tournaments.filter((tournament) => {
    const haystack = [tournament.name, tournament.shortCode, tournament.mode, tournament.formatLabel, tournament.map, tournament.server].join(" ").toLowerCase();
    return matchesFormat(tournament, filter) && (!query || haystack.includes(query));
  });

  const sortValue = sort.value;
  return visible.sort((a, b) => {
    if (sortValue === "prize") return Number(b.prizePool) - Number(a.prizePool);
    if (sortValue === "fee") return Number(a.entryFee) - Number(b.entryFee);
    return Date.parse(a.matchAt) - Date.parse(b.matchAt);
  });
}

function renderCatalog() {
  const visible = getVisibleEvents();
  const update = () => {
    count.textContent = `${visible.length} ${visible.length === 1 ? "tournament" : "tournaments"} shown`;
    grid.innerHTML = visible.length
      ? visible.map((tournament) => eventCard(tournament)).join("")
      : `<div class="empty-state"><span class="empty-state__mark" aria-hidden="true">0</span><h2>No matching tournaments</h2><p>Clear the search or choose a different format.</p><button class="button button--quiet" type="button" id="clearEventFilters">Clear filters</button></div>`;
    document.querySelector("#clearEventFilters")?.addEventListener("click", () => {
      filters[0].checked = true;
      search.value = "";
      sort.value = "date";
      renderCatalog();
    });
    initializeMotion(grid);
  };
  transitionUpdate(update);
}

initializeShell();
filters.forEach((input) => input.addEventListener("change", renderCatalog));
search.addEventListener("input", renderCatalog);
sort.addEventListener("change", renderCatalog);
renderCatalog();
initializeMotion();
