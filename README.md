# Billing and Store Management

Production-oriented billing, POS, inventory, subscription, and admin foundation for a shop-scoped SaaS application.

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Alembic
- Database: PostgreSQL
- Frontend: React, Vite, TypeScript
- Tests: Pytest for backend, Vite/TypeScript build for frontend

## Repository Safety

Do not commit local secrets or generated business data.

Ignored local files include:

- `.env` and `.env.*`
- SQL dumps and database backups
- local SQLite/database files
- uploaded logos/products/files
- logs, caches, build output, and `node_modules`

Safe templates are committed as `.env.example`, `backend/.env.example`, and `frontend/.env.example`.

## Backend Setup

From the repository root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create a local backend environment file from the safe template:

```powershell
Copy-Item .env.example .env
```

Fill in local values only. Never commit `.env`.

Required backend settings include:

- `DATABASE_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`
- `FRONTEND_BASE_URL`
- optional SMTP settings for password reset email

## Database and Migrations

Use PostgreSQL for development and production-like checks.

Apply migrations only to an intended database:

```powershell
cd backend
python -m alembic -c alembic.ini upgrade head
```

Inspect migration state:

```powershell
python -m alembic -c alembic.ini current
python -m alembic -c alembic.ini heads
python -m alembic -c alembic.ini history
```

Do not run `alembic stamp` or `alembic upgrade head` against an important populated database until the migration plan has been reviewed and backed up.

## Backend Development

Start the backend locally:

```powershell
cd backend
uvicorn app.main:app --reload
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

Run backend tests:

```powershell
cd backend
python -m pytest
```

## Frontend Setup

From the repository root:

```powershell
cd frontend
npm install
```

Create a local frontend environment file:

```powershell
Copy-Item .env.example .env
```

Set:

- `VITE_API_BASE_URL`
- `VITE_APP_NAME`

Start the frontend:

```powershell
npm run dev
```

Build the frontend:

```powershell
npm run build
```

## GitHub Pre-Push Safety

Before the first GitHub push:

1. Verify `git status`.
2. Verify no `.env`, SQL dumps, uploads, local DB files, logs, or build output are tracked.
3. Run a secret scan.
4. Decide whether Git history must be cleaned because previous local commits included dumps/uploads.
5. Back up the local repository before any history rewrite.
6. Run backend tests and frontend build.
7. Review Alembic migration state and database backup plan.

Do not push this repository until historical sensitive/generated files have been reviewed.
