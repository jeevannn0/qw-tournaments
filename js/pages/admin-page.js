import { escapeHtml, getEventPresentation, getTimeSlotState, normalize, tournaments } from "../shared/data.js?v=20261011-lifecycle";
import { getSupabaseClient, isSupabaseConfigured } from "../shared/supabase.js?v=20261011-lifecycle";
import {
  applyMatchCardOverride,
  getMatchCardDefaults,
  hydrateTournamentOverrides,
  loadAdminMatchCardOverrides,
  MATCH_CARD_IDS,
  resetMatchCardPresentation
} from "../shared/tournament-backend.js?v=20261011-lifecycle";
import { paymentMethodLabel } from "../shared/registration-backend.js?v=20261011-lifecycle";
import { clearCustomRoomCredentials, loadActiveCustomRooms, saveCustomRoomCredentials } from "../shared/custom-room-backend.js?v=20261011-lifecycle";
import { initializeShell, showToast } from "../shared/shell.js?v=20261011-lifecycle";
import { initializeMotion } from "../shared/motion.js?v=20261011-lifecycle";

const setup = document.querySelector("#adminSetup");
const signedOut = document.querySelector("#adminSignedOut");
const denied = document.querySelector("#adminDenied");
const dashboard = document.querySelector("#adminDashboard");
const rows = document.querySelector("#adminRegistrationRows");
const paymentMatchCards = document.querySelector("#adminPaymentMatchCards");
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
    ? activeCustomRooms.map((room) => `<option value="${escapeHtml(room.tournamentId)}">${escapeHtml(room.tournamentName)} · ${room.active ? "Active" : "Inactive"}</option>`).join("")
    : '<option value="">No current-cycle matches</option>';
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
    ? `${formatTimestamp(selected.scheduledAt)} · registration cycle ${selected.registrationCycle} · ${selected.active ? "active" : "inactive"}${hasCredentials ? " · details published" : " · waiting for details"}`
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
    roomReload.textContent = "Reload active matches";
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
    roomSave.textContent = "Publish Custom Room details";
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
  matchStateExplainer.innerHTML = mode === "registration_open"
    ? "<strong>Registration open</strong><span>Publishes one lobby and lets players or squads submit registration and payment proof.</span>"
    : mode === "scheduled"
      ? "<strong>Scheduled</strong><span>Publishes match facts while keeping registration and payment closed.</span>"
      : "<strong>Coming soon</strong><span>Hides unpublished schedule, entry, and reward terms.</span>";
}

