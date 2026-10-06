import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  getTimeSlot,
  getTournament,
  normalize,
  winners
} from "../shared/data.js?v=20261006-booyah-admin-v1";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js";
import { icon, initializeShell } from "../shared/shell.js?v=20261006-mobile-compact-v2";
import { initializeMotion } from "../shared/motion.js";

const winnerGrid = document.querySelector("#winnerGrid");
const winnerCount = document.querySelector("#winnerCount");
const imageObjectUrls = new Set();

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

  const kills = entry.kills === null || entry.kills === undefined || entry.kills === "" ? null : Number(entry.kills);
  const verifiedKills = Number.isInteger(kills) && kills >= 0 && kills <= 99 ? kills : null;
  const configuredKillReward = Number(tournament.killReward);
  const configuredBooyahBonus = Number(tournament.booyahBonus);
  const calculatedReward = Number.isFinite(configuredBooyahBonus) && configuredBooyahBonus >= 0
    ? configuredBooyahBonus + (verifiedKills !== null && Number.isFinite(configuredKillReward) ? verifiedKills * configuredKillReward : 0)
    : null;
  const prizeAmount = Number(entry.prizeAmount);

  return {
    id,
    displayName,
    uid: normalize(entry.uid).slice(0, 20),
    kills: verifiedKills,
    tournamentName: normalize(tournament.name).slice(0, 80),
    matchLabel: normalize(timeSlot?.label || entry.matchLabel || tournament.formatLabel || "Match").slice(0, 60),
    matchAt: timeSlot?.startsAt || entry.matchAt || tournament.matchAt || null,
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

function winnerCard(winner, index) {
  const playerCode = winner.uid ? `<span>Free Fire UID <code>${escapeHtml(winner.uid)}</code></span>` : "";
  const kills = winner.kills !== null ? fact("Verified kills", String(winner.kills)) : "";
  const reward = winner.totalReward !== null ? fact("Prize", formatCurrency(winner.totalReward), true) : "";
  const date = winner.matchAt
    ? `<time datetime="${escapeHtml(winner.matchAt)}">${escapeHtml(formatDateTime(winner.matchAt, "long"))}</time>`
    : '<span class="winner-card__date">Match time unavailable</span>';
  const image = winner.imageUrl
    ? `<figure class="winner-card__media"><img src="${escapeHtml(winner.imageUrl)}" alt="${escapeHtml(winner.imageAlt || `${winner.displayName} after winning ${winner.matchLabel}`)}"></figure>`
    : "";

  return `<article class="winner-card" data-reveal>
    <div class="winner-card__rank" aria-hidden="true"><span>${icon("crown")}</span><strong>${String(index + 1).padStart(2, "0")}</strong></div>
    <div class="winner-card__body">
      ${image}
      <div class="winner-card__content">
        <header>
          <div><p>${escapeHtml(winner.matchLabel)}</p><h2>${escapeHtml(winner.displayName)}</h2>${playerCode}</div>
          <span class="winner-card__badge">${icon("trophy")} Booyah</span>
        </header>
        <div class="winner-card__match"><strong>${escapeHtml(winner.tournamentName)}</strong>${date}</div>
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
    .select("id, tournament_id, time_slot_id, time_slot_label, time_slot_at, display_name, ff_uid, kills, prize_amount, image_path, image_alt, published_at")
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
  releaseImageUrls();
  winnerCount.textContent = "Loading verified results…";
  winnerGrid.setAttribute("aria-busy", "true");
  winnerGrid.innerHTML = '<div class="winner-loading" aria-hidden="true"><span></span><span></span></div>';

  try {
    const results = (await loadPublishedWinners())
      .filter(Boolean)
      .sort((a, b) => (Date.parse(b.matchAt) || 0) - (Date.parse(a.matchAt) || 0));
    winnerCount.textContent = results.length
      ? `${results.length} verified ${results.length === 1 ? "winner" : "winners"}`
      : "No verified results published yet";
    winnerGrid.innerHTML = results.length ? results.map(winnerCard).join("") : emptyState();
  } catch {
    winnerCount.textContent = "Winner board unavailable";
    winnerGrid.innerHTML = emptyState("Could not load verified winners.", "Check your connection and try again. No registration or payment information is shown here.", true);
  } finally {
    winnerGrid.removeAttribute("aria-busy");
    initializeMotion(winnerGrid);
  }
}

function initializeBooyah() {
  initializeShell();
  winnerGrid.addEventListener("click", (event) => {
    if (event.target.closest("[data-retry-winners]")) renderWinners();
  });
  window.addEventListener("beforeunload", releaseImageUrls);
  renderWinners();
  initializeMotion();
}

initializeBooyah();
