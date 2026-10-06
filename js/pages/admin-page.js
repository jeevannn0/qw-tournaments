import { escapeHtml, getTimeSlotState, normalize, tournaments } from "../shared/data.js?v=20261006-match-complete";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js";
import { paymentMethodLabel } from "../shared/registration-backend.js";
import { initializeShell, showToast } from "../shared/shell.js?v=20261006-mobile-compact-v2";
import { initializeMotion } from "../shared/motion.js";

const setup = document.querySelector("#adminSetup");
const signedOut = document.querySelector("#adminSignedOut");
const denied = document.querySelector("#adminDenied");
const dashboard = document.querySelector("#adminDashboard");
const rows = document.querySelector("#adminRegistrationRows");
const empty = document.querySelector("#adminEmpty");
const listMeta = document.querySelector("#adminListMeta");
const search = document.querySelector("#adminSearch");
const lobbyFilter = document.querySelector("#adminLobbyFilter");
const paymentFilter = document.querySelector("#adminPaymentFilter");
const registrationFilter = document.querySelector("#adminRegistrationFilter");
const duplicateFilter = document.querySelector("#adminDuplicateFilter");
const sortControl = document.querySelector("#adminSort");
const dialog = document.querySelector("#adminDetailDialog");
const detailContent = document.querySelector("#adminDetailContent");
const detailStatus = document.querySelector("#adminDetailStatus");
const proofView = document.querySelector("#adminProofView");
const proofImage = document.querySelector("#adminProofImage");
const loadProofButton = document.querySelector("#adminLoadProof");
const reviewForm = document.querySelector("#adminReviewForm");
const loginForm = document.querySelector("#adminLoginForm");
const winnerForm = document.querySelector("#adminWinnerForm");
const winnerMatch = document.querySelector("#adminWinnerMatch");
const winnerPlayer = document.querySelector("#adminWinnerPlayer");
const winnerKills = document.querySelector("#adminWinnerKills");
const winnerPrize = document.querySelector("#adminWinnerPrize");
const winnerImage = document.querySelector("#adminWinnerImage");
const winnerImageAlt = document.querySelector("#adminWinnerImageAlt");
const winnerStatus = document.querySelector("#adminWinnerStatus");
const winnerList = document.querySelector("#adminWinnerList");
const winnerCount = document.querySelector("#adminWinnerCount");
const publishWinnerButton = document.querySelector("#adminPublishWinner");
const WINNER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const WINNER_IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
let client = null;
let registrations = [];
let winnerCandidates = [];
let matchResults = [];
let activeRegistration = null;
let refreshTimer = 0;
let loadingRegistrations = false;
let loadingWinnerData = false;
let proofObjectUrl = "";

function timestampDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function formatTimestamp(value) {
  const date = timestampDate(value);
  if (!date) return "Pending timestamp";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

function projectedRegistration(row) {
  return {
    id: normalize(row.id).slice(0, 50),
    reference: normalize(row.reference).slice(0, 40),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    tournamentName: normalize(row.tournament_name).slice(0, 80),
    timeSlot: {
      id: normalize(row.time_slot_id).slice(0, 64),
      label: normalize(row.time_slot_label).slice(0, 40),
      startsAt: row.time_slot_at
    },
    ownerUserId: normalize(row.owner_user_id).slice(0, 128),
    participant: {
      displayName: normalize(row.display_name).slice(0, 32),
      uid: normalize(row.ff_uid).slice(0, 12),
      age: Number(row.age)
    },
    contactWhatsapp: normalize(row.contact_whatsapp).slice(0, 16),
    payment: {
      method: normalize(row.payment_method).slice(0, 24),
      transactionReference: normalize(row.payment_reference).slice(0, 40),
      amount: Number(row.payment_amount),
      screenshotPath: normalize(row.screenshot_path).slice(0, 400),
      contentType: normalize(row.screenshot_content_type).slice(0, 40),
      size: Number(row.screenshot_size)
    },
    paymentStatus: normalize(row.payment_status || "pending").slice(0, 24),
    registrationStatus: normalize(row.registration_status || "pending").slice(0, 24),
    slot: Number.isInteger(Number(row.slot)) ? Number(row.slot) : null,
    organizerNote: normalize(row.organizer_note).slice(0, 500),
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at
  };
}

function registrationMatchState(registration) {
  const tournament = tournaments.find((item) => item.id === registration?.tournamentId);
  return getTimeSlotState(tournament, {
    id: registration?.timeSlot?.id,
    startsAt: registration?.timeSlot?.startsAt,
    spotsLeft: 1
  });
}

function availableWinnerMatches() {
  return tournaments.flatMap((tournament) => (tournament.comingSoon || !Array.isArray(tournament.timeSlots) ? [] : tournament.timeSlots.map((timeSlot) => ({
    key: `${tournament.id}|${timeSlot.id}`,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    timeSlotId: timeSlot.id,
    timeSlotLabel: timeSlot.label,
    startsAt: timeSlot.startsAt,
    state: getTimeSlotState(tournament, timeSlot),
    killReward: Number(tournament.killReward) || 0,
    booyahBonus: Number(tournament.booyahBonus) || 0
  }))));
}

function selectedWinnerMatch() {
  return availableWinnerMatches().find((match) => match.key === winnerMatch.value) || null;
}

function projectedWinnerCandidate(row) {
  return {
    id: normalize(row.id).slice(0, 50),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    timeSlotId: normalize(row.time_slot_id).slice(0, 64),
    timeSlotLabel: normalize(row.time_slot_label).slice(0, 40),
    displayName: normalize(row.display_name).slice(0, 32),
    uid: normalize(row.ff_uid).slice(0, 12),
    slot: Number(row.slot)
  };
}

function projectedMatchResult(row) {
  return {
    id: normalize(row.id).slice(0, 50),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    timeSlotId: normalize(row.time_slot_id).slice(0, 64),
    timeSlotLabel: normalize(row.time_slot_label).slice(0, 40),
    displayName: normalize(row.display_name).slice(0, 32),
    uid: normalize(row.ff_uid).slice(0, 12),
    kills: row.kills === null ? null : Number(row.kills),
    prizeAmount: Number(row.prize_amount),
    imagePath: normalize(row.image_path).slice(0, 400),
    imageAlt: normalize(row.image_alt).slice(0, 180),
    publishedAt: row.published_at
  };
}

function activeMatchResult(match = selectedWinnerMatch()) {
  return matchResults.find((result) => result.tournamentId === match?.tournamentId && result.timeSlotId === match?.timeSlotId) || null;
}

function calculatedPrize(match = selectedWinnerMatch()) {
  const kills = Number(winnerKills.value);
  return match ? match.booyahBonus + (Number.isInteger(kills) && kills >= 0 ? kills * match.killReward : 0) : 0;
}

function setWinnerStatus(title, message = "") {
  winnerStatus.hidden = false;
  winnerStatus.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ""}`;
}

function renderWinnerResults() {
  winnerCount.textContent = `${matchResults.length} ${matchResults.length === 1 ? "card" : "cards"} published`;
  winnerList.innerHTML = matchResults.length ? matchResults.map((result) => `
    <article class="admin-winner-result">
      <div><span>${escapeHtml(result.timeSlotLabel)}</span><strong>${escapeHtml(result.displayName)}</strong><code>${escapeHtml(result.uid)}</code></div>
      <div><span>${result.kills === null ? "Kills not recorded" : `${escapeHtml(result.kills)} verified kills`}</span><strong>₹${escapeHtml(result.prizeAmount)}</strong><small>${escapeHtml(formatTimestamp(result.publishedAt))}</small></div>
      <button class="button admin-delete-button" type="button" data-remove-winner="${escapeHtml(result.id)}">Remove card</button>
    </article>`).join("") : '<p class="admin-winner-empty">No winner cards published yet.</p>';
}

function syncWinnerEditor({ preserveValues = false } = {}) {
  const match = selectedWinnerMatch();
  const result = activeMatchResult(match);
  const candidates = winnerCandidates
    .filter((player) => player.tournamentId === match?.tournamentId && player.timeSlotId === match?.timeSlotId)
    .sort((a, b) => a.slot - b.slot);

  winnerPlayer.innerHTML = candidates.length
    ? `<option value="">Choose confirmed player</option>${candidates.map((player) => `<option value="${escapeHtml(player.id)}">No. ${escapeHtml(player.slot)} · ${escapeHtml(player.displayName)} · ${escapeHtml(player.uid)}</option>`).join("")}`
    : '<option value="">No confirmed players in this lobby</option>';
  winnerPlayer.disabled = !candidates.length;
  if (result && candidates.some((player) => player.id === result.winnerPublicPlayerId)) {
    winnerPlayer.value = result.winnerPublicPlayerId;
  }

  winnerImage.required = !result;
  winnerImage.setAttribute("aria-required", String(!result));
  publishWinnerButton.textContent = result ? "Update winner card" : "Publish winner card";
  document.querySelector("#adminWinnerImageHelp").textContent = result
    ? "Optional when updating. Choose a new JPG, PNG, or WebP to replace the current image; maximum 2 MB."
    : "Required for a new card. JPG, PNG, or WebP; maximum 2 MB.";

  if (!preserveValues) {
    winnerKills.value = result?.kills ?? 0;
    winnerPrize.value = result?.prizeAmount ?? calculatedPrize(match);
    winnerImageAlt.value = result?.imageAlt || "";
  }
  if (result) {
    const currentWinner = candidates.find((player) => player.displayName === result.displayName && player.uid === result.uid);
    if (currentWinner) winnerPlayer.value = currentWinner.id;
  }
}

async function loadWinnerData() {
  if (!client || loadingWinnerData || dashboard.hidden) return;
  loadingWinnerData = true;
  try {
    const [playersResponse, resultsResponse] = await Promise.all([
      client.from("public_players").select("id, tournament_id, time_slot_id, time_slot_label, display_name, ff_uid, slot").order("time_slot_at", { ascending: true }).order("slot", { ascending: true }),
      client.from("match_results").select("id, tournament_id, time_slot_id, time_slot_label, winner_public_player_id, display_name, ff_uid, kills, prize_amount, image_path, image_alt, published_at").order("time_slot_at", { ascending: false })
    ]);
    if (playersResponse.error) throw playersResponse.error;
    if (resultsResponse.error) throw resultsResponse.error;
    winnerCandidates = (playersResponse.data || []).map(projectedWinnerCandidate);
    matchResults = (resultsResponse.data || []).map((row) => ({ ...projectedMatchResult(row), winnerPublicPlayerId: normalize(row.winner_public_player_id).slice(0, 50) }));
    winnerStatus.hidden = true;
    renderWinnerResults();
    syncWinnerEditor();
  } catch (error) {
    setWinnerStatus("Booyah publisher unavailable", error?.message || "Apply the Booyah results migration in Supabase.");
    winnerCandidates = [];
    matchResults = [];
    renderWinnerResults();
    syncWinnerEditor();
  } finally {
    loadingWinnerData = false;
  }
}

async function publishWinner(event) {
  event.preventDefault();
  const match = selectedWinnerMatch();
  const player = winnerCandidates.find((candidate) => candidate.id === winnerPlayer.value);
  const existing = activeMatchResult(match);
  const kills = Number(winnerKills.value);
  const prizeAmount = Number(winnerPrize.value);
  const image = winnerImage.files?.[0];

  if (!match || !player || player.tournamentId !== match.tournamentId || player.timeSlotId !== match.timeSlotId) {
    setWinnerStatus("Choose a confirmed winner", "The player must belong to the selected lobby.");
    return;
  }
  if (!Number.isInteger(kills) || kills < 0 || kills > 99) {
    setWinnerStatus("Check verified kills", "Enter a whole number from 0 to 99.");
    winnerKills.focus();
    return;
  }
  if (!Number.isInteger(prizeAmount) || prizeAmount < 0 || prizeAmount > 1000000) {
    setWinnerStatus("Check the prize", "Enter a whole rupee amount from ₹0 to ₹10,00,000.");
    winnerPrize.focus();
    return;
  }
  if (!existing && !image) {
    setWinnerStatus("Winner image required", "Choose a JPG, PNG, or WebP image no larger than 2 MB.");
    winnerImage.focus();
    return;
  }
  if (image && (!WINNER_IMAGE_TYPES.has(image.type) || image.size === 0 || image.size > WINNER_IMAGE_MAX_BYTES)) {
    setWinnerStatus("Winner image rejected", "Use a JPG, PNG, or WebP image no larger than 2 MB.");
    winnerImage.focus();
    return;
  }

  publishWinnerButton.disabled = true;
  publishWinnerButton.textContent = image ? "Uploading and publishing…" : "Updating winner…";
  winnerStatus.hidden = true;
  let uploadedPath = "";
  let imagePath = existing?.imagePath || "";

  try {
    if (image) {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw userError || new Error("Organizer session expired.");
      const imageId = window.crypto?.randomUUID?.();
      if (!imageId) throw new Error("This browser cannot create a secure image identifier.");
      imagePath = `${userData.user.id}/${imageId}.${WINNER_IMAGE_TYPES.get(image.type)}`;
      const { error: uploadError } = await client.storage.from("winner-images").upload(imagePath, image, {
        contentType: image.type,
        cacheControl: "0",
        upsert: false
      });
      if (uploadError) throw uploadError;
      uploadedPath = imagePath;
    }

    const imageAlt = normalize(winnerImageAlt.value).slice(0, 180)
      || `${player.displayName} celebrates winning ${match.timeSlotLabel}`;
    const { error: publishError } = await client.rpc("publish_match_result", {
      p_tournament_id: match.tournamentId,
      p_time_slot_id: match.timeSlotId,
      p_winner_public_player_id: player.id,
      p_kills: kills,
      p_prize_amount: prizeAmount,
      p_image_path: imagePath,
      p_image_alt: imageAlt
    });
    if (publishError) throw publishError;

    if (uploadedPath && existing?.imagePath && existing.imagePath !== uploadedPath) {
      const { error: cleanupError } = await client.storage.from("winner-images").remove([existing.imagePath]);
      if (cleanupError) showToast("Winner updated, but the previous image needs manual Storage cleanup.", 7000);
    }
    showToast(existing ? "Winner card updated on the Booyah page." : "Winner card published on the Booyah page.");
    winnerImage.value = "";
    await loadWinnerData();
    winnerMatch.value = match.key;
    syncWinnerEditor();
  } catch (error) {
    if (uploadedPath) await client.storage.from("winner-images").remove([uploadedPath]);
    setWinnerStatus("Winner card not published", error?.message || "Supabase rejected the result.");
  } finally {
    publishWinnerButton.disabled = false;
    publishWinnerButton.textContent = activeMatchResult(match) ? "Update winner card" : "Publish winner card";
  }
}

async function removeWinner(result, button) {
  if (!result || !window.confirm(`Remove ${result.displayName}'s ${result.timeSlotLabel} winner card?`)) return;
  button.disabled = true;
  button.textContent = "Removing…";
  try {
    const { data: imagePath, error } = await client.rpc("remove_match_result", { p_result_id: result.id });
    if (error) throw error;
    const { error: storageError } = await client.storage.from("winner-images").remove([imagePath]);
    if (storageError) showToast("Winner card removed, but its image needs manual Storage cleanup.", 7000);
    else showToast("Winner card removed from the Booyah page.");
    await loadWinnerData();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Remove card";
    setWinnerStatus("Winner card not removed", error?.message || "Supabase rejected the request.");
  }
}

