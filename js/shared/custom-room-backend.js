import { getSupabaseClient, isSupabaseConfigured } from "./supabase.js?v=20261013-squad-results";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;

export function normalizeRegistrationEmail(value) {
  return String(value ?? "").trim().toLowerCase().slice(0, 254);
}

export function validRegistrationEmail(value) {
  const email = normalizeRegistrationEmail(value);
  return email.length >= 3 && EMAIL_PATTERN.test(email);
}

export async function isCustomRoomReady(tournamentId) {
  if (!isSupabaseConfigured()) return false;
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("is_tournament_room_ready", {
    p_tournament_id: tournamentId
  });
  if (error) throw error;
  return data === true;
}

export async function getCustomRoomCredentials(tournamentId, email) {
  if (!validRegistrationEmail(email)) return null;
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_current_tournament_room_credentials", {
    p_tournament_id: tournamentId,
    p_registration_email: normalizeRegistrationEmail(email)
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.room_id || !row?.room_password) return null;
  return {
    roomId: String(row.room_id).slice(0, 64),
    roomPassword: String(row.room_password).slice(0, 64)
  };
}

export async function loadActiveCustomRooms(client) {
  const { data, error } = await client.rpc("get_active_custom_rooms");
  if (error) throw error;
  if ((data || []).some((row) => typeof row?.active !== "boolean")) {
    throw new Error("Apply supabase-migrations/2026-10-11-lifecycle-reconciliation.sql.");
  }
  return (data || []).map((row) => ({
    tournamentId: String(row.tournament_id || "").slice(0, 64),
    tournamentName: String(row.tournament_name || "").trim().slice(0, 80),
    scheduledAt: row.scheduled_at,
    registrationCycle: Number(row.registration_cycle),
    roomId: String(row.room_id || "").slice(0, 64),
    roomPassword: String(row.room_password || "").slice(0, 64),
    active: row.active === true
  }));
}

export async function saveCustomRoomCredentials(client, room) {
  const { error } = await client.rpc("save_tournament_room_credentials", {
    p_tournament_id: room.tournamentId,
    p_expected_cycle: room.registrationCycle,
    p_room_id: room.roomId,
    p_room_password: room.roomPassword
  });
  if (error) throw error;
}

export async function clearCustomRoomCredentials(client, room) {
  const { error } = await client.rpc("clear_tournament_room_credentials", {
    p_tournament_id: room.tournamentId,
    p_expected_cycle: room.registrationCycle
  });
  if (error) throw error;
}
