import { normalize, tournaments } from "./data.js?v=20261011-lifecycle";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase.js?v=20261011-lifecycle";

export const MATCH_CARD_IDS = Object.freeze([
  "solo-survival-01",
  "squad-last-circle-01",
  "clash-squad-cup-01"
]);

const knownIds = new Set(MATCH_CARD_IDS);
const presentationModes = new Set(["coming_soon", "scheduled", "registration_open"]);
const limits = Object.freeze({
  name: [2, 80],
  tagline: [5, 180],
  description: [20, 1000],
  map: [2, 80],
  rounds: [2, 120],
  rewardLabel: [5, 120],
  changeNote: [5, 500]
});
const defaults = new Map(tournaments
  .filter((tournament) => knownIds.has(tournament?.id))
  .map((tournament) => [tournament.id, Object.freeze({
    name: tournament.name,
    tagline: tournament.tagline,
    description: tournament.description,
    map: tournament.map,
    rounds: tournament.rounds,
    capacity: tournament.capacity,
    presentationMode: "coming_soon",
    scheduledAt: null,
    entryFee: null,
    rewardLabel: null,
    registrationCycle: 1
  })]));
let hydrationPromise = null;
let successfulSnapshot = null;

function validText(value, field) {
  const text = normalize(value);
  const [minimum, maximum] = limits[field];
  return text.length >= minimum && text.length <= maximum ? text : null;
}

export function projectMatchCardOverride(row) {
  if (!row || !knownIds.has(row.tournament_id) || !presentationModes.has(row.presentation_mode)) return null;
  const capacity = Number(row.capacity);
  const version = Number(row.version);
  const registrationCycle = Number(row.registration_cycle);
  const scheduledAt = row.scheduled_at || null;
  const scheduledTimestamp = scheduledAt ? Date.parse(scheduledAt) : NaN;
  const entryFee = row.card_entry_fee === null ? null : Number(row.card_entry_fee);
  const rewardLabel = row.reward_label === null ? null : validText(row.reward_label, "rewardLabel");
  const factMode = row.presentation_mode === "scheduled" || row.presentation_mode === "registration_open";
  const presentationFieldsValid = row.presentation_mode === "coming_soon"
    ? scheduledAt === null && entryFee === null && row.reward_label === null
    : factMode
      && Number.isFinite(scheduledTimestamp)
      && Number.isInteger(entryFee)
      && entryFee >= (row.presentation_mode === "registration_open" ? 1 : 0)
      && entryFee <= 100000
      && Boolean(rewardLabel);
  const projected = {
    tournamentId: row.tournament_id,
    name: validText(row.name, "name"),
    tagline: validText(row.tagline, "tagline"),
    description: validText(row.description, "description"),
    map: validText(row.map, "map"),
    rounds: validText(row.rounds, "rounds"),
    capacity,
    presentationMode: row.presentation_mode,
    scheduledAt,
    entryFee,
    rewardLabel,
    registrationCycle,
    version,
    changeNote: normalize(row.change_note).slice(0, limits.changeNote[1]),
    updatedAt: row.updated_at || null
  };
  const copyValid = [projected.name, projected.tagline, projected.description, projected.map, projected.rounds].every(Boolean);
  const capacityValid = Number.isInteger(capacity) && capacity >= 1 && capacity <= 500;
  const versionValid = Number.isInteger(version) && version >= 1;
  const cycleValid = Number.isInteger(registrationCycle) && registrationCycle >= 1;
  return copyValid && capacityValid && versionValid && cycleValid && presentationFieldsValid ? projected : null;
}

