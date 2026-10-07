import {
  config,
  escapeHtml,
  eventMark,
  formatCurrency,
  formatDateTime,
  formatLobbySchedule,
  formatReward,
  getCapacity,
  getEventMedia,
  getEventPresentation,
  getEventState,
  getEventTimeSlots,
  getOpenTimeSlots,
  getRequestedTournament,
  getTimeSlot,
  getTimeSlotState,
  getTournament,
  tournaments
} from "../shared/data.js?v=20261011-lifecycle";
import { hydrateTournamentOverrides } from "../shared/tournament-backend.js?v=20261011-lifecycle";
import {
  buildGroupJoinMessage,
  collectRegistration,
  createRegistrationId,
  registrationWhatsAppUrl,
  validateRegistration
} from "../shared/registration.js?v=20261011-lifecycle";
import {
  collectPaymentDetails,
  MAX_PAYMENT_PROOF_BYTES,
  paymentMethodLabel,
  registrationSubmissionError,
  submitCompleteRegistration,
  validatePaymentDetails
} from "../shared/registration-backend.js?v=20261011-lifecycle";
import { isSupabaseConfigured } from "../shared/supabase.js?v=20261011-lifecycle";
import { icon, initializeShell, showToast } from "../shared/shell.js?v=20261011-lifecycle";
import { initializeMotion, preferredScrollBehavior, transitionUpdate } from "../shared/motion.js?v=20261011-lifecycle";

const form = document.querySelector("#registrationWizard");
const panels = [...form.querySelectorAll("[data-step-panel]")];
const stepItems = [...document.querySelectorAll("[data-step-item]")];
const eventPicker = document.querySelector("#registrationEvent");
const lobbyPicker = document.querySelector("#registrationLobby");
const lineupMount = document.querySelector("#lineupFields");
const eventPreview = document.querySelector("#registrationEventPreview");
const reviewMount = document.querySelector("#registrationReview");
const errorBox = document.querySelector("#wizardError");
const result = document.querySelector("#registrationResult");
const resultReference = document.querySelector("#resultReference");
const resultLobby = document.querySelector("#resultLobby");
const resultWhatsApp = document.querySelector("#resultWhatsApp");
const resultGroup = document.querySelector("#resultGroup");
const copyButton = document.querySelector("#copyRegistrationMessage");
const progress = document.querySelector("#wizardProgress");
const progressBar = document.querySelector("#wizardProgressBar");
const screenshotInput = document.querySelector("#paymentScreenshot");
const screenshotState = document.querySelector("#paymentScreenshotState");
const submitButton = document.querySelector("#submitRegistration");
const uploadStatus = document.querySelector("#registrationUploadProgress");
const uploadLabel = document.querySelector("#registrationUploadLabel");
const uploadMeter = document.querySelector("#registrationUploadMeter");
const supabaseWarning = document.querySelector("#supabaseSetupWarning");
const copyUpiButton = document.querySelector("#copyUpiId");
const lobbyHelp = document.querySelector("#registrationLobbyHelp");
const lobbyLegend = document.querySelector("#registrationLobbyLegend");
const paymentHeading = document.querySelector("#registrationPaymentHeading");
const paymentIntro = document.querySelector("#registrationPaymentIntro");
const payLabel = document.querySelector("#registrationPayLabel");
const paymentConsent = document.querySelector("#registrationPaymentConsent");
const verificationCopy = document.querySelector("#registrationVerificationCopy");
const registrationReady = isSupabaseConfigured() && config.upiSafe;
let activeStep = 1;
let selectedTournament = null;
let selectedTimeSlot = null;
let preparedGroupMessage = "";
let submitted = false;
let submitting = false;
let refreshingTournamentState = false;

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
  const presentation = getEventPresentation(tournament);
  const state = presentation.state;
  const capacity = getCapacity(tournament);
  const media = getEventMedia(tournament);
  const id = `matchPick${index + 1}`;
  const price = presentation.entryFee === null ? "Entry TBA" : `${formatCurrency(presentation.entryFee)} entry`;
  const availability = state.open ? `${capacity.spotsLeft}/${capacity.capacity} available` : state.label;
  return `
    <input class="visually-hidden match-picker__input" id="${id}" name="tournament" type="radio" value="${escapeHtml(tournament.id)}" ${state.open ? "" : "disabled"} required>
    <label class="match-pick ${state.open ? "" : "match-pick--disabled"}" for="${id}">
      <span class="match-pick__image"><img src="${escapeHtml(media.src)}" alt="" width="480" height="270" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" style="object-position:${escapeHtml(media.focus || "center")}"><i aria-hidden="true"></i><b aria-hidden="true">${escapeHtml(eventMark(tournament))}</b></span>
      <span class="match-pick__body"><small>${escapeHtml(tournament.shortCode)} · ${escapeHtml(state.label)}</small><strong>${escapeHtml(tournament.name)}</strong><em>${escapeHtml(tournament.formatLabel)}</em><span><b>${escapeHtml(price)}</b><i>${escapeHtml(availability)}</i></span>${presentation.comingSoon ? "" : `<span class="match-pick__reward">${escapeHtml(presentation.reward)}</span>`}</span>
      <span class="match-pick__check" aria-hidden="true">${icon("check")}</span>
    </label>`;
}

