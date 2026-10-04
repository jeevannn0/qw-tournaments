import {
  config,
  escapeHtml,
  eventMark,
  formatCurrency,
  formatReward,
  getCapacity,
  getEventMedia,
  getEventState,
  getRequestedTournament,
  getTournament,
  tournaments
} from "../shared/data.js";
import {
  buildGroupJoinMessage,
  collectRegistration,
  createRegistrationId,
  registrationWhatsAppUrl,
  validateRegistration
} from "../shared/registration.js";
import { icon, initializeShell, showToast } from "../shared/shell.js";
import { initializeMotion, preferredScrollBehavior, transitionUpdate } from "../shared/motion.js";

const form = document.querySelector("#registrationWizard");
const panels = [...form.querySelectorAll("[data-step-panel]")];
const stepItems = [...document.querySelectorAll("[data-step-item]")];
const eventPicker = document.querySelector("#registrationEvent");
const lineupMount = document.querySelector("#lineupFields");
const eventPreview = document.querySelector("#registrationEventPreview");
const reviewMount = document.querySelector("#registrationReview");
const errorBox = document.querySelector("#wizardError");
const result = document.querySelector("#registrationResult");
const resultReference = document.querySelector("#resultReference");
const resultWhatsApp = document.querySelector("#resultWhatsApp");
const resultGroup = document.querySelector("#resultGroup");
const copyButton = document.querySelector("#copyRegistrationMessage");
const progress = document.querySelector("#wizardProgress");
const progressBar = document.querySelector("#wizardProgressBar");
let activeStep = 1;
let selectedTournament = null;
let preparedGroupMessage = "";

function requiredLabel(text) {
  return `${text} <span class="required-label"><span aria-hidden="true">*</span><span class="visually-hidden"> required</span></span>`;
}

function playerFields(number, captain = false) {
  const prefix = `player${number}`;
  return `
    <fieldset class="player-entry">
      <legend><span>Player ${number}</span>${captain ? "<small>Captain</small>" : ""}</legend>
      <div class="form-grid form-grid--player">
        <div class="field"><label for="${prefix}Name">${requiredLabel("In-game name")}</label><input id="${prefix}Name" name="${prefix}Name" type="text" minlength="2" maxlength="32" autocomplete="${captain ? "nickname" : "off"}" placeholder="Player name" required></div>
        <div class="field"><label for="${prefix}Uid">${requiredLabel("Free Fire UID")}</label><input id="${prefix}Uid" name="${prefix}Uid" type="text" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" placeholder="6–12 numbers" aria-describedby="${prefix}UidHelp" required><small id="${prefix}UidHelp">Numbers only; check every digit.</small></div>
        <div class="field field--age"><label for="${prefix}Age">${requiredLabel("Age")}</label><input id="${prefix}Age" name="${prefix}Age" type="number" inputmode="numeric" min="${config.minimumAge}" max="80" placeholder="18" required></div>
      </div>
    </fieldset>`;
}

function matchPickerCard(tournament, index) {
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const comingSoon = tournament.comingSoon === true;
  const id = `matchPick${index + 1}`;
  const price = comingSoon ? "Entry TBA" : `${formatCurrency(tournament.entryFee)} entry`;
  const availability = comingSoon ? "Not open" : `${capacity.spotsLeft}/${capacity.capacity} open`;
  return `
    <input class="visually-hidden match-picker__input" id="${id}" name="tournament" type="radio" value="${escapeHtml(tournament.id)}" ${state.open ? "" : "disabled"} required>
    <label class="match-pick ${state.open ? "" : "match-pick--disabled"}" for="${id}">
      <span class="match-pick__image"><img src="${escapeHtml(media.src)}" alt="" width="480" height="270" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}"><i aria-hidden="true"></i><b aria-hidden="true">${escapeHtml(eventMark(tournament))}</b></span>
      <span class="match-pick__body"><small>${escapeHtml(tournament.shortCode)} · ${escapeHtml(state.label)}</small><strong>${escapeHtml(tournament.name)}</strong><em>${escapeHtml(tournament.formatLabel)}</em><span><b>${escapeHtml(price)}</b><i>${escapeHtml(availability)}</i></span>${comingSoon ? "" : `<span class="match-pick__reward">${escapeHtml(formatReward(tournament))}</span>`}</span>
      <span class="match-pick__check" aria-hidden="true">${icon("check")}</span>
    </label>`;
}

