# Deployment

## 1. Scope

This document defines the deployment strategy for the AI Native Visual Engine editor and runtime renderer.

## 2. Platform

The editor and runtime preview are deployed to **Cloudflare Pages**.

Reasons:

1. Zero-config deployment for Vite-based projects.
2. Global edge network for low-latency editor loading.
3. Built-in preview deployments per branch.
4. Free tier sufficient for development and testing.
5. First-class support for static SPA deployment.

## 3. Build Output

The `editor` package produces a static SPA build via Vite.

```json
{
  "build": "vite build",
  "output": "packages/editor/dist"
}
```

### 3.1 Build Configuration

```ts
// packages/editor/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
```

### 3.2 Cloudflare Pages Config

```toml
# packages/editor/wrangler.toml
name = "ai-native-editor"
pages_build_output_dir = "dist"
compatibility_date = "2026-05-23"
```

## 4. Deployment Pipeline

### 4.1 Production

```text
main branch push
  -> pnpm build (all packages)
  -> pnpm test
  -> Cloudflare Pages deploy (editor/dist)
```

### 4.2 Preview

```text
PR opened or updated
  -> pnpm build
  -> pnpm test
  -> Cloudflare Pages preview deploy (unique URL per PR)
```

### 4.3 GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy packages/editor/dist --project-name=ai-native-editor
```

## 5. Environment Variables

The editor may require runtime configuration.

```env
VITE_COLLAB_WS_URL=wss://collab.example.com
VITE_API_BASE_URL=https://api.example.com
```

Rules:

1. `VITE_` prefixed variables are bundled at build time.
2. Secrets MUST NOT be prefixed with `VITE_`.
3. Environment-specific values are set in Cloudflare Pages dashboard, not committed.

## 6. Custom Domain

Post-MVP, the editor may be served from a custom domain.

```text
editor.ai-native.dev -> Cloudflare Pages project
```

DNS is managed through Cloudflare. SSL is automatic.

## 7. Relationship To Other Specs

- `implementation-stack.md`: Vite build configuration
- `collaboration-framework.md`: WebSocket URL for Yjs provider
- `roadmap.md`: phase-scoped delivery
