import { config, formatCurrency, formatDateTime, normalize, whatsappUrl } from "./data.js";

export function createRegistrationId(tournament) {
  const now = new Date();
  const dateCode = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const bytes = new Uint8Array(2);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 256);
    bytes[1] = Math.floor(Math.random() * 256);
  }

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
        captain: true
      }]
    };
  }

  return {
    teamName: normalize(formData.get("teamName")),
    participants: [1, 2, 3, 4].map((number) => ({
      name: normalize(formData.get(`player${number}Name`)),
      uid: normalize(formData.get(`player${number}Uid`)),
      age: normalize(formData.get(`player${number}Age`)),
      captain: number === 1
    }))
  };
}

export function validateRegistration(tournament, registration) {
  const uidPattern = /^\d{6,12}$/;
  const { participants, teamName } = registration;

  if (tournament.type === "squad" && teamName.length < 2) {
    return "Enter a team name with at least two characters.";
  }
  if (participants.some((participant) => participant.name.length < 2)) {
    return "Enter a valid name for every player.";
  }
  if (participants.some((participant) => !uidPattern.test(participant.uid))) {
    return "Every Free Fire UID must contain 6–12 numbers.";
  }
  if (new Set(participants.map((participant) => participant.uid)).size !== participants.length) {
    return "Every player must use a different Free Fire UID.";
  }
  if (tournament.type === "squad" && participants.length !== 4) {
    return "Squad registration requires exactly four players.";
  }

  const invalidAge = participants.some((participant) => {
    const age = Number(participant.age);
    return !Number.isInteger(age) || age < config.minimumAge || age > 80;
  });
  if (invalidAge) {
    return `Every player must enter a valid age of ${config.minimumAge} or above.`;
  }
  return "";
}

export function buildRegistrationMessage(tournament, registration, reference) {
  const lines = [
    config.demoMode ? `*${config.brandName.toUpperCase()} — TEST ENQUIRY*` : `*${config.brandName.toUpperCase()} — NEW REGISTRATION*`,
    config.demoMode ? "_Demo event: please do not send payment._" : "",
    "",
    `*Reference:* ${reference}`,
    `*Tournament:* ${tournament.name}`,
    `*Format:* ${tournament.formatLabel}`,
    `*Match:* ${formatDateTime(tournament.matchAt, "long")}`,
    `*Entry:* ${formatCurrency(tournament.entryFee)} ${tournament.feeUnit}`
  ];

  if (tournament.type === "squad") lines.push(`*Team:* ${registration.teamName}`);
  lines.push("", tournament.type === "solo" ? "*Player*" : "*Four-player lineup*");

  registration.participants.forEach((participant, index) => {
    const label = tournament.type === "solo" ? "Solo player" : `Player ${index + 1}${participant.captain ? " (Captain)" : ""}`;
    lines.push(label, `• Name: ${participant.name}`, `• Free Fire UID: ${participant.uid}`, `• Age: ${participant.age}`);
  });

  lines.push(
    "",
    "*Entrant confirmations*",
    "• Rules accepted: Yes",
    `• Every player is ${config.guardianConsentAge}+ or has guardian approval: Yes`,
    "• Payment-proof process understood: Yes",
    "",
    "I will attach payment proof in this chat only after receiving verified payment instructions. I understand that this message and a screenshot do not confirm my slot."
  );

  return lines.filter((line, index) => !(line === "" && lines[index - 1] === "")).join("\n");
}

export function registrationWhatsAppUrl(tournament, registration, reference) {
  return whatsappUrl(buildRegistrationMessage(tournament, registration, reference));
}
