# FinPeace KYC Customer Receipt — staging

This feature emails a receipt when a customer submits the **Wealth Discovery** questionnaire and opts in to a receipt. It does **not** include quantitative financial answers (income/net worth/savings).

## Delivery model
- KYC JSON is saved **before** email is attempted.
- On success, UI reports receipt sent.
- On SMTP failure or missing configuration, UI says KYC saved but receipt not sent (no false success).
- Email data is taken from the validated KYC submission only.
- No SMS, bulk mailing or marketing subscription. Transactional confirmation only.

## SMTP prerequisites
Use an existing trusted SMTP mailbox/provider. Resend and new DNS are **not** required if you already have working SMTP credentials.

Keep these variables **on VPS only** in the root-owned mode 0600 file `/etc/finpeace-wealth-discovery/admin.env` (or an additional protected systemd EnvironmentFile):

```dotenv
KYC_SMTP_HOST=smtp.provider.example
KYC_SMTP_PORT=465
KYC_SMTP_USER=your-outgoing-mail-account@example.com
KYC_SMTP_PASS=REPLACE_WITH_APP_PASSWORD
KYC_MAIL_FROM="FinPeace <your-outgoing-mail-account@example.com>"
```

Do not fill placeholders literally; use actual SMTP details supplied by your email provider. For port 465 the connection uses implicit TLS; other ports use STARTTLS when supported. Do not deploy or enable receipts before confirming SPF/DKIM and delivery.

## Deployment notes
This branch is for review/testing, not production. Existing finpeace.cloud KYC and Dashboard must remain intact.
- Run `npm install --omit=dev` in staging, not in active production before approval.
- Run `node --test test/dashboard.test.js test/receipt.test.js` and independently test actual SMTP delivery with synthetic KYC.
- Back up current code and unit, deploy with rollback.
- Keep SMTP keys out of GitHub and screenshots.
- Data retention, privacy notice, mailbox choice and email opt-in text should be reviewed before collecting real KYC.

## User message
The customer email contains: receipt ID, selected professional/life stage context, priorities, goals, concerns, expectations, and preparation note. It excludes income/net worth numeric bands and any freeform notes. No financial advice.