function lobbyChoice(tournament, timeSlot, index) {
  const id = `lobbyPick${index + 1}`;
  const state = getTimeSlotState(tournament, timeSlot);
  return `
    <input class="visually-hidden lobby-picker__input" id="${id}" name="timeSlot" type="radio" value="${escapeHtml(timeSlot.id)}" ${state.open ? "" : "disabled"} required>
    <label class="lobby-choice ${state.open ? "" : "lobby-choice--disabled"}" for="${id}">
      <span>Lobby ${index + 1}</span>
      <strong>${escapeHtml(timeSlot.label)}</strong>
      <time datetime="${escapeHtml(timeSlot.startsAt)}">${escapeHtml(formatDateTime(timeSlot.startsAt, "long"))}</time>
      <small>${escapeHtml(state.open ? `${timeSlot.spotsLeft}/${timeSlot.capacity} places available` : state.label)}</small>
      <i aria-hidden="true">${icon("check")}</i>
    </label>`;
}

function renderLobbyChoices(tournament, preferredTimeSlotId = "") {
  selectedTimeSlot = null;
  const timeSlots = getEventTimeSlots(tournament);
  lobbyPicker.innerHTML = timeSlots.length
    ? timeSlots.map((timeSlot, index) => lobbyChoice(tournament, timeSlot, index)).join("")
    : '<div class="inline-empty">No lobby times are available.</div>';
  lobbyPicker.querySelectorAll("input[disabled]").forEach((input) => { input.dataset.wasDisabled = "true"; });
  const preferred = preferredTimeSlotId ? lobbyPicker.querySelector(`input[value="${CSS.escape(preferredTimeSlotId)}"]:not([disabled])`) : null;
  if (preferred) {
    preferred.checked = true;
    selectedTimeSlot = getTimeSlot(tournament, preferredTimeSlotId);
  }
}

function chooseLobby() {
  const checked = lobbyPicker.querySelector('input[name="timeSlot"]:checked');
  selectedTimeSlot = getTimeSlot(selectedTournament, checked?.value);
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
  const presentation = getEventPresentation(tournament);
  eventPreview.hidden = false;
  eventPreview.innerHTML = `<span>Selected ${escapeHtml(tournament.type === "solo" ? "Solo match" : "squad match")}</span><strong>${escapeHtml(tournament.name)}</strong><small>${escapeHtml(formatLobbySchedule(tournament))} · ${escapeHtml(formatCurrency(presentation.entryFee))} entry · ${escapeHtml(presentation.reward)}</small>`;
}

function updateRegistrationCopy(tournament) {
  if (!tournament) return;
  const presentation = getEventPresentation(tournament);
  const fee = formatCurrency(presentation.entryFee);
  const unit = tournament.type === "solo" ? "player" : "4-player squad";
  const capacity = presentation.capacity;
  lobbyHelp.textContent = `Choose the available ${tournament.name} lobby. Capacity: ${capacity} ${tournament.type === "solo" ? "players" : "teams"}.`;
  lobbyLegend.childNodes[0].textContent = `Choose your ${tournament.type === "solo" ? "Solo" : "squad"} lobby `;
  paymentHeading.textContent = `Add the ${unit} details, pay ${fee}, and upload the payment proof.`;
  paymentIntro.innerHTML = `<strong>Three steps:</strong> Copy the UPI ID, pay exactly ${escapeHtml(fee)} in any UPI app, then enter the transaction reference and upload the screenshot.`;
  payLabel.textContent = `Pay ${fee} to this UPI ID`;
  paymentConsent.textContent = `I paid ${fee} and attached the matching UTR and screenshot.`;
  verificationCopy.textContent = `The organizer checks the incoming ${fee} payment in the organizer-controlled account. A screenshot or successful upload does not confirm a ${tournament.type === "solo" ? "player number" : "team number"}.`;
  const upiHelp = document.querySelector("#upiAppHelp");
  if (registrationReady) upiHelp.textContent = `Open any UPI app, paste this ID, check the recipient, and pay ${fee}. Never enter your UPI PIN here.`;
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
  renderLobbyChoices(selectedTournament);
  renderLineupFields(selectedTournament);
  updateRegistrationCopy(selectedTournament);
  if (!submitted) result.hidden = true;
  window.requestAnimationFrame(() => centerSelectedBattle(event ? preferredScrollBehavior() : "auto"));
}

