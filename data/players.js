/*
 * PUBLIC ROSTERS ONLY
 * Never add ages, phone numbers, payment screenshots, room credentials,
 * legal names, or other private information to this public file.
 *
 * To publish a roster about two hours before a match:
 * 1. Add confirmed entries under the matching tournament id.
 * 2. Set published to true.
 * 3. Update updatedAt.
 * 4. Commit and push the file.
 */
window.QW_ROSTERS = {
  "solo-survival-01": {
    published: false,
    updatedAt: null,
    entries: []
  },
  "squad-last-circle-01": {
    published: false,
    updatedAt: null,
    entries: []
  },
  "clash-squad-cup-01": {
    published: true,
    updatedAt: "2026-09-29T12:00:00+05:30",
    isSample: true,
    entries: [
      {
        registrationId: "QW-DEMO-001",
        slot: 1,
        teamName: "Sample Team Falcons",
        status: "Confirmed",
        players: [
          { displayName: "Falcon One", uid: "Demo UID 01" },
          { displayName: "Falcon Two", uid: "Demo UID 02" },
          { displayName: "Falcon Three", uid: "Demo UID 03" },
          { displayName: "Falcon Four", uid: "Demo UID 04" }
        ]
      },
      {
        registrationId: "QW-DEMO-002",
        slot: 2,
        teamName: "Sample Team Vipers",
        status: "Confirmed",
        players: [
          { displayName: "Viper One", uid: "Demo UID 05" },
          { displayName: "Viper Two", uid: "Demo UID 06" },
          { displayName: "Viper Three", uid: "Demo UID 07" },
          { displayName: "Viper Four", uid: "Demo UID 08" }
        ]
      }
    ]
  }
};
