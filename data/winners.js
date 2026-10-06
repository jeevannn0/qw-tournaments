/*
 * Public, organizer-verified match winners.
 * Add a record only after the result is confirmed. Tournament and lobby IDs
 * must match data/tournaments.js. UID and kill count are optional public fields.
 *
 * Example record shape:
 * {
 *   id: "solo-2026-10-06-1930-winner",
 *   tournamentId: "solo-survival-01",
 *   timeSlotId: "solo-2026-10-06-1930",
 *   displayName: "Verified in-game name",
 *   uid: "123456789",
 *   kills: 4
 * }
 */
window.QW_WINNERS = [];
