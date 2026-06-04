# AGENTS.md

## Cursor Cloud specific instructions

### Product

Client-only **2025 SIFF 排班助手** (subtitle-team scheduling). React 18 + Vite 7 + TypeScript. No backend, database, or Docker. State lives in browser `localStorage`.

### Prerequisites

- Node.js 18+ (VM uses Node 22)
- **pnpm** (required; `preinstall` runs `only-allow pnpm`)

### Commands

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Dev server | `pnpm run dev` → Vite on **http://localhost:5001** (`scripts/dev.sh` kills port 5001 first) |
| Production build | `pnpm run build` |
| Serve `dist/` | `pnpm run start` → static server on **http://localhost:5000** |
| Typecheck | `pnpm run ts-check` (may report existing strict/unused errors) |
| Lint | `pnpm run lint` → **eslint is not installed** in this repo; expect failure unless eslint is added |

README mentions port **3000**; actual dev port is **5001** (see `vite.config.ts` and `scripts/dev.sh`).

### Running services

- **Dev (primary):** one process — `pnpm run dev`. Use tmux for long-running dev (`vite-dev-server` or similar).
- **Prod-like:** `pnpm run build` then `pnpm run start` (or `cd dist-package && node server.js` for the prebuilt bundle).
- No separate DB/API services.

### pnpm build scripts

pnpm 10 may warn that **esbuild** postinstall scripts were skipped. Production `pnpm run build` has still succeeded in Cloud; if Vite fails to start, allow esbuild via `package.json` → `pnpm.onlyBuiltDependencies` (do not use interactive `pnpm approve-builds` in automation).

### Hello-world / E2E smoke test

1. Start dev server on port 5001.
2. Open `/` — dashboard **数据导入**.
3. Upload subtitler + schedule Excel files (client-side parse).
4. Open **排班总表** (`/schedule-overview`) and confirm table rows.

Sample fixtures used in Cloud setup: `/opt/cursor/artifacts/fixtures/subtitler-test.xlsx` and `schedule-test.xlsx` (minimal valid headers for parsers in `src/lib/parseSubtitlerExcel.ts` and `parseScheduleTable.ts`).

### Tests

No automated test script in `package.json`.
