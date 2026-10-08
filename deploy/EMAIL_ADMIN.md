# FinPeace Admin — Email Sign-in V2 (staging)

**Single Admin account:** `yenle.lhy@gmail.com`.
**Git branch:** `feature/email-admin-auth`.
**Do not deploy this branch to the production VPS until all CI checks pass and the mail provider is verified.**

## Changes
- Email replaces the old `admin` username.
- Login page has **Thiết lập / Quên mật khẩu**.
- Admin requests a 30-minute one-time link by email.
- The link opens `/wealth-discovery/admin/?action=reset&token=...`.
- The link allows setting a password (16–128 characters) for first-time setup or resetting it later.
- Reset tokens are stored as SHA-256 hashes, never plaintext, and are deleted on use.
- Password hashes use scrypt with per-password random salt.
- Changing a password invalidates prior cookies.
- Existing KYC JSON records are unchanged.
- No raw password or API token is committed to GitHub.

## Email delivery
Email is delivered via [Resend](https://resend.com) HTTPS API (no Python/getpass/Terminal password entry). It requires:
1. A verified sender domain (e.g. `finpeace.cloud`) with DNS records configured with Resend.
2. A Resend API key with sending permission.
3. An approved sender address such as `FinPeace <no-reply@finpeace.cloud>`. Do not assume that email address exists until domain verification.

Set **only on the VPS**, inside `/etc/finpeace-wealth-discovery/admin.env` (root-owned 0600):

```dotenv
ADMIN_SESSION_SECRET=<retain-existing-secret>
RESEND_API_KEY=<real-provider-api-key>
MAIL_FROM="FinPeace <no-reply@finpeace.cloud>"
```

The email address `yenle.lhy@gmail.com` is hard-coded as the only authorized recipient and login identifier in `email-auth.js`. This is intentional for Single Admin V1.

Do not remove the existing `ADMIN_SESSION_SECRET` or any other environment entries until a rollback plan is approved. The legacy password-related entries are ignored by the new branch.

The systemd unit already has:
```ini
EnvironmentFile=-/etc/finpeace-wealth-discovery/admin.env
```
After updating VPS env, systemd must restart `finpeace-wealth-discovery` to read it. This briefly interrupts the KYC form; plan appropriately.

## First time / reset user experience
1. Open `https://finpeace.cloud/wealth-discovery/admin/`.
2. Click **Thiết lập / Quên mật khẩu**.
3. Enter the Admin Gmail address; click **Gửi liên kết bảo mật**.
4. Follow the email link, choose your password, and sign in using the Gmail address.

For privacy, the same generic response is shown even for an unknown email. If no email arrives, troubleshoot the mail provider configuration/logs without sharing secrets.

## Before live launch
- Verify email delivery, token expiry, single-use, rate limiting, session revocation, and existing KYC list/notes in staging.
- Protect the Administrator URL with further safeguards such as MFA, restricted network access, and IP-based edge throttling.
- Review localStorage KYC drafts, privacy notice, personal data retention, backups and access logs.
- Existing deploy uses in-memory rate limiting which is coarse behind Nginx; configure Nginx edge rate limiting.
- Do not store the reset token in access logs, GitHub, or screenshots. Avoid pasting any reset link into chat.
- Keep backup/rollback of current production code and service file.

## Automated checks
```bash
node --check server.js
node --check admin.js
node --check email-auth.js
node --test test/dashboard.test.js
```
The test replaces real mail with a local fake provider and uses only synthetic data.
