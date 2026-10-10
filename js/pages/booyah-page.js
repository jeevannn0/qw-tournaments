import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  getEventState,
  getTimeSlot,
  getTimeSlotState,
  getTournament,
  normalize,
  winners
} from "../shared/data.js?v=20261013-squad-results";
import { hydrateTournamentOverrides } from "../shared/tournament-backend.js?v=20261013-squad-results";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js?v=20261013-squad-results";
import { icon, initializeShell } from "../shared/shell.js?v=20261013-squad-results";
import { initializeMotion } from "../shared/motion.js?v=20261013-squad-results";

const winnerGrid = document.querySelector("#winnerGrid");
const winnerCount = document.querySelector("#winnerCount");
const imageObjectUrls = new Set();
let winnerRenderGeneration = 0;

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
  const storedMatchLabel = normalize(entry.matchLabel).slice(0, 60);
  const storedMatchAt = Number.isFinite(Date.parse(entry.matchAt)) ? entry.matchAt : null;
  const historicalState = storedMatchAt && Date.parse(storedMatchAt) <= Date.now()
    ? { key: "complete", label: "Completed", open: false }
    : { key: "scheduled", label: "Scheduled", open: false };

  const kills = entry.kills === null || entry.kills === undefined || entry.kills === "" ? null : Number(entry.kills);
  const verifiedKills = Number.isInteger(kills) && kills >= 0 && kills <= 99 ? kills : null;
  const configuredKillReward = Number(tournament.killReward);
  const configuredBooyahBonus = Number(tournament.booyahBonus);
  const calculatedReward = Number.isFinite(configuredBooyahBonus) && configuredBooyahBonus >= 0
    ? configuredBooyahBonus + (verifiedKills !== null && Number.isFinite(configuredKillReward) ? verifiedKills * configuredKillReward : 0)
    : null;
  const prizeAmount = Number(entry.prizeAmount);

  const teamName = tournament.type === "solo" ? "" : normalize(entry.teamName).slice(0, 40);
  const players = Array.isArray(entry.players) ? entry.players.slice(0, 4).map((player) => ({
    displayName: normalize(player?.displayName).slice(0, 40),
    uid: normalize(player?.uid).slice(0, 20)
  })).filter((player) => player.displayName) : [];

  return {
    id,
    displayName,
    teamName,
    players,
    uid: normalize(entry.uid).slice(0, 20),
    kills: verifiedKills,
    tournamentName: normalize(tournament.name).slice(0, 80),
    matchLabel: storedMatchLabel || normalize(timeSlot?.label || tournament.formatLabel || "Match").slice(0, 60),
    matchAt: storedMatchAt || timeSlot?.startsAt || tournament.matchAt || null,
    matchState: timeSlot ? getTimeSlotState(tournament, timeSlot) : historicalState,
    totalReward: Number.isInteger(prizeAmount) && prizeAmount >= 0 ? prizeAmount : calculatedReward,
    imagePath: normalize(entry.imagePath).slice(0, 400),
    imageUrl: normalize(entry.imageUrl).slice(0, 1000),
    imageAlt: normalize(entry.imageAlt).slice(0, 180),
    publishedAt: entry.publishedAt || null
  };
}

function fact(label, value, emphasis = false) {
  return `<div class="winner-card__fact"><span>${escapeHtml(label)}</span><strong${emphasis ? ' class="winner-card__reward"' : ""}>${escapeHtml(value)}</strong></div>`;
}

function squadLineup(winner) {
  const players = winner.players.length ? winner.players : [{ displayName: winner.displayName, uid: winner.uid }];
  return `<ol class="winner-card__lineup" aria-label="Winning squad lineup">${players.map((player, playerIndex) => `<li><span>${playerIndex + 1}</span><strong>${escapeHtml(player.displayName)}</strong><code>${escapeHtml(player.uid || "UID unavailable")}</code>${playerIndex === 0 ? "<small>Captain</small>" : ""}</li>`).join("")}</ol>`;
}

function winnerCard(winner, index) {
  const title = winner.teamName || winner.displayName;
  const identity = winner.teamName
    ? squadLineup(winner)
    : winner.uid ? `<span>Free Fire UID <code>${escapeHtml(winner.uid)}</code></span>` : "";
  const kills = winner.kills !== null ? fact("Verified kills", String(winner.kills)) : "";
  const reward = winner.totalReward !== null ? fact("Prize", formatCurrency(winner.totalReward), true) : "";
  const date = winner.matchAt
    ? `<time datetime="${escapeHtml(winner.matchAt)}">${escapeHtml(formatDateTime(winner.matchAt, "long"))}</time>`
    : '<span class="winner-card__date">Match time unavailable</span>';
  const image = winner.imageUrl
    ? `<figure class="winner-card__media"><img src="${escapeHtml(winner.imageUrl)}" alt="${escapeHtml(winner.imageAlt || `${title} after winning ${winner.matchLabel}`)}"></figure>`
    : "";

  return `<article class="winner-card" data-reveal>
    <div class="winner-card__rank" aria-hidden="true"><span>${icon("crown")}</span><strong>${String(index + 1).padStart(2, "0")}</strong></div>
    <div class="winner-card__body">
      ${image}
      <div class="winner-card__content">
        <header>
          <div><p>${escapeHtml(winner.matchLabel)}</p><h2>${escapeHtml(title)}</h2>${identity}</div>
          <span class="winner-card__badge">${icon("trophy")} Booyah</span>
        </header>
        <div class="winner-card__match"><strong>${escapeHtml(winner.tournamentName)}</strong>${date}<span class="status-badge status-badge--${escapeHtml(winner.matchState.key)}"><i aria-hidden="true"></i>${escapeHtml(winner.matchState.label)}</span></div>
        ${kills || reward ? `<div class="winner-card__facts">${kills}${reward}</div>` : ""}
      </div>
    </div>
  </article>`;
}

