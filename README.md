# QW Tournaments

A dependency-free, multi-page Free Fire tournament website for solo Battle Royale, four-player squad Battle Royale, and squad Clash Squad/TDM events. It runs on static hosting such as GitHub Pages—no application server or database is required.

Registration details are prepared only in the player's browser and handed to the organizer through WhatsApp. The organizer verifies payments and confirmations manually.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Focused homepage, featured event, upcoming-event preview, and joining flow |
| `tournaments.html` | Searchable/filterable tournament board |
| `tournament.html?tournament=<id>` | Dedicated schedule, rewards, format, availability, and rules view |
| `register.html?tournament=<id>` | Three-step Solo registration builder; future formats remain disabled |
| `players.html?tournament=<id>` | Searchable public confirmed-player roster |
| `rules.html` | Eligibility, fair play, check-in, scoring, dispute, payment, and privacy rules |

## Current release

- **Solo Survival 01:** registration open, ₹10 entry per player, ₹6 per organizer-verified kill, and an additional ₹30 Booyah bonus.
- **Squad Last Circle 01:** Coming soon; registration, payment, schedule, fee, and rewards are unavailable.
- **Clash Squad Cup 01:** Coming soon under the same restrictions.
- Public rosters are empty until the organizer confirms and publishes real entries.

## Before publishing

1. Verify the WhatsApp number in `data/config.js`.
2. Confirm the Solo registration-close, check-in, and match timestamps in `data/tournaments.js`; the current release uses 4 October 2026.
3. Confirm Bermuda and the 48-player capacity.
4. Test the complete Solo registration and WhatsApp message.
5. Publish exact cancellation, refund, eligibility, result-verification, and payout timing terms before accepting payment.
6. Never accept Squad or TDM payment while those cards say Coming soon.

## Project structure

```text
.
├── assets/
│   └── favicon.svg
├── data/
│   ├── config.js                  # Brand, WhatsApp, timezone, and age settings
│   ├── players.js                 # Manually maintained public rosters
│   └── tournaments.js             # Event details, schedules, prizes, and slots
├── css/
│   ├── styles.css                  # Structural and base styles
│   └── gaming.css                  # Combat skin, layered after styles.css
├── docs/
│   └── ui-references.md            # Product and accessibility research applied
├── js/
│   ├── pages/
│   │   ├── home.js
│   │   ├── players-page.js
│   │   ├── register-page.js
│   │   ├── rules-page.js
│   │   ├── tournament-page.js
│   │   └── tournaments-page.js
│   ├── shared/
│   │   ├── data.js                 # Data adapter and formatting helpers
│   │   ├── event-card.js           # Reusable tournament-card component
│   │   ├── motion.js               # Safe reveals and View Transition handling
│   │   ├── registration.js         # Validation and WhatsApp message builder
│   │   └── shell.js                # Shared header, drawer, footer, theme, and toast
│   └── theme-init.js
├── index.html
├── players.html
├── register.html
├── rules.html
├── tournament.html
└── tournaments.html
```

## Registration and confirmation flow

1. The player selects Solo Survival 01; Squad and TDM choices remain visible but disabled as Coming soon.
2. The three-step registration builder collects one Solo player.
3. The player reviews the in-game name, numeric Free Fire UID, age, ₹10 entry, ₹6 kill reward, ₹30 Booyah bonus, and eligibility confirmations.
4. Submitting the final step opens the configured WhatsApp match-group invite and attempts to copy a group-safe message.
5. The player joins the group and pastes only the reference, in-game name, and Free Fire UID.
6. Age and payment details are never included in the group message. The result panel provides **Send private details** for the organizer chat.
7. The organizer sends payment instructions privately and verifies the incoming transaction in the organizer-controlled account. A screenshot alone is not confirmation.
8. The organizer replies privately with the final registration state and assigned slot.
9. About two hours before the match, the organizer publishes only approved public game details in `data/players.js`.
10. Room ID and password are sent privately to confirmed players and are never committed here.

The generated browser reference helps identify a conversation; it is not a reservation, receipt, or payment confirmation.

## Edit tournaments

