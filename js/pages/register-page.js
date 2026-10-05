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
} from "../shared/data.js?v=20261005-upi";
import {
  buildGroupJoinMessage,
  collectRegistration,
  createRegistrationId,
  registrationWhatsAppUrl,
  validateRegistration
} from "../shared/registration.js";
import {
  collectPaymentDetails,
  MAX_PAYMENT_PROOF_BYTES,
  paymentMethodLabel,
  registrationSubmissionError,
  submitCompleteRegistration,
  validatePaymentDetails
} from "../shared/registration-backend.js";
import { isSupabaseConfigured } from "../shared/supabase.js";
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
const screenshotInput = document.querySelector("#paymentScreenshot");
const screenshotState = document.querySelector("#paymentScreenshotState");
const submitButton = document.querySelector("#submitRegistration");
const uploadStatus = document.querySelector("#registrationUploadProgress");
const uploadLabel = document.querySelector("#registrationUploadLabel");
const uploadMeter = document.querySelector("#registrationUploadMeter");
const supabaseWarning = document.querySelector("#supabaseSetupWarning");
let activeStep = 1;
let selectedTournament = null;
let preparedGroupMessage = "";
let submitted = false;
let submitting = false;

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
  if (!submitted) result.hidden = true;
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
    const fields = [...panels[1].querySelectorAll("input, select")];
    const invalid = fields.find((field) => !field.checkValidity());
    if (invalid) {
      const message = invalid.type === "file"
        ? "Upload the required payment screenshot."
        : invalid.validity.patternMismatch
          ? "Use the requested format for this field."
          : "Complete this required field.";
      setError(message, invalid);
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
  if (!isSupabaseConfigured() || !config.upiSafe) {
    setError("Registration is unavailable until Supabase and the verified UPI payment ID are configured.");
    return false;
  }
  return true;
}

function renderReview() {
  const formData = new FormData(form);
  const registration = collectRegistration(selectedTournament, formData);
  const payment = collectPaymentDetails(formData);
  const screenshotName = payment.screenshot instanceof File ? payment.screenshot.name : "Not selected";
  reviewMount.innerHTML = `
    <div class="review-event"><span class="kicker">${escapeHtml(selectedTournament.shortCode)} · Selected</span><h2>${escapeHtml(selectedTournament.name)}</h2><p>${escapeHtml(selectedTournament.formatLabel)} · Always open</p></div>
    ${registration.teamName ? `<div class="review-team"><small>Squad</small><strong>${escapeHtml(registration.teamName)}</strong></div>` : ""}
    <div class="review-lineup">${registration.participants.map((participant, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.uid)} · Age ${escapeHtml(participant.age)}${participant.captain && selectedTournament.type === "squad" ? " · Captain" : ""}</small></div></article>`).join("")}</div>
    <div class="review-private"><div><small>Private WhatsApp</small><strong>${escapeHtml(payment.contactWhatsapp)}</strong></div><div><small>Payment method</small><strong>${escapeHtml(paymentMethodLabel(payment.paymentMethod))}</strong></div><div><small>Transaction reference</small><strong>${escapeHtml(payment.paymentReference)}</strong></div><div><small>Private screenshot</small><strong>${escapeHtml(screenshotName)}</strong></div></div>
    <div class="review-price"><div><small>Entry paid</small><strong>${escapeHtml(formatCurrency(selectedTournament.entryFee))}</strong></div><span>${escapeHtml(selectedTournament.feeUnit)}</span></div>
    <div class="review-rewards"><span><strong>${escapeHtml(formatCurrency(selectedTournament.killReward))}</strong><small>per confirmed kill</small></span><span><strong>${escapeHtml(formatCurrency(selectedTournament.booyahBonus))}</strong><small>additional Booyah bonus</small></span></div>`;
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
  submitButton.disabled = value || !isSupabaseConfigured() || !config.upiSafe;
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
  if (submitting || submitted || !validateStep(3)) return;
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
      reference,
      consents,
      onProgress: (percent) => {
        uploadMeter.value = percent;
        uploadLabel.textContent = percent < 100 ? `Uploading private payment proof: ${percent}%` : "Saving complete registration…";
      }
    });

    preparedGroupMessage = buildGroupJoinMessage(selectedTournament, registration, reference);
    const privateUrl = registrationWhatsAppUrl(selectedTournament, registration, reference, payment);
    const groupUrl = config.whatsappGroupSafe ? config.whatsappGroupUrl : "";
    resultReference.textContent = reference;
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
  screenshotState.textContent = `${file.name} · ${size.toFixed(2)} MB${file.size > MAX_PAYMENT_PROOF_BYTES ? " · Too large" : " · Ready"}`;
}

function initializeWizard() {
  initializeShell();
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
  document.querySelectorAll("[data-next-step]").forEach((button) => button.addEventListener("click", () => {
    if (validateStep(activeStep)) transitionUpdate(() => goToStep(activeStep + 1));
  }));
  document.querySelectorAll("[data-previous-step]").forEach((button) => button.addEventListener("click", () => transitionUpdate(() => goToStep(activeStep - 1))));
  form.addEventListener("submit", submitRegistration);
  screenshotInput.addEventListener("change", updateScreenshotState);
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
  const upiPaymentLink = document.querySelector("#openUpiPayment");
  const copyUpiButton = document.querySelector("#copyUpiId");
  if (config.upiSafe) {
    upiIdMount.textContent = config.upiId;
    const paymentParameters = [
      ["pa", config.upiId],
      ["pn", config.upiPayeeName],
      ["am", String(selectedTournament?.entryFee || 10)],
      ["cu", "INR"],
      ["tn", "Solo Survival 01 entry"]
    ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
    upiPaymentLink.href = `upi://pay?${paymentParameters}`;
    copyUpiButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(config.upiId);
        showToast("UPI ID copied. Confirm it before paying ₹10.");
      } catch {
        showToast(`Copy unavailable. UPI ID: ${config.upiId}`);
      }
    });
  } else {
    upiIdMount.textContent = "UPI payment unavailable";
    upiPaymentLink.removeAttribute("href");
    upiPaymentLink.setAttribute("aria-disabled", "true");
    copyUpiButton.disabled = true;
  }
  supabaseWarning.hidden = isSupabaseConfigured() && config.upiSafe;
  submitButton.disabled = !isSupabaseConfigured() || !config.upiSafe;
  goToStep(1, false);
  initializeMotion();
}

initializeWizard();
