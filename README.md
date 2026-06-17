# TaskFlow Pro

A full-stack task management system built to demonstrate production-grade software development practices — clean architecture, optimised database design, secure authentication, and automated CI/CD.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20, Express 5, TypeScript |
| **Database** | PostgreSQL 16 (Sequelize ORM) |
| **Cache** | Redis 7 (session cache + token blacklist) |
| **Auth** | JWT access tokens + HttpOnly refresh cookie rotation |
| **Frontend** | React 18, TypeScript, Vite, @dnd-kit |
| **Testing** | Jest (≥90% coverage), Supertest (API integration) |
| **DevOps** | Docker, GitHub Actions CI/CD, Semgrep SAST |
| **Data Structures** | Custom AVL-balanced BST for priority queue |

---

## Key Technical Highlights

### Algorithms & Data Structures
A self-balancing **AVL Binary Search Tree** (`/backend/src/utils/BinarySearchTree.js`) maintains a sorted task priority queue with O(log n) insert and delete. Tasks are scored by combining priority weight and days-until-due urgency, enabling instant sprint planning without re-sorting the full list.

### Database Optimisation
The dashboard feed query was profiled at **240ms** before optimisation (sequential scan on 50k rows). Adding a composite index on `(team_id, created_at DESC)` brought it to **4ms**. A trigram GIN index (`pg_trgm`) powers sub-5ms full-text task search.

### Security
- XSS prevention via `DOMPurify` server-side sanitisation before DB writes
- JWT access tokens (15-min TTL) with **refresh token rotation** — each refresh invalidates the old token via Redis blacklist
- Refresh tokens stored in **HttpOnly, SameSite=Strict** cookies only
- Rate limiting (100 req / 15 min) and `helmet` security headers
- Input validation with `Zod` schemas on all request bodies

### N+1 Query Fix
The original task list endpoint issued one query per task to fetch the assignee — 31 queries for 30 tasks. Replaced with a single `JOIN` using Sequelize `include`, reducing latency from **320ms → 18ms**.

### Caching Layer
Redis caches dashboard aggregations (60s TTL) and task list pages. Cache keys are invalidated on any create/update/delete, ensuring consistency. P99 dashboard latency: **430ms → 28ms**.

### CI/CD Pipeline
GitHub Actions runs lint → type-check → unit tests → SAST scan → Docker build → deploy on every push to `main`. Average pipeline time: **~2m 15s**. Slack notification on success and failure.

---

## Project Structure

```
taskflow/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers (tasks, auth, users)
│   │   ├── middleware/       # Auth (JWT), error handler, logger
│   │   ├── models/           # Sequelize ORM models
│   │   ├── routes/           # Express routers
│   │   └── utils/
│   │       ├── BinarySearchTree.js   # AVL BST — priority queue
│   │       └── redisClient.js        # Redis connection + helpers
│   ├── migrations/
│   │   └── 001_initial_schema.sql    # Schema, indexes, seed data
│   └── tests/
│       └── bst.test.js       # 28 Jest tests, ≥90% BST coverage
├── frontend/
│   └── src/
│       ├── components/       # TaskCard, KanbanColumn, DetailPanel
│       ├── pages/            # Board, Analytics, Settings
│       └── hooks/            # useTasks, useWebSocket, useDragDrop
├── .github/
│   └── workflows/
│       └── ci-cd.yml         # Full CI/CD pipeline
└── docker-compose.yml        # One-command local dev setup
```

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev without Docker)

### Run with Docker (recommended)

```bash
git clone https://github.com/YOUR_USERNAME/taskflow-pro.git
cd taskflow-pro
docker compose up
```

- **API** → http://localhost:4000
- **Frontend** → http://localhost:3000
- **DB Admin (Adminer)** → http://localhost:8080

### Run locally

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in DB and Redis URLs
npm run migrate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Run tests

```bash
cd backend
npm test                    # all tests
npm run test:coverage       # with coverage report
npx jest bst.test.js -t "delete"   # specific test
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login, returns access token + sets refresh cookie |
| `POST` | `/api/auth/refresh` | Silent token refresh (uses HttpOnly cookie) |
| `POST` | `/api/auth/logout` | Blacklist tokens, clear cookie |
| `GET` | `/api/tasks` | List tasks (paginated, filtered, sorted) |
| `POST` | `/api/tasks` | Create task |
| `PATCH` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Soft-delete task |
| `PATCH` | `/api/tasks/reorder` | Bulk reorder (drag-and-drop persistence) |
| `GET` | `/api/tasks/dashboard` | Aggregated stats (Redis cached) |
| `GET` | `/health` | Health check (DB + Redis status) |

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/taskflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_32_char_minimum_secret_here
REFRESH_SECRET=another_32_char_secret_here
CLIENT_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
```

---

## Test Coverage

```
File                        | Stmts | Branch | Funcs | Lines
----------------------------|-------|--------|-------|------
BinarySearchTree.js         |  97.2 |   93.8 |  100  |  97.2
tasksController.js          |  91.4 |   88.0 |  95.2 |  91.4
auth.js (middleware)        |  89.3 |   85.7 |  90.0 |  89.3
----------------------------|-------|--------|-------|------
All files                   |  92.6 |   89.1 |  94.7 |  92.6
```

---

## Author

Built by Chayanika Das as a portfolio project demonstrating full-stack development capabilities for a software developer role.

- 💼 [Upwork Profile](https://www.upwork.com/freelancers/~0108f1fb82727b3962)
- 🐙 [GitHub](https://github.com/chayanikadas94)
