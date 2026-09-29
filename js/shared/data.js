const rawConfig = window.QW_CONFIG || {};

export const config = Object.freeze({
  brandName: rawConfig.brandName || "QW Tournaments",
  gameName: rawConfig.gameName || "Free Fire",
  whatsappNumber: String(rawConfig.whatsappNumber || ""),
  whatsappDisplay: rawConfig.whatsappDisplay || "WhatsApp",
  timezone: rawConfig.timezone || "Asia/Kolkata",
  timezoneLabel: rawConfig.timezoneLabel || "IST",
  demoMode: Boolean(rawConfig.demoMode),
  rosterLeadHours: Number(rawConfig.rosterLeadHours) || 2,
  minimumAge: Number(rawConfig.minimumAge) || 13,
  guardianConsentAge: Number(rawConfig.guardianConsentAge) || 18,
  supportHours: rawConfig.supportHours || "Hours announced in WhatsApp",
  organizerName: rawConfig.organizerName || "QW Tournament Admin",
  registrationPrefix: rawConfig.registrationPrefix || "QW"
});

export const tournaments = Array.isArray(window.QW_TOURNAMENTS) ? window.QW_TOURNAMENTS : [];
export const rosters = window.QW_ROSTERS && typeof window.QW_ROSTERS === "object" ? window.QW_ROSTERS : {};

const eventMedia = Object.freeze({
  "solo-survival-01": {
    src: "assets/ff-arena-07.jpg",
    alt: "Official Free Fire wallpaper featuring a competitor in a neon city",
    focus: "center 35%"
  },
  "squad-last-circle-01": {
    src: "assets/ff-arena-01.jpg",
    alt: "Official Free Fire wallpaper featuring a four-player squad charging forward",
    focus: "center center"
  },
  "clash-squad-cup-01": {
    src: "assets/ff-arena-04.jpg",
    alt: "Official Free Fire wallpaper featuring a colorful combat squad",
    focus: "center 35%"
  }
});

export const galleryMedia = Object.freeze([
  { src: "assets/ff-arena-02.jpg", alt: "Official Free Fire wallpaper with competitors moving through a futuristic city", label: "City drop" },
  { src: "assets/ff-arena-03.jpg", alt: "Official Free Fire wallpaper with two futuristic competitors", label: "Duo threat" },
  { src: "assets/ff-arena-05.jpg", alt: "Official Free Fire wallpaper with two ice-themed fighters", label: "Final clash" },
  { src: "assets/ff-arena-06.jpg", alt: "Official Free Fire wallpaper featuring a neon music squad", label: "Squad style" },
  { src: "assets/ff-arena-08.jpg", alt: "Official Free Fire wallpaper featuring fire and ice warriors", label: "Elemental raid" }
]);

export function getEventMedia(tournament) {
  return eventMedia[tournament?.id] || galleryMedia[0];
}

export const officialWallpaperSource = "https://ff.garena.com/en/wallpaper/";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function createDateFormatter(options) {
  try {
    return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: config.timezone });
  } catch {
    return new Intl.DateTimeFormat("en-IN", options);
  }
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

const dateOnlyFormatter = createDateFormatter({
  day: "numeric",
  month: "short",
  year: "numeric"
});

const timeOnlyFormatter = createDateFormatter({
  hour: "numeric",
  minute: "2-digit"
});

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
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : "To be announced";
}

export function formatDateTime(value, style = "compact") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Schedule pending";
  const formatter = style === "long" ? longDateFormatter : compactDateFormatter;
  return `${formatter.format(date)} ${config.timezoneLabel}`;
}

export function formatDateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Date pending" : dateOnlyFormatter.format(date);
}

export function formatTimeOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Time pending" : `${timeOnlyFormatter.format(date)} ${config.timezoneLabel}`;
}

export function getTournament(id) {
  return tournaments.find((tournament) => tournament.id === id);
}

export function getRequestedTournament() {
  const id = new URLSearchParams(window.location.search).get("tournament");
  return getTournament(id) || null;
}

export function isTdm(tournament) {
  return /tdm|clash/i.test(String(tournament?.mode || ""));
}

export function getEventState(tournament, now = Date.now()) {
  const matchAt = Date.parse(tournament.matchAt);
  const closesAt = Date.parse(tournament.registrationClosesAt);

  if (Number.isFinite(matchAt) && now >= matchAt) {
    return { key: "complete", label: "Completed", open: false, action: "View results" };
  }

  if (!tournament.registrationOpen) {
    return { key: "closed", label: "Registration closed", open: false, action: "View event" };
  }

  if (Number(tournament.spotsLeft) <= 0) {
    return { key: "full", label: "Slots full", open: false, action: "View event" };
  }

  if (Number.isFinite(closesAt) && now >= closesAt) {
    return { key: "closed", label: "Registration closed", open: false, action: "View event" };
  }

  if (Number.isFinite(closesAt) && closesAt - now <= 24 * 60 * 60 * 1000) {
    return { key: "closing", label: "Closing soon", open: true, action: "Register now" };
  }

  return { key: "open", label: tournament.statusLabel || "Registration open", open: true, action: "Register now" };
}

export function getCapacity(tournament) {
  const capacity = Math.max(0, Number(tournament.capacity) || 0);
  const spotsLeft = Math.min(capacity, Math.max(0, Number(tournament.spotsLeft) || 0));
  const filled = Math.max(0, capacity - spotsLeft);
  return {
    capacity,
    spotsLeft,
    filled,
    unit: tournament.type === "solo" ? "players" : "teams",
    percent: capacity ? Math.round((filled / capacity) * 100) : 0
  };
}

export function eventMark(tournament) {
  if (isTdm(tournament)) return "TDM";
  return tournament.type === "solo" ? "SOLO" : "SQUAD";
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
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function supportUrl(subject = "an upcoming tournament") {
  return whatsappUrl(`Hi ${config.organizerName}, I have a question about ${subject}.`);
}

export function setDocumentTitle(title) {
  document.title = title ? `${title} — ${config.brandName}` : config.brandName;
}
