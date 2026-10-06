import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  getTimeSlot,
  getTournament,
  normalize,
  winners
} from "../shared/data.js?v=20261006-booyah";
import { icon, initializeShell } from "../shared/shell.js";
import { initializeMotion } from "../shared/motion.js";

const winnerGrid = document.querySelector("#winnerGrid");
const winnerCount = document.querySelector("#winnerCount");

function projectWinner(entry) {
  if (!entry || typeof entry !== "object") return null;
  const id = normalize(entry.id).slice(0, 80);
  const tournamentId = normalize(entry.tournamentId).slice(0, 64);
  const timeSlotId = normalize(entry.timeSlotId).slice(0, 64);
  const displayName = normalize(entry.displayName).slice(0, 40);
  if (!/^[a-z0-9-]{1,80}$/.test(id) || !displayName) return null;

  const tournament = getTournament(tournamentId);
  if (!tournament) return null;
  const timeSlot = timeSlotId ? getTimeSlot(tournament, timeSlotId) : null;
  if (timeSlotId && !timeSlot) return null;

  const kills = entry.kills === null || entry.kills === undefined || entry.kills === ""
    ? null
    : Number(entry.kills);
  const verifiedKills = Number.isInteger(kills) && kills >= 0 && kills <= 99 ? kills : null;
  const killReward = Number(tournament.killReward);
  const booyahBonus = Number(tournament.booyahBonus);
  const totalReward = Number.isFinite(booyahBonus) && booyahBonus >= 0
    ? booyahBonus + (verifiedKills !== null && Number.isFinite(killReward) ? verifiedKills * killReward : 0)
    : null;

  return {
    id,
    displayName,
    uid: normalize(entry.uid).slice(0, 20),
    kills: verifiedKills,
    tournamentName: normalize(tournament.name).slice(0, 80),
    matchLabel: normalize(timeSlot?.label || tournament.formatLabel || "Match").slice(0, 60),
    matchAt: timeSlot?.startsAt || tournament.matchAt || null,
    booyahBonus: Number.isFinite(booyahBonus) ? booyahBonus : null,
    totalReward
  };
}

function fact(label, value, emphasis = false) {
  return `<div class="winner-card__fact"><span>${escapeHtml(label)}</span><strong${emphasis ? ' class="winner-card__reward"' : ""}>${escapeHtml(value)}</strong></div>`;
}

function winnerCard(winner, index) {
  const playerCode = winner.uid ? `<span>Free Fire UID <code>${escapeHtml(winner.uid)}</code></span>` : "";
  const kills = winner.kills !== null ? fact("Verified kills", String(winner.kills)) : "";
  const rewardLabel = winner.kills !== null ? "Total reward" : "Booyah bonus";
  const rewardValue = winner.kills !== null ? winner.totalReward : winner.booyahBonus;
  const reward = rewardValue !== null ? fact(rewardLabel, formatCurrency(rewardValue), true) : "";
  const date = winner.matchAt
    ? `<time datetime="${escapeHtml(winner.matchAt)}">${escapeHtml(formatDateTime(winner.matchAt, "long"))}</time>`
    : '<span class="winner-card__date">Match time unavailable</span>';

  return `<article class="winner-card" data-reveal>
    <div class="winner-card__rank" aria-hidden="true"><span>${icon("crown")}</span><strong>${String(index + 1).padStart(2, "0")}</strong></div>
    <div class="winner-card__body">
      <header>
        <div><p>${escapeHtml(winner.matchLabel)}</p><h2>${escapeHtml(winner.displayName)}</h2>${playerCode}</div>
        <span class="winner-card__badge">${icon("trophy")} Booyah</span>
      </header>
      <div class="winner-card__match"><strong>${escapeHtml(winner.tournamentName)}</strong>${date}</div>
      ${kills || reward ? `<div class="winner-card__facts">${kills}${reward}</div>` : ""}
    </div>
  </article>`;
}

function emptyState() {
  return `<div class="empty-state empty-state--booyah" data-reveal>
    <span class="empty-state__icon">${icon("crown")}</span>
    <p class="kicker">Results pending</p>
    <h2>The next Booyah is waiting.</h2>
    <p>Verified match winners will appear here after the organizer checks and publishes each lobby result.</p>
    <a class="button button--primary" href="tournaments.html">View tournaments ${icon("arrow")}</a>
  </div>`;
}

function initializeBooyah() {
  initializeShell();
  const results = winners
    .map(projectWinner)
    .filter(Boolean)
    .sort((a, b) => (Date.parse(b.matchAt) || 0) - (Date.parse(a.matchAt) || 0));

  winnerCount.textContent = results.length
    ? `${results.length} verified ${results.length === 1 ? "winner" : "winners"}`
    : "No verified results published yet";
  winnerGrid.innerHTML = results.length ? results.map(winnerCard).join("") : emptyState();
  initializeMotion();
}

initializeBooyah();