function fieldForName(name) {
  return name ? form.elements.namedItem(name) : null;
}

function nativeValidationMessage(field) {
  const name = field.name || field.id;
  const value = typeof field.value === "string" ? field.value.trim() : "";
  if (/^player\d+Name$/.test(name) || name === "soloName") {
    if (!value) return "Enter the player's in-game name.";
    if (value.length < 2 || value.length > 32) return "Use an in-game name between 2 and 32 characters.";
  }
  if (/Uid$/.test(name) || name === "soloUid") {
    if (!value) return "Enter the player's Free Fire UID.";
    if (!/^[0-9]{6,12}$/.test(value)) return "Enter a Free Fire UID using 6 to 12 numbers.";
  }
  if (/Age$/.test(name) || name === "soloAge") {
    const age = Number(value);
    if (!value) return "Enter the player's age.";
    if (!Number.isInteger(age) || age < config.minimumAge || age > 80) return `Enter an age from ${config.minimumAge} to 80.`;
  }
  if (name === "contactWhatsapp") {
    if (!value) return "Enter the WhatsApp number used for registration updates.";
    if (!/^[6-9][0-9]{9}$/.test(value)) return "Enter a valid 10-digit Indian WhatsApp number.";
  }
  if (name === "contactEmail") {
    if (!value) return "Enter the email you will use for Custom Room access.";
    if (value.length > 254 || !/^[^@\s]+@[^@\s]+$/.test(value)) return "Enter a valid email address.";
  }
  if (name === "paymentReference") {
    if (!value) return "Enter the UTR or transaction reference from the payment app.";
    if (!/^[A-Za-z0-9-]{6,40}$/.test(value)) return "Use 6 to 40 letters, numbers, or hyphens for the UTR.";
  }
  if (field.type === "file") {
    const file = field.files?.[0];
    if (!file) return "Upload the payment screenshot.";
    if (!file.size) return "Choose a payment screenshot that is not empty.";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG, or WebP payment screenshot.";
    if (file.size > MAX_PAYMENT_PROOF_BYTES) return "Choose a payment screenshot no larger than 2 MB.";
  }
  return "";
}

function refreshNativeValidity(field) {
  if (!(field instanceof HTMLInputElement)) return;
  field.setCustomValidity("");
  field.setCustomValidity(nativeValidationMessage(field));
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
  if (refreshingTournamentState) {
    setError("Refreshing the current match terms. Please wait before continuing.");
    return false;
  }
  const eventCheck = currentEventIsOpen();
  if (!eventCheck.valid) {
    setError(eventCheck.message, eventPicker.querySelector('input:not([disabled])'));
    return false;
  }
  chooseLobby();
  const openTimeSlotIds = new Set(getOpenTimeSlots(selectedTournament).map((timeSlot) => timeSlot.id));
  if (!selectedTimeSlot || !openTimeSlotIds.has(selectedTimeSlot.id)) {
    setError("Choose the available match lobby before continuing.", lobbyPicker.querySelector('input[name="timeSlot"]:not([disabled])'));
    return false;
  }
  if (step === 1) return true;

  if (step === 2) {
    const fields = [...panels[1].querySelectorAll("input, select")];
    fields.forEach(refreshNativeValidity);
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      setError(invalid.validationMessage || "Complete this required field.", invalid);
      return false;
    }
    const formData = new FormData(form);
    const registrationValidation = validateRegistration(selectedTournament, collectRegistration(selectedTournament, formData));
    if (registrationValidation) {
      setError(registrationValidation.message, fieldForName(registrationValidation.fieldName));
      return false;
    }
    const paymentValidation = validatePaymentDetails(formData);
    if (paymentValidation) {
      setError(paymentValidation.message, fieldForName(paymentValidation.fieldName));
      return false;
    }
    return true;
  }

  if (!validateStep(2)) return false;
  const missing = [...form.querySelectorAll("[data-consent]")].find((checkbox) => !checkbox.checked);
  if (missing) {
    setError("Accept every confirmation before submitting the complete registration.", missing);
    return false;
  }
  if (!registrationReady) {
    setError("Registration is temporarily unavailable. Do not make a payment; please try again later or contact the organizer.");
    return false;
  }
  return true;
}

