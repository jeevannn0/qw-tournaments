import { getTimeSlot, normalize } from "./data.js?v=20261006-lobbies";
import { ensureAnonymousPlayer, getSupabaseClient } from "./supabase.js";

export const MAX_PAYMENT_PROOF_BYTES = 2 * 1024 * 1024;
const PAYMENT_METHODS = new Set(["upi"]);
const PAYMENT_CONTENT_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

export function paymentMethodLabel(value) {
  return value === "upi" ? "UPI" : "Unknown";
}

export function normalizeIndianWhatsapp(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : "";
}

export function normalizePaymentReference(value) {
  return normalize(value).replace(/\s+/g, "").toUpperCase().slice(0, 40);
}

export function validatePaymentDetails(formData) {
  const contactWhatsapp = normalizeIndianWhatsapp(formData.get("contactWhatsapp"));
  if (!contactWhatsapp) {
    return { fieldName: "contactWhatsapp", message: "Enter a valid 10-digit Indian WhatsApp number." };
  }

  const paymentMethod = normalize(formData.get("paymentMethod"));
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return { fieldName: "paymentMethod", message: "Choose the payment method you used." };
  }

  const paymentReference = normalizePaymentReference(formData.get("paymentReference"));
  if (!/^[A-Z0-9-]{6,40}$/.test(paymentReference)) {
    return { fieldName: "paymentReference", message: "Enter the 6–40 character UTR or transaction reference from your payment app." };
  }

  const screenshot = formData.get("paymentScreenshot");
  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return { fieldName: "paymentScreenshot", message: "Upload the payment screenshot before submitting." };
  }
  if (!PAYMENT_CONTENT_TYPES.has(screenshot.type)) {
    return { fieldName: "paymentScreenshot", message: "Upload a JPG, PNG, or WebP payment screenshot." };
  }
  if (screenshot.size > MAX_PAYMENT_PROOF_BYTES) {
    return { fieldName: "paymentScreenshot", message: "The payment screenshot must be 2 MB or smaller." };
  }

  return null;
}

export function collectPaymentDetails(formData) {
  const screenshot = formData.get("paymentScreenshot");
  return {
    contactWhatsapp: normalizeIndianWhatsapp(formData.get("contactWhatsapp")),
    paymentMethod: normalize(formData.get("paymentMethod")),
    paymentReference: normalizePaymentReference(formData.get("paymentReference")),
    screenshot
  };
}

function completeConsents(consents) {
  return ["rulesAccepted", "guardianApproved", "paymentConfirmed", "publicRosterApproved"]
    .every((key) => consents?.[key] === true);
}

export async function submitCompleteRegistration({
  tournament,
  registration,
  payment,
  timeSlot,
  reference,
  consents,
  onProgress
}) {
  if (!tournament || tournament.id !== "solo-survival-01") {
    throw new Error("Only the live Solo tournament can accept registration.");
  }
  const validTimeSlot = getTimeSlot(tournament, timeSlot?.id);
  if (!validTimeSlot || Date.parse(validTimeSlot.startsAt) <= Date.now() || Number(validTimeSlot.spotsLeft) <= 0) {
    throw new Error("Choose an available Solo lobby before submitting.");
  }
  if (!registration?.participants?.length || registration.participants.length !== 1) {
    throw new Error("A complete Solo player entry is required.");
  }
  if (!payment?.screenshot || !completeConsents(consents)) {
    throw new Error("Complete every field, payment detail, screenshot, and confirmation before submitting.");
  }

  const client = await getSupabaseClient();
  const user = await ensureAnonymousPlayer(client);
  const registrationId = window.crypto?.randomUUID?.();
  if (!registrationId) throw new Error("This browser cannot create a secure registration identifier.");

  const extension = PAYMENT_CONTENT_TYPES.get(payment.screenshot.type);
  const screenshotPath = `${user.id}/${registrationId}/${reference}.${extension}`;
  const participant = registration.participants[0];
  onProgress?.(15);

  const { error: uploadError } = await client.storage
    .from("payment-proofs")
    .upload(screenshotPath, payment.screenshot, {
      contentType: payment.screenshot.type,
      cacheControl: "0",
      upsert: false
    });
  if (uploadError) throw uploadError;
  onProgress?.(75);

  const { error: insertError } = await client.from("registrations").insert({
    id: registrationId,
    owner_user_id: user.id,
    reference,
    tournament_id: tournament.id,
    tournament_name: tournament.name,
    time_slot_id: validTimeSlot.id,
    time_slot_label: validTimeSlot.label,
    time_slot_at: validTimeSlot.startsAt,
    display_name: normalize(participant.name).slice(0, 32),
    ff_uid: normalize(participant.uid).slice(0, 12),
    age: Number(participant.age),
    contact_whatsapp: payment.contactWhatsapp,
    payment_method: payment.paymentMethod,
    payment_reference: payment.paymentReference,
    payment_amount: Number(tournament.entryFee),
    screenshot_path: screenshotPath,
    screenshot_content_type: payment.screenshot.type,
    screenshot_size: payment.screenshot.size,
    rules_accepted: true,
    guardian_approved: true,
    payment_confirmed: true,
    public_roster_approved: true,
    payment_status: "pending",
    registration_status: "pending",
    slot: null,
    organizer_note: ""
  });

  if (insertError) {
    try {
      await client.storage.from("payment-proofs").remove([screenshotPath]);
    } catch {
      // A private orphan is safer than creating a partial registration record.
    }
    throw insertError;
  }

  onProgress?.(100);
  return { id: registrationId, reference, screenshotPath };
}

export function registrationSubmissionError(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();
  if (lower.includes("anonymous") && lower.includes("disabled")) return "Anonymous sign-in is not enabled in Supabase Authentication.";
  if (lower.includes("row-level security") || lower.includes("permission") || lower.includes("unauthorized")) return "Supabase rejected the submission. Apply the database and Storage security policies.";
  if (lower.includes("maximum") || lower.includes("too large") || lower.includes("payload")) return "The payment screenshot is too large. Upload an image no larger than 2 MB.";
  if (lower.includes("network") || lower.includes("fetch")) return "The registration service is temporarily unavailable. Check your connection and try again.";
  return message || "Registration could not be submitted. Nothing was confirmed.";
}
