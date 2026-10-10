import { escapeHtml, getEventPresentation, getTimeSlotState, normalize, tournaments } from "../shared/data.js?v=20261013-squad-results";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js?v=20261013-squad-results";
import {
  applyMatchCardOverride,
  getMatchCardDefaults,
  hydrateTournamentOverrides,
  loadAdminMatchCardOverrides,
  MATCH_CARD_IDS,
  resetMatchCardPresentation,
  restoreOccupancy
} from "../shared/tournament-backend.js?v=20261013-squad-results";
import { paymentMethodLabel } from "../shared/registration-backend.js?v=20261013-squad-results";
import { clearCustomRoomCredentials, loadActiveCustomRooms, saveCustomRoomCredentials } from "../shared/custom-room-backend.js?v=20261013-squad-results";
import { initializeShell, showToast } from "../shared/shell.js?v=20261013-squad-results";
import { initializeMotion } from "../shared/motion.js?v=20261013-squad-results";

const setup = document.querySelector("#adminSetup");
const signedOut = document.querySelector("#adminSignedOut");
const denied = document.querySelector("#adminDenied");
const dashboard = document.querySelector("#adminDashboard");
const rows = document.querySelector("#adminRegistrationRows");
const paymentTournaments = document.querySelector("#adminPaymentTournaments");
const paymentMatchCards = document.querySelector("#adminPaymentMatchCards");
const statsStrip = document.querySelector("#adminStats");
const filtersDisclosure = document.querySelector("#adminFilters");
const filterCount = document.querySelector("#adminFilterCount");
const liveSummary = document.querySelector("#adminLiveSummary");
const pendingBadge = document.querySelector("#adminPendingBadge");
const matchSelectorCards = document.querySelector("#adminMatchSelectorCards");
const matchStateOptions = document.querySelector("#adminMatchStateOptions");
const matchCopyDisclosure = document.querySelector("#adminMatchCopy");
const slotLabel = document.querySelector("#adminSlotLabel");
const slotValue = document.querySelector("#adminSlotValue");
const slotHint = document.querySelector("#adminSlotHint");
const detailKicker = document.querySelector("#adminDetailKicker");
const deleteButton = document.querySelector("#adminDeleteRegistration");
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
const reviewPaymentStatus = document.querySelector("#adminPaymentStatus");
const reviewRegistrationStatus = document.querySelector("#adminRegistrationStatus");
const reviewSlot = document.querySelector("#adminSlot");
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
const adminTabs = [...document.querySelectorAll("[data-admin-tab]")];
const adminPanels = [...document.querySelectorAll("[data-admin-panel]")];
const matchForm = document.querySelector("#adminMatchForm");
const matchSelector = document.querySelector("#adminMatchSelector");
const matchId = document.querySelector("#adminMatchId");
const matchVersion = document.querySelector("#adminMatchVersion");
const matchPublicLink = document.querySelector("#adminMatchPublicLink");
const matchName = document.querySelector("#adminMatchName");
const matchTagline = document.querySelector("#adminMatchTagline");
const matchDescription = document.querySelector("#adminMatchDescription");
const matchPresentationMode = document.querySelector("#adminMatchPresentationMode");
const matchScheduleFields = document.querySelector("#adminMatchScheduleFields");
const matchStateExplainer = document.querySelector("#adminMatchStateExplainer");
const matchScheduledAt = document.querySelector("#adminMatchScheduledAt");
const matchEntryFee = document.querySelector("#adminMatchEntryFee");
const matchRewardLabel = document.querySelector("#adminMatchRewardLabel");
const matchMap = document.querySelector("#adminMatchMap");
const matchRounds = document.querySelector("#adminMatchRounds");
const matchCapacity = document.querySelector("#adminMatchCapacity");
const matchLockedFacts = document.querySelector("#adminMatchLockedFacts");
const matchStatus = document.querySelector("#adminMatchStatus");
const matchSave = document.querySelector("#adminMatchSave");
const matchRestore = document.querySelector("#adminMatchRestore");
const matchReload = document.querySelector("#adminMatchReload");
const roomForm = document.querySelector("#adminRoomForm");
const roomMatch = document.querySelector("#adminRoomMatch");
const roomMatchMeta = document.querySelector("#adminRoomMatchMeta");
const roomId = document.querySelector("#adminRoomId");
const roomPassword = document.querySelector("#adminRoomPassword");
const roomStatus = document.querySelector("#adminRoomStatus");
const roomSave = document.querySelector("#adminRoomSave");
const roomClear = document.querySelector("#adminRoomClear");
const roomReload = document.querySelector("#adminRoomReload");
const WINNER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const WINNER_IMAGE_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
let client = null;
let registrations = [];
let winnerCandidates = [];
let matchResults = [];
let activeRegistration = null;
let selectedPaymentMatchKey = "";
let refreshTimer = 0;
let registrationLoadPromise = null;
let loadingWinnerData = false;
let proofObjectUrl = "";
let matchOverrides = new Map();
let matchEditorDirty = false;
let matchEditorRestoreRequested = false;
let matchEditorTournamentId = MATCH_CARD_IDS[0];
let matchEditorAvailable = true;
let activeCustomRooms = [];
let activeAdminTab = "payments";
let authTransitionToken = 0;
let adminDataGeneration = 0;
let activeOrganizerId = "";
let approvalCheckGeneration = 0;

const adminTabKeys = new Set(["payments", "booyah", "matches", "rooms"]);
const matchFieldRules = [
  [matchName, "name", 2, 80, "Enter a public title from 2 to 80 characters."],
  [matchTagline, "tagline", 5, 180, "Enter a tagline from 5 to 180 characters."],
  [matchDescription, "description", 20, 1000, "Enter a description from 20 to 1,000 characters."],
  [matchMap, "map", 2, 80, "Enter a map label from 2 to 80 characters."],
  [matchRounds, "rounds", 2, 120, "Enter a rounds label from 2 to 120 characters."]
];

function setMatchStatus(title, message = "") {
  matchStatus.hidden = false;
  matchStatus.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ""}`;
}

function setRoomStatus(title, message = "") {
  roomStatus.hidden = false;
  roomStatus.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ""}`;
}

function renderCustomRoomEditor(preferredId = roomMatch.value) {
  roomMatch.innerHTML = activeCustomRooms.length
    ? activeCustomRooms.map((room) => `<option value="${escapeHtml(room.tournamentId)}">${escapeHtml(room.tournamentName)} · ${escapeHtml(shortMatchDate(room.scheduledAt))} · ${room.active ? "Open" : "Closed"}</option>`).join("")
    : '<option value="">No match is open</option>';
  const selected = activeCustomRooms.find((room) => room.tournamentId === preferredId) || activeCustomRooms.find((room) => room.active) || activeCustomRooms[0] || null;
  if (selected) roomMatch.value = selected.tournamentId;
  const canSave = Boolean(selected?.active);
  const hasCredentials = Boolean(selected?.roomId || selected?.roomPassword);
  roomMatch.disabled = !selected;
  roomId.disabled = !canSave;
  roomPassword.disabled = !canSave;
  roomSave.disabled = !canSave;
  roomClear.disabled = !selected || !hasCredentials;
  roomId.value = selected?.roomId || "";
  roomPassword.value = selected?.roomPassword || "";
  roomMatchMeta.textContent = selected
    ? `${shortMatchDate(selected.scheduledAt)} IST · ${selected.active ? "registration open" : "closed"}${hasCredentials ? " · details published" : " · waiting for details"}`
    : "Open registration for a future match first.";
  if (selected) roomStatus.hidden = true;
}

async function loadCustomRoomEditor({ announce = false } = {}) {
  if (!client || dashboard.hidden) return;
  const generation = adminDataGeneration;
  roomReload.disabled = true;
  roomReload.textContent = "Reloading…";
  try {
    const loadedRooms = await loadActiveCustomRooms(client);
    if (generation !== adminDataGeneration || dashboard.hidden) return;
    activeCustomRooms = loadedRooms;
    renderCustomRoomEditor();
    if (announce) setRoomStatus("Active matches loaded", activeCustomRooms.length ? "Review or update the current Room details." : "No future match currently has Registration open.");
  } catch (error) {
    if (generation !== adminDataGeneration || dashboard.hidden) return;
    activeCustomRooms = [];
    renderCustomRoomEditor();
    setRoomStatus("Custom Room migration required", `${error?.message || "The Custom Room functions are unavailable."} Apply supabase-migrations/2026-10-09-custom-room-details.sql in Supabase SQL Editor.`);
  } finally {
    roomReload.disabled = false;
    roomReload.textContent = "Reload";
  }
}