function renderLineupFields(tournament) {
  if (!tournament) {
    lineupMount.innerHTML = '<div class="inline-empty">Choose an open match first.</div>';
    return;
  }

  if (tournament.type === "solo") {
    lineupMount.innerHTML = `
      <div class="lineup-heading"><div><span class="kicker">Solo entry</span><h2>One player</h2></div><span class="lineup-count">1 / 1</span></div>
      <fieldset class="player-entry"><legend><span>Solo player</span></legend><div class="form-grid form-grid--player">
        <div class="field"><label for="soloName">${requiredLabel("In-game name")}</label><input id="soloName" name="soloName" type="text" minlength="2" maxlength="32" autocomplete="nickname" placeholder="Player name" required></div>
        <div class="field"><label for="soloUid">${requiredLabel("Free Fire UID")}</label><input id="soloUid" name="soloUid" type="text" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" placeholder="6–12 numbers" aria-describedby="soloUidHelp" required><small id="soloUidHelp">Numbers only; check every digit.</small></div>
        <div class="field field--age"><label for="soloAge">${requiredLabel("Age")}</label><input id="soloAge" name="soloAge" type="number" inputmode="numeric" min="${config.minimumAge}" max="80" placeholder="18" required></div>
      </div></fieldset>`;
  } else {
    lineupMount.innerHTML = `
      <div class="lineup-heading"><div><span class="kicker">Squad entry</span><h2>Four players</h2></div><span class="lineup-count">4 / 4</span></div>
      <div class="field team-name-field"><label for="teamName">${requiredLabel("Squad name")}</label><input id="teamName" name="teamName" type="text" minlength="2" maxlength="32" autocomplete="organization" placeholder="Example: Zone Hunters" required></div>
      ${[1, 2, 3, 4].map((number) => playerFields(number, number === 1)).join("")}`;
  }
}

function renderEventPreview(tournament) {
  if (!tournament) {
    eventPreview.hidden = true;
    eventPreview.textContent = "";
    return;
  }
  eventPreview.hidden = false;
  eventPreview.innerHTML = `<span>Selected Solo match</span><strong>${escapeHtml(tournament.name)}</strong><small>Always open · ${escapeHtml(formatCurrency(tournament.entryFee))} entry · ${escapeHtml(formatReward(tournament))}</small>`;
}

function centerSelectedBattle(behavior = preferredScrollBehavior()) {
  const checked = eventPicker.querySelector('input[name="tournament"]:checked');
  const card = checked?.nextElementSibling;
  if (!card) return;
  const left = card.offsetLeft - (eventPicker.clientWidth - card.offsetWidth) / 2;
  eventPicker.scrollTo({ left: Math.max(0, left), behavior });
}

function chooseTournament(event) {
  const checked = eventPicker.querySelector('input[name="tournament"]:checked');
  selectedTournament = getTournament(checked?.value);
  renderEventPreview(selectedTournament);
  renderLineupFields(selectedTournament);
  result.hidden = true;
  window.requestAnimationFrame(() => centerSelectedBattle(event ? preferredScrollBehavior() : "auto"));
}

function fieldForName(name) {
  return name ? form.elements.namedItem(name) : null;
}

function setError(message, field) {
  errorBox.innerHTML = `${icon("shield")}<div><strong>Check this step</strong><span>${escapeHtml(message)}</span></div>`;
  errorBox.hidden = false;
  if (field instanceof HTMLElement) {
    field.setAttribute("aria-invalid", "true");
    const describedBy = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    describedBy.add("wizardError");
    field.setAttribute("aria-describedby", [...describedBy].join(" "));
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  } else {
    errorBox.focus();
  }
}

function clearError() {
  errorBox.hidden = true;
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute("aria-invalid");
    const describedBy = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== "wizardError");
    if (describedBy.length) field.setAttribute("aria-describedby", describedBy.join(" "));
    else field.removeAttribute("aria-describedby");
  });
}

function currentEventIsOpen() {
  if (!selectedTournament) return { valid: false, message: "Choose an open match before continuing." };
  const state = getEventState(selectedTournament);
  if (!state.open) return { valid: false, message: `${state.label}. Choose another match.` };
  return { valid: true, message: "" };
}

function validateStep(step) {
  clearError();
  const eventCheck = currentEventIsOpen();
  if (!eventCheck.valid) {
    setError(eventCheck.message, eventPicker.querySelector('input:not([disabled])'));
    return false;
  }
  if (step === 1) return true;

  if (step === 2) {
    const fields = [...lineupMount.querySelectorAll("input")];
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      setError(invalid.validity.patternMismatch ? "Use the requested format for this field." : "Complete this required field.", invalid);
      return false;
    }
    const validation = validateRegistration(selectedTournament, collectRegistration(selectedTournament, new FormData(form)));
    if (validation) {
      setError(validation.message, fieldForName(validation.fieldName));
      return false;
    }
    return true;
  }

  const missing = [...form.querySelectorAll("[data-consent]")].find((checkbox) => !checkbox.checked);
  if (missing) {
    setError("Accept every confirmation before opening WhatsApp.", missing);
    return false;
  }
  return true;
}

