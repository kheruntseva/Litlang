# LitLang

Learn foreign languages through annotated excerpts from classic and contemporary fiction.

## Stack

| Layer | Technology |
|---|---|
| Reverse proxy | Nginx (Alpine) — TLS termination, static serving |
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| i18n | react-i18next — English and Russian |
| Backend | Node.js 20 + Express + Knex.js |
| Database | PostgreSQL 16 |
| Auth | JWT (access token in memory, refresh in HttpOnly cookie) |
| Containers | Docker Compose — nginx, api, db |

## Quick Start

**Prerequisites:** Docker Desktop, OpenRouter API key (free at [openrouter.ai](https://openrouter.ai))

```bash
# 1. Generate self-signed SSL cert
cd nginx/ssl && bash generate-cert.sh && cd ../..

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env — set JWT_SECRET and OPENROUTER_API_KEY

# 3. Build and start
docker compose up --build -d

# 4. Run migrations + seed demo data
docker exec <api-container> npx knex migrate:latest
docker exec <api-container> npx knex seed:run
```

Open **https://localhost** (accept the self-signed cert warning).

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@litlang.com | admin123 |
| User | user@litlang.com | user123 |

## Development Mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:5173 (Vite HMR)
- Backend: http://localhost:3000 (nodemon)
- PostgreSQL: localhost:5432 (direct access)

## Features

**Guest**
- Browse languages, categories, rules, and literary excerpts
- Full-text search across all passages

**User**
- Track rule progress: Not Started → In Progress → Completed
- Bookmark rules and excerpts as favourites
- Personal dashboard with learning statistics

**Admin**
- Full CRUD for all content with EN + RU translations
- AI-assisted excerpt and grammar summary generation (OpenRouter / Hugging Face)
- Project Gutenberg: search catalog, import full texts, extract matching passages
- Open Library ISBN metadata auto-fill
- User management and analytics dashboard

## Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Node.js API
│   ├── src/
│   │   ├── db/      # Knex migrations and seeds
│   │   ├── routes/  # Express route handlers
│   │   ├── services/# Business logic
│   │   └── middleware/
├── nginx/           # nginx.conf + SSL certs
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Environment Variables

See `server/.env.example` for the full list. Required for production:

```
JWT_SECRET=<random string>
CORS_ORIGIN=https://your-domain.com
```

Required for AI features:

```
OPENROUTER_API_KEY=sk-or-...
```
