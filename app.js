(() => {
  "use strict";

  const config = window.QW_CONFIG;
  const tournaments = Array.isArray(window.QW_TOURNAMENTS) ? window.QW_TOURNAMENTS : [];
  const rosters = window.QW_ROSTERS || {};

  if (!config) {
    document.body.innerHTML = "<main class=\"noscript-message\">Site configuration could not be loaded. Please contact the organizer.</main>";
    return;
  }

  const elements = {
    root: document.documentElement,
    demoBanner: document.querySelector("#demoBanner"),
    menuButton: document.querySelector("#menuButton"),
    siteNav: document.querySelector("#siteNav"),
    themeButton: document.querySelector("#themeButton"),
    tournamentGrid: document.querySelector("#tournamentGrid"),
    filterButtons: [...document.querySelectorAll("[data-filter]")],
    form: document.querySelector("#registrationForm"),
    tournamentSelect: document.querySelector("#tournamentSelect"),
    tournamentHelp: document.querySelector("#tournamentHelp"),
    eventSelection: document.querySelector("#eventSelection"),
    soloFields: document.querySelector("#soloFields"),
    squadFields: document.querySelector("#squadFields"),
    formError: document.querySelector("#formError"),
    registrationResult: document.querySelector("#registrationResult"),
    registrationId: document.querySelector("#registrationId"),
    whatsappFallback: document.querySelector("#whatsappFallback"),
    copyMessageButton: document.querySelector("#copyMessageButton"),
    rosterTournament: document.querySelector("#rosterTournament"),
    rosterSearch: document.querySelector("#rosterSearch"),
    rosterMeta: document.querySelector("#rosterMeta"),
    rosterContent: document.querySelector("#rosterContent"),
    supportWhatsApp: document.querySelector("#supportWhatsApp"),
    footerWhatsApp: document.querySelector("#footerWhatsApp"),
    whatsappDisplay: document.querySelector("#whatsappDisplay"),
    supportHours: document.querySelector("#supportHours"),
    currentYear: document.querySelector("#currentYear"),
    toast: document.querySelector("#toast")
  };

  const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

  const eventDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: config.timezone
  });

  const longDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: config.timezone
  });

  let activeFilter = "all";
  let preparedMessage = "";
  let toastTimer;

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

  function getTournament(id) {
    return tournaments.find((tournament) => tournament.id === id);
  }

  function getEventState(tournament) {
    const now = Date.now();
    const matchTime = Date.parse(tournament.matchAt);
    const closingTime = Date.parse(tournament.registrationClosesAt);

    if (Number.isFinite(matchTime) && now >= matchTime) {
      return { key: "completed", label: "Completed", open: false };
    }

    if (!tournament.registrationOpen || tournament.spotsLeft <= 0) {
      return {
        key: tournament.spotsLeft <= 0 ? "full" : "closed",
        label: tournament.spotsLeft <= 0 ? "Full" : "Registration closed",
        open: false
      };
    }

    if (Number.isFinite(closingTime) && now >= closingTime) {
      return { key: "closed", label: "Registration closed", open: false };
    }

    return { key: "open", label: tournament.statusLabel || "Registration open", open: true };
  }

  function formatEventDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "Schedule pending" : `${eventDate.format(date)} ${config.timezoneLabel}`;
  }

  function formatLongDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "Schedule pending" : `${longDate.format(date)} ${config.timezoneLabel}`;
  }

  function getCapacityLabel(tournament) {
    return tournament.type === "solo" ? "players" : "teams";
  }

  function getCapacityPercentage(tournament) {
    const capacity = Number(tournament.capacity) || 0;
    const spotsLeft = Math.max(0, Number(tournament.spotsLeft) || 0);
    if (!capacity) return 0;
    return Math.min(100, Math.max(0, ((capacity - spotsLeft) / capacity) * 100));
  }

  function matchesFilter(tournament, filter) {
    if (filter === "all") return true;
    if (filter === "tdm") return /tdm|clash/i.test(tournament.mode);
    if (filter === "solo") return tournament.type === "solo";
    if (filter === "squad") return tournament.type === "squad" && !/tdm|clash/i.test(tournament.mode);
    return true;
  }

  function renderTournamentCard(tournament) {
    const state = getEventState(tournament);
    const capacityLabel = getCapacityLabel(tournament);
    const modeMark = /tdm|clash/i.test(tournament.mode) ? "TDM" : tournament.type.toUpperCase();
    const cardClass = tournament.featured ? "tournament-card tournament-card--featured" : "tournament-card";
    const statusClass = state.open ? "badge badge--status" : "badge badge--status badge--closed";
    const action = state.open
      ? `<a class="button button--primary" href="#register" data-select-event="${escapeHtml(tournament.id)}">Join this match</a>`
      : `<button class="button" type="button" disabled>${escapeHtml(state.label)}</button>`;

    return `
      <article class="${cardClass}" data-event-type="${escapeHtml(tournament.type)}">
        <div class="tournament-card__visual" aria-hidden="true">
          <div class="tournament-card__badges">
            <span class="${statusClass}">${escapeHtml(state.label)}</span>
            ${config.demoMode ? '<span class="badge badge--demo">Demo</span>' : ""}
          </div>
          <span class="tournament-card__mode">${escapeHtml(modeMark)}</span>
        </div>
        <div class="tournament-card__body">
          <span class="tournament-card__code">${escapeHtml(tournament.shortCode)} · ${escapeHtml(tournament.formatLabel)}</span>
          <h3>${escapeHtml(tournament.name)}</h3>
          <dl class="tournament-meta">
            <div><dt>Starts</dt><dd>${escapeHtml(formatEventDate(tournament.matchAt))}</dd></div>
            <div><dt>Entry</dt><dd>${escapeHtml(inr.format(tournament.entryFee))} ${escapeHtml(tournament.feeUnit)}</dd></div>
            <div><dt>Prize pool</dt><dd>${escapeHtml(inr.format(tournament.prizePool))}</dd></div>
            <div><dt>Format</dt><dd>${escapeHtml(tournament.rounds)}</dd></div>
            <div><dt>Map</dt><dd>${escapeHtml(tournament.map)}</dd></div>
            <div><dt>Check-in</dt><dd>${escapeHtml(formatEventDate(tournament.checkInAt))}</dd></div>
          </dl>
          <div class="capacity">
            <div class="capacity__row"><span>Available</span><strong>${escapeHtml(tournament.spotsLeft)} of ${escapeHtml(tournament.capacity)} ${capacityLabel}</strong></div>
            <div class="capacity__bar" aria-hidden="true"><span style="width:${getCapacityPercentage(tournament)}%"></span></div>
          </div>
          <div class="tournament-card__actions">
            ${action}
            <a class="button button--ghost card-details-button" href="#rules" aria-label="Read rules for ${escapeHtml(tournament.name)}" title="Read tournament rules">
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
            </a>
          </div>
        </div>
      </article>`;
  }

  function renderTournaments() {
    const visible = tournaments.filter((tournament) => matchesFilter(tournament, activeFilter));
    elements.tournamentGrid.innerHTML = visible.length
      ? visible.map(renderTournamentCard).join("")
      : '<div class="empty-filter"><strong>No matches in this format yet.</strong><br>Check another format or ask the organizer about the next event.</div>';
  }

  function populateTournamentSelects() {
    const registrationOptions = tournaments.map((tournament) => {
      const state = getEventState(tournament);
      const disabled = state.open ? "" : " disabled";
      const suffix = state.open ? "" : ` — ${state.label}`;
      return `<option value="${escapeHtml(tournament.id)}"${disabled}>${escapeHtml(tournament.name)} · ${escapeHtml(tournament.formatLabel)}${escapeHtml(suffix)}</option>`;
    }).join("");

    elements.tournamentSelect.insertAdjacentHTML("beforeend", registrationOptions);
    elements.rosterTournament.innerHTML = tournaments.map((tournament) =>
      `<option value="${escapeHtml(tournament.id)}">${escapeHtml(tournament.name)} · ${escapeHtml(tournament.formatLabel)}</option>`
    ).join("");
  }

  function setFieldsetState(fieldset, enabled) {
    fieldset.hidden = !enabled;
    fieldset.disabled = !enabled;
  }

  function updateRegistrationFields() {
    const tournament = getTournament(elements.tournamentSelect.value);
    elements.formError.hidden = true;
    elements.registrationResult.hidden = true;

    if (!tournament) {
      setFieldsetState(elements.soloFields, false);
      setFieldsetState(elements.squadFields, false);
      elements.eventSelection.hidden = true;
      elements.tournamentHelp.textContent = "Choose an open event to load the correct registration fields.";
      return;
    }

    const state = getEventState(tournament);
    setFieldsetState(elements.soloFields, tournament.type === "solo" && state.open);
    setFieldsetState(elements.squadFields, tournament.type === "squad" && state.open);
    elements.eventSelection.innerHTML = `
      <div><small>Format</small><strong>${escapeHtml(tournament.formatLabel)}</strong></div>
      <div><small>Match time</small><strong>${escapeHtml(formatEventDate(tournament.matchAt))}</strong></div>
      <div><small>Entry</small><strong>${escapeHtml(inr.format(tournament.entryFee))} ${escapeHtml(tournament.feeUnit)}</strong></div>`;
    elements.eventSelection.hidden = false;
    elements.tournamentHelp.textContent = state.open
      ? `Registration closes ${formatLongDate(tournament.registrationClosesAt)}.`
      : `${state.label}. Choose another event.`;
  }

  function selectTournament(id, shouldFocus = false) {
    const tournament = getTournament(id);
    if (!tournament || !getEventState(tournament).open) return;
    elements.tournamentSelect.value = tournament.id;
    updateRegistrationFields();
    const url = new URL(window.location.href);
    url.searchParams.set("tournament", tournament.id);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (shouldFocus) {
      window.setTimeout(() => elements.tournamentSelect.focus(), 450);
    }
  }

  function createRegistrationId(tournament) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const randomBytes = new Uint8Array(2);

    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(randomBytes);
    } else {
      randomBytes[0] = Math.floor(Math.random() * 256);
      randomBytes[1] = Math.floor(Math.random() * 256);
    }

    const random = [...randomBytes].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
    const code = normalize(tournament.shortCode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return `${config.registrationPrefix}-${code}-${month}${day}-${random}`;
  }

  function collectParticipants(tournament, formData) {
    if (tournament.type === "solo") {
      return [{
        name: normalize(formData.get("soloName")),
        uid: normalize(formData.get("soloUid")),
        age: normalize(formData.get("soloAge")),
        captain: true
      }];
    }

    return [1, 2, 3, 4].map((number) => ({
      name: normalize(formData.get(`player${number}Name`)),
      uid: normalize(formData.get(`player${number}Uid`)),
      age: normalize(formData.get(`player${number}Age`)),
      captain: number === 1
    }));
  }

  function validateRegistration(tournament, participants) {
    const uidPattern = /^\d{6,12}$/;
    const uids = participants.map((participant) => participant.uid);

    if (participants.some((participant) => !uidPattern.test(participant.uid))) {
      return "Check every Free Fire UID. Each UID must contain 6–12 numbers.";
    }

    if (new Set(uids).size !== uids.length) {
      return "Each player must have a different Free Fire UID.";
    }

    if (tournament.type === "squad" && participants.length !== 4) {
      return "A squad entry must contain exactly four players.";
    }

    const invalidAge = participants.some((participant) => {
      const age = Number(participant.age);
      return !Number.isInteger(age) || age < config.minimumAge || age > 80;
    });

    if (invalidAge) {
      return `Each player must be at least ${config.minimumAge}, with a valid age entered.`;
    }

    return "";
  }

  function buildWhatsAppMessage(tournament, participants, formData, registrationId) {
    const heading = config.demoMode
      ? "*QW TOURNAMENTS — TEST ENQUIRY*"
      : "*QW TOURNAMENTS — NEW REGISTRATION*";
    const lines = [
      heading,
      config.demoMode ? "_Demo event: please do not send payment._" : "",
      "",
      `*Reference:* ${registrationId}`,
      `*Tournament:* ${tournament.name}`,
      `*Format:* ${tournament.formatLabel}`,
      `*Match:* ${formatLongDate(tournament.matchAt)}`,
      `*Entry fee:* ${inr.format(tournament.entryFee)} ${tournament.feeUnit}`
    ];

    if (tournament.type === "squad") {
      lines.push(`*Team:* ${normalize(formData.get("teamName"))}`);
    }

    lines.push("", tournament.type === "solo" ? "*Player*" : "*Players*");
    participants.forEach((participant, index) => {
      const label = tournament.type === "solo"
        ? "Solo player"
        : `Player ${index + 1}${participant.captain ? " (Captain)" : ""}`;
      lines.push(
        `${label}:`,
        `• Name: ${participant.name}`,
        `• Free Fire UID: ${participant.uid}`,
        `• Age: ${participant.age}`
      );
    });

    lines.push(
      "",
      "*Confirmed by entrant:*",
      "• Tournament rules accepted: Yes",
      "• 18+ or guardian approval received: Yes",
      "• Payment-proof process understood: Yes",
      "",
      "I will attach payment proof in this chat after receiving verified payment instructions. I understand that a screenshot alone does not confirm my slot."
    );

    return lines.filter((line, index, allLines) => !(line === "" && allLines[index - 1] === "")).join("\n");
  }

  function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
    elements.formError.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleRegistrationSubmit(event) {
    event.preventDefault();
    elements.formError.hidden = true;

    if (!elements.form.checkValidity()) {
      elements.form.reportValidity();
      showFormError("Complete every required field and correct the highlighted values before continuing.");
      return;
    }

    const tournament = getTournament(elements.tournamentSelect.value);
    if (!tournament) {
      showFormError("Choose a tournament before continuing.");
      return;
    }

    const state = getEventState(tournament);
    if (!state.open) {
      showFormError(`${state.label}. Choose another tournament.`);
      return;
    }

    const formData = new FormData(elements.form);
    const participants = collectParticipants(tournament, formData);
    const validationError = validateRegistration(tournament, participants);
    if (validationError) {
      showFormError(validationError);
      return;
    }

    const registrationId = createRegistrationId(tournament);
    preparedMessage = buildWhatsAppMessage(tournament, participants, formData, registrationId);
    const whatsappUrl = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(preparedMessage)}`;

    elements.registrationId.textContent = registrationId;
    elements.whatsappFallback.href = whatsappUrl;
    elements.registrationResult.hidden = false;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    window.setTimeout(() => {
      elements.registrationResult.focus({ preventScroll: true });
      elements.registrationResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  async function copyPreparedMessage() {
    if (!preparedMessage) return;

    try {
      await navigator.clipboard.writeText(preparedMessage);
      showToast("Registration message copied.");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = preparedMessage;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      textArea.remove();
      showToast(copied ? "Registration message copied." : "Copy failed. Use the WhatsApp button instead.");
    }
  }

  function formatUpdatedAt(value) {
    if (!value) return "Not published yet";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "Update time unavailable" : `Updated ${formatLongDate(value)}`;
  }

  function entryMatches(entry, query) {
    if (!query) return true;
    const fields = [
      entry.registrationId,
      entry.teamName,
      entry.displayName,
      entry.uid,
      ...(entry.players || []).flatMap((player) => [player.displayName, player.uid])
    ];
    return fields.some((field) => String(field ?? "").toLowerCase().includes(query));
  }

  function renderRosterEmpty(title, text) {
    elements.rosterContent.innerHTML = `
      <div class="roster-empty">
        <div class="roster-empty__inner">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(text)}</p>
        </div>
      </div>`;
  }

  function renderSquadRoster(entries) {
    elements.rosterContent.innerHTML = `<div class="squad-list">${entries.map((entry) => `
      <article class="squad-entry">
        <div class="squad-entry__header">
          <div><span class="squad-entry__slot">Slot ${escapeHtml(entry.slot)} · ${escapeHtml(entry.registrationId)}</span><h3>${escapeHtml(entry.teamName)}</h3></div>
          <span class="status-label">${escapeHtml(entry.status || "Confirmed")}</span>
        </div>
        <ol class="player-list">
          ${(entry.players || []).map((player, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(player.displayName)}</strong><code>${escapeHtml(player.uid)}</code></li>`).join("")}
        </ol>
      </article>`).join("")}</div>`;
  }

  function renderSoloRoster(entries) {
    elements.rosterContent.innerHTML = `
      <div class="solo-table-wrap">
        <table class="solo-table">
          <thead><tr><th>Slot</th><th>Player</th><th>Free Fire UID</th><th>Reference</th><th>Status</th></tr></thead>
          <tbody>${entries.map((entry) => `
            <tr>
              <td>${escapeHtml(entry.slot)}</td>
              <td><strong>${escapeHtml(entry.displayName)}</strong></td>
              <td><code>${escapeHtml(entry.uid)}</code></td>
              <td>${escapeHtml(entry.registrationId)}</td>
              <td><span class="status-label">${escapeHtml(entry.status || "Confirmed")}</span></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>`;
  }

  function renderRoster() {
    const tournament = getTournament(elements.rosterTournament.value) || tournaments[0];
    if (!tournament) {
      elements.rosterMeta.textContent = "No tournaments configured.";
      renderRosterEmpty("No roster available", "Add a tournament before publishing confirmed players.");
      return;
    }

    const roster = rosters[tournament.id] || { published: false, entries: [] };
    const query = normalize(elements.rosterSearch.value).toLowerCase();
    const allEntries = Array.isArray(roster.entries) ? roster.entries : [];
    const entries = allEntries.filter((entry) => entryMatches(entry, query));
    const unit = tournament.type === "solo" ? "players" : "teams";
    const sampleLabel = roster.isSample ? '<span class="badge badge--demo">Sample roster</span>' : "";

    elements.rosterMeta.innerHTML = `
      <span><strong>${escapeHtml(tournament.name)}</strong> · ${escapeHtml(allEntries.length)} confirmed ${unit}</span>
      <span>${sampleLabel} ${escapeHtml(formatUpdatedAt(roster.updatedAt))}</span>`;

    if (!roster.published || !allEntries.length) {
      renderRosterEmpty(
        "Roster not published yet",
        `The confirmed ${unit} list is planned for about ${config.rosterLeadHours} hours before ${formatLongDate(tournament.matchAt)}.`
      );
      return;
    }

    if (!entries.length) {
      renderRosterEmpty("No matching entry", "Try a different team name, player name, UID, or registration reference.");
      return;
    }

    if (tournament.type === "solo") {
      renderSoloRoster(entries);
    } else {
      renderSquadRoster(entries);
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3000);
  }

  function getPreferredTheme() {
    try {
      const saved = window.localStorage.getItem("qw-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Theme persistence is optional.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    elements.root.dataset.theme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    elements.themeButton.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    elements.themeButton.title = `Switch to ${nextTheme} theme`;
  }

  function toggleTheme() {
    const nextTheme = elements.root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem("qw-theme", nextTheme);
    } catch {
      // The selected theme still applies for this page view.
    }
  }

  function closeMenu() {
    elements.menuButton.setAttribute("aria-expanded", "false");
    elements.menuButton.setAttribute("aria-label", "Open navigation");
    elements.siteNav.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }

  function toggleMenu() {
    const opening = elements.menuButton.getAttribute("aria-expanded") !== "true";
    elements.menuButton.setAttribute("aria-expanded", String(opening));
    elements.menuButton.setAttribute("aria-label", opening ? "Close navigation" : "Open navigation");
    elements.siteNav.classList.toggle("is-open", opening);
    document.body.classList.toggle("menu-open", opening);
  }

  function setupRevealMotion() {
    const revealItems = [...document.querySelectorAll("[data-reveal]")];
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -4%" });

    revealItems.forEach((item) => observer.observe(item));
  }

  function setupContactLinks() {
    const supportText = encodeURIComponent(`Hi ${config.organizerName}, I have a question about an upcoming ${config.gameName} tournament.`);
    const supportUrl = `https://wa.me/${config.whatsappNumber}?text=${supportText}`;
    elements.supportWhatsApp.href = supportUrl;
    elements.footerWhatsApp.href = supportUrl;
    elements.whatsappDisplay.textContent = config.whatsappDisplay;
    elements.supportHours.textContent = `Support hours: ${config.supportHours}`;
  }

  function setupInitialSelection() {
    const requestedId = new URLSearchParams(window.location.search).get("tournament");
    const requestedTournament = getTournament(requestedId);
    if (requestedTournament && getEventState(requestedTournament).open) {
      selectTournament(requestedId);
    }

    const firstPublished = tournaments.find((tournament) => rosters[tournament.id]?.published);
    if (firstPublished) {
      elements.rosterTournament.value = firstPublished.id;
    }
  }

  function bindEvents() {
    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        elements.filterButtons.forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
        renderTournaments();
      });
    });

    elements.tournamentGrid.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-select-event]");
      if (!trigger) return;
      selectTournament(trigger.dataset.selectEvent, true);
    });

    elements.tournamentSelect.addEventListener("change", updateRegistrationFields);
    elements.form.addEventListener("submit", handleRegistrationSubmit);
    elements.copyMessageButton.addEventListener("click", copyPreparedMessage);
    elements.rosterTournament.addEventListener("change", () => {
      elements.rosterSearch.value = "";
      renderRoster();
    });
    elements.rosterSearch.addEventListener("input", renderRoster);
    elements.themeButton.addEventListener("click", toggleTheme);
    elements.menuButton.addEventListener("click", toggleMenu);
    elements.siteNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 864) closeMenu();
    });
  }

  function initialize() {
    applyTheme(getPreferredTheme());
    elements.demoBanner.hidden = !config.demoMode;
    elements.currentYear.textContent = String(new Date().getFullYear());
    document.querySelectorAll('input[type="number"][name$="Age"], #soloAge').forEach((input) => {
      input.min = String(config.minimumAge);
    });

    populateTournamentSelects();
    renderTournaments();
    setupContactLinks();
    setupInitialSelection();
    renderRoster();
    bindEvents();
    setupRevealMotion();
  }

  initialize();
})();
