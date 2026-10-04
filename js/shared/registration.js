import { config, formatCurrency, formatDateTime, normalize, whatsappUrl } from "./data.js";

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

  if (tournament.type === "squad" && teamName.length < 2) {
    return { fieldName: "teamName", message: "Enter a squad name with at least two characters." };
  }

  for (const participant of participants) {
    if (participant.name.length < 2) {
      return { fieldName: `${participant.fieldPrefix}Name`, message: "Enter an in-game name with at least two characters." };
    }
    if (!uidPattern.test(participant.uid)) {
      return { fieldName: `${participant.fieldPrefix}Uid`, message: "Enter a Free Fire UID containing 6–12 numbers." };
    }
    const age = Number(participant.age);
    if (!Number.isInteger(age) || age < config.minimumAge || age > 80) {
      return { fieldName: `${participant.fieldPrefix}Age`, message: `Enter an age from ${config.minimumAge} to 80.` };
    }
  }

  const seenUids = new Set();
  for (const participant of participants) {
    if (seenUids.has(participant.uid)) {
      return { fieldName: `${participant.fieldPrefix}Uid`, message: "Each player must use a different Free Fire UID." };
    }
    seenUids.add(participant.uid);
  }

  if (tournament.type === "squad" && participants.length !== 4) {
    return { fieldName: "teamName", message: "Squad registration requires exactly four players." };
  }
  return null;
}

export function buildRegistrationMessage(tournament, registration, reference) {
  const lines = [
    `*${config.brandName.toUpperCase()} — NEW REGISTRATION*`,
    "",
    `*Reference:* ${reference}`,
    `*Tournament:* ${tournament.name}`,
    `*Format:* ${tournament.formatLabel}`,
    `*Match:* ${formatDateTime(tournament.matchAt, "long")}`,
    `*Entry:* ${formatCurrency(tournament.entryFee)} ${tournament.feeUnit}`,
    `*Kill reward:* ${formatCurrency(tournament.killReward)} per confirmed kill`,
    `*Booyah bonus:* ${formatCurrency(tournament.booyahBonus)} additional for the match winner`
  ];

  if (tournament.type === "squad") lines.push(`*Squad:* ${registration.teamName}`);
  lines.push("", tournament.type === "solo" ? "*Player*" : "*Four-player lineup*");

  registration.participants.forEach((participant, index) => {
    const label = tournament.type === "solo" ? "Solo player" : `Player ${index + 1}${participant.captain ? " (Captain)" : ""}`;
    lines.push(label, `• Name: ${participant.name}`, `• Free Fire UID: ${participant.uid}`, `• Age: ${participant.age}`);
  });

  lines.push(
    "",
    "*Entrant confirmations*",
    "• Rules and payout verification terms accepted: Yes",
    `• Every player is ${config.guardianConsentAge}+ or has guardian approval: Yes`,
    "• Payment-proof process understood: Yes",
    "",
    "I understand that eliminations and the Booyah result must be verified by the organizer. I will attach payment proof in this chat only after receiving payment instructions, and I understand that this message does not confirm my slot."
  );

  return lines.filter((line, index) => !(line === "" && lines[index - 1] === "")).join("\n");
}

export function buildGroupJoinMessage(tournament, registration, reference) {
  const lines = [
    `*${config.brandName.toUpperCase()} — MATCH GROUP CHECK-IN*`,
    "",
    `*Reference:* ${reference}`,
    `*Tournament:* ${tournament.name}`,
    `*Player:* ${registration.participants[0]?.name || "Player"}`,
    `*Free Fire UID:* ${registration.participants[0]?.uid || "UID pending"}`,
    "",
    "Age and payment information stay private. Send them only through the organizer chat if requested."
  ];
  return lines.join("\n");
}

export function registrationWhatsAppUrl(tournament, registration, reference) {
  return whatsappUrl(buildRegistrationMessage(tournament, registration, reference));
}
