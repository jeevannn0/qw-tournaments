# Supabase setup for QW Tournaments

This guide connects the GitHub Pages frontend to Supabase Authentication, PostgreSQL, Row Level Security, and private Storage without requiring a paid plan or prepayment for the intended small launch.

## 1. Create the project

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a free organization and project.
3. Give the project a strong database password and store it privately. The website never needs this password.
4. Choose a region near the expected players if available.
5. Wait for project provisioning to finish.

## 2. Create the backend securely

1. Open **SQL Editor** in the Supabase project.
2. Select **New query**.
3. Copy the complete contents of the repository’s `supabase-schema.sql`.
4. Paste it into SQL Editor.
5. Click **Run**.
6. Confirm that the query completes successfully.

The script creates:

- `admin_users`
- `registrations`
- `public_players`
- Row Level Security policies
- A private `payment-proofs` bucket limited to 2 MB JPG/PNG/WebP files
- The `review_registration` function for atomic organizer decisions

Do not replace these policies with public development policies.

## 3. Enable anonymous player authentication

1. Open **Authentication → Providers**.
2. Find **Anonymous Sign-Ins**.
3. Enable anonymous sign-ins and save.

Players receive an anonymous authenticated UUID before the proof upload. They do not create passwords or profiles.

## 4. Create the organizer account

1. Open **Authentication → Users**.
2. Click **Add user**.
3. Choose **Create new user**.
4. Enter the organizer email and a strong unique password.
5. Enable automatic email confirmation if the dashboard asks.
6. Create the user.

Do not enable public account registration for the organizer dashboard.

## 5. Approve the organizer

Open **SQL Editor**, replace the example email, and run:

```sql
insert into public.admin_users (user_id, email)
select id, email
from auth.users
where lower(email) = lower('organizer@example.com')
on conflict (user_id) do update
set email = excluded.email,
    active = true;
```

The dashboard permits access only when the signed-in UUID has `active = true` in `admin_users`.

To revoke access later:

```sql
update public.admin_users
set active = false
where lower(email) = lower('organizer@example.com');
```

## 6. Connect the website

1. Open **Project Settings → Data API** or **API Settings**.
2. Copy the **Project URL**.
3. Copy the public **Publishable key**. Older projects may call this the `anon` public key.
4. Put only those two public values into `data/supabase-config.js`:

```js
window.QW_SUPABASE_CONFIG = Object.freeze({
  url: "https://PROJECT_REFERENCE.supabase.co",
  publishableKey: "PUBLIC_PUBLISHABLE_KEY"
});
```

Never put the `service_role` key, database password, or personal access token in the website or GitHub repository.

## 7. Configure website URLs

In **Authentication → URL Configuration**:

- Site URL: `https://jeevannn0.github.io/qw-tournaments/`
- Additional redirect URL: `http://127.0.0.1:4317/**`

The current organizer uses email/password, so no OAuth redirect is required, but these values keep Auth behavior aligned with the deployed and local sites.

## 8. Controlled launch check

Before accepting real payments:

1. Start the local site on port 4317.
2. Submit one complete test registration with a small approved image.
3. Confirm that missing fields, missing proof, invalid UTR, and images above 2 MB are blocked.
4. Confirm the private row appears in `registrations`.
5. Confirm the image appears in the private `payment-proofs` bucket.
6. Open `admin.html` and sign in with the approved organizer account.
7. Load the private screenshot.
8. Verify the transaction against the organizer-controlled receiving account.
9. Set payment to Verified, assign a slot, and confirm.
10. Open `players.html?tournament=solo-survival-01` and verify that only sanitized fields appear.
11. Remove confirmation and verify the public row disappears.
12. Delete the test registration and proof from the Supabase Dashboard.

## Operational guidance

