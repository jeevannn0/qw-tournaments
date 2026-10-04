const rawConfig = window.QW_CONFIG && typeof window.QW_CONFIG === "object" ? window.QW_CONFIG : {};

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function normalizedText(value, fallback, maximum = 80) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, maximum);
}

function validTimezone(value) {
  const timezone = normalizedText(value, "Asia/Kolkata", 60);
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "Asia/Kolkata";
  }
}

function validWhatsappGroupUrl(value) {
  const url = String(value ?? "").trim();
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{20,32}$/.test(url) ? url : "";
}

const whatsappNumber = String(rawConfig.whatsappNumber ?? "").replace(/\D/g, "");
const whatsappGroupUrl = validWhatsappGroupUrl(rawConfig.whatsappGroupUrl);
const registrationPrefix = normalizedText(rawConfig.registrationPrefix, "QW", 8).replace(/[^A-Z0-9]/gi, "").toUpperCase() || "QW";
const minimumAge = boundedNumber(rawConfig.minimumAge, 13, 13, 80);
const guardianConsentAge = boundedNumber(rawConfig.guardianConsentAge, 18, minimumAge, 80);

export const config = Object.freeze({
  brandName: normalizedText(rawConfig.brandName, "QW Tournaments"),
  gameName: normalizedText(rawConfig.gameName, "Free Fire"),
  whatsappNumber,
  whatsappDisplay: normalizedText(rawConfig.whatsappDisplay, "WhatsApp"),
  whatsappGroupUrl,
  whatsappGroupSafe: Boolean(whatsappGroupUrl),
  timezone: validTimezone(rawConfig.timezone),
  timezoneLabel: normalizedText(rawConfig.timezoneLabel, "IST", 12),
  rosterLeadHours: boundedNumber(rawConfig.rosterLeadHours, 2, 0, 72),
  minimumAge,
  guardianConsentAge,
  supportHours: normalizedText(rawConfig.supportHours, "Hours announced in WhatsApp"),
  organizerName: normalizedText(rawConfig.organizerName, "QW Tournament Admin"),
  registrationPrefix,
  registrationSafe: /^\d{10,15}$/.test(whatsappNumber)
});

export const tournaments = Array.isArray(window.QW_TOURNAMENTS) ? window.QW_TOURNAMENTS : [];
export const rosters = window.QW_ROSTERS && typeof window.QW_ROSTERS === "object" ? window.QW_ROSTERS : {};

const eventMedia = Object.freeze({
  "solo-survival-01": {
    src: "assets/free-fire-solo.jpg",
    alt: "Free Fire competitor overlooking a neon city battleground",
    focus: "center 38%",
  },
  "squad-last-circle-01": {
    src: "assets/free-fire-squad.jpg",
    alt: "Free Fire squad rushing forward together",
    focus: "center center",
  },
  "clash-squad-cup-01": {
    src: "assets/free-fire-clash.jpg",
    alt: "Free Fire clash crew posing in a dark arena",
    focus: "center 42%",
  }
});

const fallbackMedia = Object.freeze({
  src: "assets/free-fire-squad.jpg",
  alt: "Free Fire squad rushing forward together",
  focus: "center"
});

export function getEventMedia(tournament) {
  return eventMedia[tournament?.id] || fallbackMedia;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function createDateFormatter(options) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: config.timezone });
}

const compactDateFormatter = createDateFormatter({
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit"
});

