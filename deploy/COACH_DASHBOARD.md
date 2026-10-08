# Coach Dashboard V1 — Staging deployment guide

**Branch:** `feature/coach-dashboard`. Do not merge into `main` or deploy to the production VPS until review and tests pass.

## Features
- Single Admin login, HttpOnly/Secure/SameSite=Strict 8-hour session cookie.
- Protected list/detail endpoints and CSRF-protected coaching notes, with statuses New / Reviewed / Scheduled / Completed.
- KYC originals stay in `/var/lib/finpeace-wealth-discovery`; notes are saved to `admin-notes/` in the same private directory.
- Admin is disabled until credentials are configured on the server.
- No CRM export and no multi-user coach permissions in V1.

## Create credentials securely on VPS
Use SSH as root. **Never paste your password or generated credentials into chat or GitHub.** This script interactively asks for the password *without echoing it*, writes a root-owned file, and does not print secrets.

```bash
install -d -m 700 /etc/finpeace-wealth-discovery
node - <<'NODE'
const fs=require('fs'),crypto=require('crypto');
const tty=fs.openSync('/dev/tty','r+');
function ask(label,hidden){process.stdout.write(label);const orig=require('child_process');if(hidden)orig.execFileSync('stty',['-echo'],{stdio:['inherit','ignore','inherit']});const buf=Buffer.alloc(256);let text='';try{while(true){const n=fs.readSync(tty,buf,0,1,null);if(!n||buf[0]===10)break;text+=buf.toString('utf8',0,n);}}finally{if(hidden){orig.execFileSync('stty',['echo'],{stdio:['inherit','ignore','inherit']});process.stdout.write('\n');}}return text.trim();}
const user=ask('Admin username: ',false),pass=ask('Admin password (min 16 characters): ',true);
if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(user)||pass.length<16)throw Error('Invalid username or weak password; no file written.');
const salt=crypto.randomBytes(16),hash=crypto.scryptSync(pass,salt,64).toString('hex');
const secret=crypto.randomBytes(48).toString('hex');
const content='ADMIN_USERNAME='+user+'\nADMIN_PASSWORD_SCRYPT=scrypt:'+salt.toString('hex')+':'+hash+'\nADMIN_SESSION_SECRET='+secret+'\n';
fs.writeFileSync('/etc/finpeace-wealth-discovery/admin.env',content,{mode:0o600,flag:'wx'});fs.closeSync(tty);console.log('Admin config created with permissions 0600.');
NODE
```

If `admin.env` already exists, the script refuses to overwrite it. Back up securely before rotating credentials.

## Local tests before production

```bash
git switch feature/coach-dashboard
node --check admin.js
node --check server.js
node --test test/dashboard.test.js
```

## On the VPS
Current running application: `/opt/finpeace-wealth-discovery/app` on branch `main`. Do not switch that checkout to the feature branch directly because it can disrupt live traffic.

For production after approval: back up working code and service file, merge PR into main, pull on VPS, copy updated service file into `/etc/systemd/system/`, `systemctl daemon-reload`, then restart only `finpeace-wealth-discovery`. Validate existing customer form and new Admin access with synthetic records.

New Admin URL (after deployment): `https://finpeace.cloud/wealth-discovery/admin/`.

## Security limitations / pre-go-live checklist
- Repository is currently Public; consider switching to Private. Do not commit credentials, actual KYC data or backups.
- Configure a real privacy policy, retention/deletion, encrypted backups, audit logging, stronger cross-node abuse controls and administrative MFA/reverse-proxy access controls before processing sensitive production records.
- Current KYC API rate limiter tracks loopback IP behind Nginx; it is not sufficient per-client throttling. Use Nginx edge limits and additional validated client-IP handling.
- The form currently saves drafts in localStorage; shared devices pose a privacy risk.
- Single Admin access only; no coach-specific authorization in this version.
