# DSLm Server

This is a small TypeScript Express server used for local development alongside the Expo app.

Quick start (inside project root):

1. Install server deps:

```bash
cd server
npm install
```

2. Start the server in dev mode (ts-node-dev):

```bash
npm run dev
```

From the repo root you can run both the app and server together:

```bash
npm install
npm run dev:all
```

API endpoints:
- GET /health
- GET /items
- GET /items/:id
- POST /items