export function resetMatchCardPresentation(tournamentId = null) {
  const targets = tournamentId ? tournaments.filter((item) => item.id === tournamentId) : tournaments;
  targets.forEach((tournament) => {
    const checkedIn = defaults.get(tournament.id);
    if (!checkedIn) return;
    tournament.name = checkedIn.name;
    tournament.tagline = checkedIn.tagline;
    tournament.description = checkedIn.description;
    tournament.map = checkedIn.map;
    tournament.rounds = checkedIn.rounds;
    tournament.presentationMode = checkedIn.presentationMode;
    tournament.presentationScheduledAt = checkedIn.scheduledAt;
    tournament.presentationEntryFee = checkedIn.entryFee;
    tournament.presentationRewardLabel = checkedIn.rewardLabel;
    tournament.presentationCapacity = checkedIn.capacity;
    tournament.registrationCycle = checkedIn.registrationCycle;
    delete tournament.presentationSpotsLeft;
  });
}

export function applyMatchCardOverride(override) {
  const projected = override?.tournamentId ? override : projectMatchCardOverride(override);
  const tournament = tournaments.find((item) => item.id === projected?.tournamentId);
  if (!tournament || !projected) return false;
  tournament.name = projected.name;
  tournament.tagline = projected.tagline;
  tournament.description = projected.description;
  tournament.map = projected.map;
  tournament.rounds = projected.rounds;
  tournament.presentationMode = projected.presentationMode;
  tournament.presentationScheduledAt = projected.scheduledAt;
  tournament.presentationEntryFee = projected.entryFee;
  tournament.presentationRewardLabel = projected.rewardLabel;
  tournament.presentationCapacity = projected.capacity;
  tournament.registrationCycle = projected.registrationCycle;
  return true;
}

export function getMatchCardDefaults(tournamentId) {
  return defaults.get(tournamentId) || null;
}

function applyOccupancy(rows) {
  (rows || []).forEach((row) => {
    const tournament = tournaments.find((item) => item.id === row?.tournament_id);
    const cycle = Number(row?.registration_cycle);
    const capacity = Number(row?.capacity);
    const spotsLeft = Number(row?.spots_left);
    if (!tournament || cycle !== Number(tournament.registrationCycle)) return;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return;
    if (!Number.isInteger(spotsLeft) || spotsLeft < 0 || spotsLeft > capacity) return;
    tournament.presentationCapacity = capacity;
    tournament.presentationSpotsLeft = spotsLeft;
  });
}

const publicColumns = "tournament_id, name, tagline, description, map, rounds, capacity, presentation_mode, scheduled_at, card_entry_fee, reward_label, registration_cycle, version, updated_at";
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function fetchSnapshot(client) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [overridesResponse, occupancyResponse] = await Promise.all([
        client.from("match_card_overrides").select(publicColumns),
        client.rpc("get_current_tournament_occupancy")
      ]);
      if (overridesResponse.error) throw overridesResponse.error;
      if (occupancyResponse.error) throw occupancyResponse.error;
      return {
        overrides: (overridesResponse.data || []).map(projectMatchCardOverride).filter(Boolean),
        occupancy: occupancyResponse.data || []
      };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await wait(250 * (attempt + 1));
    }
  }
  throw lastError || new Error("Match presentation could not be refreshed.");
}

export async function hydrateTournamentOverrides({ force = false, throwOnError = false } = {}) {
  if (!isSupabaseConfigured()) return [];
  if (!force && successfulSnapshot) return successfulSnapshot.overrides;
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      const client = await getSupabaseClient();
      const snapshot = await fetchSnapshot(client);
      resetMatchCardPresentation();
      snapshot.overrides.forEach(applyMatchCardOverride);
      applyOccupancy(snapshot.occupancy);
      successfulSnapshot = snapshot;
      return snapshot.overrides;
    })();
  }
  try {
    return await hydrationPromise;
  } catch (error) {
    if (throwOnError) throw error;
    return successfulSnapshot?.overrides || [];
  } finally {
    hydrationPromise = null;
  }
}

export async function loadAdminMatchCardOverrides(client) {
  if (!client) return { rows: [], error: new Error("Supabase client unavailable.") };
  const { data, error } = await client.from("match_card_overrides")
    .select(publicColumns)
    .order("tournament_id", { ascending: true });
  if (error) return { rows: [], error };
  return { rows: (data || []).map(projectMatchCardOverride).filter(Boolean), error: null };
}
