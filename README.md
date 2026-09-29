# QW Tournaments

A dependency-free, multi-page Free Fire tournament website for solo Battle Royale, four-player squad Battle Royale, and squad Clash Squad/TDM events. It runs on static hosting such as GitHub Pages—no application server or database is required.

Registration details are prepared only in the player's browser and handed to the organizer through WhatsApp. The organizer verifies payments and confirmations manually.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Focused homepage, featured event, upcoming-event preview, and joining flow |
| `tournaments.html` | Searchable/filterable tournament board |
| `tournament.html?tournament=<id>` | Dedicated schedule, prize, format, availability, and ruleset view |
| `register.html?tournament=<id>` | Three-step solo or exactly-four-player registration builder |
| `players.html?tournament=<id>` | Searchable public confirmed-player roster |
| `rules.html` | Eligibility, fair play, check-in, scoring, dispute, payment, and privacy rules |

## Important before launch

The repository starts in **demo mode**. Sample dates, entry fees, prizes, and one sample roster are clearly marked.

1. Review the WhatsApp number in `data/config.js`.
2. Replace every sample event value in `data/tournaments.js`.
3. Remove the sample entries from `data/players.js`.
4. Test both solo and squad registration journeys.
5. Set `demoMode: false` in `data/config.js` only when the events are real.
6. Publish exact prize, cancellation, refund, eligibility, and check-in terms before accepting payment.

## Project structure

```text
.
├── assets/
│   └── favicon.svg
├── data/
│   ├── config.js                  # Brand, WhatsApp, timezone, and demo switch
│   ├── players.js                 # Manually maintained public rosters
│   └── tournaments.js             # Event details, schedules, prizes, and slots
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
├── tournaments.html
└── styles.css
```

## Registration and confirmation flow

1. The player chooses an open tournament.
2. The three-step registration builder collects one solo player or exactly four squad players.
3. The player reviews names, numeric Free Fire UIDs, ages, event fee, and eligibility confirmations.
4. **Open WhatsApp** prepares a private message to `+91 94494 49382`.
5. The player sends that message, receives verified payment instructions, and manually attaches payment proof in WhatsApp.
6. The organizer verifies the incoming transaction in the organizer-controlled account. A screenshot alone is not confirmation.
7. The organizer replies with the final registration state and assigned slot.
8. About two hours before the match, the organizer publishes only approved public game details in `data/players.js`.
9. Room ID and password are sent privately to confirmed players or captains and are never committed here.

The generated browser reference helps identify a conversation; it is not a reservation, receipt, or payment confirmation.

## Edit tournaments

Events live in `data/tournaments.js`. Keep each `id` unique and stable because event links and roster records use it.

Dates use ISO 8601 with the India offset:

```js
matchAt: "2026-10-10T19:00:00+05:30"
```

Use:

- `type: "solo"` for one-player registration.
- `type: "squad"` for exactly four players.
- A `mode` containing `TDM` or `Clash` for the TDM category.
- `registrationOpen: false` to close an event manually.
- `spotsLeft: 0` to show that capacity is full.

The effective state also changes when the registration deadline or match time passes.

## Publish confirmed players

Add approved entries under the matching event ID in `data/players.js`, update `updatedAt`, and set `published: true`.

```js
"squad-last-circle-01": {
  published: true,
  updatedAt: "2026-10-10T17:00:00+05:30",
  entries: [
    {
      registrationId: "QW-BR01-0001",
      slot: 1,
      teamName: "Example Squad",
      status: "Confirmed",
      players: [
        { displayName: "Player One", uid: "123456789" },
        { displayName: "Player Two", uid: "223456789" },
        { displayName: "Player Three", uid: "323456789" },
        { displayName: "Player Four", uid: "423456789" }
      ]
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

- Shared desktop navigation and a native modal mobile drawer
- Light and dark themes saved locally without storing player information
- Same-origin page transitions where supported, with ordinary navigation as fallback
- One-time Intersection Observer reveals; content remains visible without enhancement
- Reduced-motion support that removes spatial animation
- Native disclosures for rules and native radio controls for tournament filters
- Visible keyboard focus, touch-sized controls, semantic headings, and mobile table-to-card conversion
- No autoplay carousel, endless ticker, or decorative video

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
- Require appropriate guardian approval for under-18 entrants and review applicable local requirements before operating paid events.
- Keep evidence-based dispute deadlines and publish corrections consistently.
- This is an independent community tournament site. It is not affiliated with, endorsed, sponsored, or administered by Garena. Free Fire and related marks belong to their respective owners.

## Gaming artwork

The combat skin is isolated in `gaming.css`, layered after the structural `styles.css`. The Home route uses original `assets/battle-arena.svg` artwork; tournament cards, event detail, registration match cards, route headers, and the combat gallery use eight optimized official Free Fire wallpapers. All source URLs and ownership notes are recorded in [`docs/image-credits.md`](docs/image-credits.md). Visible image credits also link to Garena’s official wallpaper library.

Phone-specific behavior keeps the Home hero inside one viewport, turns the registration battle picker into a swipeable poster rail, centers a deep-linked selection, removes redundant copy, and starts the registration panel near the top of the first screen.
