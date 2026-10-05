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
- **Confirmation fails:** payment must be Verified and the slot must be unique from 1 through 48.

The site pins `@supabase/supabase-js` 2.116.0 and loads its ESM build from jsDelivr. Supabase’s official client repository documents browser CDN use: [supabase-js](https://github.com/supabase/supabase-js).

Content was rephrased for compliance with licensing restrictions.

## UPI-only migration for an existing project

If `supabase-schema.sql` was run before the site changed to UPI-only payment, open SQL Editor and run `supabase-migrations/2026-10-05-upi-only.sql` once. It first refuses to proceed if a non-UPI registration exists, then changes the database constraint so `payment_method` can only be `upi`.

The registration page displays the public UPI ID from `data/config.js`. Keep that value synchronized with the written payment rules and independently verify ownership before accepting real payments.

## Organizer delete migration for an existing project

If `supabase-schema.sql` was run before the organizer Delete button was added, run `supabase-migrations/2026-10-05-admin-delete.sql` once in SQL Editor. The `delete_registration` function permits only active organizers and refuses to delete pending or confirmed registrations. The dashboard then removes the associated private Storage object. Cancel or reject an entry before deleting it permanently.

## Two-lobby migration

Before deploying the 6 October 2026 lobby release, run `supabase-migrations/2026-10-05-solo-lobbies.sql` once in SQL Editor. It requires the registration and public roster tables to be empty, adds the mandatory 7:30 PM and 9:00 PM IST lobby fields, changes player numbers to 1–50, and makes player-number uniqueness apply within each lobby.