async function submitCustomRoom(event) {
  event.preventDefault();
  const selected = activeCustomRooms.find((room) => room.tournamentId === roomMatch.value);
  const nextRoomId = roomId.value.trim();
  const nextPassword = roomPassword.value.trim();
  if (!selected) return setRoomStatus("Choose a current-cycle match", "Open registration for a future match first.");
  if (!selected.active) return setRoomStatus("Match is inactive", "Clear any old credentials if needed. Reopen registration before publishing new Room details.");
  if (!nextRoomId || nextRoomId.length > 64) return setRoomStatus("Check Room ID", "Enter a Room ID from 1 to 64 characters.");
  if (!nextPassword || nextPassword.length > 64) return setRoomStatus("Check room password", "Enter a password from 1 to 64 characters.");
  roomSave.disabled = true;
  roomSave.textContent = "Publishing…";
  try {
    await saveCustomRoomCredentials(client, {
      tournamentId: selected.tournamentId,
      registrationCycle: selected.registrationCycle,
      roomId: nextRoomId,
      roomPassword: nextPassword
    });
    await loadCustomRoomEditor();
    setRoomStatus("Custom Room details published", "Confirmed players can now retrieve them using their registered email.");
    showToast("Custom Room details updated.");
  } catch (error) {
    setRoomStatus("Room details not saved", error?.message || "Supabase rejected the update.");
  } finally {
    const current = activeCustomRooms.find((room) => room.tournamentId === roomMatch.value);
    roomSave.disabled = !current?.active;
    roomSave.textContent = "Publish Room details";
  }
}

async function clearCustomRoom() {
  const selected = activeCustomRooms.find((room) => room.tournamentId === roomMatch.value);
  if (!selected || (!selected.roomId && !selected.roomPassword)) return;
  if (!window.confirm(`Clear the Room ID and password for ${selected.tournamentName}?\n\nConfirmed players will immediately see the waiting message. You can publish new details later.`)) return;
  roomClear.disabled = true;
  roomClear.textContent = "Clearing…";
  try {
    await clearCustomRoomCredentials(client, selected);
    await loadCustomRoomEditor();
    setRoomStatus("Custom Room details cleared", "Players now see the waiting message until new details are published.");
    showToast("Custom Room details cleared.");
  } catch (error) {
    setRoomStatus("Room details not cleared", `${error?.message || "Supabase rejected the request."} Apply supabase-migrations/2026-10-10-clear-custom-room.sql if the clear function is unavailable.`);
  } finally {
    roomClear.textContent = "Clear Room details";
    const current = activeCustomRooms.find((room) => room.tournamentId === roomMatch.value);
    roomClear.disabled = !current || (!current.roomId && !current.roomPassword);
  }
}

function istDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function defaultIstDateTimeLocal(now = Date.now()) {
  const thirtyMinutes = 30 * 60 * 1000;
  const oneHourAhead = now + (60 * 60 * 1000);
  const roundedAhead = Math.ceil(oneHourAhead / thirtyMinutes) * thirtyMinutes;
  return istDateTimeLocal(roundedAhead);
}

function istTimestampFromLocal(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const timestamp = `${value}:00+05:30`;
  return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}

function syncMatchPresentationFields() {
  const mode = matchPresentationMode.value;
  const hasMatchFacts = mode === "scheduled" || mode === "registration_open";
  matchScheduleFields.hidden = !hasMatchFacts;
  [matchScheduledAt, matchEntryFee, matchRewardLabel].forEach((field) => {
    field.disabled = !hasMatchFacts;
    field.required = hasMatchFacts;
    if (!hasMatchFacts) field.removeAttribute("aria-invalid");
  });
  matchStateOptions.querySelectorAll('input[name="matchState"]').forEach((radio) => { radio.checked = radio.value === mode; });
  matchStateExplainer.innerHTML = mode === "registration_open"
    ? "<strong>Registration open</strong><span>Publishes one lobby and lets players or squads submit registration and payment proof. Closing it later starts a new registration cycle.</span>"
    : mode === "scheduled"
      ? "<strong>Scheduled</strong><span>Publishes date, fee, and reward while keeping registration and payment closed.</span>"
      : "<strong>Coming soon</strong><span>Hides schedule, entry, and reward terms until you schedule the next match.</span>";
}

function shortMatchDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) return "Date pending";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

function lobbyLabelIsGeneric(match) {
  return !match.timeSlotLabel || match.timeSlotLabel === `${match.tournamentName} lobby`;
}

function shortStateLabel(state) {
  return state.key === "open" ? "Open" : state.key === "complete" ? "Played" : state.label;
}

function setWinnerMatchOptions(preferredValue = winnerMatch.value) {
  const matches = availableWinnerMatches();
  winnerMatch.innerHTML = matches.map((match) => {
    const lobby = lobbyLabelIsGeneric(match) ? "" : ` · ${match.timeSlotLabel}`;
    return `<option value="${escapeHtml(match.key)}">${escapeHtml(match.tournamentName)}${escapeHtml(lobby)} · ${escapeHtml(shortMatchDate(match.startsAt))} · ${escapeHtml(shortStateLabel(match.state))}</option>`;
  }).join("");
  winnerMatch.disabled = !matches.length;
  if (matches.some((match) => match.key === preferredValue)) winnerMatch.value = preferredValue;
  syncWinnerEditor();
}

function restoreDataFocus(container, attribute, value) {
  if (!value) return;
  container.querySelector(`[${attribute}="${CSS.escape(value)}"]`)?.focus({ preventScroll: true });
}

function renderMatchSelectorCards() {
  const focused = matchSelectorCards.contains(document.activeElement) ? document.activeElement.dataset.matchCard : "";
  matchSelectorCards.innerHTML = tournaments.map((tournament) => {
    const presentation = getEventPresentation(tournament);
    const override = matchOverrides.get(tournament.id);
    const selected = tournament.id === matchSelector.value;
    return `<button class="ops-pill" type="button" aria-pressed="${selected}" data-match-card="${escapeHtml(tournament.id)}"><span class="ops-pill__code">${escapeHtml(tournament.shortCode)}</span><strong>${escapeHtml(tournament.name)}</strong><small><i class="ops-dot ops-dot--${escapeHtml(presentation.state.key)}" aria-hidden="true"></i>${escapeHtml(presentation.state.label)}${override ? ` · v${escapeHtml(override.version)}` : ""}</small></button>`;
  }).join("");
  restoreDataFocus(matchSelectorCards, "data-match-card", focused);
}

function matchEditorValues() {
  const presentationMode = matchPresentationMode.value;
  const hasMatchFacts = presentationMode === "scheduled" || presentationMode === "registration_open";
  const modeLabel = presentationMode === "registration_open" ? "Registration open" : presentationMode === "scheduled" ? "Scheduled" : "Coming soon";
  return {
    tournamentId: matchSelector.value,
    name: normalize(matchName.value),
    tagline: normalize(matchTagline.value),
    description: normalize(matchDescription.value),
    map: normalize(matchMap.value),
    rounds: normalize(matchRounds.value),
    capacity: Number(matchCapacity.value),
    presentationMode,
    scheduledAt: hasMatchFacts ? istTimestampFromLocal(matchScheduledAt.value) : null,
    entryFee: hasMatchFacts ? Number(matchEntryFee.value) : null,
    rewardLabel: hasMatchFacts ? normalize(matchRewardLabel.value) : null,
    changeNote: matchEditorRestoreRequested ? "Restored checked-in defaults" : `Updated match card to ${modeLabel}`
  };
}

function renderMatchEditor() {
  const tournament = tournaments.find((item) => item.id === matchSelector.value);
  if (!tournament) return;
  const override = matchOverrides.get(tournament.id);
  matchEditorTournamentId = tournament.id;
  matchId.textContent = tournament.id;
  matchPublicLink.href = `tournament.html?tournament=${encodeURIComponent(tournament.id)}`;
  matchName.value = tournament.name;
  matchTagline.value = tournament.tagline;
  matchDescription.value = tournament.description;
  matchPresentationMode.value = override?.presentationMode || "coming_soon";
  matchScheduledAt.value = override?.scheduledAt ? istDateTimeLocal(override.scheduledAt) : defaultIstDateTimeLocal();
  matchEntryFee.value = override?.entryFee ?? "";
  matchRewardLabel.value = override?.rewardLabel || "";
  matchMap.value = tournament.map;
  matchRounds.value = tournament.rounds;
  matchCapacity.value = String(override?.capacity ?? tournament.capacity);
  matchCapacity.disabled = false;
  matchCapacity.readOnly = false;
  document.querySelector("#adminMatchCapacityHelp").textContent = `1–500 ${tournament.type === "solo" ? "players" : "teams"}.`;
  syncMatchPresentationFields();
  renderMatchSelectorCards();
  matchVersion.textContent = override
    ? `v${override.version} · cycle ${override.registrationCycle} · saved ${shortMatchDate(override.updatedAt)}`
    : "Checked-in default · not yet saved";
  matchLockedFacts.innerHTML = [
    ["Type", tournament.type],
    ["Format", tournament.formatLabel],
    ["Server", tournament.server],
    ["Platform", tournament.platform]
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  matchCopyDisclosure.open = false;
  matchEditorDirty = false;
  matchForm.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute("aria-invalid"));
  if (matchEditorAvailable) matchStatus.hidden = true;
}

function restoreMatchEditorDefaults() {
  const checkedIn = getMatchCardDefaults(matchSelector.value);
  if (!checkedIn || !window.confirm(`Restore ${checkedIn.name} to the checked-in Coming soon copy and capacity?\n\nThis creates a new audited version and does not change historical registrations or results.`)) return;
  matchName.value = checkedIn.name;
  matchTagline.value = checkedIn.tagline;
  matchDescription.value = checkedIn.description;
  matchMap.value = checkedIn.map;
  matchRounds.value = checkedIn.rounds;
  matchCapacity.value = String(checkedIn.capacity);
  matchPresentationMode.value = "coming_soon";
  matchScheduledAt.value = defaultIstDateTimeLocal();
  matchEntryFee.value = "";
  matchRewardLabel.value = "";
  syncMatchPresentationFields();
  matchEditorDirty = true;
  matchEditorRestoreRequested = true;
  matchForm.requestSubmit();
}

