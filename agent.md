# Shopify App Manager (sam)

## What This Project Is

A CLI tool called `sam` that scaffolds and manages Shopify embedded apps built with React Router v7, deployed on Cloudflare Workers. It abstracts a dual-runtime stack (Node.js for local dev, Cloudflare Workers for production) into four commands: `init`, `dev`, `deploy`, `release`.

## Project Structure

```
src/                          # CLI source code (TypeScript, ESM)
├── index.ts                  # Entry point - Commander.js program, registers commands
├── commands/
│   ├── init.ts               # sam init - scaffold project from template
│   ├── dev.ts                # sam dev - runs shopify app dev
│   ├── deploy.ts             # sam deploy - builds + wrangler deploy
│   └── release.ts            # sam release - shopify app versions create
└── utils/
    ├── logger.ts             # Styled console output (chalk)
    ├── exec.ts               # Shell execution wrappers (execa)
    ├── template.ts           # Template copy + {{VAR}} interpolation
    └── project.ts            # sam.config.json read/write/detection

templates/default/            # Embedded project template (ships with npm package)
├── app/                      # React Router v7 app source
│   ├── entry.server.tsx      # Node.js SSR entry (renderToPipeableStream)
│   ├── entry.server.worker.tsx  # Workers SSR entry (renderToReadableStream)
│   ├── entry.worker.ts       # Cloudflare fetch handler (outermost production entry)
│   ├── shopify.server.ts     # Node.js Shopify init (uses process.env)
│   ├── shopify.server.worker.ts  # Workers Shopify init (Proxy/Bridge pattern)
│   ├── db.server.ts          # Dual Prisma client (SQLite local / D1 production)
│   ├── worker-session-storage.ts
│   ├── root.tsx              # Root layout
│   ├── routes.ts             # File-system routing config
│   └── routes/               # App routes (Polaris UI)
├── prisma/                   # Schema + initial migration
├── package.json.template     # Interpolated with {{PROJECT_NAME}}
├── wrangler.toml.template    # Interpolated with {{PROJECT_NAME}}, {{D1_DATABASE_NAME}}
├── vite.config.ts            # Dev build (Node.js)
└── vite.worker.config.ts     # Production build (Workers, with file-swapping plugin)
```

## Tech Stack

**CLI itself:** TypeScript, Commander.js, @inquirer/prompts, execa, chalk, fs-extra. Built with tsup (ESM, Node 20 target). Shebang added via tsup banner config.

**Generated projects:** React Router v7, Shopify Polaris, Shopify App Bridge, Prisma ORM (with D1 adapter), Cloudflare Workers, Vite 6, Wrangler.

## Key Architecture Concepts

### Dual Runtime Strategy
The template produces apps that run on Node.js locally and Cloudflare Workers in production. Platform-specific code lives in paired files (`*.ts` / `*.worker.ts`). A custom Vite plugin in `vite.worker.config.ts` swaps imports at build time so routes import from `~/shopify.server` without knowing the environment.

### Proxy/Bridge Pattern (Workers)
Cloudflare Workers lack `process.env` at module scope. `shopify.server.worker.ts` uses `initShopify(env)` called per-request from `entry.worker.ts`, with Proxy objects for `authenticate`, `sessionStorage`, `login`, `unauthenticated` that forward to the initialized instance.

### Request-Scoped Prisma (Workers)
D1 bindings are per-request. `db.server.ts` uses `AsyncLocalStorage` to store a request-scoped Prisma client, set up in `entry.worker.ts` via `prismaStorage.run()`. The default export is a Proxy that resolves to either the Worker's request-scoped client or the Node.js global singleton.

### Template Interpolation
Files ending in `.template` get `{{VAR}}` placeholders replaced and the extension stripped during `sam init`. Non-template files are copied as-is. Three variables exist: `PROJECT_NAME`, `APP_NAME`, `D1_DATABASE_NAME`.

### Project Detection
`sam.config.json` marks a directory as sam-managed. Commands `dev`, `deploy`, `release` call `requireSamProject()` which reads this file or exits with an error.

## Build and Run

```bash
npm run build        # tsup build to dist/
npm run dev          # tsup --watch
npm run typecheck    # tsc --noEmit
npm run start        # node dist/index.js
npm link             # makes 'sam' available globally for testing
```

Output is a single `dist/index.js` (ESM, with shebang). The `bin` field maps `sam` -> `./dist/index.js`. Published `files` include `dist/` and `templates/`.

## Conventions

- ESM throughout (`"type": "module"` in package.json, `.js` extensions in imports)
- Commands are standalone `Command` objects exported from `src/commands/` and registered in `src/index.ts`
- External CLI tools (shopify, wrangler, prisma) are invoked via `execa` with `stdio: "inherit"` so the user sees real-time output
- `requireCommand()` checks for CLI prerequisites before running
- Error handling in `init` is graceful (warns but continues); other commands exit on failure
- Template files use `.template` extension convention; all other files in `templates/` are copied verbatim