function renderReview() {
  const registration = collectRegistration(selectedTournament, new FormData(form));
  reviewMount.innerHTML = `
    <div class="review-event"><span class="kicker">${escapeHtml(selectedTournament.shortCode)} · Selected</span><h2>${escapeHtml(selectedTournament.name)}</h2><p>${escapeHtml(selectedTournament.formatLabel)} · Always open</p></div>
    ${registration.teamName ? `<div class="review-team"><small>Squad</small><strong>${escapeHtml(registration.teamName)}</strong></div>` : ""}
    <div class="review-lineup">${registration.participants.map((participant, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.uid)} · Age ${escapeHtml(participant.age)}${participant.captain && selectedTournament.type === "squad" ? " · Captain" : ""}</small></div></article>`).join("")}</div>
    <div class="review-price"><div><small>Entry</small><strong>${escapeHtml(formatCurrency(selectedTournament.entryFee))}</strong></div><span>${escapeHtml(selectedTournament.feeUnit)}</span></div>
    <div class="review-rewards"><span><strong>${escapeHtml(formatCurrency(selectedTournament.killReward))}</strong><small>per confirmed kill</small></span><span><strong>${escapeHtml(formatCurrency(selectedTournament.booyahBonus))}</strong><small>additional Booyah bonus</small></span></div>`;
}

function goToStep(step, moveFocus = true) {
  activeStep = Math.min(3, Math.max(1, step));
  clearError();
  if (activeStep < 3) result.hidden = true;
  panels.forEach((panel) => { panel.hidden = Number(panel.dataset.stepPanel) !== activeStep; });
  stepItems.forEach((item) => {
    const itemStep = Number(item.dataset.stepItem);
    item.toggleAttribute("aria-current", itemStep === activeStep);
    if (itemStep === activeStep) item.setAttribute("aria-current", "step");
    item.classList.toggle("is-complete", itemStep < activeStep);
  });
  progressBar.style.width = `${(activeStep / 3) * 100}%`;
  progress.setAttribute("aria-valuenow", String(activeStep));
  document.querySelector("#wizardStepLabel").textContent = `Step ${activeStep} of 3`;
  if (activeStep === 3) renderReview();
  if (moveFocus) {
    const panel = panels.find((candidate) => !candidate.hidden);
    panel?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
    window.setTimeout(() => panel?.querySelector("h2")?.focus({ preventScroll: true }), preferredScrollBehavior() === "auto" ? 0 : 180);
  }
}

async function copyMessage() {
  if (!preparedGroupMessage) return;
  try {
    await navigator.clipboard.writeText(preparedGroupMessage);
    showToast("Group-safe match details copied. Paste them after joining.");
  } catch {
    showToast("Copy unavailable. Use Copy group details again.");
  }
}

function submitRegistration(event) {
  event.preventDefault();
  if (!validateStep(3)) return;
  const registration = collectRegistration(selectedTournament, new FormData(form));
  const reference = createRegistrationId(selectedTournament);
  const privateUrl = registrationWhatsAppUrl(selectedTournament, registration, reference);
  preparedGroupMessage = buildGroupJoinMessage(selectedTournament, registration, reference);
  if (!privateUrl) {
    setError("Organizer contact is unavailable. Registration cannot continue safely.");
    return;
  }

  const groupUrl = config.whatsappGroupSafe ? config.whatsappGroupUrl : "";
  resultReference.textContent = reference;
  resultWhatsApp.href = privateUrl;
  resultGroup.hidden = !groupUrl;
  if (groupUrl) resultGroup.href = groupUrl;
  form.hidden = true;
  result.hidden = false;

  const copyPromise = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(preparedGroupMessage)
    : Promise.reject(new Error("Clipboard unavailable"));
  (groupUrl ? resultGroup : resultWhatsApp).click();
  copyPromise
    .then(() => showToast(groupUrl ? "Group opened. Match details copied—paste them after joining." : "Match details copied."))
    .catch(() => showToast(groupUrl ? "Group opened. Use Copy group details before posting." : "Copy unavailable."));

  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
}

function initializeWizard() {
  initializeShell();
  form.dataset.enhanced = "true";
  eventPicker.innerHTML = tournaments.map(matchPickerCard).join("");
  const requested = getRequestedTournament();
  if (requested && getEventState(requested).open) {
    const input = eventPicker.querySelector(`input[value="${CSS.escape(requested.id)}"]`);
    if (input) input.checked = true;
  } else {
    const firstOpen = eventPicker.querySelector('input[name="tournament"]:not([disabled])');
    if (firstOpen) firstOpen.checked = true;
  }
  chooseTournament();
  eventPicker.addEventListener("change", chooseTournament);
  document.querySelectorAll("[data-next-step]").forEach((button) => button.addEventListener("click", () => {
    if (validateStep(activeStep)) transitionUpdate(() => goToStep(activeStep + 1));
  }));
  document.querySelectorAll("[data-previous-step]").forEach((button) => button.addEventListener("click", () => transitionUpdate(() => goToStep(activeStep - 1))));
  form.addEventListener("submit", submitRegistration);
  copyButton.addEventListener("click", copyMessage);
  document.querySelector("#editRegistration")?.addEventListener("click", () => {
    form.hidden = false;
    result.hidden = true;
    goToStep(2);
  });
  goToStep(1, false);
  initializeMotion();
}

initializeWizard();