- A screenshot is evidence, not payment confirmation.
- Compare the UTR against the receiving-account history and mark duplicates explicitly.
- Do not expose `registrations`, `admin_users`, or the payment bucket publicly.
- Do not publish age, phone, transaction reference, screenshot, notes, or Auth UUID.
- Delete payment proofs according to a written retention schedule.
- Free projects can pause after inactivity; check project status before announcing an event.
- Monitor database, storage, egress, and monthly active-user usage in the dashboard.

## Troubleshooting

- **Submit button disabled:** `data/supabase-config.js` still has empty or invalid values.
- **Anonymous sign-in error:** enable Anonymous Sign-Ins.
- **Row Level Security error:** run the complete `supabase-schema.sql` file.
- **Bucket not found:** rerun the schema and verify `payment-proofs` exists and is private.
- **Admin sign-in works but access is denied:** insert the Auth user into `admin_users` with `active = true`.
- **Screenshot upload fails:** verify JPG/PNG/WebP, maximum 2 MB, and Storage policies.
- **Confirmation fails:** payment must be Verified and the player number must be unique from 1 through 50 in the selected lobby.

The site pins `@supabase/supabase-js` 2.116.0 and loads its ESM build from jsDelivr. Supabase’s official client repository documents browser CDN use: [supabase-js](https://github.com/supabase/supabase-js).

Content was rephrased for compliance with licensing restrictions.

## UPI-only migration for an existing project

If `supabase-schema.sql` was run before the site changed to UPI-only payment, open SQL Editor and run `supabase-migrations/2026-10-05-upi-only.sql` once. It first refuses to proceed if a non-UPI registration exists, then changes the database constraint so `payment_method` can only be `upi`.

The registration page displays the public UPI ID from `data/config.js`. Keep that value synchronized with the written payment rules and independently verify ownership before accepting real payments.

## Organizer delete migration for an existing project

If `supabase-schema.sql` was run before the organizer Delete button was added, run `supabase-migrations/2026-10-05-admin-delete.sql` once in SQL Editor. The `delete_registration` function permits only active organizers and refuses to delete pending or confirmed registrations. The dashboard then removes the associated private Storage object. Cancel or reject an entry before deleting it permanently.

## Two-lobby migration

Before deploying the 6 October 2026 lobby release, run `supabase-migrations/2026-10-05-solo-lobbies.sql` once in SQL Editor. It requires the registration and public roster tables to be empty, adds the mandatory 7:30 PM and 9:00 PM IST lobby fields, changes player numbers to 1–50, and makes player-number uniqueness apply within each lobby.

## Duplicate UTR detection migration

Before using automatic duplicate-payment marking, run `supabase-migrations/2026-10-05-duplicate-utr.sql` once in SQL Editor. The trigger marks a new registration as duplicate when its normalized UTR already exists and marks matching non-confirmed registrations for review. Confirmed payments are not overwritten. The admin dashboard also calculates duplicate groups independently, so all matching records receive a visible warning and can be filtered.

## Booyah result publishing migration

For an existing Supabase project, run `supabase-migrations/2026-10-06-booyah-results.sql` once in SQL Editor before using the Admin **Booyah publisher**. It creates the sanitized `match_results` table, private `winner-images` bucket, public-read policies for published cards, and organizer-only publish/remove RPCs. Fresh projects should run the complete `supabase-schema.sql` instead.

An organizer selects a scheduled lobby and one of its confirmed public players, records verified kills and the prize, and uploads a JPG, PNG, or WebP image no larger than 2 MB. The database independently verifies that the selected player belongs to that lobby. Only the winner name, Free Fire UID, lobby, match time, kills, prize, image, and publication time can reach the public Booyah page. Registration, contact, and payment information remain private.

Replacing a winner card uploads the new image first and removes the previous image after the database update. Removing a card revokes public image access immediately, then deletes its Storage object. If Storage cleanup reports an error, remove the orphan manually from the private `winner-images` bucket.

## PDF reconciliation

The protected admin dashboard provides **Export filtered PDF** and **Export all PDF**. Each opens the browser print dialog; choose **Save as PDF**. Reports include lobby, player/UID, private WhatsApp number, UTR, claimed amount, payment state, registration state, player number, and reference. Payment screenshots are deliberately excluded. Treat the resulting PDF as private financial-review data and delete it when reconciliation is complete.

## Match registration control migration

For an existing project, apply migrations in filename order. Run `supabase-migrations/2026-10-07-match-card-overrides.sql` first, then run `supabase-migrations/2026-10-08-registration-open.sql`. Fresh projects can run the complete `supabase-schema.sql` instead.

The organizer console’s **Match cards** tab now controls three states for Solo Survival, Squad Last Circle, and Clash Squad Cup:

- **Coming soon** hides unpublished schedule, fee, and reward terms.
- **Scheduled — registration closed** publishes a future IST match time, fee, reward summary, and planned capacity without accepting entries.
- **Registration open** publishes one server-validated lobby and accepts a complete player or four-player squad registration until the match starts. It requires a future match time, ₹1–₹100,000 entry fee, reward summary, and capacity from 1–500 players or teams.

At match time, Scheduled and Registration open both change to **Completed** for three hours and then display **Coming soon**. Registration open is server-authoritative: the submission RPC derives the tournament name, lobby ID/time, fee, capacity, and registration cycle from the organizer-controlled row, verifies the private proof upload, locks capacity during submission, and rejects reused active player UIDs.

Each new schedule/fee/capacity configuration receives a registration cycle so old registrations and rosters remain attached to their historical lobby. While registration remains open, those protected values cannot change; selecting Scheduled or Coming soon closes registration and can establish the next cycle safely. Existing Solo schema-v1 registrations remain readable and reviewable; new registrations use schema version 2 and store either one Solo player or a complete four-player squad. Public confirmed rows contain only safe lineup names and UIDs.

Every save keeps optimistic version checking and organizer-only revision history. Public reads receive sanitized match configuration only—not audit notes or organizer IDs. If Supabase is offline or the new migration has not been applied, public pages fall back safely and cannot submit a dynamic registration.

## Custom Room email access

After `2026-10-08-registration-open.sql`, apply `supabase-migrations/2026-10-09-custom-room-details.sql` to existing projects. New registrations require a private email. In the organizer **Match cards** tab, the separate **Custom Room details** card lists future matches with Registration open and stores one Room ID/password for the current registration cycle.

Every match-details page always shows **Custom Room details**. Before credentials are published it asks the player to wait. After publication, it returns credentials only when the entered normalized email matches a payment-verified, organizer-confirmed schema-v2 registration for that exact tournament and current cycle. Historical registrations created before this migration have no email mapping and cannot use email lookup. Room credentials and email mappings live in a locked private schema and are never granted as client-readable tables.

This is intentionally email-only access, not proof of email ownership. Anyone who knows a confirmed entrant’s email could retrieve the credentials, so rotate the room password if it leaks and never display registered emails publicly.

### Clearing Custom Room details

Apply `supabase-migrations/2026-10-10-clear-custom-room.sql` after the Custom Room migration. The organizer Custom Room tab then provides **Clear Room details** for a published current-cycle room. Clearing removes both secrets immediately, makes the public readiness check false, and returns players to the waiting message. The organizer can publish replacement details later.

## Lifecycle reconciliation

After the Custom Room clear migration, apply `supabase-migrations/2026-10-11-lifecycle-reconciliation.sql`. It makes room access expire when registration closes or the match starts, keeps closed current-cycle credentials clearable by organizers, adds optimistic registration-review locking, reconciles duplicate UTR status after deletion, supports dynamic winner publication for all three formats, restricts public rosters to the current cycle, publishes accurate occupancy, and retires stale RPC access. Payment verification still exposes archived cycles explicitly for organizer review while defaulting to the current match.