function renderReview() {
  const formData = new FormData(form);
  const registration = collectRegistration(selectedTournament, formData);
  const payment = collectPaymentDetails(formData);
  const presentation = getEventPresentation(selectedTournament);
  const screenshotName = payment.screenshot instanceof File ? payment.screenshot.name : "Not selected";
  reviewMount.innerHTML = `
    <div class="review-event"><span class="kicker">${escapeHtml(selectedTournament.shortCode)} · Selected</span><h2>${escapeHtml(selectedTournament.name)}</h2><p>${escapeHtml(selectedTournament.formatLabel)}</p><div class="review-lobby"><small>Selected lobby</small><strong>${escapeHtml(selectedTimeSlot.label)}</strong><time datetime="${escapeHtml(selectedTimeSlot.startsAt)}">${escapeHtml(formatDateTime(selectedTimeSlot.startsAt, "long"))}</time></div><button class="button button--quiet review-edit" type="button" data-edit-step="1">Edit lobby</button></div>
    ${registration.teamName ? `<div class="review-team"><small>Squad</small><strong>${escapeHtml(registration.teamName)}</strong></div>` : ""}
    <div class="review-lineup">${registration.participants.map((participant, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.uid)} · Age ${escapeHtml(participant.age)}${participant.captain && selectedTournament.type === "squad" ? " · Captain" : ""}</small></div></article>`).join("")}</div>
    <div class="review-private"><div><small>Private WhatsApp</small><strong>${escapeHtml(payment.contactWhatsapp)}</strong></div><div><small>Registration email</small><strong>${escapeHtml(payment.contactEmail)}</strong></div><div><small>Payment method</small><strong>${escapeHtml(paymentMethodLabel(payment.paymentMethod))}</strong></div><div><small>Transaction reference</small><strong>${escapeHtml(payment.paymentReference)}</strong></div><div><small>Private screenshot</small><strong>${escapeHtml(screenshotName)}</strong></div></div>
    <div class="review-edit-row"><button class="button button--quiet review-edit" type="button" data-edit-step="2">Edit details</button></div>
    <div class="review-price"><div><small>Entry paid</small><strong>${escapeHtml(formatCurrency(presentation.entryFee))}</strong></div><span>${escapeHtml(selectedTournament.feeUnit)}</span></div>
    <div class="review-rewards"><span><strong>${escapeHtml(presentation.reward)}</strong><small>published reward terms</small></span></div>`;
}

function goToStep(step, moveFocus = true) {
  activeStep = Math.min(3, Math.max(1, step));
  clearError();
  if (activeStep < 3 && !submitted) result.hidden = true;
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
    showToast("Copy unavailable. Send the private summary or type the reference manually.");
  }
}

function consentsFromForm() {
  return {
    rulesAccepted: Boolean(form.elements.namedItem("rulesAccepted")?.checked),
    guardianApproved: Boolean(form.elements.namedItem("guardianApproved")?.checked),
    paymentConfirmed: Boolean(form.elements.namedItem("paymentConfirmed")?.checked),
    publicRosterApproved: Boolean(form.elements.namedItem("publicRosterApproved")?.checked)
  };
}

function setSubmitting(value) {
  submitting = value;
  submitButton.disabled = value || !registrationReady;
  form.querySelectorAll("button, input, select").forEach((control) => {
    if (control !== submitButton) control.disabled = value || control.dataset.wasDisabled === "true";
  });
  if (value) {
    uploadStatus.hidden = false;
    uploadMeter.value = 0;
    uploadLabel.textContent = "Preparing secure upload…";
    submitButton.innerHTML = `${icon("shield")} Uploading payment proof…`;
  } else {
    submitButton.innerHTML = `${icon("shield")} Submit for verification`;
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  if (submitting || submitted) return;
  const safeToContinue = await refreshWizardTournamentState({ beforeProgression: true });
  if (!safeToContinue || !validateStep(3)) return;
  const formData = new FormData(form);
  const registration = collectRegistration(selectedTournament, formData);
  const payment = collectPaymentDetails(formData);
  const reference = createRegistrationId(selectedTournament);
  const consents = consentsFromForm();
  setSubmitting(true);

  try {
    await submitCompleteRegistration({
      tournament: selectedTournament,
      registration,
      payment,
      timeSlot: selectedTimeSlot,
      reference,
      consents,
      onProgress: (percent) => {
        uploadMeter.value = percent;
        uploadLabel.textContent = percent < 100 ? `Uploading private payment proof: ${percent}%` : "Saving complete registration…";
      }
    });

    preparedGroupMessage = buildGroupJoinMessage(selectedTournament, registration, reference, selectedTimeSlot);
    const privateUrl = registrationWhatsAppUrl(selectedTournament, registration, reference, payment, selectedTimeSlot);
    const groupUrl = config.whatsappGroupSafe ? config.whatsappGroupUrl : "";
    resultReference.textContent = reference;
    resultLobby.textContent = `${selectedTimeSlot.label} · ${formatDateTime(selectedTimeSlot.startsAt, "long")}`;
    resultWhatsApp.href = privateUrl;
    resultGroup.hidden = !groupUrl;
    if (groupUrl) resultGroup.href = groupUrl;
    submitted = true;
    form.hidden = true;
    result.hidden = false;
    uploadStatus.hidden = true;

    try {
      await navigator.clipboard.writeText(preparedGroupMessage);
      showToast("Registration stored. Group-safe details copied.");
    } catch {
      showToast("Registration stored. Use Copy group details before posting.");
    }

    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  } catch (error) {
    setError(registrationSubmissionError(error));
    uploadStatus.hidden = true;
  } finally {
    setSubmitting(false);
  }
}

function updateScreenshotState() {
  const file = screenshotInput.files?.[0];
  if (!file) {
    screenshotState.textContent = "No screenshot selected.";
    return;
  }
  const size = file.size / (1024 * 1024);
  refreshNativeValidity(screenshotInput);
  screenshotState.textContent = `${file.name} · ${size.toFixed(2)} MB${screenshotInput.validationMessage ? ` · ${screenshotInput.validationMessage}` : " · Ready"}`;
}

function applyRegistrationAvailability() {
  const available = registrationReady && !refreshingTournamentState;
  supabaseWarning.hidden = registrationReady;
  document.querySelectorAll("[data-next-step]").forEach((button) => {
    button.disabled = !available;
    if (!registrationReady) button.setAttribute("aria-describedby", "supabaseSetupWarning");
    else button.removeAttribute("aria-describedby");
  });
  copyUpiButton.disabled = !available;
  submitButton.disabled = !available;
}

async function refreshWizardTournamentState({ beforeProgression = false } = {}) {
  if (submitted || submitting) return !beforeProgression;
  if (refreshingTournamentState) return false;
  const previousTournamentId = selectedTournament?.id || "";
  const previousType = selectedTournament?.type || "";
  const previousCycle = Number(selectedTournament?.registrationCycle);
  const previousSlotId = selectedTimeSlot?.id || "";
  const previousPresentation = selectedTournament ? getEventPresentation(selectedTournament) : null;
  const previousTerms = previousPresentation ? [
    previousPresentation.mode,
    previousPresentation.entryFee,
    previousPresentation.scheduledAt,
    previousPresentation.capacity
  ].join("|") : "";

  refreshingTournamentState = true;
  applyRegistrationAvailability();
  try {
    await hydrateTournamentOverrides({ force: true, throwOnError: true });
    const refreshedTournament = getTournament(previousTournamentId);
    const refreshedPresentation = refreshedTournament ? getEventPresentation(refreshedTournament) : null;
    const refreshedTerms = refreshedPresentation ? [
      refreshedPresentation.mode,
      refreshedPresentation.entryFee,
      refreshedPresentation.scheduledAt,
      refreshedPresentation.capacity
    ].join("|") : "";
    const refreshedSlot = refreshedTournament && previousSlotId ? getTimeSlot(refreshedTournament, previousSlotId) : null;
    const slotStillOpen = !previousSlotId || (refreshedSlot && getTimeSlotState(refreshedTournament, refreshedSlot).open);
    const sameCycle = refreshedTournament && previousCycle === Number(refreshedTournament.registrationCycle);
    const safe = Boolean(refreshedTournament && refreshedPresentation?.state.open && sameCycle
      && previousTerms === refreshedTerms && slotStillOpen);

    eventPicker.innerHTML = tournaments.map(matchPickerCard).join("");
    eventPicker.querySelectorAll("input[disabled]").forEach((input) => { input.dataset.wasDisabled = "true"; });
    const selectedInput = previousTournamentId ? eventPicker.querySelector(`input[value="${CSS.escape(previousTournamentId)}"]`) : null;
    if (selectedInput) selectedInput.checked = true;
    selectedTournament = refreshedTournament || null;
    renderEventPreview(selectedTournament);
    renderLobbyChoices(selectedTournament, safe ? previousSlotId : "");
    if (!selectedTournament || previousType !== selectedTournament.type) renderLineupFields(selectedTournament);
    if (selectedTournament) updateRegistrationCopy(selectedTournament);

    if (!safe && (previousTerms !== refreshedTerms || !sameCycle || !refreshedPresentation?.state.open || previousSlotId)) {
      const paymentReference = form.elements.namedItem("paymentReference");
      if (paymentReference) paymentReference.value = "";
      screenshotInput.value = "";
      updateScreenshotState();
      form.querySelectorAll("[data-consent]").forEach((checkbox) => { checkbox.checked = false; });
      preparedGroupMessage = "";
      if (activeStep > 1) goToStep(1, false);
      setError("This match changed or closed while the page was open. Review the current match and lobby before entering payment details.", selectedInput || eventPicker.querySelector("input:not([disabled])"));
    }
    return safe;
  } catch {
    setError("Current match terms could not be refreshed. Progression is paused; check your connection and try again.");
    return false;
  } finally {
    refreshingTournamentState = false;
    applyRegistrationAvailability();
  }
}

async function initializeWizard() {
  initializeShell();
  await hydrateTournamentOverrides();
  form.dataset.enhanced = "true";
  eventPicker.innerHTML = tournaments.map(matchPickerCard).join("");
  eventPicker.querySelectorAll("input[disabled]").forEach((input) => { input.dataset.wasDisabled = "true"; });
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
  lobbyPicker.addEventListener("change", chooseLobby);
  document.querySelectorAll("[data-next-step]").forEach((button) => button.addEventListener("click", async () => {
    const safeToContinue = await refreshWizardTournamentState({ beforeProgression: true });
    if (safeToContinue && validateStep(activeStep)) transitionUpdate(() => goToStep(activeStep + 1));
  }));
  document.querySelectorAll("[data-previous-step]").forEach((button) => button.addEventListener("click", () => transitionUpdate(() => goToStep(activeStep - 1))));
  form.addEventListener("submit", submitRegistration);
  form.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement) refreshNativeValidity(event.target);
  });
  form.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) refreshNativeValidity(event.target);
  });
  screenshotInput.addEventListener("change", updateScreenshotState);
  reviewMount.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-step]");
    if (!editButton) return;
    transitionUpdate(() => goToStep(Number(editButton.dataset.editStep)));
  });
  copyButton.addEventListener("click", copyMessage);
  document.querySelector("#editRegistration")?.addEventListener("click", () => {
    form.hidden = false;
    result.hidden = true;
    panels.forEach((panel) => { panel.hidden = Number(panel.dataset.stepPanel) !== 3; });
    form.querySelectorAll("input, select, button").forEach((control) => { control.disabled = true; });
    form.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
    showToast("Submitted fields are read-only. Contact the organizer with your reference for help.");
  });
  const upiIdMount = document.querySelector("#paymentUpiId");
  const upiAppHelp = document.querySelector("#upiAppHelp");
  if (registrationReady) {
    upiIdMount.textContent = config.upiId;
    copyUpiButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(config.upiId);
        const fee = formatCurrency(getEventPresentation(selectedTournament).entryFee);
        showToast(`UPI ID copied. Open any UPI app, paste it, verify the recipient, and pay ${fee}.`, 7000);
      } catch {
        const fee = formatCurrency(getEventPresentation(selectedTournament).entryFee);
        showToast(`Copy unavailable. Enter ${config.upiId} in your UPI app and pay ${fee}.`, 7000);
      }
    });
    updateRegistrationCopy(selectedTournament);
  } else {
    upiIdMount.textContent = "Payment unavailable — do not pay yet";
    upiAppHelp.textContent = "Registration payments are paused. Please try again later or contact the organizer.";
  }
  applyRegistrationAvailability();
  goToStep(1, false);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshWizardTournamentState();
  });
  window.addEventListener("pageshow", () => refreshWizardTournamentState());
  initializeMotion();
}

initializeWizard();
