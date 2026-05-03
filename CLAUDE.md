# CLAUDE.md — English Learning Platform

## Project Overview

A full-stack English learning platform (MVP) built as a **pnpm monorepo**.
Two core learning flows: **Interactive Shadowing** (video-based pronunciation) and **Speaking Practice with AI** (conversation with GPT-4o-mini).

---

## Monorepo Structure

```
english-learning-platform/
├── apps/
│   ├── api/                        # NestJS — REST API + WebSocket
│   └── web/                        # Next.js 16 (App Router)
├── packages/
│   ├── shared/                     # DTOs, Zod schemas, enums (shared by api + web)
│   └── ui/                         # Shadcn-based shared components (optional)
├── docs/
│   ├── architecture.md
│   ├── database.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── pnpm-workspace.yaml
├── CLAUDE.md                       ← you are here
└── .cursorrules
```

---

## Tech Stack

### Backend — `apps/api`
| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| ORM | TypeORM |
| Database | PostgreSQL |
| Auth | Passport.js + JWT (access + refresh tokens) |
| Roles | RBAC — `user`, `admin` |
| AI | Azure OpenAI `gpt-4o-mini` (conversation) |
| Speech token broker | Azure Speech SDK REST (server issues tokens) |
| Validation | `class-validator` + `class-transformer` |
| API docs | Swagger (`@nestjs/swagger`) |

### Frontend — `apps/web`
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Auth | NextAuth.js v5 + JWT strategy (calls `apps/api`) |
| Styling | TailwindCSS + Shadcn/ui |
| State | Zustand (client state) + React Query (server state) |
| Media | YouTube IFrame API |
| Speech | Azure Speech SDK for JavaScript (browser) |
| Forms | React Hook Form + Zod |

### Shared — `packages/shared`
- Zod schemas (single source of truth for validation)
- TypeScript types / DTOs auto-generated from Zod
- Enums: `Role`, `DifficultyLevel`, `PracticeType`

### Infrastructure
- Development OS: Window
- Package manager: `pnpm` + `pnpm workspaces`
- Containerization: Docker + Docker Compose
- Deployment target: VPS (single server, docker-compose.prod.yml)

---

## MVP Feature Scope

### 1. Auth
- Register / Login / Logout
- Access token (15m) + Refresh token (7d) with rotation
- Role-based: `user` (learner) vs `admin`
- NextAuth.js on web delegates credentials to api

### 2. Admin Panel (minimal)
- CRUD: Videos (YouTube URL + metadata + subtitle JSON)
- CRUD: AI Scenarios (title + system prompt + difficulty)
- Protected by `admin` role guard

### 3. Interactive Shadowing
- Browse video list → select video
- YouTube IFrame player, sentence-level subtitle overlay
- User shadows each sentence (Azure Speech-to-Text)
- Per-word score returned, highlighted in UI
- Progress saved per user per video

### 4. Speaking Practice with AI
- Browse scenario list → enter conversation
- Turn-based: User speaks → Azure STT → send to GPT-4o-mini → TTS response
- Conversation history kept in session (not persisted to DB)
- Session summary saved to progress tracking

### 5. Progress Tracking
- `shadowing_progress` table: video_id, user_id, sentence scores, completed_at
- `speaking_progress` table: scenario_id, user_id, session_summary, score, completed_at
- Dashboard: user sees personal stats

---

## Key Conventions

### API (NestJS)
- **Module structure**: each feature = `module/`, `controller/`, `service/`, `dto/`, `entity/`
- **Route prefix**: `/api/v1`
- **DTOs**: always use `class-validator` decorators; import types from `@english-platform/shared`
- **Guards**: `JwtAuthGuard` (default), `RolesGuard` for admin routes
- **Error handling**: always throw `HttpException` subclasses, never raw errors
- **Never** bypass validation with `@SkipTransform` unless explicitly justified

### Web (Next.js)
- **App Router only** — no Pages Router
- **Server Components by default** — add `'use client'` only when needed (interactivity, hooks, browser APIs)
- **Data fetching**: Server Components fetch directly; client components use React Query
- **Route structure**: `/app/(auth)/`, `/app/(dashboard)/`, `/app/admin/`
- **Never** use `useEffect` for data fetching — use React Query or Server Components

### Shared Package
- All Zod schemas live in `packages/shared/src/schemas/`
- Types are inferred from Zod: `export type CreateVideoDto = z.infer<typeof CreateVideoSchema>`
- Import in api: `import { CreateVideoDto } from '@english-platform/shared'`
- Import in web: `import { CreateVideoSchema } from '@english-platform/shared'`

### Design System
All UI work must follow `design.md` at the project root.
Before generating or editing any component in `apps/web`, read design.md and apply its tokens.

### Git
- Branch: `feature/<ticket>-<slug>`, `fix/<ticket>-<slug>`, `chore/<slug>`
- Commit: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Never commit `.env` files; always update `.env.example`

---

## Environment Variables

See `.env.example` for full list. Key vars:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/english_platform

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Azure Speech
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Running the Project

```bash
# Install all dependencies
pnpm install

# Run dev (api + web in parallel)
pnpm dev

# Run individual apps
pnpm --filter api dev
pnpm --filter web dev

# Database migrations
pnpm --filter api migration:run

# Build all
pnpm build

# Docker
docker-compose up -d
```

---

## Current Focus

See `docs/database.md for database structure`
**Phase 1 (current):** Project scaffolding, Auth module, Admin CRUD.
**Phase 2:** Interactive Shadowing flow + Azure Speech integration.
**Phase 3:** Speaking Practice with AI flow.
**Phase 4:** Progress tracking dashboard + polish.

---

## Important References
- NestJS docs: https://docs.nestjs.com
- Next.js docs: https://nextjs.org/docs
- Azure Speech SDK: https://learn.microsoft.com/azure/ai-services/speech-service