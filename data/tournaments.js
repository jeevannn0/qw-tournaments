/*
 * EDITING EVENTS
 * 1. Duplicate an event object and give it a unique id.
 * 2. Use an ISO date with the +05:30 India offset.
 * 3. Set registrationOpen to false when entries close.
 * 4. The values below are samples while QW_CONFIG.demoMode is true.
 */
window.QW_TOURNAMENTS = [
  {
    id: "solo-survival-01",
    shortCode: "SOLO-01",
    name: "Solo Survival 01",
    type: "solo",
    mode: "Battle Royale",
    formatLabel: "Solo · Full map",
    map: "Bermuda",
    maps: ["Bermuda", "Purgatory", "Kalahari"],
    rounds: "3 matches",
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
    ]
  },
  {
    id: "squad-last-circle-01",
    shortCode: "BR-01",
    name: "Squad Last Circle 01",
    type: "squad",
    mode: "Battle Royale",
    formatLabel: "Squad · Full map",
    map: "Rotating maps",
    maps: ["Bermuda", "Purgatory", "Kalahari"],
    rounds: "3 matches",
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
    ]
  },
  {
    id: "clash-squad-cup-01",
    shortCode: "TDM-01",
    name: "Clash Squad Cup 01",
    type: "squad",
    mode: "Clash Squad / TDM",
    formatLabel: "Squad · TDM",
    map: "Random arena",
    maps: ["Random arena announced at check-in"],
    rounds: "Best of 3 · Final best of 5",
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
    ]
  }
];