const longDateFormatter = createDateFormatter({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const dateOnlyFormatter = createDateFormatter({ day: "numeric", month: "short", year: "numeric" });
const timeOnlyFormatter = createDateFormatter({ hour: "numeric", minute: "2-digit" });

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "To be announced";
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? currencyFormatter.format(amount) : "To be announced";
}

export function formatReward(tournament) {
  if (tournament?.comingSoon) return "To be announced";
  const killReward = Number(tournament?.killReward);
  const booyahBonus = Number(tournament?.booyahBonus);
  if (Number.isFinite(killReward) && killReward >= 0 && Number.isFinite(booyahBonus) && booyahBonus >= 0) {
    return `${formatCurrency(killReward)} / kill + ${formatCurrency(booyahBonus)} Booyah`;
  }
  return formatCurrency(tournament?.prizePool);
}

export function formatDateTime(value, style = "compact") {
  if (!value) return "Schedule pending";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Schedule pending";
  return `${(style === "long" ? longDateFormatter : compactDateFormatter).format(date)} ${config.timezoneLabel}`;
}

export function formatDateOnly(value) {
  if (!value) return "Date pending";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date pending" : dateOnlyFormatter.format(date);
}

export function formatTimeOnly(value) {
  if (!value) return "Time pending";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Time pending" : `${timeOnlyFormatter.format(date)} ${config.timezoneLabel}`;
}

export function getTournament(id) {
  const safeId = String(id ?? "");
  if (!/^[a-z0-9-]{1,64}$/.test(safeId)) return null;
  return tournaments.find((tournament) => tournament?.id === safeId) || null;
}

export function getRequestedTournament() {
  return getTournament(new URLSearchParams(window.location.search).get("tournament"));
}

export function isTdm(tournament) {
  return /tdm|clash/i.test(String(tournament?.mode || ""));
}

export function getEventHealth(tournament) {
  if (!tournament || typeof tournament !== "object") return { valid: false, reason: "Event data unavailable" };
  if (!/^[a-z0-9-]{1,64}$/.test(String(tournament.id || ""))) return { valid: false, reason: "Event code unavailable" };
  if (!['solo', 'squad'].includes(tournament.type)) return { valid: false, reason: "Format unavailable" };

  const matchAt = Date.parse(tournament.matchAt);
  const checkInAt = Date.parse(tournament.checkInAt);
  const closesAt = Date.parse(tournament.registrationClosesAt);
  const opensAt = tournament.registrationOpensAt ? Date.parse(tournament.registrationOpensAt) : null;
  const scheduleValid = Number.isFinite(matchAt)
    && Number.isFinite(checkInAt)
    && Number.isFinite(closesAt)
    && (opensAt === null || Number.isFinite(opensAt))
    && (opensAt === null || opensAt <= closesAt)
    && closesAt <= checkInAt
    && checkInAt <= matchAt;
  if (!scheduleValid) return { valid: false, reason: "Schedule unavailable" };

  const fee = Number(tournament.entryFee);
  const prize = Number(tournament.prizePool);
  const capacity = Number(tournament.capacity);
  const spotsLeft = Number(tournament.spotsLeft);
  if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(prize) || prize < 0) {
    return { valid: false, reason: "Fee or prize unavailable" };
  }
  if (tournament.type === "solo") {
    const killReward = Number(tournament.killReward);
    const booyahBonus = Number(tournament.booyahBonus);
    if (!Number.isFinite(killReward) || killReward < 0 || !Number.isFinite(booyahBonus) || booyahBonus < 0) {
      return { valid: false, reason: "Reward terms unavailable" };
    }
  }
  if (!Number.isInteger(capacity) || capacity <= 0 || !Number.isInteger(spotsLeft) || spotsLeft < 0) {
    return { valid: false, reason: "Capacity unavailable" };
  }
  return { valid: true, reason: "" };
}

export function getEventState(tournament, now = Date.now()) {
  if (tournament?.comingSoon === true) {
    return { key: "scheduled", label: "Coming soon", open: false, action: "View preview", reason: "Schedule, entry fee, and rewards will be announced before registration opens." };
  }

  const health = getEventHealth(tournament);
  if (!health.valid) return { key: "unavailable", label: "Event unavailable", open: false, action: "View event", reason: health.reason };

  const matchAt = Date.parse(tournament.matchAt);
  const opensAt = tournament.registrationOpensAt ? Date.parse(tournament.registrationOpensAt) : null;
  const closesAt = Date.parse(tournament.registrationClosesAt);

  if (now >= matchAt) return { key: "complete", label: "Completed", open: false, action: "View event" };
  if (opensAt !== null && now < opensAt) return { key: "scheduled", label: "Registration opens soon", open: false, action: "View event" };
  if (tournament.registrationOpen !== true) return { key: "closed", label: "Registration closed", open: false, action: "View event" };
  if (Number(tournament.spotsLeft) <= 0) return { key: "full", label: "Slots full", open: false, action: "View event" };
  if (now >= closesAt) return { key: "closed", label: "Registration closed", open: false, action: "View event" };
  if (!config.registrationSafe) return { key: "unavailable", label: "Registration unavailable", open: false, action: "View event", reason: "Organizer contact unavailable" };
  if (tournament.live === true) return { key: "open", label: "Live now", open: true, action: "Register now" };
  if (closesAt - now <= 24 * 60 * 60 * 1000) return { key: "closing", label: "Closing soon", open: true, action: "Register now" };
  return { key: "open", label: "Registration open", open: true, action: "Register now" };
}

export function getCapacity(tournament) {
  const capacity = Math.max(0, Number(tournament?.capacity) || 0);
  const spotsLeft = Math.min(capacity, Math.max(0, Number(tournament?.spotsLeft) || 0));
  const filled = Math.max(0, capacity - spotsLeft);
  return {
    capacity,
    spotsLeft,
    filled,
    unit: tournament?.type === "solo" ? "players" : "teams",
    percent: capacity ? Math.round((filled / capacity) * 100) : 0
  };
}

export function eventMark(tournament) {
  if (isTdm(tournament)) return "TDM";
  return tournament?.type === "solo" ? "SOLO" : "SQUAD";
}

export function eventUrl(tournament) {
  return `tournament.html?tournament=${encodeURIComponent(tournament.id)}`;
}

export function registrationUrl(tournament) {
  return `register.html?tournament=${encodeURIComponent(tournament.id)}`;
}

export function rosterUrl(tournament) {
  return `players.html?tournament=${encodeURIComponent(tournament.id)}`;
}

export function whatsappUrl(message) {
  if (!config.registrationSafe) return "";
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function supportUrl(subject = "an upcoming tournament") {
  return whatsappUrl(`Hi ${config.organizerName}, I have a question about ${subject}.`);
}

export function setDocumentTitle(title) {
  document.title = title ? `${title} — ${config.brandName}` : config.brandName;
}
