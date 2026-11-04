# ClinicCare — WhatsApp medicine reminder SaaS

Careloop is an early multi-clinic dashboard. Patient and medication schedules are stored in PostgreSQL, and the backend can send WhatsApp Cloud API reminders and record quick-reply responses when a clinic has configured a valid account, an approved template, and patient consent. Appointments, reports, follow-ups, and several dashboard figures are still preview content.

## Structure

```text
backend/
  app/                 FastAPI app, config, database, models, auth and routes
  alembic/             Database migrations
  requirements.txt
  .env.example
frontend/
  src/                 React dashboard shell
  package.json
  .env.example
docker-compose.yml
render.yaml
```

## Local setup

Requirements: Python 3.11+, Node.js 20+, npm, and Docker with Compose.

If you use **Command Prompt** (`C:\>`), use `copy` and `call` rather than the PowerShell `Copy-Item` and activation commands shown below. Python 3.11 is not required; use your installed Python with `python -m venv .venv`.

### Command Prompt commands

Install and start Docker Desktop first, then open a new Command Prompt in the project directory:

```bat
docker compose up -d db
cd backend
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
copy .env.example .env
```

Open `backend\.env` in Notepad and replace `JWT_SECRET` with a random value of at least 32 characters. Then, in that same terminal:

```bat
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

In a second Command Prompt, starting from the project directory:

```bat
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`. API docs are at `http://localhost:8000/docs`.

To preview only the dashboard while Docker/PostgreSQL is unavailable, run just the frontend commands above. The dashboard currently displays sample UI values and does not need the API to render.

1. Start PostgreSQL: `docker compose up -d db`
2. In PowerShell, set up and run the backend:

   ```powershell
   cd backend
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   Copy-Item .env.example .env
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

   Edit `backend\.env` first if you changed the Compose database settings; set `JWT_SECRET` to a random value of at least 32 bytes.
3. In a second terminal, set up the frontend:

   ```powershell
   cd frontend
   npm install
   Copy-Item .env.example .env
   npm run dev
   ```

4. Visit `http://localhost:5173` for the dashboard and `http://localhost:8000/docs` for the API.

Create the first platform administrator from the backend folder after running the database migrations:

```powershell
python -m app.bootstrap_admin --name "Platform Admin" --email "admin@example.com"
```

Enter a password of at least 12 characters when prompted. Sign in at the frontend with this account, then use **Add a clinic** to create a clinic workspace and its clinic administrator account. Give the clinic administrator the email and password securely. Clinic accounts sign in on the same page and enter their clinic workspace. Platform administrators can list clinics and suspend or reactivate clinic accounts; suspended clinic users cannot sign in. Public clinic registration is disabled.

Login is `POST /api/auth/login` using form fields `username` (email) and `password`; authenticated APIs accept the returned bearer token. `POST /api/auth/refresh` rotates the refresh token; logout revokes its token family. Platform clinic management is available through `GET` and `POST /api/admin/clinics` and `PATCH /api/admin/clinics/{clinic_id}?status=active|trial|suspended` (platform-admin role required).

## Foundation API

- `GET /health`
- `GET /api/medicines/search?q=am&limit=10` (searches the local CSV and returns medicine names only)
- `POST /api/auth/login`, `/refresh`, `/logout`; `GET /api/auth/me`
- `GET`, `POST /api/admin/clinics`; `PATCH /api/admin/clinics/{clinic_id}` (platform-admin only)
- `GET /api/clinic/me`
- `GET /api/patients` (tenant-scoped starter endpoint)

All patient and clinic queries are scoped using the authenticated user's clinic ID. The SaaS admin role is platform-level; patient access is deliberately not granted to it by default. Configure an initial platform admin through the database/operations process rather than a public registration option.

## Configuration

Backend settings are documented in `backend/.env.example`; frontend only receives the API base URL. Never put Meta credentials in frontend configuration. Per-clinic WhatsApp token storage and manual Cloud API connection are described below. Embedded Signup and token lifecycle automation are not implemented. No real access tokens or patient data belong in this repository.

## WhatsApp Cloud API (manual clinic connection)

