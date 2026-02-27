# DSLM Server

Node.js + Prisma + SQLite backend for the DSLM inventory system.

## Setup

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

## Running

```bash
npm run dev        # development
npm run build      # production build
npm start          # production start
```

From the repo root (starts server + Expo together):

```bash
npm run dev:all
```

## Database

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed default data |
| `npm run db:reset` | Reset database |
| `npm run db:studio` | Open Prisma Studio |

## Default Admin

| Username | Password | Role |
|----------|----------|------|
| admin | dslm-admin-2025 | admin |

Change the password after first login. Create additional accounts through the admin panel.

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Categories
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`

### CTBs
- `GET /api/ctbs`
- `GET /api/ctbs/:id`
- `POST /api/ctbs`
- `PATCH /api/ctbs/:id`
- `DELETE /api/ctbs/:id`
- `POST /api/ctbs/:id/receive`

### Items
- `GET /api/items`
- `GET /api/items/:id`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`
- `POST /api/items/:id/deliver`
- `POST /api/items/:id/consume`
- `POST /api/items/:id/relocate`

### Shipments
- `GET /api/shipments`
- `GET /api/shipments/:id`
- `POST /api/shipments`
- `PATCH /api/shipments/:id`
- `POST /api/shipments/:id/launch`

### Sync
- `GET /api/sync/version`
- `GET /api/sync/changes?since=<version>`
- `GET /api/sync/full`
- `POST /api/sync/push`
- `POST /api/sync/ack`

### Users (Admin)
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `POST /api/users/:id/reset-password`

### Other
- `GET /health` — health check
- `GET /items` — legacy endpoint

## Environment

Create `.env` in the server directory:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=4000
```