Events live in `data/tournaments.js`. Keep each `id` unique and stable because event links and roster records use it.

Dates use ISO 8601 with the India offset:

```js
matchAt: "2026-10-10T19:00:00+05:30"
```

Use:

- `type: "solo"` for one-player registration.
- `entryFee: 10`, `killReward: 6`, and `booyahBonus: 30` for the published Solo economy.
- `comingSoon: true` plus `registrationOpen: false` to keep a future format visible but non-registerable.
- `type: "squad"` for future four-player formats.
- A `mode` containing `TDM` or `Clash` for the TDM category.
- `registrationOpen: false` to close a previously open event manually.
- `spotsLeft: 0` to show that capacity is full.

The effective state also changes when the registration deadline or match time passes.

## Publish confirmed players

Add approved entries under the matching event ID in `data/players.js`, update `updatedAt`, and set `published: true`.

```js
"solo-survival-01": {
  published: true,
  updatedAt: "2026-10-04T17:00:00+05:30",
  entries: [
    {
      registrationId: "QW-SOLO01-0001",
      slot: 1,
      displayName: "Example Player",
      uid: "123456789",
      status: "Confirmed"
    }
  ]
}
```

Only publish in-game names and UIDs players agreed to display. Never publish ages, phone numbers, payment proof, payment addresses, identity documents, or room credentials.

## Local preview

ES modules require an HTTP preview instead of double-clicking the HTML files:

```powershell
Set-Location "C:\Users\jeevanzn\Downloads\tournamte site"
python -m http.server 4173
```

Open `http://localhost:4173`.

## UI and accessibility behavior

- Mobile-first match access: compact hero, live match summary, and the first actionable event near the opening viewport
- Native modal navigation with an accessible fallback, Escape handling, focus containment, and focus return
- Light and dark themes available on desktop and inside the mobile drawer; only the theme preference is stored locally
- Restrained state transitions, with spatial movement removed when reduced motion is requested
- Semantic progress elements for registration and lobby capacity
- Step-level form errors linked to the relevant field through `aria-describedby`
- Native rule disclosures, semantic scoring table, keyboard-visible focus, 44 px controls, and mobile roster records
- No autoplay carousel, decorative video, cursor spotlight, or scroll-hidden content; hero parallax is bounded to fine-pointer devices and disabled for reduced motion

The product and component references applied during the redesign are documented in [`docs/ui-references.md`](docs/ui-references.md).

## GitHub Pages

1. Push this folder to a public GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.

All page and asset links are relative, so project-subpath URLs such as `https://USERNAME.github.io/qw-tournaments/` work without a build step.

## Safety notes

- Never request an OTP, UPI PIN, card PIN, game password, or account password.
- Verify money in the organizer-controlled payment account instead of trusting screenshots.
- Rotate room credentials for every event and send them privately.
- The WhatsApp group invite is embedded in public JavaScript; rotate it if unwanted members or spam appear.
- Require appropriate guardian approval for under-18 entrants and review applicable local requirements before operating paid events.
- Keep evidence-based dispute deadlines and publish corrections consistently.
- This is an independent community tournament site. It is not affiliated with, endorsed, sponsored, or administered by Garena. Free Fire and related marks belong to their respective owners.

## Free Fire artwork

The public UI uses a responsive 2880×1020-source hero (`assets/free-fire-hero-960.jpg` on phones and `assets/free-fire-hero-1920.jpg` on larger displays) plus three event-specific images from Garena’s Free Fire media: `assets/free-fire-solo.jpg`, `assets/free-fire-squad.jpg`, and `assets/free-fire-clash.jpg`. They were resized proportionally and compressed without recoloring or compositing. Source URLs, ownership notes, and the pre-launch policy reminder are recorded in [`docs/image-credits.md`](docs/image-credits.md).

Phone-specific behavior uses the HD character scene as a cinematic hero backdrop, surfaces all three match cards immediately after the live summary, presents registration choices as a swipeable poster rail, centers deep-linked selections, and keeps form actions in normal document flow above the software keyboard. Intermittent signal glitches, scan sweeps, HUD marks, and the targeting reticle provide gaming energy while `prefers-reduced-motion` removes their movement.
