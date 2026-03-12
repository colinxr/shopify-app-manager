i'd like to build a CLI tool called Shopify App Manager. It is a way to scaffold
a shopify app using the shopify react router template that is able to to hosted
on cloudflare.

i'd like to have a cli called sam.

i can use commands like

sam init which sets up a new project.

sam dev run shopify app dev command.

sam deploy runs wrangler deploy

sam release creates anew shopify version of the app.

i've built this stack in a one off repo template, that i can clone and manage on
a per project need, but abstracting this into a cli is of great interest to me
professionally.

here are the details around the stack

<technical_details>

# Shopify App - React Router + Cloudflare Workers

A Shopify embedded app built with **React Router v7** that runs on **Cloudflare Workers** (edge runtime) for production, with Node.js for local development.

This is a fork of the [official Shopify React Router template](https://github.com/Shopify/shopify-app-template-react-router), modified to support Cloudflare's edge runtime instead of Node.js.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dual Environment Strategy](#dual-environment-strategy)
3. [Key Files & Entry Points](#key-files--entry-points)
4. [The "File Swapping" Mechanism](#the-file-swapping-mechanism)
5. [State Management (The Cloudflare Challenge)](#state-management-the-cloudflare-challenge)
6. [Database (Prisma + D1)](#database-prisma--d1)
7. [Services Layer](#services-layer)
8. [Setup & Development](#setup--development)
9. [Deployment](#deployment)
10. [Common Patterns](#common-patterns)

---

## Architecture Overview

This app is designed to work in **two distinct environments**:

| Aspect             | Local Development                  | Production                             |
| ------------------ | ---------------------------------- | -------------------------------------- |
| **Runtime**        | Node.js                            | Cloudflare Workers (Edge)              |
| **Server Adapter** | `@react-router/node`               | `@react-router/cloudflare`             |
| **Database**       | SQLite (`file:dev.sqlite`)         | Cloudflare D1                          |
| **Prisma Client**  | Singleton on `global`              | Request-scoped via `AsyncLocalStorage` |
| **SSR Streams**    | Node.js Streams (`PipeableStream`) | Web Streams (`ReadableStream`)         |
| **Build Config**   | `vite.config.ts`                   | `vite.worker.config.ts`                |

---

## Dual Environment Strategy

The core challenge with Cloudflare Workers is that they **lack Node.js APIs**. We cannot use `process.env`, Node.js streams, or global singletons in the same way.

To solve this, we maintain **platform-specific implementations** for infrastructure code (entry points, database, Shopify config) while keeping business logic (routes, services, UI) platform-agnostic.

### Build-Time File Swapping

A custom Vite plugin intercepts imports during the production build and redirects them to Cloudflare-compatible files:

| Import (Routes/Services)                          | Build Result                      |
| ------------------------------------------------- | --------------------------------- |
| `import { authenticate } from "~/shopify.server"` | Uses `shopify.server.worker.ts`   |
| `import prisma from "~/db.server"`                | Uses D1 adapter instead of SQLite |

---

## Key Files & Entry Points

```
app/
├── entry.server.tsx           # Node.js SSR entry (local)
├── entry.server.worker.tsx    # Cloudflare SSR entry (production)
├── entry.worker.ts            # Cloudflare fetch handler (production)
├── shopify.server.ts          # Node.js Shopify init (local)
├── shopify.server.worker.ts   # Cloudflare Shopify init (production)
├── db.server.ts               # Prisma client (runtime detection)
└── worker-session-storage.ts  # Session storage (shared)
```

### Entry Points Comparison

| File                      | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| `entry.server.tsx`        | Uses `renderToPipeableStream` + Node streams.                               |
| `entry.server.worker.tsx` | Uses `renderToReadableStream` + Web streams.                                |
| `entry.worker.ts`         | The main Cloudflare fetch handler. Initializes Shopify + DB before routing. |

---

## The "File Swapping" Mechanism

`vite.worker.config.ts` contains a custom Vite plugin (`shopify-server-redirect`) that runs **before** TypeScript resolution. It intercepts imports of Node.js-specific files and redirects them to their Worker counterparts.

```typescript
// vite.worker.config.ts
{
  name: "shopify-server-redirect",
  enforce: "pre",
  resolveId(source) {
    if (source.endsWith("/shopify.server")) {
      return "./app/shopify.server.worker.ts";
    }
    if (source.endsWith("/entry.server")) {
      return "./app/entry.server.worker.tsx";
    }
  }
}
```

This allows your routes to import from `~/shopify.server` without knowing which environment they're running in.

---

## State Management (The Cloudflare Challenge)

### The Problem

In Node.js, you typically initialize global clients at module scope:

```typescript
// Node.js style (works because process.env is available at build/start time)
const shopify = shopifyApp({ apiKey: process.env.SHOPIFY_API_KEY });
export const authenticate = shopify.authenticate;
```

In Cloudflare Workers, `process.env` is **undefined** at module load time. Environment variables only exist inside the `fetch(request, env)` handler.

### The Solution: Lazy Initialization + Proxies

We use a "Bridge" pattern:

1.  **Request Starts**: `entry.worker.ts` calls `initShopify(env)` with runtime secrets.
2.  **Route Imports**: Routes import `authenticate` (a Proxy object).
3.  **Route Calls**: When `authenticate.admin(request)` is called, the Proxy forwards it to the initialized instance.

```typescript
// shopify.server.worker.ts
let appInstance: ShopifyApp | undefined;

export function initShopify(env: ShopifyEnv) {
  appInstance = shopifyApp({ apiKey: env.SHOPIFY_API_KEY, ... });
}

// The Proxy "waits" for initShopify to be called
export const authenticate = new Proxy({}, {
  get(_, prop) {
    return getApp().authenticate[prop]; // getApp() throws if not initialized
  }
});
```

---

## Database (Prisma + D1)

### The Abstraction

`app/db.server.ts` exports a Prisma client that automatically switches implementation:

- **Node.js**: Uses `new PrismaClient()` with SQLite. Singleton pattern prevents connection exhaustion.
- **Cloudflare**: Uses `new PrismaClient({ adapter: new PrismaD1(env.DB) })`. Request-scoped pattern required because D1 binding is unique per request.

### Request Scoping

Cloudflare requires the D1 client to be created **per request** (the binding comes from the runtime). We use `AsyncLocalStorage` to make the client available to the app without passing it through every function:

```typescript
// entry.worker.ts
const prisma = createPrismaClient({ DB: env.DB });
prismaStorage.run(prisma, () => handleRequest(...));
```

Anywhere in your app, you can simply `import prisma from "~/db.server"` and it will resolve to the correct client for the current request.

## Setup & Development

### Prerequisites

- Node.js 20+
- Cloudflare account
- Shopify Partner account

### Environment Variables

Create a `.env` file:

```bash
# Local development (Node.js)
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...
SHOPIFY_APP_URL=http://localhost:3000
SCOPES=read_products,write_products
```

### Commands

```bash
# Start local dev server (Node.js)
npm run dev

# Build for production (Cloudflare)
npm run build:worker

# Deploy to Cloudflare Workers
npm run deploy

# Open Prisma Studio (local)
npm run prisma studio
```

---

## Deployment

### Wrangler Configuration

`wrangler.toml` defines the Cloudflare infrastructure:

```toml
name = "your-app"
main = "./build/server/index.js"
compatibility_date = "2025-08-05"

[[d1_databases]]
binding = "DB"
database_name = "your-app-db"
database_id = "your-d1-id"
```

### Required Secrets

Set these in Cloudflare Dashboard or via wrangler:

```bash
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put SCOPES
npx wrangler secret put SESSION_SECRET
```

### Database Migrations

After deploying, run migrations on your D1 database:

```bash
npx wrangler d1 execute your-db --remote --file=./prisma/migrations/latest.sql
```

---

## Common Patterns

### Adding New Environment Variables

1.  **Add to `wrangler.toml`**:

    ```toml
    [vars]
    NEW_FEATURE_FLAG = true
    ```

2.  **Add to `app/shopify.server.worker.ts`**:

    ```typescript
    export interface ShopifyEnv {
      // ... existing fields
      NEW_FEATURE_FLAG?: string;
    }
    ```

3.  **Use in request**:
    ```typescript
    export function initShopify(env: ShopifyEnv) {
      if (env.NEW_FEATURE_FLAG) { ... }
    }
    ```

### Adding Database Tables

1.  **Edit `prisma/schema.prisma`**:

    ```prisma
    model MyTable {
      id String @id
      createdAt DateTime @default(now())
    }
    ```

2.  **Generate migration**:

    ```bash
    npx prisma migrate dev --name add_my_table
    ```

3.  **Deploy migration**:
    ```bash
    npx wrangler d1 execute your-db --remote --file=./prisma/migrations/YYYYMMDDHHMMSS_add_my_table.sql
    ```

---

## Resources

- [React Router v7 Docs](https://reactrouter.com/)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Prisma with
  D1](https://www.prisma.io/docs/orm/overview/databases/cloudflare-</technical_details>

:> [!WARNING]

> any cloudflare files or worker files should live in a hidden .sam directory.

can you build an executive summary of this tool?
