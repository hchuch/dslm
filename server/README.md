# DSLM Server

Node.js + Prisma + SQLite server for the DSLM (Deep Space Logistics Module) inventory management system.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Generate Prisma client:
```bash
npm run db:generate
```

3. Create database and run migrations:
```bash
npm run db:push
```

4. Seed the database with default data:
```bash
npm run db:seed
```

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Run with Expo App
From the repo root:
```bash
npm install
npm run dev:all
```

## Database Management

- **Generate Prisma Client**: `npm run db:generate`
- **Push Schema**: `npm run db:push`
- **Run Migrations**: `npm run db:migrate`
- **Seed Data**: `npm run db:seed`
- **Reset Database**: `npm run db:reset`
- **Open Prisma Studio**: `npm run db:studio`

## Default Admin Account

After seeding, the admin account is available:

| Username | Password | Role |
|----------|----------|------|
| admin | dslm-admin-2025 | admin |

**Important:** Change the admin password after first login. Additional user accounts should be created through the admin panel in the app.

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create custom category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete custom category

### CTBs
- `GET /api/ctbs` - List all CTBs
- `GET /api/ctbs/:id` - Get single CTB
- `POST /api/ctbs` - Create CTB
- `PATCH /api/ctbs/:id` - Update CTB
- `DELETE /api/ctbs/:id` - Delete CTB
- `POST /api/ctbs/:id/receive` - Receive incoming CTB

### Items
- `GET /api/items` - List all items
- `GET /api/items/:id` - Get single item
- `POST /api/items` - Create item
- `PATCH /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- `POST /api/items/:id/deliver` - Mark item delivered
- `POST /api/items/:id/consume` - Mark item consumed
- `POST /api/items/:id/relocate` - Relocate item

### Shipments
- `GET /api/shipments` - List all shipments
- `GET /api/shipments/:id` - Get single shipment
- `POST /api/shipments` - Create shipment
- `PATCH /api/shipments/:id` - Update shipment
- `POST /api/shipments/:id/launch` - Launch shipment

### Sync
- `GET /api/sync/version` - Get current sync version
- `GET /api/sync/changes?since=<version>` - Get changes since version
- `GET /api/sync/full` - Full data dump
- `POST /api/sync/push` - Push local changes
- `POST /api/sync/ack` - Acknowledge sync version

### Users (Admin Only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/reset-password` - Reset user password

### Legacy (Backward Compatibility)
- `GET /items` - Legacy items endpoint

## Environment Variables

Create a `.env` file in the server directory:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
PORT=4000
```