function isMissingMatchCardMigration(error) {
  return ["42P01", "PGRST202", "PGRST205"].includes(error?.code)
    || /match_card_overrides|save_match_card_override/i.test(error?.message || "");
}

async function loadMatchEditor({ announce = false } = {}) {
  if (!client || !matchEditorAvailable && !announce) return;
  const generation = adminDataGeneration;
  matchReload.disabled = true;
  matchReload.textContent = "Reloading…";
  const response = await loadAdminMatchCardOverrides(client);
  matchReload.disabled = false;
  matchReload.textContent = "Reload";
  if (generation !== adminDataGeneration || dashboard.hidden) return;
  if (response.error) {
    matchEditorAvailable = false;
    matchSave.disabled = true;
    const guidance = "Apply supabase-migrations/2026-10-08-registration-open.sql in Supabase SQL Editor. Payment verification and Booyah cards remain available.";
    setMatchStatus("Match Cards migration required", isMissingMatchCardMigration(response.error) ? guidance : `${response.error.message || "The organizer rows could not load."} ${guidance}`);
    return;
  }
  matchEditorAvailable = true;
  matchSave.disabled = false;
  matchOverrides = new Map(response.rows.map((row) => [row.tournamentId, row]));
  resetMatchCardPresentation();
  response.rows.forEach(applyMatchCardOverride);
  restoreOccupancy();
  renderMatchEditor();
  renderPaymentMatchCards();
  syncRegistrationLobbyFilter();
  renderRegistrations();
  if (announce) setMatchStatus("Server version loaded", "Review the current card before making changes.");
}

function validateMatchEditor() {
  const values = matchEditorValues();
  for (const [field, key, minimum, maximum, message] of matchFieldRules) {
    if (values[key].length < minimum || values[key].length > maximum) {
      setMatchStatus("Check the match card", message);
      field.setAttribute("aria-invalid", "true");
      matchCopyDisclosure.open = true;
      field.focus();
      return null;
    }
    field.removeAttribute("aria-invalid");
  }
  if (!Number.isInteger(values.capacity) || values.capacity < 1 || values.capacity > 500) {
    setMatchStatus("Check planned capacity", "Enter a whole planned capacity from 1 to 500.");
    matchCapacity.setAttribute("aria-invalid", "true");
    matchCapacity.focus();
    return null;
  }
  matchCapacity.removeAttribute("aria-invalid");
  if (!new Set(["coming_soon", "scheduled", "registration_open"]).has(values.presentationMode)) {
    setMatchStatus("Check the match state", "Choose Coming soon, Scheduled, or Registration open.");
    matchPresentationMode.focus();
    return null;
  }
  if (values.presentationMode === "scheduled" || values.presentationMode === "registration_open") {
    if (!values.scheduledAt || Date.parse(values.scheduledAt) <= Date.now()) {
      setMatchStatus("Check match date and time", "Enter a future match date and time in IST.");
      matchScheduledAt.setAttribute("aria-invalid", "true");
      matchScheduledAt.focus();
      return null;
    }
    matchScheduledAt.removeAttribute("aria-invalid");
    const minimumFee = values.presentationMode === "registration_open" ? 1 : 0;
    if (!Number.isInteger(values.entryFee) || values.entryFee < minimumFee || values.entryFee > 100000) {
      setMatchStatus("Check entry fee", values.presentationMode === "registration_open" ? "Registration requires a whole rupee fee from 1 to 100,000." : "Enter a whole rupee amount from 0 to 100,000.");
      matchEntryFee.setAttribute("aria-invalid", "true");
      matchEntryFee.focus();
      return null;
    }
    matchEntryFee.removeAttribute("aria-invalid");
    if (values.rewardLabel.length < 5 || values.rewardLabel.length > 120) {
      setMatchStatus("Check reward summary", "Enter a reward summary from 5 to 120 characters.");
      matchRewardLabel.setAttribute("aria-invalid", "true");
      matchRewardLabel.focus();
      return null;
    }
    matchRewardLabel.removeAttribute("aria-invalid");
  }
  return values;
}

async function saveMatchEditor(event) {
  event.preventDefault();
  if (!client || !matchEditorAvailable) return;
  const values = validateMatchEditor();
  if (!values) return;
  const expectedVersion = matchOverrides.get(values.tournamentId)?.version || 0;
  matchSave.disabled = true;
  matchSave.textContent = "Saving…";
  try {
    const { data, error } = await client.rpc("save_match_card_override", {
      p_tournament_id: values.tournamentId,
      p_name: values.name,
      p_tagline: values.tagline,
      p_description: values.description,
      p_map: values.map,
      p_rounds: values.rounds,
      p_capacity: values.capacity,
      p_presentation_mode: values.presentationMode,
      p_scheduled_at: values.scheduledAt,
      p_card_entry_fee: values.entryFee,
      p_reward_label: values.rewardLabel,
      p_expected_version: expectedVersion,
      p_change_note: values.changeNote
    });
    if (error) throw error;
    const saved = { ...values, version: Number(data), updatedAt: new Date().toISOString() };
    matchOverrides.set(values.tournamentId, saved);
    applyMatchCardOverride(saved);
    restoreOccupancy();
    matchEditorDirty = false;
    setWinnerMatchOptions();
    await loadMatchEditor();
    await loadCustomRoomEditor();
    setMatchStatus("Match card saved", `Version ${Number(data)} is now available to public pages.`);
    showToast("Public match card updated safely.");
  } catch (error) {
    if (/version conflict/i.test(error?.message || "")) {
      await loadMatchEditor();
      setMatchStatus("Version conflict", "Another organizer saved this card. The latest server version is loaded; review it before saving again.");
    } else if (isMissingMatchCardMigration(error)) {
      matchEditorAvailable = false;
      matchSave.disabled = true;
      setMatchStatus("Match Cards migration required", "Apply supabase-migrations/2026-10-08-registration-open.sql in Supabase SQL Editor. Payment verification and Booyah cards remain available.");
    } else {
      setMatchStatus("Match card not saved", error?.message || "Supabase rejected the update.");
    }
  } finally {
    matchEditorRestoreRequested = false;
    matchSave.disabled = !matchEditorAvailable;
    matchSave.textContent = "Save match card";
  }
}