function setWinnerMatchOptions(preferredValue = winnerMatch.value) {
  const matches = availableWinnerMatches();
  winnerMatch.innerHTML = matches.map((match) => `<option value="${escapeHtml(match.key)}">${escapeHtml(match.tournamentName)} · cycle ${escapeHtml(match.registrationCycle)} · ${escapeHtml(match.timeSlotLabel)} · ${escapeHtml(match.state.label)} · ${escapeHtml(formatTimestamp(match.startsAt))}</option>`).join("");
  winnerMatch.disabled = !matches.length;
  if (matches.some((match) => match.key === preferredValue)) winnerMatch.value = preferredValue;
  syncWinnerEditor();
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
  document.querySelector("#adminMatchCapacityHelp").textContent = `Use 1–500 ${tournament.type === "solo" ? "players" : "teams"} for this lobby.`;
  syncMatchPresentationFields();
  matchVersion.textContent = override
    ? `Version ${override.version} · cycle ${override.registrationCycle} · last updated ${formatTimestamp(override.updatedAt)}`
    : "Checked-in default · version 0 · not yet saved";
  matchLockedFacts.innerHTML = [
    ["Type", tournament.type],
    ["Format", tournament.formatLabel],
    ["Server", tournament.server],
    ["Platform", tournament.platform]
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
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
  matchReload.textContent = "Reload server version";
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
      <div><span>${escapeHtml(result.timeSlotLabel)}</span><strong>${escapeHtml(result.displayName)}</strong><code>${escapeHtml(result.uid)}</code></div>
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
    const generation = adminDataGeneration;
    const [playersResponse, resultsResponse] = await Promise.all([
      client.rpc("get_admin_public_players"),
      client.from("match_results").select("id, tournament_id, registration_cycle, time_slot_id, time_slot_label, time_slot_at, winner_public_player_id, display_name, ff_uid, kills, prize_amount, image_path, image_alt, published_at").order("time_slot_at", { ascending: false })
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
      || `${player.displayName} celebrates winning ${match.timeSlotLabel}`;
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

function renderPaymentMatchCards() {
  const configurations = paymentMatchConfigurations();
  if (!configurations.some((item) => item.key === selectedPaymentMatchKey)) {
    const openMatch = configurations.find((item) => item.current && item.tournament && getEventPresentation(item.tournament).state.open);
    const currentMatch = configurations.find((item) => item.current);
    const populatedMatch = configurations.find((item) => registrations.some((registration) => registration.tournamentId === item.tournamentId
      && registration.registrationCycle === item.registrationCycle));
    selectedPaymentMatchKey = (openMatch || currentMatch || populatedMatch || configurations[0])?.key || "";
  }
  paymentMatchCards.innerHTML = configurations.length
    ? configurations.map((configuration) => {
      const selected = configuration.key === selectedPaymentMatchKey;
      const lifecycleLabel = configuration.current ? "Current" : configuration.registrationCycle === 0 ? "Legacy" : "Archived";
      const stateLabel = configuration.current && configuration.tournament
        ? getEventPresentation(configuration.tournament).state.label
        : lifecycleLabel;
      const count = registrations.filter((registration) => registration.tournamentId === configuration.tournamentId
        && registration.registrationCycle === configuration.registrationCycle).length;
      const code = configuration.tournament?.shortCode || configuration.tournamentId;
      return `<button class="admin-payment-match-card" type="button" aria-pressed="${selected}" data-payment-match="${escapeHtml(configuration.key)}"><span>${escapeHtml(code)} · ${escapeHtml(lifecycleLabel)} · ${escapeHtml(stateLabel)}</span><strong>${escapeHtml(configuration.tournamentName)}</strong><small>${escapeHtml(lifecycleLabel)} cycle ${escapeHtml(configuration.registrationCycle)} · <b>${escapeHtml(count)}</b> payment${count === 1 ? "" : "s"}</small></button>`;
    }).join("")
    : '<div class="inline-empty">No current or archived registrations are available.</div>';
}

function syncRegistrationLobbyFilter() {
  const previous = lobbyFilter.value;
  const lobbies = [...new Map(paymentMatchRegistrations().map((registration) => [registration.timeSlot.id, registration.timeSlot])).values()]
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  lobbyFilter.innerHTML = `<option value="all">All match lobbies</option>${lobbies.map((lobby) => `<option value="${escapeHtml(lobby.id)}">${escapeHtml(lobby.label)}</option>`).join("")}`;
  lobbyFilter.value = previous === "all" || lobbies.some((lobby) => lobby.id === previous) ? previous : "all";
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
    if (sortControl.value === "player") return a.participant.displayName.localeCompare(b.participant.displayName);
    if (sortControl.value === "transaction") return a.payment.transactionReference.localeCompare(b.payment.transactionReference);
    return timestampDate(b.submittedAt) - timestampDate(a.submittedAt);
  });
}

function renderMetrics(scope = paymentMatchRegistrations()) {
  document.querySelector("#adminTotal").textContent = String(scope.length);
  document.querySelector("#adminPending").textContent = String(scope.filter((item) => item.registrationStatus === "pending").length);
  document.querySelector("#adminPaid").textContent = String(scope.filter((item) => item.paymentStatus === "verified").length);
  document.querySelector("#adminConfirmed").textContent = String(scope.filter((item) => item.registrationStatus === "confirmed").length);
  document.querySelector("#adminDuplicates").textContent = String(new Set(scope.filter((item) => item.duplicateCount > 1).map((item) => item.payment.transactionReference)).size);
}

function renderRegistrations() {
  const focusedAction = rows.contains(document.activeElement)
    ? ["data-open-registration", "data-delete-registration"].map((attribute) => [attribute, document.activeElement.getAttribute(attribute)]).find(([, value]) => value)
    : null;
  renderPaymentMatchCards();
  const scope = paymentMatchRegistrations();
  renderMetrics(scope);
  const visible = visibleRegistrations();
  const selected = selectedPaymentMatch();
  listMeta.textContent = selected
    ? `${visible.length} of ${scope.length} registrations shown for ${selected.tournamentName} · ${selected.current ? "current" : "archived"} cycle ${selected.registrationCycle}`
    : "No current match card is available.";
  empty.hidden = visible.length !== 0;
  document.querySelector(".admin-table-wrap").hidden = visible.length === 0;
  rows.innerHTML = visible.map((registration) => `
    <tr>
      <td data-label="Submitted">${escapeHtml(formatTimestamp(registration.submittedAt))}</td>
      <td data-label="Player"><strong>${escapeHtml(registration.teamName || registration.participant.displayName || "Unnamed")}</strong><small>${escapeHtml(registration.teamName ? `${registration.participants.length} players · Captain ${registration.participant.displayName}` : registration.participant.uid)}</small></td>
      <td data-label="Lobby"><strong>${escapeHtml(registration.timeSlot.label)}</strong><small>${escapeHtml(formatTimestamp(registration.timeSlot.startsAt))} · ${escapeHtml(registrationMatchState(registration).label)}</small></td>
      <td data-label="Reference"><code>${escapeHtml(registration.reference)}</code></td>
      <td data-label="Payment / UTR"><div class="admin-payment-cell">${statusBadge(registration.paymentStatus)}<code>${escapeHtml(registration.payment.transactionReference)}</code>${registration.duplicateCount > 1 ? `<span class="duplicate-warning">Duplicate ×${registration.duplicateCount}</span>` : ""}</div></td>
      <td data-label="Registration">${statusBadge(registration.registrationStatus)}</td>
      <td data-label="Action"><div class="admin-row-actions"><button class="button button--quiet" type="button" data-open-registration="${escapeHtml(registration.id)}">Review</button><button class="button admin-delete-button" type="button" data-delete-registration="${escapeHtml(registration.id)}" ${["cancelled", "rejected"].includes(registration.registrationStatus) ? "" : 'disabled title="Cancel or reject before deleting"'}>Delete</button></div></td>
    </tr>`).join("");
  if (focusedAction) rows.querySelector(`[${focusedAction[0]}="${CSS.escape(focusedAction[1])}"]`)?.focus();
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
  const lineupDetails = registration.participants.map((participant, index) => `${detailPair(registration.teamName ? `Player ${index + 1}${index === 0 ? " (Captain)" : ""}` : "In-game name", participant.displayName)}${detailPair("Free Fire UID", participant.uid)}${detailPair("Age", String(participant.age))}`).join("");
  detailContent.innerHTML = `
    <section><h3>${registration.teamName ? escapeHtml(registration.teamName) : "Player"}</h3><dl class="admin-detail-list">${lineupDetails}${detailPair("Private WhatsApp", registration.contactWhatsapp)}</dl></section>
    <section><h3>Payment</h3><dl class="admin-detail-list">${detailPair("Amount", `₹${registration.payment.amount}`)}${detailPair("Method", paymentMethodLabel(registration.payment.method))}${detailPair("Transaction reference", registration.payment.transactionReference)}${detailPair("Automatic UTR check", registration.duplicateCount > 1 ? `Duplicate across ${registration.duplicateCount} registrations` : "Unique in current registrations")}${detailPair("File", `${registration.payment.contentType} · ${(registration.payment.size / (1024 * 1024)).toFixed(2)} MB`)}</dl></section>
    <section><h3>Submission</h3><dl class="admin-detail-list">${detailPair("Tournament", registration.tournamentName)}${detailPair("Selected lobby", `${registration.timeSlot.label} — ${formatTimestamp(registration.timeSlot.startsAt)} — ${registrationMatchState(registration).label}`)}${detailPair("Capacity", String(registration.slotCapacity))}${detailPair("Submitted", formatTimestamp(registration.submittedAt))}${detailPair("Updated", formatTimestamp(registration.updatedAt))}${detailPair("Database record", registration.id)}</dl></section>`;
  document.querySelector("#adminPaymentStatus").value = registration.paymentStatus;
  document.querySelector("#adminRegistrationStatus").value = registration.registrationStatus;
  const slotInput = document.querySelector("#adminSlot");
  slotInput.max = String(registration.slotCapacity);
  slotInput.previousElementSibling.textContent = registration.teamName ? "Team number in selected lobby" : "Player number in selected lobby";
  slotInput.value = registration.slot || "";
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
  const registrationId = activeRegistration.id;
  loadProofButton.disabled = true;
  loadProofButton.textContent = "Loading private screenshot…";
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
  if (registrationStatus === "confirmed" && (!Number.isInteger(slot) || slot < 1 || slot > activeRegistration.slotCapacity)) {
    detailStatus.hidden = false;
    detailStatus.innerHTML = `<strong>Assign a ${activeRegistration.teamName ? "team" : "player"} number from 1 to ${escapeHtml(activeRegistration.slotCapacity)} before confirmation.</strong>`;
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
      p_note: organizerNote,
      p_expected_updated_at: activeRegistration.updatedAt
    });
    if (error) throw error;
    showToast(registrationStatus === "confirmed" ? "Registration confirmed and public roster updated." : "Private review saved.");
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

function refreshAdminData() {
  loadRegistrations();
  loadWinnerData();
}

function startRegistrationFeed() {
  stopRegistrationFeed();
  refreshAdminData();
  refreshTimer = window.setInterval(refreshAdminData, 30000);
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
    clearAdminState();
    signedOut.hidden = true;
    dashboard.hidden = true;
    denied.hidden = false;
    document.querySelector("#adminDeniedMessage").textContent = `${user.email || "This account"} is signed in but is not on the active organizer list.`;
    return;
  }
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
    matchForm.addEventListener("input", () => { matchEditorDirty = true; });
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
    paymentMatchCards.addEventListener("click", (event) => {
      const matchCard = event.target.closest("[data-payment-match]");
      if (!matchCard) return;
      selectedPaymentMatchKey = matchCard.dataset.paymentMatch;
      lobbyFilter.value = "all";
      syncRegistrationLobbyFilter();
      renderRegistrations();
    });
    search.addEventListener("input", renderRegistrations);
    [lobbyFilter, paymentFilter, registrationFilter, duplicateFilter, sortControl]
      .forEach((control) => control.addEventListener("change", renderRegistrations));
    document.querySelector("#adminExportFiltered").addEventListener("click", () => {
      const selected = selectedPaymentMatch();
      exportPaymentReport(visibleRegistrations(), selected ? `${selected.tournamentName} · ${selected.current ? "current" : "archived"} cycle ${selected.registrationCycle} · current filters` : "Selected match · current filters");
    });
    document.querySelector("#adminExportAll").addEventListener("click", () => {
      const selected = selectedPaymentMatch();
      exportPaymentReport(paymentMatchRegistrations(), selected ? `${selected.tournamentName} · ${selected.current ? "current" : "archived"} cycle ${selected.registrationCycle}` : "Selected match");
    });
    const initialSessionToken = authTransitionToken;
    client.auth.onAuthStateChange((_event, session) => {
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