The clinic **WhatsApp settings** page can connect one Cloud API phone number per clinic and send Meta's `hello_world` test template. In Meta's developer dashboard, create an app with the WhatsApp product and add a test phone number first. The token needs the `whatsapp_business_messaging` permission. Add the test recipient to Meta's allowed recipients before sending. The Cloud API sends through `/{Phone-Number-ID}/messages`; see [Meta's official WhatsApp Cloud API Postman collection](https://www.postman.com/meta/whatsapp-business-platform/overview).

Install the backend requirements, then create an encryption key in the backend folder:

```powershell
python -m pip install -r requirements.txt
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Put that generated value in `backend/.env` as `WHATSAPP_TOKEN_ENCRYPTION_KEY`. Set `WHATSAPP_API_VERSION` to a currently supported Graph API version. Keep the key stable and backed up: changing or losing it makes saved clinic tokens unreadable. Run the database migration with `python -m alembic upgrade head`, then sign in as the clinic administrator, open **WhatsApp settings**, and enter that clinic's WABA ID, phone number ID, and access token. Tokens are encrypted before storage and are never returned by the API.

Create and get Meta approval for a Utility message template named `medication_reminder` in `en_US` (or set `WHATSAPP_REMINDER_TEMPLATE_NAME` and `WHATSAPP_TEMPLATE_LANGUAGE` to match your approved template). Its body must have three text placeholders in this order: patient name, medicine name, and scheduled time. Add two Quick Reply buttons titled `Taken` and `Not taken`. Meta supports approved interactive templates with quick replies in notification messages; the app includes each reminder ID in the button payload so replies can be matched to the correct schedule. [Meta's interactive template docs](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive) [Meta's quick reply callback docs](https://www.postman.com/meta/whatsapp-business-platform/request/5qal58f/received-callback-from-a-quick-reply-button-click)

Clinic staff enter exact reminder times on the patient medication form. The scheduler uses the clinic's configured timezone and sends only when WhatsApp is connected and the patient's consent checkbox is recorded. Patient create/update and reminder reply status are stored in PostgreSQL. The in-process scheduler is for local development; use a single dedicated worker or a durable job queue before running multiple API workers.

Webhook verification is available at `/api/webhooks/whatsapp`. To receive Meta callbacks, expose the backend over public HTTPS, set `META_APP_SECRET` and a random `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `backend/.env`, configure that callback URL and verify token in the Meta app, then subscribe the WABA to `messages`. The webhook validates Meta signatures and records delivery status plus `Taken`/`Not taken` quick replies. It does not store free-text message content.

This manual connection is useful for initial testing. It does not implement Embedded Signup or automatic token renewal. For a multi-clinic production service, onboard each clinic through Meta Embedded Signup and use the appropriate long-lived/system-user token lifecycle rather than sharing one access token between clinics. Meta's official collection notes that dashboard user tokens expire after 24 hours and describes system-user tokens as the longer-lived option.

## Current scope and next phases

This is an early foundation: FastAPI, SQLAlchemy models, Alembic migrations, password auth with short-lived access tokens and rotating/revocable refresh tokens, tenant-scoped endpoints, patient and medication schedule create/update, manual per-clinic WhatsApp Cloud API connection, scheduled reminder sends, and reply status callbacks. It does not yet implement Embedded Signup/token renewal, durable production scheduling, medication/appointment management beyond these starter screens, billing, production deployment hardening, or the Phase 15 automated test suite. Those should be completed phase-by-phase before handling real patient data.

Use HTTPS, managed secret storage, encrypted backups, monitoring, and a reviewed retention/deletion plan before production. Applicable Indian data protection and healthcare obligations require qualified review; this project makes no compliance claim. Meta messaging charges depend on current Meta pricing, template category, country, and delivery rules; confirm current fees in Meta's official WhatsApp documentation before launch. Infrastructure costs (database, compute, storage, monitoring, domain) are separate from SaaS fees and Meta charges.

## Render preview deployment

The root `render.yaml` defines a free Render preview with a FastAPI web service, PostgreSQL database, and React static site. The frontend proxies `/api/*` requests to the backend and rewrites other routes to `index.html`; the backend upgrades the database schema when it starts. The API stays at one instance because its reminder scheduler currently runs inside the API process.

Connect this repository to Render as a Blueprint and deploy `render.yaml`; the app can start before you add Meta webhook credentials. Later, add `META_APP_SECRET` in the backend service's **Environment** page from the Meta app's **App settings → Basic → App secret**. Copy the generated `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from that page into Meta's webhook setup. Set Meta's callback URL to `https://careloop-api.onrender.com/api/webhooks/whatsapp`, subscribe to `messages`, and create the approved `medication_reminder` template. The Meta webhook must use the same WhatsApp account and phone number connected in the clinic workspace. Render generates the JWT and WhatsApp token-encryption keys; keep both stable, especially the encryption key after connecting a WhatsApp token.

This free Blueprint is for a synthetic-data demo only. Render's free web services spin down when idle, so the in-process reminder scheduler cannot reliably send time-sensitive reminders; free PostgreSQL databases expire after 30 days. Render also says not to process or store PHI outside a HIPAA-enabled workspace. This app stores patient names, phone numbers, and medication schedules, so use only synthetic patients on the free preview. Review Render's [free plan limits](https://render.com/docs/free) and [HIPAA requirements](https://render.com/docs/hipaa-compliance) before choosing production hosting. A production deployment also needs an always-on reminder worker or durable queue, backups, monitoring, and a reviewed privacy/retention plan.
"# careeloop" 
