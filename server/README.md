# InnoTech'26 API

FastAPI backend for the student portal (`client/`) and the admin panel (`admin-panel/`).
PostgreSQL (Amazon RDS) for data, Amazon Cognito with Google for sign-in, Amazon SES for emails.

## Run it locally

Needs Python 3.12 and a local PostgreSQL.

```bash
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
createdb innotech_dev && createdb innotech_test
cp .env.development.example .env          # local settings, never used in production
.venv/bin/alembic upgrade head            # create the tables
.venv/bin/python -m app.dev_seed          # optional: demo students, a team and demo admins
.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000, docs at /docs
```

Tests run against the `innotech_test` database (override with `TEST_DATABASE_URL`):

```bash
.venv/bin/python -m pytest
.venv/bin/ruff check app tests && .venv/bin/ruff format --check app tests
```

### Frontends against the local API

Without Cognito, both frontends can sign in with development tokens from `POST /dev/token`. That
endpoint exists only when `ENVIRONMENT=development` and `DEV_JWT_SECRET` is set. Create a
`.env.local` in `client/` (and in `admin-panel/`):

```
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DEV_SIGN_IN=true
NEXT_PUBLIC_FORCE_REGISTRATION_OPEN=true   # client only, while testing before 3 October
```

The demo accounts on each login page match `app/dev_seed.py`; `superadmin@kiet.edu` is the super
admin from `SUPER_ADMIN_EMAILS` in `.env.development.example`.

## Deploying

Every setting is an environment variable; `.env.example` lists them with production values. The app
**refuses to start** in production if `DEV_JWT_SECRET` or `FORCE_REGISTRATION_OPEN` is set, if the
Cognito settings are missing, or if `CORS_ORIGINS` contains `*`.

1. Build the image: `docker build -t innotech-api .` (runs as a non-root user; health check on `/health`).
2. Run migrations before each release: `docker run --env-file prod.env innotech-api alembic upgrade head`.
3. Run the container behind the load balancer on port 8000. Point the load balancer health check at `GET /health`
   (it also checks the database).
4. Build the frontends with `NEXT_PUBLIC_API_MODE=live`, `NEXT_PUBLIC_API_URL` and their `NEXT_PUBLIC_COGNITO_*`
   variables (see each app's `.env.example`). Do **not** set `NEXT_PUBLIC_DEV_SIGN_IN` or
   `NEXT_PUBLIC_FORCE_REGISTRATION_OPEN` in production builds.

### Cognito checklist

The API trusts the email in the Cognito ID token, so this configuration is what keeps a stranger from
registering as a KIET student.

- Google must be the identity provider. Keep `REQUIRE_GOOGLE_IDENTITY=true`: tokens of username/password users
  in the pool are rejected even if someone enables self sign-up.
- Map Google's `email_verified` attribute to the Cognito `email_verified` attribute (and `email`, `name`).
  With `REQUIRE_EMAIL_VERIFIED=true` (the default) tokens without a verified email are rejected.
- App clients: public clients (no secret), authorization code grant with PKCE, scopes `openid email profile`.
  Callback URLs: `https://<portal>/auth/callback` and `https://<admin panel>/auth/callback`. Put both client IDs in
  `COGNITO_CLIENT_IDS`.
- The API accepts only **ID tokens** (`token_use=id`) from the configured pool and clients, and fetches Cognito's
  signing keys from the pool's JWKS URL (outbound HTTPS to `cognito-idp.<region>.amazonaws.com` is required).

### Other AWS pieces

- **RDS**: PostgreSQL 14 or newer; use `sslmode=require` in `DATABASE_URL`. Each worker keeps up to 20 connections.
- **SES**: `EMAIL_BACKEND=ses`, a verified sender identity, and an IAM role for the container allowing
  `ses:SendEmail`. Emails are sent after the request commits; a failed email is logged and never fails the action.
- **Rate limiting**: the API limits invitations per team per day. Put an AWS WAF rate-based rule on the load balancer
  or API Gateway for general request flooding.
- **Admins**: people in `SUPER_ADMIN_EMAILS` are always super admins and add department admins in the admin panel.

## How it works

```
app/
  main.py          app setup: CORS, security headers, error format, routers, /health
  config.py        settings from environment variables, with production safety checks
  auth.py          Cognito ID token verification, current student / admin
  rules.py         registration rules (mirrors client/lib/rules.ts)
  models.py        tables and constraints
  schemas.py       request validation and response shapes
  services/        students.py (profile, teams, invitations), admin.py, serializers, audit
  routers/         students.py, admin.py, dev.py (development only)
  emails.py        SES notifications
migrations/        Alembic
tests/             pytest, against PostgreSQL
```

Errors always return `{"detail": "<message for the user>"}`: 401 not signed in, 403 not allowed or registration
closed, 404 not found (also for other people's teams), 409 conflict (e.g. team locked), 422 invalid input,
429 too many invitations.

**Rules enforced on the server** include: `@kiet.edu` accounts register only as KIET and other accounts only as other
college or school; teams of 2 to 5 from the same college or school; one team per student; school teams only in
Categories 5 and 7; Category 6 only for first-years; the registration window; teams locked after submission;
college, department and year locked while in a team; one pending invitation per student per team; unique team
names and KIET roll numbers; finalist quotas per department; department admins limited to their department.

**Concurrent requests**: every change to a team locks the team row (`SELECT ... FOR UPDATE`), and unique constraints
back up the cross-team rules (one team per student, unique names), so double clicks and simultaneous actions by
teammates cannot break the rules. `tests/test_concurrency.py` fires such races in parallel against PostgreSQL.

### Endpoints

Student portal (`client/lib/api/live.ts`): `GET /me`, `PUT /me/profile`, `GET /me/team`, `GET /me/invitations`,
`POST /teams`, `PATCH /teams/{id}`, `DELETE /teams/{id}`, `POST /teams/{id}/submit`, `POST /teams/{id}/leave`,
`DELETE /teams/{id}/members/{user_id}`, `POST /teams/{id}/invitations`, `DELETE /invitations/{id}`,
`POST /invitations/{id}/accept`, `POST /invitations/{id}/decline`.

Admin panel (`admin-panel/lib/api/live.ts`, which documents scoping and errors in detail): `GET /admin/me`,
`GET /admin/stats`, `GET /admin/teams`, `GET /admin/teams/export`, `GET /admin/teams/{id}`,
`POST /admin/teams/{id}/withdraw|disqualify|restore`, `GET /admin/students`, `GET /admin/students/export`,
`GET /admin/finalists`, `PUT /admin/finalists/{department}`, `GET /admin/finalists/summary`,
`POST /admin/results/publish`, `GET|POST /admin/admins`, `DELETE /admin/admins/{email}`, `GET /admin/audit`.
