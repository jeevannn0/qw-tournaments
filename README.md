# QW Tournaments

A static, mobile-first Free Fire tournament website for solo Battle Royale, four-player squad Battle Royale, and squad Clash Squad/TDM events. Registration details are prepared in the browser and sent directly to the organizer through WhatsApp. There is no application server and no participant information is stored by the website.

## Important before launch

The repository starts in **demo mode**. Sample dates, fees, prizes, and one sample roster are visibly marked as demonstrations.

1. Edit `data/config.js` and review the WhatsApp number.
2. Edit every value in `data/tournaments.js`.
3. Remove the sample entries from `data/players.js`.
4. Set `demoMode: false` in `data/config.js` only when the events are real.
5. Test one solo and one squad WhatsApp message before sharing the site.
6. Publish exact cancellation, refund, prize, and eligibility terms before accepting payment.

## Project structure

```text
.
├── assets/
│   └── favicon.svg
├── data/
│   ├── config.js          # Brand, WhatsApp number, timezone, demo switch
│   ├── players.js         # Public confirmed-player roster
│   └── tournaments.js     # Event schedule, fees, prizes, and capacity
├── app.js                 # Rendering, form validation, WhatsApp messages
├── index.html             # Page structure and content
├── styles.css             # Responsive light/dark visual system
└── README.md
```

## Registration and confirmation flow

1. A player selects an event and completes the website form.
2. **Join through WhatsApp** opens a prepared private message to `+91 94494 49382`.
3. The player sends the message and then attaches the payment screenshot in WhatsApp after receiving the organizer's verified payment details.
4. The organizer checks the incoming transaction in the organizer-controlled account. A screenshot alone is not treated as payment confirmation.
5. The organizer replies with the registration ID and confirmation state.
6. About two hours before the match, the organizer adds only approved public roster details to `data/players.js`, sets `published: true`, and pushes the update.
7. Room ID and password are sent privately to confirmed players or captains. They are never committed to this repository.

## Update a tournament

Edit an object in `data/tournaments.js`. Dates use ISO 8601 with the India offset:

```js
matchAt: "2026-10-10T19:00:00+05:30"
```

Use `type: "solo"` for one-player registration or `type: "squad"` for exactly four players. Set `registrationOpen: false` to close the form for an event.

## Publish confirmed players

Edit the event with the same ID in `data/players.js`:

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

Only publish in-game names and UIDs that players agreed to display. Never publish ages, phone numbers, payment proof, payment addresses, legal identity documents, or room credentials.

## Local preview

From this folder, run:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages

1. Create a GitHub repository and push these files to its default branch.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch and `/ (root)`, then save.

Every push to the selected branch updates the public site. GitHub Pages is public, so keep private registration and payment records outside this folder.

## Safety and fair-play notes

- Never ask for an OTP, UPI PIN, card PIN, game password, or account password.
- Confirm transactions from the organizer-controlled payment account rather than from screenshots alone.
- Send lobby credentials privately and rotate them for every event.
- Require guardian approval for under-18 entrants and check applicable local rules before running paid events.
- Keep evidence-based dispute deadlines and publish results consistently.
- This is an independent community tournament site. It is not affiliated with, endorsed, sponsored, or administered by Garena. Free Fire and related marks belong to their respective owners.
