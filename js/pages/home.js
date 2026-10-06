import {
  escapeHtml,
  eventMark,
  eventUrl,
  formatCurrency,
  formatLobbySchedule,
  getCapacity,
  getEventMedia,
  getEventState,
  getOpenTimeSlots,
  registrationUrl,
  supportUrl,
  tournaments
} from "../shared/data.js?v=20261006-match-complete";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js";
import { eventCard, eventStatusBadge } from "../shared/event-card.js?v=20261006-match-complete";
import { icon, initializeShell, showToast } from "../shared/shell.js?v=20261006-winner-toast";
import { initializeMotion } from "../shared/motion.js";

function renderFeaturedEvent(tournament) {
  const mount = document.querySelector("#featuredEvent");
  if (!mount || !tournament) return;
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const mainAction = state.open
    ? `<a class="button button--primary button--large" href="${registrationUrl(tournament)}">Register for ${escapeHtml(formatCurrency(tournament.entryFee))} ${icon("arrow")}</a>`
    : `<a class="button button--quiet button--large" href="${eventUrl(tournament)}">View preview ${icon("arrow")}</a>`;

  mount.innerHTML = `
    <article class="feature-event">
      <div class="feature-event__content" data-reveal>
        <div class="inline-badges">${eventStatusBadge(tournament)}</div>
        <p class="kicker">Two scheduled Solo lobbies · ${escapeHtml(tournament.shortCode)}</p>
        <h2>${escapeHtml(tournament.name)}</h2>
        <p class="feature-event__lead">${escapeHtml(tournament.tagline)}</p>
        <div class="reward-strip reward-strip--feature" aria-label="Solo match rewards">
          <span><strong>${escapeHtml(formatCurrency(tournament.entryFee))}</strong><small>entry</small></span>
          <span><strong>${escapeHtml(formatCurrency(tournament.killReward))}</strong><small>per confirmed kill</small></span>
          <span><strong>${escapeHtml(formatCurrency(tournament.booyahBonus))}</strong><small>Booyah bonus</small></span>
        </div>
        <dl class="feature-event__facts">
          <div><dt>Lobbies</dt><dd>${escapeHtml(formatLobbySchedule(tournament))}</dd></div>
          <div><dt>Map</dt><dd>${escapeHtml(tournament.map)}</dd></div>
          <div><dt>Capacity</dt><dd>50 players per lobby</dd></div>
        </dl>
        <progress class="capacity-meter capacity-meter--large" max="${capacity.capacity || 1}" value="${capacity.filled}" aria-label="${capacity.filled} of ${capacity.capacity} ${capacity.unit} filled">${capacity.percent}%</progress>
        <div class="button-row">${mainAction}<a class="button button--quiet button--large" href="${eventUrl(tournament)}">Rules and how to join</a></div>
      </div>
      <div class="feature-event__visual" data-reveal>
        <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}" width="480" height="270" loading="lazy" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <span class="feature-event__shade" aria-hidden="true"></span>
        <span class="feature-event__mark" aria-hidden="true">${escapeHtml(eventMark(tournament))}</span>
        <a class="feature-event__hit" href="${eventUrl(tournament)}" aria-label="View ${escapeHtml(tournament.name)} details"></a>
        <span class="feature-event__caption"><small>${escapeHtml(tournament.stage)}</small><strong>${escapeHtml(tournament.formatLabel)}</strong></span>
        <span class="feature-event__scan" aria-hidden="true"></span>
        <span class="feature-event__glitch" aria-hidden="true"></span>
      </div>
    </article>`;
}

function renderEventPreview() {
  const grid = document.querySelector("#homeEventGrid");
  if (!grid) return;
  const ordered = [...tournaments].sort((a, b) => Number(getEventState(b).open) - Number(getEventState(a).open));
  grid.innerHTML = ordered.length
    ? ordered.map((tournament, index) => eventCard(tournament, { compact: true, eager: index === 0 })).join("")
    : '<div class="empty-state"><h2>No matches published</h2><p>The next match will appear here when its schedule is ready.</p></div>';
}

function renderLiveFacts() {
  const solo = tournaments.find((tournament) => tournament.type === "solo" && !tournament.comingSoon);
  const openTimeSlots = getOpenTimeSlots(solo);
  const state = getEventState(solo);
  document.querySelector("#homeEventCount").textContent = String(openTimeSlots.length).padStart(2, "0");
  document.querySelector("#homeKillReward").textContent = formatCurrency(solo?.killReward);
  document.querySelector("#homeBooyahBonus").textContent = formatCurrency(solo?.booyahBonus);

  const heroSchedule = document.querySelector("#homeHeroSchedule");
  const matchStatusCopy = document.querySelector("#homeMatchStatusCopy");
  const heroSignal = document.querySelector("#homeHeroSignal");
  if (state.key === "complete") {
    heroSchedule.textContent = "Both scheduled Solo lobbies are completed.";
    matchStatusCopy.textContent = "Solo Survival 01 is completed. Check confirmed players and published Booyah winners.";
    heroSignal.innerHTML = "<i></i> MATCH COMPLETED";
  } else if (openTimeSlots.length === 1) {
    heroSchedule.textContent = `${openTimeSlots[0].label} remains open · 50-player lobby.`;
    matchStatusCopy.textContent = `${openTimeSlots[0].label} is the remaining open Solo lobby.`;
    heroSignal.innerHTML = "<i></i> 1 LOBBY OPEN";
  }

  if (!state.open) {
    const registerAction = document.querySelector("#homeHeroActions .button--primary");
    if (registerAction) {
      const completedAction = document.createElement("span");
      completedAction.className = "button button--disabled button--large";
      completedAction.setAttribute("aria-disabled", "true");
      completedAction.textContent = state.label;
      registerAction.replaceWith(completedAction);
    }
  }
}

async function announcePublishedWinner() {
  if (!isSupabaseConfigured()) return;
  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from("match_results")
      .select("display_name, time_slot_label, published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return;
    const winnerName = String(data.display_name || "New winner").trim().slice(0, 32);
    const lobbyLabel = String(data.time_slot_label || "match").trim().slice(0, 40);
    showToast(`Booyah winner added: ${winnerName} · ${lobbyLabel}.`, 15000, {
      label: "Check winner",
      href: "booyah.html"
    });
  } catch {
    // Winner announcements are optional; Home remains usable if Supabase is unavailable.
  }
}

function initializeHome() {
  initializeShell();
  const featured = tournaments.find((tournament) => tournament.featured) || tournaments.find((tournament) => getEventState(tournament).open) || tournaments[0];
  renderEventPreview();
  renderFeaturedEvent(featured);
  renderLiveFacts();
  announcePublishedWinner();
  const support = document.querySelector("#homeSupportLink");
  const supportHref = supportUrl("joining the Solo Survival match");
  if (support && supportHref) support.href = supportHref;
  initializeMotion();
}

initializeHome();
