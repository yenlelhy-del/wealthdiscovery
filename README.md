# FinPeace Wealth Discovery

Form KYC trước buổi Strategic Financial Coaching cho khách hàng high-earner.

**Status:** Source code uploaded; **not deployed to finpeace.cloud**. The exact FinPeace logo PNG still needs to be uploaded as `public/finpeace-logo.png`. Do not substitute a regenerated logo.

## Code

- `public/index.html` — responsive 3-step Vietnamese questionnaire
- `server.js` — Node.js backend, private JSON submissions
- `package.json` — npm start
- `deploy/finpeace-wealth-discovery.service` — systemd example
- `deploy/nginx-location.conf` — Nginx route example
- `.gitignore` — exclude secrets and data

## Before accepting real customer data

1. Verify privacy policy URL and specific lawful consent basis.
2. Use separate `finpeace-kyc` Linux service user and directory `/var/lib/finpeace-wealth-discovery` with owner-only mode 0700.
3. Confirm backups, retention/deletion process, access controls, abuse prevention and monitoring.
4. Inspect how drafts are saved in browser localStorage, which may be unsuitable for shared devices.
5. Test with synthetic data, not real financial information.
6. Consider making this repository **Private** (Settings → General → Danger Zone → Change repository visibility). Never commit KYC submissions, credentials, SSH keys or server backups.

## VPS preview (not yet public)

Once the exact logo is uploaded and app reviewed, clone from GitHub on the VPS and test on port 3101. Use SSH to run the following, adjusting service account permissions:

```bash
cd /opt
git clone https://github.com/yenlelhy-del/wealthdiscovery.git finpeace-wealth-discovery
# Create non-login service user + data directory, follow least-privilege permissions.
# node server.js; test localhost health; then configure systemd.
```

For Nginx, do **not** replace the existing finpeace.cloud configuration: integrate the two `location` stanzas from `deploy/nginx-location.conf` into the current HTTPS server block only after application health passes. First back up config, run `nginx -t`, then reload. These steps must be performed carefully on the current server.

**Note:** This prototype uses local JSON files (not an encrypted database), lacks a coach dashboard and should be security-reviewed before production.
