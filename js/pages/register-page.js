import {
  config,
  escapeHtml,
  eventMark,
  formatCurrency,
  formatDateTime,
  getCapacity,
  getEventMedia,
  getEventState,
  getRequestedTournament,
  getTournament,
  tournaments
} from "../shared/data.js";
import {
  buildRegistrationMessage,
  collectRegistration,
  createRegistrationId,
  registrationWhatsAppUrl,
  validateRegistration
} from "../shared/registration.js";
import { icon, initializeShell, showToast } from "../shared/shell.js";
import { initializeMotion, transitionUpdate } from "../shared/motion.js";

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
const copyButton = document.querySelector("#copyRegistrationMessage");
const progress = document.querySelector("#wizardProgressBar");
let activeStep = 1;
let selectedTournament = null;
let preparedMessage = "";

function playerFields(number, captain = false) {
  return `
    <fieldset class="player-entry">
      <legend><span>Player ${number}</span>${captain ? "<small>Captain</small>" : ""}</legend>
      <div class="form-grid form-grid--player">
        <div class="field"><label for="player${number}Name">Player name <span>*</span></label><input id="player${number}Name" name="player${number}Name" type="text" minlength="2" maxlength="32" autocomplete="${captain ? "nickname" : "off"}" placeholder="In-game name" required></div>
        <div class="field"><label for="player${number}Uid">Free Fire UID <span>*</span></label><input id="player${number}Uid" name="player${number}Uid" type="text" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" placeholder="6–12 numbers" required></div>
        <div class="field field--age"><label for="player${number}Age">Age <span>*</span></label><input id="player${number}Age" name="player${number}Age" type="number" inputmode="numeric" min="${config.minimumAge}" max="80" placeholder="18" required></div>
      </div>
    </fieldset>`;
}

function matchPickerCard(tournament, index) {
  const state = getEventState(tournament);
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const id = `matchPick${index + 1}`;
  return `
    <input class="visually-hidden match-picker__input" id="${id}" name="tournament" type="radio" value="${escapeHtml(tournament.id)}" ${state.open ? "" : "disabled"} required>
    <label class="match-pick ${state.open ? "" : "match-pick--disabled"}" for="${id}">
      <span class="match-pick__image">
        <img src="${escapeHtml(media.src)}" alt="" loading="lazy" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}">
        <i aria-hidden="true"></i>
        <b aria-hidden="true">${escapeHtml(eventMark(tournament))}</b>
      </span>
      <span class="match-pick__body">
        <small>${escapeHtml(tournament.shortCode)} // ${escapeHtml(state.label)}</small>
        <strong>${escapeHtml(tournament.name)}</strong>
        <em>${escapeHtml(tournament.formatLabel)}</em>
        <span><b>${escapeHtml(formatCurrency(tournament.entryFee))}</b><i>${capacity.spotsLeft}/${capacity.capacity} open</i></span>
      </span>
      <span class="match-pick__check" aria-hidden="true">${icon("check")}</span>
    </label>`;
}

function renderLineupFields(tournament) {
  if (!tournament) {
    lineupMount.innerHTML = '<div class="inline-empty">Select a battle in Step 1 first.</div>';
    return;
  }

  if (tournament.type === "solo") {
    lineupMount.innerHTML = `
      <div class="lineup-heading"><div><span class="kicker">Lone fighter</span><h2>One-player loadout</h2></div><span class="lineup-count">1 / 1</span></div>
      <fieldset class="player-entry">
        <legend><span>Solo player</span></legend>
        <div class="form-grid form-grid--player">
          <div class="field"><label for="soloName">Player name <span>*</span></label><input id="soloName" name="soloName" type="text" minlength="2" maxlength="32" autocomplete="nickname" placeholder="In-game name" required></div>
          <div class="field"><label for="soloUid">Free Fire UID <span>*</span></label><input id="soloUid" name="soloUid" type="text" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="off" placeholder="6–12 numbers" required></div>
          <div class="field field--age"><label for="soloAge">Age <span>*</span></label><input id="soloAge" name="soloAge" type="number" inputmode="numeric" min="${config.minimumAge}" max="80" placeholder="18" required></div>
        </div>
      </fieldset>`;
  } else {
    lineupMount.innerHTML = `
      <div class="lineup-heading"><div><span class="kicker">Fireteam</span><h2>Four-player loadout</h2></div><span class="lineup-count">4 / 4</span></div>
      <div class="field team-name-field"><label for="teamName">Squad name <span>*</span></label><input id="teamName" name="teamName" type="text" minlength="2" maxlength="32" autocomplete="organization" placeholder="Example: Zone Hunters" required></div>
      ${[1, 2, 3, 4].map((number) => playerFields(number, number === 1)).join("")}`;
  }
}

function renderEventPreview(tournament) {
  if (!tournament) {
    eventPreview.hidden = true;
    eventPreview.textContent = "";
    return;
  }
  const state = getEventState(tournament);
  eventPreview.hidden = false;
  eventPreview.innerHTML = `<span class="visually-hidden">${icon("check")} Selected deployment:</span><strong>${escapeHtml(tournament.name)}</strong><small>${escapeHtml(formatDateTime(tournament.matchAt))} · ${escapeHtml(state.label)}</small>`;
}

function centerSelectedBattle(behavior = "smooth") {
  const checked = eventPicker.querySelector('input[name="tournament"]:checked');
  const card = checked?.nextElementSibling;
  if (!card) return;
  const left = card.offsetLeft - (eventPicker.clientWidth - card.offsetWidth) / 2;
  eventPicker.scrollTo({ left: Math.max(0, left), behavior });
}