function emptyState(title = "The next Booyah is waiting.", message = "Verified match winners will appear here after the organizer checks and publishes each lobby result.", retry = false) {
  return `<div class="empty-state empty-state--booyah" data-reveal>
    <span class="empty-state__icon">${icon("crown")}</span>
    <p class="kicker">${retry ? "Connection issue" : "Results pending"}</p>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>
    ${retry ? '<button class="button button--quiet" type="button" data-retry-winners>Retry</button>' : `<a class="button button--primary" href="tournaments.html">View tournaments ${icon("arrow")}</a>`}
  </div>`;
}

function releaseImageUrls() {
  imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  imageObjectUrls.clear();
}

async function loadPublishedWinners() {
  if (!isSupabaseConfigured()) return winners.map(projectWinner).filter(Boolean);
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("match_results")
    .select("id, tournament_id, time_slot_id, time_slot_label, time_slot_at, display_name, ff_uid, team_name, players, kills, prize_amount, image_path, image_alt, published_at")
    .eq("published", true)
    .order("time_slot_at", { ascending: false });
  if (error && ["42P01", "PGRST205"].includes(error.code)) return winners.map(projectWinner).filter(Boolean);
  if (error) throw error;

  const projected = (data || []).map((row) => projectWinner({
    id: row.id,
    tournamentId: row.tournament_id,
    timeSlotId: row.time_slot_id,
    matchLabel: row.time_slot_label,
    matchAt: row.time_slot_at,
    displayName: row.display_name,
    uid: row.ff_uid,
    teamName: row.team_name,
    players: row.players,
    kills: row.kills,
    prizeAmount: row.prize_amount,
    imagePath: row.image_path,
    imageAlt: row.image_alt,
    publishedAt: row.published_at
  })).filter(Boolean);

  return Promise.all(projected.map(async (winner) => {
    if (!winner.imagePath) return winner;
    const { data: imageBlob, error: imageError } = await client.storage.from("winner-images").download(winner.imagePath);
    if (imageError || !imageBlob) return winner;
    const imageUrl = URL.createObjectURL(imageBlob);
    imageObjectUrls.add(imageUrl);
    return { ...winner, imageUrl };
  }));
}

async function renderWinners() {
  const renderGeneration = ++winnerRenderGeneration;
  releaseImageUrls();
  winnerCount.textContent = "Loading verified results…";
  winnerGrid.setAttribute("aria-busy", "true");
  winnerGrid.innerHTML = '<div class="winner-loading" aria-hidden="true"><span></span><span></span></div>';

  try {
    const results = (await loadPublishedWinners())
      .filter(Boolean)
      .sort((a, b) => (Date.parse(b.matchAt) || 0) - (Date.parse(a.matchAt) || 0));
    if (renderGeneration !== winnerRenderGeneration) return;
    winnerCount.textContent = results.length
      ? `${results.length} verified ${results.length === 1 ? "winner" : "winners"}`
      : "No verified results published yet";
    winnerGrid.innerHTML = results.length ? results.map(winnerCard).join("") : emptyState();
  } catch {
    if (renderGeneration !== winnerRenderGeneration) return;
    winnerCount.textContent = "Winner board unavailable";
    winnerGrid.innerHTML = emptyState("Could not load verified winners.", "Check your connection and try again. No registration or payment information is shown here.", true);
  } finally {
    if (renderGeneration === winnerRenderGeneration) {
      winnerGrid.removeAttribute("aria-busy");
      initializeMotion(winnerGrid);
    }
  }
}

async function refreshBooyah({ force = false } = {}) {
  await hydrateTournamentOverrides({ force });
  await renderWinners();
}

async function initializeBooyah() {
  initializeShell();
  await hydrateTournamentOverrides();
  winnerGrid.addEventListener("click", (event) => {
    if (event.target.closest("[data-retry-winners]")) renderWinners();
  });
  window.addEventListener("beforeunload", releaseImageUrls);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBooyah({ force: true });
  });
  // pageshow also fires on the initial load; only a back/forward cache restore needs a refresh.
  window.addEventListener("pageshow", (event) => { if (event.persisted) refreshBooyah({ force: true }); });
  renderWinners();
  initializeMotion();
}

initializeBooyah();
