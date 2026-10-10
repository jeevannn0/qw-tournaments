import { config, formatCurrency, formatDateTime, getEventPresentation, normalize, whatsappUrl } from "./data.js?v=20261013-squad-results";

export function createRegistrationId(tournament) {
  const now = new Date();
  const dateCode = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const bytes = new Uint8Array(3);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  const randomCode = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  const eventCode = normalize(tournament.shortCode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  return `${config.registrationPrefix}-${eventCode}-${dateCode}-${randomCode}`;
}

export function collectRegistration(tournament, formData) {
  if (tournament.type === "solo") {
    return {
      teamName: "",
      participants: [{
        name: normalize(formData.get("soloName")),
        uid: normalize(formData.get("soloUid")),
        age: normalize(formData.get("soloAge")),
        captain: true,
        fieldPrefix: "solo"
      }]
    };
  }
  return {
    teamName: normalize(formData.get("teamName")),
    participants: [1, 2, 3, 4].map((number) => ({
      name: normalize(formData.get(`player${number}Name`)),
      uid: normalize(formData.get(`player${number}Uid`)),
      age: normalize(formData.get(`player${number}Age`)),
      captain: number === 1,
      fieldPrefix: `player${number}`
    }))
  };
}

export function validateRegistration(tournament, registration) {
  const uidPattern = /^\d{6,12}$/;
  const { participants, teamName } = registration;
  if (tournament.type === "squad" && (teamName.length < 2 || teamName.length > 40)) {
    return { fieldName: "teamName", message: "Enter a squad name from 2 to 40 characters." };
  }
  for (const participant of participants) {
    if (participant.name.length < 2 || participant.name.length > 32) return { fieldName: `${participant.fieldPrefix}Name`, message: "Use an in-game name from 2 to 32 characters." };
    if (!uidPattern.test(participant.uid)) return { fieldName: `${participant.fieldPrefix}Uid`, message: "Enter a Free Fire UID containing 6–12 numbers." };
    const age = Number(participant.age);
    if (!Number.isInteger(age) || age < config.minimumAge || age > 80) return { fieldName: `${participant.fieldPrefix}Age`, message: `Enter an age from ${config.minimumAge} to 80.` };
  }
  const seenUids = new Set();
  for (const participant of participants) {
    if (seenUids.has(participant.uid)) return { fieldName: `${participant.fieldPrefix}Uid`, message: "Each player must use a different Free Fire UID." };
    seenUids.add(participant.uid);
  }
  const expectedCount = tournament.type === "solo" ? 1 : 4;
  if (participants.length !== expectedCount) return { fieldName: tournament.type === "solo" ? "soloName" : "teamName", message: tournament.type === "solo" ? "Solo registration requires one player." : "Squad registration requires exactly four players." };
  return null;
}

export function buildRegistrationMessage(tournament, registration, reference, payment = null, timeSlot = null) {
  const presentation = getEventPresentation(tournament);
  const lines = [
    `*${config.brandName.toUpperCase()} — SUBMITTED REGISTRATION*`,
    "",
    `*Reference:* ${reference}`,
    `*Tournament:* ${tournament.name}`,
    `*Format:* ${tournament.formatLabel}`,
    `*Selected lobby:* ${timeSlot ? `${timeSlot.label} — ${formatDateTime(timeSlot.startsAt, "long")}` : "Not selected"}`,
    `*Entry:* ${formatCurrency(presentation.entryFee)} ${tournament.feeUnit}`,
    `*Reward:* ${presentation.reward}`
  ];
  if (tournament.type === "squad") lines.push(`*Squad:* ${registration.teamName}`);
  lines.push("", tournament.type === "solo" ? "*Player*" : "*Four-player lineup*");
  registration.participants.forEach((participant, index) => {
    const label = tournament.type === "solo" ? "Solo player" : `Player ${index + 1}${participant.captain ? " (Captain)" : ""}`;
    lines.push(label, `• Name: ${participant.name}`, `• Free Fire UID: ${participant.uid}`, `• Age: ${participant.age}`);
  });
  if (payment) {
    lines.push(
      "",
      "*Payment submitted to the private portal*",
      `• ${tournament.type === "solo" ? "Player" : "Captain"} WhatsApp: ${payment.contactWhatsapp}`,
      `• Registration email: ${payment.contactEmail}`,
      "• Method: UPI",
      `• Transaction reference: ${payment.paymentReference}`,
      "• Screenshot: Uploaded privately for organizer review"
    );
  }
  lines.push(
    "",
    "*Entrant confirmations*",
    "• Rules and result verification terms accepted: Yes",
    `• Every player is ${config.guardianConsentAge}+ or has guardian approval: Yes`,
    "• Payment details and screenshot supplied: Yes",
    "",
    "I understand that the organizer must verify the incoming payment and match result. This submission and screenshot do not confirm my slot."
  );
  return lines.filter((line, index) => !(line === "" && lines[index - 1] === "")).join("\n");
}

export function buildGroupJoinMessage(tournament, registration, reference, timeSlot = null) {
  const lines = [
    `*${config.brandName.toUpperCase()} — MATCH GROUP CHECK-IN*`,
    "",
    `*Reference:* ${reference}`,
    `*Tournament:* ${tournament.name}`
  ];
  if (timeSlot) lines.push(`*Lobby:* ${timeSlot.label}`);
  if (tournament.type === "squad") lines.push(`*Squad:* ${registration.teamName}`);
  registration.participants.forEach((participant, index) => {
    const label = tournament.type === "solo" ? "Player" : `Player ${index + 1}${index === 0 ? " (Captain)" : ""}`;
    lines.push(`*${label}:* ${participant.name} · UID ${participant.uid}`);
  });
  return lines.join("\n");
}

export function registrationWhatsAppUrl(tournament, registration, reference, payment = null, timeSlot = null) {
  return whatsappUrl(buildRegistrationMessage(tournament, registration, reference, payment, timeSlot));
}