function statusBadge(value) {
  const success = value === "verified" || value === "confirmed";
  const warning = value === "pending";
  const key = success ? "open" : warning ? "closing" : "closed";
  return `<span class="status-badge status-badge--${key}"><i aria-hidden="true"></i>${escapeHtml(value.replaceAll("-", " "))}</span>`;
}

function annotateDuplicateTransactions(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.payment.transactionReference;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  items.forEach((item) => { item.duplicateCount = counts.get(item.payment.transactionReference) || 1; });
  return items;
}

function visibleRegistrations() {
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const visible = registrations.filter((registration) => {
    const matchesSearch = !query || [
      registration.reference,
      registration.participant.displayName,
      registration.participant.uid,
      registration.timeSlot.label,
      registration.contactWhatsapp,
      registration.payment.transactionReference
    ].some((value) => value.toLowerCase().includes(query));
    const matchesLobby = lobbyFilter.value === "all" || registration.timeSlot.id === lobbyFilter.value;
    const matchesPayment = paymentFilter.value === "all" || registration.paymentStatus === paymentFilter.value;
    const matchesRegistration = registrationFilter.value === "all" || registration.registrationStatus === registrationFilter.value;
    const matchesDuplicate = duplicateFilter.value === "all"
      || (duplicateFilter.value === "duplicates" && registration.duplicateCount > 1)
      || (duplicateFilter.value === "unique" && registration.duplicateCount === 1);
    return matchesSearch && matchesLobby && matchesPayment && matchesRegistration && matchesDuplicate;
  });

  return visible.sort((a, b) => {
    if (sortControl.value === "oldest") return timestampDate(a.submittedAt) - timestampDate(b.submittedAt);
    if (sortControl.value === "lobby") return String(a.timeSlot.startsAt).localeCompare(String(b.timeSlot.startsAt)) || Number(a.slot || 999) - Number(b.slot || 999);
    if (sortControl.value === "player") return a.participant.displayName.localeCompare(b.participant.displayName);
    if (sortControl.value === "transaction") return a.payment.transactionReference.localeCompare(b.payment.transactionReference);
    return timestampDate(b.submittedAt) - timestampDate(a.submittedAt);
  });
}

