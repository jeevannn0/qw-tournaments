/*
 * EDITING EVENTS
 * 1. Duplicate an event and give it a stable, unique id.
 * 2. Use ISO dates with the +05:30 India offset.
 * 3. Set registrationOpen to false when entries close.
 * 4. Replace all sample values before turning demoMode off.
 */
window.QW_TOURNAMENTS = [
  {
    id: "solo-survival-01",
    shortCode: "SOLO-01",
    name: "Solo Survival 01",
    tagline: "One player. Three drops. No one to carry you.",
    description: "A three-map solo survival series where placement discipline and clean eliminations decide the leaderboard.",
    type: "solo",
    mode: "Battle Royale",
    formatLabel: "Solo · Full map",
    stage: "Open qualifier",
    server: "India",
    platform: "Mobile",
    map: "Bermuda",
    maps: ["Bermuda", "Purgatory", "Kalahari"],
    rounds: "3 matches",
    registrationOpensAt: "2026-09-29T10:00:00+05:30",
    matchAt: "2026-10-04T19:00:00+05:30",
    checkInAt: "2026-10-04T18:30:00+05:30",
    registrationClosesAt: "2026-10-04T17:00:00+05:30",
    entryFee: 49,
    feeUnit: "per player",
    prizePool: 1500,
    capacity: 48,
    spotsLeft: 48,
    registrationOpen: true,
    statusLabel: "Registration open",
    featured: false,
    prizeBreakdown: [
      { place: "1st", amount: 800 },
      { place: "2nd", amount: 450 },
      { place: "3rd", amount: 250 }
    ],
    ruleHighlights: ["Mobile only", "1 point per elimination", "No teaming", "Three rotating maps"]
  },
  {
    id: "squad-last-circle-01",
    shortCode: "BR-01",
    name: "Squad Last Circle 01",
    tagline: "Four players. One circle. Every rotation counts.",
    description: "A four-player squad battle across three full maps with placement and elimination scoring.",
    type: "squad",
    mode: "Battle Royale",
    formatLabel: "Squad · Full map",
    stage: "Open qualifier",
    server: "India",
    platform: "Mobile",
    map: "Rotating maps",
    maps: ["Bermuda", "Purgatory", "Kalahari"],
    rounds: "3 matches",
    registrationOpensAt: "2026-09-29T10:00:00+05:30",
    matchAt: "2026-10-10T19:00:00+05:30",
    checkInAt: "2026-10-10T18:30:00+05:30",
    registrationClosesAt: "2026-10-10T17:00:00+05:30",
    entryFee: 199,
    feeUnit: "per 4-player squad",
    prizePool: 5000,
    capacity: 12,
    spotsLeft: 12,
    registrationOpen: true,
    statusLabel: "Registration open",
    featured: true,
    prizeBreakdown: [
      { place: "1st", amount: 2800 },
      { place: "2nd", amount: 1500 },
      { place: "3rd", amount: 700 }
    ],
    ruleHighlights: ["Exactly 4 players", "1 point per elimination", "Three rotating maps", "Captain check-in"]
  },
  {
    id: "clash-squad-cup-01",
    shortCode: "TDM-01",
    name: "Clash Squad Cup 01",
    tagline: "Fast rounds. Tight comms. No second chances.",
    description: "A compact four-player elimination bracket for squads built around quick decisions and clean team play.",
    type: "squad",
    mode: "Clash Squad / TDM",
    formatLabel: "Squad · TDM",
    stage: "Single elimination",
    server: "India",
    platform: "Mobile",
    map: "Random arena",
    maps: ["Random arena announced at check-in"],
    rounds: "Best of 3 · Final best of 5",
    registrationOpensAt: "2026-09-29T10:00:00+05:30",
    matchAt: "2026-10-11T19:00:00+05:30",
    checkInAt: "2026-10-11T18:30:00+05:30",
    registrationClosesAt: "2026-10-11T17:00:00+05:30",
    entryFee: 149,
    feeUnit: "per 4-player squad",
    prizePool: 3000,
    capacity: 16,
    spotsLeft: 16,
    registrationOpen: true,
    statusLabel: "Registration open",
    featured: false,
    prizeBreakdown: [
      { place: "1st", amount: 2000 },
      { place: "2nd", amount: 1000 }
    ],
    ruleHighlights: ["Exactly 4 players", "Best-of-3 series", "Final best of 5", "Captain check-in"]
  }
];