function chooseTournament(event) {
  const checked = eventPicker.querySelector('input[name="tournament"]:checked');
  selectedTournament = getTournament(checked?.value) || null;
  renderEventPreview(selectedTournament);
  renderLineupFields(selectedTournament);
  result.hidden = true;
  window.requestAnimationFrame(() => centerSelectedBattle(event ? "smooth" : "auto"));
}

function setError(message, field) {
  errorBox.innerHTML = `${icon("shield")}<div><strong>Deployment blocked</strong><span>${escapeHtml(message)}</span></div>`;
  errorBox.hidden = false;
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  } else {
    errorBox.focus();
  }
}

function clearError() {
  errorBox.hidden = true;
  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute("aria-invalid"));
}

function validateStep(step) {
  clearError();
  if (step === 1) {
    if (!selectedTournament) {
      setError("Select an open battle before continuing.", eventPicker.querySelector('input:not([disabled])'));
      return false;
    }
    const state = getEventState(selectedTournament);
    if (!state.open) {
      setError(`${state.label}. Select another battle.`, eventPicker.querySelector('input:not([disabled])'));
      return false;
    }
    return true;
  }

  if (step === 2) {
    const fields = [...lineupMount.querySelectorAll("input")];
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      setError("Complete every player field using the requested format.", invalid);
      return false;
    }
    const registration = collectRegistration(selectedTournament, new FormData(form));
    const message = validateRegistration(selectedTournament, registration);
    if (message) {
      setError(message);
      return false;
    }
    return true;
  }

  const missing = [...form.querySelectorAll("[data-consent]")].find((checkbox) => !checkbox.checked);
  if (missing) {
    setError("Accept each confirmation before opening WhatsApp.", missing);
    return false;
  }
  return true;
}

function renderReview() {
  const registration = collectRegistration(selectedTournament, new FormData(form));
  reviewMount.innerHTML = `
    <div class="review-event"><span class="kicker">${escapeHtml(selectedTournament.shortCode)} // LOCKED</span><h2>${escapeHtml(selectedTournament.name)}</h2><p>${escapeHtml(selectedTournament.formatLabel)} · ${escapeHtml(formatDateTime(selectedTournament.matchAt))}</p></div>
    ${registration.teamName ? `<div class="review-team"><small>Fireteam</small><strong>${escapeHtml(registration.teamName)}</strong></div>` : ""}
    <div class="review-lineup">${registration.participants.map((participant, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.uid)} · Age ${escapeHtml(participant.age)}${participant.captain && selectedTournament.type === "squad" ? " · Captain" : ""}</small></div></article>`).join("")}</div>
    <div class="review-price"><div><small>Entry</small><strong>${escapeHtml(formatCurrency(selectedTournament.entryFee))}</strong></div><span>${escapeHtml(selectedTournament.feeUnit)}</span></div>`;
}

function goToStep(step, moveFocus = true) {
  activeStep = Math.min(3, Math.max(1, step));
  clearError();
  if (activeStep < 3) result.hidden = true;
  panels.forEach((panel) => { panel.hidden = Number(panel.dataset.stepPanel) !== activeStep; });
  stepItems.forEach((item) => {
    const itemStep = Number(item.dataset.stepItem);
    if (itemStep === activeStep) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
    item.classList.toggle("is-complete", itemStep < activeStep);
  });
  progress.style.width = `${(activeStep / 3) * 100}%`;
  document.querySelector("#wizardStepLabel").textContent = `Phase ${activeStep} / 3`;
  if (activeStep === 3) renderReview();
  if (moveFocus) {
    const heading = panels.find((panel) => !panel.hidden)?.querySelector("h1, h2");
    window.scrollTo({ top: Math.max(0, form.getBoundingClientRect().top + window.scrollY - 120), behavior: "smooth" });
    window.setTimeout(() => heading?.focus({ preventScroll: true }), 220);
  }
}

async function copyMessage() {
  if (!preparedMessage) return;
  try {
    await navigator.clipboard.writeText(preparedMessage);
    showToast("Uplink message copied.");
  } catch {
    showToast("Copy unavailable. Use the WhatsApp uplink instead.");
  }
}

function submitRegistration(event) {
  event.preventDefault();
  if (!validateStep(3)) return;
  const registration = collectRegistration(selectedTournament, new FormData(form));
  const reference = createRegistrationId(selectedTournament);
  preparedMessage = buildRegistrationMessage(selectedTournament, registration, reference);
  const url = registrationWhatsAppUrl(selectedTournament, registration, reference);
  resultReference.textContent = reference;
  resultWhatsApp.href = url;
  result.hidden = false;
  window.open(url, "_blank", "noopener,noreferrer");
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

function initializeWizard() {
  initializeShell();
  form.dataset.enhanced = "true";
  eventPicker.innerHTML = tournaments.map(matchPickerCard).join("");

  const requested = getRequestedTournament();
  if (requested && getEventState(requested).open) {
    const input = eventPicker.querySelector(`input[value="${CSS.escape(requested.id)}"]`);
    if (input) input.checked = true;
  }
  chooseTournament();
  eventPicker.addEventListener("change", chooseTournament);

  document.querySelectorAll("[data-next-step]").forEach((button) => button.addEventListener("click", () => {
    if (!validateStep(activeStep)) return;
    transitionUpdate(() => goToStep(activeStep + 1));
  }));
  document.querySelectorAll("[data-previous-step]").forEach((button) => button.addEventListener("click", () => transitionUpdate(() => goToStep(activeStep - 1))));
  form.addEventListener("submit", submitRegistration);
  copyButton.addEventListener("click", copyMessage);
  document.querySelector("#editRegistration")?.addEventListener("click", () => goToStep(2));
  goToStep(1, false);
  initializeMotion();
}

initializeWizard();