function activateAdminTab(key, { focus = false, updateHash = true } = {}) {
  const nextKey = adminTabKeys.has(key) ? key : "payments";
  activeAdminTab = nextKey;
  adminTabs.forEach((tab) => {
    const selected = tab.dataset.adminTab === nextKey;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) {
      if (!dashboard.hidden) tab.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "nearest" });
      if (focus) tab.focus();
    }
  });
  adminPanels.forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== nextKey; });
  if (updateHash) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${nextKey}`);
  if (nextKey === "matches" && !matchEditorDirty) loadMatchEditor();
  if (nextKey === "rooms") loadCustomRoomEditor();
}

function initializeAdminTabs() {
  const initial = window.location.hash.slice(1);
  activateAdminTab(adminTabKeys.has(initial) ? initial : "payments");
  adminTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateAdminTab(tab.dataset.adminTab, { focus: true }));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % adminTabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + adminTabs.length) % adminTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = adminTabs.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      activateAdminTab(adminTabs[nextIndex].dataset.adminTab, { focus: true });
    });
  });
  window.addEventListener("hashchange", () => {
    const key = window.location.hash.slice(1);
    if (adminTabKeys.has(key) && key !== activeAdminTab) activateAdminTab(key, { updateHash: false });
  });
}

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
  const projectedParticipants = Array.isArray(row.participants) ? row.participants.slice(0, 4).map((participant) => ({
    displayName: normalize(participant?.name).slice(0, 32),
    uid: normalize(participant?.uid).slice(0, 12),
    age: Number(participant?.age),
    captain: Boolean(participant?.captain)
  })) : [];
  const participant = projectedParticipants[0] || {
    displayName: normalize(row.display_name).slice(0, 32),
    uid: normalize(row.ff_uid).slice(0, 12),
    age: Number(row.age),
    captain: true
  };
  return {
    id: normalize(row.id).slice(0, 50),
    reference: normalize(row.reference).slice(0, 40),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    tournamentName: normalize(row.tournament_name).slice(0, 80),
    timeSlot: {
      id: normalize(row.time_slot_id).slice(0, 64),
      label: normalize(row.time_slot_label).slice(0, 86),
      startsAt: row.time_slot_at
    },
    ownerUserId: normalize(row.owner_user_id).slice(0, 128),
    teamName: normalize(row.team_name).slice(0, 40),
    participant,
    participants: projectedParticipants.length ? projectedParticipants : [participant],
    registrationCycle: Number.isInteger(Number(row.registration_cycle)) ? Number(row.registration_cycle) : 0,
    slotCapacity: Number.isInteger(Number(row.slot_capacity)) ? Number(row.slot_capacity) : 50,
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
  const matches = new Map();
  winnerCandidates.forEach((candidate) => {
    if (!candidate.tournamentId || !candidate.timeSlotId || !Number.isInteger(candidate.registrationCycle)) return;
    const key = `${candidate.tournamentId}|${candidate.registrationCycle}|${candidate.timeSlotId}`;
    if (matches.has(key)) return;
    const tournament = tournaments.find((item) => item.id === candidate.tournamentId);
    matches.set(key, {
      key,
      tournamentId: candidate.tournamentId,
      tournamentName: tournament?.name || candidate.tournamentName || candidate.tournamentId,
      registrationCycle: candidate.registrationCycle,
      timeSlotId: candidate.timeSlotId,
      timeSlotLabel: candidate.timeSlotLabel,
      startsAt: candidate.startsAt,
      state: getTimeSlotState(tournament, { id: candidate.timeSlotId, startsAt: candidate.startsAt, spotsLeft: 1 }),
      killReward: Number(tournament?.killReward) || 0,
      booyahBonus: Number(tournament?.booyahBonus) || 0
    });
  });
  return [...matches.values()].sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)));
}

function selectedWinnerMatch() {
  return availableWinnerMatches().find((match) => match.key === winnerMatch.value) || null;
}

function projectedLineup(players) {
  return Array.isArray(players) ? players.slice(0, 4).map((player) => ({
    displayName: normalize(player?.displayName).slice(0, 32),
    uid: normalize(player?.uid).slice(0, 12)
  })) : [];
}

function lineupListHtml(players) {
  return `<ol class="admin-lineup">${players.map((player, index) => `<li><span>${index + 1}</span><b>${escapeHtml(player.displayName || "Player")}</b><code>${escapeHtml(player.uid || "—")}</code>${index === 0 ? "<small>Captain</small>" : ""}</li>`).join("")}</ol>`;
}

function winnerLabel(entry) {
  return entry?.teamName || entry?.displayName || "Winner";
}

function projectedWinnerCandidate(row) {
  return {
    id: normalize(row.id).slice(0, 50),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    registrationCycle: Number(row.registration_cycle),
    timeSlotId: normalize(row.time_slot_id).slice(0, 64),
    timeSlotLabel: normalize(row.time_slot_label).slice(0, 60),
    startsAt: row.time_slot_at || null,
    displayName: normalize(row.display_name).slice(0, 32),
    uid: normalize(row.ff_uid).slice(0, 12),
    teamName: normalize(row.team_name).slice(0, 40),
    players: projectedLineup(row.players),
    slot: Number(row.slot)
  };
}

function projectedMatchResult(row) {
  return {
    id: normalize(row.id).slice(0, 50),
    tournamentId: normalize(row.tournament_id).slice(0, 64),
    timeSlotId: normalize(row.time_slot_id).slice(0, 64),
    timeSlotLabel: normalize(row.time_slot_label).slice(0, 60),
    startsAt: row.time_slot_at || null,
    registrationCycle: Number(row.registration_cycle),
    displayName: normalize(row.display_name).slice(0, 32),
    uid: normalize(row.ff_uid).slice(0, 12),
    teamName: normalize(row.team_name).slice(0, 40),
    players: projectedLineup(row.players),
    kills: row.kills === null ? null : Number(row.kills),
    prizeAmount: Number(row.prize_amount),
    imagePath: normalize(row.image_path).slice(0, 400),
    imageAlt: normalize(row.image_alt).slice(0, 180),
    publishedAt: row.published_at
  };
}

function activeMatchResult(match = selectedWinnerMatch()) {
  return matchResults.find((result) => result.tournamentId === match?.tournamentId
    && result.registrationCycle === match?.registrationCycle
    && result.timeSlotId === match?.timeSlotId) || null;
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
  const focusedWinnerAction = winnerList.contains(document.activeElement)
    ? document.activeElement.getAttribute("data-remove-winner")
    : "";
  winnerCount.textContent = `${matchResults.length} ${matchResults.length === 1 ? "card" : "cards"} published`;
  winnerList.innerHTML = matchResults.length ? matchResults.map((result) => `
    <article class="admin-winner-result">
      <div><span>${escapeHtml(result.timeSlotLabel)}</span><strong>${escapeHtml(winnerLabel(result))}</strong>${result.teamName && result.players.length ? lineupListHtml(result.players) : `<code>${escapeHtml(result.uid)}</code>`}</div>
      <div><span>${result.kills === null ? "Kills not recorded" : `${escapeHtml(result.kills)} verified kills`}</span><strong>₹${escapeHtml(result.prizeAmount)}</strong><small>${escapeHtml(formatTimestamp(result.publishedAt))}</small></div>
      <button class="button admin-delete-button" type="button" data-remove-winner="${escapeHtml(result.id)}">Remove card</button>
    </article>`).join("") : '<p class="admin-winner-empty">No winner cards published yet.</p>';
  if (focusedWinnerAction) winnerList.querySelector(`[data-remove-winner="${CSS.escape(focusedWinnerAction)}"]`)?.focus();
}

function syncWinnerEditor({ preserveValues = false } = {}) {
  const match = selectedWinnerMatch();
  const result = activeMatchResult(match);
  const candidates = winnerCandidates
    .filter((player) => player.tournamentId === match?.tournamentId
      && player.registrationCycle === match?.registrationCycle
      && player.timeSlotId === match?.timeSlotId)
    .sort((a, b) => a.slot - b.slot);

  winnerPlayer.innerHTML = candidates.length
    ? `<option value="">Choose confirmed ${match?.tournamentId === "solo-survival-01" ? "player" : "squad"}</option>${candidates.map((player) => `<option value="${escapeHtml(player.id)}">No. ${escapeHtml(player.slot)} · ${escapeHtml(player.teamName ? `${player.teamName} · Captain ${player.displayName}` : `${player.displayName} · ${player.uid}`)}</option>`).join("")}`
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
    const generation = adminDataGeneration;
    const [playersResponse, resultsResponse] = await Promise.all([
      client.rpc("get_admin_public_players"),
      client.from("match_results").select("id, tournament_id, registration_cycle, time_slot_id, time_slot_label, time_slot_at, winner_public_player_id, display_name, ff_uid, team_name, players, kills, prize_amount, image_path, image_alt, published_at").order("time_slot_at", { ascending: false })
    ]);
    if (generation !== adminDataGeneration || dashboard.hidden) return;
    if (playersResponse.error) throw playersResponse.error;
    if (resultsResponse.error) throw resultsResponse.error;
    winnerCandidates = (playersResponse.data || []).map(projectedWinnerCandidate);
    matchResults = (resultsResponse.data || []).map((row) => ({ ...projectedMatchResult(row), winnerPublicPlayerId: normalize(row.winner_public_player_id).slice(0, 50) }));
    winnerStatus.hidden = true;
    renderWinnerResults();
    setWinnerMatchOptions(winnerMatch.value);
  } catch (error) {
    setWinnerStatus("Booyah publisher unavailable", error?.message || "Apply the Booyah results migration in Supabase.");
    winnerCandidates = [];
    matchResults = [];
    renderWinnerResults();
    setWinnerMatchOptions("");
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

  if (!match || !player || player.tournamentId !== match.tournamentId
    || player.registrationCycle !== match.registrationCycle || player.timeSlotId !== match.timeSlotId) {
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
      || `${winnerLabel(player)} celebrates winning ${match.timeSlotLabel}`;
    const { error: publishError } = await client.rpc("publish_match_result", {
      p_tournament_id: match.tournamentId,
      p_registration_cycle: match.registrationCycle,
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
  if (!result || !window.confirm(`Remove the ${result.timeSlotLabel} winner card for ${winnerLabel(result)}?`)) return;
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

function annotateDuplicateTransactions(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.payment.transactionReference;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  items.forEach((item) => {
    item.duplicateCount = counts.get(item.payment.transactionReference) || 1;
  });
  return items;
}

function paymentMatchKey(tournamentId, registrationCycle) {
  return `${tournamentId}|${registrationCycle}`;
}

function paymentMatchConfigurations() {
  const configurations = new Map();
  tournaments.forEach((tournament) => {
    const registrationCycle = Number(tournament.registrationCycle);
    if (!Number.isInteger(registrationCycle) || registrationCycle < 1) return;
    const key = paymentMatchKey(tournament.id, registrationCycle);
    configurations.set(key, { key, tournament, tournamentId: tournament.id, tournamentName: tournament.name, registrationCycle, current: true });
  });
  registrations.forEach((registration) => {
    if (!registration.tournamentId || !Number.isInteger(registration.registrationCycle) || registration.registrationCycle < 0) return;
    const key = paymentMatchKey(registration.tournamentId, registration.registrationCycle);
    if (configurations.has(key)) return;
    const tournament = tournaments.find((item) => item.id === registration.tournamentId) || null;
    configurations.set(key, {
      key,
      tournament,
      tournamentId: registration.tournamentId,
      tournamentName: tournament?.name || registration.tournamentName || registration.tournamentId,
      registrationCycle: registration.registrationCycle,
      current: false
    });
  });
  return [...configurations.values()].sort((a, b) => Number(b.current) - Number(a.current)
    || b.registrationCycle - a.registrationCycle || a.tournamentName.localeCompare(b.tournamentName));
}

function selectedPaymentMatch() {
  return paymentMatchConfigurations().find((item) => item.key === selectedPaymentMatchKey) || null;
}

function paymentMatchRegistrations() {
  const selected = selectedPaymentMatch();
  if (!selected) return [];
  return registrations.filter((registration) => registration.tournamentId === selected.tournamentId
    && registration.registrationCycle === selected.registrationCycle);
}

function cycleRegistrations(configuration) {
  return registrations.filter((registration) => registration.tournamentId === configuration.tournamentId
    && registration.registrationCycle === configuration.registrationCycle);
}

function cycleStartsAt(configuration) {
  const fromRows = cycleRegistrations(configuration).map((registration) => registration.timeSlot.startsAt).find(Boolean);
  if (fromRows) return fromRows;
  return configuration.current ? configuration.tournament?.presentationScheduledAt || null : null;
}

// A cycle is worth a chip when it holds payments or is the live, open match.
// Empty "Coming soon" cycles are reachable through the tournament pill but are
// not listed as separate matches.
function cycleIsRelevant(configuration) {
  if (cycleRegistrations(configuration).length) return true;
  return configuration.current && configuration.tournament && getEventPresentation(configuration.tournament).state.open;
}

function cycleLabel(configuration) {
  const startsAt = cycleStartsAt(configuration);
  const lobbies = new Set(cycleRegistrations(configuration).map((registration) => registration.timeSlot.id)).size;
  const live = configuration.current && configuration.tournament && getEventPresentation(configuration.tournament).state.open;
  const played = Number.isFinite(Date.parse(startsAt)) && Date.parse(startsAt) <= Date.now();
  const date = !startsAt
    ? "Not scheduled"
    : lobbies > 1
      ? `${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(new Date(startsAt))} · ${lobbies} lobbies`
      : shortMatchDate(startsAt);
  return {
    date,
    state: live ? "Open now" : played ? "Played" : configuration.current ? "Current" : "Archived",
    key: live ? "open" : played ? "complete" : configuration.current ? "scheduled" : "closed"
  };
}

function tournamentGroups() {
  const groups = new Map();
  paymentMatchConfigurations().forEach((configuration) => {
    const group = groups.get(configuration.tournamentId) || {
      tournamentId: configuration.tournamentId,
      tournament: configuration.tournament,
      tournamentName: configuration.tournamentName,
      shortCode: configuration.tournament?.shortCode || configuration.tournamentId.toUpperCase(),
      cycles: []
    };
    group.cycles.push(configuration);
    groups.set(configuration.tournamentId, group);
  });
  groups.forEach((group) => {
    group.cycles.sort((a, b) => Number(b.current) - Number(a.current) || b.registrationCycle - a.registrationCycle);
    const rowsInGroup = registrations.filter((registration) => registration.tournamentId === group.tournamentId);
    group.total = rowsInGroup.length;
    group.pending = rowsInGroup.filter((registration) => registration.registrationStatus === "pending").length;
    group.state = group.tournament ? getEventPresentation(group.tournament).state : { key: "closed", label: "Archived" };
    group.relevantCycles = group.cycles.filter(cycleIsRelevant);
  });
  const order = tournaments.map((tournament) => tournament.id);
  return [...groups.values()].sort((a, b) => Number(b.state.open) - Number(a.state.open) || b.pending - a.pending || order.indexOf(a.tournamentId) - order.indexOf(b.tournamentId));
}

function preferredCycleFor(group) {
  const open = group.cycles.find((cycle) => cycle.current && cycle.tournament && getEventPresentation(cycle.tournament).state.open);
  const withPending = group.cycles.find((cycle) => cycleRegistrations(cycle).some((registration) => registration.registrationStatus === "pending"));
  const populated = group.cycles.find((cycle) => cycleRegistrations(cycle).length);
  return open || withPending || populated || group.cycles[0];
}

function renderPaymentMatchCards() {
  const focusedTournament = paymentTournaments.contains(document.activeElement) ? document.activeElement.dataset.paymentTournament : "";
  const focusedCycle = paymentMatchCards.contains(document.activeElement) ? document.activeElement.dataset.paymentMatch : "";
  const groups = tournamentGroups();
  const configurations = paymentMatchConfigurations();
  if (!configurations.some((item) => item.key === selectedPaymentMatchKey)) {
    const firstGroup = groups.find((group) => group.state.open) || groups.find((group) => group.pending) || groups.find((group) => group.total) || groups[0];
    selectedPaymentMatchKey = firstGroup ? preferredCycleFor(firstGroup).key : "";
  }
  const selected = selectedPaymentMatch();
  paymentTournaments.innerHTML = groups.length
    ? groups.map((group) => {
      const active = group.tournamentId === selected?.tournamentId;
      const detail = group.pending ? `${group.pending} pending` : group.total ? `${group.total} paid` : group.state.label;
      return `<button class="ops-pill" type="button" aria-pressed="${active}" data-payment-tournament="${escapeHtml(group.tournamentId)}"><span class="ops-pill__code">${escapeHtml(group.shortCode)}</span><strong>${escapeHtml(group.tournamentName)}</strong><small><i class="ops-dot ops-dot--${escapeHtml(group.state.key)}" aria-hidden="true"></i>${escapeHtml(group.state.label)}${group.total ? ` · ${escapeHtml(detail)}` : ""}</small>${group.pending ? `<b class="ops-pill__count">${escapeHtml(group.pending)}</b>` : ""}</button>`;
    }).join("")
    : '<div class="ops-empty"><strong>No matches configured</strong></div>';
  restoreDataFocus(paymentTournaments, "data-payment-tournament", focusedTournament);

  const group = groups.find((item) => item.tournamentId === selected?.tournamentId);
  const cycles = group ? group.relevantCycles.length ? group.relevantCycles : group.cycles.slice(0, 1) : [];
  if (!group || cycles.length <= 1) {
    const only = cycles[0];
    const label = only ? cycleLabel(only) : null;
    paymentMatchCards.innerHTML = only
      ? `<p class="ops-cycle-note"><i class="ops-dot ops-dot--${escapeHtml(label.key)}" aria-hidden="true"></i>${escapeHtml(label.date)} · ${escapeHtml(label.state)}</p>`
      : "";
    return;
  }
  paymentMatchCards.innerHTML = `<span class="ops-cycle-switch__label">Match</span>${cycles.map((cycle) => {
    const label = cycleLabel(cycle);
    const count = cycleRegistrations(cycle).length;
    return `<button class="ops-chip" type="button" aria-pressed="${cycle.key === selectedPaymentMatchKey}" data-payment-match="${escapeHtml(cycle.key)}"><i class="ops-dot ops-dot--${escapeHtml(label.key)}" aria-hidden="true"></i><strong>${escapeHtml(label.date)}</strong><span>${escapeHtml(label.state)} · ${escapeHtml(count)}</span></button>`;
  }).join("")}`;
  restoreDataFocus(paymentMatchCards, "data-payment-match", focusedCycle);
}

function selectPaymentTournament(tournamentId) {
  const group = tournamentGroups().find((item) => item.tournamentId === tournamentId);
  if (!group) return;
  selectedPaymentMatchKey = preferredCycleFor(group).key;
  lobbyFilter.value = "all";
  syncRegistrationLobbyFilter();
  renderRegistrations();
}

function syncRegistrationLobbyFilter() {
  const previous = lobbyFilter.value;
  const lobbies = [...new Map(paymentMatchRegistrations().map((registration) => [registration.timeSlot.id, registration.timeSlot])).values()]
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  lobbyFilter.innerHTML = `<option value="all">All lobbies</option>${lobbies.map((lobby) => `<option value="${escapeHtml(lobby.id)}">${escapeHtml(lobby.label)}</option>`).join("")}`;
  lobbyFilter.value = previous === "all" || lobbies.some((lobby) => lobby.id === previous) ? previous : "all";
  lobbyFilter.closest(".field").hidden = lobbies.length < 2;
}

function scopeHasMultipleLobbies() {
  return new Set(paymentMatchRegistrations().map((registration) => registration.timeSlot.id)).size > 1;
}

function activeFilterCount() {
  return [paymentFilter, registrationFilter, duplicateFilter].filter((control) => control.value !== "all").length
    + (lobbyFilter.value !== "all" ? 1 : 0)
    + (sortControl.value !== "newest" ? 1 : 0);
}

function clearFilters() {
  [lobbyFilter, paymentFilter, registrationFilter, duplicateFilter].forEach((control) => { control.value = "all"; });
  sortControl.value = "newest";
  search.value = "";
  renderRegistrations();
}

const quickFilters = [
  { key: "pending", label: "Pending", control: () => registrationFilter, value: "pending", count: (scope) => scope.filter((item) => item.registrationStatus === "pending").length, tone: "warning" },
  { key: "verified", label: "Verified", control: () => paymentFilter, value: "verified", count: (scope) => scope.filter((item) => item.paymentStatus === "verified").length, tone: "success" },
  { key: "confirmed", label: "Confirmed", control: () => registrationFilter, value: "confirmed", count: (scope) => scope.filter((item) => item.registrationStatus === "confirmed").length, tone: "success" },
  { key: "duplicates", label: "Duplicates", control: () => duplicateFilter, value: "duplicates", count: (scope) => new Set(scope.filter((item) => item.duplicateCount > 1).map((item) => item.payment.transactionReference)).size, tone: "danger" }
];

function toggleQuickFilter(key) {
  const quick = quickFilters.find((item) => item.key === key);
  if (!quick) return;
  const control = quick.control();
  control.value = control.value === quick.value ? "all" : quick.value;
  renderRegistrations();
}

function registrationVerdict(registration) {
  const { paymentStatus, registrationStatus, slot, teamName, duplicateCount } = registration;
  if (registrationStatus === "confirmed") return { key: "open", label: slot ? `Confirmed · ${teamName ? "Team" : "No."} ${slot}` : "Confirmed" };
  if (registrationStatus === "rejected") return { key: "closed", label: "Rejected" };
  if (registrationStatus === "cancelled") return { key: "closed", label: "Cancelled" };
  if (paymentStatus === "duplicate" || duplicateCount > 1) return { key: "closed", label: `Duplicate UTR${duplicateCount > 1 ? ` ×${duplicateCount}` : ""}` };
  if (paymentStatus === "not-found") return { key: "closed", label: "Payment not found" };
  if (paymentStatus === "verified") return { key: "open", label: "Verified · confirm pending" };
  return { key: "closing", label: "Needs review" };
}

function compactLineupHtml(registration) {
  if (!registration.teamName) {
    return `<div class="ops-card__solo"><span>UID</span><code>${escapeHtml(registration.participant.uid)}</code><span>Age ${escapeHtml(registration.participant.age)}</span></div>`;
  }
  return `<ol class="ops-lineup">${registration.participants.map((participant, index) => `<li><b>${escapeHtml(participant.displayName || "Player")}</b><code>${escapeHtml(participant.uid || "—")}</code>${index === 0 ? '<small>Captain</small>' : ""}</li>`).join("")}</ol>`;
}

function visibleRegistrations() {
  const query = normalize(search.value).slice(0, 80).toLowerCase();
  const visible = paymentMatchRegistrations().filter((registration) => {
    const matchesSearch = !query || [
      registration.reference,
      registration.teamName,
      ...registration.participants.flatMap((participant) => [participant.displayName, participant.uid]),
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
    if (sortControl.value === "player") return (a.teamName || a.participant.displayName).localeCompare(b.teamName || b.participant.displayName);
    if (sortControl.value === "transaction") return a.payment.transactionReference.localeCompare(b.payment.transactionReference);
    return timestampDate(b.submittedAt) - timestampDate(a.submittedAt);
  });
}

function renderStats(scope = paymentMatchRegistrations()) {
  const focused = statsStrip.contains(document.activeElement) ? document.activeElement.dataset.quickFilter : "";
  statsStrip.innerHTML = quickFilters.map((quick) => {
    const count = quick.count(scope);
    const control = quick.control();
    const pressed = control.value === quick.value;
    return `<button class="ops-stat ops-stat--${quick.tone}${count ? "" : " ops-stat--zero"}" type="button" aria-pressed="${pressed}" data-quick-filter="${quick.key}"><strong>${escapeHtml(count)}</strong><span>${escapeHtml(quick.label)}</span></button>`;
  }).join("") + `<div class="ops-stat ops-stat--total"><strong>${escapeHtml(scope.length)}</strong><span>Total</span></div>`;
  restoreDataFocus(statsStrip, "data-quick-filter", focused);
}

function renderLiveSummary() {
  const open = tournaments.find((tournament) => getEventPresentation(tournament).state.open);
  const pending = registrations.filter((registration) => registration.registrationStatus === "pending").length;
  pendingBadge.hidden = pending === 0;
  pendingBadge.textContent = String(pending);
  if (open) {
    const presentation = getEventPresentation(open);
    const openPending = registrations.filter((registration) => registration.tournamentId === open.id
      && registration.registrationCycle === Number(open.registrationCycle) && registration.registrationStatus === "pending").length;
    liveSummary.innerHTML = `<i class="ops-dot ops-dot--open" aria-hidden="true"></i><strong>${escapeHtml(open.name)}</strong> open · ${escapeHtml(shortMatchDate(presentation.scheduledAt))} IST · ${escapeHtml(presentation.capacityLabel)} · <b>${escapeHtml(openPending)}</b> pending`;
  } else {
    liveSummary.innerHTML = `<i class="ops-dot ops-dot--closed" aria-hidden="true"></i>No match open · <b>${escapeHtml(pending)}</b> pending in history`;
  }
}

function renderRegistrations() {
  const focusedAction = rows.contains(document.activeElement)
    ? document.activeElement.getAttribute("data-open-registration")
    : null;
  renderPaymentMatchCards();
  renderLiveSummary();
  const scope = paymentMatchRegistrations();
  renderStats(scope);
  const visible = visibleRegistrations();
  const selected = selectedPaymentMatch();
  const filters = activeFilterCount();
  filterCount.hidden = filters === 0;
  filterCount.textContent = String(filters);
  const multiLobby = scopeHasMultipleLobbies();
  listMeta.textContent = selected
    ? `${visible.length === scope.length ? scope.length : `${visible.length} of ${scope.length}`} registration${scope.length === 1 ? "" : "s"}${filters || search.value ? " · filtered" : ""}`
    : "No match card is available.";
  empty.hidden = visible.length !== 0;
  rows.innerHTML = visible.map((registration) => {
    const verdict = registrationVerdict(registration);
    const title = registration.teamName || registration.participant.displayName || "Unnamed";
    const subtitle = registration.teamName ? `Captain ${registration.participant.displayName}` : registration.reference;
    return `
    <li class="ops-card ops-card--${escapeHtml(verdict.key)}">
      <div class="ops-card__head">
        <div class="ops-card__title"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>
        <span class="status-badge status-badge--${escapeHtml(verdict.key)}"><i aria-hidden="true"></i>${escapeHtml(verdict.label)}</span>
      </div>
      ${compactLineupHtml(registration)}
      <dl class="ops-card__meta">
        <div><dt>UTR</dt><dd><code>${escapeHtml(registration.payment.transactionReference)}</code></dd></div>
        <div><dt>Paid</dt><dd>₹${escapeHtml(registration.payment.amount)}</dd></div>
        <div><dt>Sent</dt><dd>${escapeHtml(shortMatchDate(registration.submittedAt))}</dd></div>
        ${multiLobby ? `<div><dt>Lobby</dt><dd>${escapeHtml(registration.timeSlot.label)}</dd></div>` : ""}
        ${registration.teamName ? `<div><dt>Ref</dt><dd><code>${escapeHtml(registration.reference)}</code></dd></div>` : ""}
      </dl>
      <button class="button button--quiet ops-card__action" type="button" data-open-registration="${escapeHtml(registration.id)}">Review</button>
    </li>`;
  }).join("");
  if (focusedAction) rows.querySelector(`[data-open-registration="${CSS.escape(focusedAction)}"]`)?.focus();
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
  const squadReport = items.some((item) => item.teamName);
  const lineupCell = (item) => item.teamName
    ? `<ol class="lineup">${item.participants.map((participant, index) => `<li>${escapeHtml(participant.displayName)} <code>${escapeHtml(participant.uid)}</code>${index === 0 ? " <small>Captain</small>" : ""}</li>`).join("")}</ol>`
    : `${escapeHtml(item.participant.displayName)}<br><small>${escapeHtml(item.participant.uid)}</small>`;
  const rowsHtml = items.map((item) => `
    <tr class="${item.duplicateCount > 1 ? "duplicate" : ""}">
      <td class="check">☐</td>
      <td>${escapeHtml(formatTimestamp(item.submittedAt))}</td>
      <td><strong>${escapeHtml(item.timeSlot.label)}</strong><br>${escapeHtml(formatTimestamp(item.timeSlot.startsAt))}<br><small>${escapeHtml(registrationMatchState(item).label)}</small></td>
      ${squadReport ? `<td><strong>${escapeHtml(item.teamName || "—")}</strong></td>` : ""}
      <td>${lineupCell(item)}</td>
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
    ol.lineup { margin: 0; padding-left: 14px; }
    ol.lineup li { padding: 1px 0; }
    ol.lineup small { font-weight: 700; color: #1d4ed8; }
    footer { margin-top: 10px; color: #555; }
  </style></head><body>
    <h1>QW Tournaments — Payment Reconciliation</h1>
    <div class="meta"><span><strong>Scope:</strong> ${escapeHtml(scopeLabel)}</span><span><strong>Records:</strong> ${items.length}</span><span><strong>Claimed total:</strong> ₹${totalAmount}</span><span><strong>Verified:</strong> ${verifiedCount}</span><span><strong>Duplicate UTRs:</strong> ${duplicateReferences.size}</span><span><strong>Generated:</strong> ${escapeHtml(formatTimestamp(new Date()))}</span></div>
    <div class="warning">Private organizer report. Cross-check every UTR against the actual receiving account. A screenshot is not payment confirmation. Do not share this PDF publicly.</div>
    <table><thead><tr><th>Checked</th><th>Submitted</th><th>Lobby</th>${squadReport ? "<th>Squad</th>" : ""}<th>${squadReport ? "Players / UIDs" : "Player / UID"}</th><th>WhatsApp</th><th>UTR</th><th>Amount</th><th>Payment</th><th>Registration</th><th>${squadReport ? "Team no." : "Player no."}</th><th>Reference</th></tr></thead><tbody>${rowsHtml}</tbody></table>
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
  loadProofButton.textContent = "Load screenshot";
}

function effectiveReviewStatus() {
  const requested = reviewRegistrationStatus.value;
  if (["rejected", "cancelled"].includes(requested)) return requested;
  return reviewPaymentStatus.value === "verified" ? "confirmed" : "pending";
}

function syncReviewRegistrationStatus() {
  reviewRegistrationStatus.value = effectiveReviewStatus();
  const registration = activeRegistration;
  const unit = registration?.teamName ? "Team" : "Player";
  slotLabel.textContent = `${unit} number`;
  if (registration?.slot) {
    slotValue.textContent = String(registration.slot);
    slotHint.textContent = reviewRegistrationStatus.value === "confirmed"
      ? `Keeps number ${registration.slot} of ${registration.slotCapacity}.`
      : "Saving this status releases the number for reuse.";
  } else {
    slotValue.textContent = "—";
    slotHint.textContent = reviewPaymentStatus.value === "verified"
      ? `Lowest free number of ${registration?.slotCapacity ?? 50} is assigned when you save.`
      : "Assigned automatically once payment is verified.";
  }
}

function lineupTableHtml(registration) {
  const squad = Boolean(registration.teamName);
  return `<table class="ops-lineup-table"><thead><tr><th scope="col">#</th><th scope="col">${squad ? "Player" : "In-game name"}</th><th scope="col">Free Fire UID</th><th scope="col">Age</th></tr></thead><tbody>${registration.participants.map((participant, index) => `<tr><td>${index + 1}${squad && index === 0 ? "<small>C</small>" : ""}</td><td>${escapeHtml(participant.displayName)}</td><td><code>${escapeHtml(participant.uid)}</code></td><td>${escapeHtml(Number.isFinite(participant.age) ? participant.age : "—")}</td></tr>`).join("")}</tbody></table>`;
}

function openRegistration(registration) {
  activeRegistration = registration;
  resetProof();
  detailStatus.hidden = true;
  const verdict = registrationVerdict(registration);
  detailKicker.textContent = `${registration.teamName ? "Squad" : "Solo"} · ${registration.reference}`;
  document.querySelector("#adminDetailTitle").textContent = registration.teamName || registration.participant.displayName;
  const digits = registration.contactWhatsapp.replace(/\D/g, "");
  detailContent.innerHTML = `
    <div class="ops-detail__status"><span class="status-badge status-badge--${escapeHtml(verdict.key)}"><i aria-hidden="true"></i>${escapeHtml(verdict.label)}</span><span class="ops-detail__state">Payment <b>${escapeHtml(registration.paymentStatus.replaceAll("-", " "))}</b> · Registration <b>${escapeHtml(registration.registrationStatus)}</b></span></div>
    ${lineupTableHtml(registration)}
    <dl class="ops-facts">
      <div><dt>UTR</dt><dd><code>${escapeHtml(registration.payment.transactionReference)}</code>${registration.duplicateCount > 1 ? `<b class="ops-facts__flag">Duplicate across ${escapeHtml(registration.duplicateCount)} registrations</b>` : ""}</dd></div>
      <div><dt>Amount</dt><dd>₹${escapeHtml(registration.payment.amount)} · ${escapeHtml(paymentMethodLabel(registration.payment.method))}</dd></div>
      <div><dt>WhatsApp</dt><dd><a href="https://wa.me/${escapeHtml(digits)}" target="_blank" rel="noopener noreferrer">${escapeHtml(registration.contactWhatsapp)}</a></dd></div>
      <div><dt>Submitted</dt><dd>${escapeHtml(shortMatchDate(registration.submittedAt))}</dd></div>
      <div><dt>Match</dt><dd>${escapeHtml(registration.tournamentName)}${scopeHasMultipleLobbies() ? ` · ${escapeHtml(registration.timeSlot.label)}` : ""} · ${escapeHtml(shortMatchDate(registration.timeSlot.startsAt))}</dd></div>
      <div><dt>Capacity</dt><dd>${escapeHtml(registration.slotCapacity)} ${registration.teamName ? "teams" : "players"}</dd></div>
    </dl>
    <details class="ops-disclosure ops-disclosure--quiet"><summary><span>Technical details</span></summary><dl class="ops-facts"><div><dt>Record</dt><dd><code>${escapeHtml(registration.id)}</code></dd></div><div><dt>Updated</dt><dd>${escapeHtml(formatTimestamp(registration.updatedAt))}</dd></div><div><dt>File</dt><dd>${escapeHtml(registration.payment.contentType)} · ${escapeHtml((registration.payment.size / (1024 * 1024)).toFixed(2))} MB</dd></div><div><dt>Reference</dt><dd><code>${escapeHtml(registration.reference)}</code></dd></div></dl></details>`;
  reviewPaymentStatus.value = registration.paymentStatus;
  reviewRegistrationStatus.value = registration.registrationStatus;
  reviewSlot.value = registration.slot || "";
  syncReviewRegistrationStatus();
  document.querySelector("#adminOrganizerNote").value = registration.organizerNote;
  document.querySelector("#adminWhatsappPlayer").href = `https://wa.me/${digits}?text=${encodeURIComponent(`Hi, this is QW Tournaments regarding registration ${registration.reference}.`)}`;
  deleteButton.hidden = !["cancelled", "rejected"].includes(registration.registrationStatus);
  deleteButton.disabled = false;
  deleteButton.textContent = "Delete";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  dialog.querySelector(".ops-sheet__body")?.scrollTo({ top: 0 });
}

function closeDialog() {
  resetProof();
  activeRegistration = null;
  detailContent.replaceChildren();
  detailStatus.replaceChildren();
  detailStatus.hidden = true;
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
  const registrationId = activeRegistration.id;
  loadProofButton.disabled = true;
  loadProofButton.textContent = "Loading…";
  try {
    const { data, error } = await client.storage
      .from("payment-proofs")
      .download(activeRegistration.payment.screenshotPath);
    if (error) throw error;
    if (activeRegistration?.id !== registrationId || !dialog.open) return;
    proofObjectUrl = URL.createObjectURL(data);
    proofImage.src = proofObjectUrl;
    proofView.hidden = false;
    loadProofButton.textContent = "Screenshot loaded";
  } catch (error) {
    if (activeRegistration?.id !== registrationId || !dialog.open) return;
    loadProofButton.disabled = false;
    loadProofButton.textContent = "Try again";
    detailStatus.hidden = false;
    detailStatus.innerHTML = `<strong>Screenshot unavailable</strong><p>${escapeHtml(error?.message || "Supabase denied the file request.")}</p>`;
  }
}

async function saveReview(event) {
  event.preventDefault();
  if (!activeRegistration || !client) return;
  const paymentStatus = reviewPaymentStatus.value;
  const requestedRegistrationStatus = reviewRegistrationStatus.value;
  const registrationStatus = ["rejected", "cancelled"].includes(requestedRegistrationStatus)
    ? requestedRegistrationStatus
    : paymentStatus === "verified" ? "confirmed" : "pending";
  const organizerNote = normalize(document.querySelector("#adminOrganizerNote").value).slice(0, 500);

  const saveButton = document.querySelector("#adminSaveReview");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  detailStatus.hidden = true;
  try {
    const { error } = await client.rpc("review_registration", {
      p_registration_id: activeRegistration.id,
      p_payment_status: paymentStatus,
      p_registration_status: registrationStatus,
      p_slot: null,
      p_note: organizerNote,
      p_expected_updated_at: activeRegistration.updatedAt
    });
    if (error) throw error;
    const successMessage = registrationStatus === "confirmed"
      ? `Payment verified; registration confirmed and the ${activeRegistration.teamName ? "team" : "player"} number was assigned automatically.`
      : ["rejected", "cancelled"].includes(registrationStatus)
        ? "Registration updated and its lobby number is now available for reuse."
        : "Private review saved.";
    showToast(successMessage);
    closeDialog();
    await loadRegistrations();
  } catch (error) {
    if (/version|updated|stale|conflict/i.test(error?.message || "")) {
      closeDialog();
      await loadRegistrations({ force: true });
      showToast("This registration changed while the review was open. The latest row is loaded; open it again before saving.", 8000);
    } else {
      detailStatus.hidden = false;
      detailStatus.innerHTML = `<strong>Review not saved</strong><p>${escapeHtml(error?.message || "Supabase rejected the update.")}</p>`;
    }
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save review";
  }
}

async function loadRegistrations({ force = false } = {}) {
  if (!client || dashboard.hidden) return;
  if (registrationLoadPromise) {
    await registrationLoadPromise;
    if (!force || dashboard.hidden) return;
  }
  const generation = adminDataGeneration;
  listMeta.textContent = "Loading complete registration history…";
  const request = (async () => {
    try {
      const allRows = [];
      const batchSize = 1000;
      for (let offset = 0; ; offset += batchSize) {
        const { data, error } = await client
          .from("registrations")
          .select("*")
          .order("submitted_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < batchSize) break;
      }
      if (generation !== adminDataGeneration || dashboard.hidden) return;
      registrations = annotateDuplicateTransactions(allRows.map(projectedRegistration));
      renderPaymentMatchCards();
      syncRegistrationLobbyFilter();
      renderRegistrations();
    } catch (error) {
      if (generation === adminDataGeneration && !dashboard.hidden) {
        listMeta.textContent = `Registrations could not load: ${error?.message || "Supabase denied the query."}`;
      }
    }
  })();
  registrationLoadPromise = request;
  try {
    await request;
  } finally {
    if (registrationLoadPromise === request) registrationLoadPromise = null;
  }
}

function stopRegistrationFeed() {
  window.clearInterval(refreshTimer);
  refreshTimer = 0;
  adminDataGeneration += 1;
  registrationLoadPromise = null;
  registrations = [];
  winnerCandidates = [];
  matchResults = [];
  renderRegistrations();
  renderWinnerResults();
  setWinnerMatchOptions("");
}

function clearAdminState() {
  closeDialog();
  stopRegistrationFeed();
  matchOverrides = new Map();
  activeCustomRooms = [];
  selectedPaymentMatchKey = "";
  matchEditorDirty = false;
  matchEditorRestoreRequested = false;
  renderCustomRoomEditor();
}

function denyOrganizer(user, message) {
  clearAdminState();
  activeOrganizerId = "";
  signedOut.hidden = true;
  dashboard.hidden = true;
  denied.hidden = false;
  document.querySelector("#adminDeniedMessage").textContent = message || `${user?.email || "This account"} is not on the active organizer list.`;
}

async function revalidateOrganizerAccess(user) {
  const userId = user?.id || activeOrganizerId;
  if (!client || !userId || dashboard.hidden) return false;
  const generation = ++approvalCheckGeneration;
  const { data, error } = await client
    .from("admin_users")
    .select("active")
    .eq("user_id", userId)
    .maybeSingle();
  if (generation !== approvalCheckGeneration || userId !== activeOrganizerId || dashboard.hidden) return false;
  if (error) {
    denyOrganizer(user, "Organizer approval could not be verified. Sign in again when the connection is available.");
    return false;
  }
  if (!data || data.active !== true || user?.is_anonymous) {
    denyOrganizer(user);
    return false;
  }
  return true;
}

async function refreshAdminData(checkApproval = true) {
  if (checkApproval && !await revalidateOrganizerAccess()) return;
  loadRegistrations();
  loadWinnerData();
}

function startRegistrationFeed() {
  stopRegistrationFeed();
  refreshAdminData(false);
  refreshTimer = window.setInterval(() => refreshAdminData(true), 30000);
}

async function showAuthenticatedState(user, transitionToken) {
  signedOut.hidden = true;
  dashboard.hidden = true;
  denied.hidden = true;
  const { data, error } = await client
    .from("admin_users")
    .select("active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (transitionToken !== authTransitionToken) return;
  if (error) throw error;
  if (!data || data.active !== true || user.is_anonymous) {
    denyOrganizer(user);
    return;
  }
  activeOrganizerId = user.id;
  dashboard.hidden = false;
  document.querySelector("#adminIdentity").textContent = user.email || user.id;
  startRegistrationFeed();
  activateAdminTab(activeAdminTab, { updateHash: true });
}

async function showSession(session) {
  const transitionToken = ++authTransitionToken;
  const user = session?.user;
  if (!user || user.is_anonymous) {
    clearAdminState();
    activeOrganizerId = "";
    if (transitionToken !== authTransitionToken) return;
    signedOut.hidden = false;
    denied.hidden = true;
    dashboard.hidden = true;
    return;
  }
  try {
    await showAuthenticatedState(user, transitionToken);
  } catch (error) {
    if (transitionToken !== authTransitionToken) return;
    clearAdminState();
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
  ++authTransitionToken;
  clearAdminState();
  const { error } = await client.auth.signOut();
  if (error) showToast(error.message);
}

async function initializeAdmin() {
  initializeShell();
  initializeMotion();
  initializeAdminTabs();
  if (!isSupabaseConfigured()) {
    setup.hidden = false;
    return;
  }
  try {
    await hydrateTournamentOverrides();
    client = await getSupabaseClient();
    setWinnerMatchOptions();
    renderMatchEditor();
    winnerMatch.addEventListener("change", () => syncWinnerEditor());
    winnerKills.addEventListener("input", () => { winnerPrize.value = String(calculatedPrize()); });
    winnerForm.addEventListener("submit", publishWinner);
    winnerList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-winner]");
      if (!button) return;
      const result = matchResults.find((item) => item.id === button.dataset.removeWinner);
      if (result) removeWinner(result, button);
    });
    matchForm.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "matchState") return;
      matchEditorDirty = true;
    });
    matchPresentationMode.addEventListener("change", () => {
      syncMatchPresentationFields();
      matchEditorDirty = true;
    });
    matchForm.addEventListener("submit", saveMatchEditor);
    matchRestore.addEventListener("click", restoreMatchEditorDefaults);
    roomForm.addEventListener("submit", submitCustomRoom);
    roomClear.addEventListener("click", clearCustomRoom);
    roomMatch.addEventListener("change", () => renderCustomRoomEditor(roomMatch.value));
    roomReload.addEventListener("click", () => loadCustomRoomEditor({ announce: true }));
    matchSelector.addEventListener("change", async () => {
      if (matchEditorDirty && !window.confirm("Discard unsaved match-card changes and load another card?")) {
        matchSelector.value = matchEditorTournamentId;
        return;
      }
      await loadMatchEditor();
    });
    matchReload.addEventListener("click", async () => {
      if (matchEditorDirty && !window.confirm("Discard unsaved changes and reload the server version?")) return;
      await loadMatchEditor({ announce: true });
    });
    loginForm.addEventListener("submit", signIn);
    document.querySelector("#adminSignOut").addEventListener("click", signOutAdmin);
    document.querySelector("#adminDeniedSignOut").addEventListener("click", signOutAdmin);
    document.querySelector("#adminDetailClose").addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
    loadProofButton.addEventListener("click", loadPaymentProof);
    reviewForm.addEventListener("submit", saveReview);
    reviewPaymentStatus.addEventListener("change", syncReviewRegistrationStatus);
    reviewRegistrationStatus.addEventListener("change", () => {
      if (!["rejected", "cancelled"].includes(reviewRegistrationStatus.value)) syncReviewRegistrationStatus();
    });
    rows.addEventListener("click", (event) => {
      const reviewButton = event.target.closest("[data-open-registration]");
      if (!reviewButton) return;
      const registration = registrations.find((item) => item.id === reviewButton.dataset.openRegistration);
      if (registration) openRegistration(registration);
    });
    deleteButton.addEventListener("click", async () => {
      const registration = activeRegistration;
      if (!registration) return;
      await deleteRegistration(registration, deleteButton);
      if (!registrations.some((item) => item.id === registration.id)) closeDialog();
    });
    paymentTournaments.addEventListener("click", (event) => {
      const pill = event.target.closest("[data-payment-tournament]");
      if (pill) selectPaymentTournament(pill.dataset.paymentTournament);
    });
    paymentMatchCards.addEventListener("click", (event) => {
      const matchCard = event.target.closest("[data-payment-match]");
      if (!matchCard) return;
      selectedPaymentMatchKey = matchCard.dataset.paymentMatch;
      lobbyFilter.value = "all";
      syncRegistrationLobbyFilter();
      renderRegistrations();
    });
    statsStrip.addEventListener("click", (event) => {
      const stat = event.target.closest("[data-quick-filter]");
      if (stat) toggleQuickFilter(stat.dataset.quickFilter);
    });
    matchSelectorCards.addEventListener("click", (event) => {
      const card = event.target.closest("[data-match-card]");
      if (!card || card.dataset.matchCard === matchSelector.value) return;
      matchSelector.value = card.dataset.matchCard;
      matchSelector.dispatchEvent(new Event("change"));
    });
    matchStateOptions.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.name !== "matchState") return;
      matchPresentationMode.value = event.target.value;
      matchPresentationMode.dispatchEvent(new Event("change"));
    });
    document.querySelector("#adminClearFilters").addEventListener("click", clearFilters);
    search.addEventListener("input", renderRegistrations);
    [lobbyFilter, paymentFilter, registrationFilter, duplicateFilter, sortControl]
      .forEach((control) => control.addEventListener("change", renderRegistrations));
    const exportScopeLabel = (suffix = "") => {
      const selected = selectedPaymentMatch();
      if (!selected) return `Selected match${suffix}`;
      const label = cycleLabel(selected);
      return `${selected.tournamentName} · ${label.date} · ${label.state}${suffix}`;
    };
    document.querySelector("#adminExportFiltered").addEventListener("click", () => exportPaymentReport(visibleRegistrations(), exportScopeLabel(" · current filters")));
    document.querySelector("#adminExportAll").addEventListener("click", () => exportPaymentReport(paymentMatchRegistrations(), exportScopeLabel()));
    const initialSessionToken = authTransitionToken;
    client.auth.onAuthStateChange((event, session) => {
      // getSession() handles the initial state. Later refreshes and repeated
      // same-user events revalidate approval without tearing down authorized UI.
      if (event === "INITIAL_SESSION") return;
      const nextUserId = session?.user?.id || "";
      if (nextUserId && nextUserId === activeOrganizerId && !dashboard.hidden) {
        window.setTimeout(() => revalidateOrganizerAccess(session.user), 0);
        return;
      }
      window.setTimeout(() => showSession(session), 0);
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (initialSessionToken === authTransitionToken) await showSession(data.session);
  } catch (error) {
    setup.hidden = false;
    setup.innerHTML = `<strong>Supabase could not start</strong><p>${escapeHtml(error?.message || "Check the public configuration.")}</p>`;
  }
}

initializeAdmin();
