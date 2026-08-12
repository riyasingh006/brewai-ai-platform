# BrewAI — Full-Stack Verification & Production-Readiness Report

Date: 2026-08-12
Scope: End-to-end audit of the BrewAI web app — Next.js 16 frontend (`frontend/`), FastAPI backend
(`backend/`), shared Gemini AI core (`app/`), Prisma/SQLite database, auth, payments, env/config
security, and git hygiene. All tests were executed against the live servers
(backend `http://localhost:8000`, frontend `http://localhost:3000`).

## 1. Build & Type-Check Status

- `npx tsc --noEmit` — PASS (exit 0, no errors).
- `npm run lint` — PASS (0 errors; 1 pre-existing `<img>` warning in `components/nearby-cafes/CafeDetails.tsx:119`).
- `npm run build` (Next.js 16.3.0, Turbopack) — PASS (lint + TypeScript + build clean).
  Routes: `/`, `/login`, `/auth`, `/nearby-cafes`, `/admin/login`, `/admin/register` (static),
  `/[[...path]]` (dynamic SPA), plus `ƒ Proxy (Middleware)` (admin gate in `frontend/proxy.ts`).
- Backend import check — PASS (all routers, services, and `app/` AI modules import; `create_app()` runs).

## 2. Runtime / Server Status

- Backend `uvicorn backend.main:app` on `127.0.0.1:8000` — healthy (`/api/health` → 200,
  `{"status":"ok","provider":"sandbox","env":"development"}`), startup logs clean, admin bootstrap ran
  (`admin@coffeeshop.local` already admin).
- Frontend `next dev` on `localhost:3000` — up, serves `/login` 200, proxy active.
- **FIX (blocker):** The backend processes running before this audit were started 2026-08-09 — BEFORE the
  recent key/secret rotation — so they held the OLD secrets in memory (fresh `.env` values were rejected:
  `401 Invalid admin sign-in key.`). Both stale processes were stopped and the backend restarted with the
  current `.env`. The duplicate-process situation (two uvicorn PIDs on :8000) is resolved — one backend now.

## 3. Functional API Verification (all PASS)

| Check | Result |
|---|---|
| Customer register (`/api/auth/register`) | 201, role forced to `customer` |
| Customer login → `/api/me` | 200 |
| `/api/menu` | 200, 46 menu items, full catalog |
| Add to cart / view cart | 200 (line + qty + unit price correct) |
| Checkout `/api/orders` | 200, order created `CS-…`, total includes tax |
| Charge `/api/payments/charge` (sandbox, UPI) | 200, `status: paid` |
| Order after charge | 200, `status: confirmed`, `paymentStatus: paid` |
| `/api/orders` list + `/api/orders/{id}` | 200 |
| `/api/menu/recommendations` | 200 |
| Receipt PDF generation + `/api/receipts/{file}` | 200 (generated during checkout) |

Test data created for verification was fully removed from `backend/prisma/dev.db` afterwards.

## 4. Authentication & Authorization

- **Session JWT (HS256)** signed with backend `AUTH_SECRET`, verified by the frontend proxy with the
  same secret; role always resolved from the database (`backend/core/deps.py`) — client-side role
  tampering cannot escalate.
- **Admin key** checked with constant-time `hmac.compare_digest` against `ADMIN_SECRET_KEY`.
- **BUG FOUND & FIXED (blocker):** `frontend/.env.local` `AUTH_SECRET` did NOT match the backend
  `.env` value (`dev-auth-secret-change-me-…`). Any `brewai.session` cookie signed by the backend failed
  verification in `frontend/proxy.ts` → admin would loop-redirect to `/admin/login`. Fix: synced
  `frontend/.env.local` `AUTH_SECRET` to the backend value (verified by PyJWT cross-verify, then live:).

| Test (live, through the real proxy) | Result |
|---|---|
| Admin-signed JWT cookie → `/admin/dashboard` | 200 (page renders) |
| Customer-role JWT cookie → `/admin/dashboard` | redirected to `/dashboard` |
| Forged-signature cookie → `/admin/dashboard` | redirected to `/admin/login?next=…` |
| Admin Bearer token → `/api/me`, `/api/admin/summary` | 200 |
| Customer Bearer token → `/api/admin/summary` | 403 |
| No credentials → protected APIs | 401 |

- **FINDING (login blocker — not auto-fixed):** no admin account in `dev.db` currently matches the
  current `ADMIN_DEV_PASSWORD` (stored `password_hash` predates the credential rotation; the bootstrap
  only sets the dev password when promoting a user, not for an existing admin). Admin key + JWT flows
  work, but the documented dev credentials cannot sign in. See §10 for options — nothing was reset to
  avoid changing existing passwords.
- **FINDING (by design):** the `x-dev-user` identity header is DISABLED because `AUTH_SECRET` is set
  (`backend/core/security.py`) — all requests require a real bearer JWT.

## 5. AI / Gemini Chat

- Live streaming chat test PASS: `POST /api/chat` produced a real Gemini response with `tool` + `assistant`
  SSE events; a "cold, not-too-sweet" query returned a relevant recommendation (Cold Brew, Green Detox
  Smoothie, Chai Latte) and invoked the menu tools.