function renderMetrics() {
  document.querySelector("#adminTotal").textContent = String(registrations.length);
  document.querySelector("#adminPending").textContent = String(registrations.filter((item) => item.registrationStatus === "pending").length);
  document.querySelector("#adminPaid").textContent = String(registrations.filter((item) => item.paymentStatus === "verified").length);
  document.querySelector("#adminConfirmed").textContent = String(registrations.filter((item) => item.registrationStatus === "confirmed").length);
  document.querySelector("#adminDuplicates").textContent = String(new Set(registrations.filter((item) => item.duplicateCount > 1).map((item) => item.payment.transactionReference)).size);
}

function renderRegistrations() {
  renderMetrics();
  const visible = visibleRegistrations();
  listMeta.textContent = `${visible.length} of ${registrations.length} registrations shown`;
  empty.hidden = visible.length !== 0;
  document.querySelector(".admin-table-wrap").hidden = visible.length === 0;
  rows.innerHTML = visible.map((registration) => `
    <tr>
      <td data-label="Submitted">${escapeHtml(formatTimestamp(registration.submittedAt))}</td>
      <td data-label="Player"><strong>${escapeHtml(registration.participant.displayName || "Unnamed")}</strong><small>${escapeHtml(registration.participant.uid)}</small></td>
      <td data-label="Lobby"><strong>${escapeHtml(registration.timeSlot.label)}</strong><small>${escapeHtml(formatTimestamp(registration.timeSlot.startsAt))} · ${escapeHtml(registrationMatchState(registration).label)}</small></td>
      <td data-label="Reference"><code>${escapeHtml(registration.reference)}</code></td>
      <td data-label="Payment / UTR"><div class="admin-payment-cell">${statusBadge(registration.paymentStatus)}<code>${escapeHtml(registration.payment.transactionReference)}</code>${registration.duplicateCount > 1 ? `<span class="duplicate-warning">Duplicate ×${registration.duplicateCount}</span>` : ""}</div></td>
      <td data-label="Registration">${statusBadge(registration.registrationStatus)}</td>
      <td data-label="Action"><div class="admin-row-actions"><button class="button button--quiet" type="button" data-open-registration="${escapeHtml(registration.id)}">Review</button><button class="button admin-delete-button" type="button" data-delete-registration="${escapeHtml(registration.id)}" ${["cancelled", "rejected"].includes(registration.registrationStatus) ? "" : 'disabled title="Cancel or reject before deleting"'}>Delete</button></div></td>
    </tr>`).join("");
}

