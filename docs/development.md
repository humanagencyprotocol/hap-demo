# Development

## Prerequisites

- Node.js 20+
- pnpm 9+
- Access to [hap-profiles](https://github.com/humanagencyprotocol/hap-profiles) (sibling directory or set `HAP_PROFILES_DIR`)

## Build from Source

```bash
git clone https://github.com/humanagencyprotocol/hap-gateway.git
cd hap-gateway
pnpm install && pnpm build
```

## Local Development

### With local SP (recommended for testing)

Start the SP locally from the [hap-sp](https://github.com/humanagencyprotocol/hap-sp) repo:

```bash
# Terminal 1 — SP (port 4100)
cd ../hap-sp && pnpm dev
```

```bash
# Terminal 2 — MCP Server (port 3030)
HAP_SP_URL=http://localhost:4100 \
HAP_PROFILES_DIR=../hap-profiles \
node apps/mcp-server/dist/http.mjs
```

```bash
# Terminal 3 — Control Plane (port 3000)
HAP_SP_URL=http://localhost:4100 \
node apps/control-plane/dist/index.mjs
```

Open `http://localhost:3000`. Register on the local SP, create a group, then create an authorization.

### With live SP

```bash
# Terminal 1 — MCP Server
HAP_PROFILES_DIR=../hap-profiles node apps/mcp-server/dist/http.mjs

# Terminal 2 — Control Plane
node apps/control-plane/dist/index.mjs
```

Log in at `http://localhost:3000` with your SP API key from [humanagencyprotocol.com](https://humanagencyprotocol.com).

### UI development (hot reload)

```bash
# Terminal — UI dev server (port 3002, proxies to control-plane)
pnpm dev:ui
```

Open `http://localhost:3002`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HAP_SP_URL` | `https://www.humanagencyprotocol.com` | Service Provider URL |
| `HAP_CP_PORT` | `3000` | Control Plane port |
| `HAP_MCP_PORT` | `3030` | MCP Server port |
| `HAP_MCP_INTERNAL_URL` | `http://127.0.0.1:3030` | MCP internal endpoint (Control Plane -> MCP) |
| `HAP_INTERNAL_SECRET` | (empty = skip check) | Shared secret for internal endpoints |
| `HAP_UI_DIST` | `../../ui/dist` | Path to built UI assets |
| `HAP_DATA_DIR` | `~/.hap` | Persistent storage directory |
| `HAP_PROFILES_DIR` | `../../hap-profiles` (relative to cwd) | HAP profiles directory |

## Docker

The Docker image runs both services in a single container:

```bash
docker compose up --build
```

Or manually:

```bash
docker build -t hap-gateway .
docker run -p 3000:3000 -p 3030:3030 \
  -e HAP_SP_URL=https://www.humanagencyprotocol.com \
  -v hap-data:/app/data \
  hap-gateway
```

The container uses `tini` as PID 1 for proper signal handling. Persistent data (gate store, execution log, credentials) lives in the `/app/data` volume.

## Testing

```bash
# Run all tests (hap-core + mcp-server)
pnpm test

# Run specific package
pnpm --filter @hap/core test
pnpm --filter @hap/mcp-server test
```

### Test suites

| Package | Tests | What |
|---------|-------|------|
| `hap-core` | 84 | Frame/bounds/context hashing, gatekeeper verification (v0.3 + v0.4), attestation encoding, hash determinism, v0.4 profile loading |
| `mcp-server` | 78 | Tool handlers, mandate brief, consumption tracking, gate store encryption, session restore, context loader, SP receipt integration |

### Cross-service E2E tests

The [hap-e2e](https://github.com/humanagencyprotocol/hap-e2e) repo runs full system tests against a local SP + gateway + Stripe:

```bash
cd ../hap-e2e
STRIPE_TEST_KEY=sk_test_xxx pnpm test
```

## Login Re-sync

When you log in through the control-plane UI, the login flow automatically:

1. Pushes the SP session cookie and vault key to the MCP server
2. Re-pushes all stored service credentials (Stripe API key, etc.)
3. Re-syncs all stored gate content with the SP attestation cache

After restarting the MCP server, a single login restores the full state.

## Related Repositories

| Repo | Purpose |
|------|---------|
| [hap-core](https://github.com/humanagencyprotocol/hap-core) | Shared protocol types, hashing, verification |
| [hap-sp](https://github.com/humanagencyprotocol/hap-sp) | Service Provider (attestation signing, receipts, groups) |
| [hap-profiles](https://github.com/humanagencyprotocol/hap-profiles) | Profile definitions (spend, ship, data, publish, provision) |
| [hap-e2e](https://github.com/humanagencyprotocol/hap-e2e) | Cross-service E2E test suite |
| [hap-protocol](https://github.com/humanagencyprotocol/hap-protocol) | Protocol specification + website |