- `GEMINI_API_KEY` is present and format-validated; `MODEL_NAME=gemini-3.6-flash` with a fallback chain
  via `GEMINI_MODEL_FALLBACKS`.

## 6. Payments

- `PAYMENT_PROVIDER=sandbox` — end-to-end checkout works without real keys.
- **FINDING (NEEDS CONFIGURATION for production):** the Stripe/Razorpay path is a reference stub
  (`StripeLikeProvider` raises `NotImplementedError` until keys are wired) — it deliberately fails
  closed, so production must either implement a gateway or keep sandbox.

## 7. Security Audit

- Secrets scan of all TRACKED files — NO secrets found (no API keys, tokens, or passwords in git).
- `.env` and `frontend/.env.local` are gitignored (confirmed); `.env.example` is placeholder-only.
- No secrets in server logs or the built frontend bundle.
- CORS — already env-driven: `backend/main.py` uses `settings.cors_origins`, default
  `["http://localhost:3000"]`, overridable via `CORS_ORIGINS` (comma-separated). No hardcoded origin
  list found.
- **FINDING:** two different Google Maps keys exist (root `.env` vs `frontend/.env.local`). The
  frontend uses its own copy from `frontend/`. Confirm which key is current and keep only one.

## 8. Environment Configuration

- `backend/core/config.py` `Settings` is intact and reads: `APP_ENV`, `DATABASE_URL`, `CORS_ORIGINS`,
  `FRONTEND_URL`, `CHAT_RATE_LIMIT`, `PAYMENT_PROVIDER`, loyalty/birthday/tax knobs, `ADMIN_EMAIL`,
  `ADMIN_BOOTSTRAP_SECRET`, `ADMIN_DEV_PASSWORD`, `ADMIN_SECRET_KEY`, `AUTH_SECRET`,
  `SESSION_TTL_SECONDS`, and optional `CLERK_*` (JWKS-based verification in `core/security.py`).
- `app/config.py` reads `GEMINI_API_KEY` (also `MODEL_NAME`/`GEMINI_MODEL`), `GEMINI_MODEL_FALLBACKS`,
  `LOG_LEVEL`.
- **FIXED:** `.env.example` was incomplete (only 3 of ~20 vars). It now documents every var the code
  reads with safe placeholders and default values, and notes frontend-only vars for `frontend/.env.local`.
  No real values are present.
- `DATABASE_URL`, `CLERK_*`, `PAYMENT_PROVIDER` are not in `.env` — defaults are safe for dev; document
  in deployment checklist (see §10).

## 9. Data & Git Hygiene

- **FINDING (should fix at next commit):** generated artifacts are tracked in git:
  - `backend/prisma/dev.db` (contains real customer/admin data — committed to the repo)
  - `backend.log`
  - 30 receipt PDFs under `backend/receipts/`
- **FIXED:** `.gitignore` now covers `backend/prisma/*.db`, `backend/receipts/`, `backend.log` (new
  files are ignored; already-tracked files remain until untracked).
- Recommended (needs a commit, so left to you): `git rm --cached backend.log backend/prisma/dev.db
  backend/receipts/` then commit the removal together with the `.gitignore` update.

## 10. Open Items / Recommendations

1. **Admin login password (blocker for the owner):** no admin account matches the current
   `ADMIN_DEV_PASSWORD`. Options: (a) log in with the pre-rotation password, (b) reset the dev DB seed,
   or (c) approve a one-time reset of the `admin@coffeeshop.local` hash to `ADMIN_DEV_PASSWORD` in
   dev only. Not changed automatically out of respect for your "don't change existing passwords" rule.
2. **Untrack generated artifacts** (`git rm --cached …`, §9) at the next commit.
3. **Production env:** set `APP_ENV=production`, `DATABASE_URL`, `CORS_ORIGINS`, `AUTH_SECRET`/
   `ADMIN_SECRET_KEY`/`ADMIN_DEV_PASSWORD`-equivalent, `PAYMENT_PROVIDER` gateway or keys, and
   `ADMIN_BOOTSTRAP_SECRET` (required for admin bootstrap in production). Wire `CLERK_*` if using Clerk.
4. **Single Maps key:** keep one `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and restrict it to the production
   domain in Google Cloud Console.
5. **Tests:** no `test_*.py` files exist. Consider a small pytest suite for auth + order flow to lock in
   the behavior verified here.

## 11. Files Changed This Audit

- `frontend/.env.local` — synced `AUTH_SECRET` to match backend (gitignored, blocker fix).
- `.env.example` — completed with all vars + safe placeholders (tracked).
- `.gitignore` — ignore generated DB/receipts/log (tracked).
- `backend/prisma/dev.db` — verification test data added and then removed (tracked; see §9).
- No application code was changed; no secrets were printed, rotated, or committed.

## 12. Conclusion

All core user journeys (auth → menu → cart → checkout → sandbox payment → confirmed order,
admin role gate, Gemini chat) are verified working against the live stack with the CURRENT config.
One functional blocker was found and fixed (AUTH_SECRET mismatch), and one owner-action blocker
remains (admin password mismatch after the credential rotation). The app is in a good state for
development and ready for the production checklist in §10 before a real deployment.