function exportPaymentReport(items, scopeLabel) {
  if (!items.length) {
    showToast("No registrations match this PDF export.");
    return;
  }

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    showToast("PDF window was blocked. Allow pop-ups for the admin page and try again.", 7000);
    return;
  }
  reportWindow.opener = null;

  const duplicateReferences = new Set(items.filter((item) => item.duplicateCount > 1).map((item) => item.payment.transactionReference));
  const verifiedCount = items.filter((item) => item.paymentStatus === "verified").length;
  const totalAmount = items.reduce((sum, item) => sum + Number(item.payment.amount || 0), 0);
  const rowsHtml = items.map((item) => `
    <tr class="${item.duplicateCount > 1 ? "duplicate" : ""}">
      <td class="check">☐</td>
      <td>${escapeHtml(formatTimestamp(item.submittedAt))}</td>
      <td><strong>${escapeHtml(item.timeSlot.label)}</strong><br>${escapeHtml(formatTimestamp(item.timeSlot.startsAt))}<br><small>${escapeHtml(registrationMatchState(item).label)}</small></td>
      <td>${escapeHtml(item.participant.displayName)}<br><small>${escapeHtml(item.participant.uid)}</small></td>
      <td>${escapeHtml(item.contactWhatsapp)}</td>
      <td><code>${escapeHtml(item.payment.transactionReference)}</code>${item.duplicateCount > 1 ? `<br><b>Duplicate ×${item.duplicateCount}</b>` : ""}</td>
      <td>₹${escapeHtml(item.payment.amount)}</td>
      <td>${escapeHtml(item.paymentStatus)}</td>
      <td>${escapeHtml(item.registrationStatus)}</td>
      <td>${escapeHtml(item.slot ?? "—")}</td>
      <td><code>${escapeHtml(item.reference)}</code></td>
    </tr>`).join("");

  reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QW payment reconciliation</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; font-family: Arial, sans-serif; font-size: 9px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { display: flex; gap: 18px; margin: 0 0 12px; padding: 8px; border: 1px solid #777; }
    .warning { margin-bottom: 10px; padding: 7px; border: 1px solid #b42318; color: #7a271a; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #888; padding: 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #eee; font-size: 8px; text-transform: uppercase; }
    tr.duplicate td { background: #fff1f0; }
    td.check { width: 18px; font-size: 15px; }
    code { font-family: Consolas, monospace; font-size: 8px; }
    b { color: #b42318; }
    small { color: #555; }
    footer { margin-top: 10px; color: #555; }
  </style></head><body>
    <h1>QW Tournaments — Payment Reconciliation</h1>
    <div class="meta"><span><strong>Scope:</strong> ${escapeHtml(scopeLabel)}</span><span><strong>Records:</strong> ${items.length}</span><span><strong>Claimed total:</strong> ₹${totalAmount}</span><span><strong>Verified:</strong> ${verifiedCount}</span><span><strong>Duplicate UTRs:</strong> ${duplicateReferences.size}</span><span><strong>Generated:</strong> ${escapeHtml(formatTimestamp(new Date()))}</span></div>
    <div class="warning">Private organizer report. Cross-check every UTR against the actual receiving account. A screenshot is not payment confirmation. Do not share this PDF publicly.</div>
    <table><thead><tr><th>Match</th><th>Submitted</th><th>Lobby</th><th>Player / UID</th><th>WhatsApp</th><th>UTR</th><th>Amount</th><th>Payment</th><th>Registration</th><th>Player no.</th><th>Reference</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <footer>Payment screenshots are intentionally excluded. Review them only inside the protected organizer dashboard.</footer>
  </body></html>`);
  reportWindow.document.close();
  window.setTimeout(() => {
    reportWindow.focus();
    reportWindow.print();
  }, 250);
}

function resetProof() {
  if (proofObjectUrl) URL.revokeObjectURL(proofObjectUrl);
  proofObjectUrl = "";
  proofImage.removeAttribute("src");
  proofView.hidden = true;
  loadProofButton.disabled = false;
  loadProofButton.textContent = "Load private screenshot";
}

function detailPair(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

function openRegistration(registration) {
  activeRegistration = registration;
  resetProof();
  detailStatus.hidden = true;
  document.querySelector("#adminDetailTitle").textContent = registration.reference;
  detailContent.innerHTML = `
    <section><h3>Player</h3><dl class="admin-detail-list">${detailPair("In-game name", registration.participant.displayName)}${detailPair("Free Fire UID", registration.participant.uid)}${detailPair("Age", String(registration.participant.age))}${detailPair("Private WhatsApp", registration.contactWhatsapp)}</dl></section>
    <section><h3>Payment</h3><dl class="admin-detail-list">${detailPair("Amount", `₹${registration.payment.amount}`)}${detailPair("Method", paymentMethodLabel(registration.payment.method))}${detailPair("Transaction reference", registration.payment.transactionReference)}${detailPair("Automatic UTR check", registration.duplicateCount > 1 ? `Duplicate across ${registration.duplicateCount} registrations` : "Unique in current registrations")}${detailPair("File", `${registration.payment.contentType} · ${(registration.payment.size / (1024 * 1024)).toFixed(2)} MB`)}</dl></section>
    <section><h3>Submission</h3><dl class="admin-detail-list">${detailPair("Tournament", registration.tournamentName)}${detailPair("Selected lobby", `${registration.timeSlot.label} — ${formatTimestamp(registration.timeSlot.startsAt)} — ${registrationMatchState(registration).label}`)}${detailPair("Submitted", formatTimestamp(registration.submittedAt))}${detailPair("Updated", formatTimestamp(registration.updatedAt))}${detailPair("Database record", registration.id)}</dl></section>`;
  document.querySelector("#adminPaymentStatus").value = registration.paymentStatus;
  document.querySelector("#adminRegistrationStatus").value = registration.registrationStatus;
  document.querySelector("#adminSlot").value = registration.slot || "";
  document.querySelector("#adminOrganizerNote").value = registration.organizerNote;
  const digits = registration.contactWhatsapp.replace(/\D/g, "");
  document.querySelector("#adminWhatsappPlayer").href = `https://wa.me/${digits}?text=${encodeURIComponent(`Hi, this is QW Tournaments regarding registration ${registration.reference}.`)}`;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog() {
  resetProof();
  activeRegistration = null;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

async function deleteRegistration(registration, button) {
  if (!registration || !["cancelled", "rejected"].includes(registration.registrationStatus)) return;
  const confirmed = window.confirm(
    `Permanently delete ${registration.reference}?\n\nThis removes the private registration and payment screenshot. This action cannot be undone.`
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting…";
  try {
    const { error: databaseError } = await client.rpc("delete_registration", {
      p_registration_id: registration.id
    });
    if (databaseError) throw databaseError;

    const { error: storageError } = await client.storage
      .from("payment-proofs")
      .remove([registration.payment.screenshotPath]);
    if (storageError) {
      showToast("Registration deleted, but screenshot cleanup needs attention in Supabase Storage.", 7000);
    } else {
      showToast("Registration and private screenshot permanently deleted.");
    }
    await loadRegistrations();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Delete";
    showToast(error?.message || "Registration could not be deleted.", 7000);
  }
}

async function loadPaymentProof() {
  if (!activeRegistration?.payment.screenshotPath || !client) return;
  loadProofButton.disabled = true;
  loadProofButton.textContent = "Loading private screenshot…";
  try {
    const { data, error } = await client.storage
      .from("payment-proofs")
      .download(activeRegistration.payment.screenshotPath);
    if (error) throw error;
    proofObjectUrl = URL.createObjectURL(data);
    proofImage.src = proofObjectUrl;
    proofView.hidden = false;
    loadProofButton.textContent = "Screenshot loaded";
  } catch (error) {
    loadProofButton.disabled = false;
    loadProofButton.textContent = "Try loading screenshot again";
    detailStatus.hidden = false;
    detailStatus.innerHTML = `<strong>Screenshot unavailable</strong><p>${escapeHtml(error?.message || "Supabase denied the file request.")}</p>`;
  }
}

async function saveReview(event) {
  event.preventDefault();
  if (!activeRegistration || !client) return;
  const paymentStatus = document.querySelector("#adminPaymentStatus").value;
  const registrationStatus = document.querySelector("#adminRegistrationStatus").value;
  const slotValue = document.querySelector("#adminSlot").value;
  const slot = slotValue ? Number(slotValue) : null;
  const organizerNote = normalize(document.querySelector("#adminOrganizerNote").value).slice(0, 500);

  if (registrationStatus === "confirmed" && paymentStatus !== "verified") {
    detailStatus.hidden = false;
    detailStatus.innerHTML = "<strong>Payment must be verified before confirmation.</strong>";
    return;
  }
  if (registrationStatus === "confirmed" && (!Number.isInteger(slot) || slot < 1 || slot > 50)) {
    detailStatus.hidden = false;
    detailStatus.innerHTML = "<strong>Assign a player number from 1 to 50 in the selected lobby before confirmation.</strong>";
    return;
  }

  const saveButton = document.querySelector("#adminSaveReview");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  detailStatus.hidden = true;
  try {
    const { error } = await client.rpc("review_registration", {
      p_registration_id: activeRegistration.id,
      p_payment_status: paymentStatus,
      p_registration_status: registrationStatus,
      p_slot: slot,
      p_note: organizerNote
    });
    if (error) throw error;
    showToast(registrationStatus === "confirmed" ? "Registration confirmed and public roster updated." : "Private review saved.");
    closeDialog();
    await loadRegistrations();
  } catch (error) {
    detailStatus.hidden = false;
    detailStatus.innerHTML = `<strong>Review not saved</strong><p>${escapeHtml(error?.message || "Supabase rejected the update.")}</p>`;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save review";
  }
}

async function loadRegistrations() {
  if (!client || loadingRegistrations || dashboard.hidden) return;
  loadingRegistrations = true;
  listMeta.textContent = "Loading registrations…";
  try {
    const { data, error } = await client
      .from("registrations")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    registrations = annotateDuplicateTransactions((data || []).map(projectedRegistration));
    renderRegistrations();
  } catch (error) {
    listMeta.textContent = `Registrations could not load: ${error?.message || "Supabase denied the query."}`;
  } finally {
    loadingRegistrations = false;
  }
}

function stopRegistrationFeed() {
  window.clearInterval(refreshTimer);
  refreshTimer = 0;
  registrations = [];
  winnerCandidates = [];
  matchResults = [];
  renderRegistrations();
  renderWinnerResults();
}

function refreshAdminData() {
  loadRegistrations();
  loadWinnerData();
}

function startRegistrationFeed() {
  stopRegistrationFeed();
  refreshAdminData();
  refreshTimer = window.setInterval(refreshAdminData, 30000);
}

async function showAuthenticatedState(user) {
  signedOut.hidden = true;
  dashboard.hidden = true;
  denied.hidden = true;
  const { data, error } = await client
    .from("admin_users")
    .select("active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.active !== true || user.is_anonymous) {
    denied.hidden = false;
    document.querySelector("#adminDeniedMessage").textContent = `${user.email || "This account"} is signed in but is not on the active organizer list.`;
    stopRegistrationFeed();
    return;
  }
  dashboard.hidden = false;
  document.querySelector("#adminIdentity").textContent = user.email || user.id;
  startRegistrationFeed();
}

async function showSession(session) {
  const user = session?.user;
  if (!user || user.is_anonymous) {
    signedOut.hidden = false;
    denied.hidden = true;
    dashboard.hidden = true;
    stopRegistrationFeed();
    return;
  }
  try {
    await showAuthenticatedState(user);
  } catch (error) {
    denied.hidden = false;
    signedOut.hidden = true;
    dashboard.hidden = true;
    document.querySelector("#adminDeniedMessage").textContent = error?.message || "Organizer access could not be verified.";
  }
}

async function signIn(event) {
  event.preventDefault();
  const button = document.querySelector("#adminSignIn");
  const email = normalize(document.querySelector("#adminEmail").value).toLowerCase();
  const password = document.querySelector("#adminPassword").value;
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    loginForm.reset();
  } catch (error) {
    showToast(error?.message || "Organizer sign-in did not complete.");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in securely";
  }
}

async function signOutAdmin() {
  closeDialog();
  stopRegistrationFeed();
  const { error } = await client.auth.signOut();
  if (error) showToast(error.message);
}

async function initializeAdmin() {
  initializeShell();
  initializeMotion();
  if (!isSupabaseConfigured()) {
    setup.hidden = false;
    return;
  }
  try {
    client = await getSupabaseClient();
    const winnerMatches = availableWinnerMatches();
    winnerMatch.innerHTML = winnerMatches.map((match) => `<option value="${escapeHtml(match.key)}">${escapeHtml(match.tournamentName)} · ${escapeHtml(match.timeSlotLabel)} · ${escapeHtml(match.state.label)} · ${escapeHtml(formatTimestamp(match.startsAt))}</option>`).join("");
    winnerMatch.disabled = !winnerMatches.length;
    syncWinnerEditor();
    winnerMatch.addEventListener("change", () => syncWinnerEditor());
    winnerKills.addEventListener("input", () => { winnerPrize.value = String(calculatedPrize()); });
    winnerForm.addEventListener("submit", publishWinner);
    winnerList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-winner]");
      if (!button) return;
      const result = matchResults.find((item) => item.id === button.dataset.removeWinner);
      if (result) removeWinner(result, button);
    });
    loginForm.addEventListener("submit", signIn);
    document.querySelector("#adminSignOut").addEventListener("click", signOutAdmin);
    document.querySelector("#adminDeniedSignOut").addEventListener("click", signOutAdmin);
    document.querySelector("#adminDetailClose").addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
    loadProofButton.addEventListener("click", loadPaymentProof);
    reviewForm.addEventListener("submit", saveReview);
    rows.addEventListener("click", (event) => {
      const reviewButton = event.target.closest("[data-open-registration]");
      if (reviewButton) {
        const registration = registrations.find((item) => item.id === reviewButton.dataset.openRegistration);
        if (registration) openRegistration(registration);
        return;
      }
      const deleteButton = event.target.closest("[data-delete-registration]");
      if (deleteButton) {
        const registration = registrations.find((item) => item.id === deleteButton.dataset.deleteRegistration);
        if (registration) deleteRegistration(registration, deleteButton);
      }
    });
    search.addEventListener("input", renderRegistrations);
    [lobbyFilter, paymentFilter, registrationFilter, duplicateFilter, sortControl]
      .forEach((control) => control.addEventListener("change", renderRegistrations));
    document.querySelector("#adminExportFiltered").addEventListener("click", () => exportPaymentReport(visibleRegistrations(), "Current filters"));
    document.querySelector("#adminExportAll").addEventListener("click", () => exportPaymentReport([...registrations], "All registrations"));
    client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => showSession(session), 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await showSession(data.session);
  } catch (error) {
    setup.hidden = false;
    setup.innerHTML = `<strong>Supabase could not start</strong><p>${escapeHtml(error?.message || "Check the public configuration.")}</p>`;
  }
}

initializeAdmin();
